from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from app.api.deps import get_database
from app.schemas.task import (
    TaskCreate, TaskUpdate, TaskOut, TaskTransferRequest,
    SubtaskCreate, SubtaskOut, ConflictCheckRequest, ConflictCheckResponse
)
from app.services.task_service import TaskService
from app.services.schedule_service import ScheduleService

router = APIRouter()

@router.get("", response_model=List[TaskOut])
def list_tasks(
    status: Optional[str] = Query(None),
    goal_id: Optional[int] = Query(None),
    project_id: Optional[int] = Query(None),
    course_node_id: Optional[int] = Query(None),
    difficulty: Optional[int] = Query(None),
    priority: Optional[str] = Query(None),
    date_filter: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    limit: int = Query(200, ge=1, le=500),
    offset: int = Query(0, ge=0),
    week_date: Optional[str] = Query(None, description="ISO Date YYYY-MM-DD for week view"),
    start_date: Optional[str] = Query(None, description="ISO Date YYYY-MM-DD"),
    end_date: Optional[str] = Query(None, description="ISO Date YYYY-MM-DD"),
    db: Session = Depends(get_database)
):
    return TaskService.list_tasks(
        db, status, goal_id, project_id, course_node_id, difficulty, priority, date_filter, search, limit, offset,
        week_date, start_date, end_date
    )

@router.post("", response_model=TaskOut)
def create_task(task_in: TaskCreate, db: Session = Depends(get_database)):
    return TaskService.create_task(db, task_in)

@router.get("/backlog/unfinished-summary")
def get_unfinished_past_summary(
    ref_date: Optional[str] = Query(None, description="ISO Date YYYY-MM-DD for reference current week"),
    db: Session = Depends(get_database)
):
    return TaskService.get_unfinished_past_summary(db, ref_date)

@router.post("/backlog/rollover-past")
def rollover_past_tasks(
    target_date: Optional[str] = Query(None, description="ISO Date YYYY-MM-DD to rollover tasks to"),
    db: Session = Depends(get_database)
):
    return TaskService.rollover_past_tasks(db, target_date)

@router.get("/{task_id}", response_model=TaskOut)
def get_task(task_id: int, db: Session = Depends(get_database)):
    task = TaskService.get_task_by_id(db, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task

@router.put("/{task_id}", response_model=TaskOut)
def update_task(task_id: int, task_in: TaskUpdate, db: Session = Depends(get_database)):
    task = TaskService.update_task(db, task_id, task_in)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task

@router.delete("/{task_id}")
def delete_task(task_id: int, db: Session = Depends(get_database)):
    success = TaskService.delete_task(db, task_id)
    if not success:
        raise HTTPException(status_code=404, detail="Task not found")
    return {"message": "Task deleted successfully"}

@router.post("/{task_id}/transfer")
def transfer_task(task_id: int, req: TaskTransferRequest, db: Session = Depends(get_database)):
    """
    Task Transfer System:
    Preserves audit history. Marks old task as TRANSFERRED, creates new task as TODO.
    """
    result = TaskService.transfer_task(db, task_id, req)
    if not result:
        raise HTTPException(status_code=404, detail="Task not found")
    return result

@router.post("/{task_id}/subtasks", response_model=SubtaskOut)
def add_subtask(task_id: int, req: SubtaskCreate, db: Session = Depends(get_database)):
    subtask = TaskService.add_subtask(db, task_id, req.title)
    if not subtask:
        raise HTTPException(status_code=404, detail="Task not found")
    return subtask

@router.put("/subtasks/{subtask_id}/toggle", response_model=SubtaskOut)
def toggle_subtask(subtask_id: int, db: Session = Depends(get_database)):
    subtask = TaskService.toggle_subtask(db, subtask_id)
    if not subtask:
        raise HTTPException(status_code=404, detail="Subtask not found")
    return subtask

@router.delete("/subtasks/{subtask_id}")
def delete_subtask(subtask_id: int, db: Session = Depends(get_database)):
    success = TaskService.delete_subtask(db, subtask_id)
    if not success:
        raise HTTPException(status_code=404, detail="Subtask not found")
    return {"message": "Subtask deleted successfully"}

@router.post("/check-conflict", response_model=ConflictCheckResponse)
def check_conflict(req: ConflictCheckRequest, db: Session = Depends(get_database)):
    return ScheduleService.check_conflict(db, req.start_datetime, req.end_datetime, req.exclude_task_id)
