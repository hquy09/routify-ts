export type WorkoutType = 'GYM' | 'RUNNING' | 'CYCLING' | 'SWIMMING' | 'SPORTS' | 'WALKING' | 'YOGA' | 'OTHER';

export type WorkoutIntensity = 'LOW' | 'MEDIUM' | 'HIGH' | 'MAX';

export type WorkoutFeeling = 'GREAT' | 'GOOD' | 'TIRED' | 'EXHAUSTED';

export interface WorkoutLog {
  id: number;
  workout_type: WorkoutType;
  title: string;
  workout_date: string;
  duration_minutes: number;
  calories_burned?: number;
  distance_km?: number;
  heart_rate_avg?: number;
  intensity: WorkoutIntensity;
  feeling: WorkoutFeeling;
  notes?: string;
  sets_data?: string;
  created_at: string;
  updated_at: string;
}

export interface WorkoutLogInput {
  workout_type: WorkoutType;
  title: string;
  workout_date: string;
  duration_minutes: number;
  calories_burned?: number;
  distance_km?: number;
  heart_rate_avg?: number;
  intensity: WorkoutIntensity;
  feeling: WorkoutFeeling;
  notes?: string;
  sets_data?: string;
}

export interface FitnessProfile {
  id: number;
  height_cm?: number;
  weight_kg?: number;
  target_weight_kg?: number;
  daily_water_target_ml: number;
  weekly_workout_target: number;
  daily_calorie_target: number;
  running_target_km_weekly: number;
  today_water_ml: number;
  bmi: number;
  bmi_category: string;
  updated_at: string;
}

export interface FitnessProfileInput {
  height_cm?: number;
  weight_kg?: number;
  target_weight_kg?: number;
  daily_water_target_ml?: number;
  weekly_workout_target?: number;
  daily_calorie_target?: number;
  running_target_km_weekly?: number;
}

export interface FitnessWeeklyPlan {
  id: number;
  day_of_week: number; // 0 = Thứ 2, ..., 6 = CN
  workout_type: WorkoutType | 'REST';
  title: string;
  target_duration_minutes: number;
  is_rest_day: boolean;
  notes?: string;
  is_completed_this_week: boolean;
}

export interface FitnessSummary {
  total_workouts_week: number;
  weekly_workout_target: number;
  total_minutes_week: number;
  total_calories_week: number;
  total_distance_km_week: number;
  running_target_km_weekly: number;
  current_streak_days: number;
  today_water_ml: number;
  daily_water_target_ml: number;
  workout_types_count: Record<string, number>;
  recent_workouts: WorkoutLog[];
}
