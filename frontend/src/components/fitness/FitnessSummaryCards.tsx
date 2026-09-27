import React, { useState } from 'react';
import {
  Flame,
  Activity,
  Droplets,
  Scale,
  Plus,
  Edit3,
  Dumbbell,
  Timer
} from 'lucide-react';
import { FitnessSummary, FitnessProfile } from '../../types/fitness';
import { api } from '../../services/api';

interface FitnessSummaryCardsProps {
  summary: FitnessSummary;
  profile: FitnessProfile;
  onRefresh: () => void;
  onOpenProfileModal: () => void;
  onOpenWorkoutModal: () => void;
}

export const FitnessSummaryCards: React.FC<FitnessSummaryCardsProps> = ({
  summary,
  profile,
  onRefresh,
  onOpenProfileModal,
  onOpenWorkoutModal,
}) => {
  const [isAddingWater, setIsAddingWater] = useState(false);

  const handleQuickAddWater = async (amount: number) => {
    try {
      setIsAddingWater(true);
      await api.fitness.addWater(amount);
      onRefresh();
    } catch (err) {
      console.error('Failed to log water:', err);
    } finally {
      setIsAddingWater(false);
    }
  };

  const workoutPercent = Math.min(
    100,
    Math.round((summary.total_workouts_week / (summary.weekly_workout_target || 1)) * 100)
  );

  const waterPercent = Math.min(
    100,
    Math.round((summary.today_water_ml / (summary.daily_water_target_ml || 2000)) * 100)
  );

  const runningPercent = Math.min(
    100,
    Math.round((summary.total_distance_km_week / (summary.running_target_km_weekly || 15)) * 100)
  );

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3.5">
      {/* 1. Weekly Workouts */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-2xs flex flex-col justify-between relative overflow-hidden group hover:border-emerald-300 dark:hover:border-emerald-700/60 transition">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            <Dumbbell className="w-3.5 h-3.5 text-emerald-500" />
            <span>Buổi tập tuần</span>
          </span>
          <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
            Mục tiêu: {summary.weekly_workout_target}
          </span>
        </div>

        <div className="my-2.5">
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-slate-900 dark:text-slate-100 font-mono">
              {summary.total_workouts_week}
            </span>
            <span className="text-xs text-slate-400 font-medium">/{summary.weekly_workout_target} buổi</span>
          </div>
          <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 mt-2 overflow-hidden">
            <div
              className="bg-emerald-500 h-full rounded-full transition-all duration-500"
              style={{ width: `${workoutPercent}%` }}
            />
          </div>
        </div>

        <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-100 dark:border-slate-800/80">
          <span className="flex items-center gap-1">
            <Timer className="w-3 h-3 text-slate-400" />
            {summary.total_minutes_week} phút tập
          </span>
          <button
            type="button"
            onClick={onOpenWorkoutModal}
            className="text-emerald-600 dark:text-emerald-400 font-bold hover:underline flex items-center gap-0.5"
          >
            <Plus className="w-3 h-3" />
            <span>Ghi log</span>
          </button>
        </div>
      </div>

      {/* 2. Calories Burned */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-2xs flex flex-col justify-between relative overflow-hidden group hover:border-amber-300 dark:hover:border-amber-700/60 transition">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            <Flame className="w-3.5 h-3.5 text-orange-500" />
            <span>Calo tiêu thụ</span>
          </span>
          <span className="text-[10px] font-mono font-bold text-orange-500">kcal/tuần</span>
        </div>

        <div className="my-2.5">
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-slate-900 dark:text-slate-100 font-mono">
              {summary.total_calories_week.toLocaleString()}
            </span>
            <span className="text-xs text-orange-500 font-bold">kcal</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            ~{Math.round(summary.total_calories_week / 7)} kcal/ngày trung bình
          </p>
        </div>

        <div className="text-[11px] text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
          <span>Đốt cháy năng lượng</span>
          <span className="text-xs">🔥</span>
        </div>
      </div>

      {/* 3. Distance (Running / Cycling / Walking) */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-2xs flex flex-col justify-between relative overflow-hidden group hover:border-sky-300 dark:hover:border-sky-700/60 transition">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-sky-500" />
            <span>Chạy / Đạp xe</span>
          </span>
          <span className="text-[10px] font-mono font-bold text-sky-500">km</span>
        </div>

        <div className="my-2.5">
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-slate-900 dark:text-slate-100 font-mono">
              {summary.total_distance_km_week}
            </span>
            <span className="text-xs text-slate-400 font-medium">/{summary.running_target_km_weekly} km</span>
          </div>
          <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 mt-2 overflow-hidden">
            <div
              className="bg-sky-500 h-full rounded-full transition-all duration-500"
              style={{ width: `${runningPercent}%` }}
            />
          </div>
        </div>

        <div className="text-[11px] text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
          <span>{runningPercent >= 100 ? 'Đã đạt chỉ tiêu! 🏅' : `Còn ${(Math.max(0, summary.running_target_km_weekly - summary.total_distance_km_week)).toFixed(1)} km`}</span>
          <span className="text-xs">🏃‍♂️</span>
        </div>
      </div>

      {/* 4. Workout Streak */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-2xs flex flex-col justify-between relative overflow-hidden group hover:border-amber-300 dark:hover:border-amber-700/60 transition">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            <Flame className="w-3.5 h-3.5 text-amber-500" />
            <span>Chuỗi thể thao</span>
          </span>
          <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 px-1.5 py-0.5 rounded-full border border-amber-200 dark:border-amber-800">
            Kỷ luật
          </span>
        </div>

        <div className="my-2.5">
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-amber-600 dark:text-amber-400 font-mono">
              {summary.current_streak_days}
            </span>
            <span className="text-xs text-slate-500 font-semibold">ngày liên tiếp</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            {summary.current_streak_days > 0 ? 'Duy trì phong độ mỗi ngày!' : 'Hãy tập 1 buổi để tạo chuỗi!'}
          </p>
        </div>

        <div className="text-[11px] text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
          <span>Chuỗi phong độ</span>
          <span className="text-xs">⚡</span>
        </div>
      </div>

      {/* 5. Water Intake Tracker */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-2xs flex flex-col justify-between relative overflow-hidden group hover:border-blue-300 dark:hover:border-blue-700/60 transition">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            <Droplets className="w-3.5 h-3.5 text-blue-500" />
            <span>Uống nước hôm nay</span>
          </span>
          <span className="text-[10px] font-mono font-bold text-blue-600 dark:text-blue-400">
            {waterPercent}%
          </span>
        </div>

        <div className="my-2.5">
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-slate-900 dark:text-slate-100 font-mono">
              {summary.today_water_ml}
            </span>
            <span className="text-xs text-slate-400 font-medium">/{summary.daily_water_target_ml} ml</span>
          </div>
          <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 mt-2 overflow-hidden">
            <div
              className="bg-blue-500 h-full rounded-full transition-all duration-500"
              style={{ width: `${waterPercent}%` }}
            />
          </div>
        </div>

        <div className="flex items-center justify-between gap-1 pt-1 border-t border-slate-100 dark:border-slate-800/80">
          <button
            type="button"
            disabled={isAddingWater}
            onClick={() => handleQuickAddWater(250)}
            className="px-2 py-0.5 rounded-lg bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/60 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 text-[10px] font-bold border border-blue-200 dark:border-blue-800 transition active:scale-95 cursor-pointer"
            title="Thêm 250ml nước (1 ly)"
          >
            +250ml
          </button>
          <button
            type="button"
            disabled={isAddingWater}
            onClick={() => handleQuickAddWater(500)}
            className="px-2 py-0.5 rounded-lg bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/60 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 text-[10px] font-bold border border-blue-200 dark:border-blue-800 transition active:scale-95 cursor-pointer"
            title="Thêm 500ml nước (1 chai)"
          >
            +500ml
          </button>
        </div>
      </div>

      {/* 6. Body Weight & BMI */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-2xs flex flex-col justify-between relative overflow-hidden group hover:border-violet-300 dark:hover:border-violet-700/60 transition">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            <Scale className="w-3.5 h-3.5 text-violet-500" />
            <span>Thể trạng & BMI</span>
          </span>
          <button
            type="button"
            onClick={onOpenProfileModal}
            className="p-1 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            title="Cập nhật cân nặng & chiều cao"
          >
            <Edit3 className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="my-2.5">
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-slate-900 dark:text-slate-100 font-mono">
              {profile.weight_kg || 65}
            </span>
            <span className="text-xs text-slate-400 font-medium">kg</span>
            <span className="text-xs font-mono font-bold text-violet-600 dark:text-violet-400 ml-1">
              (BMI: {profile.bmi})
            </span>
          </div>
          <p className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 mt-1 truncate" title={profile.bmi_category}>
            {profile.bmi_category}
          </p>
        </div>

        <div className="text-[11px] text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
          <span>Cao {profile.height_cm || 170} cm</span>
          <span className="text-violet-600 dark:text-violet-400 font-semibold cursor-pointer hover:underline" onClick={onOpenProfileModal}>
            Sửa →
          </span>
        </div>
      </div>
    </div>
  );
};
