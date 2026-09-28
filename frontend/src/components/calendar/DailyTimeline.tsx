import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  ChevronLeft, ChevronRight, Calendar as CalendarIcon, ArrowLeft,
  CheckCircle2, Plus, Flame, Clock, MapPin, StickyNote, Trash2,
  Sparkles, CheckSquare, Layers, AlertCircle, Flag, Maximize2, Minimize2,
  Zap, Split, Edit2, CornerDownRight
} from 'lucide-react';
import {
  CalendarDayView, Task, CalendarNote, ScheduleOccurrenceView,
  PRIORITY_CONFIG, DIFFICULTY_CONFIG, PriorityLevel
} from '../../types';
import { getDeadlineInfo } from '../../utils/taskDeadlines';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { toLocalDateString } from '../../utils/dateUtils';

interface DailyTimelineProps {
  data: CalendarDayView | null;
  dateStr: string;
  onBackToWeek: () => void;
  onPrevDay: () => void;
  onNextDay: () => void;
  onToday: () => void;
  onTaskClick: (task: Task) => void;
  onToggleTask: (task: Task) => void;
  onAddTask: (dateStr: string, hour?: number) => void;
  onQuickAddTask?: (dateStr: string, title: string) => Promise<void>;
  onDeleteTask?: (task: Task) => void;
  onEditSchedule?: (scheduleId: number) => void;
  onDeleteSchedule?: (scheduleId: number, title: string) => void;
  onAddSchedule: () => void;
  onAddTaskToSchedule?: (scheduleId: number, dateStr: string, startTime: string, endTime: string) => void;
  onAddNote: (dateStr: string, content: string) => Promise<void>;
  onDeleteNote: (noteId: number) => Promise<void>;
}

const HOUR_HEIGHT = 68; // px per hour (60 mins)
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
 * Robust Interval Clustering & Graph-Coloring Column Layout Algorithm.
 * Partitions overlapping intervals into visual side-by-side columns cleanly.
 */
function computeOverlapLayout<T extends LayoutItem>(items: T[]): Array<T & { colIndex: number; totalCols: number; hasConflict: boolean }> {
  if (items.length === 0) return [];

  // Sort by startMin asc, then longer duration first
  const sorted = [...items].sort((a, b) => a.startMin - b.startMin || (b.endMin - b.startMin) - (a.endMin - a.startMin));

  // 1. Group into connected overlapping clusters
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

  // 2. For each cluster, greedily assign columns
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

export const DailyTimeline: React.FC<DailyTimelineProps> = ({
  data,
  dateStr,
  onBackToWeek,
  onPrevDay,
  onNextDay,
  onToday,
  onTaskClick,
  onToggleTask,
  onAddTask,
  onQuickAddTask,
  onDeleteTask,
  onEditSchedule,
  onDeleteSchedule,
  onAddSchedule,
  onAddTaskToSchedule,
  onAddNote,
  onDeleteNote,
}) => {
  const [currentTime, setCurrentTime] = useState<Date>(new Date());
  const [noteInput, setNoteInput] = useState('');
  const [isAddingNote, setIsAddingNote] = useState(false);
  const [quickTaskInput, setQuickTaskInput] = useState('');
  const [isSubmittingQuickTask, setIsSubmittingQuickTask] = useState(false);
  const [isWideMode, setIsWideMode] = useState<boolean>(() => {
    return localStorage.getItem('routify_timeline_wide') === 'true';
  });
  const [scheduleLaneRatio, setScheduleLaneRatio] = useState<number>(38); // 38% schedules, 62% tasks
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const toggleWideMode = () => {
    setIsWideMode((prev) => {
      const next = !prev;
      localStorage.setItem('routify_timeline_wide', String(next));
      return next;
    });
  };

  const handleQuickSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickTaskInput.trim() || isSubmittingQuickTask) return;
    try {
      setIsSubmittingQuickTask(true);
      if (onQuickAddTask) {
        await onQuickAddTask(dateStr, quickTaskInput.trim());
        setQuickTaskInput('');
      }
    } finally {
      setIsSubmittingQuickTask(false);
    }
  };

  // Real-time clock updating every 30 seconds for the time needle
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  const todayStr = toLocalDateString();
  const isToday = dateStr === todayStr;
  const isPast = dateStr < todayStr;

  // Auto-scroll to current hour on load if looking at today
  useEffect(() => {
    if (scrollContainerRef.current) {
      if (isToday) {
        const currentH = new Date().getHours();
        const targetScroll = Math.max(0, (currentH - 1) * HOUR_HEIGHT);
        scrollContainerRef.current.scrollTop = targetScroll;
      } else {
        // Scroll to 07:00 morning
        scrollContainerRef.current.scrollTop = 7 * HOUR_HEIGHT;
      }
    }
  }, [dateStr, isToday]);

  const handleSaveNote = async () => {
    if (noteInput.trim()) {
      await onAddNote(dateStr, noteInput.trim());
      setNoteInput('');
      setIsAddingNote(false);
    }
  };

  const formatDisplayDate = (iso: string) => {
    try {
      const d = new Date(iso + 'T00:00:00');
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      const dayNames = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
      const dayName = dayNames[d.getDay()];
      return { dayName, formattedDate: `${day}/${month}/${year}` };
    } catch {
      return { dayName: '', formattedDate: iso };
    }
  };

  const { dayName, formattedDate } = formatDisplayDate(dateStr);

  // Time needle calculation
  const currentMinutes = currentTime.getHours() * 60 + currentTime.getMinutes();
  const timeNeedleTop = (currentMinutes / 60) * HOUR_HEIGHT;
  const currentTimeLabel = `${String(currentTime.getHours()).padStart(2, '0')}:${String(
    currentTime.getMinutes()
  ).padStart(2, '0')}`;

  // Helper to parse "HH:MM" into minutes
  const parseTimeToMinutes = (timeStr: string) => {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + (minutes || 0);
  };

  // Split tasks into timed tasks (mapped to 24h timeline) vs all-day / unscheduled tasks
  const { rawTimedTasks, allDayTasks } = useMemo(() => {
    if (!data || !data.tasks) return { rawTimedTasks: [], allDayTasks: [] };

    const timed: Array<{
      task: Task;
      startMin: number;
      endMin: number;
      top: number;
      height: number;
      timeLabel: string;
    }> = [];
    const allDay: Task[] = [];

    data.tasks.forEach((t) => {
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

        const dueTimeFormatted = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;

        if (sMin >= 0) {
          eMin = dueMin > sMin ? dueMin : sMin + 45;
          const startTimeFormatted = `${String(Math.floor(sMin / 60)).padStart(2, '0')}:${String(sMin % 60).padStart(2, '0')}`;
          timeLabel = `${startTimeFormatted} - ${dueTimeFormatted}`;
        } else if (hasTime) {
          eMin = dueMin;
          sMin = Math.max(0, dueMin - 45);
          timeLabel = `Hạn: ${dueTimeFormatted}`;
        }
      } else if (sMin >= 0) {
        eMin = sMin + 45;
        const startTimeFormatted = `${String(Math.floor(sMin / 60)).padStart(2, '0')}:${String(sMin % 60).padStart(2, '0')}`;
        timeLabel = `${startTimeFormatted} - ${String(Math.floor(eMin / 60)).padStart(2, '0')}:${String(eMin % 60).padStart(2, '0')}`;
      }

      if (hasTime && sMin >= 0 && eMin >= 0) {
        const durationMin = Math.max(eMin - sMin, 32);
        const top = (sMin / 60) * HOUR_HEIGHT;
        const height = (durationMin / 60) * HOUR_HEIGHT;
        timed.push({
          task: t,
          startMin: sMin,
          endMin: eMin,
          top,
          height,
          timeLabel,
        });
      } else {
        allDay.push(t);
      }
    });

    return { rawTimedTasks: timed, allDayTasks: allDay };
  }, [data?.tasks]);

  const hasSchedules = (data?.fixed_schedules.length || 0) > 0;
  const hasTimedTasks = rawTimedTasks.length > 0;

  // 1. Overlap layout calculation for Fixed Schedules
  const processedSchedules = useMemo(() => {
    if (!data || !data.fixed_schedules) return [];
    const items = data.fixed_schedules.map((occ, idx) => {
      const sMin = parseTimeToMinutes(occ.start_time);
      const eMin = parseTimeToMinutes(occ.end_time);
      const durationMin = Math.max(eMin - sMin, 25);
      const top = (sMin / 60) * HOUR_HEIGHT;
      const height = (durationMin / 60) * HOUR_HEIGHT;
      return {
        id: `sched-${idx}-${occ.fixed_schedule_id}`,
        occ,
        startMin: sMin,
        endMin: Math.max(eMin, sMin + 25),
        top,
        height,
      };
    });
    return computeOverlapLayout(items);
  }, [data?.fixed_schedules]);

  // 2. Overlap layout calculation for Timed Tasks
  const processedTasks = useMemo(() => {
    const items = rawTimedTasks.map((item) => ({
      id: `task-${item.task.id}`,
      task: item.task,
      startMin: item.startMin,
      endMin: item.endMin,
      top: item.top,
      height: item.height,
      timeLabel: item.timeLabel,
    }));
    return computeOverlapLayout(items);
  }, [rawTimedTasks]);

  return (
    <div className="flex flex-col h-full space-y-4 animate-in fade-in duration-200">
      {/* 1. Header Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 shadow-xs">
        {/* Left: Back to Week + Date Heading */}
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={onBackToWeek}
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Quay lại Lịch Tuần</span>
          </Button>

          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-slate-900 dark:text-slate-100">
              {dayName}, {formattedDate}
            </span>

            {isToday && (
              <Badge variant="default" className="bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                Hôm nay
              </Badge>
            )}
            {isPast && (
              <Badge variant="secondary">
                Đã xong
              </Badge>
            )}
          </div>
        </div>

        {/* Center: Prev/Today/Next Day navigation */}
        <div className="flex items-center gap-1.5">
          <Button
            variant="outline"
            size="icon"
            onClick={onPrevDay}
            title="Ngày trước"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button
            variant={isToday ? 'primary' : 'outline'}
            size="sm"
            onClick={onToday}
          >
            Hôm nay
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={onNextDay}
            title="Ngày sau"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>

        {/* Right: Actions & Layout Mode Toggle */}
        <div className="flex items-center gap-2">
          {/* Horizontal Wide View Toggle */}
          <Button
            variant={isWideMode ? 'primary' : 'outline'}
            size="sm"
            onClick={toggleWideMode}
            className="hidden sm:inline-flex items-center gap-1.5"
            title={isWideMode ? "Thu gọn về dạng chia cột với Sidebar" : "Mở rộng biểu đồ theo chiều ngang tối đa (100% màn hình)"}
          >
            {isWideMode ? (
              <>
                <Minimize2 className="w-3.5 h-3.5" />
                <span>Chia cột</span>
              </>
            ) : (
              <>
                <Maximize2 className="w-3.5 h-3.5" />
                <span>Mở rộng ngang</span>
              </>
            )}
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={() => onAddTask(dateStr)}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Thêm nhiệm vụ</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onAddSchedule}
          >
            <Plus className="w-3.5 h-3.5 text-neutral-600 dark:text-neutral-400" />
            <span>Tạo Lịch cố định</span>
          </Button>
        </div>
      </div>

      {/* 2. Day Summary Stats Bar */}
      {data && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 flex items-center justify-between shadow-xs">
            <div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Nhiệm vụ hoàn thành</div>
              <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                {data.stats.completed} <span className="text-xs text-slate-400 dark:text-slate-500 font-normal">/ {data.stats.total} tasks</span>
              </div>
            </div>
            <div className="w-9 h-9 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 flex items-center justify-between shadow-xs">
            <div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Thời gian rảnh ước tính</div>
              <div className="text-lg font-bold text-neutral-900 dark:text-neutral-100 font-mono">
                {data.free_time_hours} <span className="text-xs text-slate-400 dark:text-slate-500 font-normal">giờ</span>
              </div>
            </div>
            <div className="w-9 h-9 rounded-lg bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 flex items-center justify-center text-neutral-800 dark:text-neutral-200">
              <Clock className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 flex items-center justify-between shadow-xs">
            <div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Chậm trễ / Một phần</div>
              <div className="text-lg font-bold text-amber-600 dark:text-amber-400 font-mono">
                {data.stats.delayed + data.stats.partial} <span className="text-xs text-slate-400 dark:text-slate-500 font-normal">tasks</span>
              </div>
            </div>
            <div className="w-9 h-9 rounded-lg bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 flex items-center justify-center text-amber-600 dark:text-amber-400">
              <AlertCircle className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 flex items-center justify-between shadow-xs">
            <div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Lịch cố định chiếm chỗ</div>
              <div className="text-lg font-bold text-slate-900 dark:text-slate-200 font-mono">
                {data.fixed_schedules.length} <span className="text-xs text-slate-400 dark:text-slate-500 font-normal">sự kiện</span>
              </div>
            </div>
            <div className="w-9 h-9 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-500 dark:text-slate-400">
              <CalendarIcon className="w-5 h-5" />
            </div>
          </div>
        </div>
      )}

      {/* 3. Main Split or Wide View */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 flex-1">
        {/* Left Column: 24-Hour Visual Timeline (8 or 12 cols in Wide View) */}
        <div className={`${isWideMode ? 'lg:col-span-12' : 'lg:col-span-8'} bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex flex-col min-h-[620px] shadow-xs transition-all duration-300`}>
          <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800 mb-2">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-neutral-900 dark:text-neutral-100" />
              <span className="font-bold text-slate-900 dark:text-slate-200 text-xs uppercase tracking-wider">
                Trục thời gian 24h & Nhiệm vụ trong ngày
              </span>
            </div>
            {isToday && (
              <span className="text-[11px] text-rose-600 dark:text-rose-400 font-medium flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                Kim chỉ giờ thực tế: <strong className="font-mono">{currentTimeLabel}</strong>
              </span>
            )}
          </div>

          {/* All-Day / Unscheduled Tasks strip */}
          {allDayTasks.length > 0 && (
            <div className="mb-3 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
              <div className="flex items-center justify-between mb-1.5 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                <span className="flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-neutral-600 dark:text-neutral-400" />
                  Nhiệm vụ cả ngày ({allDayTasks.length})
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {allDayTasks.map((t) => {
                  const isDone = t.status === 'COMPLETED';
                  const isTransferred = Boolean(
                    t.transferred_from_id ||
                    t.transferred_to_id ||
                    t.transferred_from_title ||
                    t.status === 'TRANSFERRED'
                  );
                  const deadline = getDeadlineInfo(t.due_datetime, t.status);
                  const pCfg = PRIORITY_CONFIG[(t.priority as PriorityLevel)] || PRIORITY_CONFIG.MEDIUM;
                  return (
                    <div
                      key={t.id}
                      onClick={() => onTaskClick(t)}
                      className={`group flex items-center gap-2 px-2.5 py-1 rounded-lg border text-xs cursor-pointer transition shadow-2xs ${
                        isDone
                          ? 'bg-slate-100 dark:bg-slate-900/60 text-slate-400 border-slate-200 dark:border-slate-800 line-through'
                          : isTransferred
                          ? 'bg-purple-50/80 dark:bg-purple-950/40 text-purple-950 dark:text-purple-100 border-purple-300 dark:border-purple-800 border-l-[3.5px] border-l-purple-500 ring-1 ring-purple-400/20'
                          : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:border-neutral-900 dark:hover:border-neutral-100'
                      }`}
                    >
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleTask(t);
                        }}
                        className="text-slate-400 hover:text-emerald-500"
                        title={
                          t.status === 'TRANSFERRED'
                            ? 'Nhiệm vụ đã chuyển tiếp sang thời điểm khác'
                            : isDone
                            ? 'Đánh dấu chưa xong'
                            : 'Đánh dấu xong'
                        }
                      >
                        {isDone ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                        ) : t.status === 'TRANSFERRED' ? (
                          <div className="w-3.5 h-3.5 rounded flex items-center justify-center bg-purple-100 dark:bg-purple-900/80 text-purple-700 dark:text-purple-300 border border-purple-300 dark:border-purple-700 shadow-2xs">
                            <CornerDownRight className="w-2.5 h-2.5 stroke-[2.5]" />
                          </div>
                        ) : (
                          <div className="w-3.5 h-3.5 rounded border border-slate-300 dark:border-slate-600 hover:border-emerald-500" />
                        )}
                      </button>
                      <span className="font-medium truncate max-w-[200px]">{t.title}</span>
                      {isTransferred && (
                        <span
                          title="Nhiệm vụ chuyển tiếp"
                          className="text-[9px] px-1.5 py-0.2 rounded font-extrabold border bg-purple-100 text-purple-800 dark:bg-purple-900/80 dark:text-purple-200 border-purple-300 dark:border-purple-700 flex items-center gap-0.5 shadow-2xs shrink-0"
                        >
                          <CornerDownRight className="w-2.5 h-2.5 stroke-[2.5]" />
                          <span>Chuyển tiếp</span>
                        </span>
                      )}
                      <span className={`text-[9px] px-1.5 py-0.2 rounded font-semibold border ${pCfg.badgeBg} ${pCfg.textColor} ${pCfg.borderColor}`}>
                        {pCfg.shortLabel}
                      </span>
                      {deadline.hasDeadline && (
                        <span className={`text-[9px] px-1.5 py-0.2 rounded border font-semibold ${deadline.badgeClass}`}>
                          {deadline.shortText}
                        </span>
                      )}
                      {t.course_title && (
                        <span
                          className="text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 px-1.5 py-0.2 rounded text-[9px] font-medium truncate max-w-[130px]"
                          title={`Khóa học: ${t.course_title}`}
                        >
                          📚 {t.course_title}
                        </span>
                      )}
                      {t.scheduled_with_fixed_title && (
                        <span
                          className="text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 px-1.5 py-0.2 rounded text-[9px] font-medium truncate max-w-[120px]"
                          title={`Đính kèm theo lịch: ${t.scheduled_with_fixed_title}`}
                        >
                          📌 {t.scheduled_with_fixed_title}
                        </span>
                      )}
                      {onDeleteTask && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteTask(t);
                          }}
                          className="text-slate-400 hover:text-rose-500 transition p-0.5 rounded opacity-0 group-hover:opacity-100 ml-1"
                          title="Xóa nhiệm vụ này"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Dual-lane Legend & Proportion Controls */}
          {hasSchedules && hasTimedTasks && (
            <div className="flex flex-wrap items-center justify-between text-[11px] font-bold text-slate-500 dark:text-slate-400 px-3 py-1.5 mb-2 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800/60 gap-2">
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                  <CalendarIcon className="w-3.5 h-3.5 text-neutral-600 dark:text-neutral-400" />
                  Làn Lịch cố định ({data?.fixed_schedules.length})
                </span>
                <span className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                  <CheckSquare className="w-3.5 h-3.5 text-emerald-500" />
                  Làn Nhiệm vụ ({rawTimedTasks.length})
                </span>
              </div>

              {/* Lane Proportion Selector */}
              <div className="flex items-center gap-1.5 text-[10px]">
                <span className="text-slate-400 font-normal">Tỉ lệ làn:</span>
                <button
                  onClick={() => setScheduleLaneRatio(35)}
                  className={`px-2 py-0.5 rounded font-mono transition ${
                    scheduleLaneRatio === 35
                      ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 font-bold shadow-2xs'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                  title="Ưu tiên không gian rộng cho Nhiệm vụ (35% Lịch / 65% Việc)"
                >
                  35 / 65
                </button>
                <button
                  onClick={() => setScheduleLaneRatio(50)}
                  className={`px-2 py-0.5 rounded font-mono transition ${
                    scheduleLaneRatio === 50
                      ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 font-bold shadow-2xs'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                  title="Chia đều 50% Lịch / 50% Việc"
                >
                  50 / 50
                </button>
                <button
                  onClick={() => setScheduleLaneRatio(65)}
                  className={`px-2 py-0.5 rounded font-mono transition ${
                    scheduleLaneRatio === 65
                      ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 font-bold shadow-2xs'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                  title="Ưu tiên không gian rộng cho Lịch cố định (65% Lịch / 35% Việc)"
                >
                  65 / 35
                </button>
              </div>
            </div>
          )}

          {/* Scrollable Timeline Grid */}
          <div
            ref={scrollContainerRef}
            className="flex-1 overflow-y-auto max-h-[640px] relative rounded-xl border border-slate-200 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-950/40 select-none"
          >
            <div className="relative" style={{ height: `${24 * HOUR_HEIGHT}px` }}>
              {/* Hour Rows Background Grid */}
              {HOURS.map((hour) => (
                <div
                  key={hour}
                  className="absolute left-0 right-0 flex items-start"
                  style={{ top: `${hour * HOUR_HEIGHT}px`, height: `${HOUR_HEIGHT}px` }}
                >
                  {/* Hour text */}
                  <span className="w-14 text-right pr-3 -mt-2.5 font-mono text-[11px] font-bold text-slate-400 dark:text-slate-500 shrink-0 select-none">
                    {String(hour).padStart(2, '0')}:00
                  </span>

                  {/* Clickable hour slot */}
                  <div
                    onClick={() => onAddTask(dateStr, hour)}
                    className="flex-1 relative border-t border-slate-200 dark:border-slate-800/60 h-full group/hour cursor-pointer hover:bg-slate-100/50 dark:hover:bg-slate-800/25 transition-colors"
                    title={`Nhấn để thêm task vào lúc ${String(hour).padStart(2, '0')}:00`}
                  >
                    {/* 30-minute dashed guideline */}
                    <div
                      className="absolute left-0 right-0 border-t border-dashed border-slate-200/40 dark:border-slate-800/30 pointer-events-none"
                      style={{ top: `${HOUR_HEIGHT / 2}px` }}
                    />
                    <span className="opacity-0 group-hover/hour:opacity-100 text-[10px] text-slate-400 dark:text-slate-500 pl-2 pt-0.5 font-medium transition select-none">
                      + Thêm việc {String(hour).padStart(2, '0')}:00
                    </span>
                  </div>
                </div>
              ))}

              {/* Events Placement Canvas (offset by hour gutter: left-14, right-2) */}
              <div className="absolute top-0 bottom-0 left-14 right-2 pointer-events-none">
                {/* 1. FIXED SCHEDULES LANE */}
                {hasSchedules && (
                  <div
                    className="absolute top-0 bottom-0 pointer-events-auto transition-all duration-200"
                    style={{
                      left: '0%',
                      width: hasTimedTasks ? `${scheduleLaneRatio}%` : '100%',
                    }}
                  >
                    {processedSchedules.map((item) => {
                      const occ = item.occ;
                      const colWidthPct = 100 / item.totalCols;
                      const colLeftPct = item.colIndex * colWidthPct;
                      const attachedTasks = (data?.tasks || []).filter(
                        (t) => t.scheduled_with_fixed_id === occ.fixed_schedule_id
                      );

                      return (
                        <div
                          key={item.id}
                          onClick={() => onEditSchedule && onEditSchedule(occ.fixed_schedule_id)}
                          className="absolute rounded-xl p-2.5 border shadow-xs transition-all overflow-hidden z-10 group hover:z-30 hover:shadow-md cursor-pointer"
                          style={{
                            top: `${item.top}px`,
                            height: `${item.height}px`,
                            left: `calc(${colLeftPct}% + 2px)`,
                            width: `calc(${colWidthPct}% - 4px)`,
                            backgroundColor: `${occ.color}15`,
                            borderColor: `${occ.color}60`,
                            borderLeftWidth: '4px',
                            borderLeftColor: occ.color,
                          }}
                        >
                          <div className="flex items-start justify-between gap-1 text-xs font-bold text-slate-800 dark:text-slate-100 leading-tight">
                            <span className="truncate flex items-center gap-1.5 flex-1 min-w-0">
                              <span className="text-sm shrink-0">{occ.icon || '📌'}</span>
                              <span className="truncate">{occ.title}</span>
                            </span>

                            <div className="flex items-center gap-1 shrink-0">
                              {item.hasConflict && (
                                <span className="text-[9px] px-1 py-0.2 rounded font-mono font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300" title="Trùng giờ với lịch khác">
                                  ⚡
                                </span>
                              )}
                              <span
                                className="font-mono text-[10px] px-1.5 py-0.5 rounded font-semibold"
                                style={{ color: occ.color, backgroundColor: `${occ.color}25` }}
                              >
                                {occ.start_time} - {occ.end_time}
                              </span>
                              {onAddTaskToSchedule && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onAddTaskToSchedule(occ.fixed_schedule_id, dateStr, occ.start_time, occ.end_time);
                                  }}
                                  className="text-slate-500 hover:text-emerald-600 dark:text-slate-400 dark:hover:text-emerald-400 p-0.5 rounded transition flex items-center gap-0.5 bg-white/70 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 text-[10px] px-1 py-0.5 opacity-0 group-hover:opacity-100"
                                  title="Thêm nhiệm vụ vào khung giờ lịch này"
                                >
                                  <Plus className="w-3 h-3" />
                                  <span className="hidden sm:inline font-medium">Việc</span>
                                </button>
                              )}
                              {onEditSchedule && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onEditSchedule(occ.fixed_schedule_id);
                                  }}
                                  className="text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition p-0.5 rounded opacity-0 group-hover:opacity-100"
                                  title="Chỉnh sửa lịch cố định"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                              {onDeleteSchedule && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onDeleteSchedule(occ.fixed_schedule_id, occ.title);
                                  }}
                                  className="text-slate-400 hover:text-rose-500 transition p-0.5 rounded opacity-0 group-hover:opacity-100"
                                  title="Xóa lịch cố định này"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </div>

                          {occ.course_title && (
                            <div className="flex items-center gap-1 mt-1">
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 font-semibold text-[10px] truncate max-w-full">
                                <span>📚 {occ.course_title}</span>
                                {occ.course_node_title && (
                                  <span className="opacity-75 font-normal truncate"> • {occ.course_node_title}</span>
                                )}
                              </span>
                            </div>
                          )}

                          {occ.location && (
                            <div className="flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                              <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                              <span className="truncate">{occ.location}</span>
                            </div>
                          )}

                          {occ.description && (
                            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1 italic">
                              {occ.description}
                            </div>
                          )}

                          <div className="mt-1 flex items-center gap-2 text-[10px] text-slate-500 dark:text-slate-400 flex-wrap">
                            <span className="uppercase tracking-wider font-semibold">{occ.category}</span>
                            {occ.is_overridden && (
                              <span className="text-amber-600 dark:text-amber-400 font-bold">[Giờ điều chỉnh]</span>
                            )}
                          </div>

                          {/* Attached Tasks mini-list inside Fixed Schedule */}
                          {attachedTasks.length > 0 && (
                            <div className="mt-2 pt-1.5 border-t border-slate-200/60 dark:border-slate-700/60 space-y-1">
                              <div className="flex items-center justify-between text-[10px] font-bold text-slate-600 dark:text-slate-300">
                                <span className="flex items-center gap-1">
                                  <CheckSquare className="w-3 h-3 text-emerald-500" />
                                  Nhiệm vụ ({attachedTasks.filter((t) => t.status === 'COMPLETED').length}/{attachedTasks.length})
                                </span>
                              </div>
                              <div className="space-y-1 max-h-24 overflow-y-auto pr-0.5 pointer-events-auto">
                                {attachedTasks.map((t) => {
                                  const isTransferred = Boolean(
                                    t.transferred_from_id ||
                                    t.transferred_to_id ||
                                    t.transferred_from_title ||
                                    t.status === 'TRANSFERRED'
                                  );
                                  return (
                                    <div
                                      key={t.id}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onTaskClick(t);
                                      }}
                                      className={`flex items-center gap-1.5 p-1 rounded text-[11px] transition cursor-pointer ${
                                        t.status === 'COMPLETED'
                                          ? 'bg-white/80 dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-700/80'
                                          : isTransferred
                                          ? 'bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 border-l-[3px] border-l-purple-500 text-purple-950 dark:text-purple-100'
                                          : 'bg-white/80 dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-700/80 hover:border-emerald-400'
                                      }`}
                                    >
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          onToggleTask(t);
                                        }}
                                        className={`w-3.5 h-3.5 rounded flex items-center justify-center border transition shrink-0 ${
                                          t.status === 'COMPLETED'
                                            ? 'bg-emerald-500 border-emerald-500 text-white'
                                            : t.status === 'TRANSFERRED'
                                            ? 'bg-purple-100 dark:bg-purple-900/80 text-purple-700 dark:text-purple-300 border-purple-300 dark:border-purple-700'
                                            : 'border-slate-300 dark:border-slate-600 hover:border-emerald-500'
                                        }`}
                                      >
                                        {t.status === 'COMPLETED' ? (
                                          <CheckCircle2 className="w-2.5 h-2.5" />
                                        ) : t.status === 'TRANSFERRED' ? (
                                          <CornerDownRight className="w-2 h-2 stroke-[2.5]" />
                                        ) : null}
                                      </button>
                                      <span
                                        className={`truncate flex-1 font-medium ${
                                          t.status === 'COMPLETED'
                                            ? 'line-through text-slate-400 dark:text-slate-500'
                                            : 'text-slate-800 dark:text-slate-200'
                                        }`}
                                      >
                                        {t.title}
                                      </span>
                                      {isTransferred && (
                                        <span className="text-[8.5px] px-1 py-0.2 rounded bg-purple-100 text-purple-800 dark:bg-purple-900/80 dark:text-purple-200 font-bold border border-purple-300 dark:border-purple-700 flex items-center gap-0.5 shrink-0">
                                          <CornerDownRight className="w-2 h-2 stroke-[2.5]" />
                                          <span>Chuyển</span>
                                        </span>
                                      )}
                                      {t.difficulty && (
                                        <span className="text-[9px] font-bold text-amber-500 shrink-0">
                                          ★{t.difficulty}
                                        </span>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Vertical Divider between lanes if both exist */}
                {hasSchedules && hasTimedTasks && (
                  <div
                    className="absolute top-0 bottom-0 border-r border-dashed border-slate-300 dark:border-slate-700/80 pointer-events-none transition-all duration-200"
                    style={{ left: `${scheduleLaneRatio}%` }}
                  />
                )}

                {/* 2. TIMED TASKS LANE */}
                {hasTimedTasks && (
                  <div
                    className="absolute top-0 bottom-0 pointer-events-auto transition-all duration-200"
                    style={{
                      left: hasSchedules ? `calc(${scheduleLaneRatio}% + 4px)` : '0%',
                      width: hasSchedules ? `calc(${100 - scheduleLaneRatio}% - 4px)` : '100%',
                    }}
                  >
                    {processedTasks.map((item) => {
                      const isDone = item.task.status === 'COMPLETED';
                      const isTransferred = Boolean(
                        item.task.transferred_from_id ||
                        item.task.transferred_to_id ||
                        item.task.transferred_from_title ||
                        item.task.status === 'TRANSFERRED'
                      );
                      const pCfg = PRIORITY_CONFIG[(item.task.priority as PriorityLevel)] || PRIORITY_CONFIG.MEDIUM;
                      const dCfg = DIFFICULTY_CONFIG[item.task.difficulty] || DIFFICULTY_CONFIG[2];
                      const deadline = getDeadlineInfo(item.task.due_datetime, item.task.status);

                      const priorityColor = isTransferred
                        ? '#a855f7'
                        : item.task.priority === 'URGENT'
                        ? '#f43f5e'
                        : item.task.priority === 'HIGH'
                        ? '#f59e0b'
                        : item.task.priority === 'MEDIUM'
                        ? '#3b82f6'
                        : '#94a3b8';

                      const colWidthPct = 100 / item.totalCols;
                      const colLeftPct = item.colIndex * colWidthPct;
                      const isSpacious = item.totalCols === 1;

                      return (
                        <div
                          key={item.id}
                          onClick={() => onTaskClick(item.task)}
                          className={`absolute rounded-xl p-2.5 border shadow-xs transition-all cursor-pointer overflow-hidden z-20 group hover:z-30 hover:shadow-md ${
                            isDone
                              ? 'bg-slate-50/90 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 opacity-70'
                              : isTransferred
                              ? 'bg-purple-50/80 dark:bg-purple-950/40 border-purple-300 dark:border-purple-800 text-purple-950 dark:text-purple-100 ring-1 ring-purple-400/20'
                              : 'bg-white dark:bg-slate-850 border-slate-200 dark:border-slate-700 hover:border-neutral-900 dark:hover:border-neutral-100'
                          }`}
                          style={{
                            top: `${item.top}px`,
                            height: `${item.height}px`,
                            left: `calc(${colLeftPct}% + 2px)`,
                            width: `calc(${colWidthPct}% - 4px)`,
                            borderLeftWidth: '4px',
                            borderLeftColor: priorityColor,
                          }}
                        >
                          {/* Card Header: Checkbox + Title + Time + Trash */}
                          <div className="flex items-start justify-between gap-1.5 leading-tight">
                            <div className="flex items-start gap-1.5 min-w-0 flex-1">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onToggleTask(item.task);
                                }}
                                className="mt-0.5 text-slate-400 hover:text-emerald-500 shrink-0"
                                title={
                                  item.task.status === 'TRANSFERRED'
                                    ? 'Nhiệm vụ đã chuyển tiếp sang thời điểm khác'
                                    : isDone
                                    ? 'Đánh dấu chưa hoàn thành'
                                    : 'Đánh dấu hoàn thành'
                                }
                              >
                                {isDone ? (
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                                ) : item.task.status === 'TRANSFERRED' ? (
                                  <div className="w-3.5 h-3.5 rounded flex items-center justify-center bg-purple-100 dark:bg-purple-900/80 text-purple-700 dark:text-purple-300 border border-purple-300 dark:border-purple-700 shadow-2xs">
                                    <CornerDownRight className="w-2.5 h-2.5 stroke-[2.5]" />
                                  </div>
                                ) : (
                                  <div className="w-3.5 h-3.5 rounded border border-slate-300 dark:border-slate-600 hover:border-emerald-500" />
                                )}
                              </button>
                              <span
                                className={`text-xs font-bold truncate ${
                                  isDone ? 'line-through text-slate-400 dark:text-slate-500' : 'text-slate-900 dark:text-slate-100'
                                }`}
                              >
                                {item.task.title}
                              </span>
                            </div>

                            <div className="flex items-center gap-1 shrink-0">
                              {item.hasConflict && (
                                <span
                                  className="text-[9px] px-1 py-0.2 rounded font-mono font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300"
                                  title="Trùng giờ với nhiệm vụ khác"
                                >
                                  ⚡
                                </span>
                              )}
                              <span className="font-mono text-[10px] px-1.5 py-0.5 rounded font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                                {item.timeLabel}
                              </span>
                              {onDeleteTask && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onDeleteTask(item.task);
                                  }}
                                  className="text-slate-400 hover:text-rose-500 transition p-0.5 rounded opacity-0 group-hover:opacity-100"
                                  title="Xóa nhiệm vụ này"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Horizontal Badges Row */}
                          <div className="mt-1.5 flex items-center gap-1 flex-wrap text-[9px]">
                            {/* Transferred Indicator Badge */}
                            {isTransferred && (
                              <span
                                title="Nhiệm vụ chuyển tiếp sang thời điểm mới"
                                className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded font-extrabold border text-[8.5px] bg-purple-100 text-purple-800 dark:bg-purple-900/80 dark:text-purple-200 border-purple-300 dark:border-purple-700 shadow-2xs shrink-0"
                              >
                                <CornerDownRight className="w-2.5 h-2.5 stroke-[2.5]" />
                                <span>Chuyển tiếp</span>
                              </span>
                            )}
                            {/* Deadline Countdown Badge */}
                            {deadline.hasDeadline && (
                              <span
                                title={deadline.text}
                                className={`inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded font-bold border ${deadline.badgeClass}`}
                              >
                                {deadline.isOverdue ? (
                                  <AlertCircle className="w-2.5 h-2.5 shrink-0" />
                                ) : (
                                  <Clock className="w-2.5 h-2.5 shrink-0" />
                                )}
                                <span>{isSpacious ? deadline.text : deadline.shortText}</span>
                              </span>
                            )}

                            {/* Priority Pill */}
                            <span
                              className={`inline-flex items-center gap-0.5 px-1 py-0.2 rounded font-semibold border ${pCfg.badgeBg} ${pCfg.textColor} ${pCfg.borderColor}`}
                              title={`Mức ưu tiên: ${pCfg.label}`}
                            >
                              <Flag className="w-2.5 h-2.5" />
                              <span>{isSpacious ? pCfg.label : pCfg.shortLabel}</span>
                            </span>

                            {/* Difficulty Pill */}
                            <span
                              className={`inline-flex items-center gap-0.5 px-1 py-0.2 rounded font-bold border ${dCfg.bg} ${dCfg.color} ${dCfg.border}`}
                              title={`Độ khó: ${dCfg.label}`}
                            >
                              <Flame className="w-2.5 h-2.5 fill-current" />
                              <span>+{dCfg.points}đ</span>
                            </span>

                            {/* Subtask Progress */}
                            {item.task.subtasks_count > 0 && (
                              <div className="flex items-center gap-1 font-mono text-[9px] px-1 py-0.2 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 border border-neutral-200 dark:border-neutral-700 font-semibold">
                                <span>📋 {item.task.subtasks_completed_count}/{item.task.subtasks_count}</span>
                                {isSpacious && (
                                  <div className="w-8 h-1 bg-neutral-200 dark:bg-neutral-700 rounded-full overflow-hidden">
                                    <div
                                      className="h-full bg-neutral-800 dark:bg-neutral-200 rounded-full"
                                      style={{
                                        width: `${Math.round((item.task.subtasks_completed_count / item.task.subtasks_count) * 100)}%`
                                      }}
                                    />
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Course tag */}
                            {item.task.course_title && (
                              <span className="text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 px-1 py-0.2 rounded truncate max-w-[110px]">
                                📚 {item.task.course_title}
                              </span>
                            )}

                            {/* Fixed Schedule tag */}
                            {item.task.scheduled_with_fixed_title && (
                              <span
                                className="text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 px-1 py-0.2 rounded truncate max-w-[120px] font-medium"
                                title={`Đính kèm theo lịch: ${item.task.scheduled_with_fixed_title}`}
                              >
                                📌 {item.task.scheduled_with_fixed_title}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* RED/ROSE HORIZONTAL TIME NEEDLE (KIM NGANG CHỈ GIỜ HIỆN TẠI) */}
              {isToday && (
                <div
                  className="absolute left-0 right-0 z-30 pointer-events-none flex items-center transition-all duration-1000 ease-linear"
                  style={{ top: `${timeNeedleTop}px` }}
                >
                  <div className="flex items-center pl-1.5">
                    <span className="w-3.5 h-3.5 rounded-full bg-rose-500 ring-4 ring-rose-500/30 animate-pulse -ml-1.5 shadow-lg" />
                    <span className="bg-rose-500 text-white font-mono text-[11px] font-bold px-2 py-0.5 rounded shadow-lg shadow-rose-500/50 -ml-1">
                      {currentTimeLabel}
                    </span>
                  </div>
                  <div className="flex-1 border-t-2 border-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.9)] ml-2 mr-2" />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column or Wide Bottom Section: Day Tasks & Day Notes */}
        <div className={`${isWideMode ? 'lg:col-span-12 grid grid-cols-1 md:grid-cols-2 gap-4' : 'lg:col-span-4 space-y-4'} flex flex-col`}>
          {/* Day Tasks Box */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex-1 flex flex-col shadow-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800 mb-3">
              <div className="flex items-center gap-2">
                <CheckSquare className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span className="font-bold text-slate-900 dark:text-slate-200 text-xs uppercase tracking-wider">
                  Nhiệm vụ trong ngày ({data?.tasks.length || 0})
                </span>
              </div>
              <button
                onClick={() => onAddTask(dateStr)}
                className="text-neutral-900 dark:text-neutral-100 hover:opacity-75 font-bold text-xs transition"
                title="Tạo nhiệm vụ mới"
              >
                + Thêm
              </button>
            </div>

            {/* Inline Quick Add Task input */}
            <form onSubmit={handleQuickSubmit} className="flex items-center gap-1.5 mb-3">
              <input
                type="text"
                value={quickTaskInput}
                onChange={(e) => setQuickTaskInput(e.target.value)}
                placeholder="+ Thêm việc nhanh (nhập & Enter)..."
                className="flex-1 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-neutral-900 dark:focus:ring-neutral-100"
              />
              <button
                type="submit"
                disabled={!quickTaskInput.trim() || isSubmittingQuickTask}
                className="px-2.5 py-1.5 bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 rounded-lg text-xs font-semibold disabled:opacity-40 hover:opacity-90 transition shrink-0"
              >
                {isSubmittingQuickTask ? '...' : 'Thêm'}
              </button>
            </form>

            <div className={`space-y-2 overflow-y-auto ${isWideMode ? 'max-h-[300px]' : 'max-h-[360px]'} flex-1`}>
              {!data || data.tasks.length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-400 dark:text-slate-500">
                  Không có nhiệm vụ nào cho ngày này
                </div>
              ) : (
                data.tasks.map((t) => {
                  const isDone = t.status === 'COMPLETED';
                  const isTransferred = Boolean(
                    t.transferred_from_id ||
                    t.transferred_to_id ||
                    t.transferred_from_title ||
                    t.status === 'TRANSFERRED'
                  );
                  const pCfg = PRIORITY_CONFIG[(t.priority as PriorityLevel)] || PRIORITY_CONFIG.MEDIUM;
                  const dCfg = DIFFICULTY_CONFIG[t.difficulty] || DIFFICULTY_CONFIG[2];

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
                      onClick={() => onTaskClick(t)}
                      className={`p-3 rounded-xl border border-l-4 ${priorityBorder} text-xs transition cursor-pointer group ${
                        isDone
                          ? 'bg-slate-50 dark:bg-slate-900/30 border-slate-200 dark:border-slate-800/80 text-slate-400'
                          : isTransferred
                          ? 'bg-purple-50/70 dark:bg-purple-950/30 border-purple-200 dark:border-purple-800/80 text-purple-950 dark:text-purple-100 ring-1 ring-purple-400/20 shadow-2xs'
                          : 'bg-white dark:bg-slate-800/70 border-slate-200 dark:border-slate-700/80 hover:border-neutral-900 dark:hover:border-neutral-100 text-slate-800 dark:text-slate-200 shadow-2xs'
                      }`}
                    >
                      <div className="flex items-start gap-2.5">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onToggleTask(t);
                          }}
                          className="mt-0.5 text-slate-400 hover:text-emerald-500 shrink-0"
                          title={
                            t.status === 'TRANSFERRED'
                              ? 'Nhiệm vụ đã chuyển tiếp sang thời điểm khác'
                              : isDone
                              ? 'Đánh dấu chưa xong'
                              : 'Đánh dấu xong'
                          }
                        >
                          {isDone ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                          ) : t.status === 'TRANSFERRED' ? (
                            <div className="w-4 h-4 rounded flex items-center justify-center bg-purple-100 dark:bg-purple-900/80 text-purple-700 dark:text-purple-300 border border-purple-300 dark:border-purple-700 shadow-2xs">
                              <CornerDownRight className="w-2.5 h-2.5 stroke-[2.5]" />
                            </div>
                          ) : (
                            <div className="w-4 h-4 rounded border border-slate-300 dark:border-slate-600 hover:border-emerald-500" />
                          )}
                        </button>

                        <div className="flex-1 min-w-0">
                          <p
                            className={`font-semibold truncate text-xs ${
                              isDone ? 'line-through text-slate-400 dark:text-slate-500' : 'text-slate-900 dark:text-slate-100'
                            }`}
                          >
                            {t.title}
                          </p>

                          <div className="flex items-center gap-1.5 mt-1.5 text-[11px] text-slate-500 dark:text-slate-400 flex-wrap">
                            {/* Transferred Indicator Pill */}
                            {isTransferred && (
                              <span
                                title="Nhiệm vụ chuyển tiếp sang kỳ/ngày khác"
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-bold text-[10px] bg-purple-100 text-purple-800 dark:bg-purple-900/80 dark:text-purple-200 border border-purple-300 dark:border-purple-700 shadow-2xs"
                              >
                                <CornerDownRight className="w-3 h-3 stroke-[2.5]" />
                                <span>Đã chuyển tiếp</span>
                              </span>
                            )}
                            {/* Priority Pill */}
                            <span
                              title={`Mức ưu tiên: ${pCfg.label} - ${pCfg.description}`}
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border font-semibold text-[10px] ${pCfg.badgeBg} ${pCfg.textColor} ${pCfg.borderColor}`}
                            >
                              <Flag className="w-3 h-3" />
                              <span>{pCfg.label}</span>
                            </span>

                            {/* Difficulty Pill */}
                            <span
                              title={`Độ khó: ${dCfg.label} (+${dCfg.points} điểm tích lũy) - ${dCfg.description}`}
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border font-bold text-[10px] ${dCfg.bg} ${dCfg.color} ${dCfg.border}`}
                            >
                              <Flame className="w-3 h-3 fill-current" />
                              <span>{dCfg.label} (+{dCfg.points}đ)</span>
                            </span>

                            {t.due_datetime && (
                              <span className="font-mono text-slate-500 dark:text-slate-400 px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[10px]">
                                ⏰ {new Date(t.due_datetime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            )}

                            {t.due_datetime && (
                              <span
                                title={`Hạn chót: ${new Date(t.due_datetime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} - ${getDeadlineInfo(t.due_datetime, t.status).text}`}
                                className={`inline-flex items-center gap-1 font-semibold px-2 py-0.5 rounded-md border text-[10px] ${
                                  getDeadlineInfo(t.due_datetime, t.status).badgeClass
                                }`}
                              >
                                {getDeadlineInfo(t.due_datetime, t.status).isOverdue ? (
                                  <AlertCircle className="w-3 h-3 shrink-0" />
                                ) : (
                                  <Clock className="w-3 h-3 shrink-0" />
                                )}
                                <span>{getDeadlineInfo(t.due_datetime, t.status).text}</span>
                              </span>
                            )}

                            {t.subtasks_count > 0 && (
                              <span
                                title={`Tiến độ: ${t.subtasks_completed_count}/${t.subtasks_count} subtasks`}
                                className="text-neutral-800 dark:text-neutral-200 font-medium px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-[10px]"
                              >
                                📋 {t.subtasks_completed_count}/{t.subtasks_count}
                              </span>
                            )}

                            {t.course_title && (
                              <span
                                className="text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800/80 px-2 py-0.5 rounded text-[10px] font-medium truncate max-w-[150px]"
                                title={`Khóa học: ${t.course_title}`}
                              >
                                📚 {t.course_title}
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
                            className="text-slate-400 hover:text-rose-500 transition p-1 rounded opacity-0 group-hover:opacity-100 shrink-0"
                            title="Xóa nhiệm vụ này"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Day Notes Box */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800 mb-3">
              <div className="flex items-center gap-2">
                <StickyNote className="w-4 h-4 text-amber-500 dark:text-amber-400" />
                <span className="font-bold text-slate-900 dark:text-slate-200 text-xs uppercase tracking-wider">
                  Ghi chú trong ngày ({data?.notes.length || 0})
                </span>
              </div>
              {!isAddingNote && (
                <button
                  onClick={() => setIsAddingNote(true)}
                  className="text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 font-bold text-xs transition"
                >
                  + Thêm
                </button>
              )}
            </div>

            {/* Note Input */}
            {isAddingNote && (
              <div className="mb-3 p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-2">
                <textarea
                  autoFocus
                  placeholder="Nhập ghi chú cho ngày này..."
                  value={noteInput}
                  onChange={(e) => setNoteInput(e.target.value)}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded p-2 text-xs text-slate-900 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-neutral-900 dark:focus:ring-neutral-100 resize-none h-16"
                />
                <div className="flex justify-end gap-2 text-xs">
                  <button
                    onClick={() => {
                      setIsAddingNote(false);
                      setNoteInput('');
                    }}
                    className="px-2.5 py-1 rounded text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition"
                  >
                    Hủy
                  </button>
                  <button
                    onClick={handleSaveNote}
                    className="px-3 py-1 bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200 rounded font-semibold shadow-xs"
                  >
                    Lưu ghi chú
                  </button>
                </div>
              </div>
            )}

            {/* Notes List */}
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {!data || data.notes.length === 0 ? (
                <div className="text-center py-4 text-xs text-slate-400 dark:text-slate-500">
                  Chưa có ghi chú nào
                </div>
              ) : (
                data.notes.map((note) => (
                  <div
                    key={note.id}
                    className="p-2.5 rounded-xl bg-amber-50/80 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-900/40 text-xs text-amber-900 dark:text-amber-200 flex items-start justify-between group"
                  >
                    <span className="leading-relaxed">{note.content}</span>
                    <button
                      onClick={() => onDeleteNote(note.id)}
                      className="opacity-0 group-hover:opacity-100 text-amber-600 hover:text-rose-500 transition ml-2"
                      title="Xóa ghi chú"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
