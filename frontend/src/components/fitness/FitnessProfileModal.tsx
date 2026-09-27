import React, { useState } from 'react';
import { X, Scale, Droplets, Dumbbell, Activity, Save } from 'lucide-react';
import { FitnessProfile, FitnessProfileInput } from '../../types/fitness';
import { api } from '../../services/api';

interface FitnessProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  profile: FitnessProfile;
}

export const FitnessProfileModal: React.FC<FitnessProfileModalProps> = ({
  isOpen,
  onClose,
  onSaved,
  profile,
}) => {
  const [heightCm, setHeightCm] = useState<number>(profile.height_cm || 170);
  const [weightKg, setWeightKg] = useState<number>(profile.weight_kg || 65);
  const [targetWeightKg, setTargetWeightKg] = useState<number>(profile.target_weight_kg || 65);
  const [weeklyWorkoutTarget, setWeeklyWorkoutTarget] = useState<number>(profile.weekly_workout_target || 4);
  const [runningTargetKmWeekly, setRunningTargetKmWeekly] = useState<number>(profile.running_target_km_weekly || 15);
  const [dailyWaterTargetMl, setDailyWaterTargetMl] = useState<number>(profile.daily_water_target_ml || 2000);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  // Realtime BMI calculation
  const heightM = (heightCm || 170) / 100;
  const bmiVal = heightM > 0 ? Math.round(((weightKg || 65) / (heightM * heightM)) * 10) / 10 : 22;

  let bmiCategory = 'Bình thường';
  let bmiColor = 'text-emerald-500';
  if (bmiVal < 18.5) {
    bmiCategory = 'Thiếu cân (Gầy)';
    bmiColor = 'text-amber-500';
  } else if (bmiVal < 24.9) {
    bmiCategory = 'Thể trạng cân đối (Bình thường)';
    bmiColor = 'text-emerald-500';
  } else if (bmiVal < 29.9) {
    bmiCategory = 'Tiền béo phì (Thừa cân)';
    bmiColor = 'text-orange-500';
  } else {
    bmiCategory = 'Béo phì';
    bmiColor = 'text-rose-500';
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      const payload: FitnessProfileInput = {
        height_cm: heightCm,
        weight_kg: weightKg,
        target_weight_kg: targetWeightKg,
        weekly_workout_target: weeklyWorkoutTarget,
        running_target_km_weekly: runningTargetKmWeekly,
        daily_water_target_ml: dailyWaterTargetMl,
      };
      await api.fitness.updateProfile(payload);
      onSaved();
      onClose();
    } catch (err) {
      console.error('Failed to update fitness profile:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-lg w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0 bg-slate-50/50 dark:bg-slate-850/50">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-violet-100 dark:bg-violet-950/70 text-violet-600 dark:text-violet-400 flex items-center justify-center shrink-0 shadow-2xs">
              <Scale className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-slate-900 dark:text-slate-100">
                Chỉ Số Thể Trạng & Mục Tiêu
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Cập nhật thông số cơ thể, tính toán BMI và định mức tập luyện
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
          {/* Realtime BMI Card */}
          <div className="p-3.5 rounded-2xl bg-violet-50/70 dark:bg-violet-950/30 border border-violet-200/80 dark:border-violet-800/60 flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Chỉ số khối cơ thể (BMI)</span>
              <div className="flex items-baseline gap-2 mt-0.5">
                <span className="text-2xl font-black text-violet-600 dark:text-violet-400 font-mono">
                  {bmiVal}
                </span>
                <span className={`text-xs font-extrabold ${bmiColor}`}>
                  • {bmiCategory}
                </span>
              </div>
            </div>
            <div className="text-right text-[11px] text-slate-500">
              <div>Chuẩn WHO: 18.5 - 24.9</div>
              <div>Cân nặng lý tưởng: {Math.round(22 * heightM * heightM)} kg</div>
            </div>
          </div>

          {/* Chiều cao & Cân nặng */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Chiều cao (cm)
              </label>
              <input
                type="number"
                step="0.5"
                min="50"
                max="250"
                required
                value={heightCm}
                onChange={(e) => setHeightCm(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm font-mono focus:ring-2 focus:ring-violet-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Cân nặng (kg)
              </label>
              <input
                type="number"
                step="0.1"
                min="20"
                max="300"
                required
                value={weightKg}
                onChange={(e) => setWeightKg(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm font-mono focus:ring-2 focus:ring-violet-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Mục tiêu (kg)
              </label>
              <input
                type="number"
                step="0.1"
                min="20"
                max="300"
                required
                value={targetWeightKg}
                onChange={(e) => setTargetWeightKg(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm font-mono focus:ring-2 focus:ring-violet-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Mục tiêu tuần & ngày */}
          <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Định mức & Mục tiêu rèn luyện
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
                  <Dumbbell className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Buổi tập/tuần</span>
                </label>
                <input
                  type="number"
                  min="1"
                  max="14"
                  required
                  value={weeklyWorkoutTarget}
                  onChange={(e) => setWeeklyWorkoutTarget(parseInt(e.target.value) || 1)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm font-mono focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
                  <Activity className="w-3.5 h-3.5 text-sky-500" />
                  <span>Chạy bộ (km/tuần)</span>
                </label>
                <input
                  type="number"
                  step="1"
                  min="0"
                  max="200"
                  required
                  value={runningTargetKmWeekly}
                  onChange={(e) => setRunningTargetKmWeekly(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm font-mono focus:ring-2 focus:ring-sky-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
                  <Droplets className="w-3.5 h-3.5 text-blue-500" />
                  <span>Uống nước (ml/ngày)</span>
                </label>
                <input
                  type="number"
                  step="100"
                  min="500"
                  max="6000"
                  required
                  value={dailyWaterTargetMl}
                  onChange={(e) => setDailyWaterTargetMl(parseInt(e.target.value) || 1000)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold shadow-md transition flex items-center gap-1.5 active:scale-95"
            >
              <Save className="w-4 h-4" />
              <span>{isSubmitting ? 'Đang lưu...' : 'Lưu chỉ số'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
