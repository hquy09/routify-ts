import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.database.session import engine, SessionLocal
from app.models import Base
from app.api.routes import (
    tasks, goals, schedules, courses, calendar, dashboard, archive, search, attachments,
    settings as settings_routes, screentime, quotes, countdowns, telegram, wellbeing, fitness
)
from app.services.telegram_service import TelegramService

# Create database tables
Base.metadata.create_all(bind=engine)

def ensure_db_migrations():
    """Ensure newly added columns exist in SQLite database."""
    from sqlalchemy import text
    with engine.connect() as conn:
        # Check countdowns table
        try:
            res = conn.execute(text("PRAGMA table_info(countdowns)"))
            cols = [row[1] for row in res.fetchall()]
            if "cover_style" not in cols:
                conn.execute(text("ALTER TABLE countdowns ADD COLUMN cover_style VARCHAR(50) DEFAULT 'DEFAULT'"))
            if "cover_config" not in cols:
                conn.execute(text("ALTER TABLE countdowns ADD COLUMN cover_config TEXT"))
            conn.commit()
        except Exception as e:
            print(f"[Migration] countdowns check: {e}")

        # Check courses table
        try:
            res = conn.execute(text("PRAGMA table_info(courses)"))
            cols = [row[1] for row in res.fetchall()]
            if "cover_style" not in cols:
                conn.execute(text("ALTER TABLE courses ADD COLUMN cover_style VARCHAR(50) DEFAULT 'DEFAULT'"))
            if "cover_config" not in cols:
                conn.execute(text("ALTER TABLE courses ADD COLUMN cover_config TEXT"))
            if "mastery_points" not in cols:
                conn.execute(text("ALTER TABLE courses ADD COLUMN mastery_points INTEGER DEFAULT 0"))
            if "mastery_level" not in cols:
                conn.execute(text("ALTER TABLE courses ADD COLUMN mastery_level INTEGER DEFAULT 1"))
            conn.commit()
        except Exception as e:
            print(f"[Migration] courses check: {e}")

ensure_db_migrations()

async def telegram_reminder_worker():
    """Periodic background worker running to send upcoming schedule alerts and morning briefings."""
    # Wait 10s on startup before first check
    await asyncio.sleep(10)
    while True:
        interval = 60
        try:
            db = SessionLocal()
            try:
                TelegramService.check_and_send_reminders(db)
                from app.models.sync import AppSetting
                ival_setting = db.query(AppSetting).filter(AppSetting.key == "telegram_check_interval").first()
                if ival_setting and ival_setting.value and ival_setting.value.isdigit():
                    interval = max(15, int(ival_setting.value))
            finally:
                db.close()
        except asyncio.CancelledError:
            break
        except Exception as e:
            print(f"[TelegramReminderWorker] Error in reminder cycle: {e}")
        
        await asyncio.sleep(interval)

async def telegram_bot_worker():
    """Background worker for receiving and responding to Telegram bot commands in real-time."""
    # Wait 3s on startup
    await asyncio.sleep(3)
    while True:
        try:
            db = SessionLocal()
            try:
                # Run polling in worker thread to keep FastAPI non-blocking
                await asyncio.to_thread(TelegramService.poll_and_handle_updates, db)
            finally:
                db.close()
        except asyncio.CancelledError:
            break
        except Exception as e:
            await asyncio.sleep(5)

        await asyncio.sleep(1)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: spawn background reminder worker and real-time interactive bot worker
    reminder_task = asyncio.create_task(telegram_reminder_worker())
    bot_task = asyncio.create_task(telegram_bot_worker())
    yield
    # Shutdown: cancel workers
    reminder_task.cancel()
    bot_task.cancel()
    try:
        await asyncio.gather(reminder_task, bot_task, return_exceptions=True)
    except Exception:
        pass

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    lifespan=lifespan,
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # For local development
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include all API routes
app.include_router(tasks.router, prefix=f"{settings.API_V1_STR}/tasks", tags=["Tasks"])
app.include_router(goals.router, prefix=f"{settings.API_V1_STR}/goals", tags=["Goals & Projects"])
app.include_router(schedules.router, prefix=f"{settings.API_V1_STR}/schedules", tags=["Fixed Schedules"])
app.include_router(courses.router, prefix=f"{settings.API_V1_STR}/courses", tags=["Courses"])
app.include_router(calendar.router, prefix=f"{settings.API_V1_STR}/calendar", tags=["Calendar"])
app.include_router(dashboard.router, prefix=f"{settings.API_V1_STR}/dashboard", tags=["Dashboard & Analytics"])
app.include_router(archive.router, prefix=f"{settings.API_V1_STR}/archive", tags=["Archive"])
app.include_router(search.router, prefix=f"{settings.API_V1_STR}/search", tags=["Global Search"])
app.include_router(attachments.router, prefix=f"{settings.API_V1_STR}/attachments", tags=["Attachments"])
app.include_router(settings_routes.router, prefix=f"{settings.API_V1_STR}/settings", tags=["Settings"])
app.include_router(screentime.router, prefix=f"{settings.API_V1_STR}/screentime", tags=["Screen Time & Discipline"])
app.include_router(quotes.router, prefix=f"{settings.API_V1_STR}/quotes", tags=["Quotes & Philosophy"])
app.include_router(countdowns.router, prefix=f"{settings.API_V1_STR}/countdowns", tags=["Countdowns"])
app.include_router(telegram.router, prefix=f"{settings.API_V1_STR}/telegram", tags=["Telegram Bot Notifications"])
app.include_router(wellbeing.router, prefix=f"{settings.API_V1_STR}/wellbeing", tags=["Mental Health & Wellbeing"])
app.include_router(fitness.router, prefix=f"{settings.API_V1_STR}/fitness", tags=["Fitness & Sports"])

@app.get("/health")
def health_check():
    return {"status": "ok", "project": settings.PROJECT_NAME, "version": settings.VERSION}
