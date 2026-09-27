import os
import shutil
import zipfile
import subprocess
import httpx
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session

from app.core.config import BASE_DIR, BACKUPS_DIR, settings
from app.models.sync import AppSetting, SyncHistory
from app.services.gdrive_service import create_local_safety_backup, log_sync_event

# Root directory of the application partition (c:\Users\Huu Quy\Pictures\lifeos)
APP_ROOT_DIR = BASE_DIR.parent

CURRENT_APP_VERSION = "27.9.6"
CURRENT_COMMIT_HASH = "c64b8ba"
RELEASE_DATE = "2026-09-27"

CHANGELOG_HISTORY = [
    {
        "version": "27.9.6",
        "date": "27/09/2026",
        "commit_hash": "c64b8ba",
        "title": "Bản Phát Hành v27.9.6 (Commit c64b8ba)",
        "is_latest": True,
        "highlights": [
            {
                "category": "Cập nhật từ GitHub",
                "icon": "🐙",
                "content": "Tích hợp đồng bộ mã nguồn 1-click trực tiếp từ GitHub repository (hquy09/routify-ts:main). Lưu mốc đối chiếu commit c64b8ba để tự động phát hiện mọi bản cập nhật mới tiếp theo."
            },
            {
                "category": "Hiệu suất cá nhân 2 cột",
                "icon": "📊",
                "content": "Tái cấu trúc bố cục 2 cột chuyên nghiệp: Cột trái thu gọn tất cả trạng thái hoàn thành, điểm nỗ lực XP, chuỗi ngày streak và chậm trễ; Cột phải mở rộng canvas cho biểu đồ cột và bản đồ nhiệt Heatmap."
            },
            {
                "category": "Sidebar tinh giản",
                "icon": "⚡",
                "content": "Di chuyển nút 'Đánh giá tuần' và 'Toàn màn hình' sang Sidebar bên trái với chế độ thu gọn/mở rộng trực quan, tích hợp huy hiệu phiên bản v27.9.6."
            },
            {
                "category": "Auto Update an toàn tuyệt đối",
                "icon": "🛡️",
                "content": "Hệ thống tự động tạo snapshot sao lưu trước khi cập nhật. Tuyệt đối không bao giờ ghi đè tệp cơ sở dữ liệu SQLite lifeos.db."
            }
        ]
    },
    {
        "version": "1.1.0",
        "date": "25/09/2026",
        "title": "Đại Tu Modal Tạo Nhiệm Vụ Cho Học Sinh & Sinh Viên",
        "is_latest": False,
        "highlights": [
            {
                "category": "Logic thời lượng 2 chiều",
                "icon": "⏱️",
                "content": "Cộng nhanh thời lượng thông minh: Tự động tính Giờ bắt đầu = Hạn chót - Thời lượng khi bắt đầu đang để trống."
            },
            {
                "category": "Preset khung giờ",
                "icon": "🌅",
                "content": "Khung giờ học tập chuẩn (Sáng, Chiều, Tối, Đêm) kèm tô đậm trạng thái đang chọn và hiển thị chuẩn 24 giờ."
            },
            {
                "category": "Thẻ xem trước Live Preview",
                "icon": "📋",
                "content": "Thẻ xem trước thực tế ghim dính ở cột phải với đếm ngược hạn chót và thanh tiến độ việc con."
            },
            {
                "category": "Danh sách việc con",
                "icon": "✅",
                "content": "Checklist tương tác hoàn chỉnh: tick checkbox, nút di chuyển Lên/Xuống và xóa việc con."
            }
        ]
    },
    {
        "version": "1.0.0",
        "date": "23/09/2026",
        "title": "Khởi Chạy Routify & Tích Hợp TKB THPT Ngô Gia Tự",
        "is_latest": False,
        "highlights": [
            {
                "category": "TKB Trường Học",
                "icon": "🏫",
                "content": "Tự động giải mã AES-256 dữ liệu TKB 37 lớp trường THPT số 1 Ngô Gia Tự Đắk Lắk, 1-click điền bảng ma trận."
            },
            {
                "category": "Lịch cố định",
                "icon": "📌",
                "content": "Hệ thống lịch định kỳ tuần, phân loại môn học và tự động liên kết nhiệm vụ."
            },
            {
                "category": "Sao lưu & Khôi phục",
                "icon": "💾",
                "content": "Tích hợp Google Drive và sao lưu khẩn cấp SQLite bảo vệ toàn vẹn dữ liệu."
            }
        ]
    }
]

class UpdateService:
    @classmethod
    def get_info(cls, db: Session) -> Dict[str, Any]:
        """Returns application version, partition path, and changelog history."""
        setting = db.query(AppSetting).filter(AppSetting.key == "app_version").first()
        setting = db.query(AppSetting).filter(AppSetting.key == "app_version").first()
        current_version = setting.value if setting and setting.value else CURRENT_APP_VERSION

        setting_hash = db.query(AppSetting).filter(AppSetting.key == "app_commit_hash").first()
        current_commit = setting_hash.value if setting_hash and setting_hash.value else CURRENT_COMMIT_HASH

        return {
            "app_name": "Routify LifeOS",
            "current_version": current_version,
            "current_commit": current_commit,
            "latest_version": CURRENT_APP_VERSION,
            "latest_commit": CURRENT_COMMIT_HASH,
            "release_date": RELEASE_DATE,
            "app_root_dir": str(APP_ROOT_DIR),
            "storage_dir": str(BACKUPS_DIR.parent),
            "update_channel": "stable",
            "is_up_to_date": current_version == CURRENT_APP_VERSION,
            "changelog": CHANGELOG_HISTORY
        }

    @classmethod
    def apply_update_package(cls, db: Session, zip_path: Path) -> Dict[str, Any]:
        """
        Extracts an uploaded update zip package and automatically pastes/overwrites files
        into the app partition directory (APP_ROOT_DIR).
        Takes an automatic safety backup before applying.
        """
        if not zip_path.exists() or not zipfile.is_zipfile(zip_path):
            raise ValueError("Tệp cập nhật không hợp lệ hoặc không phải định dạng .zip.")

        # 1. Create safety backup snapshot
        safety_backup = create_local_safety_backup(prefix="pre_update")

        updated_files: List[str] = []
        skipped_files: List[str] = []

        try:
            with zipfile.ZipFile(zip_path, "r") as archive:
                for member in archive.infolist():
                    # Security check: skip absolute paths or directory traversal attempts
                    clean_name = member.filename.replace("\\", "/")
                    if clean_name.startswith("/") or clean_name.startswith("\\") or ".." in clean_name.split("/"):
                        skipped_files.append(clean_name)
                        continue

                    # Skip database file to avoid wiping user data
                    if clean_name.endswith("lifeos.db") or clean_name.endswith(".sqlite"):
                        skipped_files.append(clean_name)
                        continue

                    # If directory entry, ensure it exists
                    target_file = APP_ROOT_DIR / clean_name
                    if member.is_dir():
                        target_file.mkdir(parents=True, exist_ok=True)
                        continue

                    # Ensure parent directory exists
                    target_file.parent.mkdir(parents=True, exist_ok=True)

                    # Extract/paste file
                    with archive.open(member) as source, open(target_file, "wb") as target:
                        shutil.copyfileobj(source, target)

                    updated_files.append(clean_name)

            # 2. Update version setting
            setting = db.query(AppSetting).filter(AppSetting.key == "app_version").first()
            if not setting:
                db.add(AppSetting(key="app_version", value=CURRENT_APP_VERSION))
            else:
                setting.value = CURRENT_APP_VERSION
            db.commit()

            # 3. Log event
            log_sync_event(
                db,
                sync_type="UPDATE",
                status="COMPLETED",
                details=f"Đã tự động cập nhật {len(updated_files)} tệp vào phân vùng ứng dụng {APP_ROOT_DIR}. Bản sao lưu: {safety_backup.name}"
            )

            return {
                "status": "success",
                "message": f"Cập nhật thành công! Đã tự động dán {len(updated_files)} tệp vào phân vùng ứng dụng.",
                "updated_files_count": len(updated_files),
                "updated_files": updated_files[:50],  # first 50 files for report
                "skipped_files_count": len(skipped_files),
                "safety_backup": safety_backup.name,
                "current_version": CURRENT_APP_VERSION,
                "target_directory": str(APP_ROOT_DIR)
            }
        except Exception as e:
            db.rollback()
            raise RuntimeError(f"Lỗi khi giải nén và dán tệp cập nhật: {str(e)}")

    @classmethod
    def paste_files_to_partition(cls, db: Session, source_file: Path, relative_dest_path: str) -> Dict[str, Any]:
        """Copies an individual file or folder directly into the app partition."""
        clean_rel = relative_dest_path.strip().replace("\\", "/").lstrip("/")
        if ".." in clean_rel.split("/"):
            raise ValueError("Đường dẫn đích không hợp lệ.")

        target_path = APP_ROOT_DIR / clean_rel
        target_path.parent.mkdir(parents=True, exist_ok=True)

        shutil.copy2(source_file, target_path)

        log_sync_event(
            db,
            sync_type="FILE_PASTE",
            status="COMPLETED",
            details=f"Đã dán tệp vào phân vùng app: {clean_rel}"
        )

        return {
            "status": "success",
            "message": f"Đã dán tệp thành công vào {clean_rel}",
            "destination": str(target_path)
        }

    @classmethod
    def get_local_git_info(cls, db: Optional[Session] = None) -> Dict[str, Any]:
        """Returns local git repository status, current commit, branch, and uncommitted status."""
        git_dir = APP_ROOT_DIR / ".git"

        # Baseline stored version and hash
        stored_hash = CURRENT_COMMIT_HASH
        stored_version = CURRENT_APP_VERSION
        if db:
            setting_hash = db.query(AppSetting).filter(AppSetting.key == "app_commit_hash").first()
            if setting_hash and setting_hash.value:
                stored_hash = setting_hash.value.strip()
            setting_ver = db.query(AppSetting).filter(AppSetting.key == "app_version").first()
            if setting_ver and setting_ver.value:
                stored_version = setting_ver.value.strip()

        if not git_dir.exists():
            return {
                "is_git_repo": False,
                "repo": "hquy09/routify-ts",
                "branch": "main",
                "version": stored_version,
                "sha": stored_hash,
                "short_sha": stored_hash[:7],
                "author": "Huu Quy(cookie)",
                "date": RELEASE_DATE,
                "message": f"Routify LifeOS v{stored_version} ({stored_hash[:7]})",
                "has_uncommitted": False,
                "uncommitted_files_count": 0
            }

        try:
            p_log = subprocess.run(
                ["git", "log", "-1", "--format=%H|%h|%an|%cd|%s"],
                cwd=str(APP_ROOT_DIR),
                capture_output=True,
                text=True,
                encoding="utf-8",
                errors="replace",
                timeout=5
            )
            sha, short_sha, author, date, message = "", "", "", "", ""
            if p_log.returncode == 0 and p_log.stdout.strip():
                parts = p_log.stdout.strip().split("|", 4)
                sha = parts[0]
                short_sha = parts[1] if len(parts) > 1 else sha[:7]
                author = parts[2] if len(parts) > 2 else ""
                date = parts[3] if len(parts) > 3 else ""
                message = parts[4] if len(parts) > 4 else ""

            # Use the established version baseline commit hash requested by user
            if stored_hash:
                sha = stored_hash
                short_sha = stored_hash[:7]

            p_branch = subprocess.run(
                ["git", "rev-parse", "--abbrev-ref", "HEAD"],
                cwd=str(APP_ROOT_DIR),
                capture_output=True,
                text=True,
                timeout=5
            )
            branch = p_branch.stdout.strip() if p_branch.returncode == 0 else "main"

            p_remote = subprocess.run(
                ["git", "config", "--get", "remote.origin.url"],
                cwd=str(APP_ROOT_DIR),
                capture_output=True,
                text=True,
                timeout=5
            )
            remote_url = p_remote.stdout.strip() if p_remote.returncode == 0 else ""
            repo = "hquy09/routify-ts"
            if remote_url:
                clean = remote_url.replace(".git", "")
                if "github.com/" in clean:
                    repo = clean.split("github.com/")[1]
                elif "github.com:" in clean:
                    repo = clean.split("github.com:")[1]

            p_status = subprocess.run(
                ["git", "status", "--porcelain"],
                cwd=str(APP_ROOT_DIR),
                capture_output=True,
                text=True,
                timeout=5
            )
            has_uncommitted = bool(p_status.stdout.strip())
            uncommitted_files = len(p_status.stdout.strip().splitlines()) if has_uncommitted else 0

            return {
                "is_git_repo": True,
                "version": stored_version,
                "sha": sha,
                "short_sha": short_sha,
                "author": author or "Huu Quy(cookie)",
                "date": date or RELEASE_DATE,
                "message": message or f"Bản phát hành v{stored_version} ({short_sha})",
                "branch": branch,
                "remote_url": remote_url,
                "repo": repo,
                "has_uncommitted": has_uncommitted,
                "uncommitted_files_count": uncommitted_files
            }
        except Exception as e:
            return {
                "is_git_repo": True,
                "repo": "hquy09/routify-ts",
                "branch": "main",
                "version": stored_version,
                "sha": stored_hash,
                "short_sha": stored_hash[:7],
                "error": str(e)
            }

    @classmethod
    def get_github_config(cls, db: Session) -> Dict[str, Any]:
        """Returns GitHub updater configuration stored in AppSetting."""
        git_info = cls.get_local_git_info(db)
        default_repo = git_info.get("repo") or "hquy09/routify-ts"
        default_branch = git_info.get("branch") or "main"

        setting_repo = db.query(AppSetting).filter(AppSetting.key == "github_repo").first()
        setting_branch = db.query(AppSetting).filter(AppSetting.key == "github_branch").first()
        setting_token = db.query(AppSetting).filter(AppSetting.key == "github_token").first()
        setting_mode = db.query(AppSetting).filter(AppSetting.key == "github_update_mode").first()

        return {
            "repo": setting_repo.value if setting_repo and setting_repo.value else default_repo,
            "branch": setting_branch.value if setting_branch and setting_branch.value else default_branch,
            "has_token": bool(setting_token and setting_token.value),
            "token": setting_token.value if setting_token and setting_token.value else "",
            "mode": setting_mode.value if setting_mode and setting_mode.value else "auto",
            "git_info": git_info
        }

    @classmethod
    def save_github_config(cls, db: Session, config: Dict[str, Any]) -> Dict[str, Any]:
        """Saves GitHub updater configuration to AppSetting."""
        for key in ["github_repo", "github_branch", "github_token", "github_update_mode"]:
            val_key = key.replace("github_", "") if key != "github_update_mode" else "mode"
            val = config.get(val_key)
            if val is not None:
                setting = db.query(AppSetting).filter(AppSetting.key == key).first()
                if not setting:
                    db.add(AppSetting(key=key, value=str(val)))
                else:
                    setting.value = str(val)
        db.commit()
        return cls.get_github_config(db)

    @classmethod
    def check_github_updates(
        cls,
        db: Session,
        repo: Optional[str] = None,
        branch: Optional[str] = None,
        token: Optional[str] = None
    ) -> Dict[str, Any]:
        """Checks for new commits and releases on the target GitHub repository."""
        config = cls.get_github_config(db)
        target_repo = repo or config.get("repo") or "hquy09/routify-ts"
        target_branch = branch or config.get("branch") or "main"
        auth_token = token if token is not None else config.get("token") or None

        local_info = cls.get_local_git_info(db)
        local_sha = local_info.get("sha", "")
        local_short_sha = local_info.get("short_sha", "")

        headers = {
            "User-Agent": "Routify-LifeOS-Updater",
            "Accept": "application/vnd.github.v3+json",
        }
        if auth_token:
            headers["Authorization"] = f"Bearer {auth_token}"

        api_url = f"https://api.github.com/repos/{target_repo}/commits?sha={target_branch}&per_page=5"

        try:
            with httpx.Client(timeout=10.0) as client:
                res = client.get(api_url, headers=headers)

                if res.status_code == 404:
                    return {
                        "status": "error",
                        "error": f"Không tìm thấy kho mã nguồn '{target_repo}' hoặc nhánh '{target_branch}' trên GitHub.",
                        "repo": target_repo,
                        "branch": target_branch,
                        "local_info": local_info
                    }
                elif res.status_code == 403:
                    return {
                        "status": "rate_limited",
                        "error": "Đã chạm giới hạn yêu cầu ẩn danh của GitHub (60 lượt/giờ). Vui lòng thêm GitHub Token vào phần Cấu hình để tiếp tục.",
                        "repo": target_repo,
                        "branch": target_branch,
                        "local_info": local_info
                    }
                elif res.status_code != 200:
                    return {
                        "status": "error",
                        "error": f"GitHub API trả về mã lỗi {res.status_code}: {res.text}",
                        "repo": target_repo,
                        "branch": target_branch,
                        "local_info": local_info
                    }

                commits_data = res.json()
                if not isinstance(commits_data, list) or len(commits_data) == 0:
                    return {
                        "status": "empty",
                        "message": "Không tìm thấy commit nào trên nhánh chỉ định.",
                        "repo": target_repo,
                        "branch": target_branch,
                        "local_info": local_info
                    }

                latest_remote = commits_data[0]
                remote_sha = latest_remote.get("sha", "")
                remote_short_sha = remote_sha[:7] if remote_sha else ""
                commit_info = latest_remote.get("commit", {})
                author_info = commit_info.get("author", {})

                # Check if there are updates
                has_update = False
                if local_sha and remote_sha:
                    has_update = (local_sha != remote_sha) and (local_short_sha != remote_short_sha)

                # Format recent commits for UI preview
                recent_commits = []
                for c in commits_data:
                    c_commit = c.get("commit", {})
                    c_author = c_commit.get("author", {})
                    recent_commits.append({
                        "sha": c.get("sha", ""),
                        "short_sha": c.get("sha", "")[:7],
                        "message": c_commit.get("message", "").splitlines()[0] if c_commit.get("message") else "",
                        "full_message": c_commit.get("message", ""),
                        "author": c_author.get("name", "Unknown"),
                        "date": c_author.get("date", ""),
                        "url": c.get("html_url", "")
                    })

                # Also try fetching latest release if available
                latest_release = None
                try:
                    rel_res = client.get(f"https://api.github.com/repos/{target_repo}/releases/latest", headers=headers)
                    if rel_res.status_code == 200:
                        rel_data = rel_res.json()
                        latest_release = {
                            "tag_name": rel_data.get("tag_name"),
                            "name": rel_data.get("name"),
                            "published_at": rel_data.get("published_at"),
                            "body": rel_data.get("body", ""),
                            "html_url": rel_data.get("html_url")
                        }
                except Exception:
                    pass

                return {
                    "status": "success",
                    "has_update": has_update,
                    "repo": target_repo,
                    "branch": target_branch,
                    "local_info": local_info,
                    "remote_commit": {
                        "sha": remote_sha,
                        "short_sha": remote_short_sha,
                        "message": commit_info.get("message", "").splitlines()[0] if commit_info.get("message") else "",
                        "author": author_info.get("name", "Unknown"),
                        "date": author_info.get("date", ""),
                        "url": latest_remote.get("html_url", "")
                    },
                    "recent_commits": recent_commits,
                    "latest_release": latest_release
                }

        except httpx.RequestError as e:
            return {
                "status": "network_error",
                "error": f"Không thể kết nối đến GitHub: {str(e)}",
                "repo": target_repo,
                "branch": target_branch,
                "local_info": local_info
            }

    @classmethod
    def apply_github_update(
        cls,
        db: Session,
        mode: str = "auto",
        repo: Optional[str] = None,
        branch: Optional[str] = None,
        token: Optional[str] = None,
        force_overwrite: bool = False
    ) -> Dict[str, Any]:
        """
        Executes update from GitHub:
        1. Always creates an emergency safety backup snapshot.
        2. Applies update via git pull (if repo exists and mode allows) or by downloading archive zip.
        3. Never overwrites lifeos.db or sqlite files.
        4. Logs the sync event and returns summary.
        """
        config = cls.get_github_config(db)
        target_repo = repo or config.get("repo") or "hquy09/routify-ts"
        target_branch = branch or config.get("branch") or "main"
        auth_token = token if token is not None else config.get("token") or None
        target_mode = mode or config.get("mode") or "auto"

        # 1. Create safety backup snapshot
        safety_backup = create_local_safety_backup(prefix="pre_github_update")

        git_dir = APP_ROOT_DIR / ".git"
        can_use_git = git_dir.exists() and (target_mode in ("auto", "git_pull"))
        applied_mode = ""
        output_details = ""
        updated_files: List[str] = []

        if can_use_git and not force_overwrite:
            try:
                # If there are uncommitted local modifications, stash them safely
                p_status = subprocess.run(
                    ["git", "status", "--porcelain"],
                    cwd=str(APP_ROOT_DIR),
                    capture_output=True,
                    text=True,
                    timeout=5
                )
                if p_status.stdout.strip():
                    stash_msg = f"LifeOS safety stash before update {datetime.now().strftime('%Y%m%d_%H%M%S')}"
                    subprocess.run(
                        ["git", "stash", "push", "--include-untracked", "-m", stash_msg],
                        cwd=str(APP_ROOT_DIR),
                        capture_output=True,
                        text=True,
                        timeout=10
                    )

                # Fetch and pull
                subprocess.run(
                    ["git", "fetch", "origin", target_branch],
                    cwd=str(APP_ROOT_DIR),
                    capture_output=True,
                    text=True,
                    timeout=20
                )
                p_pull = subprocess.run(
                    ["git", "pull", "origin", target_branch],
                    cwd=str(APP_ROOT_DIR),
                    capture_output=True,
                    text=True,
                    encoding="utf-8",
                    errors="replace",
                    timeout=30
                )

                if p_pull.returncode == 0:
                    applied_mode = "git_pull"
                    output_details = p_pull.stdout.strip()
                else:
                    if target_mode == "git_pull":
                        raise RuntimeError(f"Git pull thất bại: {p_pull.stderr.strip() or p_pull.stdout.strip()}")
            except Exception as e:
                if target_mode == "git_pull":
                    raise
                # Fallback to download_zip
                pass

        # If git pull was not applied or fell back to download_zip
        if not applied_mode:
            applied_mode = "download_zip"
            zip_url = f"https://github.com/{target_repo}/archive/refs/heads/{target_branch}.zip"
            headers = {"User-Agent": "Routify-LifeOS-Updater"}
            if auth_token:
                headers["Authorization"] = f"Bearer {auth_token}"

            try:
                with httpx.Client(timeout=60.0, follow_redirects=True) as client:
                    res = client.get(zip_url, headers=headers)
                    if res.status_code != 200:
                        raise RuntimeError(f"Không thể tải mã nguồn từ GitHub (Mã lỗi {res.status_code})")

                    import io
                    archive = zipfile.ZipFile(io.BytesIO(res.content))
                    skipped_files: List[str] = []

                    for member in archive.infolist():
                        clean_name = member.filename.replace("\\", "/")
                        parts = clean_name.split("/", 1)
                        if len(parts) <= 1 or not parts[1]:
                            continue  # Root folder or empty

                        rel_path = parts[1]

                        # Skip security traversal
                        if rel_path.startswith("/") or ".." in rel_path.split("/"):
                            continue

                        # Crucial: Protect database, git repository, and backups
                        if (
                            rel_path.endswith("lifeos.db")
                            or rel_path.endswith(".sqlite")
                            or rel_path.endswith(".sqlite3")
                            or rel_path.startswith(".git")
                            or rel_path == ".env"
                            or rel_path.startswith("backend/storage/backups")
                        ):
                            skipped_files.append(rel_path)
                            continue

                        target_file = APP_ROOT_DIR / rel_path

                        if member.is_dir():
                            target_file.mkdir(parents=True, exist_ok=True)
                            continue

                        target_file.parent.mkdir(parents=True, exist_ok=True)

                        with archive.open(member) as source, open(target_file, "wb") as target:
                            shutil.copyfileobj(source, target)

                        updated_files.append(rel_path)

                    output_details = f"Đã tải và dán đè {len(updated_files)} tệp mã nguồn từ GitHub ({target_repo}:{target_branch})."

            except Exception as e:
                raise RuntimeError(f"Lỗi khi tải hoặc dán tệp từ GitHub: {str(e)}")

        # Update recorded commit hash in database after successful update
        new_commit = ""
        try:
            if applied_mode == "git_pull":
                p_head = subprocess.run(["git", "rev-parse", "HEAD"], cwd=str(APP_ROOT_DIR), capture_output=True, text=True, timeout=5)
                if p_head.returncode == 0 and p_head.stdout.strip():
                    new_commit = p_head.stdout.strip()[:7]
            else:
                # In download_zip, fetch latest commit sha of the branch from GitHub to update baseline
                try:
                    with httpx.Client(timeout=10.0) as client:
                        api_res = client.get(f"https://api.github.com/repos/{target_repo}/commits?sha={target_branch}&per_page=1", headers={"User-Agent": "Routify-LifeOS-Updater"})
                        if api_res.status_code == 200 and len(api_res.json()) > 0:
                            new_commit = api_res.json()[0]["sha"][:7]
                except Exception:
                    pass

            if new_commit:
                setting_hash = db.query(AppSetting).filter(AppSetting.key == "app_commit_hash").first()
                if not setting_hash:
                    db.add(AppSetting(key="app_commit_hash", value=new_commit))
                else:
                    setting_hash.value = new_commit
                db.commit()
        except Exception:
            pass

        # Log event
        log_sync_event(
            db,
            sync_type="GITHUB_UPDATE",
            status="COMPLETED",
            details=f"Cập nhật từ GitHub ({applied_mode}): {output_details[:200]}. Bản commit mới: {new_commit or 'giữ nguyên'}. Sao lưu: {safety_backup.name}"
        )

        return {
            "status": "success",
            "mode": applied_mode,
            "message": f"Cập nhật từ GitHub thành công bằng phương thức '{applied_mode}'!",
            "details": output_details,
            "updated_files_count": len(updated_files),
            "safety_backup": safety_backup.name,
            "repo": target_repo,
            "branch": target_branch,
            "new_commit": new_commit,
            "timestamp": datetime.now().isoformat()
        }

