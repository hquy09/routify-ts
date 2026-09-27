from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field

class WorkoutLogBase(BaseModel):
    workout_type: str = Field(default="GYM")  # GYM, RUNNING, CYCLING, SWIMMING, SPORTS, WALKING, YOGA, OTHER
    title: str = Field(..., max_length=255)
    workout_date: str = Field(...)  # YYYY-MM-DD
    duration_minutes: int = Field(default=30, ge=1)
    calories_burned: Optional[int] = Field(default=0, ge=0)
    distance_km: Optional[float] = Field(default=None, ge=0)
    heart_rate_avg: Optional[int] = Field(default=None, ge=0)
    intensity: str = Field(default="MEDIUM")  # LOW, MEDIUM, HIGH, MAX
    feeling: str = Field(default="GOOD")  # GREAT, GOOD, TIRED, EXHAUSTED
    notes: Optional[str] = None
    sets_data: Optional[str] = None

class WorkoutLogCreate(WorkoutLogBase):
    pass

class WorkoutLogUpdate(BaseModel):
    workout_type: Optional[str] = None
    title: Optional[str] = None
    workout_date: Optional[str] = None
    duration_minutes: Optional[int] = None
    calories_burned: Optional[int] = None
    distance_km: Optional[float] = None
    heart_rate_avg: Optional[int] = None
    intensity: Optional[str] = None
    feeling: Optional[str] = None
    notes: Optional[str] = None
    sets_data: Optional[str] = None

class WorkoutLogResponse(WorkoutLogBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class FitnessProfileUpdate(BaseModel):
    height_cm: Optional[float] = None
    weight_kg: Optional[float] = None
    target_weight_kg: Optional[float] = None
    daily_water_target_ml: Optional[int] = None
    weekly_workout_target: Optional[int] = None
    daily_calorie_target: Optional[int] = None
    running_target_km_weekly: Optional[float] = None

class FitnessProfileResponse(BaseModel):
    id: int
    height_cm: Optional[float]
    weight_kg: Optional[float]
    target_weight_kg: Optional[float]
    daily_water_target_ml: int
    weekly_workout_target: int
    daily_calorie_target: int
    running_target_km_weekly: float
    today_water_ml: int
    bmi: float
    bmi_category: str
    updated_at: datetime

    class Config:
        from_attributes = True

class FitnessWeeklyPlanItem(BaseModel):
    id: Optional[int] = None
    day_of_week: int
    workout_type: str
    title: str
    target_duration_minutes: int
    is_rest_day: bool = False
    notes: Optional[str] = None
    is_completed_this_week: bool = False

    class Config:
        from_attributes = True

class FitnessWeeklyPlanBatchUpdate(BaseModel):
    plans: List[FitnessWeeklyPlanItem]

class WaterAddRequest(BaseModel):
    amount_ml: int = Field(..., ge=-5000, le=5000)

class FitnessSummaryResponse(BaseModel):
    total_workouts_week: int
    weekly_workout_target: int
    total_minutes_week: int
    total_calories_week: int
    total_distance_km_week: float
    running_target_km_weekly: float
    current_streak_days: int
    today_water_ml: int
    daily_water_target_ml: int
    workout_types_count: Dict[str, int]
    recent_workouts: List[WorkoutLogResponse]
