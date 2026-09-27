from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from app.database.session import get_db
from app.schemas.fitness import (
    WorkoutLogCreate, WorkoutLogUpdate, WorkoutLogResponse,
    FitnessProfileResponse, FitnessProfileUpdate, WaterAddRequest,
    FitnessWeeklyPlanItem, FitnessWeeklyPlanBatchUpdate, FitnessSummaryResponse
)
from app.services.fitness_service import FitnessService

router = APIRouter()

@router.get("/summary", response_model=FitnessSummaryResponse)
def get_fitness_summary(
    ref_date: Optional[str] = Query(None, description="ISO date reference YYYY-MM-DD"),
    db: Session = Depends(get_db),
):
    """Get high-level fitness stats for the week, streak, water, and recent activities."""
    return FitnessService.get_summary(db, ref_date)

@router.get("/profile", response_model=FitnessProfileResponse)
def get_fitness_profile(db: Session = Depends(get_db)):
    """Get body metrics (height, weight, BMI), water target, and workout goals."""
    return FitnessService.get_or_create_profile(db)

@router.put("/profile", response_model=FitnessProfileResponse)
def update_fitness_profile(
    data: FitnessProfileUpdate,
    db: Session = Depends(get_db),
):
    """Update user body metrics and fitness targets."""
    return FitnessService.update_profile(db, data)

@router.post("/water/add", response_model=FitnessProfileResponse)
def add_water_intake(
    req: WaterAddRequest,
    db: Session = Depends(get_db),
):
    """Quick log water intake (+250ml, +500ml, etc.)."""
    return FitnessService.add_water(db, req.amount_ml)

@router.get("/logs", response_model=List[WorkoutLogResponse])
def list_workout_logs(
    workout_type: Optional[str] = Query(None),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
):
    """List recorded workout activities (gym, running, cycling, sports...)."""
    return FitnessService.list_workout_logs(db, workout_type, start_date, end_date, limit)

@router.post("/logs", response_model=WorkoutLogResponse, status_code=status.HTTP_201_CREATED)
def create_workout_log(
    data: WorkoutLogCreate,
    db: Session = Depends(get_db),
):
    """Log a new workout session."""
    return FitnessService.create_workout_log(db, data)

@router.put("/logs/{log_id}", response_model=WorkoutLogResponse)
def update_workout_log(
    log_id: int,
    data: WorkoutLogUpdate,
    db: Session = Depends(get_db),
):
    """Edit an existing workout session."""
    log = FitnessService.update_workout_log(db, log_id, data)
    if not log:
        raise HTTPException(status_code=404, detail="Không tìm thấy buổi tập này")
    return log

@router.delete("/logs/{log_id}")
def delete_workout_log(
    log_id: int,
    db: Session = Depends(get_db),
):
    """Delete a workout session."""
    ok = FitnessService.delete_workout_log(db, log_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Không tìm thấy buổi tập này")
    return {"message": "Đã xóa buổi tập thành công"}

@router.get("/weekly-plans", response_model=List[FitnessWeeklyPlanItem])
def get_weekly_workout_plans(db: Session = Depends(get_db)):
    """Get the 7-day workout split for the week."""
    return FitnessService.get_weekly_plans(db)

@router.put("/weekly-plans", response_model=List[FitnessWeeklyPlanItem])
def update_weekly_workout_plans(
    data: FitnessWeeklyPlanBatchUpdate,
    db: Session = Depends(get_db),
):
    """Update the weekly workout split (Mon-Sun)."""
    return FitnessService.update_weekly_plans(db, data.plans)

@router.post("/weekly-plans/{plan_id}/toggle", response_model=FitnessWeeklyPlanItem)
def toggle_weekly_plan_completed(
    plan_id: int,
    db: Session = Depends(get_db),
):
    """Toggle completed status of a day's workout plan."""
    plan = FitnessService.toggle_weekly_plan_completed(db, plan_id)
    if not plan:
        raise HTTPException(status_code=404, detail="Không tìm thấy lịch tập này")
    return plan
