import os
import shutil
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Body
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from typing import Dict, Any, List, Optional
from pathlib import Path
from pydantic import BaseModel

from app.api.deps import get_database
from app.core.config import settings, BACKUPS_DIR
from app.models.sync import AppSetting, SyncHistory
from app.models.goal import Goal, Project
from app.models.task import Task, Subtask
from app.models.fixed_schedule import FixedSchedule, FixedScheduleOccurrence
from app.models.course import Course, CourseNode
from app.models.attachment import Attachment
from app.models.calendar_note import CalendarNote
from app.models.analytics import WeeklyReview, ArchiveRecord
from app.models.screentime import ScreenTimeLimit, ScreenTimeLog
from app.schemas.sync import AppSettingItem, BackupResponse, SyncHistoryOut, GoogleDriveStatusResponse
from app.services.gdrive_service import GDriveService, create_local_safety_backup, log_sync_event
from app.services.screentime_service import ensure_default_limits

router = APIRouter()

class ResetRequest(BaseModel):
    confirm: str
    reseed: bool = False

@router.get("/all")
def get_all_settings(db: Session = Depends(get_database)) -> Dict[str, str]:
    items = db.query(AppSetting).all()
    res = {
        "database_path": settings.DATABASE_PATH,
        "default_difficulty": str(settings.DEFAULT_DIFFICULTY),
        "default_priority": settings.DEFAULT_PRIORITY,
        "theme": "dark",
        "heatmap_mode": "COUNT",
        "week_starts_monday": "true",
        "auto_sync": "false"
    }
    for item in items:
        res[item.key] = item.value
    return res

@router.post("/set")
def update_setting(item: AppSettingItem, db: Session = Depends(get_database)):
    setting = db.query(AppSetting).filter(AppSetting.key == item.key).first()
    if not setting:
        setting = AppSetting(key=item.key, value=item.value)
        db.add(setting)
    else:
        setting.value = item.value
    db.commit()
    return {"message": "Setting saved", "key": item.key, "value": item.value}

@router.get("/db-status")
def get_db_status():
    db_file = Path(settings.DATABASE_PATH)
    exists = db_file.exists()
    size_bytes = db_file.stat().st_size if exists else 0
    writable = os.access(db_file.parent, os.W_OK)

    return {
        "path": settings.DATABASE_PATH,
        "exists": exists,
        "size_bytes": size_bytes,
        "writable": writable,
        "status": "HEALTHY" if exists and writable else "WARNING"
    }

@router.post("/backup", response_model=BackupResponse)
def create_backup():
    """Create local SQLite backup with timestamp: lifeos_backup_YYYY-MM-DD_HHMM.db"""
    try:
        backup_path = create_local_safety_backup(prefix="manual")
        return BackupResponse(
            filename=backup_path.name,
            file_path=str(backup_path),
            file_size_bytes=backup_path.stat().st_size,
            created_at=datetime.utcnow()
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/backups", response_model=List[BackupResponse])
def list_backups():
    results: List[BackupResponse] = []
    if BACKUPS_DIR.exists():
        for f in sorted(BACKUPS_DIR.glob("*.db"), key=os.path.getmtime, reverse=True):
            stat = f.stat()
            results.append(BackupResponse(
                filename=f.name,
                file_path=str(f),
                file_size_bytes=stat.st_size,
                created_at=datetime.fromtimestamp(stat.st_mtime)
            ))
    return results

# ==============================================================================
# PHASE 5: GOOGLE DRIVE SYNC ENGINE
# ==============================================================================

@router.get("/google-drive/status")
def get_google_drive_status(db: Session = Depends(get_database)):
    service = GDriveService(db)
    return service.get_status()

@router.post("/google-drive/sync")
def trigger_google_drive_sync(db: Session = Depends(get_database)):
    """Triggers complete sync process with Google Drive and local safety snapshot."""
    service = GDriveService(db)
    return service.sync_now()

@router.get("/google-drive/export-bundle")
def export_backup_bundle(db: Session = Depends(get_database)):
    """Exports a complete portable .zip package containing db, attachments, and manifest."""
    service = GDriveService(db)
    bundle_path = service.export_backup_bundle()
    if not bundle_path.exists():
        raise HTTPException(status_code=500, detail="Failed to create backup bundle")
    
    return FileResponse(
        path=str(bundle_path),
        filename=bundle_path.name,
        media_type="application/zip"
    )

@router.post("/google-drive/import-bundle")
async def import_backup_bundle(
    file: UploadFile = File(...),
    db: Session = Depends(get_database)
):
    """Imports and restores system state from an uploaded .zip bundle."""
    temp_zip = BACKUPS_DIR / f"temp_upload_{file.filename}"
    BACKUPS_DIR.mkdir(parents=True, exist_ok=True)

    with open(temp_zip, "wb") as f:
        shutil.copyfileobj(file.file, f)

    service = GDriveService(db)
    try:
        res = service.import_backup_bundle(temp_zip)
        return res
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Lỗi khôi phục gói sao lưu: {str(e)}")
    finally:
        if temp_zip.exists():
            temp_zip.unlink(missing_ok=True)

@router.post("/google-drive/credentials")
async def upload_credentials(
    file: UploadFile = File(...),
    db: Session = Depends(get_database)
):
    """Saves Google Drive Service Account credentials JSON."""
    creds_path = Path(settings.DATABASE_PATH).parent / "service_account.json"
    with open(creds_path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    # Save to app_settings
    setting = db.query(AppSetting).filter(AppSetting.key == "gdrive_credentials_path").first()
    if not setting:
        db.add(AppSetting(key="gdrive_credentials_path", value=str(creds_path)))
    else:
        setting.value = str(creds_path)
    
    db.commit()

    service = GDriveService(db)
    status = service.get_status()
    log_sync_event(db, sync_type="CREDENTIALS", status="COMPLETED", details="Cập nhật Google Drive Service Account JSON")
    return {"message": "Credentials đã được tải lên và lưu thành công", "status": status}

@router.post("/google-drive/toggle-auto")
def toggle_auto_sync(
    enabled: bool = Body(..., embed=True),
    db: Session = Depends(get_database)
):
    setting = db.query(AppSetting).filter(AppSetting.key == "gdrive_auto_sync").first()
    val_str = "true" if enabled else "false"
    if not setting:
        db.add(AppSetting(key="gdrive_auto_sync", value=val_str))
    else:
        setting.value = val_str
    db.commit()
    return {"message": f"Tự động đồng bộ đã {'bật' if enabled else 'tắt'}", "auto_sync": enabled}

@router.get("/sync-history", response_model=List[SyncHistoryOut])
def get_sync_history(db: Session = Depends(get_database)):
    return db.query(SyncHistory).order_by(SyncHistory.created_at.desc()).limit(30).all()

# ==============================================================================
# DANGER ZONE: RESET DATA WITH AUTOMATIC EMERGENCY BACKUP
# ==============================================================================

@router.post("/reset")
def reset_database(
    payload: ResetRequest,
    db: Session = Depends(get_database)
):
    """
    Wipes all user data with mandatory emergency backup snapshot.
    Optional reseed flag reloads fresh sample data.
    """
    if payload.confirm.strip() != "RESET":
        raise HTTPException(
            status_code=400,
            detail="Xác nhận không hợp lệ. Vui lòng nhập đúng từ khóa 'RESET'."
        )

    # 1. MANDATORY SAFETY BACKUP
    safety_backup = create_local_safety_backup(prefix="pre_reset")

    # 2. CLEAR ALL TABLES
    try:
        # Screen Time
        db.query(ScreenTimeLog).delete()
        db.query(ScreenTimeLimit).delete()

        # Archive & Reviews
        db.query(WeeklyReview).delete()
        db.query(ArchiveRecord).delete()

        # Tasks & Subtasks
        db.query(Subtask).delete()
        db.query(Task).delete()

        # Fixed Schedules
        db.query(FixedScheduleOccurrence).delete()
        db.query(FixedSchedule).delete()

        # Courses
        db.query(CourseNode).delete()
        db.query(Course).delete()

        # Goals & Projects
        db.query(Project).delete()
        db.query(Goal).delete()

        # Notes & Attachments
        db.query(CalendarNote).delete()
        db.query(Attachment).delete()

        db.commit()

        # 3. PURE BLANK DATA - NO PRESET SEED
        # Re-initialize default category structures so categories can be edited
        ensure_default_limits(db)

        log_sync_event(
            db,
            sync_type="RESET",
            status="COMPLETED",
            details=f"Đã xóa toàn bộ dữ liệu về trạng thái trống hoàn toàn (Clean Blank State). Bản sao lưu an toàn: {safety_backup.name}"
        )

        return {
            "status": "success",
            "message": "Đã đặt lại toàn bộ dữ liệu về trạng thái trống hoàn toàn (Clean Blank State - 0 nhiệm vụ, 0 lịch trình, 0 khóa học, 0 mục tiêu).",
            "reseeded": False,
            "safety_backup": safety_backup.name
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Lỗi khi đặt lại dữ liệu: {str(e)}")

# ==============================================================================
# PHASE 6: AUTO UPDATE & APP PARTITION FILE SYNC
# ==============================================================================

@router.get("/update/info")
def get_update_info(db: Session = Depends(get_database)):
    """Returns application version, changelog, and partition path."""
    from app.services.update_service import UpdateService
    return UpdateService.get_info(db)

@router.post("/update/apply")
async def apply_update_package(
    file: UploadFile = File(...),
    db: Session = Depends(get_database)
):
    """
    Auto Update Feature: Receives an update package (.zip), automatically creates a safety
    backup snapshot, and extracts/pastes files into the application partition (Workspace Root).
    """
    from app.services.update_service import UpdateService

    BACKUPS_DIR.mkdir(parents=True, exist_ok=True)
    temp_zip = BACKUPS_DIR / f"update_pkg_{file.filename}"

    try:
        with open(temp_zip, "wb") as f:
            shutil.copyfileobj(file.file, f)

        res = UpdateService.apply_update_package(db, temp_zip)
        return res
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        if temp_zip.exists():
            temp_zip.unlink(missing_ok=True)

@router.post("/update/paste-file")
async def paste_file_to_partition(
    file: UploadFile = File(...),
    relative_path: str = Body(..., embed=True),
    db: Session = Depends(get_database)
):
    """Pastes an individual file directly into a relative folder of the app partition."""
    from app.services.update_service import UpdateService

    temp_path = BACKUPS_DIR / f"temp_{file.filename}"
    try:
        with open(temp_path, "wb") as f:
            shutil.copyfileobj(file.file, f)

        res = UpdateService.paste_files_to_partition(db, temp_path, relative_path)
        return res
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        if temp_path.exists():
            temp_path.unlink(missing_ok=True)

# ==============================================================================
# GITHUB AUTO-UPDATE ENDPOINTS
# ==============================================================================

class GitHubUpdateRequest(BaseModel):
    mode: Optional[str] = "auto"
    repo: Optional[str] = None
    branch: Optional[str] = None
    token: Optional[str] = None
    force_overwrite: Optional[bool] = False

class GitHubConfigUpdate(BaseModel):
    repo: Optional[str] = None
    branch: Optional[str] = None
    token: Optional[str] = None
    mode: Optional[str] = None

@router.get("/update/github/check")
def check_github_update(
    repo: Optional[str] = None,
    branch: Optional[str] = None,
    token: Optional[str] = None,
    db: Session = Depends(get_database)
):
    """Checks for new commits / releases on GitHub repository."""
    from app.services.update_service import UpdateService
    return UpdateService.check_github_updates(db, repo=repo, branch=branch, token=token)

@router.post("/update/github/apply")
def apply_github_update(
    payload: GitHubUpdateRequest,
    db: Session = Depends(get_database)
):
    """Performs 1-click update from GitHub via git pull or direct zip download/extract."""
    from app.services.update_service import UpdateService
    try:
        return UpdateService.apply_github_update(
            db,
            mode=payload.mode or "auto",
            repo=payload.repo,
            branch=payload.branch,
            token=payload.token,
            force_overwrite=payload.force_overwrite or False
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/update/github/config")
def get_github_config(db: Session = Depends(get_database)):
    """Gets saved GitHub configuration."""
    from app.services.update_service import UpdateService
    return UpdateService.get_github_config(db)

@router.post("/update/github/config")
def save_github_config(
    payload: GitHubConfigUpdate,
    db: Session = Depends(get_database)
):
    """Saves GitHub configuration."""
    from app.services.update_service import UpdateService
    return UpdateService.save_github_config(db, payload.model_dump())


