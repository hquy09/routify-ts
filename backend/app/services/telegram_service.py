import html
import json
import re
import unicodedata
import urllib.request
import urllib.error
from datetime import datetime, date, timedelta
from typing import Dict, Any, List, Optional, Set, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_, desc
from app.models.sync import AppSetting
from app.models.task import Task
from app.services.schedule_service import ScheduleService

# In-memory tracking of reminders sent today to avoid duplicates
_SENT_REMINDERS_CACHE: Set[str] = set()

# Cached bot info in memory
_CACHED_BOT_INFO: Dict[str, Any] = {}

def normalize_command_name(cmd: str) -> str:
    """Normalize command string: lowercased, stripped, diacritics removed (e.g. /vỉewtask -> /viewtask)."""
    if not cmd:
        return ""
    cmd = cmd.strip().lower()
    if cmd.startswith("/"):
        parts = cmd.split("@")[0].split()
        if parts:
            cmd = parts[0]
    nfkd = unicodedata.normalize("NFKD", cmd)
    return "".join(c for c in nfkd if not unicodedata.combining(c))

def parse_datetime_flexible(text: str) -> Optional[datetime]:
    """
    Parse natural Vietnamese and English date/time strings into datetime.
    Supports:
    - Times: '18:00', '18h30', '9h'
    - Relative offsets: '+2h', '2h nua', '30p', '45 phut'
    - Relative days: 'hom nay', 'today', 'mai', 'ngay mai', 'tomorrow', 'mot', 'ngay kia'
    - Weekdays: 't2', 'thu 2', 't3', 't4', 't5', 't6', 't7', 'cn', 'chu nhat'
    - Dates: 'DD/MM', 'DD/MM/YYYY', 'YYYY-MM-DD', 'DD-MM'
    - Combined: 'mai 18:00', 't3 09h', '29/09 15:30'
    """
    if not text:
        return None
    raw = text.strip()
    now = datetime.now()
    today = now.date()

    # 1. Relative offset: +2h, 2 tiếng nữa, 30p, etc.
    rel = re.match(r"^\+?(\d+)\s*(h|tieng|tiếng|gio|giờ|hours?|p|phut|phút|mins?|m)(\s*nua|\s*nữa)?$", raw, re.I)
    if rel:
        val = int(rel.group(1))
        unit = rel.group(2).lower()
        if unit.startswith(("h", "t", "g")):
            return now + timedelta(hours=val)
        return now + timedelta(minutes=val)

    # 2. Extract time component if any: HH:MM or HHhMM or HHh
    time_match = re.search(r"(\b\d{1,2})[:h](\d{1,2})?\b", raw, re.I)
    h, m = 23, 59
    has_time = False
    clean_text = raw
    if time_match:
        has_time = True
        h = int(time_match.group(1))
        m = int(time_match.group(2)) if time_match.group(2) else 0
        h = max(0, min(23, h))
        m = max(0, min(59, m))
        clean_text = (raw[:time_match.start()] + " " + raw[time_match.end():]).strip()

    clean_lower = clean_text.lower().strip()
    target_date = None

    if not clean_lower or clean_lower in ["hom nay", "hôm nay", "today"]:
        target_date = today
        if not has_time:
            h, m = 23, 59
        elif datetime(today.year, today.month, today.day, h, m) < now:
            target_date = today + timedelta(days=1)
    elif clean_lower in ["mai", "ngày mai", "ngay mai", "tomorrow"]:
        target_date = today + timedelta(days=1)
    elif clean_lower in ["mot", "mốt", "ngay kia", "ngày kia"]:
        target_date = today + timedelta(days=2)
    elif clean_lower in ["t2", "thu 2", "thứ 2", "thu hai", "thứ hai", "mon", "monday"]:
        days_ahead = (0 - today.weekday() + 7) % 7 or 7
        target_date = today + timedelta(days=days_ahead)
    elif clean_lower in ["t3", "thu 3", "thứ 3", "thu ba", "thứ ba", "tue", "tuesday"]:
        days_ahead = (1 - today.weekday() + 7) % 7 or 7
        target_date = today + timedelta(days=days_ahead)
    elif clean_lower in ["t4", "thu 4", "thứ 4", "thu tu", "thứ tư", "wed", "wednesday"]:
        days_ahead = (2 - today.weekday() + 7) % 7 or 7
        target_date = today + timedelta(days=days_ahead)
    elif clean_lower in ["t5", "thu 5", "thứ 5", "thu nam", "thứ năm", "thu", "thursday"]:
        days_ahead = (3 - today.weekday() + 7) % 7 or 7
        target_date = today + timedelta(days=days_ahead)
    elif clean_lower in ["t6", "thu 6", "thứ 6", "thu sau", "thứ sáu", "fri", "friday"]:
        days_ahead = (4 - today.weekday() + 7) % 7 or 7
        target_date = today + timedelta(days=days_ahead)
    elif clean_lower in ["t7", "thu 7", "thứ 7", "thu bay", "thứ bảy", "sat", "saturday"]:
        days_ahead = (5 - today.weekday() + 7) % 7 or 7
        target_date = today + timedelta(days=days_ahead)
    elif clean_lower in ["cn", "chu nhat", "chủ nhật", "sun", "sunday"]:
        days_ahead = (6 - today.weekday() + 7) % 7 or 7
        target_date = today + timedelta(days=days_ahead)
    else:
        dm_match = re.search(r"(\d{1,2})[/-](\d{1,2})(?:[/-](\d{4}))?", clean_lower)
        if dm_match:
            d_val = int(dm_match.group(1))
            m_val = int(dm_match.group(2))
            y_val = int(dm_match.group(3)) if dm_match.group(3) else today.year
            try:
                target_date = date(y_val, m_val, d_val)
                if target_date < today and not dm_match.group(3):
                    target_date = date(y_val + 1, m_val, d_val)
            except Exception:
                pass

    if target_date is None:
        target_date = today

    return datetime(target_date.year, target_date.month, target_date.day, h, m)

def parse_addtask_args(raw_text: str) -> Dict[str, Any]:
    """Parse addtask arguments supporting both pipe-syntax and parameter flags."""
    raw_text = raw_text.strip()
    if not raw_text:
        return {}

    # Pipe syntax: Title | Due | Priority | Difficulty | Desc
    if "|" in raw_text:
        parts = [p.strip() for p in raw_text.split("|")]
        title = parts[0]
        due_raw = parts[1] if len(parts) > 1 else ""
        prio_raw = parts[2] if len(parts) > 2 else ""
        diff_raw = parts[3] if len(parts) > 3 else ""
        desc_raw = parts[4] if len(parts) > 4 else ""
        return {
            "title": title,
            "due_raw": due_raw,
            "priority_raw": prio_raw,
            "difficulty_raw": diff_raw,
            "description": desc_raw,
            "subtasks": []
        }

    # Flag parsing: -d / --due / -h, -p / --priority, -diff / --diff / -s / --star, -m / -desc / --note, --sub
    flag_pattern = r"(?:^|\s)(-(?:d|h|p|m|s|diff)|--(?:due|priority|diff|star|desc|note|sub))\s+"
    splits = re.split(flag_pattern, " " + raw_text, flags=re.I)

    title = splits[0].strip()
    flags = {}
    i = 1
    while i < len(splits) - 1:
        flag_name = splits[i].strip().lower().lstrip("-")
        flag_val = splits[i + 1].strip()
        flags[flag_name] = flag_val
        i += 2

    due_raw = flags.get("d") or flags.get("due") or flags.get("h") or ""
    prio_raw = flags.get("p") or flags.get("priority") or ""
    diff_raw = flags.get("diff") or flags.get("s") or flags.get("star") or ""
    desc_raw = flags.get("m") or flags.get("desc") or flags.get("note") or ""
    sub_raw = flags.get("sub") or ""
    subtasks = [s.strip() for s in sub_raw.split(",") if s.strip()] if sub_raw else []

    return {
        "title": title,
        "due_raw": due_raw,
        "priority_raw": prio_raw,
        "difficulty_raw": diff_raw,
        "description": desc_raw,
        "subtasks": subtasks
    }

def clean_bot_token(raw_token: Optional[str]) -> str:
    """Extract and sanitize a valid Telegram bot token from raw text or clipboard paste."""
    if not raw_token:
        return ""
    token_str = str(raw_token).strip()
    match = re.search(r"(\d{8,12}:[A-Za-z0-9_-]{25,50})", token_str)
    if match:
        return match.group(1)
    fallback = re.search(r"(\d+:[A-Za-z0-9_-]{20,})", token_str)
    if fallback:
        return fallback.group(1)
    return token_str.strip()

def format_telegram_error(e: Exception) -> str:
    """Format exceptions into concise, human-readable Vietnamese error descriptions."""
    if isinstance(e, urllib.error.HTTPError):
        if e.code == 401:
            return "Bot Token không hợp lệ hoặc đã bị thu hồi (401 Unauthorized)."
        if e.code == 404:
            return "Không tìm thấy Bot trên Telegram (404 Not Found). Vui lòng kiểm tra lại Token từ @BotFather."
        err_body = e.read().decode("utf-8") if e.fp else ""
        try:
            err_json = json.loads(err_body)
            desc = err_json.get("description", "")
            if desc:
                return f"Telegram: {desc}"
        except Exception:
            pass
        return f"Lỗi Telegram HTTP {e.code}"
    err_str = str(e)
    if "control characters" in err_str or "URL" in err_str:
        return "Bot Token chứa khoảng trắng hoặc ký tự không hợp lệ."
    if "timed out" in err_str.lower() or "timeout" in err_str.lower():
        return "Hết thời gian kết nối tới Telegram API (Timeout)."
    if "getaddrinfo failed" in err_str or "name resolution" in err_str.lower():
        return "Không thể kết nối Internet tới Telegram API (Lỗi mạng)."
    return "Không thể kết nối tới máy chủ Telegram."

class TelegramService:
    @staticmethod
    def send_telegram_message(bot_token: str, chat_id: str, text: str, parse_mode: str = "HTML") -> Dict[str, Any]:
        """Send message to Telegram chat using Bot API via standard urllib."""
        token = clean_bot_token(bot_token)
        cid = str(chat_id).strip() if chat_id else ""
        if not token or not cid:
            return {"ok": False, "error": "Bot token và Chat ID không được để trống"}

        url = f"https://api.telegram.org/bot{token}/sendMessage"
        payload = {
            "chat_id": cid,
            "text": text,
            "parse_mode": parse_mode,
            "disable_web_page_preview": True,
        }

        try:
            data = json.dumps(payload).encode("utf-8")
            req = urllib.request.Request(
                url,
                data=data,
                headers={"Content-Type": "application/json", "User-Agent": "LifeOS-Telegram-Bot/1.0"}
            )
            with urllib.request.urlopen(req, timeout=10) as response:
                result = json.loads(response.read().decode("utf-8"))
                return {"ok": True, "result": result}
        except Exception as e:
            return {"ok": False, "error": format_telegram_error(e)}

    @staticmethod
    def get_bot_info(bot_token: str) -> Dict[str, Any]:
        """Get information about the Telegram bot using getMe endpoint."""
        token = clean_bot_token(bot_token)
        if not token:
            return {"ok": False, "error": "Bot token không được để trống"}

        if token in _CACHED_BOT_INFO:
            return {"ok": True, "bot": _CACHED_BOT_INFO[token]}

        url = f"https://api.telegram.org/bot{token}/getMe"
        try:
            req = urllib.request.Request(
                url,
                headers={"User-Agent": "LifeOS-Telegram-Bot/1.0"}
            )
            with urllib.request.urlopen(req, timeout=8) as response:
                result = json.loads(response.read().decode("utf-8"))
                if result.get("ok"):
                    bot_data = result.get("result", {})
                    info = {
                        "id": bot_data.get("id"),
                        "is_bot": bot_data.get("is_bot", True),
                        "first_name": bot_data.get("first_name", ""),
                        "username": bot_data.get("username", ""),
                        "can_join_groups": bot_data.get("can_join_groups", True),
                    }
                    _CACHED_BOT_INFO[token] = info
                    return {"ok": True, "bot": info}
                return {"ok": False, "error": result.get("description", "Không thể lấy thông tin Bot")}
        except Exception as e:
            return {"ok": False, "error": format_telegram_error(e)}

    @staticmethod
    def detect_latest_chat_id(bot_token: str) -> Dict[str, Any]:
        """
        Detect latest chat ID from recent messages sent to the bot using getUpdates endpoint.
        Allows users to automatically retrieve their chat/user ID by simply starting or messaging the bot.
        """
        token = clean_bot_token(bot_token)
        if not token:
            return {"ok": False, "error": "Bot token không được để trống"}

        url = f"https://api.telegram.org/bot{token}/getUpdates?limit=20&offset=-20"
        try:
            req = urllib.request.Request(
                url,
                headers={"User-Agent": "LifeOS-Telegram-Bot/1.0"}
            )
            with urllib.request.urlopen(req, timeout=10) as response:
                result = json.loads(response.read().decode("utf-8"))
                if not result.get("ok"):
                    return {"ok": False, "error": result.get("description", "Không thể lấy danh sách tin nhắn")}

                updates = result.get("result", [])
                if not updates:
                    return {
                        "ok": False,
                        "waiting": True,
                        "error": (
                            "Chưa tìm thấy tin nhắn nào gửi tới Bot. "
                            "Hãy mở Telegram, bấm Start hoặc gửi 1 tin nhắn bất kỳ cho Bot rồi thử lại!"
                        )
                    }

                # Reverse iterate to find the most recent user interaction
                for update in reversed(updates):
                    msg = update.get("message") or update.get("my_chat_member") or update.get("callback_query", {}).get("message")
                    if not msg:
                        continue

                    chat = msg.get("chat", {})
                    from_user = msg.get("from", {})
                    chat_id = chat.get("id") or from_user.get("id")
                    if chat_id:
                        first_name = chat.get("first_name") or from_user.get("first_name", "")
                        last_name = chat.get("last_name") or from_user.get("last_name", "")
                        username = chat.get("username") or from_user.get("username", "")
                        full_name = f"{first_name} {last_name}".strip() or first_name or "Người dùng Telegram"
                        msg_text = msg.get("text", "")
                        
                        return {
                            "ok": True,
                            "chat_id": str(chat_id),
                            "first_name": full_name,
                            "username": username,
                            "chat_type": chat.get("type", "private"),
                            "latest_message": msg_text,
                        }

                return {
                    "ok": False,
                    "waiting": True,
                    "error": "Chưa tìm thấy tin nhắn hợp lệ từ người dùng. Hãy nhắn 1 tin nhắn cho Bot rồi bấm lại nút này."
                }
        except Exception as e:
            return {"ok": False, "error": format_telegram_error(e)}

    @classmethod
    def get_config(cls, db: Session) -> Dict[str, Any]:
        """Get Telegram configuration settings from AppSetting table."""
        keys = [
            "telegram_bot_token",
            "telegram_chat_id",
            "telegram_enabled",
            "telegram_reminder_minutes",
            "telegram_check_interval",
            "telegram_morning_briefing_enabled",
            "telegram_morning_briefing_time",
            "telegram_last_morning_briefing_date",
            "telegram_include_philosophy",
            "telegram_notify_schedules",
            "telegram_notify_tasks",
        ]
        settings_map: Dict[str, str] = {}
        for s in db.query(AppSetting).filter(AppSetting.key.in_(keys)).all():
            settings_map[s.key] = s.value

        raw_token = clean_bot_token(settings_map.get("telegram_bot_token", ""))
        # Mask token for security when returning
        masked_token = ""
        if raw_token and len(raw_token) > 10:
            parts = raw_token.split(":")
            if len(parts) == 2:
                masked_token = f"{parts[0]}:{parts[1][:4]}...{parts[1][-4:]}"
            else:
                masked_token = f"{raw_token[:6]}...{raw_token[-4:]}"
        elif raw_token:
            masked_token = "***"

        # Try to resolve bot info if token exists
        bot_username = ""
        bot_first_name = ""
        if raw_token:
            if raw_token not in _CACHED_BOT_INFO:
                cls.get_bot_info(raw_token)
            if raw_token in _CACHED_BOT_INFO:
                bot_username = _CACHED_BOT_INFO[raw_token].get("username", "")
                bot_first_name = _CACHED_BOT_INFO[raw_token].get("first_name", "")

        return {
            "has_token": bool(raw_token),
            "masked_token": masked_token,
            "chat_id": settings_map.get("telegram_chat_id", ""),
            "is_enabled": settings_map.get("telegram_enabled", "false") == "true",
            "reminder_minutes": int(settings_map.get("telegram_reminder_minutes", "15")),
            "check_interval": int(settings_map.get("telegram_check_interval", "60")),
            "morning_briefing_enabled": settings_map.get("telegram_morning_briefing_enabled", "true") == "true",
            "morning_briefing_time": settings_map.get("telegram_morning_briefing_time", "05:00"),
            "last_morning_briefing_date": settings_map.get("telegram_last_morning_briefing_date", ""),
            "include_philosophy": settings_map.get("telegram_include_philosophy", "true") == "true",
            "notify_schedules": settings_map.get("telegram_notify_schedules", "true") == "true",
            "notify_tasks": settings_map.get("telegram_notify_tasks", "true") == "true",
            "bot_username": bot_username,
            "bot_first_name": bot_first_name,
        }

    @classmethod
    def save_config(
        cls,
        db: Session,
        bot_token: Optional[str] = None,
        chat_id: Optional[str] = None,
        is_enabled: Optional[bool] = None,
        reminder_minutes: Optional[int] = None,
        check_interval: Optional[int] = None,
        morning_briefing_enabled: Optional[bool] = None,
        morning_briefing_time: Optional[str] = None,
        include_philosophy: Optional[bool] = None,
        notify_schedules: Optional[bool] = None,
        notify_tasks: Optional[bool] = None,
    ) -> Dict[str, Any]:
        """Save Telegram configuration settings."""
        def set_val(k: str, v: str):
            item = db.query(AppSetting).filter(AppSetting.key == k).first()
            if not item:
                item = AppSetting(key=k, value=v)
                db.add(item)
            else:
                item.value = v

        if bot_token is not None and bot_token.strip():
            cleaned_token = bot_token.strip()
            set_val("telegram_bot_token", cleaned_token)
            # Invalidate cached bot info if token changes
            _CACHED_BOT_INFO.pop(cleaned_token, None)
            # Pre-fetch bot info to have username ready
            cls.get_bot_info(cleaned_token)

        if chat_id is not None:
            set_val("telegram_chat_id", chat_id.strip())
        if is_enabled is not None:
            set_val("telegram_enabled", "true" if is_enabled else "false")
        if reminder_minutes is not None:
            set_val("telegram_reminder_minutes", str(reminder_minutes))
        if check_interval is not None:
            set_val("telegram_check_interval", str(max(15, check_interval)))
        if morning_briefing_enabled is not None:
            set_val("telegram_morning_briefing_enabled", "true" if morning_briefing_enabled else "false")
        if morning_briefing_time is not None:
            # Validate format HH:MM
            time_val = morning_briefing_time.strip()
            if len(time_val) == 5 and ":" in time_val:
                set_val("telegram_morning_briefing_time", time_val)
        if include_philosophy is not None:
            set_val("telegram_include_philosophy", "true" if include_philosophy else "false")
        if notify_schedules is not None:
            set_val("telegram_notify_schedules", "true" if notify_schedules else "false")
        if notify_tasks is not None:
            set_val("telegram_notify_tasks", "true" if notify_tasks else "false")

        db.commit()
        return cls.get_config(db)

    @classmethod
    def clear_config(cls, db: Session) -> Dict[str, Any]:
        """Clear Telegram bot token and chat ID, disabling bot."""
        keys = ["telegram_bot_token", "telegram_chat_id", "telegram_enabled", "telegram_last_morning_briefing_date"]
        for k in keys:
            item = db.query(AppSetting).filter(AppSetting.key == k).first()
            if item:
                item.value = "" if k != "telegram_enabled" else "false"
        _CACHED_BOT_INFO.clear()
        _SENT_REMINDERS_CACHE.clear()
        db.commit()
        return cls.get_config(db)

    @classmethod
    def test_connection(cls, db: Session, bot_token: Optional[str] = None, chat_id: Optional[str] = None) -> Dict[str, Any]:
        """Send a test message to verify the bot can deliver to the user."""
        token_to_use = bot_token
        chat_to_use = chat_id

        if not token_to_use or not chat_to_use:
            token_setting = db.query(AppSetting).filter(AppSetting.key == "telegram_bot_token").first()
            chat_setting = db.query(AppSetting).filter(AppSetting.key == "telegram_chat_id").first()
            token_to_use = token_to_use or (token_setting.value if token_setting else None)
            chat_to_use = chat_to_use or (chat_setting.value if chat_setting else None)

        if not token_to_use or not chat_to_use:
            return {"ok": False, "error": "Vui lòng nhập Bot Token và Chat ID trước khi kiểm tra"}

        now_str = datetime.now().strftime("%H:%M:%S • %d/%m/%Y")
        text = (
            "<b>LifeOS • Kết nối Telegram thành công</b>\n\n"
            f"⏱ <i>Thời gian:</i> <code>{now_str}</code>\n"
            "✓ Đã kích hoạt nhận thông báo lịch trình & nhiệm vụ."
        )
        return cls.send_telegram_message(token_to_use, chat_to_use, text)

    @classmethod
    def send_morning_briefing(cls, db: Session, force: bool = False) -> Dict[str, Any]:
        """
        Send a concise morning briefing of today's schedule, timetable, and tasks.
        Includes Stoic philosophical quote if enabled. Minimal text, no AI fluff.
        """
        token_setting = db.query(AppSetting).filter(AppSetting.key == "telegram_bot_token").first()
        chat_setting = db.query(AppSetting).filter(AppSetting.key == "telegram_chat_id").first()
        philo_setting = db.query(AppSetting).filter(AppSetting.key == "telegram_include_philosophy").first()

        if not token_setting or not token_setting.value or not chat_setting or not chat_setting.value:
            return {"ok": False, "error": "Chưa cấu hình Bot Token hoặc Chat ID Telegram"}

        bot_token = clean_bot_token(token_setting.value)
        chat_id = chat_setting.value.strip()
        include_philosophy = (philo_setting.value == "true") if philo_setting else True

        now = datetime.now()
        today = now.date()
        date_display = today.strftime("%d/%m/%Y")
        dow_names = ["Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy", "Chủ Nhật"]
        dow_name = dow_names[today.weekday()]

        # 1. Fixed Schedules & Timetable today
        occurrences = ScheduleService.get_occurrences_for_date(db, today)
        occurrences.sort(key=lambda o: o.start_time)

        # 2. Tasks for today
        today_start = datetime.combine(today, datetime.min.time())
        today_end = datetime.combine(today, datetime.max.time())
        tasks_today = db.query(Task).filter(
            ((Task.due_datetime >= today_start) & (Task.due_datetime <= today_end)) |
            ((Task.start_datetime >= today_start) & (Task.start_datetime <= today_end)) |
            (Task.status == "IN_PROGRESS")
        ).all()

        # Priority order
        priority_weights = {"URGENT": 4, "HIGH": 3, "MEDIUM": 2, "LOW": 1}
        tasks_today.sort(key=lambda t: priority_weights.get(t.priority or "MEDIUM", 2), reverse=True)

        lines = [
            f"🌅 <b>LIFEOS • {date_display} ({dow_name})</b>",
            "",
            f"📅 <b>LỊCH CỐ ĐỊNH ({len(occurrences)}):</b>",
        ]

        if not occurrences:
            lines.append("<i>Không có lịch cố định hôm nay.</i>")
        else:
            for idx, occ in enumerate(occurrences, start=1):
                icon = occ.icon or "📌"
                loc = f" (📍 {occ.location})" if occ.location else ""
                lines.append(f"{idx}. {icon} <b>{occ.title}</b>: <code>{occ.start_time} - {occ.end_time}</code>{loc}")

        lines.append("")
        lines.append(f"🎯 <b>NHIỆM VỤ ({len(tasks_today)}):</b>")
        if not tasks_today:
            lines.append("<i>Chưa có nhiệm vụ hôm nay.</i>")
        else:
            for idx, t in enumerate(tasks_today[:12], start=1):
                status_icon = "✓" if t.status == "COMPLETED" else ("⚡" if t.status == "IN_PROGRESS" else "•")
                due_str = f" [Hạn {t.due_datetime.strftime('%H:%M')}]" if t.due_datetime else ""
                lines.append(f"{idx}. {status_icon} <b>{t.title}</b>{due_str}")
            if len(tasks_today) > 12:
                lines.append(f"<i>(+{len(tasks_today) - 12} nhiệm vụ khác)</i>")

        # 3. Minimal Philosophy quote
        if include_philosophy:
            try:
                from app.api.routes.quotes import PHILOSOPHICAL_QUOTES
                if PHILOSOPHICAL_QUOTES:
                    quote_idx = (today.year * 365 + today.month * 31 + today.day) % len(PHILOSOPHICAL_QUOTES)
                    quote_item = PHILOSOPHICAL_QUOTES[quote_idx]
                    lines.append("")
                    lines.append("💡 <b>TRIẾT LÝ:</b>")
                    lines.append(f"« <i>{quote_item['quote']}</i> » — {quote_item['author']}")
            except Exception as e:
                pass

        full_text = "\n".join(lines)
        res = cls.send_telegram_message(bot_token, chat_id, full_text)
        
        if res.get("ok"):
            # Update last morning briefing date
            setting_date = db.query(AppSetting).filter(AppSetting.key == "telegram_last_morning_briefing_date").first()
            if not setting_date:
                db.add(AppSetting(key="telegram_last_morning_briefing_date", value=today.isoformat()))
            else:
                setting_date.value = today.isoformat()
            db.commit()

        return res

    @classmethod
    def check_and_send_reminders(cls, db: Session) -> List[str]:
        """
        Periodic check:
        1. Sends Morning Briefing if current time matches/passed morning_briefing_time and not yet sent today.
        2. Checks fixed schedules within reminder window if notify_schedules is True.
        3. Checks upcoming tasks within reminder window if notify_tasks is True.
        """
        token_setting = db.query(AppSetting).filter(AppSetting.key == "telegram_bot_token").first()
        chat_setting = db.query(AppSetting).filter(AppSetting.key == "telegram_chat_id").first()
        enabled_setting = db.query(AppSetting).filter(AppSetting.key == "telegram_enabled").first()
        mins_setting = db.query(AppSetting).filter(AppSetting.key == "telegram_reminder_minutes").first()
        briefing_en_setting = db.query(AppSetting).filter(AppSetting.key == "telegram_morning_briefing_enabled").first()
        briefing_time_setting = db.query(AppSetting).filter(AppSetting.key == "telegram_morning_briefing_time").first()
        last_briefing_date_setting = db.query(AppSetting).filter(AppSetting.key == "telegram_last_morning_briefing_date").first()
        notify_sched_setting = db.query(AppSetting).filter(AppSetting.key == "telegram_notify_schedules").first()
        notify_task_setting = db.query(AppSetting).filter(AppSetting.key == "telegram_notify_tasks").first()

        if not enabled_setting or enabled_setting.value != "true":
            return []
        if not token_setting or not token_setting.value or not chat_setting or not chat_setting.value:
            return []

        bot_token = clean_bot_token(token_setting.value)
        chat_id = chat_setting.value.strip()
        reminder_minutes = int(mins_setting.value) if mins_setting and mins_setting.value.isdigit() else 15
        morning_briefing_enabled = briefing_en_setting.value != "false" if briefing_en_setting else True
        morning_briefing_time = briefing_time_setting.value if briefing_time_setting else "05:00"
        last_briefing_date = last_briefing_date_setting.value if last_briefing_date_setting else ""
        notify_schedules = notify_sched_setting.value != "false" if notify_sched_setting else True
        notify_tasks = notify_task_setting.value != "false" if notify_task_setting else True

        now = datetime.now()
        today = now.date()
        sent_messages: List[str] = []

        # -------------------------------------------------------------
        # 1. Check Morning Briefing (e.g., at 05:00 AM)
        # -------------------------------------------------------------
        if morning_briefing_enabled and last_briefing_date != today.isoformat():
            try:
                b_hour, b_minute = map(int, morning_briefing_time.split(":"))
                scheduled_briefing_dt = datetime.combine(today, datetime.min.time()).replace(
                    hour=b_hour, minute=b_minute
                )
                diff_sec = (now - scheduled_briefing_dt).total_seconds()
                if 0 <= diff_sec <= 3 * 3600:
                    res = cls.send_morning_briefing(db)
                    if res.get("ok"):
                        sent_messages.append(f"MorningBriefing: {today.isoformat()} at {morning_briefing_time}")
            except Exception as e:
                print(f"[TelegramService] Error checking morning briefing: {e}")

        # -------------------------------------------------------------
        # 2. Check Fixed Schedules for today
        # -------------------------------------------------------------
        if notify_schedules:
            try:
                occurrences = ScheduleService.get_occurrences_for_date(db, today)
                for occ in occurrences:
                    try:
                        start_hour, start_minute = map(int, occ.start_time.split(":"))
                        event_dt = datetime.combine(today, datetime.min.time()).replace(
                            hour=start_hour, minute=start_minute
                        )
                        diff_seconds = (event_dt - now).total_seconds()
                        diff_minutes = diff_seconds / 60

                        if -2 <= diff_minutes <= reminder_minutes:
                            cache_key = f"sched_{occ.fixed_schedule_id}_{today.isoformat()}_{occ.start_time}"
                            if cache_key not in _SENT_REMINDERS_CACHE:
                                minutes_text = (
                                    "ngay bây giờ" if diff_minutes <= 1
                                    else f"sau {int(diff_minutes)} phút"
                                )
                                location_part = f"\n📍 {occ.location}" if occ.location else ""

                                msg = (
                                    f"⏰ <b>LỊCH SẮP DIỄN RA</b>\n\n"
                                    f"📌 <b>{occ.title}</b>\n"
                                    f"⏱ <code>{occ.start_time} - {occ.end_time}</code> (Bắt đầu {minutes_text})"
                                    f"{location_part}"
                                )
                                res = cls.send_telegram_message(bot_token, chat_id, msg)
                                if res.get("ok"):
                                    _SENT_REMINDERS_CACHE.add(cache_key)
                                    sent_messages.append(f"FixedSchedule: {occ.title} ({occ.start_time})")
                    except Exception as e:
                        print(f"[TelegramService] Error checking schedule {occ}: {e}")
            except Exception as e:
                print(f"[TelegramService] Error fetching occurrences: {e}")

        # -------------------------------------------------------------
        # 3. Check Tasks scheduled for today with start_datetime or due_datetime
        # -------------------------------------------------------------
        if notify_tasks:
            try:
                today_start = datetime.combine(today, datetime.min.time())
                today_end = datetime.combine(today, datetime.max.time())
                
                # Check tasks starting today
                tasks_starting = db.query(Task).filter(
                    Task.status.in_(["TODO", "IN_PROGRESS"]),
                    Task.start_datetime >= today_start,
                    Task.start_datetime <= today_end
                ).all()

                for t in tasks_starting:
                    if not t.start_datetime:
                        continue
                    diff_seconds = (t.start_datetime - now).total_seconds()
                    diff_minutes = diff_seconds / 60
                    if -2 <= diff_minutes <= reminder_minutes:
                        cache_key = f"task_start_{t.id}_{today.isoformat()}_{t.start_datetime.strftime('%H%M')}"
                        if cache_key not in _SENT_REMINDERS_CACHE:
                            minutes_text = (
                                "ngay bây giờ" if diff_minutes <= 1
                                else f"sau {int(diff_minutes)} phút"
                            )
                            time_str = t.start_datetime.strftime("%H:%M")

                            msg = (
                                f"🎯 <b>NHIỆM VỤ ĐẾN GIỜ</b>\n\n"
                                f"📝 <b>{t.title}</b>\n"
                                f"⏱ Bắt đầu: <code>{time_str}</code> ({minutes_text})"
                            )
                            res = cls.send_telegram_message(bot_token, chat_id, msg)
                            if res.get("ok"):
                                _SENT_REMINDERS_CACHE.add(cache_key)
                                sent_messages.append(f"TaskStart: {t.title} ({time_str})")

                # Check tasks due soon today
                tasks_due = db.query(Task).filter(
                    Task.status.in_(["TODO", "IN_PROGRESS"]),
                    Task.due_datetime >= today_start,
                    Task.due_datetime <= today_end
                ).all()

                for t in tasks_due:
                    if not t.due_datetime:
                        continue
                    diff_seconds = (t.due_datetime - now).total_seconds()
                    diff_minutes = diff_seconds / 60
                    if 0 <= diff_minutes <= reminder_minutes:
                        cache_key = f"task_due_{t.id}_{today.isoformat()}_{t.due_datetime.strftime('%H%M')}"
                        if cache_key not in _SENT_REMINDERS_CACHE:
                            due_time_str = t.due_datetime.strftime("%H:%M")
                            msg = (
                                f"⏳ <b>HẠN CHÓT SẮP HẾT</b>\n\n"
                                f"📝 <b>{t.title}</b>\n"
                                f"⏰ Hạn chót: <code>{due_time_str}</code> (Còn {int(diff_minutes)} phút)"
                            )
                            res = cls.send_telegram_message(bot_token, chat_id, msg)
                            if res.get("ok"):
                                _SENT_REMINDERS_CACHE.add(cache_key)
                                sent_messages.append(f"TaskDue: {t.title} ({due_time_str})")
            except Exception as e:
                print(f"[TelegramService] Error checking tasks: {e}")

        return sent_messages

    # -------------------------------------------------------------
    # INTERACTIVE TELEGRAM BOT COMMAND HANDLERS
    # -------------------------------------------------------------
    @classmethod
    def handle_dashboard(cls, db: Session, bot_token: str, chat_id: str) -> Dict[str, Any]:
        """
        Handle /dashboard or /stats:
        Displays current streak, best streak, task statistics, effort points and discipline score.
        """
        try:
            from app.services.analytics_service import AnalyticsService
            stats = AnalyticsService.get_dashboard_stats(db)

            streak = stats.current_streak
            best_streak = stats.best_streak
            active_today = stats.streak_active_today
            today_streak_icon = "🔥" if active_today else "⏳"
            today_streak_text = "Đã duy trì phong độ hôm nay!" if active_today else "Hôm nay chưa hoàn thành nhiệm vụ nào."

            consistency_score = 10.0
            tier_label = "Kỷ luật thép"
            try:
                cons_info = AnalyticsService.calculate_consistency_index(db, days_window=14)
                consistency_score = cons_info.get("score", 10.0)
                tier_label = cons_info.get("tier_label", "Kỷ luật tốt")
            except Exception:
                pass

            today = datetime.now().date()
            week_start = today - timedelta(days=today.weekday())

            all_tasks = db.query(Task).all()
            today_tasks = [
                t for t in all_tasks
                if (t.due_datetime and t.due_datetime.date() == today) or
                   (t.completed_datetime and t.completed_datetime.date() == today)
            ]
            today_completed = sum(1 for t in today_tasks if t.status == "COMPLETED")
            today_total = len(today_tasks)

            week_tasks = [
                t for t in all_tasks
                if (t.due_datetime and t.due_datetime.date() >= week_start) or
                   (t.completed_datetime and t.completed_datetime.date() >= week_start)
            ]
            week_completed = sum(1 for t in week_tasks if t.status == "COMPLETED")
            week_total = len(week_tasks)

            rate_today = stats.completion_rate_today
            rate_week = stats.completion_rate_this_week
            effort_points = stats.total_difficulty_points

            msg = (
                "📊 <b>LIFEOS • BẢNG ĐIỀU KHIỂN & HIỆU SUẤT</b>\n"
                "───────────────────────────\n"
                "🔥 <b>CHUỖI PHONG ĐỘ (STREAK):</b>\n"
                f"• Chuỗi hiện tại: <b>{streak} ngày liên tiếp</b> 🔥\n"
                f"• Kỷ lục cao nhất: <b>{best_streak} ngày</b> 🏆\n"
                f"• Trạng thái hôm nay: {today_streak_icon} <i>{today_streak_text}</i>\n\n"
                "🎯 <b>TIẾN ĐỘ NHIỆM VỤ:</b>\n"
                f"• Hôm nay: <b>{today_completed}/{today_total}</b> ({rate_today}%)\n"
                f"• Tuần này: <b>{week_completed}/{week_total}</b> ({rate_week}%)\n"
                f"• Đang làm / Chờ: <b>{stats.tasks_incomplete}</b>\n"
                f"• Quá hạn tồn đọng: <b>{stats.tasks_delayed}</b>\n"
                f"• Đã hoàn thành tổng: <b>{stats.tasks_completed}</b>\n\n"
                "⚡ <b>ĐIỂM NỖ LỰC & KỶ LUẬT:</b>\n"
                f"• Điểm nỗ lực tích lũy: <b>{effort_points} ⭐</b> (XP độ khó)\n"
                f"• Chỉ số nhất quán: <b>{consistency_score}/10</b> (<i>{tier_label}</i>)\n"
                "───────────────────────────\n"
                "💡 <i>Gõ <code>/viewtask d</code> xem việc hôm nay hoặc <code>/addtask</code> để thêm việc mới!</i>"
            )
            return cls.send_telegram_message(bot_token, chat_id, msg)
        except Exception as e:
            err_msg = f"❌ Không thể tải Dashboard: {html.escape(str(e))}"
            return cls.send_telegram_message(bot_token, chat_id, err_msg)

    @classmethod
    def handle_addtask(cls, db: Session, bot_token: str, chat_id: str, args_text: str) -> Dict[str, Any]:
        """
        Handle /addtask:
        Adds a new task supporting rich parameters (due deadline, priority, difficulty, note, subtasks).
        """
        clean_args = args_text.strip()
        if not clean_args:
            guide_msg = (
                "➕ <b>HƯỚNG DẪN THÊM NHIỆM VỤ (/addtask)</b>\n"
                "───────────────────────────\n"
                "<b>Cách 1 (Dùng tham số linh hoạt):</b>\n"
                "<code>/addtask &lt;Tên&gt; -d &lt;Hạn&gt; -p &lt;Ưu tiên&gt; -diff &lt;Sao&gt; -m &lt;Ghi chú&gt;</code>\n\n"
                "<i>Ví dụ:</i>\n"
                "• <code>/addtask Ôn tập tiếng Anh -d mai 18:00 -p high -diff 3</code>\n"
                "• <code>/addtask Nộp bài tập Toán -d 20:00 -p urgent</code>\n"
                "• <code>/addtask Chạy bộ 5km -diff 3 -m Công viên Thống Nhất</code>\n\n"
                "<b>Cách 2 (Dùng dấu gạch đứng | ):</b>\n"
                "<code>/addtask Tên | Hạn chót | Ưu tiên | Sao | Ghi chú</code>\n"
                "<i>Ví dụ:</i> <code>/addtask Đi siêu thị | mai 15:00 | medium | 2</code>\n\n"
                "<b>Các tùy chọn hỗ trợ:</b>\n"
                "• <b>Hạn (-d):</b> <code>18:00</code>, <code>mai 20h</code>, <code>t2 08:00</code>, <code>29/09 15:00</code>, <code>+2h</code>\n"
                "• <b>Ưu tiên (-p):</b> <code>urgent</code> (khẩn cấp), <code>high</code> (cao), <code>medium</code> (vừa), <code>low</code> (thấp)\n"
                "• <b>Nỗ lực (-diff):</b> từ <code>1</code> đến <code>5</code> sao (mặc định: 2)"
            )
            return cls.send_telegram_message(bot_token, chat_id, guide_msg)

        parsed = parse_addtask_args(clean_args)
        title = parsed.get("title", "").strip()
        if not title:
            return cls.send_telegram_message(
                bot_token,
                chat_id,
                "⚠️ Vui lòng nhập tiêu đề nhiệm vụ!\nVí dụ: <code>/addtask Ôn tập kiểm tra -d 18:00</code>"
            )

        due_raw = parsed.get("due_raw", "").strip()
        due_dt = parse_datetime_flexible(due_raw) if due_raw else None

        prio_raw = parsed.get("priority_raw", "").strip().lower()
        priority = "MEDIUM"
        if prio_raw in ["urgent", "u", "kc", "khancap", "khẩn cấp", "4"]:
            priority = "URGENT"
        elif prio_raw in ["high", "h", "cao", "3"]:
            priority = "HIGH"
        elif prio_raw in ["medium", "m", "vua", "vừa", "trungbinh", "2"]:
            priority = "MEDIUM"
        elif prio_raw in ["low", "l", "thap", "thấp", "1"]:
            priority = "LOW"

        prio_labels = {
            "URGENT": "🔴 URGENT (Khẩn cấp)",
            "HIGH": "🟠 HIGH (Cao)",
            "MEDIUM": "🟡 MEDIUM (Vừa)",
            "LOW": "🟢 LOW (Thấp)"
        }

        diff_raw = parsed.get("difficulty_raw", "").strip()
        difficulty = 2
        if diff_raw.isdigit():
            difficulty = max(1, min(5, int(diff_raw)))
        elif diff_raw.lower() in ["de", "dễ", "easy", "1"]:
            difficulty = 1
        elif diff_raw.lower() in ["kho", "khó", "hard", "3"]:
            difficulty = 3
        elif diff_raw.lower() in ["rat kho", "rất khó", "4"]:
            difficulty = 4
        elif diff_raw.lower() in ["cuc kho", "cực khó", "extreme", "5"]:
            difficulty = 5

        desc = parsed.get("description", "").strip() or None
        subtasks = parsed.get("subtasks", [])

        try:
            from app.services.task_service import TaskService
            from app.schemas.task import TaskCreate

            task_in = TaskCreate(
                title=title,
                description=desc,
                due_datetime=due_dt,
                priority=priority,
                difficulty=difficulty,
                subtask_titles=subtasks if subtasks else None,
                status="TODO"
            )
            created = TaskService.create_task(db, task_in)

            due_text = created.due_datetime.strftime("%H:%M ngày %d/%m/%Y") if created.due_datetime else "<i>Không đặt hạn</i>"
            stars_str = "⭐" * difficulty
            desc_line = f"\n📝 <b>Ghi chú:</b> {html.escape(desc)}" if desc else ""
            sub_line = f"\n📌 <b>Việc con ({len(subtasks)}):</b> {', '.join(html.escape(s) for s in subtasks)}" if subtasks else ""

            reply = (
                "✅ <b>ĐÃ TẠO NHIỆM VỤ THÀNH CÔNG!</b>\n"
                "───────────────────────────\n"
                f"🎯 <b>Tiêu đề:</b> <b>{html.escape(created.title)}</b>\n"
                f"⏰ <b>Hạn chót:</b> <code>{due_text}</code>\n"
                f"🔥 <b>Ưu tiên:</b> {prio_labels.get(created.priority, created.priority)}\n"
                f"⭐ <b>Điểm nỗ lực:</b> {stars_str} ({difficulty}/5)"
                f"{desc_line}"
                f"{sub_line}\n"
                "───────────────────────────\n"
                f"🆔 <b>Mã ID:</b> <code>#{created.id}</code>\n"
                f"👉 <i>Khi hoàn thành, gửi:</i> <code>/done {created.id}</code>"
            )
            return cls.send_telegram_message(bot_token, chat_id, reply)
        except Exception as e:
            err_msg = f"❌ Không thể tạo nhiệm vụ: {html.escape(str(e))}"
            return cls.send_telegram_message(bot_token, chat_id, err_msg)

    @classmethod
    def handle_viewtask(cls, db: Session, bot_token: str, chat_id: str, args_text: str) -> Dict[str, Any]:
        """
        Handle /viewtask:
        Supports /viewtask day (or d) and /viewtask week (or w). Default is day.
        """
        clean_arg = args_text.strip().lower()
        is_week_view = clean_arg in ["week", "w", "tuan", "tuần", "tuannay", "tuần này"]

        today = datetime.now().date()
        prio_icons = {"URGENT": "🔴", "HIGH": "🟠", "MEDIUM": "🟡", "LOW": "🟢"}

        if is_week_view:
            mon = today - timedelta(days=today.weekday())
            sun = mon + timedelta(days=6)
            week_start = datetime(mon.year, mon.month, mon.day, 0, 0, 0)
            week_end = datetime(sun.year, sun.month, sun.day, 23, 59, 59)

            all_tasks = db.query(Task).all()
            week_tasks = [
                t for t in all_tasks
                if (t.due_datetime and mon <= t.due_datetime.date() <= sun) or
                   (t.completed_datetime and mon <= t.completed_datetime.date() <= sun) or
                   (t.status == "IN_PROGRESS") or
                   (t.due_datetime is None and mon <= t.created_at.date() <= sun and t.status in ["TODO", "IN_PROGRESS"])
            ]

            if not week_tasks:
                empty_msg = (
                    f"🗓️ <b>NHIỆM VỤ TUẦN NÀY ({mon.strftime('%d/%m')} - {sun.strftime('%d/%m')})</b>\n\n"
                    "<i>Tuần này chưa có nhiệm vụ nào được lên lịch!</i>\n\n"
                    "👉 Dùng <code>/addtask &lt;tên&gt; -d mai 18:00</code> để thêm nhiệm vụ mới."
                )
                return cls.send_telegram_message(bot_token, chat_id, empty_msg)

            completed_tasks = [t for t in week_tasks if t.status == "COMPLETED"]
            pending_tasks = [t for t in week_tasks if t.status in ["TODO", "IN_PROGRESS", "PARTIAL", "DELAYED"]]

            prio_order = {"URGENT": 4, "HIGH": 3, "MEDIUM": 2, "LOW": 1}
            pending_tasks.sort(key=lambda t: (t.due_datetime or datetime.max, -prio_order.get(t.priority or "MEDIUM", 2)))

            lines = [
                "🗓️ <b>KẾ HOẠCH NHIỆM VỤ TUẦN NÀY</b>",
                f"📅 <i>{mon.strftime('%d/%m')} đến {sun.strftime('%d/%m/%Y')}</i>",
                f"📊 Tiến độ: <b>{len(completed_tasks)}/{len(week_tasks)}</b> hoàn thành",
                "───────────────────────────"
            ]

            if pending_tasks:
                lines.append(f"⏳ <b>CẦN LÀM / ĐANG THỰC HIỆN ({len(pending_tasks)}):</b>")
                for idx, t in enumerate(pending_tasks[:15], start=1):
                    icon = prio_icons.get(t.priority or "MEDIUM", "🟡")
                    if t.due_datetime:
                        dow = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"][t.due_datetime.weekday()]
                        due_info = f" • Hạn {dow} {t.due_datetime.strftime('%H:%M')}"
                    else:
                        due_info = ""
                    lines.append(f"{idx}. [{icon}] <b>{html.escape(t.title)}</b>{due_info} • <code>/done {t.id}</code>")
                if len(pending_tasks) > 15:
                    lines.append(f"<i>(+{len(pending_tasks) - 15} nhiệm vụ khác)</i>")
                lines.append("")

            if completed_tasks:
                lines.append(f"✅ <b>ĐÃ HOÀN THÀNH TUẦN NÀY ({len(completed_tasks)}):</b>")
                for t in completed_tasks[:8]:
                    lines.append(f"✓ <s>{html.escape(t.title)}</s>")
                if len(completed_tasks) > 8:
                    lines.append(f"<i>(+{len(completed_tasks) - 8} việc đã hoàn thành khác)</i>")
                lines.append("")

            lines.append("───────────────────────────")
            lines.append("💡 <i>Gõ <code>/viewtask d</code> để xem chi tiết hôm nay!</i>")

            return cls.send_telegram_message(bot_token, chat_id, "\n".join(lines))

        else:
            # Day view (Today)
            now = datetime.now()
            dow_names = ["Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy", "Chủ Nhật"]
            dow_str = dow_names[today.weekday()]

            all_tasks = db.query(Task).all()

            pending_today = [
                t for t in all_tasks
                if t.status in ["TODO", "IN_PROGRESS", "PARTIAL"] and
                   ((t.due_datetime and t.due_datetime.date() == today) or
                    (t.start_datetime and t.start_datetime.date() == today) or
                    (t.status == "IN_PROGRESS"))
            ]
            prio_order = {"URGENT": 4, "HIGH": 3, "MEDIUM": 2, "LOW": 1}
            pending_today.sort(key=lambda t: (t.due_datetime or datetime.max, -prio_order.get(t.priority or "MEDIUM", 2)))

            overdue_tasks = [
                t for t in all_tasks
                if t.status in ["TODO", "IN_PROGRESS", "DELAYED"] and
                   t.due_datetime and t.due_datetime.date() < today
            ]

            completed_today = [
                t for t in all_tasks
                if t.status == "COMPLETED" and
                   t.completed_datetime and t.completed_datetime.date() == today
            ]

            lines = [
                f"📅 <b>NHIỆM VỤ HÔM NAY • {today.strftime('%d/%m/%Y')} ({dow_str})</b>",
                "───────────────────────────"
            ]

            if not pending_today and not completed_today and not overdue_tasks:
                lines.append("<i>Hôm nay bạn chưa có nhiệm vụ nào. Thảnh thơi hoặc gõ <code>/addtask &lt;tên&gt;</code> để thêm mới!</i>")
            else:
                if pending_today:
                    lines.append(f"⏳ <b>CẦN THỰC HIỆN ({len(pending_today)}):</b>")
                    for idx, t in enumerate(pending_today, start=1):
                        icon = prio_icons.get(t.priority or "MEDIUM", "🟡")
                        due_str = f" • Hạn <code>{t.due_datetime.strftime('%H:%M')}</code>" if t.due_datetime else ""
                        stars = "⭐" * (t.difficulty or 2)
                        lines.append(f"{idx}. [{icon}] <b>{html.escape(t.title)}</b>{due_str} ({stars})")
                        lines.append(f"   👉 <i>Xong:</i> <code>/done {t.id}</code>")
                    lines.append("")

                if overdue_tasks:
                    lines.append(f"⚠️ <b>QUÁ HẠN TỒN ĐỌNG ({len(overdue_tasks)}):</b>")
                    for t in overdue_tasks[:5]:
                        due_date_str = t.due_datetime.strftime("%d/%m") if t.due_datetime else ""
                        lines.append(f"• <b>{html.escape(t.title)}</b> (Hạn {due_date_str}) • <code>/done {t.id}</code>")
                    if len(overdue_tasks) > 5:
                        lines.append(f"<i>(+{len(overdue_tasks) - 5} nhiệm vụ tồn đọng khác)</i>")
                    lines.append("")

                if completed_today:
                    lines.append(f"✅ <b>ĐÃ HOÀN THÀNH HÔM NAY ({len(completed_today)}):</b>")
                    for t in completed_today:
                        time_done = t.completed_datetime.strftime("%H:%M") if t.completed_datetime else ""
                        time_part = f" lúc {time_done}" if time_done else ""
                        lines.append(f"✓ <s>{html.escape(t.title)}</s>{time_part}")
                    lines.append("")

            lines.append("───────────────────────────")
            lines.append("💡 <i>Gõ <code>/viewtask w</code> để xem cả tuần hoặc <code>/dashboard</code> xem chuỗi phong độ!</i>")

            return cls.send_telegram_message(bot_token, chat_id, "\n".join(lines))

    @classmethod
    def handle_done(cls, db: Session, bot_token: str, chat_id: str, args_text: str) -> Dict[str, Any]:
        """
        Handle /done or /complete:
        Marks task as COMPLETED by ID and updates streak/effort points.
        """
        clean_id = args_text.strip().lstrip("#")
        if not clean_id.isdigit():
            return cls.send_telegram_message(
                bot_token,
                chat_id,
                "⚠️ Vui lòng cung cấp mã ID nhiệm vụ cần hoàn thành.\nVí dụ: <code>/done 12</code> (Xem ID bằng lệnh <code>/viewtask</code>)"
            )

        task_id = int(clean_id)
        task = db.query(Task).filter(Task.id == task_id).first()
        if not task:
            return cls.send_telegram_message(bot_token, chat_id, f"❌ Không tìm thấy nhiệm vụ nào có ID <code>#{task_id}</code>.")

        if task.status == "COMPLETED":
            return cls.send_telegram_message(
                bot_token,
                chat_id,
                f"ℹ️ Nhiệm vụ <b>#{task_id} - {html.escape(task.title)}</b> đã được hoàn thành trước đó rồi!"
            )

        try:
            from app.services.task_service import TaskService
            from app.schemas.task import TaskUpdate
            from app.services.analytics_service import AnalyticsService

            TaskService.update_task(db, task_id, TaskUpdate(status="COMPLETED"))
            stats = AnalyticsService.get_dashboard_stats(db)

            reply = (
                "🎉 <b>XUẤT SẮC! ĐÃ HOÀN THÀNH NHIỆM VỤ</b>\n"
                "───────────────────────────\n"
                f"✓ <s><b>{html.escape(task.title)}</b></s>\n"
                f"⭐ <b>+{task.difficulty} Điểm nỗ lực</b>\n"
                f"🔥 <b>Chuỗi hiện tại:</b> <b>{stats.current_streak} ngày liên tiếp!</b>\n"
                "───────────────────────────\n"
                "💪 <i>Tuyệt vời! Tiếp tục giữ vững phong độ nhé!</i>"
            )
            return cls.send_telegram_message(bot_token, chat_id, reply)
        except Exception as e:
            return cls.send_telegram_message(bot_token, chat_id, f"❌ Lỗi khi cập nhật nhiệm vụ: {html.escape(str(e))}")

    @classmethod
    def handle_help(cls, bot_token: str, chat_id: str, user_name: str = "") -> Dict[str, Any]:
        """Handle /help or /start command with complete guide."""
        greeting = f"Xin chào <b>{html.escape(user_name)}</b>! " if user_name else ""
        help_text = (
            f"🤖 <b>ROUTIFY LIFEOS • TRỢ LÝ TELEGRAM</b>\n"
            "───────────────────────────\n"
            f"{greeting}Dưới đây là các lệnh bạn có thể sử dụng bất cứ lúc nào:\n\n"
            "📊 <b>/dashboard</b> (hoặc <b>/stats</b>)\n"
            "Xem chuỗi ngày liên tiếp (Streak), số nhiệm vụ và điểm nỗ lực tích lũy.\n\n"
            "📋 <b>/viewtask [day|week]</b> (hoặc <b>/viewtask d|w</b>)\n"
            "• <code>/viewtask d</code> : Xem nhiệm vụ cần làm hôm nay.\n"
            "• <code>/viewtask w</code> : Xem kế hoạch nhiệm vụ cả tuần.\n\n"
            "➕ <b>/addtask &lt;tên&gt; [tham số...]</b>\n"
            "Thêm nhiệm vụ mới linh hoạt từ xa:\n"
            "• <code>-d &lt;hạn&gt;</code> : <code>18:00</code>, <code>mai 20:00</code>, <code>t2 08:00</code>, <code>+2h</code>\n"
            "• <code>-p &lt;mức&gt;</code> : <code>urgent</code>, <code>high</code>, <code>medium</code>, <code>low</code>\n"
            "• <code>-diff &lt;1-5&gt;</code> : Điểm nỗ lực / độ khó (sao từ 1 đến 5)\n"
            "• <code>-m &lt;ghi chú&gt;</code> : Ghi chú cho nhiệm vụ\n"
            "<i>Ví dụ:</i> <code>/addtask Ôn tập tiếng Anh -d mai 18:00 -p high -diff 3</code>\n"
            "<i>Hoặc gạch đứng:</i> <code>/addtask Chạy bộ | 17h30 | high | 3</code>\n\n"
            "✓ <b>/done &lt;id&gt;</b>\n"
            "Đánh dấu hoàn thành nhiệm vụ theo mã ID (Ví dụ: <code>/done 12</code>).\n\n"
            "🌅 <b>/briefing</b>\n"
            "Gửi ngay bản tin tóm tắt lịch trình & nhiệm vụ hôm nay.\n"
            "───────────────────────────\n"
            "💡 <i>Mẹo: Mọi thay đổi qua bot đều đồng bộ ngay lập tức vào LifeOS trên máy tính của bạn!</i>"
        )
        return cls.send_telegram_message(bot_token, chat_id, help_text)

    @classmethod
    def handle_incoming_message(
        cls,
        db: Session,
        bot_token: str,
        chat_id: str,
        text: str,
        user_name: str = ""
    ) -> None:
        """Parse incoming message, authenticate chat ID and route to appropriate command handler."""
        if not text:
            return

        text = text.strip()
        if not text.startswith("/"):
            return

        parts = text.split(maxsplit=1)
        raw_cmd = parts[0]
        args_text = parts[1].strip() if len(parts) > 1 else ""
        norm_cmd = normalize_command_name(raw_cmd)

        # Security & Auto-bind Check
        chat_setting = db.query(AppSetting).filter(AppSetting.key == "telegram_chat_id").first()
        configured_chat_id = chat_setting.value.strip() if chat_setting and chat_setting.value else ""

        if not configured_chat_id:
            # Auto-bind first incoming chat_id
            if not chat_setting:
                db.add(AppSetting(key="telegram_chat_id", value=chat_id))
            else:
                chat_setting.value = chat_id
            db.commit()
            configured_chat_id = chat_id
            cls.send_telegram_message(
                bot_token,
                chat_id,
                f"🎉 <b>LIÊN KẾT LIFEOS THÀNH CÔNG!</b>\n\n"
                f"Xin chào <b>{html.escape(user_name or 'bạn')}</b>! Chat ID của bạn (<code>{chat_id}</code>) đã được tự động kết nối với LifeOS.\n\n"
                f"Gõ <b>/help</b> để xem các tính năng quản lý nhiệm vụ & lịch trình."
            )
            if norm_cmd in ["/start", "/help"]:
                return

        elif str(configured_chat_id) != str(chat_id):
            # Unauthorized chat
            cls.send_telegram_message(
                bot_token,
                chat_id,
                f"⛔ <b>TRUY CẬP BỊ TỪ CHỐI</b>\n\n"
                f"LifeOS Bot này hiện đang được bảo vệ và chỉ phục vụ tài khoản chủ nhân đã liên kết.\n"
                f"Chat ID của bạn: <code>{chat_id}</code>\n"
                f"Vui lòng cập nhật Chat ID này trong cài đặt LifeOS nếu đây là bạn."
            )
            return

        # Route commands
        if norm_cmd in ["/dashboard", "/stats", "/db"]:
            cls.handle_dashboard(db, bot_token, chat_id)
        elif norm_cmd in ["/addtask", "/newtask", "/add"]:
            cls.handle_addtask(db, bot_token, chat_id, args_text)
        elif norm_cmd in ["/viewtask", "/tasks", "/task"]:
            cls.handle_viewtask(db, bot_token, chat_id, args_text)
        elif norm_cmd in ["/done", "/complete", "/xong"]:
            cls.handle_done(db, bot_token, chat_id, args_text)
        elif norm_cmd in ["/briefing", "/today", "/morning"]:
            cls.send_morning_briefing(db, force=True)
        elif norm_cmd in ["/help", "/start"]:
            cls.handle_help(bot_token, chat_id, user_name)
        else:
            cls.send_telegram_message(
                bot_token,
                chat_id,
                f"❓ Lệnh <code>{html.escape(raw_cmd)}</code> chưa được hỗ trợ.\nGõ <b>/help</b> để xem danh sách các lệnh khả dụng."
            )

    @classmethod
    def poll_and_handle_updates(cls, db: Session) -> int:
        """
        Poll Telegram getUpdates API for incoming commands and handle them.
        Uses long-polling timeout=3 to be responsive while staying lightweight.
        """
        token_setting = db.query(AppSetting).filter(AppSetting.key == "telegram_bot_token").first()
        enabled_setting = db.query(AppSetting).filter(AppSetting.key == "telegram_enabled").first()

        if not enabled_setting or enabled_setting.value != "true":
            return 0
        if not token_setting or not token_setting.value:
            return 0

        bot_token = clean_bot_token(token_setting.value)
        if not bot_token:
            return 0

        offset_setting = db.query(AppSetting).filter(AppSetting.key == "telegram_last_update_id").first()
        offset = int(offset_setting.value) + 1 if offset_setting and offset_setting.value and offset_setting.value.isdigit() else 0

        url = f"https://api.telegram.org/bot{bot_token}/getUpdates?timeout=3&limit=20"
        if offset > 0:
            url += f"&offset={offset}"

        try:
            req = urllib.request.Request(url, headers={"User-Agent": "LifeOS-Telegram-Bot/1.0"})
            with urllib.request.urlopen(req, timeout=10) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                if not data.get("ok"):
                    return 0

                updates = data.get("result", [])
                if not updates:
                    return 0

                max_id = offset - 1
                now_ts = datetime.now().timestamp()

                for upd in updates:
                    upd_id = upd.get("update_id", 0)
                    if upd_id > max_id:
                        max_id = upd_id

                    msg = upd.get("message") or upd.get("edited_message")
                    if not msg:
                        continue

                    # If this is the very first run (offset == 0) and message is older than 5 minutes, skip execution
                    msg_date = msg.get("date", 0)
                    if offset == 0 and (now_ts - msg_date) > 300:
                        continue

                    chat_id = str(msg.get("chat", {}).get("id", ""))
                    text = msg.get("text", "")
                    from_user = msg.get("from", {})
                    first_name = from_user.get("first_name", "")

                    if chat_id and text:
                        cls.handle_incoming_message(db, bot_token, chat_id, text, user_name=first_name)

                # Persist max_id so updates are acknowledged
                if max_id >= offset:
                    if not offset_setting:
                        offset_setting = AppSetting(key="telegram_last_update_id", value=str(max_id))
                        db.add(offset_setting)
                    else:
                        offset_setting.value = str(max_id)
                    db.commit()

                return len(updates)
        except Exception:
            return 0

    # Backward compatibility alias
    send_daily_briefing = send_morning_briefing
