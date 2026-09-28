import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  ChevronLeft, ChevronRight, Calendar as CalendarIcon,
  CheckCircle2, AlertCircle, Clock, Plus, Flame, BookOpen,
  MapPin, Trash2, ExternalLink, Flag, Edit2, CheckSquare,
  Eye, EyeOff, Layers, Zap, CalendarDays, CornerDownRight
} from 'lucide-react';
import {
  CalendarWeeklyResponse, CalendarDayView, Task,
  ScheduleOccurrenceView, CalendarNote,
  PRIORITY_CONFIG, DIFFICULTY_CONFIG, PriorityLevel
} from '../../types';
import { getDeadlineInfo } from '../../utils/taskDeadlines';
import { Button } from '../ui/button';
import { toLocalDateString } from '../../utils/dateUtils';

interface WeeklyTimelineProps {
  data: CalendarWeeklyResponse | null;
  onPrevWeek: () => void;
  onNextWeek: () => void;
  onToday: () => void;
  onSelectDay: (dateStr: string) => void;
  onTaskClick: (task: Task) => void;
  onToggleTask: (task: Task) => void;
  onAddTaskForDay: (dateStr: string, hour?: number) => void;
  onQuickAddTask?: (dateStr: string, title: string) => Promise<void>;
  onDeleteTask?: (task: Task) => void;
  onEditSchedule?: (scheduleId: number) => void;
  onDeleteSchedule?: (scheduleId: number, title: string) => void;
  onAddSchedule: () => void;
  onAddTaskToSchedule?: (scheduleId: number, dateStr: string, startTime: string, endTime: string) => void;
  onAddNote: (dateStr: string, content: string) => Promise<void>;
  onDeleteNote: (noteId: number) => Promise<void>;
  hideHeader?: boolean;
}

const HOUR_HEIGHT = 60; // 60px per hour -> exactly 1 minute = 1 pixel
const HOURS = Array.from({ length: 24 }, (_, i) => i);

interface LayoutItem {
  id: string | number;
  startMin: number;
  endMin: number;
  top: number;
  height: number;
  [key: string]: any;
}

/**
 * Greedy Column Clustering Algorithm for overlapping schedule & task intervals
 */
function computeOverlapLayout<T extends LayoutItem>(items: T[]): Array<T & { colIndex: number; totalCols: number; hasConflict: boolean }> {
  if (items.length === 0) return [];
  const sorted = [...items].sort((a, b) => a.startMin - b.startMin || (b.endMin - b.startMin) - (a.endMin - a.startMin));
  const clusters: T[][] = [];
  let currentCluster: T[] = [];
  let clusterEnd = -1;

  for (const item of sorted) {
    if (currentCluster.length === 0) {
      currentCluster.push(item);
      clusterEnd = item.endMin;
    } else if (item.startMin < clusterEnd) {
      currentCluster.push(item);
      clusterEnd = Math.max(clusterEnd, item.endMin);
    } else {
      clusters.push(currentCluster);
      currentCluster = [item];
      clusterEnd = item.endMin;
    }
  }
  if (currentCluster.length > 0) {
    clusters.push(currentCluster);
  }

  const results: Array<T & { colIndex: number; totalCols: number; hasConflict: boolean }> = [];
  for (const cluster of clusters) {
    const colEndTimes: number[] = [];
    const hasConflict = cluster.length > 1;

    const assigned = cluster.map((item) => {
      let col = 0;
      while (col < colEndTimes.length && colEndTimes[col] > item.startMin) {
        col++;
      }
      colEndTimes[col] = item.endMin;
      return { ...item, colIndex: col, hasConflict };
    });

    const totalCols = colEndTimes.length;
    for (const a of assigned) {
      results.push({ ...a, totalCols });
    }
  }
  return results;
}

const parseTimeToMinutes = (timeStr: string) => {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + (minutes || 0);
};

const getTaskTimeMinutes = (t: Task): { hasTime: boolean; startMin: number; endMin: number; timeLabel: string } => {
  let sMin = -1;
  let eMin = -1;
  let hasTime = false;
  let timeLabel = '';

  if (t.start_datetime) {
    const d = new Date(t.start_datetime);
    const h = d.getHours();
    const m = d.getMinutes();
    sMin = h * 60 + m;
    hasTime = true;
  }

  if (t.due_datetime) {
    const d = new Date(t.due_datetime);
    const h = d.getHours();
    const m = d.getMinutes();
    const dueMin = h * 60 + m;

    if (h !== 0 || m !== 0 || sMin >= 0) {
      hasTime = true;
    }

    const dueFormatted = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;

    if (sMin >= 0) {
      eMin = dueMin > sMin ? dueMin : sMin + 45;
      const startFormatted = `${String(Math.floor(sMin / 60)).padStart(2, '0')}:${String(sMin % 60).padStart(2, '0')}`;
      timeLabel = `${startFormatted} - ${dueFormatted}`;
    } else if (hasTime) {
      eMin = dueMin;
      sMin = Math.max(0, dueMin - 45);
      timeLabel = `Hạn: ${dueFormatted}`;
    }
  } else if (sMin >= 0) {
    eMin = sMin + 45;
    const startFormatted = `${String(Math.floor(sMin / 60)).padStart(2, '0')}:${String(sMin % 60).padStart(2, '0')}`;
    timeLabel = `${startFormatted} - ${String(Math.floor(eMin / 60)).padStart(2, '0')}:${String(eMin % 60).padStart(2, '0')}`;
  }

  return { hasTime: hasTime && sMin >= 0 && eMin >= 0, startMin: sMin, endMin: eMin, timeLabel };
};

export const WeeklyTimeline: React.FC<WeeklyTimelineProps> = ({
  data,
  hideHeader = false,
  onPrevWeek,
  onNextWeek,
  onToday,
  onSelectDay,
  onTaskClick,
  onToggleTask,
  onAddTaskForDay,
  onQuickAddTask,
  onDeleteTask,
  onEditSchedule,
  onDeleteSchedule,
  onAddSchedule,
  onAddTaskToSchedule,
  onAddNote,
  onDeleteNote,
}) => {
  // State to track whether completed tasks are expanded per day
  const [expandedCompletedDays, setExpandedCompletedDays] = useState<Record<string, boolean>>({});

  const toggleDayCompleted = (dateStr: string) => {
    setExpandedCompletedDays((prev) => ({
      ...prev,
      [dateStr]: !prev[dateStr],
    }));
  };

  // Real-time clock updating every 30 seconds for the prominent live time needle
  const [currentTime, setCurrentTime] = useState<Date>(new Date());
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  const gridScrollRef = useRef<HTMLDivElement>(null);
  const todayStr = toLocalDateString();
  const isCurrentWeek = Boolean(data?.days?.some((d) => d.date === todayStr || d.is_today));

  // Auto-scroll timeline to current hour on load
  useEffect(() => {
    if (gridScrollRef.current) {
      if (isCurrentWeek) {
        const currentH = new Date().getHours();
        const targetScroll = Math.max(0, (currentH - 1) * HOUR_HEIGHT);
        gridScrollRef.current.scrollTop = targetScroll;
      } else {
        // Scroll to 07:00 morning
        gridScrollRef.current.scrollTop = 7 * HOUR_HEIGHT;
      }
    }
  }, [data?.start_date, isCurrentWeek]);

  /**
   * Compute per-day data structures for Timeline Grid:
   * (Hook is placed unconditionally at the top level to strictly follow React Rules of Hooks)
   */
  const computedDays = useMemo(() => {
    if (!data || !data.days) return [];

    return data.days.map((day) => {
      const isPast = day.date < todayStr;
      const isToday = day.is_today || day.date === todayStr;

      // Group schedules
      const scheduleItems = (day.fixed_schedules || []).map((occ, idx) => {
        const sMin = parseTimeToMinutes(occ.start_time);
        const eMin = parseTimeToMinutes(occ.end_time);
        const durationMin = Math.max(eMin - sMin, 30);
        return {
          id: `sched-${idx}-${occ.fixed_schedule_id}`,
          occ,
          startMin: sMin,
          endMin: Math.max(eMin, sMin + 30),
          top: sMin,
          height: durationMin,
        };
      });

      const processedSchedules = computeOverlapLayout(scheduleItems);

      // Tasks attached to or overlapping schedules vs standalone
      const tasksInSchedules = new Set<number>();
      const scheduleTaskMap: Record<number, Task[]> = {};

      (day.fixed_schedules || []).forEach((occ) => {
        scheduleTaskMap[occ.fixed_schedule_id] = [];
        const occSMin = parseTimeToMinutes(occ.start_time);
        const occEMin = parseTimeToMinutes(occ.end_time);

        (day.tasks || []).forEach((t) => {
          // Explicit attachment
          if (t.scheduled_with_fixed_id === occ.fixed_schedule_id) {
            scheduleTaskMap[occ.fixed_schedule_id].push(t);
            tasksInSchedules.add(t.id);
            return;
          }

          // Or overlapping timeframe if not explicitly attached elsewhere
          if (!t.scheduled_with_fixed_id) {
            const tTime = getTaskTimeMinutes(t);
            if (tTime.hasTime && tTime.startMin < occEMin && tTime.endMin > occSMin) {
              scheduleTaskMap[occ.fixed_schedule_id].push(t);
              tasksInSchedules.add(t.id);
            }
          }
        });
      });

      // Remaining tasks: split into standalone timed vs untimed
      const standaloneTimed: Array<{
        id: string;
        task: Task;
        startMin: number;
        endMin: number;
        top: number;
        height: number;
        timeLabel: string;
      }> = [];
      const untimedTasks: Task[] = [];

      (day.tasks || []).forEach((t) => {
        if (tasksInSchedules.has(t.id)) return;
        const tTime = getTaskTimeMinutes(t);
        if (tTime.hasTime) {
          const duration = Math.max(tTime.endMin - tTime.startMin, 32);
          standaloneTimed.push({
            id: `task-${t.id}`,
            task: t,
            startMin: tTime.startMin,
            endMin: tTime.endMin,
            top: tTime.startMin,
            height: duration,
            timeLabel: tTime.timeLabel,
          });
        } else {
          untimedTasks.push(t);
        }
      });

      const processedTimedTasks = computeOverlapLayout(standaloneTimed);

      return {
        day,
        isPast,
        isToday,
        processedSchedules,
        scheduleTaskMap,
        processedTimedTasks,
        untimedTasks,
      };
    });
  }, [data, todayStr]);

  const hasAnyUntimedTasks = computedDays.some((d) => d.untimedTasks.length > 0);

  // If data is still loading
  if (!data) {
    return (
      <div className="p-12 text-center text-slate-500 animate-pulse">
        Đang tải lịch tuần...
      </div>
    );
  }

  const formatDateLabel = (dateStr: string) => {
    const parts = dateStr.split('-');
    if (parts.length < 3) return dateStr;
    return `${parts[2]}/${parts[1]}`;
  };

  // Time needle calculation
  const currentMinutes = currentTime.getHours() * 60 + currentTime.getMinutes();
  const timeNeedleTop = currentMinutes; // 1 min = 1 px!
  const currentTimeLabel = `${String(currentTime.getHours()).padStart(2, '0')}:${String(
    currentTime.getMinutes()
  ).padStart(2, '0')}`;

  /**
   * Reusable Task Card renderer supporting all badges:
   * - Transfer badge (🔄)
   * - Difficulty badge (🔥 +{points}đ)
   * - Priority badge (🚩 {level})
   * - Deadline clock (⏰ {time})
   * - Attached course (📚 {course})
   * - Attached schedule (📌 {schedule})
   * - Overlaid indicator (⚡ Đè lên lịch)
   * - Subtask progress
   */
  const renderTaskCard = (t: Task, isOverlaid: boolean = false, compact: boolean = false) => {
    const isDone = t.status === 'COMPLETED';
    const pCfg = PRIORITY_CONFIG[(t.priority as PriorityLevel)] || PRIORITY_CONFIG.MEDIUM;
    const dCfg = DIFFICULTY_CONFIG[t.difficulty] || DIFFICULTY_CONFIG[2];
    const deadline = getDeadlineInfo(t.due_datetime, t.status);
    const isTransferred = Boolean(
      t.transferred_from_id ||
      t.transferred_to_id ||
      t.transferred_from_title ||
      (t.status as string) === 'TRANSFERRED'
    );

    const priorityBorder = isDone
      ? 'border-l-slate-300 dark:border-l-slate-700'
      : isTransferred
      ? 'border-l-purple-500 dark:border-l-purple-400'
      : t.priority === 'URGENT'
      ? 'border-l-rose-500'
      : t.priority === 'HIGH'
      ? 'border-l-amber-500'
      : t.priority === 'MEDIUM'
      ? 'border-l-blue-400 dark:border-l-blue-500'
      : 'border-l-slate-300 dark:border-l-slate-600';

    return (
      <div
        key={t.id}
        className={`rounded-lg p-1.5 border border-l-[3.5px] ${priorityBorder} text-xs transition-all cursor-pointer group select-none shadow-xs hover:shadow-md ${
          isDone
            ? 'bg-slate-50/90 border-slate-200 text-slate-400 dark:bg-slate-900/60 dark:border-slate-800 dark:text-slate-500'
            : isTransferred
            ? 'bg-purple-50/70 border-purple-200/90 dark:bg-purple-950/40 dark:border-purple-800/80 text-purple-950 dark:text-purple-100 ring-1 ring-purple-400/20'
            : isOverlaid
            ? 'bg-white/95 dark:bg-slate-900/95 border-slate-200/90 dark:border-slate-700 backdrop-blur-xs text-slate-900 dark:text-slate-100 ring-1 ring-black/5 dark:ring-white/5'
            : 'bg-white border-slate-200 hover:border-neutral-900 text-slate-900 dark:bg-slate-800/90 dark:border-slate-700 dark:hover:border-neutral-100 dark:text-slate-200'
        }`}
        onClick={() => onTaskClick(t)}
      >
        <div className="flex items-start gap-1.5">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleTask(t);
            }}
            className="mt-0.5 text-slate-400 hover:text-emerald-500 shrink-0"
            title={
              (t.status as string) === 'TRANSFERRED'
                ? 'Nhiệm vụ đã chuyển tiếp sang thời điểm khác'
                : isDone
                ? 'Đánh dấu chưa xong'
                : 'Đánh dấu đã xong'
            }
          >
            {isDone ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
            ) : (t.status as string) === 'TRANSFERRED' ? (
              <div className="w-3.5 h-3.5 rounded flex items-center justify-center bg-purple-100 dark:bg-purple-900/80 text-purple-700 dark:text-purple-300 border border-purple-300 dark:border-purple-700 shadow-2xs">
                <CornerDownRight className="w-2.5 h-2.5 stroke-[2.5]" />
              </div>
            ) : (
              <div className="w-3.5 h-3.5 rounded border border-slate-300 dark:border-slate-500 hover:border-emerald-500" />
            )}
          </button>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1">
              {isOverlaid && (
                <span
                  title="Nhiệm vụ đè lên khung giờ lịch cố định này"
                  className="inline-flex items-center text-[8px] font-bold px-1 rounded bg-indigo-50 text-indigo-700 dark:bg-indigo-950/70 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 shrink-0"
                >
                  ⚡ Đè lên
                </span>
              )}
              <p
                className={`font-semibold truncate text-[11px] leading-tight ${
                  isDone ? 'line-through text-slate-400 dark:text-slate-500' : 'text-slate-900 dark:text-slate-100'
                }`}
              >
                {t.title}
              </p>
            </div>

            <div className="flex items-center gap-1 mt-1 text-[9px] flex-wrap">
              {/* Ký hiệu chuyển tiếp (Transferred purple indicator badge) */}
              {isTransferred && (
                <span
                  title={
                    t.transferred_from_date
                      ? `Nhiệm vụ chuyển tiếp từ ngày ${t.transferred_from_date}`
                      : 'Nhiệm vụ đã chuyển tiếp sang thời điểm mới'
                  }
                  className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded font-extrabold border text-[8.5px] bg-purple-100 text-purple-800 dark:bg-purple-900/80 dark:text-purple-200 border-purple-300 dark:border-purple-700 shadow-2xs"
                >
                  <CornerDownRight className="w-2.5 h-2.5 stroke-[2.5]" />
                  <span>Chuyển tiếp</span>
                </span>
              )}

              {/* Priority badge */}
              <span
                title={`Mức ưu tiên: ${pCfg.label} - ${pCfg.description}`}
                className={`inline-flex items-center gap-0.5 px-1 py-0.2 rounded font-bold border text-[8.5px] ${pCfg.badgeBg} ${pCfg.textColor} ${pCfg.borderColor}`}
              >
                <Flag className="w-2 h-2" />
                <span>{pCfg.shortLabel}</span>
              </span>

              {/* Difficulty badge */}
              <span
                title={`Độ khó: ${dCfg.label} (+${dCfg.points} điểm)`}
                className={`inline-flex items-center gap-0.5 px-1 py-0.2 rounded font-bold border text-[8.5px] ${dCfg.bg} ${dCfg.color} ${dCfg.border}`}
              >
                <Flame className="w-2 h-2 fill-current" />
                <span>+{dCfg.points}đ</span>
              </span>

              {/* Subtask count */}
              {t.subtasks_count > 0 && (
                <span
                  title={`Tiến độ subtasks: ${t.subtasks_completed_count}/${t.subtasks_count}`}
                  className="font-mono text-[8.5px] text-slate-600 dark:text-slate-400 font-semibold px-1 py-0.2 rounded bg-slate-100 dark:bg-slate-800"
                >
                  {t.subtasks_completed_count}/{t.subtasks_count}
                </span>
              )}

              {/* Attached Course */}
              {t.course_title && (
                <span
                  className="text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800/80 px-1 py-0.2 rounded text-[8.5px] truncate max-w-[80px] font-medium"
                  title={`Khóa học: ${t.course_title}`}
                >
                  📚 {t.course_title}
                </span>
              )}

              {/* Attached Fixed Schedule (if not already inside schedule container) */}
              {!isOverlaid && t.scheduled_with_fixed_title && (
                <span
                  className="text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800/80 px-1 py-0.2 rounded text-[8.5px] truncate max-w-[85px] font-medium"
                  title={`Lịch cố định: ${t.scheduled_with_fixed_title}`}
                >
                  📌 {t.scheduled_with_fixed_title}
                </span>
              )}

              {/* Deadline clock */}
              {deadline.hasDeadline && (
                <span
                  title={`Hạn chót: ${deadline.text}`}
                  className={`inline-flex items-center gap-0.5 px-1 py-0.2 rounded font-bold border text-[8.5px] ${deadline.badgeClass}`}
                >
                  <Clock className="w-2 h-2 shrink-0" />
                  <span>{deadline.shortText}</span>
                </span>
              )}
            </div>
          </div>

          {onDeleteTask && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDeleteTask(t);
              }}
              className="text-slate-400 hover:text-rose-500 transition p-0.5 rounded opacity-0 group-hover:opacity-100 shrink-0 self-start"
              title="Xóa nhiệm vụ này"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col flex-1 min-h-0 h-full">
      {/* 1. Optional Week Header Toolbar */}
      {!hideHeader && (
        <div className="flex items-center justify-between bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 shadow-xs mb-2">
          <div className="flex items-center gap-2">
            <CalendarIcon className="w-5 h-5 text-neutral-900 dark:text-neutral-100" />
            <span className="font-bold text-slate-900 dark:text-slate-100 text-sm">
              Tuần {data.week_number} / {data.year}
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              ({formatDateLabel(data.start_date)} - {formatDateLabel(data.end_date)})
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="icon"
              onClick={onPrevWeek}
              title="Tuần trước"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onToday}
            >
              Tuần hiện tại
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={onNextWeek}
              title="Tuần sau"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={onAddSchedule}
              className="ml-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Thêm Lịch cố định</span>
            </Button>
          </div>
        </div>
      )}

      {/* 2. Sleek Week Title & Live Needle Status Bar */}
      <div className="flex items-center justify-between bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 mb-2 shadow-2xs shrink-0 flex-wrap gap-2">
        {/* Left: Week title & Live needle status */}
        <div className="flex items-center gap-2.5 text-xs flex-wrap">
          <span className="font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
            <CalendarDays className="w-4 h-4 text-neutral-900 dark:text-neutral-100" />
            <span>Tuần {data.week_number} / {data.year}</span>
            <span className="text-[11px] font-normal text-slate-500 dark:text-slate-400 font-mono">
              ({formatDateLabel(data.start_date)} - {formatDateLabel(data.end_date)})
            </span>
          </span>

          {isCurrentWeek && (
            <span className="inline-flex items-center gap-1 font-semibold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/50 px-2 py-0.5 rounded-md border border-rose-200 dark:border-rose-900/60 text-[11px]">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping" />
              <span>Kim giờ trực tiếp:</span>
              <strong className="font-mono text-rose-700 dark:text-rose-300">{currentTimeLabel}</strong>
            </span>
          )}
        </div>

        {/* Right: Visual Legend & Action */}
        <div className="flex items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400">
          <Button
            variant="primary"
            size="sm"
            onClick={onAddSchedule}
            className="font-bold text-xs h-7 px-2.5 shadow-2xs"
            title="Thêm Lịch cố định mới"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Tạo Lịch cố định</span>
          </Button>

          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded bg-indigo-500" />
            <span>Lịch cố định</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded bg-amber-500" />
            <span>Nhiệm vụ đè lên</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded bg-emerald-500" />
            <span>Nhiệm vụ độc lập</span>
          </span>
        </div>
      </div>

      {/* 3. 24H TIMELINE GRID VIEW */}
      <div className="flex-1 min-h-0 flex flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs">
        {/* A. Sticky 7-Day Header Strip */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/90 shrink-0 min-w-[950px] pr-2">
          {/* Left 54px spacer for time labels column */}
          <div className="w-[54px] shrink-0 border-r border-slate-200 dark:border-slate-800 p-2 flex items-center justify-center text-[10px] font-bold text-slate-400">
            <Clock className="w-3.5 h-3.5" />
          </div>

          {/* 7 Column Headers */}
          <div className="flex-1 grid grid-cols-7 divide-x divide-slate-200 dark:divide-slate-800">
            {computedDays.map(({ day, isPast, isToday }) => {
              const pendingCount = (day.tasks || []).filter((t) => t.status !== 'COMPLETED').length;
              const completedCount = (day.tasks || []).filter((t) => t.status === 'COMPLETED').length;
              const isCompletedExpanded = !!expandedCompletedDays[day.date];

              return (
                <div
                  key={day.date}
                  className={`p-2 transition-colors ${
                    isToday
                      ? 'bg-neutral-900/5 dark:bg-white/5 font-extrabold'
                      : isPast
                      ? 'opacity-80'
                      : ''
                  }`}
                >
                  <div className="flex items-center justify-between gap-1">
                    {/* Day Name & Date (Clickable to Day View) */}
                    <button
                      type="button"
                      onClick={() => onSelectDay(day.date)}
                      className="flex items-center gap-1 text-xs font-bold text-left group hover:text-neutral-900 dark:hover:text-white transition cursor-pointer truncate"
                      title="Xem Lịch Ngày chi tiết"
                    >
                      {isToday && (
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping shrink-0" />
                      )}
                      <span className={isToday ? 'text-neutral-900 dark:text-neutral-100 font-extrabold' : 'text-slate-800 dark:text-slate-200'}>
                        {day.day_name.slice(0, 3)} {formatDateLabel(day.date)}
                      </span>
                      <ExternalLink className="w-2.5 h-2.5 text-slate-400 opacity-0 group-hover:opacity-100 transition shrink-0" />
                    </button>

                    {/* Header Actions: Toggle Completed & Quick Add Task */}
                    <div className="flex items-center gap-1 shrink-0">
                      {completedCount > 0 && (
                        <button
                          type="button"
                          onClick={() => toggleDayCompleted(day.date)}
                          className={`p-0.5 rounded text-[9px] flex items-center transition cursor-pointer ${
                            isCompletedExpanded
                              ? 'text-emerald-700 bg-emerald-100 dark:bg-emerald-950/60 dark:text-emerald-300'
                              : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
                          }`}
                          title={isCompletedExpanded ? 'Ẩn các việc đã hoàn thành' : `Hiện ${completedCount} việc đã xong`}
                        >
                          {isCompletedExpanded ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => onAddTaskForDay(day.date)}
                        className="w-4 h-4 rounded flex items-center justify-center text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 transition"
                        title="Thêm nhiệm vụ cho ngày này"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {/* Single-Row Status Badges */}
                  <div className="flex items-center gap-1 mt-1 flex-wrap">
                    {day.stats && day.stats.delayed > 0 && (
                      <span
                        title={`Chậm trễ: ${day.stats.delayed} việc`}
                        className="inline-flex items-center gap-0.5 px-1 py-0.2 rounded text-[8.5px] font-bold bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400 border border-rose-200 dark:border-rose-900/60"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
                        <span>{day.stats.delayed}</span>
                      </span>
                    )}
                    {day.stats && day.stats.partial > 0 && (
                      <span
                        title={`Hoàn thành một phần: ${day.stats.partial} việc`}
                        className="inline-flex items-center gap-0.5 px-1 py-0.2 rounded text-[8.5px] font-bold bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400 border border-amber-200 dark:border-amber-900/60"
                      >
                        <span className="text-[8px] leading-none">🌓</span>
                        <span>{day.stats.partial}</span>
                      </span>
                    )}
                    {day.stats && day.stats.todo > 0 && (
                      <span
                        title={`Cần làm: ${day.stats.todo} việc`}
                        className="inline-flex items-center gap-0.5 px-1 py-0.2 rounded text-[8.5px] font-bold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-400 shrink-0" />
                        <span>{day.stats.todo}</span>
                      </span>
                    )}
                    {day.stats && day.stats.completed > 0 && (
                      <span
                        title={`Đã xong: ${day.stats.completed} việc`}
                        className="inline-flex items-center gap-0.5 px-1 py-0.2 rounded text-[8.5px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/60"
                      >
                        <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                        <span>{day.stats.completed}</span>
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* B. All-Day / Untimed Tasks Strip (If any untimed tasks exist in this week) */}
        {hasAnyUntimedTasks && (
          <div className="flex border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 shrink-0 min-w-[950px] pr-2">
            <div className="w-[54px] shrink-0 border-r border-slate-200 dark:border-slate-800 p-1 flex items-center justify-center text-[9px] font-bold text-slate-400 uppercase text-center leading-tight">
              Chưa giờ
            </div>
            <div className="flex-1 grid grid-cols-7 divide-x divide-slate-200 dark:divide-slate-800 p-1 gap-1">
              {computedDays.map(({ day, untimedTasks }) => {
                const pendingUntimed = untimedTasks.filter((t) => t.status !== 'COMPLETED');
                const completedUntimed = untimedTasks.filter((t) => t.status === 'COMPLETED');
                const isCompletedExpanded = !!expandedCompletedDays[day.date];
                const displayed = isCompletedExpanded ? untimedTasks : pendingUntimed;

                return (
                  <div key={day.date} className="space-y-1 min-h-[26px]">
                    {displayed.map((t) => renderTaskCard(t, false, true))}
                    {pendingUntimed.length === 0 && completedUntimed.length > 0 && !isCompletedExpanded && (
                      <div
                        onClick={() => toggleDayCompleted(day.date)}
                        className="text-[9px] text-emerald-600 dark:text-emerald-400 italic text-center cursor-pointer hover:underline py-0.5"
                      >
                        ✓ {completedUntimed.length} việc đã xong
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* C. 24-Hour Scrollable Canvas with Time Needle */}
        <div
          ref={gridScrollRef}
          className="flex-1 min-h-0 overflow-y-auto overflow-x-auto relative select-none scrollbar-thin"
        >
          <div
            className="relative flex min-w-[950px]"
            style={{ height: `${24 * HOUR_HEIGHT}px` }}
          >
            {/* Hour Grid Lines Background */}
            {HOURS.map((hour) => (
              <div
                key={hour}
                className="absolute left-0 right-0 flex items-start pointer-events-none"
                style={{ top: `${hour * HOUR_HEIGHT}px`, height: `${HOUR_HEIGHT}px` }}
              >
                {/* Left Hour Label */}
                <span className="w-[54px] text-right pr-2 -mt-2 font-mono text-[10px] font-bold text-slate-400 dark:text-slate-500 shrink-0 select-none">
                  {String(hour).padStart(2, '0')}:00
                </span>

                {/* Horizontal Hour line */}
                <div className="flex-1 border-t border-slate-100 dark:border-slate-800/80 h-full relative">
                  {/* 30-min dashed guide */}
                  <div
                    className="absolute left-0 right-0 border-t border-dashed border-slate-100/60 dark:border-slate-800/40"
                    style={{ top: `${HOUR_HEIGHT / 2}px` }}
                  />
                </div>
              </div>
            ))}

            {/* Left Column Spacer */}
            <div className="w-[54px] shrink-0 border-r border-slate-200/80 dark:border-slate-800/80 pointer-events-none" />

            {/* 7 Column Canvas for Events */}
            <div className="flex-1 grid grid-cols-7 divide-x divide-slate-200/80 dark:border-slate-800/80 relative h-full">
              {computedDays.map(({ day, isPast, isToday, processedSchedules, scheduleTaskMap, processedTimedTasks }) => {
                const isCompletedExpanded = !!expandedCompletedDays[day.date];

                return (
                  <div
                    key={day.date}
                    className={`relative h-full ${
                      isToday
                        ? 'bg-rose-500/[0.02] dark:bg-rose-500/[0.03]'
                        : isPast
                        ? 'bg-slate-50/30 dark:bg-slate-950/20'
                        : ''
                    }`}
                  >
                    {/* Clickable Hour Slots to add task */}
                    {HOURS.map((hour) => (
                      <div
                        key={hour}
                        onClick={() => onAddTaskForDay(day.date, hour)}
                        className="absolute left-0 right-0 cursor-pointer group/slot hover:bg-slate-100/40 dark:hover:bg-slate-800/20 transition-colors"
                        style={{ top: `${hour * HOUR_HEIGHT}px`, height: `${HOUR_HEIGHT}px` }}
                        title={`Nhấn để thêm nhiệm vụ vào lúc ${String(hour).padStart(2, '0')}:00 ngày ${day.day_name}`}
                      >
                        <span className="opacity-0 group-hover/slot:opacity-100 text-[9px] text-slate-400 pl-1.5 pt-0.5 block font-medium select-none">
                          + {String(hour).padStart(2, '0')}:00
                        </span>
                      </div>
                    ))}

                    {/* 1. FIXED SCHEDULES with OVERLAID TASKS (THỂ HIỆN ĐÈ LÊN LỊCH) */}
                    {processedSchedules.map((item) => {
                      const occ = item.occ;
                      const attachedTasks = scheduleTaskMap[occ.fixed_schedule_id] || [];
                      const pendingAttached = attachedTasks.filter((t) => t.status !== 'COMPLETED');
                      const completedAttached = attachedTasks.filter((t) => t.status === 'COMPLETED');
                      const displayedAttached = isCompletedExpanded ? attachedTasks : pendingAttached;

                      const colWidthPct = 100 / item.totalCols;
                      const colLeftPct = item.colIndex * colWidthPct;

                      // Ensure adequate height if multiple tasks are overlaid
                      const cardMinHeight = Math.max(
                        item.height,
                        displayedAttached.length > 0 ? 46 + displayedAttached.length * 44 : 36
                      );

                      return (
                        <div
                          key={item.id}
                          onClick={() => onEditSchedule && onEditSchedule(occ.fixed_schedule_id)}
                          className="absolute rounded-xl p-2 border shadow-xs transition-all overflow-hidden z-10 group hover:z-30 hover:shadow-md cursor-pointer"
                          style={{
                            top: `${item.top}px`,
                            height: `${cardMinHeight}px`,
                            left: `calc(${colLeftPct}% + 1px)`,
                            width: `calc(${colWidthPct}% - 2px)`,
                            backgroundColor: `${occ.color}15`,
                            borderColor: `${occ.color}60`,
                            borderLeftWidth: '3.5px',
                            borderLeftColor: occ.color,
                          }}
                        >
                          {/* Schedule Header: Title & Time */}
                          <div className="flex items-start justify-between gap-1 text-[11px] font-bold text-slate-800 dark:text-slate-100 leading-tight">
                            <span className="truncate flex items-center gap-1 min-w-0">
                              <span className="text-xs shrink-0">{occ.icon || '📌'}</span>
                              <span className="truncate">{occ.title}</span>
                            </span>
                            <span
                              className="font-mono text-[9px] px-1 py-0.2 rounded font-semibold shrink-0"
                              style={{
                                color: occ.color,
                                backgroundColor: `${occ.color}25`,
                              }}
                            >
                              {occ.start_time} - {occ.end_time}
                            </span>
                          </div>

                          {/* Schedule details: Course, location */}
                          {occ.course_title && (
                            <div className="flex items-center gap-1 mt-1">
                              <span className="inline-flex items-center gap-0.5 px-1 py-0.2 rounded bg-emerald-500/15 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 font-semibold text-[8.5px] truncate max-w-full">
                                <span>📚 {occ.course_title}</span>
                              </span>
                            </div>
                          )}

                          {occ.location && (
                            <div className="flex items-center gap-1 text-[9px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                              <MapPin className="w-2.5 h-2.5 text-slate-400 shrink-0" />
                              <span className="truncate">{occ.location}</span>
                            </div>
                          )}

                          {/* OVERLAID TASKS SECTION ("THỂ HIỆN ĐÈ LÊN LỊCH") */}
                          {attachedTasks.length > 0 && (
                            <div className="mt-1.5 pt-1.5 border-t border-slate-200/60 dark:border-slate-700/60 space-y-1">
                              <div className="flex items-center justify-between text-[9px] font-bold text-indigo-700 dark:text-indigo-300">
                                <span className="flex items-center gap-0.5">
                                  <Zap className="w-2.5 h-2.5 text-amber-500 fill-amber-500 shrink-0" />
                                  <span>Nhiệm vụ ({completedAttached.length}/{attachedTasks.length})</span>
                                </span>
                                {completedAttached.length > 0 && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      toggleDayCompleted(day.date);
                                    }}
                                    className="text-[8px] text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-300 underline"
                                  >
                                    {isCompletedExpanded ? 'Ẩn xong' : `+${completedAttached.length} xong`}
                                  </button>
                                )}
                              </div>

                              <div className="space-y-1">
                                {displayedAttached.map((t) => renderTaskCard(t, true))}
                                {pendingAttached.length === 0 && !isCompletedExpanded && (
                                  <div className="text-center py-0.5 text-[8.5px] text-emerald-600 dark:text-emerald-400 italic">
                                    ✓ Đã xong ({completedAttached.length})
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {/* 2. STANDALONE TIMED TASKS (KHÔNG ĐÍNH KÈM LỊCH) */}
                    {processedTimedTasks.map((item) => {
                      const isDone = item.task.status === 'COMPLETED';
                      if (isDone && !isCompletedExpanded) return null;

                      const colWidthPct = 100 / item.totalCols;
                      const colLeftPct = item.colIndex * colWidthPct;

                      return (
                        <div
                          key={item.id}
                          className="absolute z-20"
                          style={{
                            top: `${item.top}px`,
                            height: `${item.height}px`,
                            left: `calc(${colLeftPct}% + 1px)`,
                            width: `calc(${colWidthPct}% - 2px)`,
                          }}
                        >
                          {renderTaskCard(item.task, false)}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>

            {/* D. BIG RED/ROSE HORIZONTAL TIME NEEDLE (THANH THỜI GIAN LỚN CHẠY NGANG TUẦN) */}
            {isCurrentWeek && (
              <div
                className="absolute left-0 right-0 z-30 pointer-events-none flex items-center transition-all duration-1000 ease-linear"
                style={{ top: `${timeNeedleTop}px` }}
              >
                {/* Left Gutter Needle Badge */}
                <div className="w-[54px] pr-1 flex items-center justify-end">
                  <span className="bg-rose-500 text-white font-mono text-[9px] font-bold px-1 py-0.5 rounded shadow-md shadow-rose-500/50 flex items-center gap-0.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                    {currentTimeLabel}
                  </span>
                </div>

                {/* Full-width glowing bar spanning across 7 columns */}
                <div className="flex-1 relative flex items-center">
                  <div className="w-full border-t-2 border-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.9)]" />

                  {/* Prominent beacon on Today's column */}
                  {computedDays.map(({ day }, colIdx) => {
                    if (!day.is_today && day.date !== todayStr) return null;
                    const leftColPct = (colIdx / 7) * 100;
                    const centerColPct = leftColPct + 100 / 14;

                    return (
                      <div
                        key={day.date}
                        className="absolute flex items-center justify-center -top-2"
                        style={{ left: `${centerColPct}%`, transform: 'translateX(-50%)' }}
                      >
                        <span className="w-4 h-4 rounded-full bg-rose-500/30 animate-ping absolute" />
                        <span className="w-3 h-3 rounded-full bg-rose-500 ring-2 ring-white dark:ring-slate-900 shadow-md flex items-center justify-center" />
                        <span className="absolute -top-4 font-mono text-[8px] font-extrabold px-1 rounded bg-rose-600 text-white shadow-xs">
                          Hiện tại
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
