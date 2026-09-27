import React, { useState, useEffect, useCallback } from 'react';
import {
  Dumbbell,
  Plus,
  RefreshCw,
  Flame,
  Activity,
  Heart,
  Calendar,
  Sparkles,
  Trophy
} from 'lucide-react';
import { FitnessSummary, FitnessProfile, FitnessWeeklyPlan, WorkoutLog } from '../types/fitness';
import { api } from '../services/api';
import { FitnessSummaryCards } from '../components/fitness/FitnessSummaryCards';
import { WeeklyWorkoutPlanSection } from '../components/fitness/WeeklyWorkoutPlanSection';
import { WorkoutHistoryList } from '../components/fitness/WorkoutHistoryList';
import { WorkoutLogModal } from '../components/fitness/WorkoutLogModal';
import { FitnessProfileModal } from '../components/fitness/FitnessProfileModal';

export const FitnessPage: React.FC = () => {
  const [summary, setSummary] = useState<FitnessSummary | null>(null);
  const [profile, setProfile] = useState<FitnessProfile | null>(null);
  const [weeklyPlans, setWeeklyPlans] = useState<FitnessWeeklyPlan[]>([]);
  const [logs, setLogs] = useState<WorkoutLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Modals state
  const [isWorkoutModalOpen, setIsWorkoutModalOpen] = useState(false);
  const [workoutToEdit, setWorkoutToEdit] = useState<WorkoutLog | null>(null);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      const [sumRes, profRes, plansRes, logsRes] = await Promise.all([
        api.fitness.getSummary(),
        api.fitness.getProfile(),
        api.fitness.getWeeklyPlans(),
        api.fitness.listLogs({ limit: 100 }),
      ]);
      setSummary(sumRes);
      setProfile(profRes);
      setWeeklyPlans(plansRes);
      setLogs(logsRes);
    } catch (err) {
      console.error('Failed to load fitness data:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleOpenCreateWorkout = () => {
    setWorkoutToEdit(null);
    setIsWorkoutModalOpen(true);
  };

  const handleEditWorkout = (workout: WorkoutLog) => {
    setWorkoutToEdit(workout);
    setIsWorkoutModalOpen(true);
  };

  return (
    <div className="space-y-5 pb-12 animate-in fade-in duration-200">
      {/* 1. Header Banner */}
      <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 rounded-3xl p-5 sm:p-6 text-white shadow-lg relative overflow-hidden">
        {/* Subtle background graphics */}
        <div className="absolute right-4 -bottom-6 text-white/10 select-none pointer-events-none text-9xl font-black">
          FIT
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-white/20 backdrop-blur-md text-white border border-white/30">
                Sức Khỏe & Thể Thao
              </span>
              <span className="text-xs text-white/80">• Rèn luyện thể chất</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2">
              <Dumbbell className="w-6 h-6 text-white" />
              <span>Theo Dõi Tập Luyện & Thể Hình</span>
            </h2>
            <p className="text-xs text-white/80 max-w-xl">
              Quản lý lịch tập Gym, chạy bộ, thể thao, tính lượng calo đốt cháy, theo dõi chỉ số BMI và duy trì chuỗi kỷ luật mỗi ngày.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              type="button"
              onClick={loadData}
              className="p-2 rounded-2xl bg-white/10 hover:bg-white/20 backdrop-blur-md text-white transition border border-white/20"
              title="Tải lại dữ liệu"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>

            <button
              type="button"
              onClick={handleOpenCreateWorkout}
              className="px-4 py-2 rounded-2xl bg-white text-emerald-800 hover:bg-emerald-50 text-xs font-black shadow-md flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
            >
              <Plus className="w-4 h-4 text-emerald-800" />
              <span>Ghi buổi tập</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Key Metrics Summary Cards */}
      {summary && profile && (
        <FitnessSummaryCards
          summary={summary}
          profile={profile}
          onRefresh={loadData}
          onOpenProfileModal={() => setIsProfileModalOpen(true)}
          onOpenWorkoutModal={handleOpenCreateWorkout}
        />
      )}

      {/* 3. Weekly Workout Plan (Split) */}
      <WeeklyWorkoutPlanSection
        plans={weeklyPlans}
        onRefresh={loadData}
      />

      {/* 4. Workout Logs & History */}
      <WorkoutHistoryList
        logs={logs}
        onRefresh={loadData}
        onEditWorkout={handleEditWorkout}
        onOpenCreateWorkout={handleOpenCreateWorkout}
      />

      {/* Modals */}
      <WorkoutLogModal
        isOpen={isWorkoutModalOpen}
        onClose={() => {
          setIsWorkoutModalOpen(false);
          setWorkoutToEdit(null);
        }}
        onSaved={loadData}
        workoutToEdit={workoutToEdit}
      />

      {profile && (
        <FitnessProfileModal
          isOpen={isProfileModalOpen}
          onClose={() => setIsProfileModalOpen(false)}
          onSaved={loadData}
          profile={profile}
        />
      )}
    </div>
  );
};
