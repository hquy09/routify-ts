import React, { useState, useMemo } from 'react';
import {
  Dumbbell,
  Timer,
  Flame,
  Activity,
  Edit2,
  Trash2,
  Search,
  Filter,
  Calendar,
  Smile,
  Plus
} from 'lucide-react';
import { WorkoutLog, WorkoutType } from '../../types/fitness';
import { api } from '../../services/api';

interface WorkoutHistoryListProps {
  logs: WorkoutLog[];
  onRefresh: () => void;
  onEditWorkout: (workout: WorkoutLog) => void;
  onOpenCreateWorkout: () => void;
}

const TYPE_CONFIG: Record<string, { label: string; icon: string; color: string }> = {
  GYM: { label: 'Gym', icon: '🏋️‍♂️', color: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800' },
  RUNNING: { label: 'Chạy bộ', icon: '🏃‍♂️', color: 'bg-sky-50 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300 border-sky-200 dark:border-sky-800' },
  CYCLING: { label: 'Đạp xe', icon: '🚴‍♂️', color: 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border-blue-200 dark:border-blue-800' },
  SPORTS: { label: 'Thể thao', icon: '⚽', color: 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-800' },
  SWIMMING: { label: 'Bơi lội', icon: '🏊‍♂️', color: 'bg-cyan-50 text-cyan-700 dark:bg-cyan-950/60 dark:text-cyan-300 border-cyan-200 dark:border-cyan-800' },
  WALKING: { label: 'Đi bộ', icon: '🚶‍♂️', color: 'bg-teal-50 text-teal-700 dark:bg-teal-950/60 dark:text-teal-300 border-teal-200 dark:border-teal-800' },
  YOGA: { label: 'Yoga', icon: '🧘‍♂️', color: 'bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border-purple-200 dark:border-purple-800' },
  OTHER: { label: 'Khác', icon: '🥊', color: 'bg-slate-50 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700' },
};

export const WorkoutHistoryList: React.FC<WorkoutHistoryListProps> = ({
  logs,
  onRefresh,
  onEditWorkout,
  onOpenCreateWorkout,
}) => {
  const [selectedType, setSelectedType] = useState<string>('ALL');
  const [search, setSearch] = useState('');

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      if (selectedType !== 'ALL' && log.workout_type !== selectedType) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchesTitle = log.title.toLowerCase().includes(q);
        const matchesNotes = log.notes && log.notes.toLowerCase().includes(q);
        return matchesTitle || matchesNotes;
      }
      return true;
    });
  }, [logs, selectedType, search]);

  const handleDelete = async (log: WorkoutLog) => {
    if (!window.confirm(`Xóa buổi tập "${log.title}"?`)) return;
    try {
      await api.fitness.deleteLog(log.id);
      onRefresh();
    } catch (err) {
      console.error('Failed to delete workout:', err);
    }
  };

  const formatDateDisplay = (dateStr: string) => {
    try {
      const parts = dateStr.slice(0, 10).split('-');
      if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
      }
      return dateStr;
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xs space-y-4">
      {/* Header and Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Dumbbell className="w-4 h-4 text-emerald-500" />
          <h3 className="font-extrabold text-sm text-slate-900 dark:text-slate-100">
            Nhật Ký Tập Luyện ({filteredLogs.length})
          </h3>
        </div>

        <button
          type="button"
          onClick={onOpenCreateWorkout}
          className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition active:scale-95 self-start sm:self-auto cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Ghi buổi tập</span>
        </button>
      </div>

      {/* Filter Chips & Search Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5">
        {/* Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          <button
            type="button"
            onClick={() => setSelectedType('ALL')}
            className={`px-3 py-1 rounded-xl text-xs font-bold transition whitespace-nowrap ${
              selectedType === 'ALL'
                ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-2xs'
                : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 hover:bg-slate-200'
            }`}
          >
            Tất cả ({logs.length})
          </button>
          {Object.entries(TYPE_CONFIG).map(([typeKey, cfg]) => {
            const count = logs.filter((l) => l.workout_type === typeKey).length;
            if (count === 0 && selectedType !== typeKey) return null;
            return (
              <button
                key={typeKey}
                type="button"
                onClick={() => setSelectedType(typeKey)}
                className={`px-2.5 py-1 rounded-xl text-xs font-bold transition whitespace-nowrap flex items-center gap-1 ${
                  selectedType === typeKey
                    ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-2xs'
                    : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 hover:bg-slate-200'
                }`}
              >
                <span>{cfg.icon}</span>
                <span>{cfg.label}</span>
                <span className="opacity-70 text-[10px]">({count})</span>
              </button>
            );
          })}
        </div>

        {/* Search */}
        <div className="relative min-w-[200px]">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm theo tên bài tập..."
            className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
          />
        </div>
      </div>

      {/* Log List */}
      {filteredLogs.length === 0 ? (
        <div className="text-center py-10 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-2">
          <div className="text-3xl">🏋️‍♂️</div>
          <h4 className="font-extrabold text-sm text-slate-800 dark:text-slate-200">
            Chưa có nhật ký tập luyện nào
          </h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
            Ghi lại các buổi tập Gym, chạy bộ hoặc thể thao để theo dõi lượng calo tiêu thụ và duy trì chuỗi phong độ!
          </p>
          <div className="pt-2">
            <button
              type="button"
              onClick={onOpenCreateWorkout}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm inline-flex items-center gap-1.5 transition active:scale-95"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Ghi lại buổi tập đầu tiên</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filteredLogs.map((log) => {
            const cfg = TYPE_CONFIG[log.workout_type] || TYPE_CONFIG.OTHER;
            const feelingMap: Record<string, string> = { GREAT: '😄 Cực khỏe', GOOD: '🙂 Tốt', TIRED: '😓 Mệt', EXHAUSTED: '🥵 Đuối' };
            const intensityMap: Record<string, string> = { LOW: 'Nhẹ', MEDIUM: 'Vừa', HIGH: 'Nặng', MAX: 'Cực hạn' };

            return (
              <div
                key={log.id}
                className="p-3.5 sm:p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs group"
              >
                {/* Left: Info */}
                <div className="flex items-start sm:items-center gap-3 min-w-0">
                  <div className="text-2xl shrink-0 p-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700">
                    {cfg.icon}
                  </div>

                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${cfg.color}`}>
                        {cfg.label}
                      </span>
                      <h4 className="font-extrabold text-sm text-slate-900 dark:text-slate-100 truncate">
                        {log.title}
                      </h4>
                    </div>

                    {/* Stats pills */}
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400 font-mono">
                      <span className="flex items-center gap-1 text-slate-700 dark:text-slate-300 font-bold">
                        <Timer className="w-3.5 h-3.5 text-slate-400" />
                        {log.duration_minutes} phút
                      </span>

                      {log.calories_burned && log.calories_burned > 0 && (
                        <span className="flex items-center gap-1 text-orange-600 dark:text-orange-400 font-bold">
                          <Flame className="w-3.5 h-3.5 text-orange-500" />
                          {log.calories_burned} kcal
                        </span>
                      )}

                      {log.distance_km && log.distance_km > 0 && (
                        <span className="flex items-center gap-1 text-sky-600 dark:text-sky-400 font-bold">
                          <Activity className="w-3.5 h-3.5 text-sky-500" />
                          {log.distance_km} km
                        </span>
                      )}

                      <span className="text-[11px] text-slate-400 flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-slate-400" />
                        {formatDateDisplay(log.workout_date)}
                      </span>
                    </div>

                    {/* Notes if available */}
                    {log.notes && (
                      <p className="text-[11px] text-slate-600 dark:text-slate-400 line-clamp-1 italic bg-slate-50 dark:bg-slate-800/60 px-2 py-1 rounded-lg">
                        {log.notes}
                      </p>
                    )}
                  </div>
                </div>

                {/* Right: Badges & Actions */}
                <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                      {intensityMap[log.intensity] || 'Vừa'}
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300">
                      {feelingMap[log.feeling] || 'Tốt'}
                    </span>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => onEditWorkout(log)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                      title="Sửa buổi tập"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(log)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition"
                      title="Xóa buổi tập"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
