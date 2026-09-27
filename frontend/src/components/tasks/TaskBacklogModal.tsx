import React from 'react';
import {
  AlertTriangle, CheckCircle2, Circle, Clock, ArrowRight,
  X, Check, CornerDownRight, Calendar, Sparkles, Trash2
} from 'lucide-react';
import { Task, PRIORITY_CONFIG, PriorityLevel } from '../../types';
import { Button } from '../ui/button';

interface PastWeekGroup {
  week_key: string;
  week_number: number;
  year: number;
  label: string;
  tasks: Task[];
}

interface TaskBacklogModalProps {
  isOpen: boolean;
  onClose: () => void;
  pastWeeks: PastWeekGroup[];
  totalUnfinished: number;
  onRolloverAll: () => Promise<void>;
  onToggleStatus: (task: Task) => Promise<void>;
  onTransferIndividual: (task: Task) => void;
  onDeleteTask: (taskId: number) => Promise<void>;
  isRollingOver: boolean;
  currentWeekLabel?: string;
}

export const TaskBacklogModal: React.FC<TaskBacklogModalProps> = ({
  isOpen,
  onClose,
  pastWeeks,
  totalUnfinished,
  onRolloverAll,
  onToggleStatus,
  onTransferIndividual,
  onDeleteTask,
  isRollingOver,
  currentWeekLabel = 'tuần hiện tại',
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl max-w-2xl w-full flex flex-col max-h-[88vh] overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-start justify-between gap-3 bg-amber-50/60 dark:bg-amber-950/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 shadow-xs">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-extrabold text-slate-900 dark:text-slate-100">
                  Nhiệm vụ tồn đọng tuần trước
                </h3>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950/70 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800">
                  {totalUnfinished} việc chưa xong
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Các nhiệm vụ từ tuần trước chưa hoàn tất. Bạn có thể dời tất cả sang {currentWeekLabel} để tiếp tục làm.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body Content */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
          {pastWeeks.length === 0 || totalUnfinished === 0 ? (
            <div className="py-12 text-center text-slate-400 space-y-2">
              <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
              <p className="font-bold text-sm text-slate-700 dark:text-slate-300">
                Tuyệt vời! Không còn nhiệm vụ tồn đọng nào từ các tuần trước.
              </p>
              <p className="text-xs text-slate-500">Mọi công việc của bạn đã được hoàn tất hoặc dời lịch chu đáo.</p>
            </div>
          ) : (
            pastWeeks.map((week) => (
              <div
                key={week.week_key}
                className="bg-slate-50 dark:bg-slate-850/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 space-y-2.5"
              >
                {/* Week Subheader */}
                <div className="flex items-center justify-between text-xs pb-1.5 border-b border-slate-200/80 dark:border-slate-700/80">
                  <div className="flex items-center gap-1.5 font-bold text-slate-800 dark:text-slate-200">
                    <Calendar className="w-3.5 h-3.5 text-amber-500" />
                    <span>{week.label}</span>
                  </div>
                  <span className="text-[11px] font-semibold text-rose-600 dark:text-rose-400">
                    {week.tasks.length} nhiệm vụ
                  </span>
                </div>

                {/* Tasks List */}
                <div className="space-y-2">
                  {week.tasks.map((task) => {
                    const pConfig = PRIORITY_CONFIG[task.priority as PriorityLevel] || PRIORITY_CONFIG.MEDIUM;
                    let dueFormatted = 'Chưa đặt';
                    if (task.due_datetime) {
                      const d = new Date(task.due_datetime);
                      dueFormatted = `${d.getDate()}/${d.getMonth() + 1} • ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
                    }

                    return (
                      <div
                        key={task.id}
                        className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-xl p-2.5 flex items-center justify-between gap-3 shadow-2xs hover:border-slate-300 dark:hover:border-slate-700 transition"
                      >
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <button
                            type="button"
                            onClick={() => onToggleStatus(task)}
                            className="p-1 rounded-md text-slate-400 hover:text-emerald-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition shrink-0"
                            title="Đánh dấu hoàn thành"
                          >
                            <Circle className="w-4 h-4" />
                          </button>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-xs text-slate-900 dark:text-slate-100 truncate" title={task.title}>
                                {task.title}
                              </span>
                              <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded-full border ${pConfig.badgeBg} ${pConfig.textColor} ${pConfig.borderColor} shrink-0`}>
                                {pConfig.label}
                              </span>
                            </div>

                            <div className="flex items-center gap-2 text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                              {task.course_title && (
                                <span className="text-emerald-600 dark:text-emerald-400 truncate">
                                  📚 {task.course_title}
                                </span>
                              )}
                              <span>🗓️ Hạn cũ: <strong className="text-rose-500">{dueFormatted}</strong></span>
                            </div>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => onTransferIndividual(task)}
                            className="px-2 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100 text-indigo-700 dark:text-indigo-300 font-semibold text-[11px] flex items-center gap-1 transition"
                            title="Dời riêng việc này sang ngày cụ thể"
                          >
                            <CornerDownRight className="w-3 h-3" />
                            <span>Dời lịch</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeleteTask(task.id)}
                            className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition"
                            title="Xóa nhiệm vụ này"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-3.5 sm:px-5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-850/60 flex flex-col sm:flex-row items-center justify-between gap-3">
          <span className="text-xs text-slate-500 dark:text-slate-400 text-center sm:text-left">
            {totalUnfinished > 0 ? (
              <>Bấm <strong>"Dời tất cả sang tuần này"</strong> để chuyển hạn chót các việc trên về tuần hiện tại.</>
            ) : (
              'Không có việc tồn đọng cần xử lý.'
            )}
          </span>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Button variant="outline" size="sm" onClick={onClose} className="flex-1 sm:flex-none">
              Đóng
            </Button>
            {totalUnfinished > 0 && (
              <Button
                variant="primary"
                size="sm"
                onClick={onRolloverAll}
                disabled={isRollingOver}
                className="flex-1 sm:flex-none bg-amber-600 hover:bg-amber-700 text-white font-bold"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>{isRollingOver ? 'Đang dời...' : `Dời tất cả ${totalUnfinished} việc sang tuần này`}</span>
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
