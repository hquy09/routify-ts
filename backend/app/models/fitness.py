from datetime import datetime
from typing import Optional
from sqlalchemy import String, Text, DateTime, Integer, Float, Boolean
from sqlalchemy.orm import Mapped, mapped_column
from app.database.base import Base

class FitnessWorkoutLog(Base):
    __tablename__ = "fitness_workout_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    workout_type: Mapped[str] = mapped_column(String(50), default="GYM")  # GYM, RUNNING, CYCLING, SWIMMING, SPORTS, WALKING, YOGA, OTHER
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    workout_date: Mapped[str] = mapped_column(String(30), nullable=False)  # YYYY-MM-DD or ISO string
    duration_minutes: Mapped[int] = mapped_column(Integer, default=30)
    calories_burned: Mapped[Optional[int]] = mapped_column(Integer, nullable=True, default=0)
    distance_km: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    heart_rate_avg: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    intensity: Mapped[str] = mapped_column(String(20), default="MEDIUM")  # LOW, MEDIUM, HIGH, MAX
    feeling: Mapped[str] = mapped_column(String(20), default="GOOD")  # GREAT, GOOD, TIRED, EXHAUSTED
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    sets_data: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # JSON representation of sets/reps/weights
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class FitnessProfile(Base):
    __tablename__ = "fitness_profile"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    height_cm: Mapped[Optional[float]] = mapped_column(Float, nullable=True, default=170.0)
    weight_kg: Mapped[Optional[float]] = mapped_column(Float, nullable=True, default=65.0)
    target_weight_kg: Mapped[Optional[float]] = mapped_column(Float, nullable=True, default=65.0)
    daily_water_target_ml: Mapped[int] = mapped_column(Integer, default=2000)
    weekly_workout_target: Mapped[int] = mapped_column(Integer, default=4)
    daily_calorie_target: Mapped[int] = mapped_column(Integer, default=400)
    running_target_km_weekly: Mapped[float] = mapped_column(Float, default=15.0)
    today_water_ml: Mapped[int] = mapped_column(Integer, default=0)
    water_updated_date: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class FitnessWeeklyPlan(Base):
    __tablename__ = "fitness_weekly_plans"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    day_of_week: Mapped[int] = mapped_column(Integer, nullable=False)  # 0 = Thứ 2, ..., 6 = Chủ Nhật
    workout_type: Mapped[str] = mapped_column(String(50), default="GYM")
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    target_duration_minutes: Mapped[int] = mapped_column(Integer, default=45)
    is_rest_day: Mapped[bool] = mapped_column(Boolean, default=False)
    notes: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    is_completed_this_week: Mapped[bool] = mapped_column(Boolean, default=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
