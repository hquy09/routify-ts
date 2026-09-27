import React, { useState, useEffect } from 'react';
import {
  X,
  Dumbbell,
  Timer,
  Flame,
  Activity,
  Heart,
  Smile,
  Save,
  Trash2,
  Calendar
} from 'lucide-react';
import { WorkoutLog, WorkoutLogInput, WorkoutType, WorkoutIntensity, WorkoutFeeling } from '../../types/fitness';
import { api } from '../../services/api';

interface WorkoutLogModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  workoutToEdit: WorkoutLog | null;
}

const WORKOUT_TYPES: { type: WorkoutType; label: string; icon: string; defaultCalRate: number }[] = [
  { type: 'GYM', label: 'Gym / Thể hình', icon: '🏋️‍♂️', defaultCalRate: 6.5 },
  { type: 'RUNNING', label: 'Chạy bộ', icon: '🏃‍♂️', defaultCalRate: 10.5 },
  { type: 'CYCLING', label: 'Đạp xe', icon: '🚴‍♂️', defaultCalRate: 8.0 },
  { type: 'SPORTS', label: 'Thể thao / Cầu lông / Bóng đá', icon: '⚽', defaultCalRate: 8.5 },
  { type: 'SWIMMING', label: 'Bơi lội', icon: '🏊‍♂️', defaultCalRate: 9.5 },
  { type: 'WALKING', label: 'Đi bộ', icon: '🚶‍♂️', defaultCalRate: 4.5 },
  { type: 'YOGA', label: 'Yoga / Giãn cơ', icon: '🧘‍♂️', defaultCalRate: 3.5 },
  { type: 'OTHER', label: 'Khác', icon: '🥊', defaultCalRate: 6.0 },
];

const PRESET_TITLES: Record<WorkoutType, string[]> = {
  GYM: ['Ngực & Tay sau', 'Lưng xô & Tay trước', 'Chân đùi & Bụng', 'Vai & Cầu vai', 'Full Body toàn thân'],
  RUNNING: ['Chạy bền hồi phục 5km', 'Chạy Interval bứt tốc', 'Chạy dài 10km cuối tuần', 'Chạy nhẹ buổi sáng 3km'],
  CYCLING: ['Đạp xe dạo hồ 10km', 'Đạp xe đường trường 20km', 'Đạp xe trong nhà (Spinning)'],
  SPORTS: ['Cầu lông giao hữu 1h', 'Đá bóng sân cỏ nhân tạo', 'Bóng rổ cùng bạn bè', 'Bóng bàn đối kháng'],
  SWIMMING: ['Bơi sải 500m', 'Bơi ếch thả lỏng', 'Bơi tự do 30 phút'],
  WALKING: ['Đi bộ thư giãn 5000 bước', 'Đi bộ nhanh sau bữa tối', 'Tản bộ công viên'],
  YOGA: ['Giãn cơ toàn thân (Stretching)', 'Yoga phục hồi khớp và lưng', 'Vinyasa Flow'],
  OTHER: ['Tập Cardio HIIT', 'Nhảy dây 15 phút', 'Tập võ / Boxing'],
};

export const WorkoutLogModal: React.FC<WorkoutLogModalProps> = ({
  isOpen,
  onClose,
  onSaved,
  workoutToEdit,
}) => {
  const [workoutType, setWorkoutType] = useState<WorkoutType>('GYM');
  const [title, setTitle] = useState('');
  const [workoutDate, setWorkoutDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [durationMinutes, setDurationMinutes] = useState(45);
  const [caloriesBurned, setCaloriesBurned] = useState<number | undefined>(300);
  const [distanceKm, setDistanceKm] = useState<number | undefined>(undefined);
  const [heartRateAvg, setHeartRateAvg] = useState<number | undefined>(undefined);
  const [intensity, setIntensity] = useState<WorkoutIntensity>('MEDIUM');
  const [feeling, setFeeling] = useState<WorkoutFeeling>('GOOD');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (workoutToEdit) {
      setWorkoutType(workoutToEdit.workout_type);
      setTitle(workoutToEdit.title);
      setWorkoutDate(workoutToEdit.workout_date.slice(0, 10));
      setDurationMinutes(workoutToEdit.duration_minutes);
      setCaloriesBurned(workoutToEdit.calories_burned);
      setDistanceKm(workoutToEdit.distance_km);
      setHeartRateAvg(workoutToEdit.heart_rate_avg);
      setIntensity(workoutToEdit.intensity);
      setFeeling(workoutToEdit.feeling);
      setNotes(workoutToEdit.notes || '');
    } else {
      setWorkoutType('GYM');
      setTitle('Ngực & Tay sau');
      setWorkoutDate(new Date().toISOString().slice(0, 10));
      setDurationMinutes(45);
      setCaloriesBurned(300);
      setDistanceKm(undefined);
      setHeartRateAvg(undefined);
      setIntensity('MEDIUM');
      setFeeling('GOOD');
      setNotes('');
    }
  }, [workoutToEdit, isOpen]);

  // Auto calculate calories when duration or type changes if user hasn't overridden heavily
  const handleTypeSelect = (type: WorkoutType) => {
    setWorkoutType(type);
    const presets = PRESET_TITLES[type];
    if (presets && presets.length > 0 && (!title || Object.values(PRESET_TITLES).flat().includes(title))) {
      setTitle(presets[0]);
    }
    const calRate = WORKOUT_TYPES.find((w) => w.type === type)?.defaultCalRate || 6.5;
    setCaloriesBurned(Math.round(calRate * durationMinutes));
    if (type === 'RUNNING') setDistanceKm(5.0);
    else if (type === 'CYCLING') setDistanceKm(12.0);
    else if (type === 'WALKING') setDistanceKm(3.0);
    else setDistanceKm(undefined);
  };

  const handleDurationChange = (mins: number) => {
    setDurationMinutes(mins);
    const calRate = WORKOUT_TYPES.find((w) => w.type === workoutType)?.defaultCalRate || 6.5;
    setCaloriesBurned(Math.round(calRate * mins));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    try {
      setIsSubmitting(true);
      const payload: WorkoutLogInput = {
        workout_type: workoutType,
        title: title.trim(),
        workout_date: workoutDate,
        duration_minutes: durationMinutes,
        calories_burned: caloriesBurned || 0,
        distance_km: distanceKm,
        heart_rate_avg: heartRateAvg,
        intensity,
        feeling,
        notes: notes.trim() || undefined,
      };

      if (workoutToEdit) {
        await api.fitness.updateLog(workoutToEdit.id, payload);
      } else {
        await api.fitness.createLog(payload);
      }
      onSaved();
      onClose();
    } catch (err) {
      console.error('Failed to save workout log:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!workoutToEdit) return;
    if (!window.confirm(`Xóa buổi tập "${workoutToEdit.title}"?`)) return;

    try {
      setIsDeleting(true);
      await api.fitness.deleteLog(workoutToEdit.id);
      onSaved();
      onClose();
    } catch (err) {
      console.error('Failed to delete workout log:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  if (!isOpen) return null;

  const showDistanceField = ['RUNNING', 'CYCLING', 'WALKING', 'SWIMMING'].includes(workoutType);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0 bg-slate-50/50 dark:bg-slate-850/50">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-950/70 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 shadow-2xs">
              <Dumbbell className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-slate-900 dark:text-slate-100">
                {workoutToEdit ? 'Chỉnh Sửa Buổi Tập' : 'Ghi Lại Buổi Tập Mới'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Theo dõi quá trình tập luyện Gym, Chạy bộ, Thể thao và Calo tiêu thụ
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

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
          {/* 1. Chọn Bộ môn Thể thao */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
              Bộ môn thể thao
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {WORKOUT_TYPES.map((w) => {
                const isSelected = workoutType === w.type;
                return (
                  <button
                    key={w.type}
                    type="button"
                    onClick={() => handleTypeSelect(w.type)}
                    className={`p-2.5 rounded-xl border text-left transition flex items-center gap-2 text-xs font-bold ${
                      isSelected
                        ? 'border-emerald-500 bg-emerald-50/80 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200 ring-2 ring-emerald-400/50 shadow-2xs'
                        : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    <span className="text-base shrink-0">{w.icon}</span>
                    <span className="truncate">{w.label.split('/')[0]}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. Tiêu đề buổi tập & Gợi ý nhanh */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                Tên buổi tập / Nhóm cơ <span className="text-rose-500">*</span>
              </label>
              <span className="text-[11px] text-slate-400">Gợi ý nhanh:</span>
            </div>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="VD: Tập ngực & tay sau, Chạy bền 5km..."
              className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />
            {/* Quick chips */}
            {PRESET_TITLES[workoutType] && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {PRESET_TITLES[workoutType].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setTitle(preset)}
                    className="px-2 py-0.5 rounded-lg text-[10px] font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700 transition"
                  >
                    {preset}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 3. Ngày tập & Thời lượng */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <span>Ngày tập</span>
              </label>
              <input
                type="date"
                required
                value={workoutDate}
                onChange={(e) => setWorkoutDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Timer className="w-3.5 h-3.5 text-slate-400" />
                  <span>Thời lượng (phút)</span>
                </label>
                <div className="flex gap-1">
                  {[30, 45, 60, 90].map((mins) => (
                    <button
                      key={mins}
                      type="button"
                      onClick={() => handleDurationChange(mins)}
                      className={`text-[10px] px-1.5 py-0.5 rounded font-bold transition ${
                        durationMinutes === mins
                          ? 'bg-emerald-600 text-white'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      {mins}p
                    </button>
                  ))}
                </div>
              </div>
              <input
                type="number"
                min="1"
                max="600"
                required
                value={durationMinutes}
                onChange={(e) => handleDurationChange(parseInt(e.target.value) || 0)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none font-mono"
              />
            </div>
          </div>

          {/* 4. Calo & Quãng đường */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Flame className="w-3.5 h-3.5 text-orange-500" />
                <span>Calo tiêu thụ (kcal)</span>
              </label>
              <input
                type="number"
                min="0"
                value={caloriesBurned ?? ''}
                onChange={(e) => setCaloriesBurned(parseInt(e.target.value) || 0)}
                placeholder="VD: 350"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none font-mono"
              />
            </div>

            {showDistanceField && (
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-sky-500" />
                  <span>Quãng đường (km)</span>
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={distanceKm ?? ''}
                  onChange={(e) => setDistanceKm(parseFloat(e.target.value) || undefined)}
                  placeholder="VD: 5.2"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none font-mono"
                />
              </div>
            )}
          </div>

          {/* 5. Cường độ & Cảm nhận sau buổi tập */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Heart className="w-3.5 h-3.5 text-rose-500" />
                <span>Cường độ tập</span>
              </label>
              <div className="grid grid-cols-4 gap-1 text-center">
                {(['LOW', 'MEDIUM', 'HIGH', 'MAX'] as WorkoutIntensity[]).map((level) => {
                  const labelMap = { LOW: 'Nhẹ', MEDIUM: 'Vừa', HIGH: 'Nặng', MAX: 'Cực hạn' };
                  const isSel = intensity === level;
                  return (
                    <button
                      key={level}
                      type="button"
                      onClick={() => setIntensity(level)}
                      className={`py-1.5 rounded-lg text-xs font-bold transition ${
                        isSel
                          ? 'bg-rose-500 text-white shadow-2xs'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                      }`}
                    >
                      {labelMap[level]}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Smile className="w-3.5 h-3.5 text-amber-500" />
                <span>Cảm nhận thể lực</span>
              </label>
              <div className="grid grid-cols-4 gap-1 text-center">
                {(['GREAT', 'GOOD', 'TIRED', 'EXHAUSTED'] as WorkoutFeeling[]).map((f) => {
                  const iconMap = { GREAT: '😄 Khỏe', GOOD: '🙂 Tốt', TIRED: '😓 Mệt', EXHAUSTED: '🥵 Đuối' };
                  const isSel = feeling === f;
                  return (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setFeeling(f)}
                      className={`py-1.5 rounded-lg text-xs font-bold transition ${
                        isSel
                          ? 'bg-amber-500 text-slate-950 shadow-2xs'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                      }`}
                    >
                      {iconMap[f]}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* 6. Chi tiết bài tập & Ghi chú */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              Ghi chú bài tập & Số hiệp (Sets / Reps / Khối lượng)
            </label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="VD: Bench press 4 hiệp x 10 cái (60kg), Squat 4 hiệp x 8 cái (80kg), Bụng plank 3 phút..."
              className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />
          </div>

          {/* Modal Footer */}
          <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2">
            {workoutToEdit ? (
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleDelete}
                className="px-3 py-2 rounded-xl text-xs font-bold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-transparent hover:border-rose-200 transition flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isDeleting ? 'Đang xóa...' : 'Xóa buổi tập'}</span>
              </button>
            ) : <div />}

            <div className="flex items-center gap-2">
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
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md transition flex items-center gap-1.5 active:scale-95"
              >
                <Save className="w-4 h-4" />
                <span>{isSubmitting ? 'Đang lưu...' : workoutToEdit ? 'Lưu thay đổi' : 'Ghi nhận buổi tập'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
