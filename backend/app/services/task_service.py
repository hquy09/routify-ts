from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import select, and_, or_, desc
from app.models.task import Task, Subtask
from app.models.goal import Goal, Project
from app.models.course import CourseNode, Course
from app.models.fixed_schedule import FixedSchedule
from app.schemas.task import TaskCreate, TaskUpdate, TaskTransferRequest, TaskOut, SubtaskOut, AttachmentOut

class TaskService:
    @staticmethod
    def _format_task_out(task: Task) -> TaskOut:
        subtasks_out = [
            SubtaskOut(
                id=s.id,
                task_id=s.task_id,
                title=s.title,
                is_completed=s.is_completed,
                order_index=s.order_index,
                created_at=s.created_at
            )
            for s in task.subtasks
        ]
        
        total_subtasks = len(subtasks_out)
        completed_subtasks = sum(1 for s in subtasks_out if s.is_completed)
        progress = (completed_subtasks / total_subtasks * 100.0) if total_subtasks > 0 else 0.0

        attachments_out = [
            AttachmentOut(
                id=a.id,
                task_id=a.task_id,
                filename=a.filename,
                file_type=a.file_type,
                file_size=a.file_size,
                storage_path=a.storage_path,
                url=a.url,
                created_at=a.created_at
            )
            for a in task.attachments
        ]

        transferred_title = None
        transferred_date = None
        if task.transferred_from:
            transferred_title = task.transferred_from.title
            transferred_date = task.transferred_from.due_datetime or task.transferred_from.created_at

        return TaskOut(
            id=task.id,
            title=task.title,
            description=task.description,
            goal_id=task.goal_id,
            project_id=task.project_id,
            parent_task_id=task.parent_task_id,
            course_node_id=task.course_node_id,
            scheduled_with_fixed_id=task.scheduled_with_fixed_id,
            start_datetime=task.start_datetime,
            due_datetime=task.due_datetime,
            completed_datetime=task.completed_datetime,
            difficulty=task.difficulty,
            priority=task.priority,
            status=task.status,
            recurrence_rule=task.recurrence_rule,
            created_at=task.created_at,
            updated_at=task.updated_at,
            archived_at=task.archived_at,
            transferred_from_id=task.transferred_from_id,
            transferred_to_id=task.transferred_to_id,
            subtasks=subtasks_out,
            attachments=attachments_out,
            subtasks_count=total_subtasks,
            subtasks_completed_count=completed_subtasks,
            subtask_progress=round(progress, 1),
            goal_title=task.goal.title if task.goal else None,
            project_title=task.project.title if task.project else None,
            course_title=(
                f"{task.course_node.course.title}: {task.course_node.title}"
                if (task.course_node and getattr(task.course_node, "course", None) and task.course_node.course.title)
                else (task.course_node.title if task.course_node else None)
            ),
            scheduled_with_fixed_title=f"{task.scheduled_with_fixed.icon or '📌'} {task.scheduled_with_fixed.title}" if task.scheduled_with_fixed else None,
            transferred_from_title=transferred_title,
            transferred_from_date=transferred_date
        )

    @classmethod
    def get_task_by_id(cls, db: Session, task_id: int) -> Optional[TaskOut]:
        task = db.query(Task).options(
            joinedload(Task.subtasks),
            joinedload(Task.attachments),
            joinedload(Task.goal),
            joinedload(Task.project),
            joinedload(Task.course_node).joinedload(CourseNode.course),
            joinedload(Task.scheduled_with_fixed),
            joinedload(Task.transferred_from)
        ).filter(Task.id == task_id).first()
        if not task:
            return None
        return cls._format_task_out(task)

    @classmethod
    def list_tasks(
        cls,
        db: Session,
        status: Optional[str] = None,
        goal_id: Optional[int] = None,
        project_id: Optional[int] = None,
        course_node_id: Optional[int] = None,
        difficulty: Optional[int] = None,
        priority: Optional[str] = None,
        date_filter: Optional[str] = None,  # "TODAY", "UPCOMING", "DELAYED", "COMPLETED", "THIS_WEEK", "BACKLOG", "ALL"
        search: Optional[str] = None,
        limit: int = 200,
        offset: int = 0,
        week_date: Optional[str] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
    ) -> List[TaskOut]:
        query = db.query(Task).options(
            joinedload(Task.subtasks),
            joinedload(Task.attachments),
            joinedload(Task.goal),
            joinedload(Task.project),
            joinedload(Task.course_node).joinedload(CourseNode.course),
            joinedload(Task.scheduled_with_fixed),
            joinedload(Task.transferred_from)
        )

        now = datetime.now()
        today_start = datetime(now.year, now.month, now.day, 0, 0, 0)
        today_end = datetime(now.year, now.month, now.day, 23, 59, 59)

        if search:
            search_pattern = f"%{search}%"
            query = query.filter(or_(Task.title.ilike(search_pattern), Task.description.ilike(search_pattern)))

        if status and status != "ALL":
            query = query.filter(Task.status == status)

        if goal_id:
            query = query.filter(Task.goal_id == goal_id)

        if project_id:
            query = query.filter(Task.project_id == project_id)

        if course_node_id:
            query = query.filter(Task.course_node_id == course_node_id)

        if difficulty:
            query = query.filter(Task.difficulty == difficulty)

        if priority:
            query = query.filter(Task.priority == priority)

        # 1. Week Date filter (Filters exact Monday to Sunday of the specified week date)
        if week_date:
            try:
                ref = datetime.fromisoformat(week_date).date()
                mon = ref - timedelta(days=ref.weekday())
                sun = mon + timedelta(days=6)
                week_start = datetime(mon.year, mon.month, mon.day, 0, 0, 0)
                week_end = datetime(sun.year, sun.month, sun.day, 23, 59, 59)
                query = query.filter(
                    or_(
                        and_(Task.due_datetime >= week_start, Task.due_datetime <= week_end),
                        and_(Task.due_datetime.is_(None), Task.created_at >= week_start, Task.created_at <= week_end)
                    )
                )
            except Exception:
                pass
        elif start_date or end_date:
            if start_date:
                try:
                    s_d = datetime.fromisoformat(start_date)
                    query = query.filter(or_(Task.due_datetime >= s_d, and_(Task.due_datetime.is_(None), Task.created_at >= s_d)))
                except Exception:
                    pass
            if end_date:
                try:
                    e_d = datetime.fromisoformat(end_date)
                    if len(end_date) <= 10:
                        e_d = datetime(e_d.year, e_d.month, e_d.day, 23, 59, 59)
                    query = query.filter(or_(Task.due_datetime <= e_d, and_(Task.due_datetime.is_(None), Task.created_at <= e_d)))
                except Exception:
                    pass
        elif date_filter == "TODAY":
            query = query.filter(
                Task.due_datetime >= today_start,
                Task.due_datetime <= today_end
            )
        elif date_filter == "THIS_WEEK":
            ref = now.date()
            mon = ref - timedelta(days=ref.weekday())
            sun = mon + timedelta(days=6)
            week_start = datetime(mon.year, mon.month, mon.day, 0, 0, 0)
            week_end = datetime(sun.year, sun.month, sun.day, 23, 59, 59)
            query = query.filter(
                or_(
                    and_(Task.due_datetime >= week_start, Task.due_datetime <= week_end),
                    and_(Task.due_datetime.is_(None), Task.created_at >= week_start, Task.created_at <= week_end)
                )
            )
        elif date_filter == "BACKLOG":
            ref = now.date()
            mon = ref - timedelta(days=ref.weekday())
            week_start = datetime(mon.year, mon.month, mon.day, 0, 0, 0)
            query = query.filter(
                Task.status.in_(["TODO", "IN_PROGRESS", "PARTIAL", "DELAYED"]),
                or_(
                    Task.due_datetime < week_start,
                    and_(Task.due_datetime.is_(None), Task.created_at < week_start)
                )
            )
        elif date_filter == "UPCOMING":
            query = query.filter(
                Task.due_datetime > today_end,
                Task.status.in_(["TODO", "IN_PROGRESS"])
            )
        elif date_filter == "DELAYED":
            query = query.filter(
                or_(
                    Task.status == "DELAYED",
                    and_(
                        Task.due_datetime < now,
                        Task.status.in_(["TODO", "IN_PROGRESS", "PARTIAL"])
                    )
                )
            )
        elif date_filter == "COMPLETED":
            query = query.filter(Task.status == "COMPLETED")

        tasks = query.order_by(desc(Task.created_at)).offset(offset).limit(limit).all()
        return [cls._format_task_out(t) for t in tasks]

    @classmethod
    def create_task(cls, db: Session, task_in: TaskCreate) -> TaskOut:
        task_data = task_in.model_dump(exclude={"subtask_titles"})
        task = Task(**task_data)
        db.add(task)
        db.flush()

        if task_in.subtask_titles:
            for idx, st_title in enumerate(task_in.subtask_titles):
                if st_title.strip():
                    subtask = Subtask(
                        task_id=task.id,
                        title=st_title.strip(),
                        order_index=idx,
                        is_completed=False
                    )
                    db.add(subtask)

        db.commit()
        db.refresh(task)
        return cls.get_task_by_id(db, task.id)

    @classmethod
    def update_task(cls, db: Session, task_id: int, task_in: TaskUpdate) -> Optional[TaskOut]:
        task = db.query(Task).filter(Task.id == task_id).first()
        if not task:
            return None

        update_data = task_in.model_dump(exclude_unset=True)
        
        # If status is updated to COMPLETED, set completed_datetime if not provided
        if update_data.get("status") == "COMPLETED" and not update_data.get("completed_datetime"):
            update_data["completed_datetime"] = datetime.utcnow()
        elif update_data.get("status") and update_data.get("status") != "COMPLETED":
            update_data["completed_datetime"] = None

        for field, value in update_data.items():
            setattr(task, field, value)

        task.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(task)
        return cls.get_task_by_id(db, task.id)

    @classmethod
    def transfer_task(cls, db: Session, task_id: int, req: TaskTransferRequest) -> Optional[Dict[str, Any]]:
        """
        TASK TRANSFER SYSTEM:
        Do NOT edit old task's deadline!
        1. Set old task status = TRANSFERRED.
        2. Create new task with status = TODO, due_datetime = new_due_datetime.
        3. Set new_task.transferred_from_id = old_task.id.
        4. Set old_task.transferred_to_id = new_task.id.
        5. Optionally copy incomplete subtasks.
        """
        old_task = db.query(Task).options(joinedload(Task.subtasks)).filter(Task.id == task_id).first()
        if not old_task:
            return None

        # 1. Update old task
        old_task.status = "TRANSFERRED"
        old_task.updated_at = datetime.utcnow()

        # 2. Create new task
        new_task = Task(
            title=old_task.title,
            description=f"{old_task.description or ''}\n[Chuyển giao: {req.notes}]" if req.notes else old_task.description,
            goal_id=old_task.goal_id,
            project_id=old_task.project_id,
            parent_task_id=old_task.parent_task_id,
            course_node_id=old_task.course_node_id,
            scheduled_with_fixed_id=old_task.scheduled_with_fixed_id,
            start_datetime=None,
            due_datetime=req.new_due_datetime,
            difficulty=old_task.difficulty,
            priority=old_task.priority,
            status="TODO",
            recurrence_rule=old_task.recurrence_rule,
            transferred_from_id=old_task.id,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        db.add(new_task)
        db.flush()

        # Link old task to new task
        old_task.transferred_to_id = new_task.id

        # Copy subtasks if requested
        if req.keep_subtasks and old_task.subtasks:
            for idx, st in enumerate(old_task.subtasks):
                # Copy incomplete subtasks or reset for new task
                new_subtask = Subtask(
                    task_id=new_task.id,
                    title=st.title,
                    is_completed=False,  # reset for newly transferred task
                    order_index=idx
                )
                db.add(new_subtask)

        db.commit()
        db.refresh(old_task)
        db.refresh(new_task)

        return {
            "old_task": cls.get_task_by_id(db, old_task.id),
            "new_task": cls.get_task_by_id(db, new_task.id)
        }

    @classmethod
    def delete_task(cls, db: Session, task_id: int) -> bool:
        task = db.query(Task).filter(Task.id == task_id).first()
        if not task:
            return False
        db.delete(task)
        db.commit()
        return True

    @classmethod
    def add_subtask(cls, db: Session, task_id: int, title: str) -> Optional[SubtaskOut]:
        task = db.query(Task).filter(Task.id == task_id).first()
        if not task:
            return None
        
        last_subtask = db.query(Subtask).filter(Subtask.task_id == task_id).order_by(desc(Subtask.order_index)).first()
        order_index = (last_subtask.order_index + 1) if last_subtask else 0

        subtask = Subtask(
            task_id=task_id,
            title=title,
            order_index=order_index,
            is_completed=False
        )
        db.add(subtask)
        db.commit()
        db.refresh(subtask)
        return SubtaskOut(
            id=subtask.id,
            task_id=subtask.task_id,
            title=subtask.title,
            is_completed=subtask.is_completed,
            order_index=subtask.order_index,
            created_at=subtask.created_at
        )

    @classmethod
    def toggle_subtask(cls, db: Session, subtask_id: int) -> Optional[SubtaskOut]:
        subtask = db.query(Subtask).filter(Subtask.id == subtask_id).first()
        if not subtask:
            return None
        subtask.is_completed = not subtask.is_completed
        
        # Check parent task subtasks to update status if all or partial
        parent_task = db.query(Task).filter(Task.id == subtask.task_id).first()
        if parent_task:
            all_subtasks = db.query(Subtask).filter(Subtask.task_id == parent_task.id).all()
            total = len(all_subtasks)
            completed = sum(1 for s in all_subtasks if (s.is_completed if s.id != subtask_id else subtask.is_completed))
            
            # If partially done and status was TODO, auto set to PARTIAL or IN_PROGRESS
            if 0 < completed < total and parent_task.status in ["TODO"]:
                parent_task.status = "PARTIAL"
            elif completed == total and total > 0 and parent_task.status in ["TODO", "PARTIAL", "IN_PROGRESS"]:
                parent_task.status = "COMPLETED"
                parent_task.completed_datetime = datetime.utcnow()

        db.commit()
        db.refresh(subtask)
        return SubtaskOut(
            id=subtask.id,
            task_id=subtask.task_id,
            title=subtask.title,
            is_completed=subtask.is_completed,
            order_index=subtask.order_index,
            created_at=subtask.created_at
        )

    @classmethod
    def delete_subtask(cls, db: Session, subtask_id: int) -> bool:
        subtask = db.query(Subtask).filter(Subtask.id == subtask_id).first()
        if not subtask:
            return False
        db.delete(subtask)
        db.commit()
        return True

    @classmethod
    def get_unfinished_past_summary(cls, db: Session, ref_date_str: Optional[str] = None) -> Dict[str, Any]:
        """
        Check for any unfinished tasks from weeks prior to the reference week.
        Returns total count and tasks grouped by week.
        """
        now = datetime.now()
        ref_date = datetime.fromisoformat(ref_date_str).date() if ref_date_str else now.date()
        current_week_mon = ref_date - timedelta(days=ref_date.weekday())
        current_week_start = datetime(current_week_mon.year, current_week_mon.month, current_week_mon.day, 0, 0, 0)

        past_unfinished_tasks = db.query(Task).options(
            joinedload(Task.subtasks),
            joinedload(Task.attachments),
            joinedload(Task.goal),
            joinedload(Task.project),
            joinedload(Task.course_node).joinedload(CourseNode.course),
            joinedload(Task.scheduled_with_fixed),
            joinedload(Task.transferred_from)
        ).filter(
            Task.status.in_(["TODO", "IN_PROGRESS", "PARTIAL", "DELAYED"]),
            or_(
                Task.due_datetime < current_week_start,
                and_(Task.due_datetime.is_(None), Task.created_at < current_week_start)
            )
        ).order_by(Task.due_datetime.asc(), Task.created_at.asc()).all()

        formatted_tasks = [cls._format_task_out(t) for t in past_unfinished_tasks]

        weeks_map: Dict[str, Dict[str, Any]] = {}
        for t in formatted_tasks:
            dt = t.due_datetime or t.created_at
            iso_year, iso_week, _ = dt.isocalendar()
            w_key = f"{iso_year}-W{iso_week}"
            if w_key not in weeks_map:
                weeks_map[w_key] = {
                    "week_key": w_key,
                    "week_number": iso_week,
                    "year": iso_year,
                    "label": f"Tuần {iso_week} ({iso_year})",
                    "tasks": []
                }
            weeks_map[w_key]["tasks"].append(t)

        return {
            "total_unfinished": len(formatted_tasks),
            "current_week_start": current_week_start.isoformat(),
            "past_weeks": list(weeks_map.values()),
            "tasks": formatted_tasks
        }

    @classmethod
    def rollover_past_tasks(cls, db: Session, target_date_str: Optional[str] = None, task_ids: Optional[List[int]] = None) -> Dict[str, Any]:
        """
        Rollover / transfer unfinished past tasks to the target date or today.
        """
        now = datetime.now()
        target_dt = datetime.fromisoformat(target_date_str) if target_date_str else now
        
        query = db.query(Task).filter(
            Task.status.in_(["TODO", "IN_PROGRESS", "PARTIAL", "DELAYED"])
        )
        if task_ids:
            query = query.filter(Task.id.in_(task_ids))
        else:
            ref_date = now.date()
            current_week_mon = ref_date - timedelta(days=ref_date.weekday())
            current_week_start = datetime(current_week_mon.year, current_week_mon.month, current_week_mon.day, 0, 0, 0)
            query = query.filter(
                or_(
                    Task.due_datetime < current_week_start,
                    and_(Task.due_datetime.is_(None), Task.created_at < current_week_start)
                )
            )

        tasks_to_roll = query.all()
        rolled_count = 0
        for t in tasks_to_roll:
            hour = t.due_datetime.hour if t.due_datetime else 21
            minute = t.due_datetime.minute if t.due_datetime else 0
            new_due = datetime(target_dt.year, target_dt.month, target_dt.day, hour, minute, 0)
            t.due_datetime = new_due
            if t.status == "DELAYED":
                t.status = "TODO"
            t.updated_at = now
            rolled_count += 1

        db.commit()
        return {
            "success": True,
            "rolled_count": rolled_count,
            "target_date": target_dt.strftime("%Y-%m-%d"),
            "message": f"Đã dời thành công {rolled_count} nhiệm vụ tồn đọng sang {target_dt.strftime('%d/%m/%Y')}."
        }

