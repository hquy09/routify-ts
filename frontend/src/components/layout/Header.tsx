import React, { useMemo, useState, useEffect } from 'react';
import {
  Search, Cloud, Flame, Shield, Clock, AlertCircle, CheckCircle2,
  HeartPulse, Activity, CheckSquare, CalendarClock, BookOpen, Send, Sparkles, Swords
} from 'lucide-react';
import { Badge } from '../ui/badge';
import { HeaderUpcomingItem, TensionSummary, ConsistencyInfo } from '../../types';
import { isMentalHealthEnabled, isDigitalWellbeingEnabled, setDigitalWellbeingEnabled, isRankOnTopbarEnabled } from '../../utils/featureFlags';
import {
  isCourseGamificationEnabled,
  getTopCourseMastery,
  CourseMasteryCalculation
} from '../../utils/courseGamification';
import { api } from '../../services/api';

interface HeaderProps {
  onOpenSearch: () => void;
  isDark?: boolean;
  onToggleTheme?: () => void;
  streakCount?: number;
  discipline?: ConsistencyInfo | null;
  consistency?: ConsistencyInfo | null;
  upcomingItem?: HeaderUpcomingItem | null;
  tension?: TensionSummary | null;
  telegram?: {
    is_connected: boolean;
    is_enabled: boolean;
    has_token: boolean;
  } | null;
  dbLastSaved?: string | null;
  onNavigateTab?: (tab: string) => void;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenSearch,
  streakCount = 0,
  discipline,
  consistency,
  upcomingItem,
  tension,
  telegram,
  dbLastSaved,
  onNavigateTab,
}) => {
  const [isMentalHealthOn, setIsMentalHealthOn] = useState<boolean>(() => isMentalHealthEnabled());
  const [isDigitalWellbeingOn, setIsDigitalWellbeingOn] = useState<boolean>(() => isDigitalWellbeingEnabled());
  const [isGamificationOn, setIsGamificationOn] = useState<boolean>(() => isCourseGamificationEnabled());
  const [isRankOnTopbar, setIsRankOnTopbar] = useState<boolean>(() => isRankOnTopbarEnabled());
  const [topMastery, setTopMastery] = useState<{
    topCourse: { id: number; title: string; mastery_points?: number; mastery_level?: number } | null;
    topPoints: number;
    masteryInfo: CourseMasteryCalculation;
    totalXP: number;
  } | null>(null);

  const fetchCourseRanks = async () => {
    try {
      const courses = await api.courses.list();
      const res = getTopCourseMastery(courses);
      setTopMastery(res);
    } catch (err) {
      console.error('Failed to fetch course ranks for header:', err);
    }
  };

  useEffect(() => {
    // Sync digital wellbeing status from API
    api.screentime.getStatus().then(res => {
      if (res && typeof res.enabled === 'boolean') {
        setIsDigitalWellbeingOn(res.enabled);
        setDigitalWellbeingEnabled(res.enabled);
      }
    }).catch(() => {});

    fetchCourseRanks();

    const handleMentalHealthUpdated = (e: any) => {
      setIsMentalHealthOn(e.detail?.enabled ?? isMentalHealthEnabled());
    };
    const handleDigitalWellbeingUpdated = (e: any) => {
      setIsDigitalWellbeingOn(e.detail?.enabled ?? isDigitalWellbeingEnabled());
    };
    const handleGamificationUpdated = (e: any) => {
      const enabled = e.detail?.enabled ?? isCourseGamificationEnabled();
      setIsGamificationOn(enabled);
      if (enabled) {
        fetchCourseRanks();
      }
    };
    const handleRankOnTopbarUpdated = (e: any) => {
      setIsRankOnTopbar(e.detail?.enabled ?? isRankOnTopbarEnabled());
    };
    const handleCoursesUpdated = () => {
      fetchCourseRanks();
    };

    window.addEventListener('lifeos_mental_health_updated', handleMentalHealthUpdated);
    window.addEventListener('lifeos_digital_wellbeing_updated', handleDigitalWellbeingUpdated);
    window.addEventListener('lifeos_gamification_updated', handleGamificationUpdated);
    window.addEventListener('lifeos_show_rank_on_topbar_updated', handleRankOnTopbarUpdated);
    window.addEventListener('lifeos_courses_updated', handleCoursesUpdated);
    window.addEventListener('lifeos_task_updated', handleCoursesUpdated);

    return () => {
      window.removeEventListener('lifeos_mental_health_updated', handleMentalHealthUpdated);
      window.removeEventListener('lifeos_digital_wellbeing_updated', handleDigitalWellbeingUpdated);
      window.removeEventListener('lifeos_gamification_updated', handleGamificationUpdated);
      window.removeEventListener('lifeos_show_rank_on_topbar_updated', handleRankOnTopbarUpdated);
      window.removeEventListener('lifeos_courses_updated', handleCoursesUpdated);
      window.removeEventListener('lifeos_task_updated', handleCoursesUpdated);
    };
  }, []);

  // 1. Consistency / Nhất quán calculation
  const consistencyData = consistency || discipline;
  const score = consistencyData?.score ?? 10.0;
  const metrics = consistencyData?.metrics;

  let consistencyColorClass = 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300';
  if (score < 5.5) {
    consistencyColorClass = 'bg-rose-50 dark:bg-rose-950/50 border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300';
  } else if (score < 7.5) {
    consistencyColorClass = 'bg-amber-50 dark:bg-amber-950/50 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300';
  } else if (score < 9.0) {
    consistencyColorClass = 'bg-blue-50 dark:bg-blue-950/50 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300';
  }

  // 2. Cognitive Load / Tải nhận thức badge calculation (Formal name)
  const tensionLevel = tension?.tension_level ?? 'BALANCED';
  let tensionColorClass = 'bg-sky-50 dark:bg-sky-950/60 border-sky-200 dark:border-sky-800 text-sky-700 dark:text-sky-300';
  let isTensionHigh = false;

  if (tensionLevel === 'LOW') {
    tensionColorClass = 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300';
  } else if (tensionLevel === 'STRAIN') {
    tensionColorClass = 'bg-amber-50 dark:bg-amber-950/60 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300';
    isTensionHigh = true;
  } else if (tensionLevel === 'EXTREME') {
    tensionColorClass = 'bg-rose-50 dark:bg-rose-950/60 border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 font-bold';
    isTensionHigh = true;
  }

  // 3. Progressive Streak Radiant Tiers (Chuỗi càng cao màu càng rực rỡ)
  const streakDetails = useMemo(() => {
    if (streakCount === 0) {
      return {
        badgeClass: 'bg-slate-100 dark:bg-slate-800/60 border-slate-200 dark:border-slate-800 text-slate-400 dark:text-slate-500',
        flameClass: 'text-slate-400 dark:text-slate-500',
        label: '0 ngày',
        hasGlow: false,
        isLegendary: false,
        tooltip: 'Chưa có chuỗi ngày (0 ngày). Hãy hoàn thành nhiệm vụ hôm nay để thắp sáng ngọn lửa!',
      };
    } else if (streakCount <= 3) {
      return {
        badgeClass: 'bg-amber-50 dark:bg-amber-950/60 border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300 shadow-xs',
        flameClass: 'text-amber-500 fill-amber-500 animate-pulse',
        label: `${streakCount} ngày`,
        hasGlow: false,
        isLegendary: false,
        tooltip: `Chuỗi khởi động: ${streakCount} ngày liên tiếp • Lửa nhiệt huyết đang nhen nhóm 🔥`,
      };
    } else if (streakCount <= 7) {
      return {
        badgeClass: 'bg-gradient-to-r from-amber-500/15 via-orange-500/20 to-amber-500/15 border-orange-400 dark:border-orange-600 text-orange-700 dark:text-orange-300 font-semibold shadow-xs',
        flameClass: 'text-orange-500 fill-orange-500 animate-bounce',
        label: `${streakCount} ngày`,
        hasGlow: false,
        isLegendary: false,
        tooltip: `Chuỗi bứt phá: ${streakCount} ngày liên tiếp • Duy trì tuần lễ kỷ luật xuất sắc 🔥`,
      };
    } else if (streakCount <= 14) {
      return {
        badgeClass: 'bg-gradient-to-r from-orange-500/20 via-rose-500/25 to-pink-500/20 border-rose-400 dark:border-rose-600 text-rose-700 dark:text-rose-300 font-bold shadow-sm ring-1 ring-rose-500/30',
        flameClass: 'text-rose-500 fill-rose-500 animate-pulse',
        label: `${streakCount} ngày`,
        hasGlow: true,
        isLegendary: false,
        tooltip: `Chuỗi Hồng Ngọc: ${streakCount} ngày liên tục • Thói quen đang ăn sâu vào tiềm thức ✨🔥`,
      };
    } else if (streakCount <= 29) {
      return {
        badgeClass: 'bg-gradient-to-r from-purple-500/25 via-fuchsia-500/30 to-indigo-500/25 border-purple-400 dark:border-purple-500 text-purple-800 dark:text-purple-200 font-black shadow-md ring-1 ring-purple-400/50 animate-pulse',
        flameClass: 'text-fuchsia-500 fill-fuchsia-500 animate-pulse',
        label: `${streakCount} ngày`,
        hasGlow: true,
        isLegendary: false,
        tooltip: `Chuỗi Plasma Tím: ${streakCount} ngày liên tiếp • Phong độ thép của bậc thầy kỷ luật! ⚡✨`,
      };
    } else {
      return {
        badgeClass: 'bg-gradient-to-r from-amber-400/35 via-rose-500/35 to-indigo-500/35 border-amber-400 dark:border-cyan-400 text-amber-950 dark:text-amber-100 font-black shadow-lg ring-2 ring-amber-400/60 backdrop-blur-xs',
        flameClass: 'text-amber-400 fill-rose-500 animate-bounce',
        label: `${streakCount} ngày`,
        hasGlow: true,
        isLegendary: true,
        tooltip: `CHUỖI CỰC QUANG HUYỀN THOẠI: ${streakCount} ngày liên tục! Đỉnh cao của sự nhất quán vô song 🌈👑✨`,
      };
    }
  }, [streakCount]);

  // 4. Local DB Last Saved tracking
  const [lastSavedIso, setLastSavedIso] = useState<string | null>(() => {
    return localStorage.getItem('lifeos_last_db_save') || dbLastSaved || null;
  });
  const [isJustSaved, setIsJustSaved] = useState<boolean>(false);

  useEffect(() => {
    if (dbLastSaved) {
      setLastSavedIso((prev) => {
        if (!prev) return dbLastSaved;
        return new Date(dbLastSaved) > new Date(prev) ? dbLastSaved : prev;
      });
    }
  }, [dbLastSaved]);

  useEffect(() => {
    let timer: any;
    const triggerSaveIndicator = (isoString?: string) => {
      const ts = isoString || new Date().toISOString();
      setLastSavedIso(ts);
      setIsJustSaved(true);
      clearTimeout(timer);
      timer = setTimeout(() => setIsJustSaved(false), 2500);
    };

    const handleDbSaved = (e: any) => {
      triggerSaveIndicator(e.detail?.timestamp);
    };
    const handleGenericUpdate = () => {
      triggerSaveIndicator(new Date().toISOString());
    };

    window.addEventListener('lifeos_db_saved', handleDbSaved as EventListener);
    window.addEventListener('lifeos_task_updated', handleGenericUpdate);
    window.addEventListener('lifeos_schedule_updated', handleGenericUpdate);
    window.addEventListener('lifeos_screentime_updated', handleGenericUpdate);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('lifeos_db_saved', handleDbSaved as EventListener);
      window.removeEventListener('lifeos_task_updated', handleGenericUpdate);
      window.removeEventListener('lifeos_schedule_updated', handleGenericUpdate);
      window.removeEventListener('lifeos_screentime_updated', handleGenericUpdate);
    };
  }, []);

  const saveTimeInfo = useMemo(() => {
    if (!lastSavedIso) {
      return { time: '--:--', full: 'Chưa có thông tin lưu' };
    }
    const d = new Date(lastSavedIso);
    if (isNaN(d.getTime())) {
      return { time: '--:--', full: 'Chưa có thông tin lưu' };
    }
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    const ss = String(d.getSeconds()).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return {
      time: `${hh}:${mm}:${ss}`,
      shortTime: `${hh}:${mm}`,
      full: `${hh}:${mm}:${ss} • ${day}/${month}/${year}`
    };
  }, [lastSavedIso]);

  return (
    <header className="h-14 border-b border-border bg-background/95 backdrop-blur px-4 md:px-6 flex items-center justify-between sticky top-0 z-20 shadow-xs gap-3">
      {/* Search Bar Button (Ctrl K) */}
      <button
        onClick={onOpenSearch}
        className="flex items-center gap-2.5 px-3 h-8 rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground text-xs w-56 md:w-72 lg:w-80 transition justify-between shadow-xs cursor-pointer select-none text-muted-foreground shrink-0"
      >
        <span className="flex items-center gap-2 truncate">
          <Search className="w-3.5 h-3.5 text-neutral-600 dark:text-neutral-400 shrink-0" />
          <span className="truncate text-xs font-normal">
            Tìm kiếm task, khóa học, mục tiêu...
          </span>
        </span>
        <kbd className="text-[10px] bg-muted px-1.5 py-0.5 rounded border border-border text-muted-foreground font-mono shrink-0 hidden sm:inline-block">
          Ctrl K
        </kbd>
      </button>

      {/* Right Actions & Status Bar Badges */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5">
        {/* 1. UPCOMING / IN-PROGRESS EVENT OR TASK (Detailed Categorization) */}
        {upcomingItem ? (
          (() => {
            const isSchedule = upcomingItem.type === 'SCHEDULE' || upcomingItem.type_code === 'SCHEDULE';
            const isCourse = upcomingItem.type_code === 'COURSE_TASK';
            const navTarget = isSchedule ? 'calendar' : (isCourse ? 'courses' : 'tasks');

            if (upcomingItem.status === 'IN_PROGRESS') {
              return (
                <button
                  onClick={() => onNavigateTab?.(navTarget)}
                  className="flex items-center gap-1.5 py-1 px-2.5 rounded-full text-xs font-medium bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 hover:opacity-85 transition cursor-pointer max-w-[220px] md:max-w-[280px] truncate shadow-xs shrink-0"
                  title={`[${upcomingItem.type_label || (isSchedule ? 'Lịch cố định' : 'Nhiệm vụ')}] ${upcomingItem.title} • ${upcomingItem.status_label}`}
                >
                  <span className="relative flex h-2 w-2 shrink-0">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                  </span>
                  <span className="px-1.5 py-0.2 rounded text-[9px] font-bold uppercase tracking-wider bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300 shrink-0">
                    {upcomingItem.type_label || (isSchedule ? 'Lịch' : 'Task')}
                  </span>
                  <span className="truncate font-semibold text-[11px]">
                    {upcomingItem.title}
                  </span>
                  <span className="text-[10px] opacity-80 font-mono shrink-0">
                    ({upcomingItem.time_str})
                  </span>
                </button>
              );
            } else if (upcomingItem.status === 'OVERDUE') {
              return (
                <button
                  onClick={() => onNavigateTab?.(navTarget)}
                  className="flex items-center gap-1.5 py-1 px-2.5 rounded-full text-xs font-medium bg-rose-50 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-200 hover:opacity-85 transition cursor-pointer max-w-[220px] md:max-w-[280px] truncate shadow-xs shrink-0"
                  title={`Nhiệm vụ quá hạn: ${upcomingItem.title} (${upcomingItem.status_label})`}
                >
                  <AlertCircle className="w-3.5 h-3.5 text-rose-500 shrink-0 animate-pulse" />
                  <span className="px-1.5 py-0.2 rounded text-[9px] font-bold uppercase tracking-wider bg-rose-100 dark:bg-rose-900 text-rose-700 dark:text-rose-300 shrink-0">
                    {upcomingItem.type_label || 'Quá hạn'}
                  </span>
                  <span className="truncate font-semibold text-[11px]">{upcomingItem.title}</span>
                  <span className="text-[10px] opacity-80 shrink-0 font-mono">({upcomingItem.status_label})</span>
                </button>
              );
            } else {
              return (
                <button
                  onClick={() => onNavigateTab?.(navTarget)}
                  className={`flex items-center gap-1.5 py-1 px-2.5 rounded-full text-xs font-medium transition cursor-pointer max-w-[220px] md:max-w-[280px] truncate shadow-xs shrink-0 ${
                    isSchedule
                      ? 'bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200'
                      : isCourse
                      ? 'bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 text-indigo-800 dark:text-indigo-200'
                      : 'bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-200'
                  } hover:opacity-85`}
                  title={`[${upcomingItem.type_label || (isSchedule ? 'Lịch cố định' : 'Nhiệm vụ')}] ${upcomingItem.title} • Thời gian: ${upcomingItem.time_str}`}
                >
                  {isSchedule ? (
                    <CalendarClock className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  ) : isCourse ? (
                    <BookOpen className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                  ) : (
                    <Clock className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                  )}
                  <span
                    className={`px-1.5 py-0.2 rounded text-[9px] font-bold uppercase tracking-wider shrink-0 ${
                      isSchedule
                        ? 'bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300'
                        : isCourse
                        ? 'bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300'
                        : 'bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300'
                    }`}
                  >
                    {upcomingItem.type_label || (isSchedule ? 'Lịch cố định' : 'Nhiệm vụ')}
                  </span>
                  <span className="truncate font-semibold text-[11px]">
                    {upcomingItem.title}
                  </span>
                  <span className="text-[10px] font-mono opacity-80 shrink-0">
                    {upcomingItem.start_time}
                  </span>
                </button>
              );
            }
          })()
        ) : (
          <div className="hidden xl:flex items-center gap-1 text-[11px] text-slate-400 dark:text-slate-500 px-2 py-0.5 shrink-0">
            <CheckCircle2 className="w-3 h-3 text-slate-400" />
            <span>Hết lịch hôm nay</span>
          </div>
        )}

        {/* 2. ÁP LỰC & SỨC KHỎE TINH THẦN (Stress & Mental Health Telemetry - Tạm ẩn khi vô hiệu hoá) */}
        {isMentalHealthOn && (
          <button
            onClick={() => onNavigateTab?.('wellbeing')}
            className={`flex items-center gap-1.5 py-1 px-2.5 rounded-md border text-xs font-semibold cursor-pointer transition hover:opacity-85 shrink-0 shadow-xs ${
              tensionColorClass
            } ${isTensionHigh ? 'animate-pulse' : ''}`}
            title={
              tension
                ? `Mức độ Áp lực: ${tension.tension_label} • Khối lượng học & làm việc: ${(tension.tension_score ?? 6.0).toFixed(1)}h/ngày
• Nguy cơ quá tải tuần: ${tension.weekly_risk_level === 'BURNOUT_RISK' ? 'Cảnh báo quá tải' : tension.weekly_risk_level === 'MODERATE' ? 'Căng thẳng vừa' : 'Tối ưu cân bằng'}
• Click để mở Quản lý Sức khỏe Tinh thần & Cân bằng Cuộc sống`
                : 'Mức độ Áp lực & Sức khỏe Tinh thần • Click để mở'
            }
          >
            <HeartPulse
              className={`w-3.5 h-3.5 shrink-0 ${
                isTensionHigh ? 'text-rose-500 animate-bounce' : 'text-current'
              }`}
            />
            <span className="flex items-center gap-1.5">
              <span className="font-medium text-slate-600 dark:text-slate-400">
                Áp lực:
              </span>
              <strong className="font-mono">{(tension?.tension_score ?? 6.0).toFixed(1)}h</strong>
              <span className="text-[10px] opacity-40 select-none">•</span>
              <span className="truncate max-w-[85px] sm:max-w-none">{tension?.tension_label || 'Tối ưu'}</span>
            </span>
          </button>
        )}

        {/* 3. CHỈ SỐ NHẤT QUÁN & THỰC THI (Multi-day Statistical Consistency Index) */}
        <button
          onClick={() => onNavigateTab?.('screentime')}
          className={`flex items-center gap-1.5 py-1 px-2.5 rounded-md border text-xs font-semibold cursor-pointer transition hover:opacity-85 shrink-0 shadow-xs ${
            isDigitalWellbeingOn
              ? consistencyColorClass
              : 'border-dashed border-slate-300 dark:border-slate-700 bg-slate-100/70 dark:bg-slate-800/40 text-slate-400 dark:text-slate-500'
          }`}
          title={
            !isDigitalWellbeingOn
              ? 'Quản lý Cân bằng số & Screentime (Đang tắt) • Click để mở'
              : metrics
              ? `Chỉ số Nhất quán & Thực thi: ${score.toFixed(1)}/10 (${consistencyData?.tier_label || 'Xuất sắc'})
• Điểm TB (μ): ${metrics.mean}/10
• Phương sai (σ²): ${metrics.variance} • Độ ổn định: ${metrics.stability_pct}%
• Hoãn bất khả kháng (bảo lưu 85% điểm): ${metrics.force_majeure_count}
• Trì hoãn chủ quan: ${metrics.unexcused_delay_count}
• Click để xem chi tiết Screentime & Kỷ luật`
              : `Chỉ số Nhất quán: ${score.toFixed(1)}/10 • Click để xem chi tiết`
          }
        >
          <Shield className={`w-3.5 h-3.5 shrink-0 ${!isDigitalWellbeingOn ? 'text-slate-400 dark:text-slate-500' : ''}`} />
          <span className="flex items-center gap-1">
            <span>Nhất quán:</span>
            {isDigitalWellbeingOn ? (
              <strong className="font-mono">{score.toFixed(1)}/10</strong>
            ) : (
              <span className="text-[11px] font-normal italic">(Đang tắt)</span>
            )}
          </span>
        </button>

        {/* 4. RANK MASTERY WIDGET (Hiển thị khi Chế độ Cày Cuốc BẬT) */}
        {isGamificationOn && isRankOnTopbar && (
          <button
            onClick={() => onNavigateTab?.('courses')}
            className={`flex items-center gap-1.5 py-1 px-2.5 rounded-md border text-xs font-semibold cursor-pointer transition hover:scale-[1.02] shrink-0 shadow-xs active:scale-95 ${
              topMastery?.masteryInfo.currentTier.level === 11
                ? 'bg-gradient-to-r from-amber-500/20 via-rose-500/20 to-purple-500/20 border-amber-400 dark:border-amber-400 text-amber-900 dark:text-amber-200 ring-1 ring-amber-400/50'
                : (topMastery?.masteryInfo.currentTier.level ?? 1) >= 9
                ? 'bg-gradient-to-r from-amber-500/15 via-orange-500/15 to-rose-500/15 border-orange-400 dark:border-orange-500 text-orange-800 dark:text-orange-200'
                : (topMastery?.masteryInfo.currentTier.level ?? 1) >= 6
                ? 'bg-gradient-to-r from-blue-500/15 to-indigo-500/15 border-blue-400 dark:border-blue-500 text-blue-800 dark:text-blue-200'
                : (topMastery?.masteryInfo.currentTier.level ?? 1) >= 4
                ? 'bg-gradient-to-r from-amber-500/10 to-yellow-500/15 border-amber-300 dark:border-amber-600 text-amber-800 dark:text-amber-300'
                : 'bg-slate-100/90 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
            }`}
            style={
              topMastery?.masteryInfo.mythicStage
                ? { boxShadow: topMastery.masteryInfo.mythicStage.boxShadow }
                : topMastery?.masteryInfo.currentTier.glowShadow
                ? { boxShadow: topMastery.masteryInfo.currentTier.glowShadow }
                : undefined
            }
            title={
              topMastery?.topCourse
                ? `Danh Hiệu: ${topMastery.masteryInfo.currentTier.title} (${topMastery.topPoints.toLocaleString()} EXP)\n• Khóa học dẫn đầu: "${topMastery.topCourse.title}"\n• Tổng EXP tích lũy: ${topMastery.totalXP.toLocaleString()} EXP\n• Click để xem chi tiết Khóa học & Cày Cuốc`
                : `Hệ Thống Danh Hiệu Khóa Học: ${topMastery?.masteryInfo.currentTier.title || 'Tập Sự'}\n• Click để vào trang Khóa học`
            }
          >
            <span className="text-sm select-none">{topMastery?.masteryInfo.currentTier.icon || '🛡️'}</span>
            <span className="flex items-center gap-1 font-bold">
              <span className="truncate max-w-[85px] sm:max-w-none">
                {topMastery?.masteryInfo.currentTier.title || 'Tập Sự'}
              </span>
              {topMastery?.masteryInfo.mythicStage && (
                <span className="text-[10px] font-mono font-black text-amber-500">
                  [{topMastery.masteryInfo.mythicStage.romanNumeral}]
                </span>
              )}
            </span>
            <span className="text-[10px] opacity-40 select-none">•</span>
            <span className="font-mono text-[11px] font-bold text-amber-600 dark:text-amber-400">
              {(topMastery?.topPoints ?? 0).toLocaleString()} EXP
            </span>
          </button>
        )}

        {/* 5. PROGRESSIVE RADIANT STREAK (Chuỗi càng cao màu càng rực rỡ) */}
        <Badge
          variant="secondary"
          className={`gap-1.5 py-1 px-2.5 font-medium select-none shrink-0 transition-all ${streakDetails.badgeClass}`}
          title={streakDetails.tooltip}
        >
          <Flame className={`w-3.5 h-3.5 shrink-0 ${streakDetails.flameClass}`} />
          <span>{streakDetails.label}</span>
          {streakDetails.isLegendary && (
            <Sparkles className="w-3 h-3 text-amber-400 animate-spin shrink-0" />
          )}
        </Badge>

        {/* 5. SYNC STATUS & REAL-TIME DB SAVE TIME BADGE */}
        <div
          className={`flex items-center gap-1.5 py-1 px-2.5 rounded-md border text-xs font-medium select-none shrink-0 transition-all duration-300 hidden sm:flex ${
            isJustSaved
              ? 'bg-emerald-50 dark:bg-emerald-950/70 border-emerald-400 dark:border-emerald-600 text-emerald-800 dark:text-emerald-200 ring-1 ring-emerald-400/60 shadow-xs'
              : 'bg-slate-100/90 dark:bg-slate-800/60 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-800/90'
          }`}
          title={`Cơ sở dữ liệu SQLite cục bộ (lifeos.db)\n• Trạng thái: Đang kết nối trực tiếp trên máy\n• Thời gian lưu: ${saveTimeInfo.full}\n• Đồng bộ tức thời theo thời gian thực mỗi khi có thay đổi`}
        >
          <span className="relative flex h-2 w-2 shrink-0">
            <span
              className={`absolute inline-flex h-full w-full rounded-full bg-emerald-400 ${
                isJustSaved ? 'animate-ping opacity-100' : 'opacity-40'
              }`}
            />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
          <Cloud className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400 shrink-0" />
          <span className="font-semibold">Local DB</span>
          <span className="text-[10px] opacity-40 select-none">•</span>
          <span
            className={`font-mono text-[11px] font-semibold tracking-tight transition-colors ${
              isJustSaved
                ? 'text-emerald-600 dark:text-emerald-300 font-bold'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            {isJustSaved ? `Đã lưu ${saveTimeInfo.time}` : saveTimeInfo.time}
          </span>
        </div>

        {/* 6. TELEGRAM CONNECTION STATUS (Replacing Dark Mode Toggle) */}
        <button
          onClick={() => onNavigateTab?.('settings')}
          className={`flex items-center gap-1.5 py-1 px-2 rounded-md border text-xs font-semibold cursor-pointer transition hover:opacity-85 shrink-0 shadow-xs ${
            telegram?.is_connected
              ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'
              : 'bg-slate-100 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400'
          }`}
          title={
            telegram?.is_connected
              ? 'Telegram Bot: Đang hoạt động • Nhận thông báo lịch & task thời gian thực • Click để mở Cài đặt'
              : 'Telegram Bot: Chưa kết nối hoặc đang tắt • Click để cấu hình trong Cài đặt'
          }
        >
          <span
            className={`w-2 h-2 rounded-full shrink-0 ${
              telegram?.is_connected
                ? 'bg-emerald-500 animate-pulse'
                : 'bg-slate-400 dark:bg-slate-500'
            }`}
          />
          <Send className="w-3 h-3 text-current shrink-0" />
          <span className="text-[11px] font-medium">
            {telegram?.is_connected ? 'TG: Bật' : 'TG: Tắt'}
          </span>
        </button>
      </div>
    </header>
  );
};
