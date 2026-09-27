from datetime import datetime, date, timedelta
from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import desc, func
from app.models.fitness import FitnessWorkoutLog, FitnessProfile, FitnessWeeklyPlan
from app.schemas.fitness import (
    WorkoutLogCreate, WorkoutLogUpdate, FitnessProfileUpdate,
    FitnessWeeklyPlanItem, FitnessSummaryResponse, WorkoutLogResponse, FitnessProfileResponse
)

DEFAULT_CALORIE_RATE_PER_MIN = {
    "GYM": 6.5,
    "RUNNING": 10.5,
    "CYCLING": 8.0,
    "SWIMMING": 9.5,
    "SPORTS": 8.5,
    "WALKING": 4.5,
    "YOGA": 3.5,
    "OTHER": 6.0,
}

DEFAULT_WEEKLY_SPLIT = [
    {"day": 0, "type": "GYM", "title": "Ngực & Tay sau (Chest & Triceps)", "duration": 50, "rest": False, "notes": "Bench press, Incline dumbbell, Tricep pushdown"},
    {"day": 1, "type": "RUNNING", "title": "Chạy bền hồi phục 5km", "duration": 30, "rest": False, "notes": "Pace 6:00 - 6:30 nhẹ nhàng"},
    {"day": 2, "type": "GYM", "title": "Lưng xô & Tay trước (Back & Biceps)", "duration": 50, "rest": False, "notes": "Lat pulldown, Barbell row, Bicep curls"},
    {"day": 3, "type": "REST", "title": "Nghỉ ngơi giãn cơ (Rest Day)", "duration": 0, "rest": True, "notes": "Uống nhiều nước, ngủ đủ giấc"},
    {"day": 4, "type": "GYM", "title": "Chân đùi, Vai & Bụng (Legs, Shoulders & Core)", "duration": 55, "rest": False, "notes": "Squat, Overhead press, Plank"},
    {"day": 5, "type": "SPORTS", "title": "Thể thao đồng đội / Cầu lông", "duration": 60, "rest": False, "notes": "Chơi cùng bạn bè, rèn luyện phản xạ"},
    {"day": 6, "type": "RUNNING", "title": "Chạy dài cuối tuần (Long Run)", "duration": 45, "rest": False, "notes": "7km - 8km nhịp thở đều"},
]


class FitnessService:

    @classmethod
    def get_or_create_profile(cls, db: Session) -> FitnessProfileResponse:
        profile = db.query(FitnessProfile).first()
        today_str = date.today().isoformat()

        if not profile:
            profile = FitnessProfile(
                height_cm=170.0,
                weight_kg=65.0,
                target_weight_kg=65.0,
                daily_water_target_ml=2000,
                weekly_workout_target=4,
                daily_calorie_target=400,
                running_target_km_weekly=15.0,
                today_water_ml=0,
                water_updated_date=today_str,
            )
            db.add(profile)
            db.commit()
            db.refresh(profile)
        else:
            # Check daily water reset
            if profile.water_updated_date != today_str:
                profile.today_water_ml = 0
                profile.water_updated_date = today_str
                db.commit()
                db.refresh(profile)

        # BMI calculation
        height_m = (profile.height_cm or 170.0) / 100.0
        weight = profile.weight_kg or 65.0
        bmi = round(weight / (height_m * height_m), 1) if height_m > 0 else 22.0

        if bmi < 18.5:
            bmi_cat = "Thiếu cân (Underweight)"
        elif bmi < 24.9:
            bmi_cat = "Bình thường (Normal weight)"
        elif bmi < 29.9:
            bmi_cat = "Thừa cân (Overweight)"
        else:
            bmi_cat = "Béo phì (Obese)"

        return FitnessProfileResponse(
            id=profile.id,
            height_cm=profile.height_cm,
            weight_kg=profile.weight_kg,
            target_weight_kg=profile.target_weight_kg,
            daily_water_target_ml=profile.daily_water_target_ml,
            weekly_workout_target=profile.weekly_workout_target,
            daily_calorie_target=profile.daily_calorie_target,
            running_target_km_weekly=profile.running_target_km_weekly,
            today_water_ml=profile.today_water_ml,
            bmi=bmi,
            bmi_category=bmi_cat,
            updated_at=profile.updated_at or datetime.utcnow(),
        )

    @classmethod
    def update_profile(cls, db: Session, data: FitnessProfileUpdate) -> FitnessProfileResponse:
        profile = db.query(FitnessProfile).first()
        if not profile:
            cls.get_or_create_profile(db)
            profile = db.query(FitnessProfile).first()

        for field, val in data.model_dump(exclude_unset=True).items():
            setattr(profile, field, val)

        profile.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(profile)
        return cls.get_or_create_profile(db)

    @classmethod
    def add_water(cls, db: Session, amount_ml: int) -> FitnessProfileResponse:
        profile = db.query(FitnessProfile).first()
        if not profile:
            cls.get_or_create_profile(db)
            profile = db.query(FitnessProfile).first()

        today_str = date.today().isoformat()
        if profile.water_updated_date != today_str:
            profile.today_water_ml = 0
            profile.water_updated_date = today_str

        new_val = max(0, profile.today_water_ml + amount_ml)
        profile.today_water_ml = new_val
        profile.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(profile)
        return cls.get_or_create_profile(db)

    @classmethod
    def list_workout_logs(
        cls,
        db: Session,
        workout_type: Optional[str] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        limit: int = 100,
    ) -> List[FitnessWorkoutLog]:
        query = db.query(FitnessWorkoutLog)
        if workout_type and workout_type != "ALL":
            query = query.filter(FitnessWorkoutLog.workout_type == workout_type)
        if start_date:
            query = query.filter(FitnessWorkoutLog.workout_date >= start_date)
        if end_date:
            query = query.filter(FitnessWorkoutLog.workout_date <= end_date)

        return query.order_by(desc(FitnessWorkoutLog.workout_date), desc(FitnessWorkoutLog.id)).limit(limit).all()

    @classmethod
    def create_workout_log(cls, db: Session, data: WorkoutLogCreate) -> FitnessWorkoutLog:
        calories = data.calories_burned
        if not calories or calories == 0:
            rate = DEFAULT_CALORIE_RATE_PER_MIN.get(data.workout_type.upper(), 6.0)
            calories = int(rate * data.duration_minutes)

        log = FitnessWorkoutLog(
            workout_type=data.workout_type.upper(),
            title=data.title,
            workout_date=data.workout_date[:10],
            duration_minutes=data.duration_minutes,
            calories_burned=calories,
            distance_km=data.distance_km,
            heart_rate_avg=data.heart_rate_avg,
            intensity=data.intensity,
            feeling=data.feeling,
            notes=data.notes,
            sets_data=data.sets_data,
        )
        db.add(log)
        db.commit()
        db.refresh(log)
        return log

    @classmethod
    def update_workout_log(cls, db: Session, log_id: int, data: WorkoutLogUpdate) -> Optional[FitnessWorkoutLog]:
        log = db.query(FitnessWorkoutLog).filter(FitnessWorkoutLog.id == log_id).first()
        if not log:
            return None

        update_dict = data.model_dump(exclude_unset=True)
        if "workout_date" in update_dict and update_dict["workout_date"]:
            update_dict["workout_date"] = update_dict["workout_date"][:10]
        if "workout_type" in update_dict and update_dict["workout_type"]:
            update_dict["workout_type"] = update_dict["workout_type"].upper()

        for k, v in update_dict.items():
            setattr(log, k, v)

        log.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(log)
        return log

    @classmethod
    def delete_workout_log(cls, db: Session, log_id: int) -> bool:
        log = db.query(FitnessWorkoutLog).filter(FitnessWorkoutLog.id == log_id).first()
        if not log:
            return False
        db.delete(log)
        db.commit()
        return True

    @classmethod
    def get_weekly_plans(cls, db: Session) -> List[FitnessWeeklyPlan]:
        plans = db.query(FitnessWeeklyPlan).order_by(FitnessWeeklyPlan.day_of_week).all()
        if not plans or len(plans) < 7:
            # Seed defaults
            db.query(FitnessWeeklyPlan).delete()
            created_plans = []
            for item in DEFAULT_WEEKLY_SPLIT:
                p = FitnessWeeklyPlan(
                    day_of_week=item["day"],
                    workout_type=item["type"],
                    title=item["title"],
                    target_duration_minutes=item["duration"],
                    is_rest_day=item["rest"],
                    notes=item["notes"],
                    is_completed_this_week=False,
                )
                db.add(p)
                created_plans.append(p)
            db.commit()
            return sorted(created_plans, key=lambda x: x.day_of_week)
        return plans

    @classmethod
    def update_weekly_plans(cls, db: Session, plans: List[FitnessWeeklyPlanItem]) -> List[FitnessWeeklyPlan]:
        for item in plans:
            existing = db.query(FitnessWeeklyPlan).filter(FitnessWeeklyPlan.day_of_week == item.day_of_week).first()
            if existing:
                existing.workout_type = item.workout_type
                existing.title = item.title
                existing.target_duration_minutes = item.target_duration_minutes
                existing.is_rest_day = item.is_rest_day
                existing.notes = item.notes
                existing.is_completed_this_week = item.is_completed_this_week
                existing.updated_at = datetime.utcnow()
            else:
                p = FitnessWeeklyPlan(
                    day_of_week=item.day_of_week,
                    workout_type=item.workout_type,
                    title=item.title,
                    target_duration_minutes=item.target_duration_minutes,
                    is_rest_day=item.is_rest_day,
                    notes=item.notes,
                    is_completed_this_week=item.is_completed_this_week,
                )
                db.add(p)
        db.commit()
        return db.query(FitnessWeeklyPlan).order_by(FitnessWeeklyPlan.day_of_week).all()

    @classmethod
    def toggle_weekly_plan_completed(cls, db: Session, plan_id: int) -> Optional[FitnessWeeklyPlan]:
        plan = db.query(FitnessWeeklyPlan).filter(FitnessWeeklyPlan.id == plan_id).first()
        if not plan:
            return None
        plan.is_completed_this_week = not plan.is_completed_this_week
        plan.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(plan)
        return plan

    @classmethod
    def get_summary(cls, db: Session, ref_date_str: Optional[str] = None) -> FitnessSummaryResponse:
        ref_d = date.fromisoformat(ref_date_str) if ref_date_str else date.today()
        # Monday to Sunday bounds
        monday = ref_d - timedelta(days=ref_d.weekday())
        sunday = monday + timedelta(days=6)
        mon_str = monday.isoformat()
        sun_str = sunday.isoformat()

        # Get profile
        profile = cls.get_or_create_profile(db)

        # Get week workouts
        week_workouts = db.query(FitnessWorkoutLog).filter(
            FitnessWorkoutLog.workout_date >= mon_str,
            FitnessWorkoutLog.workout_date <= sun_str,
        ).all()

        total_workouts = len(week_workouts)
        total_mins = sum(w.duration_minutes for w in week_workouts)
        total_cals = sum(w.calories_burned or 0 for w in week_workouts)
        total_distance = sum(w.distance_km or 0.0 for w in week_workouts)

        types_count: Dict[str, int] = {}
        for w in week_workouts:
            types_count[w.workout_type] = types_count.get(w.workout_type, 0) + 1

        # Calculate streak: consecutive days with at least 1 workout leading up to today
        all_dates = set(r[0] for r in db.query(FitnessWorkoutLog.workout_date).distinct().all())
        today = date.today()
        streak = 0
        check_d = today
        # Check if worked out today
        if check_d.isoformat() in all_dates:
            streak += 1
            check_d = check_d - timedelta(days=1)
        elif (today - timedelta(days=1)).isoformat() in all_dates:
            # Worked out yesterday, streak intact
            check_d = today - timedelta(days=1)

        while check_d.isoformat() in all_dates:
            streak += 1
            check_d = check_d - timedelta(days=1)

        recent = db.query(FitnessWorkoutLog).order_by(
            desc(FitnessWorkoutLog.workout_date), desc(FitnessWorkoutLog.id)
        ).limit(10).all()

        return FitnessSummaryResponse(
            total_workouts_week=total_workouts,
            weekly_workout_target=profile.weekly_workout_target,
            total_minutes_week=total_mins,
            total_calories_week=total_cals,
            total_distance_km_week=round(total_distance, 1),
            running_target_km_weekly=profile.running_target_km_weekly,
            current_streak_days=streak,
            today_water_ml=profile.today_water_ml,
            daily_water_target_ml=profile.daily_water_target_ml,
            workout_types_count=types_count,
            recent_workouts=[WorkoutLogResponse.model_validate(w) for w in recent],
        )
