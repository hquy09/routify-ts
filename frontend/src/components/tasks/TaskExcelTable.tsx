import React, { useState } from 'react';
import {
  CheckCircle2, Circle, Clock, Flame, CornerDownRight,
  Edit2, Trash2, ArrowUpDown, ArrowUp, ArrowDown,
  Download, Plus, Check, ChevronDown, Sparkles
} from 'lucide-react';
import { Task, TaskStatus, PRIORITY_CONFIG, PriorityLevel, DIFFICULTY_LABELS } from '../../types';

interface TaskExcelTableProps {
  tasks: Task[];
  onToggleStatus: (task: Task) => void;
  onChangeStatus?: (task: Task, newStatus: TaskStatus) => void;
  onEdit: (task: Task) => void;
  onTransfer: (task: Task) => void;
  onDelete: (taskId: number) => void;
  onToggleSubtask: (subtaskId: number) => void;
  onQuickCreate?: (title: string) => void;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
  onSortChange?: (field: string) => void;
}

const STATUS_OPTIONS: { code: TaskStatus; label: string; bg: string; text: string; dot: string }[] = [
  { code: 'TODO', label: 'Chưa bắt đầu', bg: 'bg-slate-100 dark:bg-slate-800', text: 'text-slate-700 dark:text-slate-300', dot: 'bg-slate-400' },
  { code: 'IN_PROGRESS', label: 'Đang thực hiện', bg: 'bg-blue-100 dark:bg-blue-950/70', text: 'text-blue-700 dark:text-blue-300', dot: 'bg-blue-500' },
  { code: 'PARTIAL', label: 'Một phần', bg: 'bg-amber-100 dark:bg-amber-950/70', text: 'text-amber-800 dark:text-amber-300', dot: 'bg-amber-500' },
  { code: 'DELAYED', label: 'Chậm trễ', bg: 'bg-rose-100 dark:bg-rose-950/70', text: 'text-rose-700 dark:text-rose-300', dot: 'bg-rose-500' },
  { code: 'COMPLETED', label: 'Đã hoàn thành', bg: 'bg-emerald-100 dark:bg-emerald-950/70', text: 'text-emerald-800 dark:text-emerald-300', dot: 'bg-emerald-500' },
  { code: 'TRANSFERRED', label: 'Đã chuyển tiếp', bg: 'bg-purple-100 dark:bg-purple-950/70', text: 'text-purple-800 dark:text-purple-300', dot: 'bg-purple-500' },
];

export const TaskExcelTable: React.FC<TaskExcelTableProps> = ({
  tasks,
  onToggleStatus,
  onChangeStatus,
  onEdit,
  onTransfer,
  onDelete,
  onToggleSubtask,
  onQuickCreate,
  sortBy = 'DUE',
  sortOrder = 'ASC',
  onSortChange,
}) => {
  const [quickTitle, setQuickTitle] = useState('');
  const [expandedSubtaskId, setExpandedSubtaskId] = useState<number | null>(null);

  // Compute summary metrics for Excel footer
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter((t) => t.status === 'COMPLETED').length;
  const inProgressTasks = tasks.filter((t) => t.status === 'IN_PROGRESS' || t.status === 'PARTIAL').length;
  const delayedTasks = tasks.filter((t) => t.status === 'DELAYED').length;
  const totalXP = tasks.reduce((sum, t) => sum + (t.status === 'COMPLETED' ? (t.difficulty || 2) : 0), 0);
  const potentialXP = tasks.reduce((sum, t) => sum + (t.difficulty || 2), 0);
  const progressPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  // Handle Quick Create submit
  const handleQuickSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (quickTitle.trim() && onQuickCreate) {
      onQuickCreate(quickTitle.trim());
      setQuickTitle('');
    }
  };

  // Export to Excel CSV with UTF-8 BOM for perfect Vietnamese support
  const exportToExcelCSV = () => {
    if (tasks.length === 0) {
      alert('Không có nhiệm vụ nào để xuất!');
      return;
    }

    const headers = [
      'STT',
      'Tên nhiệm vụ',
      'Trạng thái',
      'Môn học / Lịch',
      'Mục tiêu',
      'Hạn chót (24h)',
      'Mức ưu tiên',
      'Độ khó (XP)',
      'Việc con hoàn thành',
      'Ghi chú / Mô tả',
    ];

    const rows = tasks.map((t, index) => {
      const statusLabel =
        t.status === 'COMPLETED'
          ? 'Đã hoàn thành'
          : t.status === 'IN_PROGRESS'
          ? 'Đang thực hiện'
          : t.status === 'DELAYED'
          ? 'Chậm trễ'
          : t.status === 'PARTIAL'
          ? 'Một phần'
          : t.status === 'TRANSFERRED'
          ? 'Đã chuyển giao'
          : 'Chưa bắt đầu';

      const priorityLabel =
        t.priority === 'URGENT'
          ? 'Khẩn cấp'
          : t.priority === 'HIGH'
          ? 'Cao'
          : t.priority === 'MEDIUM'
          ? 'Trung bình'
          : 'Thấp';

      let dueFormatted = 'Không có hạn';
      if (t.due_datetime) {
        const d = new Date(t.due_datetime);
        dueFormatted = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
      }

      const subtasksSummary = t.subtasks_count > 0 ? `${t.subtasks_completed_count}/${t.subtasks_count}` : '0';

      return [
        index + 1,
        `"${(t.title || '').replace(/"/g, '""')}"`,
        `"${statusLabel}"`,
        `"${(t.course_title || t.scheduled_with_fixed_title || '').replace(/"/g, '""')}"`,
        `"${(t.goal_title || '').replace(/"/g, '""')}"`,
        `"${dueFormatted}"`,
        `"${priorityLabel}"`,
        `"${t.difficulty || 2} XP"`,
        `"${subtasksSummary}"`,
        `"${(t.description || '').replace(/"/g, '""')}"`,
      ];
    });

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Routify_Tasks_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const renderSortIndicator = (field: string) => {
    if (sortBy !== field) {
      return <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-40 ml-1 inline" />;
    }
    return sortOrder === 'ASC' ? (
      <ArrowUp className="w-3 h-3 text-emerald-600 dark:text-emerald-400 ml-1 inline" />
    ) : (
      <ArrowDown className="w-3 h-3 text-amber-600 dark:text-amber-400 ml-1 inline" />
    );
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden flex flex-col">
      {/* 1. Excel Toolbar Header */}
      <div className="bg-slate-50/90 dark:bg-slate-850/80 p-2.5 px-4 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-emerald-600 text-white flex items-center justify-center font-bold text-xs shadow-xs">
            X
          </div>
          <div>
            <span className="font-extrabold text-slate-800 dark:text-slate-100 text-xs">
              Bảng Tính Nhiệm Vụ (Excel Grid View)
            </span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 ml-2">
              {totalTasks} dòng • {completedTasks} hoàn thành ({progressPercent}%)
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={exportToExcelCSV}
            className="px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/50 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 font-semibold text-xs flex items-center gap-1.5 transition active:scale-95 shadow-2xs cursor-pointer"
            title="Xuất danh sách nhiệm vụ ra file Excel .CSV (chuẩn tiếng Việt UTF-8)"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Xuất file Excel (.csv)</span>
          </button>
        </div>
      </div>

      {/* 2. Spreadsheet Table Container */}
      <div className="overflow-x-auto scrollbar-thin">
        <table className="w-full text-left text-xs border-collapse min-w-[960px]">
          {/* Header Row */}
          <thead>
            <tr className="bg-slate-100/90 dark:bg-slate-800/90 border-b border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 select-none uppercase tracking-wider text-[10px] font-bold">
              <th className="py-2.5 px-3 w-12 text-center border-r border-slate-200 dark:border-slate-700/80">#</th>
              <th className="py-2.5 px-3 w-14 text-center border-r border-slate-200 dark:border-slate-700/80">Xong</th>
              <th
                onClick={() => onSortChange && onSortChange('STATUS')}
                className="py-2.5 px-3.5 w-36 cursor-pointer hover:bg-slate-200/60 dark:hover:bg-slate-700/60 border-r border-slate-200 dark:border-slate-700/80"
              >
                Trạng thái {renderSortIndicator('STATUS')}
              </th>
              <th
                onClick={() => onSortChange && onSortChange('TITLE')}
                className="py-2.5 px-3.5 cursor-pointer hover:bg-slate-200/60 dark:hover:bg-slate-700/60 border-r border-slate-200 dark:border-slate-700/80"
              >
                Tên nhiệm vụ {renderSortIndicator('TITLE')}
              </th>
              <th className="py-2.5 px-3 w-40 border-r border-slate-200 dark:border-slate-700/80">Khóa học / Lịch</th>
              <th className="py-2.5 px-3 w-36 border-r border-slate-200 dark:border-slate-700/80">Mục tiêu</th>
              <th
                onClick={() => onSortChange && onSortChange('DUE')}
                className="py-2.5 px-3.5 w-40 cursor-pointer hover:bg-slate-200/60 dark:hover:bg-slate-700/60 border-r border-slate-200 dark:border-slate-700/80"
              >
                Hạn chót {renderSortIndicator('DUE')}
              </th>
              <th
                onClick={() => onSortChange && onSortChange('PRIORITY')}
                className="py-2.5 px-3 w-28 cursor-pointer hover:bg-slate-200/60 dark:hover:bg-slate-700/60 border-r border-slate-200 dark:border-slate-700/80"
              >
                Ưu tiên {renderSortIndicator('PRIORITY')}
              </th>
              <th
                onClick={() => onSortChange && onSortChange('DIFFICULTY')}
                className="py-2.5 px-3 w-24 text-center cursor-pointer hover:bg-slate-200/60 dark:hover:bg-slate-700/60 border-r border-slate-200 dark:border-slate-700/80"
              >
                Độ khó {renderSortIndicator('DIFFICULTY')}
              </th>
              <th className="py-2.5 px-3 w-32 text-center border-r border-slate-200 dark:border-slate-700/80">Việc con</th>
              <th className="py-2.5 px-3 w-24 text-center">Thao tác</th>
            </tr>
          </thead>

          {/* Table Body */}
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {tasks.length === 0 ? (
              <tr>
                <td colSpan={11} className="py-12 text-center text-slate-400 italic">
                  Không có nhiệm vụ nào trong danh sách hiện tại.
                </td>
              </tr>
            ) : (
              tasks.map((task, idx) => {
                const isCompleted = task.status === 'COMPLETED';
                const isDelayed = task.status === 'DELAYED';
                const isExpanded = expandedSubtaskId === task.id;

                // Priority Config
                const pConfig = PRIORITY_CONFIG[task.priority as PriorityLevel] || PRIORITY_CONFIG.MEDIUM;

                // Deadline format
                let deadlineText = 'Chưa đặt';
                let isPast = false;
                let diffDays = 0;
                if (task.due_datetime) {
                  const d = new Date(task.due_datetime);
                  const dayNames = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
                  const dayName = dayNames[d.getDay()];
                  const pad = (n: number) => String(n).padStart(2, '0');
                  deadlineText = `${dayName} ${pad(d.getDate())}/${pad(d.getMonth() + 1)} • ${pad(d.getHours())}:${pad(d.getMinutes())}`;
                  
                  const nowMs = Date.now();
                  const targetMs = d.getTime();
                  diffDays = Math.ceil((targetMs - nowMs) / (1000 * 60 * 60 * 24));
                  isPast = targetMs < nowMs && !isCompleted;
                }

                return (
                  <React.Fragment key={task.id}>
                    <tr
                      className={`transition-colors border-b border-slate-100 dark:border-slate-800/80 group ${
                        isCompleted
                          ? 'bg-emerald-50/20 dark:bg-emerald-950/10 text-slate-400 dark:text-slate-500'
                          : isDelayed
                          ? 'bg-rose-50/30 dark:bg-rose-950/20'
                          : idx % 2 === 0
                          ? 'bg-white dark:bg-slate-900 hover:bg-blue-50/30 dark:hover:bg-blue-950/20'
                          : 'bg-slate-50/50 dark:bg-slate-850/40 hover:bg-blue-50/30 dark:hover:bg-blue-950/20'
                      }`}
                    >
                      {/* 1. STT / Row Index */}
                      <td className="py-2.5 px-3 text-center font-mono text-[11px] text-slate-400 border-r border-slate-200/60 dark:border-slate-700/60">
                        {String(idx + 1).padStart(2, '0')}
                      </td>

                      {/* 2. Quick Checkbox */}
                      <td className="py-2.5 px-3 text-center border-r border-slate-200/60 dark:border-slate-700/60">
                        <button
                          type="button"
                          onClick={() => onToggleStatus(task)}
                          className="p-1 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
                          title={isCompleted ? 'Đánh dấu chưa hoàn thành' : 'Đánh dấu đã hoàn thành'}
                        >
                          {isCompleted ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-500 fill-emerald-100 dark:fill-emerald-950" />
                          ) : (
                            <Circle className="w-4 h-4 text-slate-400 hover:text-emerald-500" />
                          )}
                        </button>
                      </td>

                      {/* 3. Status Column with Dropdown */}
                      <td className="py-2 px-3 border-r border-slate-200/60 dark:border-slate-700/60">
                        <select
                          value={task.status}
                          onChange={(e) => onChangeStatus && onChangeStatus(task, e.target.value as TaskStatus)}
                          className={`w-full text-[11px] font-bold rounded-lg px-2 py-1 border focus:outline-none cursor-pointer transition ${
                            task.status === 'COMPLETED'
                              ? 'bg-emerald-100/80 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
                              : task.status === 'IN_PROGRESS'
                              ? 'bg-blue-100/80 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 border-blue-300 dark:border-blue-800'
                              : task.status === 'DELAYED'
                              ? 'bg-rose-100/80 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border-rose-300 dark:border-rose-800'
                              : task.status === 'PARTIAL'
                              ? 'bg-amber-100/80 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800'
                              : task.status === 'TRANSFERRED'
                              ? 'bg-purple-100/80 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300 border-purple-300 dark:border-purple-800'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                          }`}
                        >
                          <option value="TODO">⏳ Chưa bắt đầu</option>
                          <option value="IN_PROGRESS">🚀 Đang thực hiện</option>
                          <option value="PARTIAL">🌓 Một phần</option>
                          <option value="DELAYED">🔴 Chậm trễ</option>
                          <option value="COMPLETED">✅ Hoàn thành</option>
                          <option value="TRANSFERRED">↪️ Đã chuyển tiếp</option>
                        </select>
                      </td>

                      {/* 4. Task Title */}
                      <td className="py-2.5 px-3.5 border-r border-slate-200/60 dark:border-slate-700/60 max-w-[280px]">
                        <div
                          onClick={() => onEdit(task)}
                          className="cursor-pointer group/title flex flex-col"
                        >
                          <span
                            className={`font-bold text-xs truncate leading-snug group-hover/title:text-blue-600 dark:group-hover/title:text-blue-400 ${
                              isCompleted ? 'line-through text-slate-400 dark:text-slate-500' : 'text-slate-900 dark:text-slate-100'
                            }`}
                            title={task.title}
                          >
                            {task.title}
                          </span>
                          {task.description && (
                            <span className="text-[10px] text-slate-400 truncate mt-0.5" title={task.description}>
                              {task.description}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* 5. Course / Schedule */}
                      <td className="py-2.5 px-3 border-r border-slate-200/60 dark:border-slate-700/60">
                        {task.course_title ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 truncate max-w-[140px]">
                            📚 {task.course_title}
                          </span>
                        ) : task.scheduled_with_fixed_title ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 truncate max-w-[140px]">
                            📌 {task.scheduled_with_fixed_title}
                          </span>
                        ) : (
                          <span className="text-slate-300 dark:text-slate-600 text-[10px] italic">-</span>
                        )}
                      </td>

                      {/* 6. Goal */}
                      <td className="py-2.5 px-3 border-r border-slate-200/60 dark:border-slate-700/60">
                        {task.goal_title ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 truncate max-w-[130px]">
                            🎯 {task.goal_title}
                          </span>
                        ) : (
                          <span className="text-slate-300 dark:text-slate-600 text-[10px] italic">-</span>
                        )}
                      </td>

                      {/* 7. Deadline */}
                      <td className="py-2.5 px-3.5 border-r border-slate-200/60 dark:border-slate-700/60">
                        <div className="flex flex-col">
                          <span className={`font-mono text-[11px] font-semibold ${isPast ? 'text-rose-600 dark:text-rose-400 font-bold' : 'text-slate-700 dark:text-slate-300'}`}>
                            {deadlineText}
                          </span>
                          {task.due_datetime && !isCompleted && (
                            <span className={`text-[10px] ${diffDays < 0 ? 'text-rose-500 font-bold' : diffDays === 0 ? 'text-amber-600 font-bold' : 'text-slate-400'}`}>
                              {diffDays < 0 ? `(Trễ ${Math.abs(diffDays)}d)` : diffDays === 0 ? '(Hôm nay)' : `(Còn ${diffDays}d)`}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* 8. Priority */}
                      <td className="py-2.5 px-3 border-r border-slate-200/60 dark:border-slate-700/60">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${pConfig.badgeBg} ${pConfig.textColor} ${pConfig.borderColor}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${pConfig.dotColor}`} />
                          <span>{pConfig.label}</span>
                        </span>
                      </td>

                      {/* 9. Difficulty / XP */}
                      <td className="py-2.5 px-3 text-center border-r border-slate-200/60 dark:border-slate-700/60">
                        <span className="font-mono text-[11px] font-bold px-1.5 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                          +{task.difficulty || 2} XP
                        </span>
                      </td>

                      {/* 10. Subtasks */}
                      <td className="py-2.5 px-3 text-center border-r border-slate-200/60 dark:border-slate-700/60">
                        {task.subtasks_count > 0 ? (
                          <button
                            type="button"
                            onClick={() => setExpandedSubtaskId(isExpanded ? null : task.id)}
                            className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-[11px] font-mono transition cursor-pointer"
                            title="Bấm để xem danh sách việc con"
                          >
                            <span>{task.subtasks_completed_count}/{task.subtasks_count}</span>
                            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">({task.subtask_progress}%)</span>
                            <ChevronDown className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                          </button>
                        ) : (
                          <span className="text-slate-300 dark:text-slate-600 text-[11px] font-mono">-</span>
                        )}
                      </td>

                      {/* 11. Actions */}
                      <td className="py-2 px-2 text-center">
                        <div className="flex items-center justify-center gap-1 opacity-70 group-hover:opacity-100 transition">
                          <button
                            type="button"
                            onClick={() => onEdit(task)}
                            className="p-1 rounded text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/50 transition cursor-pointer"
                            title="Chỉnh sửa chi tiết"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onTransfer(task)}
                            className="p-1 rounded text-slate-500 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-950/50 transition cursor-pointer"
                            title="Dời lịch sang thời gian khác"
                          >
                            <CornerDownRight className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onDelete(task.id)}
                            className="p-1 rounded text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition cursor-pointer"
                            title="Xóa nhiệm vụ"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>

                    {/* Expandable Subtask Rows inline */}
                    {isExpanded && task.subtasks && task.subtasks.length > 0 && (
                      <tr className="bg-slate-50/80 dark:bg-slate-850/60 border-b border-slate-200/80 dark:border-slate-700/80">
                        <td colSpan={11} className="py-2.5 px-6">
                          <div className="space-y-1.5 pl-6 border-l-2 border-indigo-400">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                              Danh sách việc con của: "{task.title}"
                            </span>
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 pt-1">
                              {task.subtasks.map((st) => (
                                <div
                                  key={st.id}
                                  onClick={() => onToggleSubtask(st.id)}
                                  className={`flex items-center gap-2 p-1.5 px-2 rounded-lg border text-xs cursor-pointer select-none transition ${
                                    st.is_completed
                                      ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/60 text-slate-400 line-through'
                                      : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:border-slate-300'
                                  }`}
                                >
                                  {st.is_completed ? (
                                    <Check className="w-3 h-3 text-emerald-600 shrink-0" />
                                  ) : (
                                    <Circle className="w-3 h-3 text-slate-400 shrink-0" />
                                  )}
                                  <span className="truncate">{st.title}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })
            )}

            {/* Quick Add Row in Excel Table */}
            {onQuickCreate && (
              <tr className="bg-slate-50/40 dark:bg-slate-850/30 border-b border-dashed border-slate-200 dark:border-slate-700">
                <td className="py-2 px-3 text-center text-slate-400 font-mono text-xs">+</td>
                <td className="py-2 px-3 text-center text-slate-300">○</td>
                <td className="py-2 px-3 text-slate-400 text-xs italic font-medium">Chưa bắt đầu</td>
                <td colSpan={8} className="py-1.5 px-3">
                  <form onSubmit={handleQuickSubmit} className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="Thêm dòng nhiệm vụ mới tại đây (nhập tiêu đề và nhấn Enter)..."
                      value={quickTitle}
                      onChange={(e) => setQuickTitle(e.target.value)}
                      className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500 shadow-2xs"
                    />
                    <button
                      type="submit"
                      disabled={!quickTitle.trim()}
                      className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white font-bold text-xs flex items-center gap-1 shrink-0 transition cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Thêm dòng</span>
                    </button>
                  </form>
                </td>
              </tr>
            )}
          </tbody>

          {/* 3. Excel Table Summary Footer */}
          <tfoot>
            <tr className="bg-slate-100 dark:bg-slate-800/90 font-semibold text-slate-700 dark:text-slate-200 text-xs border-t-2 border-slate-300 dark:border-slate-600">
              <td colSpan={3} className="py-2.5 px-3 text-center border-r border-slate-200 dark:border-slate-700">
                <span className="font-extrabold uppercase text-[10px] tracking-wider text-slate-500">
                  TỔNG KẾT BẢNG
                </span>
              </td>
              <td className="py-2.5 px-3 border-r border-slate-200 dark:border-slate-700">
                <span className="font-bold">{totalTasks}</span> nhiệm vụ
              </td>
              <td colSpan={2} className="py-2.5 px-3 border-r border-slate-200 dark:border-slate-700 text-emerald-600 dark:text-emerald-400">
                ✓ {completedTasks} xong ({progressPercent}%)
              </td>
              <td className="py-2.5 px-3 border-r border-slate-200 dark:border-slate-700 text-rose-600 dark:text-rose-400">
                {delayedTasks > 0 ? `⚠️ ${delayedTasks} trễ hạn` : '0 trễ'}
              </td>
              <td className="py-2.5 px-3 border-r border-slate-200 dark:border-slate-700 text-blue-600 dark:text-blue-400">
                {inProgressTasks} đang làm
              </td>
              <td className="py-2.5 px-3 text-center font-mono font-bold text-amber-600 dark:text-amber-400 border-r border-slate-200 dark:border-slate-700">
                +{totalXP} / {potentialXP} XP
              </td>
              <td colSpan={2} className="py-2.5 px-3 text-center text-slate-500 text-[11px]">
                {totalTasks > 0 ? 'Bảng tính đồng bộ' : ''}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
};
