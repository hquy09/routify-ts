import {
  Task, Goal, Project, FixedSchedule, CalendarWeeklyResponse,
  CalendarMonthlyResponse, CalendarDayView, Course, CourseNode, DashboardStats,
  HeatmapDay, BarChartItem, WeeklyReview, ConflictCheckResponse, CountdownItem,
  HeaderSummary, DisciplineRatingConfig, BurnoutAnalysisOut, BurnoutCustomConfig,
  GlobalWellbeingAnalysis, WellbeingCustomConfig, TensionSummary
} from '../types';
import {
  WorkoutLog, WorkoutLogInput, FitnessProfile, FitnessProfileInput,
  FitnessWeeklyPlan, FitnessSummary
} from '../types/fitness';

const BASE_URL = '/api';

async function request<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${endpoint}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers || {})
    },
    ...options,
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`API error (${res.status}): ${errorText || res.statusText}`);
  }

  // Trigger real-time save timestamp update on modifying requests (POST, PUT, PATCH, DELETE)
  const method = (options?.method || 'GET').toUpperCase();
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    const nowIso = new Date().toISOString();
    try {
      localStorage.setItem('lifeos_last_db_save', nowIso);
      window.dispatchEvent(new CustomEvent('lifeos_db_saved', { detail: { timestamp: nowIso } }));
    } catch {
      // Ignore localStorage quotas in private mode
    }
  }

  return res.json();
}

export const api = {
  // Tasks
  tasks: {
    list: (params?: {
      status?: string;
      goal_id?: number;
      project_id?: number;
      course_node_id?: number;
      difficulty?: number;
      priority?: string;
      date_filter?: string;
      search?: string;
      week_date?: string;
      start_date?: string;
      end_date?: string;
    }) => {
      const q = new URLSearchParams();
      if (params) {
        Object.entries(params).forEach(([k, v]) => {
          if (v !== undefined && v !== null && v !== '') q.append(k, String(v));
        });
      }
      return request<Task[]>(`/tasks?${q.toString()}`);
    },
    getUnfinishedSummary: (refDate?: string) => {
      const q = refDate ? `?ref_date=${refDate}` : '';
      return request<{
        total_unfinished: number;
        current_week_start: string;
        past_weeks: Array<{
          week_key: string;
          week_number: number;
          year: number;
          label: string;
          tasks: Task[];
        }>;
        tasks: Task[];
      }>(`/tasks/backlog/unfinished-summary${q}`);
    },
    rolloverPast: (targetDate?: string) => {
      const q = targetDate ? `?target_date=${targetDate}` : '';
      return request<{
        success: boolean;
        rolled_count: number;
        target_date: string;
        message: string;
      }>(`/tasks/backlog/rollover-past${q}`, { method: 'POST' });
    },
    get: (id: number) => request<Task>(`/tasks/${id}`),
    create: (data: Partial<Task> & { subtask_titles?: string[] }) =>
      request<Task>('/tasks', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: Partial<Task>) =>
      request<Task>(`/tasks/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: number) => request<{ message: string }>(`/tasks/${id}`, { method: 'DELETE' }),
    transfer: (id: number, data: { new_due_datetime: string; keep_subtasks?: boolean; notes?: string }) =>
      request<{ old_task: Task; new_task: Task }>(`/tasks/${id}/transfer`, {
        method: 'POST',
        body: JSON.stringify(data)
      }),
    addSubtask: (taskId: number, title: string) =>
      request<any>(`/tasks/${taskId}/subtasks`, { method: 'POST', body: JSON.stringify({ title }) }),
    toggleSubtask: (subtaskId: number) =>
      request<any>(`/tasks/subtasks/${subtaskId}/toggle`, { method: 'PUT' }),
    deleteSubtask: (subtaskId: number) =>
      request<{ message: string }>(`/tasks/subtasks/${subtaskId}`, { method: 'DELETE' }),
    checkConflict: (startDatetime: string, endDatetime: string) =>
      request<ConflictCheckResponse>('/tasks/check-conflict', {
        method: 'POST',
        body: JSON.stringify({ start_datetime: startDatetime, end_datetime: endDatetime })
      }),
  },

  // Goals & Projects
  goals: {
    list: () => request<Goal[]>('/goals'),
    create: (data: Partial<Goal>) => request<Goal>('/goals', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: Partial<Goal>) =>
      request<Goal>(`/goals/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: number) => request<{ message: string }>(`/goals/${id}`, { method: 'DELETE' }),
    createProject: (goalId: number, data: Partial<Project>) =>
      request<Project>(`/goals/projects`, {
        method: 'POST',
        body: JSON.stringify({ ...data, goal_id: goalId })
      }),
  },

  // Countdowns (Ngày thi, Mục tiêu, Sự kiện)
  countdowns: {
    list: (category?: string) => {
      const q = category ? `?category=${category}` : '';
      return request<CountdownItem[]>(`/countdowns${q}`);
    },
    create: (data: Partial<CountdownItem>) =>
      request<CountdownItem>('/countdowns', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: Partial<CountdownItem>) =>
      request<CountdownItem>(`/countdowns/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: number) => request<{ ok: boolean; message: string }>(`/countdowns/${id}`, { method: 'DELETE' }),
  },

  // Fixed Schedules
  schedules: {
    list: (isActive?: boolean) => {
      const q = isActive !== undefined ? `?is_active=${isActive}` : '';
      return request<FixedSchedule[]>(`/schedules${q}`);
    },
    create: (data: Partial<FixedSchedule>) =>
      request<FixedSchedule>('/schedules', { method: 'POST', body: JSON.stringify(data) }),
    createBatch: (data: { schedules: Partial<FixedSchedule>[]; replace_category?: string }) =>
      request<FixedSchedule[]>('/schedules/batch', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: Partial<FixedSchedule>) =>
      request<FixedSchedule>(`/schedules/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: number) => request<{ message: string }>(`/schedules/${id}`, { method: 'DELETE' }),
    setOverride: (id: number, data: { occurrence_date: string; status: string; override_start_time?: string; override_end_time?: string; notes?: string }) =>
      request<any>(`/schedules/${id}/override`, { method: 'POST', body: JSON.stringify({ ...data, fixed_schedule_id: id }) }),
    getFreeTime: (targetDate: string) => request<any>(`/schedules/free-time/${targetDate}`),
    getSchoolClasses: () =>
      request<{ id: number; code: string; name: string; grade: number; shift: string }[]>(
        '/schedules/school-sync/classes'
      ),
    getSchoolTimetable: (classCode: string) =>
      request<{
        school_name: string;
        academic_year: number;
        term: number;
        effective_date: string;
        class_code: string;
        class_id: number;
        grid: Record<string, string>;
        slots_count: number;
      }>(`/schedules/school-sync/timetable?class_code=${encodeURIComponent(classCode)}`),
  },

  // Courses
  courses: {
    list: () => request<Course[]>('/courses'),
    getAllNodes: () => request<CourseNode[]>('/courses/all-nodes'),
    get: (id: number) => request<Course>(`/courses/${id}`),
    create: (data: Partial<Course>) => request<Course>('/courses', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: Partial<Course>) =>
      request<Course>(`/courses/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: number) => request<{ message: string }>(`/courses/${id}`, { method: 'DELETE' }),
    createNode: (data: Partial<CourseNode>) =>
      request<CourseNode>('/courses/nodes', { method: 'POST', body: JSON.stringify(data) }),
    updateNode: (id: number, data: Partial<CourseNode>) =>
      request<CourseNode>(`/courses/nodes/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteNode: (id: number) => request<{ message: string }>(`/courses/nodes/${id}`, { method: 'DELETE' }),
    createStudyTask: (data: {
      lesson_id: number;
      title?: string;
      due_datetime?: string;
      difficulty?: number;
      priority?: string;
      goal_id?: number;
      project_id?: number;
      fixed_schedule_id?: number;
      subtask_titles?: string[];
      notes?: string;
    }) =>
      request<Task>('/courses/create-task', { method: 'POST', body: JSON.stringify(data) }),
    getBurnoutAnalysis: (courseId: number, config?: BurnoutCustomConfig) =>
      request<BurnoutAnalysisOut>(`/courses/${courseId}/burnout-analysis`, {
        method: config ? 'POST' : 'GET',
        body: config ? JSON.stringify(config) : undefined,
      }),
    calibrateBurnout: (courseId: number) =>
      request<BurnoutCustomConfig>(`/courses/${courseId}/calibrate-burnout`, { method: 'POST' }),
    resetMastery: (courseId: number) =>
      request<Course>(`/courses/${courseId}/reset-mastery`, { method: 'POST' }),
    resetAllRanks: () =>
      request<{ message: string; count: number }>('/courses/reset-all-ranks', { method: 'POST' }),
  },

  // Mental Health & Global Wellbeing
  wellbeing: {
    getAnalysis: (config?: WellbeingCustomConfig) =>
      request<GlobalWellbeingAnalysis>('/wellbeing/analysis', {
        method: config ? 'POST' : 'GET',
        body: config ? JSON.stringify(config) : undefined,
      }),
    calibrate: () =>
      request<WellbeingCustomConfig>('/wellbeing/calibrate', { method: 'POST' }),
    saveSettings: (config: WellbeingCustomConfig) =>
      request<{ ok: boolean; message: string }>('/wellbeing/settings', {
        method: 'POST',
        body: JSON.stringify(config),
      }),
    getTensionSummary: () =>
      request<TensionSummary>('/wellbeing/tension-summary'),
  },

  // Calendar
  calendar: {
    getDaily: (dateStr?: string) => {
      const q = dateStr ? `?date_str=${dateStr}` : '';
      return request<CalendarDayView>(`/calendar/daily${q}`);
    },
    getWeekly: (dateStr?: string) => {
      const q = dateStr ? `?date_str=${dateStr}` : '';
      return request<CalendarWeeklyResponse>(`/calendar/weekly${q}`);
    },
    getMonthly: (year: number, month: number) =>
      request<CalendarMonthlyResponse>(`/calendar/monthly?year=${year}&month=${month}`),
    addNote: (data: { note_date: string; content: string }) =>
      request<any>('/calendar/notes', { method: 'POST', body: JSON.stringify(data) }),
    deleteNote: (id: number) => request<{ message: string }>(`/calendar/notes/${id}`, { method: 'DELETE' }),
  },

  // Dashboard
  dashboard: {
    getStats: () => request<DashboardStats>('/dashboard/stats'),
    getHeatmap: (days = 180) => request<HeatmapDay[]>(`/dashboard/heatmap?days=${days}`),
    getBarChart: (period = 'DAY') => request<{ filter_by: string; items: BarChartItem[] }>(`/dashboard/barchart?period=${period}`),
    getWeeklyReview: (year: number, weekNumber: number) =>
      request<WeeklyReview | null>(`/dashboard/weekly-review?year=${year}&week_number=${weekNumber}`),
    saveWeeklyReview: (data: Partial<WeeklyReview>) =>
      request<WeeklyReview>('/dashboard/weekly-review', { method: 'POST', body: JSON.stringify(data) }),
    getHeaderSummary: () => request<HeaderSummary>('/dashboard/header-summary'),
  },

  // Archive
  archive: {
    list: () => request<Record<number, Record<string, any[]>>>('/archive'),
    finalize: (year: number, weekNumber: number) =>
      request<any>(`/archive/finalize?year=${year}&week_number=${weekNumber}`, { method: 'POST' }),
  },

  // Global Search
  search: (query: string) => request<any>(`/search?q=${encodeURIComponent(query)}`),

  // Settings
  settings: {
    getAll: () => request<Record<string, string>>('/settings/all'),
    set: (key: string, value: string) => request<any>('/settings/set', { method: 'POST', body: JSON.stringify({ key, value }) }),
    getDbStatus: () => request<any>('/settings/db-status'),
    backup: () => request<any>('/settings/backup', { method: 'POST' }),
    listBackups: () => request<any[]>('/settings/backups'),
    getGoogleDriveStatus: () => request<any>('/settings/google-drive/status'),
    getSyncHistory: () => request<any[]>('/settings/sync-history'),
    syncGoogleDrive: () => request<any>('/settings/google-drive/sync', { method: 'POST' }),
    exportBackupBundleUrl: () => `${BASE_URL}/settings/google-drive/export-bundle`,
    importBackupBundle: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(`${BASE_URL}/settings/google-drive/import-bundle`, {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(errorText || res.statusText);
      }
      return res.json();
    },
    uploadCredentials: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(`${BASE_URL}/settings/google-drive/credentials`, {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(errorText || res.statusText);
      }
      return res.json();
    },
    toggleAutoSync: (enabled: boolean) =>
      request<any>('/settings/google-drive/toggle-auto', {
        method: 'POST',
        body: JSON.stringify({ enabled }),
      }),
    resetDatabase: (confirm: string, reseed: boolean = false) =>
      request<any>('/settings/reset', {
        method: 'POST',
        body: JSON.stringify({ confirm, reseed }),
      }),
    getUpdateInfo: () =>
      request<{
        app_name: string;
        current_version: string;
        latest_version: string;
        release_date: string;
        app_root_dir: string;
        storage_dir: string;
        update_channel: string;
        is_up_to_date: boolean;
        changelog: Array<{
          version: string;
          date: string;
          title: string;
          is_latest: boolean;
          highlights: Array<{ category: string; icon: string; content: string }>;
        }>;
      }>('/settings/update/info'),
    applyUpdatePackage: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(`${BASE_URL}/settings/update/apply`, {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(errorText || res.statusText);
      }
      return res.json();
    },
    checkGitHubUpdate: (params?: { repo?: string; branch?: string; token?: string }) => {
      const q = new URLSearchParams();
      if (params?.repo) q.append('repo', params.repo);
      if (params?.branch) q.append('branch', params.branch);
      if (params?.token) q.append('token', params.token);
      const queryStr = q.toString() ? `?${q.toString()}` : '';
      return request<any>(`/settings/update/github/check${queryStr}`);
    },
    applyGitHubUpdate: (payload: { mode?: string; repo?: string; branch?: string; token?: string; force_overwrite?: boolean }) =>
      request<any>('/settings/update/github/apply', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    getGitHubConfig: () => request<any>('/settings/update/github/config'),
    saveGitHubConfig: (config: { repo?: string; branch?: string; token?: string; mode?: string }) =>
      request<any>('/settings/update/github/config', {
        method: 'POST',
        body: JSON.stringify(config),
      }),
  },

  // Screen Time & Discipline
  screentime: {
    getStatus: () => request<{ enabled: boolean }>('/screentime/status'),
    toggle: (enabled: boolean) =>
      request<{ message: string; enabled: boolean }>('/screentime/toggle', {
        method: 'POST',
        body: JSON.stringify({ enabled }),
      }),
    getOverview: (targetDate?: string) => {
      const q = targetDate ? `?target_date=${targetDate}` : '';
      return request<any>(`/screentime/overview${q}`);
    },
    getDaily: (targetDate?: string) => {
      const q = targetDate ? `?target_date=${targetDate}` : '';
      return request<any>(`/screentime/daily${q}`);
    },
    createLog: (data: { category: string; minutes_spent: number; app_name?: string | null; notes?: string | null; log_date?: string }) =>
      request<any>('/screentime/logs', { method: 'POST', body: JSON.stringify(data) }),
    deleteLog: (id: number) =>
      request<any>(`/screentime/logs/${id}`, { method: 'DELETE' }),
    listLimits: () => request<any[]>('/screentime/limits'),
    createCategory: (data: { category: string; label: string; category_type: string; daily_limit_minutes: number; description?: string | null }) =>
      request<any>('/screentime/limits', { method: 'POST', body: JSON.stringify(data) }),
    updateLimit: (id: number, data: { label?: string; category_type?: string; daily_limit_minutes?: number; is_active?: boolean; description?: string | null }) =>
      request<any>(`/screentime/limits/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteCategory: (id: number) =>
      request<any>(`/screentime/limits/${id}`, { method: 'DELETE' }),
    getDisciplineConfig: () =>
      request<DisciplineRatingConfig>('/screentime/discipline-config'),
    saveDisciplineConfig: (config: Partial<DisciplineRatingConfig>) =>
      request<{ message: string; config: DisciplineRatingConfig }>('/screentime/discipline-config', {
        method: 'POST',
        body: JSON.stringify(config),
      }),
  },

  // Quotes & Philosophy
  quotes: {
    getHourly: (refresh = false) =>
      request<{
        hour_key: string;
        current_hour: number;
        timestamp: string;
        quote: string;
        author: string;
        school: string;
        original_quote?: string;
        total_collection: number;
      }>(`/quotes/hourly${refresh ? '?refresh=true' : ''}`),
    getRandom: (external = false) =>
      request<any>(`/quotes/random${external ? '?external=true' : ''}`),
  },

  // Telegram Bot Notifications
  telegram: {
    getConfig: () =>
      request<{
        has_token: boolean;
        masked_token: string;
        chat_id: string;
        is_enabled: boolean;
        reminder_minutes: number;
        check_interval: number;
        morning_briefing_enabled: boolean;
        morning_briefing_time: string;
        last_morning_briefing_date?: string;
        include_philosophy: boolean;
        notify_schedules: boolean;
        notify_tasks: boolean;
        bot_username?: string;
        bot_first_name?: string;
      }>('/telegram/config'),
    saveConfig: (data: {
      bot_token?: string;
      chat_id?: string;
      is_enabled?: boolean;
      reminder_minutes?: number;
      check_interval?: number;
      morning_briefing_enabled?: boolean;
      morning_briefing_time?: string;
      include_philosophy?: boolean;
      notify_schedules?: boolean;
      notify_tasks?: boolean;
    }) =>
      request<{ message: string; config: any }>('/telegram/config', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    clearConfig: () =>
      request<{ message: string; config: any }>('/telegram/clear', {
        method: 'POST',
      }),
    getBotInfo: (botToken?: string) =>
      request<{
        ok: boolean;
        bot?: {
          id: number;
          is_bot: boolean;
          first_name: string;
          username: string;
          can_join_groups?: boolean;
        };
        error?: string;
      }>(`/telegram/bot-info${botToken ? `?bot_token=${encodeURIComponent(botToken)}` : ''}`),
    detectChatId: (botToken?: string) =>
      request<{
        ok: boolean;
        chat_id: string;
        first_name: string;
        username?: string;
        chat_type?: string;
        latest_message?: string;
      }>('/telegram/detect-chat-id', {
        method: 'POST',
        body: JSON.stringify(botToken ? { bot_token: botToken } : {}),
      }),
    test: (data?: { bot_token?: string; chat_id?: string }) =>
      request<{ message: string }>('/telegram/test', {
        method: 'POST',
        body: JSON.stringify(data || {}),
      }),
    checkUpcoming: () =>
      request<{ message: string; sent_events: string[] }>('/telegram/check-upcoming', {
        method: 'POST',
      }),
    sendDailyBriefing: () =>
      request<{ message: string }>('/telegram/morning-briefing', {
        method: 'POST',
      }),
    sendMorningBriefing: () =>
      request<{ message: string }>('/telegram/morning-briefing', {
        method: 'POST',
      }),
  },

  // Fitness & Sports (Sức khỏe & Thể thao, Gym, Chạy bộ, Calo, Nước uống, Lịch tập)
  fitness: {
    getSummary: (refDate?: string) =>
      request<FitnessSummary>(`/fitness/summary${refDate ? `?ref_date=${encodeURIComponent(refDate)}` : ''}`),
    getProfile: () => request<FitnessProfile>('/fitness/profile'),
    updateProfile: (data: FitnessProfileInput) =>
      request<FitnessProfile>('/fitness/profile', { method: 'PUT', body: JSON.stringify(data) }),
    addWater: (amount_ml: number) =>
      request<FitnessProfile>('/fitness/water/add', { method: 'POST', body: JSON.stringify({ amount_ml }) }),
    listLogs: (params?: { workout_type?: string; start_date?: string; end_date?: string; limit?: number }) => {
      const q = new URLSearchParams();
      if (params?.workout_type) q.append('workout_type', params.workout_type);
      if (params?.start_date) q.append('start_date', params.start_date);
      if (params?.end_date) q.append('end_date', params.end_date);
      if (params?.limit) q.append('limit', params.limit.toString());
      return request<WorkoutLog[]>(`/fitness/logs${q.toString() ? `?${q.toString()}` : ''}`);
    },
    createLog: (data: WorkoutLogInput) =>
      request<WorkoutLog>('/fitness/logs', { method: 'POST', body: JSON.stringify(data) }),
    updateLog: (id: number, data: Partial<WorkoutLogInput>) =>
      request<WorkoutLog>(`/fitness/logs/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteLog: (id: number) =>
      request<{ message: string }>(`/fitness/logs/${id}`, { method: 'DELETE' }),
    getWeeklyPlans: () => request<FitnessWeeklyPlan[]>('/fitness/weekly-plans'),
    updateWeeklyPlans: (plans: FitnessWeeklyPlan[]) =>
      request<FitnessWeeklyPlan[]>('/fitness/weekly-plans', { method: 'PUT', body: JSON.stringify({ plans }) }),
    toggleWeeklyPlan: (id: number) =>
      request<FitnessWeeklyPlan>(`/fitness/weekly-plans/${id}/toggle`, { method: 'POST' }),
  },
};

