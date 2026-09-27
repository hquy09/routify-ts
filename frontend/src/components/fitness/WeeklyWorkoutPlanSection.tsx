import React, { useState } from 'react';
import {
  Calendar,
  CheckCircle2,
  Circle,
  Edit2,
  Dumbbell,
  Timer,
  Save,
  X
} from 'lucide-react';
import { FitnessWeeklyPlan, WorkoutType } from '../../types/fitness';
import { api } from '../../services/api';

interface WeeklyWorkoutPlanSectionProps {
  plans: FitnessWeeklyPlan[];
  onRefresh: () => void;
  onOpenQuickLogForDay?: (plan: FitnessWeeklyPlan) => void;
}

const DAY_NAMES = ['Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy', 'Chủ Nhật'];

export const WeeklyWorkoutPlanSection: React.FC<WeeklyWorkoutPlanSectionProps> = ({
  plans,
  onRefresh,
  onOpenQuickLogForDay,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editingPlans, setEditingPlans] = useState<FitnessWeeklyPlan[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // Today index (0 = Monday, ..., 6 = Sunday)
  const todayRaw = new Date().getDay();
  const currentDayIndex = todayRaw === 0 ? 6 : todayRaw - 1;

  const handleStartEdit = () => {
    setEditingPlans(JSON.parse(JSON.stringify(plans)));
    setIsEditing(true);
  };

  const handleSaveEdit = async () => {
    try {
      setIsSaving(true);
      await api.fitness.updateWeeklyPlans(editingPlans);
      setIsEditing(false);
      onRefresh();
    } catch (err) {
      console.error('Failed to update weekly plans:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleCompleted = async (planId: number) => {
    try {
      await api.fitness.toggleWeeklyPlan(planId);
      onRefresh();
    } catch (err) {
      console.error('Failed to toggle plan status:', err);
    }
  };

  const getWorkoutIcon = (type: string, isRest: boolean) => {
    if (isRest) return '😴';
    switch (type) {
      case 'GYM': return '🏋️‍♂️';
      case 'RUNNING': return '🏃‍♂️';
      case 'CYCLING': return '🚴‍♂️';
      case 'SPORTS': return '⚽';
      case 'SWIMMING': return '🏊‍♂️';
      case 'WALKING': return '🚶‍♂️';
      case 'YOGA': return '🧘‍♂️';
      default: return '💪';
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xs space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-emerald-500" />
          <h3 className="font-extrabold text-sm text-slate-900 dark:text-slate-100">
            Lịch Tập Tuần (Weekly Workout Split)
          </h3>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
            {plans.filter((p) => p.is_completed_this_week).length}/7 ngày xong
          </span>
        </div>

        <div>
          {!isEditing ? (
            <button
              type="button"
              onClick={handleStartEdit}
              className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer"
            >
              <Edit2 className="w-3.5 h-3.5" />
              <span>Chỉnh sửa lịch tuần</span>
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="px-2.5 py-1 rounded-lg text-xs font-semibold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Hủy
              </button>
              <button
                type="button"
                disabled={isSaving}
                onClick={handleSaveEdit}
                className="px-3 py-1 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1 shadow-xs"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{isSaving ? 'Đang lưu...' : 'Lưu lịch'}</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Grid 7 days */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        {(isEditing ? editingPlans : plans).map((plan, idx) => {
          const isToday = plan.day_of_week === currentDayIndex;
          const isDone = plan.is_completed_this_week;

          if (isEditing) {
            return (
              <div
                key={plan.day_of_week}
                className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-850/50 space-y-2 text-xs"
              >
                <div className="font-bold text-slate-700 dark:text-slate-300">
                  {DAY_NAMES[plan.day_of_week]}
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 block mb-0.5">Loại hình</label>
                  <select
                    value={plan.workout_type}
                    onChange={(e) => {
                      const updated = [...editingPlans];
                      updated[idx].workout_type = e.target.value as WorkoutType;
                      updated[idx].is_rest_day = e.target.value === 'REST';
                      setEditingPlans(updated);
                    }}
                    className="w-full p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs"
                  >
                    <option value="GYM">🏋️‍♂️ Gym</option>
                    <option value="RUNNING">🏃‍♂️ Chạy bộ</option>
                    <option value="CYCLING">🚴‍♂️ Đạp xe</option>
                    <option value="SPORTS">⚽ Thể thao</option>
                    <option value="REST">😴 Nghỉ ngơi</option>
                    <option value="YOGA">🧘‍♂️ Yoga</option>
                    <option value="WALKING">🚶‍♂️ Đi bộ</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 block mb-0.5">Tiêu đề bài tập</label>
                  <input
                    type="text"
                    value={plan.title}
                    onChange={(e) => {
                      const updated = [...editingPlans];
                      updated[idx].title = e.target.value;
                      setEditingPlans(updated);
                    }}
                    className="w-full p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 block mb-0.5">Thời lượng (phút)</label>
                  <input
                    type="number"
                    value={plan.target_duration_minutes}
                    onChange={(e) => {
                      const updated = [...editingPlans];
                      updated[idx].target_duration_minutes = parseInt(e.target.value) || 0;
                      setEditingPlans(updated);
                    }}
                    className="w-full p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 block mb-0.5">Ghi chú bài tập</label>
                  <input
                    type="text"
                    value={plan.notes || ''}
                    placeholder="VD: 4 hiệp x 10 cái"
                    onChange={(e) => {
                      const updated = [...editingPlans];
                      updated[idx].notes = e.target.value;
                      setEditingPlans(updated);
                    }}
                    className="w-full p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-[11px]"
                  />
                </div>
              </div>
            );
          }

          return (
            <div
              key={plan.id || plan.day_of_week}
              className={`rounded-2xl p-3.5 border transition-all flex flex-col justify-between relative group ${
                isToday
                  ? 'border-emerald-500 bg-emerald-50/40 dark:bg-emerald-950/20 ring-2 ring-emerald-400/40 shadow-xs'
                  : isDone
                  ? 'border-emerald-200 dark:border-emerald-900 bg-emerald-50/20 dark:bg-emerald-950/10'
                  : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850/40 hover:border-slate-300 dark:hover:border-slate-700'
              }`}
            >
              <div>
                {/* Day Header */}
                <div className="flex items-center justify-between gap-1 pb-2 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-1.5">
                    <span className="font-extrabold text-xs text-slate-800 dark:text-slate-200">
                      {DAY_NAMES[plan.day_of_week]}
                    </span>
                    {isToday && (
                      <span className="text-[9px] font-black px-1.5 py-0.2 rounded-full bg-emerald-500 text-white shadow-2xs">
                        Hôm nay
                      </span>
                    )}
                  </div>
                  <span className="text-base">{getWorkoutIcon(plan.workout_type, plan.is_rest_day)}</span>
                </div>

                {/* Workout Title & Details */}
                <div className="my-2.5 space-y-1">
                  <h4
                    className={`font-bold text-xs leading-snug truncate ${
                      isDone ? 'line-through text-slate-400' : 'text-slate-900 dark:text-slate-100'
                    }`}
                    title={plan.title}
                  >
                    {plan.title}
                  </h4>

                  {!plan.is_rest_day && plan.target_duration_minutes > 0 && (
                    <div className="flex items-center gap-1 text-[11px] text-slate-500 font-mono">
                      <Timer className="w-3 h-3 text-slate-400" />
                      <span>{plan.target_duration_minutes} phút</span>
                    </div>
                  )}

                  {plan.notes && (
                    <p className="text-[10px] text-slate-400 line-clamp-2 leading-relaxed" title={plan.notes}>
                      {plan.notes}
                    </p>
                  )}
                </div>
              </div>

              {/* Action Checkbox */}
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => handleToggleCompleted(plan.id)}
                  className={`flex items-center gap-1.5 text-[11px] font-bold transition cursor-pointer ${
                    isDone
                      ? 'text-emerald-600 dark:text-emerald-400 hover:text-emerald-700'
                      : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                  }`}
                >
                  {isDone ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 fill-emerald-100 dark:fill-emerald-950" />
                  ) : (
                    <Circle className="w-4 h-4 text-slate-300 dark:text-slate-600" />
                  )}
                  <span>{isDone ? 'Đã tập xong' : 'Chưa tập'}</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
