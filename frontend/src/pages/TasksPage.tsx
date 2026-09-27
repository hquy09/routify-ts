import React, { useState, useEffect, useMemo } from 'react';
import {
  Search, Plus, Filter, ArrowUp, ArrowDown,
  LayoutList, LayoutGrid, ChevronDown, ChevronRight,
  Clock, Flame, CheckCircle2, Circle, Target,
  Eye, EyeOff, CornerDownRight, X, Pin, RotateCcw
} from 'lucide-react';
import { TaskCard } from '../components/tasks/TaskCard';
import { TaskRowItem } from '../components/tasks/TaskRowItem';
import { TaskModal } from '../components/tasks/TaskModal';
import { TaskTransferModal } from '../components/tasks/TaskTransferModal';
import { Task, Goal, Course, CountdownItem, PRIORITY_CONFIG, PriorityLevel, TaskStatus } from '../types';
import { api } from '../services/api';
import { Button } from '../components/ui/button';
import { formatDatetimeForBackend, toLocalDateString } from '../utils/dateUtils';

type GroupByMode = 'COURSE' | 'TIME' | 'PRIORITY' | 'STATUS' | 'GOAL' | 'NONE';
type SortByMode = 'DUE' | 'PRIORITY' | 'DIFFICULTY' | 'CREATED' | 'TITLE' | 'PROGRESS';
type SortOrder = 'ASC' | 'DESC';
type ViewLayout = 'ROWS' | 'CARDS';

interface TaskGroup {
  id: string;
  title: string;
  icon: string;
  badgeColor?: string;
  headerBg?: string;
  tasks: Task[];
}

interface StatusColumnConfig {
  id: string;
  title: string;
  icon: React.ReactNode;
  headerBg: string;
  badgeBg: string;
  borderColor: string;
  statuses: string[];
  defaultStatus: TaskStatus;
}

const BASE_STATUS_COLUMNS: StatusColumnConfig[] = [
  {
    id: 'col_todo',
    title: 'Chưa bắt đầu',
    icon: <Circle className="w-4 h-4 text-slate-500 shrink-0" />,
    headerBg: 'bg-slate-100/90 dark:bg-slate-800/90 text-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-700/80',
    badgeBg: 'bg-slate-200/80 text-slate-700 dark:bg-slate-700 dark:text-slate-300',
    borderColor: 'border-slate-200 dark:border-slate-800',
    statuses: ['TODO'],
    defaultStatus: 'TODO',
  },
  {
    id: 'col_progress',
    title: 'Đang thực hiện',
    icon: <Clock className="w-4 h-4 text-blue-500 shrink-0" />,
    headerBg: 'bg-blue-50/90 dark:bg-blue-950/60 text-blue-800 dark:text-blue-200 border-blue-200 dark:border-blue-800/70',
    badgeBg: 'bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300',
    borderColor: 'border-blue-200/70 dark:border-blue-900/40',
    statuses: ['IN_PROGRESS', 'PARTIAL'],
    defaultStatus: 'IN_PROGRESS',
  },
  {
    id: 'col_delayed',
    title: 'Chậm trễ',
    icon: <Flame className="w-4 h-4 text-rose-500 shrink-0" />,
    headerBg: 'bg-rose-50/90 dark:bg-rose-950/60 text-rose-800 dark:text-rose-200 border-rose-200 dark:border-rose-800/70',
    badgeBg: 'bg-rose-100 dark:bg-rose-900/60 text-rose-700 dark:text-rose-300',
    borderColor: 'border-rose-200/70 dark:border-rose-900/40',
    statuses: ['DELAYED'],
    defaultStatus: 'DELAYED',
  },
  {
    id: 'col_completed',
    title: 'Đã hoàn thành',
    icon: <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />,
    headerBg: 'bg-emerald-50/90 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-200 border-emerald-200 dark:border-emerald-800/70',
    badgeBg: 'bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300',
    borderColor: 'border-emerald-200/70 dark:border-emerald-900/40',
    statuses: ['COMPLETED'],
    defaultStatus: 'COMPLETED',
  },
];

const TRANSFERRED_COLUMN: StatusColumnConfig = {
  id: 'col_transferred',
  title: 'Đã chuyển tiếp',
  icon: <CornerDownRight className="w-4 h-4 text-purple-500 shrink-0" />,
  headerBg: 'bg-purple-50/90 dark:bg-purple-950/60 text-purple-800 dark:text-purple-200 border-purple-200 dark:border-purple-800/70',
  badgeBg: 'bg-purple-100 dark:bg-purple-900/60 text-purple-700 dark:text-purple-300',
  borderColor: 'border-purple-200/70 dark:border-purple-900/40',
  statuses: ['TRANSFERRED'],
  defaultStatus: 'TRANSFERRED',
};

export const TasksPage: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [countdowns, setCountdowns] = useState<CountdownItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Primary Filters
  const [search, setSearch] = useState('');
  const [dateFilter, setDateFilter] = useState<'ALL' | 'TODAY' | 'UPCOMING' | 'DELAYED' | 'COMPLETED'>('ALL');

  // Secondary Filters (Collapsible Drawer)
  const [selectedGoalId, setSelectedGoalId] = useState<number | undefined>(undefined);
  const [selectedCourseId, setSelectedCourseId] = useState<number | undefined>(undefined);
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [selectedDifficulty, setSelectedDifficulty] = useState<number | undefined>(undefined);
  const [selectedPriority, setSelectedPriority] = useState<string>('ALL');
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);

  // Layering & Sorting Controls
  const [groupBy, setGroupBy] = useState<GroupByMode>('COURSE');
  const [sortBy, setSortBy] = useState<SortByMode>('DUE');
  const [sortOrder, setSortOrder] = useState<SortOrder>('ASC');
  const [viewLayout, setViewLayout] = useState<ViewLayout>('CARDS');
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [hideCompletedCards, setHideCompletedCards] = useState<boolean>(false);

  // Modals
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [taskToEdit, setTaskToEdit] = useState<Task | null>(null);
  const [taskToTransfer, setTaskToTransfer] = useState<Task | null>(null);
  const [modalInitialStatus, setModalInitialStatus] = useState<TaskStatus | undefined>(undefined);

  const loadTasks = async () => {
    setIsLoading(true);
    try {
      const res = await api.tasks.list({
        search: search.trim() || undefined,
        date_filter: dateFilter !== 'ALL' ? dateFilter : undefined,
        goal_id: selectedGoalId,
        status: selectedStatus !== 'ALL' ? selectedStatus : undefined,
        difficulty: selectedDifficulty,
        priority: selectedPriority !== 'ALL' ? selectedPriority : undefined,
      });
      setTasks(res);
    } catch (err) {
      console.error('Failed to load tasks:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadMeta = async () => {
    try {
      const [g, c, cd] = await Promise.all([
        api.goals.list().catch(() => []),
        api.courses.list().catch(() => []),
        api.countdowns.list().catch(() => []),
      ]);
      setGoals(g);
      setCourses(c);
      setCountdowns(cd);
    } catch (err) {
      console.error('Failed to load metadata:', err);
    }
  };

  useEffect(() => {
    loadMeta();
  }, []);

  useEffect(() => {
    loadTasks();
  }, [search, dateFilter, selectedGoalId, selectedStatus, selectedDifficulty, selectedPriority]);

  const handleToggleStatus = async (task: Task) => {
    try {
      const newStatus = task.status === 'COMPLETED' ? 'TODO' : 'COMPLETED';
      await api.tasks.update(task.id, { status: newStatus });
      loadTasks();
      window.dispatchEvent(new CustomEvent('lifeos_task_updated'));
    } catch (err) {
      console.error('Failed to toggle task status:', err);
    }
  };

  const handleToggleSubtask = async (subtaskId: number) => {
    try {
      await api.tasks.toggleSubtask(subtaskId);
      loadTasks();
      window.dispatchEvent(new CustomEvent('lifeos_task_updated'));
    } catch (err) {
      console.error('Failed to toggle subtask:', err);
    }
  };

  const handleDeleteTask = async (taskId: number) => {
    if (window.confirm('Bạn có chắc chắn muốn xóa task này?')) {
      try {
        await api.tasks.delete(taskId);
        loadTasks();
        window.dispatchEvent(new CustomEvent('lifeos_task_updated'));
      } catch (err) {
        console.error('Failed to delete task:', err);
      }
    }
  };

  const handleSaveTask = async (taskData: any) => {
    try {
      if (taskToEdit) {
        await api.tasks.update(taskToEdit.id, taskData);
      } else {
        await api.tasks.create(taskData);
      }
      loadTasks();
      window.dispatchEvent(new CustomEvent('lifeos_task_updated'));
    } catch (err) {
      console.error('Failed to save task:', err);
    }
  };

  const handleConfirmTransfer = async (
    taskId: number,
    newDueDate: string,
    keepSubtasks: boolean,
    notes?: string
  ) => {
    try {
      await api.tasks.transfer(taskId, {
        new_due_datetime: formatDatetimeForBackend(newDueDate) || newDueDate,
        keep_subtasks: keepSubtasks,
        notes,
      });
      loadTasks();
      window.dispatchEvent(new CustomEvent('lifeos_task_updated'));
    } catch (err) {
      console.error('Failed to transfer task:', err);
    }
  };

  const toggleGroupCollapse = (groupId: string) => {
    setCollapsedGroups((prev) => ({
      ...prev,
      [groupId]: !prev[groupId],
    }));
  };

  const handleToggleCollapseAll = (collapse: boolean) => {
    const updated: Record<string, boolean> = {};
    groupedTasks.forEach((g) => {
      updated[g.id] = collapse;
    });
    setCollapsedGroups(updated);
  };

  const handleResetFilters = () => {
    setSearch('');
    setDateFilter('ALL');
    setSelectedGoalId(undefined);
    setSelectedCourseId(undefined);
    setSelectedStatus('ALL');
    setSelectedPriority('ALL');
    setSelectedDifficulty(undefined);
  };

  // Sort comparator
  const sortComparator = (a: Task, b: Task) => {
    let diff = 0;
    if (sortBy === 'DUE') {
      if (!a.due_datetime && !b.due_datetime) diff = 0;
      else if (!a.due_datetime) diff = 1;
      else if (!b.due_datetime) diff = -1;
      else diff = new Date(a.due_datetime).getTime() - new Date(b.due_datetime).getTime();
    } else if (sortBy === 'PRIORITY') {
      const pMap: Record<string, number> = { URGENT: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
      diff = (pMap[b.priority] || 0) - (pMap[a.priority] || 0);
    } else if (sortBy === 'DIFFICULTY') {
      diff = (b.difficulty || 2) - (a.difficulty || 2);
    } else if (sortBy === 'CREATED') {
      diff = new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    } else if (sortBy === 'TITLE') {
      diff = a.title.localeCompare(b.title, 'vi');
    } else if (sortBy === 'PROGRESS') {
      diff = (b.subtask_progress || 0) - (a.subtask_progress || 0);
    }

    return sortOrder === 'ASC' ? diff : -diff;
  };

  // Client-side course filter applied if selectedCourseId
  const filteredTasks = useMemo(() => {
    if (!selectedCourseId) return tasks;
    const course = courses.find((c) => c.id === selectedCourseId);
    if (!course) return tasks;
    const courseTitleLower = course.title.toLowerCase();
    return tasks.filter((t) => {
      if (t.course_title && t.course_title.toLowerCase().includes(courseTitleLower)) return true;
      return false;
    });
  }, [tasks, selectedCourseId, courses]);

  const sortedAllTasks = useMemo(() => {
    return [...filteredTasks].sort(sortComparator);
  }, [filteredTasks, sortBy, sortOrder]);

  // Active secondary filters count for badge
  const activeSecondaryFilterCount = useMemo(() => {
    let count = 0;
    if (selectedCourseId !== undefined) count++;
    if (selectedGoalId !== undefined) count++;
    if (selectedStatus !== 'ALL') count++;
    if (selectedPriority !== 'ALL') count++;
    if (selectedDifficulty !== undefined) count++;
    return count;
  }, [selectedCourseId, selectedGoalId, selectedStatus, selectedPriority, selectedDifficulty]);

  // Grouping Engine (Used in ROWS view)
  const groupedTasks = useMemo<TaskGroup[]>(() => {
    const sorted = sortedAllTasks;

    if (groupBy === 'NONE') {
      return [
        {
          id: 'all',
          title: 'Tất cả nhiệm vụ',
          icon: '📋',
          tasks: sorted,
        },
      ];
    }

    if (groupBy === 'COURSE') {
      const map = new Map<string, Task[]>();
      sorted.forEach((t) => {
        let key = 'Cá nhân / Khác';
        if (t.course_title) {
          const prefix = t.course_title.split(':')[0].trim();
          key = `Khóa học: ${prefix || t.course_title}`;
        } else if (t.scheduled_with_fixed_title) {
          key = `Lịch: ${t.scheduled_with_fixed_title}`;
        }
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(t);
      });

      const groups: TaskGroup[] = [];
      Array.from(map.entries()).forEach(([key, items], idx) => {
        groups.push({
          id: `course_${idx}`,
          title: key,
          icon: key.startsWith('Khóa học') ? '📚' : key.startsWith('Lịch') ? '📌' : '📝',
          badgeColor: key.startsWith('Khóa học')
            ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
            : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
          tasks: items,
        });
      });
      return groups;
    }

    if (groupBy === 'TIME') {
      const todayStr = toLocalDateString();
      const overdue: Task[] = [];
      const today: Task[] = [];
      const upcoming: Task[] = [];
      const nodate: Task[] = [];
      const completed: Task[] = [];

      sorted.forEach((t) => {
        if (t.status === 'COMPLETED') {
          completed.push(t);
          return;
        }
        if (!t.due_datetime) {
          nodate.push(t);
          return;
        }
        const dStr = toLocalDateString(new Date(t.due_datetime));
        const isPast = dStr < todayStr;
        if (isPast || t.status === 'DELAYED') {
          overdue.push(t);
        } else if (dStr === todayStr) {
          today.push(t);
        } else {
          upcoming.push(t);
        }
      });

      const groups: TaskGroup[] = [];
      if (overdue.length > 0) {
        groups.push({
          id: 'time_overdue',
          title: 'Quá hạn & Chậm trễ',
          icon: '🔥',
          badgeColor: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-900',
          tasks: overdue,
        });
      }
      if (today.length > 0) {
        groups.push({
          id: 'time_today',
          title: 'Hôm nay',
          icon: '⭐',
          badgeColor: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-900',
          tasks: today,
        });
      }
      if (upcoming.length > 0) {
        groups.push({
          id: 'time_upcoming',
          title: 'Sắp tới trong tuần',
          icon: '📅',
          badgeColor: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-900',
          tasks: upcoming,
        });
      }
      if (nodate.length > 0) {
        groups.push({
          id: 'time_nodate',
          title: 'Không có thời hạn',
          icon: '⏳',
          badgeColor: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
          tasks: nodate,
        });
      }
      if (completed.length > 0) {
        groups.push({
          id: 'time_completed',
          title: 'Đã hoàn thành',
          icon: '✅',
          badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800',
          tasks: completed,
        });
      }
      return groups;
    }

    if (groupBy === 'PRIORITY') {
      const order: PriorityLevel[] = ['URGENT', 'HIGH', 'MEDIUM', 'LOW'];
      const map: Record<string, Task[]> = { URGENT: [], HIGH: [], MEDIUM: [], LOW: [] };
      sorted.forEach((t) => {
        const p = (t.priority as PriorityLevel) || 'MEDIUM';
        if (!map[p]) map[p] = [];
        map[p].push(t);
      });

      return order
        .filter((p) => map[p].length > 0)
        .map((p) => {
          const cfg = PRIORITY_CONFIG[p];
          return {
            id: `priority_${p}`,
            title: cfg.label,
            icon: p === 'URGENT' ? '🚨' : p === 'HIGH' ? '⚡' : p === 'MEDIUM' ? '🔹' : '▫️',
            badgeColor: `${cfg.badgeBg} ${cfg.textColor} ${cfg.borderColor}`,
            tasks: map[p],
          };
        });
    }

    if (groupBy === 'STATUS') {
      const statusDefs = [
        { code: 'IN_PROGRESS', label: 'Đang thực hiện', icon: '🚀' },
        { code: 'TODO', label: 'Chưa bắt đầu', icon: '⏳' },
        { code: 'PARTIAL', label: 'Hoàn thành một phần', icon: '🌓' },
        { code: 'DELAYED', label: 'Chậm trễ', icon: '🔴' },
        { code: 'COMPLETED', label: 'Đã hoàn thành', icon: '✅' },
        { code: 'TRANSFERRED', label: 'Đã chuyển giao', icon: '↪️' },
      ];

      const groups: TaskGroup[] = [];
      statusDefs.forEach((st) => {
        const items = sorted.filter((t) => t.status === st.code);
        if (items.length > 0) {
          groups.push({
            id: `status_${st.code}`,
            title: st.label,
            icon: st.icon,
            tasks: items,
          });
        }
      });
      return groups;
    }

    if (groupBy === 'GOAL') {
      const map = new Map<number | 'NONE', Task[]>();
      sorted.forEach((t) => {
        const gid = t.goal_id || 'NONE';
        if (!map.has(gid)) map.set(gid, []);
        map.get(gid)!.push(t);
      });

      const groups: TaskGroup[] = [];
      Array.from(map.entries()).forEach(([gid, items]) => {
        let title = 'Mục tiêu cá nhân / Khác';
        if (gid !== 'NONE') {
          const g = goals.find((item) => item.id === gid);
          if (g) title = `Mục tiêu: ${g.title}`;
        }
        groups.push({
          id: `goal_${gid}`,
          title,
          icon: '🎯',
          badgeColor: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800',
          tasks: items,
        });
      });
      return groups;
    }

    return [];
  }, [sortedAllTasks, groupBy, goals]);

  // Unified Kanban Board Rendering
  const renderStatusBoard = (taskList: Task[]) => {
    const hasTransferred = taskList.some((t) => t.status === 'TRANSFERRED');
    const activeColumns = hasTransferred
      ? [...BASE_STATUS_COLUMNS, TRANSFERRED_COLUMN]
      : BASE_STATUS_COLUMNS;

    return (
      <div
        className={`grid grid-cols-1 md:grid-cols-2 ${
          activeColumns.length >= 5 ? 'xl:grid-cols-5' : 'xl:grid-cols-4'
        } gap-4 items-start w-full`}
      >
        {activeColumns.map((col) => {
          const colTasks = taskList.filter((t) => col.statuses.includes(t.status));
          const isCompletedCol = col.id === 'col_completed';
          const isHidden = isCompletedCol && hideCompletedCards;

          return (
            <div
              key={col.id}
              className="bg-slate-50/70 dark:bg-slate-900/40 rounded-2xl border border-slate-200/90 dark:border-slate-800/90 p-3 flex flex-col gap-3 min-h-[380px] shadow-2xs"
            >
              {/* Column Header */}
              <div
                className={`p-2.5 px-3 rounded-xl border flex items-center justify-between gap-2 shadow-2xs select-none ${col.headerBg}`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  {col.icon}
                  <span className="font-bold text-xs truncate">{col.title}</span>
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${col.badgeBg}`}>
                    {colTasks.length}
                  </span>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {isCompletedCol && colTasks.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setHideCompletedCards(!hideCompletedCards)}
                      title={hideCompletedCards ? 'Hiển thị việc đã xong' : 'Ẩn việc đã xong'}
                      className="p-1 rounded text-slate-500 hover:text-emerald-700 dark:hover:text-emerald-300 hover:bg-emerald-100/50 dark:hover:bg-emerald-950/50 transition flex items-center gap-1 text-[11px]"
                    >
                      {hideCompletedCards ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      setTaskToEdit(null);
                      setModalInitialStatus(col.defaultStatus);
                      setIsTaskModalOpen(true);
                    }}
                    title={`Tạo nhiệm vụ "${col.title}"`}
                    className="p-1 rounded hover:bg-black/5 dark:hover:bg-white/10 text-slate-600 dark:text-slate-300 transition"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Column Content */}
              {isHidden ? (
                <div
                  onClick={() => setHideCompletedCards(false)}
                  className="p-4 rounded-xl border border-dashed border-emerald-300 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20 text-center cursor-pointer hover:bg-emerald-100/50 transition select-none space-y-1 my-auto"
                >
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 mx-auto" />
                  <p className="text-xs font-semibold text-emerald-800 dark:text-emerald-300">
                    Đã ẩn {colTasks.length} việc đã xong
                  </p>
                  <p className="text-[10px] text-emerald-600 dark:text-emerald-400">Bấm để mở lại</p>
                </div>
              ) : colTasks.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center p-6 rounded-xl border border-dashed border-slate-200 dark:border-slate-800/80 text-slate-400 text-xs text-center space-y-1 min-h-[140px]">
                  <span className="text-xs text-slate-400 dark:text-slate-500">Chưa có nhiệm vụ</span>
                  <button
                    type="button"
                    onClick={() => {
                      setTaskToEdit(null);
                      setModalInitialStatus(col.defaultStatus);
                      setIsTaskModalOpen(true);
                    }}
                    className="text-[11px] font-semibold text-neutral-900 dark:text-neutral-100 hover:underline pt-0.5"
                  >
                    + Thêm việc
                  </button>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {colTasks.map((t) => (
                    <TaskCard
                      key={t.id}
                      task={t}
                      onToggleStatus={handleToggleStatus}
                      onTransfer={(task) => setTaskToTransfer(task)}
                      onEdit={(task) => {
                        setTaskToEdit(task);
                        setIsTaskModalOpen(true);
                      }}
                      onDelete={handleDeleteTask}
                      onToggleSubtask={handleToggleSubtask}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  const filterPills = [
    { id: 'ALL', label: 'Tất cả' },
    { id: 'TODAY', label: 'Hôm nay' },
    { id: 'UPCOMING', label: 'Sắp tới' },
    { id: 'DELAYED', label: 'Chậm trễ' },
    { id: 'COMPLETED', label: 'Đã hoàn thành' },
  ];

  const totalCompletedTasks = tasks.filter((t) => t.status === 'COMPLETED').length;
  const overallTaskProgress = tasks.length > 0 ? Math.round((totalCompletedTasks / tasks.length) * 100) : 0;

  // Pinned Goals and Deadlines Showcase list
  const pinnedGoalsAndCountdowns = useMemo(() => {
    const pinned = countdowns.filter((c) => c.is_pinned);
    if (pinned.length > 0) return pinned;
    // Fallback to top goals or countdowns
    return countdowns.filter((c) => c.category === 'GOAL' || c.category === 'EXAM').slice(0, 4);
  }, [countdowns]);

  return (
    <div className="space-y-4">
      {/* 1. Header & Summary Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Nhiệm vụ</h2>
            <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
              {filteredTasks.length} việc • {totalCompletedTasks} đã xong ({overallTaskProgress}%)
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Quản lý công việc tập trung, liên kết mục tiêu và theo dõi tiến độ tinh giản
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="primary"
            onClick={() => {
              setTaskToEdit(null);
              setIsTaskModalOpen(true);
            }}
          >
            <Plus className="w-4 h-4" />
            <span>Tạo nhiệm vụ mới</span>
          </Button>
        </div>
      </div>

      {/* 2. Top Goal Strip ("Mục tiêu & Hạn chót trọng tâm") - ĐẨY MỤC TIÊU LÊN ĐẦU VỚI HÀO QUANG TOẢ RA XUNG QUANH */}
      {pinnedGoalsAndCountdowns.length > 0 && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 shadow-xs space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-base">🎯</span>
              <h3 className="font-extrabold text-xs uppercase tracking-wider text-slate-800 dark:text-slate-200">
                Mục tiêu trọng tâm & Đếm ngược
              </h3>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 dark:border-amber-700">
                {countdowns.filter((c) => c.is_pinned).length > 0 ? 'Đã ghim' : 'Ưu tiên'}
              </span>
            </div>

            {selectedGoalId && (
              <button
                type="button"
                onClick={() => setSelectedGoalId(undefined)}
                className="text-[11px] font-semibold text-rose-600 dark:text-rose-400 hover:underline flex items-center gap-1"
              >
                <X className="w-3 h-3" />
                <span>Xóa lọc mục tiêu</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {pinnedGoalsAndCountdowns.map((item) => {
              const isPinned = item.is_pinned;
              const targetD = new Date(item.target_date);
              const nowMs = Date.now();
              const targetMs = targetD.getTime();
              const diffDays = Math.ceil((targetMs - nowMs) / (1000 * 60 * 60 * 24));
              const isSelected =
                selectedGoalId !== undefined &&
                goals.find((g) => g.id === selectedGoalId)?.title.toLowerCase() === item.title.toLowerCase();

              return (
                <div key={item.id} className="relative group">
                  {/* HÀO QUANG TOẢ XUNG QUANH LIÊN TỤC KHI MỤC TIÊU ĐƯỢC GHIM */}
                  {isPinned && (
                    <div
                      className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-amber-400 via-orange-400 to-yellow-300 opacity-75 blur-md animate-pinned-aura pointer-events-none z-0"
                      aria-hidden="true"
                    />
                  )}

                  <div
                    onClick={() => {
                      const match = goals.find((g) => g.title.toLowerCase() === item.title.toLowerCase());
                      if (match) {
                        setSelectedGoalId(selectedGoalId === match.id ? undefined : match.id);
                      } else {
                        setSearch(search === item.title ? '' : item.title);
                      }
                    }}
                    className={`cursor-pointer rounded-xl p-3 border transition-all relative z-10 flex flex-col justify-between ${
                      isPinned
                        ? 'ring-2 ring-amber-400/90 bg-white dark:bg-slate-900 border-amber-300 dark:border-amber-700 shadow-sm'
                        : 'bg-slate-50/80 dark:bg-slate-850/60 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                    } ${isSelected ? 'ring-2 ring-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/30' : ''}`}
                  >
                    <div className="flex items-start justify-between gap-1.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-lg shrink-0">{item.icon || '🎯'}</span>
                        <div className="min-w-0">
                          <h4
                            className="font-extrabold text-xs text-slate-900 dark:text-slate-100 truncate"
                            title={item.title}
                          >
                            {item.title}
                          </h4>
                          <span className="text-[10px] text-slate-500 dark:text-slate-400">
                            {item.category === 'EXAM' ? 'Ngày thi' : item.category === 'GOAL' ? 'Mục tiêu' : 'Sự kiện'}
                          </span>
                        </div>
                      </div>

                      {isPinned && (
                        <span className="inline-flex items-center gap-0.5 text-[9px] font-black px-1.5 py-0.5 rounded-full bg-amber-400 text-neutral-950 border border-amber-300 shadow-2xs font-mono shrink-0">
                          <Pin className="w-2.5 h-2.5 fill-neutral-950" />
                          <span>GHIM</span>
                        </span>
                      )}
                    </div>

                    <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[11px]">
                      <span className="font-semibold text-slate-600 dark:text-slate-400">
                        {diffDays > 0 ? `Còn ${diffDays} ngày` : diffDays === 0 ? 'Hôm nay!' : 'Đã diễn ra'}
                      </span>
                      <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold group-hover:underline">
                        {isSelected ? 'Đang lọc ✓' : 'Lọc việc →'}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 3. Streamlined Single Control Bar (Loại bỏ hoàn toàn rối rắm từ 3 thanh công cụ cũ) */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3 shadow-xs space-y-2.5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5">
          {/* Left: Search input */}
          <div className="relative flex-1 min-w-[220px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Tìm kiếm nhiệm vụ, môn học, ghi chú..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-xl pl-9 pr-8 py-2 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Center: Quick Date Status Pills */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1 lg:pb-0 scrollbar-none">
            {filterPills.map((pill) => (
              <button
                key={pill.id}
                type="button"
                onClick={() => setDateFilter(pill.id as any)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                  dateFilter === pill.id
                    ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 shadow-xs'
                    : 'bg-slate-100/70 hover:bg-slate-200/70 dark:bg-slate-800/70 dark:hover:bg-slate-700/70 text-slate-600 dark:text-slate-300'
                }`}
              >
                {pill.label}
              </button>
            ))}
          </div>

          {/* Right: Layout Switcher, Sort & Filter Drawer Button */}
          <div className="flex items-center gap-1.5 shrink-0 self-end lg:self-center">
            {/* View Layout Toggle: Board vs Rows */}
            <div className="inline-flex rounded-xl border border-slate-200 dark:border-slate-700/80 bg-slate-100/60 dark:bg-slate-800/60 p-0.5">
              <button
                type="button"
                onClick={() => setViewLayout('CARDS')}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
                  viewLayout === 'CARDS'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-2xs'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
                title="Bảng cột trạng thái (Kanban)"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Bảng cột</span>
              </button>
              <button
                type="button"
                onClick={() => setViewLayout('ROWS')}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
                  viewLayout === 'ROWS'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-2xs'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
                title="Danh sách hàng phân lớp"
              >
                <LayoutList className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Danh sách</span>
              </button>
            </div>

            {/* Sort Dropdown */}
            <div className="flex items-center bg-slate-100/70 dark:bg-slate-800/70 rounded-xl px-2 py-1 text-xs border border-slate-200 dark:border-slate-700/80">
              <select
                value={sortBy}
                onChange={(e: any) => setSortBy(e.target.value)}
                className="bg-transparent font-medium text-slate-700 dark:text-slate-300 focus:outline-none cursor-pointer pr-1"
              >
                <option value="DUE">Hạn chót</option>
                <option value="PRIORITY">Ưu tiên</option>
                <option value="DIFFICULTY">Độ khó</option>
                <option value="CREATED">Mới nhất</option>
                <option value="TITLE">Tên A-Z</option>
              </select>
              <button
                type="button"
                onClick={() => setSortOrder(sortOrder === 'ASC' ? 'DESC' : 'ASC')}
                className="p-0.5 text-slate-500 hover:text-slate-900 dark:hover:text-slate-100"
                title={sortOrder === 'ASC' ? 'Tăng dần (Bấm để đảo chiều)' : 'Giảm dần (Bấm để đảo chiều)'}
              >
                {sortOrder === 'ASC' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3 text-amber-500" />}
              </button>
            </div>

            {/* Advanced Filters Button */}
            <button
              type="button"
              onClick={() => setIsFilterDrawerOpen(!isFilterDrawerOpen)}
              className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 border transition-all ${
                isFilterDrawerOpen || activeSecondaryFilterCount > 0
                  ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800 shadow-2xs'
                  : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-750'
              }`}
            >
              <Filter className="w-3.5 h-3.5" />
              <span>Bộ lọc</span>
              {activeSecondaryFilterCount > 0 && (
                <span className="w-4 h-4 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center">
                  {activeSecondaryFilterCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Collapsible Advanced Filters Drawer */}
        {isFilterDrawerOpen && (
          <div className="pt-2.5 border-t border-slate-100 dark:border-slate-800/80 flex flex-wrap items-center gap-2 text-xs animate-in fade-in slide-in-from-top-1 duration-200">
            {/* Filter by Course */}
            <select
              value={selectedCourseId || ''}
              onChange={(e) => setSelectedCourseId(e.target.value ? Number(e.target.value) : undefined)}
              className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">📚 Tất cả môn / khóa học</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>

            {/* Filter by Goal */}
            <select
              value={selectedGoalId || ''}
              onChange={(e) => setSelectedGoalId(e.target.value ? Number(e.target.value) : undefined)}
              className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">🎯 Tất cả mục tiêu</option>
              {goals.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.title}
                </option>
              ))}
            </select>

            {/* Filter by Priority */}
            <select
              value={selectedPriority}
              onChange={(e) => setSelectedPriority(e.target.value)}
              className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="ALL">⚡ Mức ưu tiên</option>
              <option value="URGENT">Khẩn cấp</option>
              <option value="HIGH">Ưu tiên cao</option>
              <option value="MEDIUM">Trung bình</option>
              <option value="LOW">Thấp</option>
            </select>

            {/* Filter by Difficulty */}
            <select
              value={selectedDifficulty || ''}
              onChange={(e) => setSelectedDifficulty(e.target.value ? Number(e.target.value) : undefined)}
              className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">🔥 Độ khó (XP)</option>
              <option value={1}>Dễ (+1 XP)</option>
              <option value={2}>Bình thường (+2 XP)</option>
              <option value={3}>Khó (+3 XP)</option>
              <option value={4}>Rất khó (+4 XP)</option>
              <option value={5}>Cực khó (+5 XP)</option>
            </select>

            {/* Group By selector (Active in ROWS view) */}
            {viewLayout === 'ROWS' && (
              <div className="flex items-center gap-1 pl-1">
                <span className="text-slate-400 font-semibold text-[11px]">Nhóm theo:</span>
                <select
                  value={groupBy}
                  onChange={(e: any) => setGroupBy(e.target.value)}
                  className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="COURSE">Khóa học / Môn</option>
                  <option value="TIME">Thời gian hạn chót</option>
                  <option value="PRIORITY">Mức ưu tiên</option>
                  <option value="GOAL">Mục tiêu</option>
                  <option value="NONE">Phẳng (Không nhóm)</option>
                </select>
              </div>
            )}

            {/* Reset button if any filter is set */}
            {(activeSecondaryFilterCount > 0 || search || dateFilter !== 'ALL') && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="px-2.5 py-1.5 rounded-lg text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 font-semibold text-xs flex items-center gap-1 transition ml-auto"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Đặt lại bộ lọc</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* 4. Task Content (Kanban Board vs Layered Rows) */}
      {isLoading ? (
        <div className="p-12 text-center text-slate-500 text-xs animate-pulse">
          Đang tải danh sách nhiệm vụ...
        </div>
      ) : filteredTasks.length === 0 ? (
        <div className="p-12 text-center bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs">
          <p className="text-slate-700 dark:text-slate-400 text-sm font-medium">Không tìm thấy nhiệm vụ nào phù hợp</p>
          <p className="text-slate-500 text-xs mt-1">
            Hãy thử đổi bộ lọc hoặc bấm "Tạo nhiệm vụ mới" ở góc trên
          </p>
        </div>
      ) : viewLayout === 'CARDS' ? (
        /* Unified 4-Column Status Kanban Board */
        <div className="w-full">
          {renderStatusBoard(sortedAllTasks)}
        </div>
      ) : (
        /* Layered Group Sections in Rows View */
        <div className="space-y-4">
          {/* Header controls for expand/collapse */}
          {groupBy !== 'NONE' && groupedTasks.length > 1 && (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => {
                  const isAnyCollapsed = Object.values(collapsedGroups).some((v) => v);
                  handleToggleCollapseAll(!isAnyCollapsed);
                }}
                className="text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 text-xs font-semibold px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 transition"
              >
                {Object.values(collapsedGroups).some((v) => v) ? 'Mở rộng tất cả nhóm' : 'Thu gọn tất cả nhóm'}
              </button>
            </div>
          )}

          {groupedTasks.map((group) => {
            const isCollapsed = !!collapsedGroups[group.id];
            const completedCount = group.tasks.filter((t) => t.status === 'COMPLETED').length;
            const progress = group.tasks.length > 0 ? Math.round((completedCount / group.tasks.length) * 100) : 0;

            return (
              <div
                key={group.id}
                className="bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden transition-all"
              >
                {/* Section Header */}
                <div
                  onClick={() => toggleGroupCollapse(group.id)}
                  className="p-3 sm:px-4 flex items-center justify-between gap-3 cursor-pointer bg-slate-50/70 dark:bg-slate-850/60 hover:bg-slate-100/70 dark:hover:bg-slate-800 transition select-none border-b border-slate-100 dark:border-slate-800"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-slate-400 p-0.5">
                      {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </span>
                    <span className="text-base">{group.icon}</span>
                    <h3 className="font-extrabold text-slate-900 dark:text-slate-100 text-sm flex items-center gap-2">
                      <span>{group.title}</span>
                    </h3>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 text-xs">
                      <div className="w-16 sm:w-24 bg-slate-200 dark:bg-slate-700 rounded-full h-1.5 overflow-hidden hidden sm:block">
                        <div
                          className="bg-emerald-500 h-full rounded-full transition-all duration-300"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                      <span className="font-semibold text-slate-500 dark:text-slate-400 text-[11px]">
                        {completedCount}/{group.tasks.length} việc ({progress}%)
                      </span>
                    </div>
                  </div>
                </div>

                {/* Section Content */}
                {!isCollapsed && (
                  <div className="p-3 sm:p-4 space-y-2">
                    {group.tasks.map((t) => (
                      <TaskRowItem
                        key={t.id}
                        task={t}
                        onToggleStatus={handleToggleStatus}
                        onTransfer={(task) => setTaskToTransfer(task)}
                        onEdit={(task) => {
                          setTaskToEdit(task);
                          setIsTaskModalOpen(true);
                        }}
                        onDelete={handleDeleteTask}
                        onToggleSubtask={handleToggleSubtask}
                        showCourseTag={groupBy !== 'COURSE'}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modals */}
      <TaskModal
        isOpen={isTaskModalOpen}
        onClose={() => {
          setIsTaskModalOpen(false);
          setTaskToEdit(null);
          setModalInitialStatus(undefined);
        }}
        onSave={handleSaveTask}
        taskToEdit={taskToEdit}
        goals={goals}
        initialStatus={modalInitialStatus}
      />

      <TaskTransferModal
        isOpen={!!taskToTransfer}
        task={taskToTransfer}
        onClose={() => setTaskToTransfer(null)}
        onConfirm={handleConfirmTransfer}
      />
    </div>
  );
};
