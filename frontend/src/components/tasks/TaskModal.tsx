import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  X, Plus, Trash2, Flame, Clock, Flag, BookOpen, GraduationCap,
  Pin, ArrowUp, ArrowDown, Sparkles, Check, CheckSquare,
  Hash, FileText, Calendar
} from 'lucide-react';
import {
  Task, Goal, TaskStatus, DIFFICULTY_CONFIG, PRIORITY_CONFIG,
  TASK_STATUS_LABELS, TASK_STATUS_COLORS, Course, CourseNode, FixedSchedule
} from '../../types';
import { api } from '../../services/api';
import { ConflictWarningModal } from './ConflictWarningModal';
import { Button } from '../ui/button';
import { SmartSchedulePicker } from './SmartSchedulePicker';
import {
  formatDatetimeForBackend,
  parseBackendDatetimeToLocalInput,
  toLocalInputString,
  toLocalDateString,
} from '../../utils/dateUtils';

interface SubtaskItem {
  id?: number;
  title: string;
  is_completed: boolean;
}

interface TaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (taskData: any) => Promise<void>;
  taskToEdit?: Task | null;
  goals?: Goal[];
  courses?: Course[];
  fixedSchedules?: FixedSchedule[];
  initialDate?: string;
  initialTitle?: string;
  initialCourseNodeId?: number;
  initialFixedScheduleId?: number;
  initialStatus?: TaskStatus;
}

const DOW_SHORT = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
const DAY_LABELS = [
  'Thứ Hai (T2)',
  'Thứ Ba (T3)',
  'Thứ Tư (T4)',
  'Thứ Năm (T5)',
  'Thứ Sáu (T6)',
  'Thứ Bảy (T7)',
  'Chủ Nhật (CN)',
];

const QUICK_TITLES = [
  'Làm BTVN Toán', 'Học từ vựng Tiếng Anh', 'Đọc tài liệu Văn',
  'Luyện đề Vật lý', 'Soạn bài Sinh học', 'Làm slide nhóm'
];
const POPULAR_TAGS = ['#btvn', '#onthi', '#decuong', '#thuyettrinh', '#baitapnhom', '#kiemtra'];

export const TaskModal: React.FC<TaskModalProps> = ({
  isOpen,
  onClose,
  onSave,
  taskToEdit,
  courses: propsCourses,
  fixedSchedules: propsFixedSchedules,
  initialDate,
  initialTitle,
  initialCourseNodeId,
  initialFixedScheduleId,
  initialStatus,
}) => {
  // Core Fields
  const [title, setTitle] = useState('');
  const [titleError, setTitleError] = useState(false);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const scrollBodyRef = useRef<HTMLDivElement>(null);

  const [description, setDescription] = useState('');
  const [courses, setCourses] = useState<Course[]>(propsCourses || []);
  const [allCourseNodes, setAllCourseNodes] = useState<CourseNode[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<number | undefined>(undefined);
  const [courseNodeId, setCourseNodeId] = useState<number | undefined>(initialCourseNodeId);
  const [fixedSchedulesList, setFixedSchedulesList] = useState<FixedSchedule[]>(propsFixedSchedules || []);
  const [scheduledWithFixedId, setScheduledWithFixedId] = useState<number | undefined>(initialFixedScheduleId);
  const [scheduleDayFilter, setScheduleDayFilter] = useState<number | 'ALL'>('ALL');
  const [isLoadingCourses, setIsLoadingCourses] = useState(false);

  // Time & Classification
  const [dueDatetime, setDueDatetime] = useState('');
  const [startDatetime, setStartDatetime] = useState('');
  const [difficulty, setDifficulty] = useState<number>(2);
  const [priority, setPriority] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'>('MEDIUM');
  const [status, setStatus] = useState<TaskStatus>('TODO');

  // Subtasks
  const [subtasks, setSubtasks] = useState<SubtaskItem[]>([]);
  const [newSubtaskInput, setNewSubtaskInput] = useState('');

  // Tags
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [customTagInput, setCustomTagInput] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Conflict State
  const [conflicts, setConflicts] = useState<any[]>([]);
  const [showConflictModal, setShowConflictModal] = useState(false);
  const [pendingSaveData, setPendingSaveData] = useState<any>(null);

  // Load courses, nodes, and schedules when modal opens
  useEffect(() => {
    if (!isOpen) return;

    setIsLoadingCourses(true);
    const promises: Promise<any>[] = [
      api.courses.list(),
      api.courses.getAllNodes(),
    ];

    if (!propsFixedSchedules || propsFixedSchedules.length === 0) {
      promises.push(api.schedules.list(true));
    }

    Promise.all(promises)
      .then(([cList, nList, sList]) => {
        setCourses(cList || []);
        setAllCourseNodes(nList || []);
        if (sList) {
          setFixedSchedulesList(sList);
        } else if (propsFixedSchedules) {
          setFixedSchedulesList(propsFixedSchedules);
        }

        const targetNodeId = taskToEdit?.course_node_id || initialCourseNodeId;
        if (targetNodeId) {
          const found = (nList || []).find((n: CourseNode) => n.id === targetNodeId);
          if (found) {
            setSelectedCourseId(found.course_id);
            setCourseNodeId(found.id);
          }
        }
      })
      .catch((err) => {
        console.warn('Failed to load courses or schedules in TaskModal:', err);
      })
      .finally(() => {
        setIsLoadingCourses(false);
      });
  }, [isOpen, taskToEdit?.course_node_id, initialCourseNodeId, propsFixedSchedules]);

  // Reset or populate on open/edit
  useEffect(() => {
    if (!isOpen) return;

    if (taskToEdit) {
      setTitle(taskToEdit.title || '');
      setTitleError(false);
      setDescription(taskToEdit.description || '');
      setCourseNodeId(taskToEdit.course_node_id ?? undefined);
      setScheduledWithFixedId(taskToEdit.scheduled_with_fixed_id ?? undefined);
      setDueDatetime(parseBackendDatetimeToLocalInput(taskToEdit.due_datetime));
      setStartDatetime(parseBackendDatetimeToLocalInput(taskToEdit.start_datetime));
      setDifficulty(taskToEdit.difficulty ?? 2);
      setPriority(taskToEdit.priority || 'MEDIUM');
      setStatus(taskToEdit.status || 'TODO');

      // Populate subtasks from task
      if (taskToEdit.subtasks && taskToEdit.subtasks.length > 0) {
        setSubtasks(taskToEdit.subtasks.map((st: any) => ({
          id: st.id,
          title: st.title,
          is_completed: Boolean(st.is_completed),
        })));
      } else {
        setSubtasks([]);
      }
    } else {
      setTitle(initialTitle || '');
      setTitleError(false);
      setDescription('');
      setSelectedCourseId(undefined);
      setCourseNodeId(initialCourseNodeId);
      setScheduledWithFixedId(initialFixedScheduleId);

      if (initialDate) {
        setDueDatetime(`${initialDate}T21:00`);
      } else {
        const now = new Date();
        now.setHours(21, 0, 0, 0);
        setDueDatetime(toLocalInputString(now));
      }
      setStartDatetime('');
      setDifficulty(2);
      setPriority('MEDIUM');
      setStatus(initialStatus || 'TODO');
      setSubtasks([]);
      setSelectedTags([]);
      setScheduleDayFilter('ALL');
    }
  }, [
    isOpen,
    taskToEdit,
    initialDate,
    initialTitle,
    initialCourseNodeId,
    initialFixedScheduleId,
    initialStatus,
  ]);

  // Derived Values
  const availableLessons = allCourseNodes.filter((n) => n.course_id === Number(selectedCourseId));
  const selectedCourse = courses.find((c) => c.id === Number(selectedCourseId));
  const selectedLesson = allCourseNodes.find((n) => n.id === Number(courseNodeId));
  const selectedFixedSchedule = fixedSchedulesList.find((s) => s.id === Number(scheduledWithFixedId));

  // Grouped Fixed Schedules by Day of Week
  const groupedFixedSchedules = useMemo(() => {
    const groups: { dayIndex: number; label: string; items: FixedSchedule[] }[] = [];
    for (let i = 0; i <= 6; i++) {
      if (scheduleDayFilter !== 'ALL' && scheduleDayFilter !== i) continue;
      const items = fixedSchedulesList.filter((s) => s.day_of_week === i);
      if (items.length > 0) {
        const sorted = [...items].sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''));
        groups.push({
          dayIndex: i,
          label: `📅 ${DAY_LABELS[i]}`,
          items: sorted,
        });
      }
    }
    return groups;
  }, [fixedSchedulesList, scheduleDayFilter]);

  // Subtask Progress
  const completedSubtasksCount = useMemo(() => {
    return subtasks.filter((s) => s.is_completed).length;
  }, [subtasks]);

  const subtasksProgressPercent = useMemo(() => {
    if (subtasks.length === 0) return 0;
    return Math.round((completedSubtasksCount / subtasks.length) * 100);
  }, [subtasks, completedSubtasksCount]);

  // Deadline Countdown Info
  const countdownInfo = useMemo(() => {
    if (!dueDatetime) return null;
    const due = new Date(dueDatetime);
    if (isNaN(due.getTime())) return null;
    const now = new Date();
    const diffMs = due.getTime() - now.getTime();

    if (diffMs < 0) {
      const absMs = Math.abs(diffMs);
      const hours = Math.floor(absMs / (1000 * 60 * 60));
      const mins = Math.floor((absMs % (1000 * 60 * 60)) / (1000 * 60));
      const days = Math.floor(hours / 24);
      if (days > 0) {
        return { isOverdue: true, text: `Quá hạn ${days} ngày ${hours % 24}h`, badgeClass: 'text-rose-600 bg-rose-50 dark:bg-rose-950/60 border-rose-200 dark:border-rose-900/60' };
      }
      if (hours > 0) {
        return { isOverdue: true, text: `Quá hạn ${hours}h ${mins}p`, badgeClass: 'text-rose-600 bg-rose-50 dark:bg-rose-950/60 border-rose-200 dark:border-rose-900/60' };
      }
      return { isOverdue: true, text: `Quá hạn ${mins} phút`, badgeClass: 'text-rose-600 bg-rose-50 dark:bg-rose-950/60 border-rose-200 dark:border-rose-900/60' };
    }

    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    const days = Math.floor(hours / 24);

    if (days > 1) {
      return { isOverdue: false, text: `Còn ${days} ngày ${hours % 24}h`, badgeClass: 'text-sky-600 bg-sky-50 dark:bg-sky-950/60 border-sky-200 dark:border-sky-800' };
    }
    if (days === 1) {
      return { isOverdue: false, text: `Còn 1 ngày ${hours % 24}h (Ngày mai)`, badgeClass: 'text-amber-600 bg-amber-50 dark:bg-amber-950/60 border-amber-200 dark:border-amber-800' };
    }
    if (hours > 0) {
      return { isOverdue: false, text: `Còn ${hours}h ${mins}p (Hôm nay)`, badgeClass: 'text-amber-600 bg-amber-50 dark:bg-amber-950/60 border-amber-200 dark:border-amber-800' };
    }
    return { isOverdue: false, text: `Còn ${mins} phút (Gấp)`, badgeClass: 'text-rose-600 bg-rose-50 dark:bg-rose-950/60 border-rose-200 dark:border-rose-900/60' };
  }, [dueDatetime]);

  // Subtask Actions
  const handleAddSubtask = () => {
    if (newSubtaskInput.trim()) {
      setSubtasks([...subtasks, { title: newSubtaskInput.trim(), is_completed: false }]);
      setNewSubtaskInput('');
    }
  };

  const handleToggleSubtask = async (index: number) => {
    const target = subtasks[index];
    const updated = subtasks.map((st, i) => (i === index ? { ...st, is_completed: !st.is_completed } : st));
    setSubtasks(updated);

    if (taskToEdit && target.id) {
      try {
        await api.tasks.toggleSubtask(target.id);
      } catch (err) {
        console.warn('Failed to toggle subtask on backend:', err);
      }
    }
  };

  const handleMoveSubtask = (index: number, direction: 'UP' | 'DOWN') => {
    const targetIndex = direction === 'UP' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= subtasks.length) return;
    const newItems = [...subtasks];
    const [moved] = newItems.splice(index, 1);
    newItems.splice(targetIndex, 0, moved);
    setSubtasks(newItems);
  };

  const handleRemoveSubtask = async (index: number) => {
    const target = subtasks[index];
    setSubtasks(subtasks.filter((_, i) => i !== index));

    if (taskToEdit && target.id) {
      try {
        await api.tasks.deleteSubtask(target.id);
      } catch (err) {
        console.warn('Failed to delete subtask on backend:', err);
      }
    }
  };

  // Helper to apply time from selected fixed schedule
  const handleApplyFixedScheduleTime = (schedId: number) => {
    const sched = fixedSchedulesList.find((s) => s.id === schedId);
    if (!sched) return;
    const baseDate = startDatetime
      ? startDatetime.slice(0, 10)
      : dueDatetime
      ? dueDatetime.slice(0, 10)
      : initialDate || toLocalDateString();
    setStartDatetime(`${baseDate}T${sched.start_time.slice(0, 5)}`);
    setDueDatetime(`${baseDate}T${sched.end_time.slice(0, 5)}`);
  };

  // Tag helper
  const handleToggleTag = (tag: string) => {
    setSelectedTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  };

  const handleAddCustomTag = () => {
    let clean = customTagInput.trim();
    if (!clean) return;
    if (!clean.startsWith('#')) clean = `#${clean}`;
    if (!selectedTags.includes(clean)) {
      setSelectedTags([...selectedTags, clean]);
    }
    setCustomTagInput('');
  };

  const proceedSave = async (data: any) => {
    setIsSubmitting(true);
    try {
      await onSave(data);

      if (taskToEdit && subtasks.length > 0) {
        for (const st of subtasks) {
          if (!st.id && st.title.trim()) {
            try {
              await api.tasks.addSubtask(taskToEdit.id, st.title.trim());
            } catch (e) {
              console.warn('Failed to add newly created subtask:', e);
            }
          }
        }
      }

      onClose();
    } catch (err: any) {
      console.error('Failed to save task:', err);
      alert('Lỗi khi lưu nhiệm vụ: ' + (err?.message || 'Vui lòng kiểm tra lại'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setTitleError(true);
      scrollBodyRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
      titleInputRef.current?.focus();
      return;
    }

    const safeStart = formatDatetimeForBackend(startDatetime);
    const safeDue = formatDatetimeForBackend(dueDatetime);

    // Combine description and tags if tags are selected
    let finalDescription = description.trim();
    if (selectedTags.length > 0) {
      const tagLine = selectedTags.join(' ');
      if (!finalDescription.includes(tagLine)) {
        finalDescription = finalDescription ? `${finalDescription}\n\n${tagLine}` : tagLine;
      }
    }

    const data: any = {
      title: title.trim(),
      description: finalDescription || null,
      course_node_id: courseNodeId ? Number(courseNodeId) : null,
      scheduled_with_fixed_id: scheduledWithFixedId ? Number(scheduledWithFixedId) : null,
      start_datetime: safeStart || null,
      due_datetime: safeDue || null,
      difficulty,
      priority,
      status,
      // Clear out deprecated fields
      goal_id: null,
      project_id: null,
      recurrence_rule: null,
      subtask_titles: subtasks.length > 0 ? subtasks.map((s) => s.title) : undefined,
    };

    if (safeStart && safeDue) {
      try {
        const res = await api.tasks.checkConflict(safeStart, safeDue);
        if (res.has_conflict) {
          setConflicts(res.conflicts);
          setPendingSaveData(data);
          setShowConflictModal(true);
          return;
        }
      } catch (err) {
        console.warn('Failed to check conflict:', err);
      }
    }

    await proceedSave(data);
  };

  if (!isOpen) return null;

  return (
    <>
      {/* 1. Backdrop Overlay */}
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
        <form
          onSubmit={handleSubmit}
          className="relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-5xl w-full shadow-2xl my-auto max-h-[92vh] flex flex-col overflow-hidden"
        >
          {/* Subtle Sparkling Glow Gradient Top Border */}
          <div className="h-1.5 w-full bg-gradient-to-r from-amber-400 via-indigo-500 to-emerald-400 shrink-0" />

          {/* Modal Header */}
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-850/60 shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
                <Sparkles className="w-4 h-4 animate-spin-slow" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base leading-tight">
                  {taskToEdit ? 'Chỉnh sửa Nhiệm vụ' : 'Tạo Nhiệm vụ mới'}
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Thiết lập thông tin, lịch trình thực hiện và liên kết môn học
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition p-1.5 rounded-lg hover:bg-slate-200/60 dark:hover:bg-slate-800 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Modal Form Body: Balanced 2-Column Layout */}
          <div ref={scrollBodyRef} className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              
              {/* ================= LEFT COLUMN: THÔNG TIN CHÍNH, LỊCH TRÌNH & TKB ================= */}
              <div className="lg:col-span-7 space-y-4">
                
                {/* 1. Tiêu đề nhiệm vụ (Autofocus + Error Ring + Quick Suggestions) */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-slate-900 dark:text-slate-100 font-bold text-xs flex items-center gap-1.5">
                      <span>Tiêu đề nhiệm vụ</span>
                      <span className="text-rose-500">*</span>
                    </label>
                    {titleError && (
                      <span className="text-[11px] font-semibold text-rose-500 animate-pulse">
                        ⚠️ Vui lòng nhập tiêu đề nhiệm vụ
                      </span>
                    )}
                  </div>
                  <input
                    ref={titleInputRef}
                    type="text"
                    required
                    placeholder="VD: Ôn 50 câu tích phân, Soạn slide thuyết trình..."
                    value={title}
                    onChange={(e) => {
                      setTitle(e.target.value);
                      if (e.target.value.trim()) setTitleError(false);
                    }}
                    className={`w-full bg-slate-50 dark:bg-slate-800/90 border rounded-xl px-3.5 py-2.5 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none font-medium text-xs sm:text-sm shadow-2xs transition ${
                      titleError
                        ? 'border-rose-500 ring-2 ring-rose-500/20'
                        : 'border-slate-300 dark:border-slate-700 focus:ring-2 focus:ring-indigo-500'
                    }`}
                    autoFocus
                  />

                  {/* Gợi ý tiêu đề nhanh */}
                  <div className="flex items-center gap-1.5 flex-wrap mt-2">
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">Gợi ý nhanh:</span>
                    {QUICK_TITLES.map((qt) => (
                      <button
                        key={qt}
                        type="button"
                        onClick={() => {
                          setTitle(qt);
                          setTitleError(false);
                        }}
                        className="text-[10px] px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200/80 dark:border-slate-700/60 transition cursor-pointer"
                      >
                        {qt}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 2. Priority & Status */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1 text-xs flex items-center gap-1">
                      <Flag className="w-3.5 h-3.5 text-rose-500" />
                      <span>Mức ưu tiên</span>
                    </label>
                    <select
                      value={priority}
                      onChange={(e: any) => setPriority(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium cursor-pointer"
                    >
                      <option value="LOW">⚪ Thấp</option>
                      <option value="MEDIUM">🔵 Trung bình</option>
                      <option value="HIGH">🟠 Ưu tiên cao</option>
                      <option value="URGENT">🔴 Khẩn cấp</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1 text-xs flex items-center gap-1">
                      <CheckSquare className="w-3.5 h-3.5 text-emerald-500" />
                      <span>Trạng thái</span>
                    </label>
                    <select
                      value={status}
                      onChange={(e: any) => setStatus(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium cursor-pointer"
                    >
                      <option value="TODO">Chưa bắt đầu</option>
                      <option value="IN_PROGRESS">Đang thực hiện</option>
                      <option value="PARTIAL">Hoàn thành 1 phần</option>
                      <option value="COMPLETED">Đã hoàn thành</option>
                      <option value="DELAYED">Chậm trễ</option>
                      <option value="CANCELLED">Đã hủy</option>
                    </select>
                  </div>
                </div>

                {/* 3. Difficulty (1-5) & Explanatory XP Mechanism */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-slate-700 dark:text-slate-300 font-semibold text-xs flex items-center gap-1.5">
                      <Flame className="w-3.5 h-3.5 text-amber-500" />
                      <span>Độ khó nhiệm vụ</span>
                    </label>
                    <span className="text-[11px] text-amber-600 dark:text-amber-400 font-bold bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-md border border-amber-200 dark:border-amber-800 flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-amber-500" />
                      <span>+{difficulty} điểm thưởng XP</span>
                    </span>
                  </div>

                  <div className="flex gap-1.5">
                    {[1, 2, 3, 4, 5].map((level) => {
                      const isSelected = difficulty === level;
                      const cfg = DIFFICULTY_CONFIG[level];
                      return (
                        <button
                          type="button"
                          key={level}
                          onClick={() => setDifficulty(level)}
                          className={`flex-1 py-1.5 rounded-lg border text-xs font-bold transition flex flex-col items-center gap-0.5 cursor-pointer ${
                            isSelected
                              ? 'bg-slate-900 border-slate-900 text-white dark:bg-white dark:border-white dark:text-slate-900 shadow-xs'
                              : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
                          }`}
                          title={`${level} - ${cfg?.label || ''}`}
                        >
                          <span>{level}</span>
                          <span className="text-[9px] font-normal opacity-80">{cfg?.label || ''}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 4. Smart Schedule Picker (2-Way Duration, Presets & 24H) */}
                <div className="pt-1">
                  <SmartSchedulePicker
                    startDatetime={startDatetime}
                    dueDatetime={dueDatetime}
                    onStartChange={(val) => setStartDatetime(val)}
                    onDueChange={(val) => setDueDatetime(val)}
                  />
                </div>

                {/* 5. ĐÍNH KÈM LỊCH CỐ ĐỊNH (TKB) - PHÂN CHIA RÕ RÀNG THEO THỨ (T2-CN) */}
                <div className="p-3.5 rounded-2xl bg-gradient-to-br from-indigo-50/70 to-purple-50/40 dark:from-indigo-950/30 dark:to-purple-950/20 border border-indigo-200/70 dark:border-indigo-800/60 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <label className="text-slate-900 dark:text-slate-100 font-bold text-xs flex items-center gap-1.5">
                      <Pin className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                      <span>Đính kèm Lịch cố định (TKB)</span>
                    </label>
                    {selectedFixedSchedule && (
                      <button
                        type="button"
                        onClick={() => handleApplyFixedScheduleTime(selectedFixedSchedule.id)}
                        className="text-[10px] px-2 py-0.5 rounded font-semibold text-indigo-700 dark:text-indigo-300 bg-indigo-100/80 dark:bg-indigo-900/60 hover:bg-indigo-200 dark:hover:bg-indigo-800 border border-indigo-300 dark:border-indigo-700 transition flex items-center gap-1 shadow-2xs cursor-pointer"
                        title="Tự động điền khung giờ của lịch cố định này vào nhiệm vụ"
                      >
                        <Sparkles className="w-3 h-3 text-amber-500" />
                        <span>Áp dụng giờ ({selectedFixedSchedule.start_time} - {selectedFixedSchedule.end_time})</span>
                      </button>
                    )}
                  </div>

                  {/* Day Filter Chips (Tất cả, T2, T3, ..., CN) */}
                  <div className="flex items-center gap-1 overflow-x-auto pb-0.5 scrollbar-none">
                    <button
                      type="button"
                      onClick={() => setScheduleDayFilter('ALL')}
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border transition cursor-pointer whitespace-nowrap ${
                        scheduleDayFilter === 'ALL'
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                          : 'bg-white/80 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-indigo-200 dark:border-indigo-800/60 hover:bg-indigo-100/50'
                      }`}
                    >
                      Tất cả thứ
                    </button>
                    {DOW_SHORT.map((dow, idx) => (
                      <button
                        key={dow}
                        type="button"
                        onClick={() => setScheduleDayFilter(idx)}
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border transition cursor-pointer whitespace-nowrap ${
                          scheduleDayFilter === idx
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                            : 'bg-white/80 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-indigo-200 dark:border-indigo-800/60 hover:bg-indigo-100/50'
                        }`}
                      >
                        {dow}
                      </button>
                    ))}
                  </div>

                  {/* Dropdown with Optgroups grouped by Day */}
                  <select
                    value={scheduledWithFixedId || ''}
                    onChange={(e) => {
                      const val = e.target.value ? Number(e.target.value) : undefined;
                      setScheduledWithFixedId(val);
                      if (val) {
                        handleApplyFixedScheduleTime(val);
                      }
                    }}
                    className="w-full bg-white dark:bg-slate-800 border border-indigo-200 dark:border-indigo-800 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium cursor-pointer"
                  >
                    <option value="">-- Không đính kèm lịch cố định --</option>
                    {groupedFixedSchedules.length === 0 ? (
                      <option disabled value="">(Không có lịch nào cho ngày này)</option>
                    ) : (
                      groupedFixedSchedules.map((group) => (
                        <optgroup key={group.dayIndex} label={group.label}>
                          {group.items.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.icon || '📌'} {s.title} · [{s.start_time} - {s.end_time}]
                            </option>
                          ))}
                        </optgroup>
                      ))
                    )}
                  </select>
                </div>

                {/* 6. Mô tả & Ghi chú (Description) + Tags */}
                <div className="space-y-2 pt-1 border-t border-slate-200/70 dark:border-slate-800">
                  <div className="flex items-center justify-between">
                    <label className="text-slate-900 dark:text-slate-100 font-bold text-xs flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-slate-500" />
                      <span>Ghi chú & Đề bài / Tài liệu</span>
                    </label>
                  </div>
                  <textarea
                    rows={2}
                    placeholder="Ghi chú chi tiết đề bài, tài liệu hoặc link nộp bài LMS..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none"
                  />

                  {/* Hashtags */}
                  <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                    <span className="text-[10px] text-slate-400 font-medium flex items-center gap-0.5">
                      <Hash className="w-3 h-3" />
                      <span>Tags:</span>
                    </span>
                    {POPULAR_TAGS.map((tag) => {
                      const isSelected = selectedTags.includes(tag);
                      return (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => handleToggleTag(tag)}
                          className={`text-[10px] px-2 py-0.5 rounded-md border transition cursor-pointer ${
                            isSelected
                              ? 'bg-indigo-600 border-indigo-600 text-white font-semibold'
                              : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-indigo-400'
                          }`}
                        >
                          {tag}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* ================= RIGHT COLUMN: KHÓA HỌC / TIẾT HỌC, LIVE PREVIEW & VIỆC CON ================= */}
              <div className="lg:col-span-5 space-y-4">
                
                {/* 1. ĐÍNH KÈM KHÓA HỌC / MÔN HỌC & TIẾT HỌC (CHUYỂN QUA BÊN PHẢI NHƯ YÊU CẦU) */}
                <div className="p-3.5 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/60 space-y-2.5">
                  <div className="text-[11px] font-bold text-emerald-900 dark:text-emerald-300 uppercase tracking-wider flex items-center gap-1.5">
                    <BookOpen className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>Đính kèm Môn học & Tiết học cụ thể</span>
                  </div>

                  <div className="space-y-2">
                    <div>
                      <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1 text-xs">
                        Môn học / Khóa học
                      </label>
                      <select
                        value={selectedCourseId || ''}
                        onChange={(e) => {
                          const val = e.target.value ? Number(e.target.value) : undefined;
                          setSelectedCourseId(val);
                          setCourseNodeId(undefined);
                        }}
                        className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
                      >
                        <option value="">-- Không chọn môn học --</option>
                        {courses.map((c) => (
                          <option key={c.id} value={c.id}>
                            📚 {c.title}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1 text-xs flex items-center gap-1">
                        <GraduationCap className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                        <span>Bài học / Tiết cụ thể</span>
                      </label>
                      <select
                        value={courseNodeId || ''}
                        disabled={!selectedCourseId || availableLessons.length === 0}
                        onChange={(e) => {
                          const val = e.target.value ? Number(e.target.value) : undefined;
                          setCourseNodeId(val);
                          if (val && !title.trim()) {
                            const found = availableLessons.find((l) => l.id === val);
                            if (found) {
                              setTitle(`Học: ${found.title}`);
                              setTitleError(false);
                              if (found.difficulty && !taskToEdit) {
                                setDifficulty(found.difficulty);
                              }
                            }
                          }
                        }}
                        className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:opacity-50 cursor-pointer"
                      >
                        <option value="">
                          {!selectedCourseId
                            ? '-- Chọn môn học trước --'
                            : isLoadingCourses
                            ? 'Đang tải...'
                            : availableLessons.length === 0
                            ? '-- Chưa có bài học --'
                            : '-- Chọn bài học cụ thể --'}
                        </option>
                        {availableLessons.map((l) => (
                          <option key={l.id} value={l.id}>
                            {l.type === 'LESSON' ? '📖 ' : l.type === 'CHAPTER' ? '📁 ' : '📝 '}
                            {l.title} {l.duration ? `(${l.duration}p)` : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* 2. THẺ XEM TRƯỚC THỰC TẾ (LIVE PREVIEW CARD) */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                    <span className="flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                      <span>Xem trước hiển thị</span>
                    </span>
                    <span className="text-[10px] font-normal text-slate-400">Thời gian thực</span>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-750 shadow-md space-y-2.5">
                    {/* Header: Priority & Difficulty */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full border ${PRIORITY_CONFIG[priority]?.badgeBg} ${PRIORITY_CONFIG[priority]?.textColor} ${PRIORITY_CONFIG[priority]?.borderColor}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${PRIORITY_CONFIG[priority]?.dotColor}`} />
                          <span>{PRIORITY_CONFIG[priority]?.label}</span>
                        </span>
                        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-md border ${TASK_STATUS_COLORS[status]?.bg} ${TASK_STATUS_COLORS[status]?.text} ${TASK_STATUS_COLORS[status]?.border}`}>
                          {TASK_STATUS_LABELS[status]}
                        </span>
                      </div>

                      <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-md border border-amber-200 dark:border-amber-800">
                        🔥 Cấp {difficulty} · +{difficulty} XP
                      </span>
                    </div>

                    {/* Task Title */}
                    <div>
                      <h4 className={`text-sm font-bold text-slate-900 dark:text-slate-100 ${!title.trim() ? 'italic text-slate-400 dark:text-slate-500' : ''}`}>
                        {title.trim() || 'Chưa nhập tiêu đề nhiệm vụ...'}
                      </h4>
                      {description.trim() && (
                        <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 line-clamp-2">
                          {description.trim()}
                        </p>
                      )}
                    </div>

                    {/* Badges: Course & Fixed Schedule */}
                    {(selectedCourse || selectedFixedSchedule) && (
                      <div className="flex flex-wrap gap-1.5 text-[11px]">
                        {selectedCourse && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 font-medium">
                            <BookOpen className="w-3 h-3 text-emerald-600" />
                            <span>{selectedCourse.title}</span>
                            {selectedLesson && <span>· {selectedLesson.title}</span>}
                          </span>
                        )}

                        {selectedFixedSchedule && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 font-medium">
                            <Pin className="w-3 h-3 text-indigo-600" />
                            <span>{selectedFixedSchedule.icon || '📌'} {selectedFixedSchedule.title}</span>
                          </span>
                        )}
                      </div>
                    )}

                    {/* Deadline Countdown & Time */}
                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
                        <Clock className="w-3.5 h-3.5 text-slate-500" />
                        <span>
                          {dueDatetime ? dueDatetime.slice(11, 16) : '21:00'} ({dueDatetime ? dueDatetime.slice(0, 10) : 'Hôm nay'})
                        </span>
                      </div>

                      {countdownInfo && (
                        <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full border ${countdownInfo.badgeClass}`}>
                          <span>⏳ {countdownInfo.text}</span>
                        </span>
                      )}
                    </div>

                    {/* Subtask Progress in Preview */}
                    {subtasks.length > 0 && (
                      <div className="space-y-1 pt-1">
                        <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                          <span>Tiến độ việc con:</span>
                          <span className="font-bold font-mono text-slate-700 dark:text-slate-300">
                            {completedSubtasksCount}/{subtasks.length} ({subtasksProgressPercent}%)
                          </span>
                        </div>
                        <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
                          <div
                            className="bg-emerald-500 h-full transition-all duration-300 rounded-full"
                            style={{ width: `${subtasksProgressPercent}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* 3. DANH SÁCH VIỆC CON (SUBTASKS CHECKLIST) */}
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-850/60 border border-slate-200 dark:border-slate-800 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <label className="text-slate-900 dark:text-slate-100 font-bold text-xs flex items-center gap-1.5">
                      <CheckSquare className="w-3.5 h-3.5 text-emerald-500" />
                      <span>Danh sách việc con ({subtasks.length})</span>
                    </label>
                    {subtasks.length > 0 && (
                      <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 font-mono">
                        {completedSubtasksCount}/{subtasks.length} xong
                      </span>
                    )}
                  </div>

                  {/* Input Thêm việc con */}
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Nhập việc con..."
                      value={newSubtaskInput}
                      onChange={(e) => setNewSubtaskInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddSubtask();
                        }
                      }}
                      className="flex-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                    <button
                      type="button"
                      onClick={handleAddSubtask}
                      className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs transition shadow-2xs flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Thêm</span>
                    </button>
                  </div>

                  {/* List of Subtasks */}
                  {subtasks.length > 0 ? (
                    <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                      {subtasks.map((st, i) => (
                        <div
                          key={i}
                          className={`flex items-center justify-between py-1.5 px-2.5 rounded-xl border text-xs transition ${
                            st.is_completed
                              ? 'bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/60 text-slate-500 dark:text-slate-400'
                              : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100'
                          }`}
                        >
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <button
                              type="button"
                              onClick={() => handleToggleSubtask(i)}
                              className={`w-4 h-4 rounded-md border flex items-center justify-center transition cursor-pointer shrink-0 ${
                                st.is_completed
                                  ? 'bg-emerald-500 border-emerald-500 text-white'
                                  : 'border-slate-300 dark:border-slate-600 hover:border-emerald-500'
                              }`}
                            >
                              {st.is_completed && <Check className="w-3 h-3 stroke-[3]" />}
                            </button>
                            <span className={`truncate ${st.is_completed ? 'line-through text-slate-400 dark:text-slate-500' : 'font-medium'}`}>
                              {st.title}
                            </span>
                          </div>

                          <div className="flex items-center gap-1 ml-2 shrink-0">
                            <button
                              type="button"
                              disabled={i === 0}
                              onClick={() => handleMoveSubtask(i, 'UP')}
                              className="p-1 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 disabled:opacity-20 transition cursor-pointer"
                              title="Chuyển lên trên"
                            >
                              <ArrowUp className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              disabled={i === subtasks.length - 1}
                              onClick={() => handleMoveSubtask(i, 'DOWN')}
                              className="p-1 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 disabled:opacity-20 transition cursor-pointer"
                              title="Chuyển xuống dưới"
                            >
                              <ArrowDown className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoveSubtask(i)}
                              className="p-1 rounded text-slate-400 hover:text-rose-500 transition cursor-pointer"
                              title="Xóa việc con này"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-2 text-[11px] text-slate-400 italic">
                      Chưa có việc con nào. Chia nhỏ nhiệm vụ giúp tăng 40% khả năng hoàn thành.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Sticky Modal Footer */}
          <div className="p-3.5 sm:p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-850/90 backdrop-blur-md shrink-0 flex flex-wrap items-center justify-between gap-3">
            <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              <span>Gán nhiệm vụ vào Lịch cố định để tự động hiển thị trong thời khóa biểu tuần.</span>
            </div>

            <div className="flex items-center gap-2 ml-auto">
              <Button type="button" variant="outline" onClick={onClose}>
                Hủy
              </Button>
              <Button
                type="submit"
                variant="primary"
                disabled={isSubmitting}
                className="relative overflow-hidden group shadow-md shadow-indigo-500/20 px-5"
              >
                <span className="relative z-10 flex items-center gap-1.5 font-bold">
                  <Sparkles className="w-3.5 h-3.5 text-amber-300 animate-pulse" />
                  <span>{isSubmitting ? 'Đang lưu...' : taskToEdit ? 'Lưu thay đổi' : 'Tạo Nhiệm vụ'}</span>
                </span>
              </Button>
            </div>
          </div>
        </form>
      </div>

      {/* Conflict Warning Modal */}
      <ConflictWarningModal
        isOpen={showConflictModal}
        conflicts={conflicts}
        onKeepAnyway={async () => {
          setShowConflictModal(false);
          if (pendingSaveData) await proceedSave(pendingSaveData);
        }}
        onMoveTask={() => {
          setShowConflictModal(false);
        }}
        onCancel={() => {
          setShowConflictModal(false);
          setPendingSaveData(null);
        }}
      />
    </>
  );
};
