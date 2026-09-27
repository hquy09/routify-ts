import React, { useState, useEffect, useRef } from 'react';
import {
  Settings as SettingsIcon, Database, Cloud, Palette,
  HardDrive, Download, RefreshCw, CheckCircle2, ShieldCheck,
  AlertCircle, Upload, AlertTriangle, FileArchive, Check,
  Radio, RotateCcw, XCircle, Key, Layers, Edit3, Trash2,
  Plus, FolderPlus, X, User, Sliders, Send, Bell, Sparkles,
  ExternalLink, Eye, EyeOff, Shield, Zap, Search, Volume2,
  VolumeX, Moon, Sun, Clock, Star, ArrowUpRight, BookOpen, Terminal
} from 'lucide-react';
import { api } from '../services/api';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { ScreenTimeLimit, CategoryTypeConfig, DEFAULT_CATEGORY_TYPES, DisciplineRatingConfig } from '../types';
import {
  getStoredCategoryTypes,
  fetchCategoryTypes,
  saveCategoryTypes,
  getCategoryTypeConfig,
} from '../utils/categoryTypes';
import {
  isCourseGamificationEnabled,
  setCourseGamificationEnabled,
  COURSE_RANK_TIERS,
  getCourseMasteryInfo,
  getTopCourseMastery,
} from '../utils/courseGamification';
import {
  isMentalHealthEnabled,
  setMentalHealthEnabled,
  isDigitalWellbeingEnabled,
  setDigitalWellbeingEnabled,
  isRankOnTopbarEnabled,
  setRankOnTopbarEnabled,
} from '../utils/featureFlags';
import { Swords, HeartPulse, Smartphone, Trophy, Crown, Flame } from 'lucide-react';

type SettingsTabId = 'GENERAL' | 'NOTIFICATIONS' | 'SCREENTIME' | 'MASTERY_RANKS' | 'ADVANCED' | 'BACKUP' | 'DANGER';

interface SearchIndexItem {
  id: string;
  title: string;
  tab: SettingsTabId;
  tabName: string;
  keywords: string[];
}

const SEARCH_INDEX: SearchIndexItem[] = [
  { id: 'profile', title: 'Hồ sơ & Tên hiển thị', tab: 'GENERAL', tabName: 'Chung', keywords: ['tên', 'name', 'user', 'hồ sơ', 'chào'] },
  { id: 'theme', title: 'Giao diện Sáng / Tối', tab: 'GENERAL', tabName: 'Chung', keywords: ['theme', 'tối', 'sáng', 'dark', 'light', 'màu sắc'] },
  { id: 'task-defaults', title: 'Quy chuẩn & Độ khó mặc định', tab: 'GENERAL', tabName: 'Chung', keywords: ['độ khó', 'ưu tiên', 'priority', 'difficulty', 'task', 'nhiệm vụ'] },
  { id: 'work-hours', title: 'Khung giờ sinh hoạt & Học tập', tab: 'GENERAL', tabName: 'Chung', keywords: ['giờ', 'khung giờ', 'bắt đầu', 'kết thúc', 'thời gian'] },
  { id: 'mental-health', title: 'Quản lý Sức khỏe Tinh thần & Mức độ Căng thẳng', tab: 'GENERAL', tabName: 'Chung', keywords: ['sức khỏe', 'tinh thần', 'áp lực', 'căng thẳng', 'mental', 'stress', 'sức khoẻ', 'tắt bật'] },
  { id: 'digital-wellbeing', title: 'Chỉ số Kỷ luật & Cân bằng số', tab: 'GENERAL', tabName: 'Chung', keywords: ['cân bằng số', 'screentime', 'nhất quán', 'digital wellbeing', 'kỷ luật'] },
  { id: 'gamification', title: 'Hệ thống Cày Cuốc & 11 Cấp Bậc Danh Hiệu', tab: 'MASTERY_RANKS', tabName: 'Danh Hiệu & Rank', keywords: ['cày cuốc', 'rank', 'chiến thần', 'tuyệt đối', 'kinh nghiệm', 'exp', 'gamification', 'khóa học', 'danh hiệu', 'thần thoại', 'hào quang', 'topbar'] },
  { id: 'telegram', title: 'Bot Telegram & Nhắc nhở', tab: 'NOTIFICATIONS', tabName: 'Thông báo', keywords: ['telegram', 'bot', 'token', 'chat id', 'nhắc nhở', 'thông báo'] },
  { id: 'sound-alert', title: 'Âm thanh thông báo', tab: 'NOTIFICATIONS', tabName: 'Thông báo', keywords: ['âm thanh', 'sound', 'chuông', 'tiếng'] },
  { id: 'browser-notif', title: 'Thông báo trên trình duyệt', tab: 'NOTIFICATIONS', tabName: 'Thông báo', keywords: ['trình duyệt', 'browser', 'web', 'push', 'thông báo'] },
  { id: 'categories', title: 'Định mức màn hình & Danh mục', tab: 'SCREENTIME', tabName: 'Kỷ luật', keywords: ['screentime', 'game', 'mạng xã hội', 'định mức', 'giới hạn', 'phút', 'thời gian'] },
  { id: 'category-types', title: 'Nhóm phân loại & Hiệu ứng', tab: 'SCREENTIME', tabName: 'Kỷ luật', keywords: ['phân loại', 'nhóm', 'type', 'thưởng', 'phạt', 'màu'] },
  { id: 'discipline-scoring', title: 'Thuật toán & Cơ chế tính điểm kỷ luật', tab: 'ADVANCED', tabName: 'Nâng cao', keywords: ['kỷ luật', 'rating', 'thuật toán', 'trừ điểm', 'ngưỡng', 'hệ số', 'công thức'] },
  { id: 'quiet-hours', title: 'Chế độ Giờ yên tĩnh', tab: 'ADVANCED', tabName: 'Nâng cao', keywords: ['yên tĩnh', 'quiet', 'đêm', 'ngủ', 'không làm phiền'] },
  { id: 'smart-schedule', title: 'Gợi ý xếp lịch thông minh', tab: 'ADVANCED', tabName: 'Nâng cao', keywords: ['gợi ý', 'thông minh', 'smart', 'schedule', 'xếp lịch'] },
  { id: 'auto-update', title: 'Tự động cập nhật ứng dụng (Auto Update) & Changelog', tab: 'BACKUP', tabName: 'Sao lưu', keywords: ['update', 'cập nhật', 'auto update', 'phiên bản', 'version', 'changelog', 'dán file'] },
  { id: 'gdrive', title: 'Đồng bộ Google Drive', tab: 'BACKUP', tabName: 'Sao lưu', keywords: ['drive', 'google', 'đồng bộ', 'sync', 'đám mây', 'cloud'] },
  { id: 'backup-zip', title: 'Gói sao lưu di động (.zip)', tab: 'BACKUP', tabName: 'Sao lưu', keywords: ['zip', 'sao lưu', 'backup', 'xuất', 'nhập', 'khôi phục'] },
  { id: 'db-stats', title: 'Cơ sở dữ liệu SQLite & Dung lượng', tab: 'BACKUP', tabName: 'Sao lưu', keywords: ['sqlite', 'database', 'cơ sở dữ liệu', 'dung lượng'] },
  { id: 'danger-reset', title: 'Đặt lại về dữ liệu trống', tab: 'DANGER', tabName: 'Vùng nguy hiểm', keywords: ['reset', 'xóa', 'trống', 'khôi phục', 'nguy hiểm'] },
];

export const SettingsPage: React.FC<{ isDark: boolean; onToggleTheme: () => void }> = ({
  isDark,
  onToggleTheme,
}) => {
  // Navigation & Search
  const [activeTab, setActiveTab] = useState<SettingsTabId>('GENERAL');
  const [searchQuery, setSearchQuery] = useState('');

  // User Profile
  const [userName, setUserName] = useState<string>(() => {
    return localStorage.getItem('lifeos_user_name') || 'Hữu Quý';
  });
  const [isSavingName, setIsSavingName] = useState(false);

  // Task & Hours Defaults
  const [defaultDifficulty, setDefaultDifficulty] = useState('2');
  const [defaultPriority, setDefaultPriority] = useState('MEDIUM');
  const [smartScheduleDefault, setSmartScheduleDefault] = useState(true);
  const [dayStartHour, setDayStartHour] = useState('07:00');
  const [dayEndHour, setDayEndHour] = useState('22:00');
  const [quietHoursEnabled, setQuietHoursEnabled] = useState(true);
  const [isSavingTaskDefaults, setIsSavingTaskDefaults] = useState(false);
  const [taskDefaultsFeedback, setTaskDefaultsFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Course Gamification & EXP Mastery System (Default: OFF)
  const [courseGamificationEnabled, setCourseGamificationEnabledState] = useState<boolean>(() => isCourseGamificationEnabled());
  const [showRankOnTopbar, setShowRankOnTopbar] = useState<boolean>(() => isRankOnTopbarEnabled());
  const [coursesList, setCoursesList] = useState<any[]>([]);

  const handleToggleCourseGamification = () => {
    const next = !courseGamificationEnabled;
    setCourseGamificationEnabledState(next);
    setCourseGamificationEnabled(next);
  };

  const handleToggleRankOnTopbar = () => {
    const next = !showRankOnTopbar;
    setShowRankOnTopbar(next);
    setRankOnTopbarEnabled(next);
  };

  const [isResettingRanks, setIsResettingRanks] = useState(false);
  const handleResetAllRanks = async () => {
    if (window.confirm('Bạn có chắc chắn muốn đặt lại điểm EXP và Rank của toàn bộ khóa học về 0 (Tập sự)? Bài học và lịch trình vẫn giữ nguyên.')) {
      try {
        setIsResettingRanks(true);
        const res = await api.courses.resetAllRanks();
        alert(`Đã đặt lại dữ liệu Rank cho ${res.count} khóa học về 0 EXP.`);
        api.courses.list().then(setCoursesList).catch(() => {});
        window.dispatchEvent(new CustomEvent('lifeos_courses_updated'));
      } catch (err) {
        console.error('Failed to reset all ranks:', err);
        alert('Không thể đặt lại dữ liệu Rank.');
      } finally {
        setIsResettingRanks(false);
      }
    }
  };

  // Mental Health & Cognitive Load (Default: ON)
  const [mentalHealthEnabled, setMentalHealthEnabledState] = useState<boolean>(() => isMentalHealthEnabled());

  const handleToggleMentalHealth = () => {
    const next = !mentalHealthEnabled;
    setMentalHealthEnabledState(next);
    setMentalHealthEnabled(next);
  };

  // Digital Wellbeing & Screentime (Default: ON)
  const [digitalWellbeingEnabled, setDigitalWellbeingEnabledState] = useState<boolean>(() => isDigitalWellbeingEnabled());

  const handleToggleDigitalWellbeing = async () => {
    const next = !digitalWellbeingEnabled;
    setDigitalWellbeingEnabledState(next);
    setDigitalWellbeingEnabled(next);
    try {
      await api.screentime.toggle(next);
    } catch (err) {
      console.error('Failed to toggle backend screentime:', err);
    }
  };

  // Sound & Browser Notification
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
    return localStorage.getItem('lifeos_sound_enabled') !== 'false';
  });
  const [browserNotificationPermission, setBrowserNotificationPermission] = useState<string>(() => {
    return typeof Notification !== 'undefined' ? Notification.permission : 'default';
  });

  // DB & Backups
  const [dbStatus, setDbStatus] = useState<any>(null);
  const [backups, setBackups] = useState<any[]>([]);
  const [syncHistory, setSyncHistory] = useState<any[]>([]);
  const [gdriveStatus, setGdriveStatus] = useState<any>(null);
  const [categories, setCategories] = useState<ScreenTimeLimit[]>([]);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  // Category management active sub-tab: 'CATEGORIES' | 'TYPES'
  const [catActiveTab, setCatActiveTab] = useState<'CATEGORIES' | 'TYPES'>('CATEGORIES');
  const [categoryTypes, setCategoryTypes] = useState<CategoryTypeConfig[]>(() => getStoredCategoryTypes());

  // Category Edit / Create Modal
  const [isCatModalOpen, setIsCatModalOpen] = useState(false);
  const [editingCat, setEditingCat] = useState<ScreenTimeLimit | null>(null);
  const [catLabel, setCatLabel] = useState('');
  const [catCode, setCatCode] = useState('');
  const [catType, setCatType] = useState<string>('DISTRACTION');
  const [catLimit, setCatLimit] = useState('60');
  const [catDesc, setCatDesc] = useState('');

  // Category Type Edit / Create Modal
  const [isTypeModalOpen, setIsTypeModalOpen] = useState(false);
  const [editingType, setEditingType] = useState<CategoryTypeConfig | null>(null);
  const [typeLabel, setTypeLabel] = useState('');
  const [typeId, setTypeId] = useState('');
  const [typeColor, setTypeColor] = useState('#3b82f6');
  const [typeEffect, setTypeEffect] = useState<'PENALTY' | 'BONUS' | 'NEUTRAL'>('NEUTRAL');
  const [typeDesc, setTypeDesc] = useState('');

  // Reset Modal state
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [resetConfirmText, setResetConfirmText] = useState('');
  const [isResetting, setIsResetting] = useState(false);

  // Telegram Bot Notification states
  const [tgConfig, setTgConfig] = useState<{
    has_token: boolean;
    masked_token: string;
    chat_id: string;
    is_enabled: boolean;
    reminder_minutes: number;
    check_interval?: number;
    morning_briefing_enabled?: boolean;
    morning_briefing_time?: string;
    include_philosophy?: boolean;
    notify_schedules?: boolean;
    notify_tasks?: boolean;
    bot_username?: string;
    bot_first_name?: string;
  }>({
    has_token: false,
    masked_token: '',
    chat_id: '',
    is_enabled: false,
    reminder_minutes: 15,
    check_interval: 60,
    morning_briefing_enabled: true,
    morning_briefing_time: '05:00',
    include_philosophy: true,
    notify_schedules: true,
    notify_tasks: true,
  });
  const [tgBotTokenInput, setTgBotTokenInput] = useState('');
  const [showTgToken, setShowTgToken] = useState(false);
  const [tgChatIdInput, setTgChatIdInput] = useState('');
  const [tgIsEnabled, setTgIsEnabled] = useState(false);
  const [tgReminderMinutes, setTgReminderMinutes] = useState(15);
  const [tgCheckInterval, setTgCheckInterval] = useState(60);
  const [tgMorningBriefingEnabled, setTgMorningBriefingEnabled] = useState(true);
  const [tgMorningBriefingTime, setTgMorningBriefingTime] = useState('05:00');
  const [tgIncludePhilosophy, setTgIncludePhilosophy] = useState(true);
  const [tgNotifySchedules, setTgNotifySchedules] = useState(true);
  const [tgNotifyTasks, setTgNotifyTasks] = useState(true);
  const [tgBotUsername, setTgBotUsername] = useState('');
  const [isDetectingChatId, setIsDetectingChatId] = useState(false);
  const [detectedUser, setDetectedUser] = useState<{
    chat_id: string;
    first_name: string;
    username?: string;
  } | null>(null);
  const [isSavingTg, setIsSavingTg] = useState(false);
  const [isTestingTg, setIsTestingTg] = useState(false);
  const [isBriefingTg, setIsBriefingTg] = useState(false);
  const [isCheckingUpcomingTg, setIsCheckingUpcomingTg] = useState(false);
  const [isValidatingToken, setIsValidatingToken] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const listeningRef = useRef(false);
  const logContainerRef = useRef<HTMLDivElement>(null);
  const [tgLogs, setTgLogs] = useState<Array<{ id: string; time: string; text: string; type: 'info' | 'success' | 'warn' | 'error' }>>([
    { id: '1', time: new Date().toLocaleTimeString(), text: 'Hệ thống sẵn sàng. Nhập Token hoặc bấm Listening để bắt đầu.', type: 'info' }
  ]);
  const [tgFeedback, setTgFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const cleanTelegramToken = (raw: string): string => {
    if (!raw) return '';
    const match = raw.match(/(\d{8,12}:[A-Za-z0-9_-]{25,50})/);
    if (match) return match[1];
    const fallback = raw.match(/(\d+:[A-Za-z0-9_-]{20,})/);
    if (fallback) return fallback[1];
    return raw.trim();
  };

  const addTgLog = (text: string, type: 'info' | 'success' | 'warn' | 'error' = 'info') => {
    const time = new Date().toLocaleTimeString();
    setTgLogs(prev => [...prev.slice(-60), { id: `${Date.now()}-${Math.random()}`, time, text, type }]);
  };

  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [tgLogs]);

  // Advanced Discipline Scoring Config
  const [disciplineConfig, setDisciplineConfig] = useState<DisciplineRatingConfig>({
    early_penalty_enabled: true,
    warning_threshold_pct: 80,
    penalty_multiplier: 1.0,
    early_penalty_rate: 0.05,
  });
  const [isSavingDiscipline, setIsSavingDiscipline] = useState(false);
  const [disciplineFeedback, setDisciplineFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // File input refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const credsInputRef = useRef<HTMLInputElement>(null);

  const loadSettingsData = async () => {
    try {
      const [status, bkps, gdrive, hist, allSettings, limits, types, telegramConf, discConfig, coursesData, screentimeStatus] = await Promise.all([
        api.settings.getDbStatus(),
        api.settings.listBackups(),
        api.settings.getGoogleDriveStatus(),
        api.settings.getSyncHistory(),
        api.settings.getAll(),
        api.screentime.listLimits(),
        fetchCategoryTypes(),
        api.telegram.getConfig(),
        api.screentime.getDisciplineConfig().catch(() => null),
        api.courses.list().catch(() => []),
        api.screentime.getStatus().catch(() => null),
      ]);
      setDbStatus(status);
      setBackups(bkps);
      setGdriveStatus(gdrive);
      setSyncHistory(hist);
      setCategories(limits);
      setCategoryTypes(types);
      if (Array.isArray(coursesData)) {
        setCoursesList(coursesData);
      }
      if (screentimeStatus && typeof screentimeStatus.enabled === 'boolean') {
        setDigitalWellbeingEnabledState(screentimeStatus.enabled);
        setDigitalWellbeingEnabled(screentimeStatus.enabled);
      }
      if (discConfig) {
        setDisciplineConfig(discConfig);
      }
      if (telegramConf) {
        setTgConfig(telegramConf);
        setTgChatIdInput(telegramConf.chat_id || '');
        setTgIsEnabled(telegramConf.is_enabled);
        setTgReminderMinutes(telegramConf.reminder_minutes || 15);
        setTgCheckInterval(telegramConf.check_interval || 60);
        setTgMorningBriefingEnabled(telegramConf.morning_briefing_enabled !== false);
        setTgMorningBriefingTime(telegramConf.morning_briefing_time || '05:00');
        setTgIncludePhilosophy(telegramConf.include_philosophy !== false);
        setTgNotifySchedules(telegramConf.notify_schedules !== false);
        setTgNotifyTasks(telegramConf.notify_tasks !== false);
        if (telegramConf.bot_username) {
          setTgBotUsername(telegramConf.bot_username);
        } else if (telegramConf.has_token) {
          api.telegram.getBotInfo().then((res) => {
            if (res.ok && res.bot?.username) {
              setTgBotUsername(res.bot.username);
            }
          }).catch(() => {});
        }
      }
      if (allSettings.default_difficulty) setDefaultDifficulty(allSettings.default_difficulty);
      if (allSettings.default_priority) setDefaultPriority(allSettings.default_priority);
      if (allSettings.smart_schedule_suggestion !== undefined) {
        setSmartScheduleDefault(allSettings.smart_schedule_suggestion !== 'false');
      }
      if (allSettings.day_start_hour) setDayStartHour(allSettings.day_start_hour);
      if (allSettings.day_end_hour) setDayEndHour(allSettings.day_end_hour);
      if (allSettings.quiet_hours_enabled !== undefined) {
        setQuietHoursEnabled(allSettings.quiet_hours_enabled !== 'false');
      }
      if (allSettings.user_name && allSettings.user_name.trim()) {
        setUserName(allSettings.user_name);
        localStorage.setItem('lifeos_user_name', allSettings.user_name);
      }
    } catch (err) {
      console.error('Failed to load settings:', err);
    }
  };

  useEffect(() => {
    loadSettingsData();

    const handleTypesUpdated = (e: any) => {
      if (e.detail && Array.isArray(e.detail)) {
        setCategoryTypes(e.detail);
      }
    };
    window.addEventListener('lifeos_category_types_updated', handleTypesUpdated);
    return () => {
      window.removeEventListener('lifeos_category_types_updated', handleTypesUpdated);
    };
  }, []);

  // Handlers
  const handleSaveUserName = async () => {
    const trimmed = userName.trim() || 'Hữu Quý';
    setIsSavingName(true);
    try {
      setUserName(trimmed);
      localStorage.setItem('lifeos_user_name', trimmed);
      await api.settings.set('user_name', trimmed);
      alert(`Đã lưu tên hiển thị: ${trimmed}`);
    } catch (err) {
      console.error('Failed to save user name:', err);
      alert('Lỗi khi lưu tên hiển thị');
    } finally {
      setIsSavingName(false);
    }
  };

  const handleSaveTaskDefaults = async () => {
    setIsSavingTaskDefaults(true);
    setTaskDefaultsFeedback(null);
    try {
      await Promise.all([
        api.settings.set('default_priority', defaultPriority),
        api.settings.set('default_difficulty', defaultDifficulty),
        api.settings.set('smart_schedule_suggestion', smartScheduleDefault ? 'true' : 'false'),
        api.settings.set('day_start_hour', dayStartHour),
        api.settings.set('day_end_hour', dayEndHour),
        api.settings.set('quiet_hours_enabled', quietHoursEnabled ? 'true' : 'false'),
      ]);
      setTaskDefaultsFeedback({ type: 'success', text: 'Đã lưu cấu hình mặc định nhiệm vụ & khung giờ thành công!' });
    } catch (err: any) {
      setTaskDefaultsFeedback({ type: 'error', text: err?.message || 'Lỗi khi lưu cấu hình' });
    } finally {
      setIsSavingTaskDefaults(false);
    }
  };

  const handleToggleSound = (val: boolean) => {
    setSoundEnabled(val);
    localStorage.setItem('lifeos_sound_enabled', String(val));
  };

  const handleRequestBrowserNotification = async () => {
    if (typeof Notification === 'undefined') {
      alert('Trình duyệt của bạn không hỗ trợ Web Notification.');
      return;
    }
    const perm = await Notification.requestPermission();
    setBrowserNotificationPermission(perm);
    if (perm === 'granted') {
      new Notification('LifeOS', { body: 'Thông báo trên trình duyệt đã được bật thành công!' });
    }
  };

  const handleSaveDiscipline = async () => {
    setIsSavingDiscipline(true);
    setDisciplineFeedback(null);
    try {
      const res = await api.screentime.saveDisciplineConfig(disciplineConfig);
      setDisciplineConfig(res.config);
      setDisciplineFeedback({ type: 'success', text: 'Đã lưu cấu hình cơ chế tính điểm kỷ luật thành công!' });
      window.dispatchEvent(new CustomEvent('lifeos_screentime_updated'));
    } catch (err: any) {
      setDisciplineFeedback({ type: 'error', text: err?.message || 'Lỗi khi lưu cấu hình tính điểm' });
    } finally {
      setIsSavingDiscipline(false);
    }
  };

  const handleResetDiscipline = async () => {
    const defConfig: DisciplineRatingConfig = {
      early_penalty_enabled: true,
      warning_threshold_pct: 80,
      penalty_multiplier: 1.0,
      early_penalty_rate: 0.05,
    };
    setDisciplineConfig(defConfig);
    setIsSavingDiscipline(true);
    setDisciplineFeedback(null);
    try {
      const res = await api.screentime.saveDisciplineConfig(defConfig);
      setDisciplineConfig(res.config);
      setDisciplineFeedback({ type: 'success', text: 'Đã khôi phục cơ chế tính điểm kỷ luật về chuẩn mặc định!' });
      window.dispatchEvent(new CustomEvent('lifeos_screentime_updated'));
    } catch (err: any) {
      setDisciplineFeedback({ type: 'error', text: err?.message || 'Lỗi khi khôi phục cấu hình' });
    } finally {
      setIsSavingDiscipline(false);
    }
  };

  const handleSaveTelegram = async () => {
    setIsSavingTg(true);
    setTgFeedback(null);
    try {
      const payload: any = {
        chat_id: tgChatIdInput.trim(),
        is_enabled: tgIsEnabled,
        reminder_minutes: Number(tgReminderMinutes),
        check_interval: Number(tgCheckInterval),
        morning_briefing_enabled: tgMorningBriefingEnabled,
        morning_briefing_time: tgMorningBriefingTime,
        include_philosophy: tgIncludePhilosophy,
        notify_schedules: tgNotifySchedules,
        notify_tasks: tgNotifyTasks,
      };
      const cleaned = cleanTelegramToken(tgBotTokenInput);
      if (cleaned) {
        payload.bot_token = cleaned;
      }
      const res = await api.telegram.saveConfig(payload);
      setTgConfig(res.config);
      setTgBotTokenInput('');
      if (res.config?.bot_username) {
        setTgBotUsername(res.config.bot_username);
      }
      setTgFeedback({ type: 'success', text: 'Đã lưu cài đặt Telegram thành công!' });
      addTgLog('✓ Đã lưu cài đặt Telegram vào hệ thống.', 'success');
      window.dispatchEvent(new CustomEvent('lifeos_telegram_updated'));
    } catch (err: any) {
      setTgFeedback({ type: 'error', text: err?.message || 'Lỗi khi lưu cấu hình Telegram' });
      addTgLog(`Lỗi khi lưu cấu hình: ${err?.message || err}`, 'error');
    } finally {
      setIsSavingTg(false);
    }
  };

  const handleVerifyToken = async (tokenToCheck?: string) => {
    const raw = tokenToCheck !== undefined ? tokenToCheck : tgBotTokenInput;
    const token = cleanTelegramToken(raw);
    if (!token && !tgConfig.has_token) {
      addTgLog('Chưa có Bot Token để xác thực.', 'warn');
      return;
    }
    setIsValidatingToken(true);
    addTgLog('🔍 Đang kiểm tra Bot Token với Telegram API...', 'info');
    try {
      const res = await api.telegram.getBotInfo(token || undefined);
      if (res.ok && res.bot) {
        setTgBotUsername(res.bot.username);
        addTgLog(`✓ Xác thực thành công: @${res.bot.username} (${res.bot.first_name})`, 'success');
        addTgLog('👉 Bấm "Listening để Bind ID" rồi gửi tin nhắn cho Bot trên Telegram.', 'info');
      } else {
        addTgLog(`Xác thực thất bại: ${res.error || 'Token không chính xác'}`, 'error');
      }
    } catch (err: any) {
      addTgLog(`Lỗi kết nối tới Telegram: ${err?.message || 'Không thể truy cập API'}`, 'error');
    } finally {
      setIsValidatingToken(false);
    }
  };

  const startListening = async () => {
    if (isListening) return;
    setIsListening(true);
    listeningRef.current = true;
    const tokenToUse = cleanTelegramToken(tgBotTokenInput) || undefined;

    addTgLog('📡 Bắt đầu Listening. Đang quét tin nhắn...', 'info');
    if (tgBotUsername) {
      addTgLog(`👉 Mở Telegram: https://t.me/${tgBotUsername} bấm [Start] hoặc gửi 1 tin nhắn bất kỳ.`, 'info');
    } else {
      addTgLog('👉 Hãy mở Bot trên Telegram và bấm [Start] hoặc gửi tin nhắn bất kỳ.', 'info');
    }

    let attempts = 0;
    const maxAttempts = 30; // 60s total

    const checkLoop = async () => {
      if (!listeningRef.current) return;
      attempts++;

      try {
        const res = await api.telegram.detectChatId(tokenToUse);
        if (res.ok && res.chat_id) {
          listeningRef.current = false;
          setIsListening(false);
          setTgChatIdInput(res.chat_id);
          setDetectedUser({
            chat_id: res.chat_id,
            first_name: res.first_name,
            username: res.username,
          });
          addTgLog(`🟢 Đã nhận tin nhắn từ: ${res.first_name}${res.username ? ` (@${res.username})` : ''} (ID: ${res.chat_id})`, 'success');
          addTgLog('🔗 Đang tự động lưu Chat ID và kích hoạt thông báo...', 'info');

          // Auto-save and activate
          const saveRes = await api.telegram.saveConfig({
            chat_id: res.chat_id,
            is_enabled: true,
            bot_token: tokenToUse,
            reminder_minutes: Number(tgReminderMinutes),
            check_interval: Number(tgCheckInterval),
            morning_briefing_enabled: tgMorningBriefingEnabled,
            morning_briefing_time: tgMorningBriefingTime,
            include_philosophy: tgIncludePhilosophy,
            notify_schedules: tgNotifySchedules,
            notify_tasks: tgNotifyTasks,
          });
          setTgConfig(saveRes.config);
          setTgIsEnabled(true);
          if (saveRes.config?.bot_username) {
            setTgBotUsername(saveRes.config.bot_username);
          }
          addTgLog('✅ Bind Chat ID thành công! Bot Telegram hiện đã được KÍCH HOẠT.', 'success');
          window.dispatchEvent(new CustomEvent('lifeos_telegram_updated'));
          return;
        } else if (attempts % 5 === 0) {
          addTgLog(`⏳ Đang chờ tin nhắn từ bạn... (${attempts}/${maxAttempts})`, 'info');
        }
      } catch (e: any) {
        // Silently wait next attempt
      }

      if (attempts >= maxAttempts) {
        listeningRef.current = false;
        setIsListening(false);
        addTgLog('⏱️ Hết thời gian chờ (60s). Hãy gửi tin nhắn cho Bot rồi bấm Listening để thử lại.', 'warn');
      } else if (listeningRef.current) {
        setTimeout(checkLoop, 2000);
      }
    };

    setTimeout(checkLoop, 1000);
  };

  const stopListening = () => {
    listeningRef.current = false;
    setIsListening(false);
    addTgLog('Đã dừng chế độ Listening.', 'warn');
  };

  const handleClearTelegram = async () => {
    if (!confirm('Bạn có chắc chắn muốn xóa cấu hình Bot Telegram và ngắt kết nối?')) return;
    addTgLog('🗑️ Đang xóa kết nối Telegram...', 'warn');
    try {
      await api.telegram.clearConfig();
      setTgBotTokenInput('');
      setTgChatIdInput('');
      setTgIsEnabled(false);
      setTgBotUsername('');
      setDetectedUser(null);
      setTgConfig({
        has_token: false,
        masked_token: '',
        chat_id: '',
        is_enabled: false,
        reminder_minutes: 15,
        check_interval: 60,
        morning_briefing_enabled: true,
        morning_briefing_time: '05:00',
        include_philosophy: true,
        notify_schedules: true,
        notify_tasks: true,
      });
      addTgLog('Đã xóa cấu hình kết nối Telegram thành công.', 'success');
      window.dispatchEvent(new CustomEvent('lifeos_telegram_updated'));
    } catch (err: any) {
      addTgLog(`Lỗi khi xóa cấu hình: ${err?.message || err}`, 'error');
    }
  };

  const handleDetectChatId = async () => {
    setIsDetectingChatId(true);
    addTgLog('Đang kiểm tra tin nhắn gần nhất tới Bot...', 'info');
    setTgFeedback(null);
    try {
      const tokenToUse = tgBotTokenInput.trim() || undefined;
      const res = await api.telegram.detectChatId(tokenToUse);
      if (res.ok && res.chat_id) {
        setTgChatIdInput(res.chat_id);
        setDetectedUser({
          chat_id: res.chat_id,
          first_name: res.first_name,
          username: res.username,
        });
        addTgLog(`Tìm thấy: ${res.first_name} • Chat ID: ${res.chat_id}`, 'success');
      }
    } catch (err: any) {
      addTgLog(`Chưa thấy tin nhắn: ${err?.message || 'Hãy gửi tin nhắn vào Bot'}`, 'warn');
    } finally {
      setIsDetectingChatId(false);
    }
  };

  const handleTestTelegram = async () => {
    setIsTestingTg(true);
    setTgFeedback(null);
    try {
      const payload: any = {};
      if (tgBotTokenInput.trim()) payload.bot_token = tgBotTokenInput.trim();
      if (tgChatIdInput.trim()) payload.chat_id = tgChatIdInput.trim();
      await api.telegram.test(payload);
      setTgFeedback({ type: 'success', text: 'Đã gửi tin nhắn thử nghiệm thành công! Vui lòng kiểm tra Telegram của bạn.' });
    } catch (err: any) {
      setTgFeedback({ type: 'error', text: err?.message || 'Không thể gửi tin nhắn Telegram. Vui lòng kiểm tra lại Token và Chat ID.' });
    } finally {
      setIsTestingTg(false);
    }
  };

  const handleSendDailyBriefing = async () => {
    setIsBriefingTg(true);
    setTgFeedback(null);
    try {
      await api.telegram.sendDailyBriefing();
      setTgFeedback({ type: 'success', text: 'Đã gửi báo cáo lịch trình hôm nay vào Telegram của bạn!' });
    } catch (err: any) {
      setTgFeedback({ type: 'error', text: err?.message || 'Lỗi khi gửi báo cáo lịch hôm nay' });
    } finally {
      setIsBriefingTg(false);
    }
  };

  const handleCheckUpcoming = async () => {
    setIsCheckingUpcomingTg(true);
    setTgFeedback(null);
    try {
      const res = await api.telegram.checkUpcoming();
      setTgFeedback({
        type: 'success',
        text: res.sent_events?.length > 0
          ? `Đã quét và gửi nhắc nhở cho ${res.sent_events.length} sự kiện: ${res.sent_events.join(', ')}`
          : 'Đã quét lịch trình. Hiện tại không có lịch nào sắp diễn ra trong khoảng thời gian nhắc trước.'
      });
    } catch (err: any) {
      setTgFeedback({ type: 'error', text: err?.message || 'Lỗi khi kiểm tra lịch sắp đến' });
    } finally {
      setIsCheckingUpcomingTg(false);
    }
  };

  const handleSyncGoogleDrive = async () => {
    setIsSyncing(true);
    try {
      const res = await api.settings.syncGoogleDrive();
      if (res.status === 'COMPLETED') {
        alert(res.message || 'Đồng bộ Google Drive hoàn tất!');
      } else {
        alert(`Lỗi đồng bộ: ${res.error || 'Thất bại'}`);
      }
      loadSettingsData();
    } catch (err: any) {
      console.error('Sync error:', err);
      alert(`Lỗi khi kích hoạt đồng bộ: ${err.message || err}`);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleToggleAutoSync = async () => {
    const nextVal = !gdriveStatus?.auto_sync;
    try {
      await api.settings.toggleAutoSync(nextVal);
      loadSettingsData();
    } catch (err) {
      console.error('Toggle auto sync error:', err);
    }
  };

  const handleExportZipBundle = () => {
    window.location.href = api.settings.exportBackupBundleUrl();
  };

  const handleImportZipBundle = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!confirm(`Bạn có chắc muốn khôi phục dữ liệu từ gói sao lưu "${file.name}"?\nHệ thống sẽ tự động tạo một bản sao lưu an toàn trước khi ghi đè.`)) {
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setIsRestoring(true);
    try {
      const res = await api.settings.importBackupBundle(file);
      alert(`Khôi phục thành công! Bản sao lưu dự phòng: ${res.safety_backup}`);
      loadSettingsData();
    } catch (err: any) {
      console.error('Import error:', err);
      alert(`Lỗi khôi phục gói sao lưu: ${err.message || err}`);
    } finally {
      setIsRestoring(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleUploadCredentials = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      await api.settings.uploadCredentials(file);
      alert('Đã tải lên tệp credentials Google Drive thành công!');
      loadSettingsData();
    } catch (err: any) {
      console.error('Upload credentials error:', err);
      alert(`Lỗi tải tệp credentials: ${err.message || err}`);
    } finally {
      if (credsInputRef.current) credsInputRef.current.value = '';
    }
  };

  const handleBackupNow = async () => {
    setIsBackingUp(true);
    try {
      const res = await api.settings.backup();
      alert(`Đã tạo bản sao lưu thành công: ${res.filename}`);
      loadSettingsData();
    } catch (err) {
      console.error('Backup error:', err);
      alert('Lỗi tạo sao lưu');
    } finally {
      setIsBackingUp(false);
    }
  };

  const handleExecuteReset = async () => {
    if (resetConfirmText.trim() !== 'RESET') {
      alert('Vui lòng nhập đúng từ khóa RESET để xác nhận.');
      return;
    }

    setIsResetting(true);
    try {
      const res = await api.settings.resetDatabase('RESET', false);
      alert(`Đã đặt lại dữ liệu về trạng thái trống hoàn toàn!\nBản sao lưu an toàn: ${res.safety_backup}`);
      setIsResetModalOpen(false);
      setResetConfirmText('');
      loadSettingsData();
    } catch (err: any) {
      console.error('Reset error:', err);
      alert(`Lỗi khi đặt lại dữ liệu: ${err.message || err}`);
    } finally {
      setIsResetting(false);
    }
  };

  // Category Modal Handlers
  const handleOpenEditCategory = (cat: ScreenTimeLimit) => {
    setEditingCat(cat);
    setCatLabel(cat.label || cat.category);
    setCatCode(cat.category);
    setCatType(cat.category_type || 'DISTRACTION');
    setCatLimit(String(cat.daily_limit_minutes));
    setCatDesc(cat.description || '');
    setIsCatModalOpen(true);
  };

  const handleOpenNewCategory = () => {
    setEditingCat(null);
    setCatLabel('');
    setCatCode('');
    setCatType('DISTRACTION');
    setCatLimit('60');
    setCatDesc('');
    setIsCatModalOpen(true);
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!catLabel.trim()) {
      alert('Vui lòng nhập tên danh mục');
      return;
    }

    try {
      if (editingCat) {
        await api.screentime.updateLimit(editingCat.id, {
          label: catLabel.trim(),
          category_type: catType,
          daily_limit_minutes: Number(catLimit) || 0,
          description: catDesc.trim() || null,
        });
      } else {
        const finalCode = catCode.trim() ? catCode.trim().toUpperCase().replace(/\s+/g, '_') : catLabel.trim().toUpperCase().replace(/\s+/g, '_');
        await api.screentime.createCategory({
          category: finalCode,
          label: catLabel.trim(),
          category_type: catType,
          daily_limit_minutes: Number(catLimit) || 0,
          description: catDesc.trim() || null,
        });
      }
      setIsCatModalOpen(false);
      loadSettingsData();
    } catch (err: any) {
      console.error('Save category error:', err);
      alert(err.message || 'Lỗi khi lưu danh mục');
    }
  };

  const handleDeleteCategory = async (catId: number) => {
    if (!confirm('Bạn có chắc muốn xóa danh mục này khỏi hệ thống?')) return;
    try {
      await api.screentime.deleteCategory(catId);
      loadSettingsData();
    } catch (err: any) {
      console.error('Delete category error:', err);
      alert(err.message || 'Lỗi khi xóa danh mục');
    }
  };

  // Category Types Handlers
  const handleOpenNewType = () => {
    setEditingType(null);
    setTypeLabel('');
    setTypeId('');
    setTypeColor('#3b82f6');
    setTypeEffect('NEUTRAL');
    setTypeDesc('');
    setIsTypeModalOpen(true);
  };

  const handleOpenEditType = (item: CategoryTypeConfig) => {
    setEditingType(item);
    setTypeLabel(item.label);
    setTypeId(item.id);
    setTypeColor(item.color || '#3b82f6');
    setTypeEffect(item.effect || 'NEUTRAL');
    setTypeDesc(item.description || '');
    setIsTypeModalOpen(true);
  };

  const handleSaveType = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanLabel = typeLabel.trim();
    if (!cleanLabel) {
      alert('Vui lòng nhập tên phân loại');
      return;
    }

    const targetId = editingType
      ? editingType.id
      : (typeId.trim() ? typeId.trim().toUpperCase().replace(/\s+/g, '_') : cleanLabel.toUpperCase().replace(/\s+/g, '_'));

    const updatedConfig: CategoryTypeConfig = {
      id: targetId,
      label: cleanLabel,
      color: typeColor,
      effect: typeEffect,
      description: typeDesc.trim() || undefined,
      is_custom: editingType ? editingType.is_custom : true,
    };

    let nextTypes: CategoryTypeConfig[];
    if (editingType) {
      nextTypes = categoryTypes.map((t) => (t.id === editingType.id ? updatedConfig : t));
    } else {
      if (categoryTypes.some((t) => t.id === targetId)) {
        alert(`Mã phân loại "${targetId}" đã tồn tại! Vui lòng chọn mã khác.`);
        return;
      }
      nextTypes = [...categoryTypes, updatedConfig];
    }

    setCategoryTypes(nextTypes);
    await saveCategoryTypes(nextTypes);
    setIsTypeModalOpen(false);
    setEditingType(null);
  };

  const handleDeleteType = async (typeIdToDelete: string) => {
    if (['PRODUCTIVE', 'DISTRACTION', 'OTHER'].includes(typeIdToDelete)) {
      alert('Không thể xóa 3 nhóm phân loại mặc định của hệ thống.');
      return;
    }
    if (!confirm(`Bạn có chắc chắn muốn xóa phân loại "${typeIdToDelete}"?`)) return;

    const nextTypes = categoryTypes.filter((t) => t.id !== typeIdToDelete);
    setCategoryTypes(nextTypes);
    await saveCategoryTypes(nextTypes);
    loadSettingsData();
  };

  const handleResetTypesToDefault = async () => {
    if (!confirm('Bạn có chắc muốn khôi phục danh sách phân loại về 3 nhóm mặc định ban đầu?')) return;
    setCategoryTypes(DEFAULT_CATEGORY_TYPES);
    await saveCategoryTypes(DEFAULT_CATEGORY_TYPES);
  };

  // Search filter
  const searchMatches = searchQuery.trim()
    ? SEARCH_INDEX.filter((item) => {
        const q = searchQuery.toLowerCase();
        return (
          item.title.toLowerCase().includes(q) ||
          item.keywords.some((k) => k.toLowerCase().includes(q))
        );
      })
    : [];

  const SETTINGS_TABS = [
    {
      id: 'GENERAL' as SettingsTabId,
      label: 'Chung & Cá nhân',
      icon: User,
      desc: 'Hồ sơ, giao diện, quy chuẩn nhiệm vụ',
    },
    {
      id: 'NOTIFICATIONS' as SettingsTabId,
      label: 'Thông báo & Bot',
      icon: Bell,
      badge: tgConfig.is_enabled ? 'ON' : undefined,
      desc: 'Telegram Bot, nhắc nhở lịch, âm thanh',
    },
    {
      id: 'SCREENTIME' as SettingsTabId,
      label: 'Kỷ luật & Màn hình',
      icon: Sliders,
      badge: `${categories.length}`,
      desc: 'Định mức thời gian, nhóm phân loại',
    },
    {
      id: 'MASTERY_RANKS' as SettingsTabId,
      label: 'Danh Hiệu & Cày Cuốc',
      icon: Swords,
      badge: courseGamificationEnabled ? 'BẬT' : undefined,
      desc: '11 Bậc Rank, hào quang động, EXP, cài đặt Topbar',
    },
    {
      id: 'ADVANCED' as SettingsTabId,
      label: 'Tính năng nâng cao',
      icon: Zap,
      badge: 'Mới',
      desc: 'Thuật toán tính điểm kỷ luật, giờ yên tĩnh',
    },
    {
      id: 'BACKUP' as SettingsTabId,
      label: 'Sao lưu & Đồng bộ',
      icon: Cloud,
      badge: gdriveStatus?.connected ? 'Drive' : undefined,
      desc: 'Google Drive, sao lưu ZIP, cơ sở dữ liệu',
    },
    {
      id: 'DANGER' as SettingsTabId,
      label: 'Vùng nguy hiểm',
      icon: AlertTriangle,
      desc: 'Đặt lại sạch về dữ liệu trống',
    },
  ];

  return (
    <div className="space-y-6 max-w-5xl pb-16">
      {/* 1. Page Header & Quick Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2.5">
            <SettingsIcon className="w-5 h-5 text-neutral-900 dark:text-neutral-100" />
            <span>Cài đặt hệ thống</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Không gian tùy biến cá nhân hóa, bot thông báo, kỷ luật màn hình và bảo toàn dữ liệu.
          </p>
        </div>

        {/* Search Bar */}
        <div className="relative w-full sm:w-80 shrink-0">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm nhanh cài đặt (VD: telegram, kỷ luật...)"
            className="pl-9 pr-8 h-9 text-xs"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* 2. Quick Search Results Dropdown / Pill list */}
      {searchQuery.trim() && (
        <div className="p-3.5 rounded-xl border border-blue-200 dark:border-blue-900/60 bg-blue-50/40 dark:bg-blue-950/20 space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-blue-900 dark:text-blue-200">
            <span>Tìm thấy {searchMatches.length} mục cài đặt phù hợp với "{searchQuery}":</span>
            <button
              onClick={() => setSearchQuery('')}
              className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline"
            >
              Đóng tìm kiếm
            </button>
          </div>

          {searchMatches.length === 0 ? (
            <p className="text-xs text-slate-500 italic">Không tìm thấy cài đặt nào phù hợp với từ khóa này.</p>
          ) : (
            <div className="flex flex-wrap gap-2 pt-1">
              {searchMatches.map((m) => (
                <button
                  key={m.id}
                  onClick={() => {
                    setActiveTab(m.tab);
                    setSearchQuery('');
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 hover:border-blue-500 hover:text-blue-600 dark:hover:text-blue-400 shadow-xs transition cursor-pointer"
                >
                  <ArrowUpRight className="w-3.5 h-3.5 text-blue-500" />
                  <span className="font-semibold">{m.title}</span>
                  <span className="text-[10px] text-slate-400 font-mono">({m.tabName})</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 3. Main Two-Column Layout (Sidebar Navigation + Tab Content) */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
        {/* Left Sidebar Navigation */}
        <div className="md:col-span-4 lg:col-span-3.5 space-y-1.5 bg-slate-50/70 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded-xl p-2 shadow-xs md:sticky md:top-20">
          <div className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            Danh mục cài đặt
          </div>

          {SETTINGS_TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  setSearchQuery('');
                }}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs transition cursor-pointer text-left ${
                  isActive
                    ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 font-bold shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-slate-100 font-medium'
                }`}
              >
                <div className="flex items-center gap-2.5 truncate">
                  <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white dark:text-neutral-900' : 'text-slate-500 dark:text-slate-400'}`} />
                  <span className="truncate">{tab.label}</span>
                </div>
                {tab.badge && (
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold shrink-0 ${
                      isActive
                        ? 'bg-white/20 text-white dark:bg-neutral-900/20 dark:text-neutral-900'
                        : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Right Content Area */}
        <div className="md:col-span-8 lg:col-span-8.5 space-y-6">
          {/* ================= TAB 1: GENERAL (CHUNG) ================= */}
          {activeTab === 'GENERAL' && (
            <div className="space-y-5 animate-in fade-in-50 duration-200">
              {/* 1.1 User Profile */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4 shadow-xs">
                <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800 text-sm font-bold text-slate-800 dark:text-slate-200">
                  <User className="w-4 h-4 text-neutral-900 dark:text-neutral-100" />
                  <span>Hồ sơ người dùng</span>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <div>
                    <span className="font-semibold text-slate-800 dark:text-slate-200 block">Tên hiển thị</span>
                    <span className="text-slate-500 dark:text-slate-400">
                      Tên được dùng trong câu chào "Xin chào, [name]" trên thanh lịch trình và tổng kết.
                    </span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Input
                      value={userName}
                      onChange={(e) => setUserName(e.target.value)}
                      placeholder="Nhập tên của bạn..."
                      className="w-44 sm:w-52 text-xs"
                    />
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={handleSaveUserName}
                      disabled={isSavingName}
                    >
                      {isSavingName ? 'Đang lưu...' : 'Lưu tên'}
                    </Button>
                  </div>
                </div>
              </div>

              {/* 1.2 Appearance Theme */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4 shadow-xs">
                <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800 text-sm font-bold text-slate-800 dark:text-slate-200">
                  <Palette className="w-4 h-4 text-neutral-900 dark:text-neutral-100" />
                  <span>Giao diện hiển thị</span>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <div>
                    <span className="font-semibold text-slate-800 dark:text-slate-200 block">Chế độ màu</span>
                    <span className="text-slate-500 dark:text-slate-400">
                      Chuyển đổi giữa giao diện Tối và Sáng.
                    </span>
                  </div>

                  <Button variant="outline" onClick={onToggleTheme} className="gap-2">
                    {isDark ? <Sun className="w-4 h-4 text-amber-500" /> : <Moon className="w-4 h-4 text-indigo-500" />}
                    <span>{isDark ? 'Chế độ Tối' : 'Chế độ Sáng'}</span>
                  </Button>
                </div>
              </div>

              {/* 1.3 Default Task Presets (NEW FEATURE) */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4 shadow-xs">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-2 text-sm font-bold text-slate-800 dark:text-slate-200">
                    <Star className="w-4 h-4 text-neutral-900 dark:text-neutral-100" />
                    <span>Quy chuẩn nhiệm vụ mặc định</span>
                  </div>
                  <Badge variant="secondary" className="text-[10px]">Tự động áp dụng</Badge>
                </div>

                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Thiết lập giá trị mặc định được tự động điền sẵn mỗi khi bạn mở popup tạo nhiệm vụ mới.
                </p>

                {taskDefaultsFeedback && (
                  <div
                    className={`p-2.5 rounded-lg text-xs flex items-center gap-2 ${
                      taskDefaultsFeedback.type === 'success'
                        ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                        : 'bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                    }`}
                  >
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>{taskDefaultsFeedback.text}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs pt-1">
                  {/* Default Priority */}
                  <div className="space-y-1.5">
                    <label className="font-semibold text-slate-700 dark:text-slate-300 block">
                      Mức ưu tiên mặc định:
                    </label>
                    <select
                      value={defaultPriority}
                      onChange={(e) => setDefaultPriority(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-slate-900 dark:text-slate-100 text-xs"
                    >
                      <option value="LOW">Thấp</option>
                      <option value="MEDIUM">Trung bình</option>
                      <option value="HIGH">Ưu tiên cao</option>
                      <option value="URGENT">Khẩn cấp</option>
                    </select>
                  </div>

                  {/* Default Difficulty */}
                  <div className="space-y-1.5">
                    <label className="font-semibold text-slate-700 dark:text-slate-300 block">
                      Độ khó / Điểm kỷ luật mặc định:
                    </label>
                    <select
                      value={defaultDifficulty}
                      onChange={(e) => setDefaultDifficulty(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-slate-900 dark:text-slate-100 text-xs"
                    >
                      <option value="1">1 sao - Dễ / Nhanh chóng (15-30p)</option>
                      <option value="2">2 sao - Tiêu chuẩn (30-60p)</option>
                      <option value="3">3 sao - Trung bình (1-2 giờ)</option>
                      <option value="4">4 sao - Nặng / Thách thức (2-4 giờ)</option>
                      <option value="5">5 sao - Dự án lớn / Cực khó (4+ giờ)</option>
                    </select>
                  </div>

                  {/* Smart Schedule Toggle */}
                  <div className="sm:col-span-2 flex items-center justify-between p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-800/20">
                    <div>
                      <span className="font-semibold text-slate-800 dark:text-slate-200 block">
                        Tự động gợi ý khung giờ thông minh
                      </span>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400">
                        Hiển thị ngay các khung giờ rảnh trong ngày để bạn bấm chọn 1 chạm khi tạo task.
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSmartScheduleDefault(!smartScheduleDefault)}
                      className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors duration-200 cursor-pointer ${
                        smartScheduleDefault ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'
                      }`}
                    >
                      <div
                        className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ${
                          smartScheduleDefault ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handleSaveTaskDefaults}
                    disabled={isSavingTaskDefaults}
                  >
                    {isSavingTaskDefaults ? 'Đang lưu...' : 'Lưu quy chuẩn mặc định'}
                  </Button>
                </div>
              </div>

              {/* 1.4 Work & Study Hours (NEW FEATURE) */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4 shadow-xs">
                <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800 text-sm font-bold text-slate-800 dark:text-slate-200">
                  <Clock className="w-4 h-4 text-neutral-900 dark:text-neutral-100" />
                  <span>Khung giờ sinh hoạt & Học tập</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div>
                    <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                      Giờ bắt đầu ngày mới:
                    </label>
                    <Input
                      type="time"
                      value={dayStartHour}
                      onChange={(e) => setDayStartHour(e.target.value)}
                      className="text-xs"
                    />
                    <span className="text-[11px] text-slate-400 mt-1 block">Khung giờ mở đầu lịch trình trên dòng thời gian.</span>
                  </div>

                  <div>
                    <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                      Giờ kết thúc ngày / Giờ nghỉ ngơi:
                    </label>
                    <Input
                      type="time"
                      value={dayEndHour}
                      onChange={(e) => setDayEndHour(e.target.value)}
                      className="text-xs"
                    />
                    <span className="text-[11px] text-slate-400 mt-1 block">Khung giờ dừng lịch làm việc và bắt đầu nghỉ ngơi.</span>
                  </div>
                </div>
              </div>

              {/* 1.5 Mental Health & Cognitive Load Toggle */}
              <div id="mental-health" className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4 shadow-xs">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-2 text-sm font-bold text-slate-800 dark:text-slate-200">
                    <HeartPulse className="w-4 h-4 text-rose-500" />
                    <span>Quản lý Sức khỏe Tinh thần & Mức độ Căng thẳng</span>
                  </div>
                  <Badge
                    variant={mentalHealthEnabled ? 'success' : 'secondary'}
                    className={`text-[10px] ${!mentalHealthEnabled ? 'border-dashed border-slate-300 dark:border-slate-700 text-slate-500' : ''}`}
                  >
                    {mentalHealthEnabled ? 'ĐANG BẬT' : 'ĐANG TẮT'}
                  </Badge>
                </div>

                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Theo dõi áp lực học tập, nguy cơ kiệt sức (burnout), điều hòa nhịp sinh học và tự động phân luồng bài học cân bằng.
                </p>

                <div className="flex items-center justify-between p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
                  <div className="pr-4">
                    <span className="font-semibold text-slate-800 dark:text-slate-200 block text-xs">
                      Bật tính năng Quản lý Sức khỏe Tinh thần
                    </span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      Khi tắt, chỉ số Áp lực & Sức khỏe tinh thần trên thanh Topbar và trong Báo cáo tuần sẽ hiển thị màu xám với viền nét đứt thể hiện trạng thái tạm dừng theo dõi.
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleToggleMentalHealth}
                    className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors duration-200 cursor-pointer shrink-0 ${
                      mentalHealthEnabled ? 'bg-rose-500' : 'bg-slate-300 dark:bg-slate-700'
                    }`}
                  >
                    <div
                      className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ${
                        mentalHealthEnabled ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {!mentalHealthEnabled && (
                  <div className="p-3 rounded-lg border border-dashed border-slate-300 dark:border-slate-700 bg-slate-100/60 dark:bg-slate-800/40 text-slate-500 dark:text-slate-400 text-xs flex items-center gap-2">
                    <HeartPulse className="w-4 h-4 shrink-0 text-slate-400" />
                    <span>
                      Đang ở chế độ tắt: Topbar và Báo cáo tuần sẽ thể hiện viền nét đứt màu xám. Bạn có thể bật lại bất cứ lúc nào.
                    </span>
                  </div>
                )}
              </div>

              {/* 1.7 Digital Wellbeing & Screentime Consistency Toggle */}
              <div id="digital-wellbeing" className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4 shadow-xs">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-2 text-sm font-bold text-slate-800 dark:text-slate-200">
                    <Smartphone className="w-4 h-4 text-emerald-500" />
                    <span>Quản lý Kỷ luật & Cân bằng Kỹ thuật số</span>
                  </div>
                  <Badge
                    variant={digitalWellbeingEnabled ? 'success' : 'secondary'}
                    className={`text-[10px] ${!digitalWellbeingEnabled ? 'border-dashed border-slate-300 dark:border-slate-700 text-slate-500' : ''}`}
                  >
                    {digitalWellbeingEnabled ? 'ĐANG BẬT' : 'ĐANG TẮT'}
                  </Badge>
                </div>

                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Giám sát thời gian sử dụng thiết bị, định mức ứng dụng và tính toán Chỉ số Nhất quán & Kỷ luật.
                </p>

                <div className="flex items-center justify-between p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
                  <div className="pr-4">
                    <span className="font-semibold text-slate-800 dark:text-slate-200 block text-xs">
                      Bật tính năng Cân bằng Kỹ thuật số & Kỷ luật
                    </span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      Khi tắt, chỉ số Nhất quán trên thanh Topbar và thẻ Cân bằng số trong Báo cáo tuần sẽ hiển thị màu xám với viền nét đứt.
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleToggleDigitalWellbeing}
                    className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors duration-200 cursor-pointer shrink-0 ${
                      digitalWellbeingEnabled ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'
                    }`}
                  >
                    <div
                      className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ${
                        digitalWellbeingEnabled ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ================= TAB 2: NOTIFICATIONS & TELEGRAM ================= */}
          {activeTab === 'NOTIFICATIONS' && (
            <div className="space-y-5 animate-in fade-in-50 duration-200">
              {/* Telegram Bot Card */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4 shadow-xs relative overflow-hidden">
                {/* Header & Master Toggle */}
                <div className="flex flex-wrap items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white shadow-xs">
                      <Send className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-slate-800 dark:text-slate-200">
                          Bot Telegram & Thông Báo
                        </span>
                        {tgBotUsername && (
                          <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
                            @{tgBotUsername}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Nhắc lịch học, ca trực, nhiệm vụ và báo cáo sáng trên điện thoại
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5">
                    <Badge variant={tgConfig.is_enabled ? 'success' : 'outline'} className="text-[10px] py-0.5">
                      {tgConfig.is_enabled ? 'Đang bật' : 'Đang tắt'}
                    </Badge>

                    <button
                      type="button"
                      onClick={() => setTgIsEnabled(!tgIsEnabled)}
                      className={`w-9 h-5 flex items-center rounded-full p-0.5 transition-colors cursor-pointer ${
                        tgIsEnabled ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-700'
                      }`}
                      title={tgIsEnabled ? 'Nhấn để tắt' : 'Nhấn để bật'}
                    >
                      <div
                        className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                          tgIsEnabled ? 'translate-x-4' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                </div>

                {/* Token & Chat ID Inputs */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  {/* Bot Token */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="font-medium text-slate-700 dark:text-slate-300">
                        Bot Token:
                      </label>
                      {tgConfig.has_token && (
                        <span className="text-[10px] text-emerald-600 dark:text-emerald-400">
                          ✓ Đã lưu ({tgConfig.masked_token})
                        </span>
                      )}
                    </div>
                    <div className="flex gap-1.5">
                      <div className="relative flex-1">
                        <Input
                          type={showTgToken ? 'text' : 'password'}
                          value={tgBotTokenInput}
                          onChange={(e) => {
                            const raw = e.target.value;
                            const cleaned = cleanTelegramToken(raw);
                            setTgBotTokenInput(cleaned);
                            if (cleaned.includes(':') && cleaned.length >= 35) {
                              handleVerifyToken(cleaned);
                            }
                          }}
                          onPaste={(e) => {
                            const pasted = e.clipboardData.getData('text');
                            const cleaned = cleanTelegramToken(pasted);
                            if (cleaned && cleaned.includes(':') && cleaned.length >= 35) {
                              e.preventDefault();
                              setTgBotTokenInput(cleaned);
                              handleVerifyToken(cleaned);
                            }
                          }}
                          placeholder={tgConfig.has_token ? 'Nhập token mới nếu đổi...' : '8876142819:AAH...'}
                          className="text-xs pr-8 font-mono"
                        />
                        <button
                          type="button"
                          onClick={() => setShowTgToken(!showTgToken)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                        >
                          {showTgToken ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleVerifyToken()}
                        disabled={isValidatingToken}
                        className="text-xs shrink-0 px-2.5"
                        title="Kiểm tra token với Telegram API"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isValidatingToken ? 'animate-spin text-blue-600' : ''}`} />
                        <span className="ml-1 hidden sm:inline">Kiểm tra</span>
                      </Button>
                    </div>
                  </div>

                  {/* Chat ID */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="font-medium text-slate-700 dark:text-slate-300">
                        Chat ID:
                      </label>
                      {detectedUser && (
                        <span className="text-[10px] text-emerald-600 dark:text-emerald-400">
                          ✓ {detectedUser.first_name}
                        </span>
                      )}
                    </div>
                    <Input
                      type="text"
                      value={tgChatIdInput}
                      onChange={(e) => setTgChatIdInput(e.target.value)}
                      placeholder="Bấm Listening để bind tự động..."
                      className="text-xs font-mono"
                    />
                  </div>
                </div>

                {/* Connection Controls: Listening, Open Bot, Delete */}
                <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Listening button */}
                    <Button
                      type="button"
                      variant={isListening ? 'outline' : 'primary'}
                      size="sm"
                      onClick={isListening ? stopListening : startListening}
                      className={`text-xs font-semibold ${
                        isListening
                          ? 'border-amber-500 text-amber-600 dark:text-amber-400 bg-amber-50/50 dark:bg-amber-950/30'
                          : 'bg-blue-600 hover:bg-blue-700 text-white'
                      }`}
                    >
                      <Radio className={`w-3.5 h-3.5 mr-1.5 ${isListening ? 'animate-pulse text-amber-500' : ''}`} />
                      <span>{isListening ? 'Đang Listening... (Dừng)' : 'Listening để Bind ID'}</span>
                    </Button>

                    {/* Open Bot */}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const botUrl = tgBotUsername ? `https://t.me/${tgBotUsername}?start=lifeos` : 'https://t.me/BotFather';
                        window.open(botUrl, '_blank');
                      }}
                      className="text-xs"
                    >
                      <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                      <span>{tgBotUsername ? `Mở @${tgBotUsername}` : 'Mở Bot Telegram'}</span>
                    </Button>
                  </div>

                  {/* Clear / Delete button */}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleClearTelegram}
                    className="text-xs text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                    title="Xóa token và ngắt kết nối bot"
                  >
                    <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                    <span>Xóa kết nối</span>
                  </Button>
                </div>

                {/* Console Log (Terminal) */}
                <div className="rounded-lg bg-slate-950 border border-slate-800 p-3 font-mono text-xs shadow-inner">
                  <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-slate-800 text-[11px] text-slate-400">
                    <div className="flex items-center gap-1.5">
                      <Terminal className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-slate-300 font-semibold">Console Log</span>
                      {isListening && (
                        <span className="flex items-center gap-1 text-amber-400 text-[10px] ml-2 font-sans">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
                          Đang nghe tin nhắn...
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => setTgLogs([{ id: Date.now().toString(), time: new Date().toLocaleTimeString(), text: 'Đã dọn log.', type: 'info' }])}
                      className="text-[10px] text-slate-500 hover:text-slate-300"
                    >
                      Xóa log
                    </button>
                  </div>
                  <div className="h-24 overflow-y-auto space-y-1 pr-1" ref={logContainerRef}>
                    {tgLogs.map((log) => (
                      <div key={log.id} className="leading-relaxed flex items-start gap-1.5 text-[11px]">
                        <span className="text-slate-500 shrink-0 select-none">[{log.time}]</span>
                        <span
                          className={
                            log.type === 'success' ? 'text-emerald-400 font-medium' :
                            log.type === 'error' ? 'text-rose-400 font-medium' :
                            log.type === 'warn' ? 'text-amber-400' :
                            'text-slate-300'
                          }
                        >
                          {log.text}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Minimal Settings Grid */}
                <div className="space-y-2.5 pt-1">
                  {/* Báo cáo sáng 5h */}
                  <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                    <div className="flex items-center gap-2.5">
                      <Clock className="w-4 h-4 text-amber-500 shrink-0" />
                      <div>
                        <span className="font-semibold text-slate-800 dark:text-slate-200 text-xs block">
                          Báo cáo lịch sáng
                        </span>
                        <span className="text-[11px] text-slate-500 dark:text-slate-400">
                          Gửi thời khóa biểu và việc cần làm hôm nay
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5">
                      <input
                        type="time"
                        value={tgMorningBriefingTime}
                        onChange={(e) => setTgMorningBriefingTime(e.target.value)}
                        className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-0.5 text-xs font-mono font-semibold text-slate-800 dark:text-slate-200"
                      />
                      <button
                        type="button"
                        onClick={() => setTgMorningBriefingEnabled(!tgMorningBriefingEnabled)}
                        className={`w-9 h-5 flex items-center rounded-full p-0.5 transition-colors cursor-pointer ${
                          tgMorningBriefingEnabled ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-700'
                        }`}
                      >
                        <div
                          className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                            tgMorningBriefingEnabled ? 'translate-x-4' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>
                  </div>

                  {/* Trích dẫn triết lý - Tối giản */}
                  <div className="flex items-center justify-between p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                    <div className="flex items-center gap-2.5">
                      <BookOpen className="w-4 h-4 text-purple-500 shrink-0" />
                      <div>
                        <span className="font-semibold text-slate-800 dark:text-slate-200 text-xs block">
                          Trích dẫn triết lý
                        </span>
                        <span className="text-[11px] text-slate-500 dark:text-slate-400">
                          Kèm 1 câu danh ngôn ngắn trong thông báo
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setTgIncludePhilosophy(!tgIncludePhilosophy)}
                      className={`w-9 h-5 flex items-center rounded-full p-0.5 transition-colors cursor-pointer ${
                        tgIncludePhilosophy ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-700'
                      }`}
                    >
                      <div
                        className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                          tgIncludePhilosophy ? 'translate-x-4' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  {/* Phạm vi thông báo & Interval */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs pt-1">
                    {/* Event types */}
                    <div className="space-y-2 p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-800/20">
                      <span className="font-semibold text-slate-700 dark:text-slate-300 block text-[11px]">
                        Sự kiện thông báo:
                      </span>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-600 dark:text-slate-400">Lịch cố định & Thời khóa biểu</span>
                        <button
                          type="button"
                          onClick={() => setTgNotifySchedules(!tgNotifySchedules)}
                          className={`w-8 h-4 flex items-center rounded-full p-0.5 transition-colors cursor-pointer ${
                            tgNotifySchedules ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-700'
                          }`}
                        >
                          <div className={`bg-white w-3 h-3 rounded-full shadow-md transform transition-transform ${tgNotifySchedules ? 'translate-x-4' : 'translate-x-0'}`} />
                        </button>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-600 dark:text-slate-400">Nhiệm vụ đến giờ & Hạn chót</span>
                        <button
                          type="button"
                          onClick={() => setTgNotifyTasks(!tgNotifyTasks)}
                          className={`w-8 h-4 flex items-center rounded-full p-0.5 transition-colors cursor-pointer ${
                            tgNotifyTasks ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-700'
                          }`}
                        >
                          <div className={`bg-white w-3 h-3 rounded-full shadow-md transform transition-transform ${tgNotifyTasks ? 'translate-x-4' : 'translate-x-0'}`} />
                        </button>
                      </div>
                    </div>

                    {/* Timing & Interval */}
                    <div className="space-y-2 p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-800/20">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-slate-700 dark:text-slate-300 font-medium text-[11px]">Nhắc trước:</span>
                        <select
                          value={tgReminderMinutes}
                          onChange={(e) => setTgReminderMinutes(Number(e.target.value))}
                          className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-0.5 text-xs text-slate-800 dark:text-slate-200"
                        >
                          <option value={5}>5 phút</option>
                          <option value={10}>10 phút</option>
                          <option value={15}>15 phút</option>
                          <option value={30}>30 phút</option>
                          <option value={60}>60 phút</option>
                        </select>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-slate-700 dark:text-slate-300 font-medium text-[11px]">Chu kỳ quét:</span>
                        <select
                          value={tgCheckInterval}
                          onChange={(e) => setTgCheckInterval(Number(e.target.value))}
                          className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-0.5 text-xs text-slate-800 dark:text-slate-200"
                        >
                          <option value={30}>30 giây</option>
                          <option value={60}>60 giây</option>
                          <option value={120}>2 phút</option>
                          <option value={300}>5 phút</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleTestTelegram}
                      disabled={isTestingTg}
                      className="text-xs"
                    >
                      <Send className={`w-3.5 h-3.5 mr-1.5 ${isTestingTg ? 'animate-bounce' : ''}`} />
                      <span>{isTestingTg ? 'Đang gửi...' : 'Gửi tin test'}</span>
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleSendDailyBriefing}
                      disabled={isBriefingTg}
                      className="text-xs"
                    >
                      <Sparkles className={`w-3.5 h-3.5 mr-1.5 text-amber-500 ${isBriefingTg ? 'animate-spin' : ''}`} />
                      <span>{isBriefingTg ? 'Đang gửi...' : 'Gửi thử báo cáo sáng'}</span>
                    </Button>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleCheckUpcoming}
                      disabled={isCheckingUpcomingTg}
                      className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 mr-1 ${isCheckingUpcomingTg ? 'animate-spin' : ''}`} />
                      <span>Quét lịch ngay</span>
                    </Button>
                  </div>

                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handleSaveTelegram}
                    disabled={isSavingTg}
                    className="text-xs font-semibold px-4 bg-blue-600 hover:bg-blue-700 text-white shadow-xs"
                  >
                    <Check className={`w-3.5 h-3.5 mr-1.5 ${isSavingTg ? 'animate-spin' : ''}`} />
                    <span>{isSavingTg ? 'Đang lưu...' : 'Lưu cài đặt'}</span>
                  </Button>
                </div>
              </div>

              {/* Sound & In-App Notification Card (NEW FEATURE) */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4 shadow-xs">
                <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800 text-sm font-bold text-slate-800 dark:text-slate-200">
                  <Bell className="w-4 h-4 text-neutral-900 dark:text-neutral-100" />
                  <span>Âm thanh & Thông báo trên Trình duyệt</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  {/* Sound alert */}
                  <div className="flex items-center justify-between p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-800/20">
                    <div className="flex items-center gap-3">
                      {soundEnabled ? (
                        <Volume2 className="w-5 h-5 text-emerald-600 shrink-0" />
                      ) : (
                        <VolumeX className="w-5 h-5 text-slate-400 shrink-0" />
                      )}
                      <div>
                        <span className="font-semibold text-slate-800 dark:text-slate-200 block">
                          Âm thanh thông báo
                        </span>
                        <span className="text-[11px] text-slate-500 dark:text-slate-400">
                          Phát âm thanh nhẹ khi có lịch đến hoặc hoàn thành nhiệm vụ.
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleToggleSound(!soundEnabled)}
                      className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors duration-200 cursor-pointer ${
                        soundEnabled ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'
                      }`}
                    >
                      <div
                        className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ${
                          soundEnabled ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  {/* Browser Push */}
                  <div className="flex items-center justify-between p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-800/20">
                    <div>
                      <span className="font-semibold text-slate-800 dark:text-slate-200 block">
                        Thông báo đẩy trình duyệt
                      </span>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 block mb-2">
                        Trạng thái quyền: <strong>{browserNotificationPermission}</strong>
                      </span>
                      {browserNotificationPermission !== 'granted' ? (
                        <Button variant="outline" size="sm" onClick={handleRequestBrowserNotification}>
                          Yêu cầu cấp quyền
                        </Button>
                      ) : (
                        <Badge variant="success" className="text-[10px]">Đã cấp quyền</Badge>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ================= TAB 3: SCREENTIME & DISCIPLINE ================= */}
          {activeTab === 'SCREENTIME' && (
            <div className="space-y-5 animate-in fade-in-50 duration-200">
              {/* Category Sub-Tabs */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4 shadow-xs">
                <div className="flex flex-wrap items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 gap-2">
                  <div className="flex items-center gap-2 text-sm font-bold text-slate-800 dark:text-slate-200">
                    <Sliders className="w-4 h-4 text-neutral-900 dark:text-neutral-100" />
                    <span>Quản lý Định mức thời gian & Nhóm phân loại</span>
                  </div>

                  <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
                    <button
                      onClick={() => setCatActiveTab('CATEGORIES')}
                      className={`px-3 py-1 rounded-md text-xs font-semibold transition cursor-pointer ${
                        catActiveTab === 'CATEGORIES'
                          ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-xs'
                          : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                      }`}
                    >
                      Danh mục định mức ({categories.length})
                    </button>
                    <button
                      onClick={() => setCatActiveTab('TYPES')}
                      className={`px-3 py-1 rounded-md text-xs font-semibold transition cursor-pointer ${
                        catActiveTab === 'TYPES'
                          ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-xs'
                          : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                      }`}
                    >
                      Nhóm phân loại ({categoryTypes.length})
                    </button>
                  </div>
                </div>

                {/* Sub-tab 1: Categories list */}
                {catActiveTab === 'CATEGORIES' ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Đặt giới hạn thời gian (phút/ngày) cho từng ứng dụng và hoạt động để duy trì kỷ luật.
                      </p>
                      <Button variant="outline" size="sm" onClick={handleOpenNewCategory}>
                        <Plus className="w-3.5 h-3.5 mr-1" />
                        <span>Thêm danh mục mới</span>
                      </Button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {categories.map((cat) => {
                        const typeConfig = getCategoryTypeConfig(cat.category_type || 'DISTRACTION', categoryTypes);
                        return (
                          <div
                            key={cat.id}
                            className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex flex-col justify-between space-y-2.5"
                          >
                            <div className="flex items-start justify-between">
                              <div>
                                <div className="flex items-center gap-2">
                                  <span
                                    className="w-2.5 h-2.5 rounded-full shrink-0"
                                    style={{ backgroundColor: typeConfig.color }}
                                  />
                                  <span className="font-bold text-xs text-slate-900 dark:text-slate-100">
                                    {cat.label || cat.category}
                                  </span>
                                </div>
                                <span className="text-[10px] text-slate-400 font-mono block mt-0.5">
                                  Mã: {cat.category} • {typeConfig.label}
                                </span>
                              </div>

                              <Badge variant="outline" className="text-xs font-mono font-bold">
                                {cat.daily_limit_minutes} phút/ngày
                              </Badge>
                            </div>

                            {cat.description && (
                              <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2">
                                {cat.description}
                              </p>
                            )}

                            <div className="flex items-center justify-end gap-1 pt-2 border-t border-slate-200/60 dark:border-slate-800/60">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleOpenEditCategory(cat)}
                                className="h-7 text-xs"
                              >
                                <Edit3 className="w-3 h-3 mr-1" />
                                <span>Sửa</span>
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDeleteCategory(cat.id)}
                                className="h-7 w-7 text-slate-400 hover:text-rose-500"
                                title="Xóa danh mục"
                              >
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  /* Sub-tab 2: Category Types list */
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Quản lý màu sắc và hiệu ứng tính điểm kỷ luật (Thưởng, Trừ điểm, hoặc Trung tính).
                      </p>
                      <div className="flex items-center gap-2">
                        <Button variant="ghost" size="sm" onClick={handleResetTypesToDefault} className="text-xs text-slate-500">
                          <RotateCcw className="w-3 h-3 mr-1" />
                          <span>Mặc định</span>
                        </Button>
                        <Button variant="outline" size="sm" onClick={handleOpenNewType}>
                          <Plus className="w-3.5 h-3.5 mr-1" />
                          <span>Thêm phân loại</span>
                        </Button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {categoryTypes.map((t) => {
                        const isDefault = DEFAULT_CATEGORY_TYPES.some((d) => d.id === t.id);
                        return (
                          <div
                            key={t.id}
                            className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex flex-col justify-between space-y-2.5"
                          >
                            <div>
                              <div className="flex items-center justify-between mb-1">
                                <div className="flex items-center gap-2">
                                  <span
                                    className="w-3 h-3 rounded-full shrink-0 shadow-xs"
                                    style={{ backgroundColor: t.color || '#3b82f6' }}
                                  />
                                  <span className="font-bold text-xs text-slate-900 dark:text-slate-100">
                                    {t.label}
                                  </span>
                                </div>
                                <Badge
                                  variant={t.effect === 'BONUS' ? 'success' : t.effect === 'PENALTY' ? 'warning' : 'secondary'}
                                  className="text-[10px] py-0 px-1.5"
                                >
                                  {t.effect === 'BONUS' ? '+ Thưởng' : t.effect === 'PENALTY' ? '- Phạt nếu vượt' : 'Trung tính'}
                                </Badge>
                              </div>
                              <span className="text-[10px] text-slate-400 font-mono">Mã: {t.id}</span>
                              {t.description && (
                                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1.5 line-clamp-2">
                                  {t.description}
                                </p>
                              )}
                            </div>

                            <div className="flex items-center justify-end gap-1 pt-2 border-t border-slate-200/60 dark:border-slate-800/60">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleOpenEditType(t)}
                                className="h-7 text-xs"
                              >
                                <Edit3 className="w-3 h-3 mr-1" />
                                <span>Sửa</span>
                              </Button>
                              {!isDefault && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleDeleteType(t.id)}
                                  className="h-7 w-7 text-slate-400 hover:text-rose-500"
                                  title="Xóa phân loại"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ================= TAB 4: MASTERY RANKS & GAMIFICATION (DANH HIỆU & CÀY CUỐC) ================= */}
          {activeTab === 'MASTERY_RANKS' && (() => {
            const topStats = getTopCourseMastery(coursesList);
            return (
              <div className="space-y-5 animate-in fade-in-50 duration-200">
                {/* 1. Hero Header & Master Toggle Card */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4 shadow-xs relative overflow-hidden">
                  <div className="flex flex-wrap items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 via-orange-500 to-rose-600 flex items-center justify-center text-white shadow-md shadow-amber-500/25">
                        <Swords className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-slate-800 dark:text-slate-200">
                            Hệ Thống Danh Hiệu & Cấp Bậc Rèn Luyện
                          </span>
                          <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-semibold bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                            <Sparkles className="w-2.5 h-2.5" />
                            11 Bậc Rank
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          Tích lũy điểm EXP sau mỗi bài học hoàn thành, tiến hóa cấp bậc danh hiệu và hào quang động.
                        </p>
                      </div>
                    </div>

                    <Badge
                      variant={courseGamificationEnabled ? 'success' : 'secondary'}
                      className="text-[10px] py-0.5 px-2.5 font-bold uppercase tracking-wider"
                    >
                      {courseGamificationEnabled ? 'ĐANG BẬT' : 'ĐANG TẮT'}
                    </Badge>
                  </div>

                  {/* Main Toggle Switch */}
                  <div className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/30">
                    <div className="pr-4">
                      <span className="font-semibold text-slate-800 dark:text-slate-200 block text-xs">
                        Bật chế độ Cày Cuốc & EXP Rank
                      </span>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400">
                        Khi bật, mỗi bài học hoàn thành sẽ cộng từ 15–70 EXP với thuật toán độ khó lũy tiến. Khi tắt, giao diện quay về phong cách tối giản thanh lịch.
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={handleToggleCourseGamification}
                      className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors duration-200 cursor-pointer shrink-0 ${
                        courseGamificationEnabled ? 'bg-amber-500' : 'bg-slate-300 dark:bg-slate-700'
                      }`}
                    >
                      <div
                        className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ${
                          courseGamificationEnabled ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  {/* 2. Topbar Rank Widget Display Toggle */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/30 gap-3">
                    <div className="pr-4 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-800 dark:text-slate-200 text-xs">
                          Hiển thị Huy hiệu Rank trên thanh Topbar
                        </span>
                        <Badge
                          variant={showRankOnTopbar ? 'success' : 'secondary'}
                          className="text-[9px] py-0 px-1.5"
                        >
                          {showRankOnTopbar ? 'BẬT' : 'TẮT'}
                        </Badge>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Hiển thị huy hiệu cấp bậc cao nhất, icon danh hiệu, điểm EXP và hiệu ứng hào quang phát sáng trực tiếp trên thanh điều hướng Topbar.
                      </p>
                    </div>

                    <div className="flex items-center gap-3 shrink-0 self-end sm:self-auto">
                      {/* Live preview of how it looks on Topbar */}
                      {courseGamificationEnabled && (
                        <div
                          className="hidden md:flex items-center gap-1.5 py-1 px-2.5 rounded-md border text-xs font-semibold shadow-xs"
                          style={{
                            boxShadow: topStats.masteryInfo.currentTier.glowShadow,
                            border: `1px solid ${topStats.masteryInfo.currentTier.color}50`,
                          }}
                        >
                          <span>{topStats.masteryInfo.currentTier.icon}</span>
                          <span className="font-bold">{topStats.masteryInfo.currentTier.title}</span>
                          <span className="text-[10px] opacity-40">•</span>
                          <span className="font-mono text-[11px] font-bold text-amber-600 dark:text-amber-400">
                            {topStats.topPoints.toLocaleString()} EXP
                          </span>
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={handleToggleRankOnTopbar}
                        className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors duration-200 cursor-pointer shrink-0 ${
                          showRankOnTopbar ? 'bg-amber-500' : 'bg-slate-300 dark:bg-slate-700'
                        }`}
                      >
                        <div
                          className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ${
                            showRankOnTopbar ? 'translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                </div>

                {/* 3. Bảng Thống Kê EXP Khóa Học Của Người Dùng */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4 shadow-xs">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-2 text-sm font-bold text-slate-800 dark:text-slate-200">
                      <Trophy className="w-4 h-4 text-amber-500" />
                      <span>Thống Kê Khóa Học & Điểm EXP Thực Tế</span>
                    </div>
                    <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
                      Tổng tích lũy: <strong className="text-amber-600 dark:text-amber-400 font-bold">{topStats.totalXP.toLocaleString()} EXP</strong>
                    </span>
                  </div>

                  {coursesList.length === 0 ? (
                    <div className="p-6 text-center text-slate-400 text-xs rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
                      Chưa có khóa học nào được tạo. Hãy thêm khóa học tại trang Khóa Học để bắt đầu hành trình cày cuốc!
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {coursesList.map((course: any) => {
                        const mInfo = getCourseMasteryInfo(course.mastery_points || 0);
                        return (
                          <div
                            key={course.id}
                            className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex flex-col justify-between space-y-2.5 transition hover:border-slate-400 dark:hover:border-slate-600"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="space-y-0.5 min-w-0">
                                <h4 className="font-bold text-xs text-slate-800 dark:text-slate-200 truncate" title={course.title}>
                                  {course.title}
                                </h4>
                                <span className="text-[10px] text-slate-400 block truncate">
                                  {course.instructor ? `GV: ${course.instructor}` : 'Tự học'}
                                </span>
                              </div>

                              <div
                                className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md font-bold shrink-0 border"
                                style={{
                                  borderColor: `${mInfo.currentTier.color}60`,
                                  boxShadow: mInfo.currentTier.glowShadow,
                                }}
                              >
                                <span>{mInfo.currentTier.icon}</span>
                                <span className="truncate max-w-[80px]">{mInfo.currentTier.title}</span>
                                {mInfo.mythicStage && (
                                  <span className="text-amber-500 font-mono">[{mInfo.mythicStage.romanNumeral}]</span>
                                )}
                              </div>
                            </div>

                            <div className="space-y-1">
                              <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono">
                                <span>{mInfo.points.toLocaleString()} EXP</span>
                                <span>
                                  {mInfo.nextTier ? `Còn ${mInfo.xpNeededForNext.toLocaleString()} EXP lên ${mInfo.nextTier.title}` : 'Đạt Cảnh Giới Tối Cao'}
                                </span>
                              </div>
                              <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-1.5 overflow-hidden">
                                <div
                                  className="h-full rounded-full transition-all duration-300"
                                  style={{
                                    width: `${mInfo.progressPercent}%`,
                                    background: mInfo.currentTier.gradientBg,
                                  }}
                                />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* 4. Visual Showcase: 11 Cấp Bậc Danh Hiệu (Ultra-rich Cards) */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4 shadow-xs">
                  <div className="pb-2 border-b border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-2 text-sm font-bold text-slate-800 dark:text-slate-200">
                      <Crown className="w-4 h-4 text-amber-500" />
                      <span>Bảng vinh danh 11 cấp bậc danh hiệu</span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Đường cong độ khó lũy tiến với hiệu ứng màu sắc kim loại và đá quý cao cấp cho từng bậc.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                    {COURSE_RANK_TIERS.map((tier) => (
                      <div
                        key={tier.level}
                        className={`p-3.5 rounded-2xl border flex flex-col justify-between transition-all hover:scale-[1.02] shadow-xs relative overflow-hidden ${
                          tier.bgColor
                        } ${tier.borderColor} ${
                          tier.level === 11 ? 'sm:col-span-2 lg:col-span-3 ring-2 ring-amber-400/60 shadow-lg shadow-amber-500/10' : ''
                        }`}
                        style={{ boxShadow: tier.glowShadow }}
                      >
                        <div>
                          {/* Card Top: Level & Icon */}
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <span className="text-2xl select-none p-1 rounded-lg bg-white/40 dark:bg-black/30 backdrop-blur-xs">
                                {tier.icon}
                              </span>
                              <div>
                                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                                  Tier {tier.level} / 11
                                </span>
                                <h4 className={`font-black text-sm ${tier.textColor}`}>
                                  {tier.title}
                                </h4>
                              </div>
                            </div>

                            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border border-slate-300 dark:border-slate-600 bg-white/70 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 shrink-0">
                              {tier.min_xp.toLocaleString()} EXP+
                            </span>
                          </div>

                          {/* Tagline & Description */}
                          <p className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 italic mb-1">
                            "{tier.tagline}"
                          </p>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                            {tier.description}
                          </p>
                        </div>

                        {/* Special Mythic 5-Stage Showcase for Tier 11 */}
                        {tier.level === 11 && (
                          <div className="mt-4 pt-3 border-t border-amber-300/60 dark:border-amber-700/60 space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-amber-800 dark:text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                                <Flame className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
                                5 Tầng Cảnh Giới Thần Thoại:
                              </span>
                              <span className="text-[10px] font-mono text-amber-600 dark:text-amber-400 font-semibold">
                                Điểm càng cao hiệu ứng hào quang càng bùng nổ
                              </span>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-2 text-xs">
                              <div className="p-2 rounded-xl bg-purple-500/10 border border-purple-300 dark:border-purple-800 space-y-0.5">
                                <div className="flex items-center justify-between text-[11px] font-bold text-purple-700 dark:text-purple-300">
                                  <span>[I] Khởi Thần</span>
                                  <span>⭐</span>
                                </div>
                                <div className="text-[10px] font-mono text-slate-500">60k - 65k EXP</div>
                                <div className="text-[9px] text-purple-600 dark:text-purple-400">Hào Quang Thần Tím</div>
                              </div>

                              <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-300 dark:border-cyan-800 space-y-0.5">
                                <div className="flex items-center justify-between text-[11px] font-bold text-cyan-700 dark:text-cyan-300">
                                  <span>[II] Vạn Tượng</span>
                                  <span>⭐⭐</span>
                                </div>
                                <div className="text-[10px] font-mono text-slate-500">65k - 75k EXP</div>
                                <div className="text-[9px] text-cyan-600 dark:text-cyan-400">Cực Quang Huyền Bí</div>
                              </div>

                              <div className="p-2 rounded-xl bg-rose-500/10 border border-rose-300 dark:border-rose-800 space-y-0.5">
                                <div className="flex items-center justify-between text-[11px] font-bold text-rose-700 dark:text-rose-300">
                                  <span>[III] Hỗn Độn</span>
                                  <span>⭐⭐⭐</span>
                                </div>
                                <div className="text-[10px] font-mono text-slate-500">75k - 90k EXP</div>
                                <div className="text-[9px] text-rose-600 dark:text-rose-400">Bão Siêu Tân Tinh</div>
                              </div>

                              <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-300 dark:border-amber-800 space-y-0.5">
                                <div className="flex items-center justify-between text-[11px] font-bold text-amber-700 dark:text-amber-300">
                                  <span>[IV] Thái Cực</span>
                                  <span>⭐⭐⭐⭐</span>
                                </div>
                                <div className="text-[10px] font-mono text-slate-500">90k - 110k EXP</div>
                                <div className="text-[9px] text-amber-600 dark:text-amber-400">Sóng Xung Kích Thần</div>
                              </div>

                              <div className="p-2 rounded-xl bg-gradient-to-r from-amber-500/20 via-rose-500/20 to-purple-500/20 border border-amber-400 dark:border-amber-500 space-y-0.5 ring-1 ring-amber-400/40">
                                <div className="flex items-center justify-between text-[11px] font-black text-amber-800 dark:text-amber-200">
                                  <span>[V] Bất Diệt</span>
                                  <span>⭐⭐⭐⭐⭐👑</span>
                                </div>
                                <div className="text-[10px] font-mono text-slate-500">110k+ EXP</div>
                                <div className="text-[9px] font-bold text-amber-700 dark:text-amber-300">Trường Lực Thần Giới</div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* 5. Danger Zone: Reset All Ranks */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4 shadow-xs">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                    <span className="text-xs font-bold text-rose-600 uppercase tracking-wider">
                      Vùng Quản Trị & Đặt Lại Dữ Liệu
                    </span>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl border border-rose-200 dark:border-rose-900/50 bg-rose-50/40 dark:bg-rose-950/20">
                    <div>
                      <span className="font-semibold text-rose-800 dark:text-rose-300 block text-xs">
                        Đặt lại toàn bộ dữ liệu Rank & EXP về 0
                      </span>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400">
                        Đưa điểm kinh nghiệm của toàn bộ khóa học về 0 EXP (Tập sự). Trạng thái bài học và lịch trình học tập không bị xóa.
                      </span>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleResetAllRanks}
                      disabled={isResettingRanks}
                      className="border-rose-300 text-rose-700 hover:bg-rose-100 dark:border-rose-800 dark:text-rose-300 dark:hover:bg-rose-900/40 text-xs shrink-0 cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5 mr-1" />
                      {isResettingRanks ? 'Đang đặt lại...' : 'Đặt lại toàn bộ Rank'}
                    </Button>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* ================= TAB 5: ADVANCED (TÍNH NĂNG NÂNG CAO) ================= */}
          {activeTab === 'ADVANCED' && (
            <div className="space-y-5 animate-in fade-in-50 duration-200">
              {/* Discipline Mechanics */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-5 shadow-xs relative overflow-hidden">
                <div className="flex flex-wrap items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white shadow-md shadow-amber-500/20">
                      <Zap className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-slate-800 dark:text-slate-200">
                          Cơ chế & Thuật toán tính điểm kỷ luật
                        </span>
                        <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-semibold bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                          <Sparkles className="w-2.5 h-2.5" />
                          Nâng cao
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Tùy biến thuật toán đánh giá kỷ luật, cơ chế trừ điểm sớm khi gần chạm giới hạn giải trí/game
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleResetDiscipline}
                      disabled={isSavingDiscipline}
                      className="text-xs text-slate-500 h-8"
                      title="Khôi phục công thức mặc định"
                    >
                      <RotateCcw className="w-3.5 h-3.5 mr-1" />
                      <span>Mặc định</span>
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={handleSaveDiscipline}
                      disabled={isSavingDiscipline}
                      className="text-xs h-8"
                    >
                      <Check className="w-3.5 h-3.5 mr-1" />
                      <span>{isSavingDiscipline ? 'Đang lưu...' : 'Lưu cấu hình'}</span>
                    </Button>
                  </div>
                </div>

                {disciplineFeedback && (
                  <div
                    className={`p-3 rounded-lg text-xs flex items-center gap-2 ${
                      disciplineFeedback.type === 'success'
                        ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                        : 'bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                    }`}
                  >
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>{disciplineFeedback.text}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Early penalty toggle */}
                  <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex flex-col justify-between space-y-3">
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-xs text-slate-800 dark:text-slate-200 block">
                          Trừ điểm sớm khi gần chạm giới hạn
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setDisciplineConfig((prev) => ({
                              ...prev,
                              early_penalty_enabled: !prev.early_penalty_enabled,
                            }))
                          }
                          className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors duration-200 cursor-pointer ${
                            disciplineConfig.early_penalty_enabled ? 'bg-amber-500' : 'bg-slate-300 dark:bg-slate-700'
                          }`}
                        >
                          <div
                            className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ${
                              disciplineConfig.early_penalty_enabled ? 'translate-x-5' : 'translate-x-0'
                            }`}
                          />
                        </button>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                        Khi thời gian chơi game, mạng xã hội tiến vào vùng cảnh báo, hệ thống bắt đầu trừ dần một phần điểm để cảnh tỉnh thay vì đợi vượt 100% mới phạt.
                      </p>
                    </div>

                    <div className="pt-2 border-t border-slate-200/60 dark:border-slate-800/60 flex items-center justify-between text-[11px]">
                      <span className="text-slate-500">Trạng thái:</span>
                      <Badge variant={disciplineConfig.early_penalty_enabled ? 'success' : 'secondary'} className="text-[10px]">
                        {disciplineConfig.early_penalty_enabled ? 'Đang kích hoạt trừ sớm' : 'Chỉ phạt khi vượt 100%'}
                      </Badge>
                    </div>
                  </div>

                  {/* Warning threshold */}
                  <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex flex-col justify-between space-y-3">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-semibold text-xs text-slate-800 dark:text-slate-200">
                          Ngưỡng cảnh báo bắt đầu trừ điểm
                        </span>
                        <span className="font-bold text-xs text-amber-600 dark:text-amber-400">
                          {disciplineConfig.warning_threshold_pct}% định mức
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                        Tỷ lệ % thời gian định mức sẽ bắt đầu trừ điểm sớm. Ví dụ: Giới hạn 90 phút, ngưỡng 80% = phạt từ phút 72.
                      </p>

                      <div className="grid grid-cols-5 gap-1.5 mt-3">
                        {[70, 75, 80, 85, 90].map((pct) => (
                          <button
                            key={pct}
                            type="button"
                            onClick={() =>
                              setDisciplineConfig((prev) => ({
                                ...prev,
                                warning_threshold_pct: pct,
                              }))
                            }
                            className={`py-1.5 px-2 rounded-lg text-xs font-semibold border transition cursor-pointer ${
                              disciplineConfig.warning_threshold_pct === pct
                                ? 'bg-amber-500 text-white border-amber-600 shadow-xs'
                                : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
                            }`}
                          >
                            {pct}%
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-200/60 dark:border-slate-800/60 flex items-center justify-between text-[11px]">
                      <span className="text-slate-500">Mức đề xuất:</span>
                      <span className="text-slate-700 dark:text-slate-300 font-medium">80% (Cân bằng & hiệu quả)</span>
                    </div>
                  </div>

                  {/* Multiplier */}
                  <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex flex-col justify-between space-y-3">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-semibold text-xs text-slate-800 dark:text-slate-200">
                          Hệ số phạt khi vi phạm định mức
                        </span>
                        <span className="font-bold text-xs text-rose-600 dark:text-rose-400">
                          {disciplineConfig.penalty_multiplier.toFixed(1)}x
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                        Mức độ nghiêm khắc khi trừ điểm. Hệ số càng cao, điểm kỷ luật tụt càng nhanh khi quá đà.
                      </p>

                      <div className="grid grid-cols-4 gap-1.5 mt-3">
                        {[
                          { val: 0.5, label: '0.5x (Nhẹ)' },
                          { val: 1.0, label: '1.0x (Chuẩn)' },
                          { val: 1.5, label: '1.5x (Nghiêm)' },
                          { val: 2.0, label: '2.0x (Thép)' },
                        ].map((item) => (
                          <button
                            key={item.val}
                            type="button"
                            onClick={() =>
                              setDisciplineConfig((prev) => ({
                                ...prev,
                                penalty_multiplier: item.val,
                              }))
                            }
                            className={`py-1.5 px-2 rounded-lg text-xs font-semibold border transition cursor-pointer ${
                              disciplineConfig.penalty_multiplier === item.val
                                ? 'bg-rose-500 text-white border-rose-600 shadow-xs'
                                : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
                            }`}
                          >
                            {item.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-200/60 dark:border-slate-800/60 flex items-center justify-between text-[11px]">
                      <span className="text-slate-500">Mức chuẩn:</span>
                      <span className="text-slate-700 dark:text-slate-300 font-medium">1.0x (Trừ 0.1đ mỗi 5 phút vượt)</span>
                    </div>
                  </div>

                  {/* Formula Preview */}
                  <div className="p-4 rounded-xl border border-indigo-200 dark:border-indigo-900/50 bg-indigo-50/30 dark:bg-indigo-950/20 flex flex-col justify-between space-y-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1 text-xs font-bold text-indigo-900 dark:text-indigo-200">
                        <Shield className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                        <span>Minh bạch công thức tính điểm</span>
                      </div>
                      <div className="space-y-1.5 text-[11px] text-slate-600 dark:text-slate-300">
                        <p className="flex items-center justify-between">
                          <span>• Điểm tối đa khởi điểm:</span>
                          <strong className="text-emerald-600 dark:text-emerald-400 font-mono">10.0 / 10</strong>
                        </p>
                        <p className="flex items-center justify-between">
                          <span>• Trong vùng cảnh báo ({disciplineConfig.warning_threshold_pct}% - 100%):</span>
                          <span className="font-mono text-amber-600 dark:text-amber-400">
                            -{(0.05 * disciplineConfig.penalty_multiplier).toFixed(2)}đ / 5 phút
                          </span>
                        </p>
                        <p className="flex items-center justify-between">
                          <span>• Khi vượt quá 100% giới hạn:</span>
                          <span className="font-mono text-rose-600 dark:text-rose-400">
                            -{(0.10 * disciplineConfig.penalty_multiplier).toFixed(2)}đ / 5 phút
                          </span>
                        </p>
                        <p className="flex items-center justify-between">
                          <span>• Thưởng học tập & làm việc:</span>
                          <span className="font-mono text-blue-600 dark:text-blue-400">+0.5đ (≥2h) | +1.0đ (≥4h)</span>
                        </p>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-indigo-200/60 dark:border-indigo-800/60 text-[10px] text-indigo-600 dark:text-indigo-400 italic">
                      ⚡ Điểm số được giới hạn trong thang chuẩn từ 0.0 đến 10.0.
                    </div>
                  </div>
                </div>
              </div>

              {/* Quiet Hours Mode Card (NEW FEATURE) */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4 shadow-xs">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-2 text-sm font-bold text-slate-800 dark:text-slate-200">
                    <Moon className="w-4 h-4 text-indigo-500" />
                    <span>Chế độ Giờ yên tĩnh (Quiet Hours & Do Not Disturb)</span>
                  </div>
                  <Badge variant={quietHoursEnabled ? 'success' : 'secondary'} className="text-[10px]">
                    {quietHoursEnabled ? 'Đang bật' : 'Đang tắt'}
                  </Badge>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <div>
                    <span className="font-semibold text-slate-800 dark:text-slate-200 block">
                      Tự động tạm dừng âm thanh và thông báo ban đêm
                    </span>
                    <span className="text-slate-500 dark:text-slate-400">
                      Từ <strong>22:30 đến 06:30</strong>, hệ thống tự động giữ yên tĩnh để không làm gián đoạn giấc ngủ của bạn.
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setQuietHoursEnabled(!quietHoursEnabled)}
                    className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors duration-200 cursor-pointer ${
                      quietHoursEnabled ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-700'
                    }`}
                  >
                    <div
                      className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ${
                        quietHoursEnabled ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ================= TAB 5: BACKUP & SYNC ================= */}
          {activeTab === 'BACKUP' && (
            <div className="space-y-5 animate-in fade-in-50 duration-200">
              {/* Auto Update & Version Info Card */}
              <div className="bg-gradient-to-br from-indigo-50/50 via-white to-sky-50/40 dark:from-slate-900 dark:via-slate-900 dark:to-indigo-950/20 border border-indigo-100 dark:border-indigo-900/40 rounded-xl p-5 space-y-4 shadow-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-indigo-100/70 dark:border-slate-800 gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center shadow-xs shrink-0">
                      <RefreshCw className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-slate-800 dark:text-slate-200">
                          Tự động cập nhật từ GitHub (Auto Update)
                        </span>
                        <Badge variant="default" className="text-[10px] py-0 px-2 font-mono bg-indigo-600 text-white hover:bg-indigo-700">v1.2.0</Badge>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Đồng bộ mã nguồn 1-click từ GitHub hoặc gói ZIP, bảo vệ an toàn 100% cơ sở dữ liệu SQLite
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.dispatchEvent(new CustomEvent('lifeos_open_changelog'))}
                      className="text-xs h-8"
                    >
                      <Sparkles className="w-3.5 h-3.5 mr-1.5 text-indigo-500" />
                      <span>Xem Changelog</span>
                    </Button>
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => window.dispatchEvent(new CustomEvent('lifeos_open_auto_update'))}
                      className="text-xs h-8 bg-indigo-600 hover:bg-indigo-700 text-white"
                    >
                      <Upload className="w-3.5 h-3.5 mr-1.5" />
                      <span>Mở Cập nhật</span>
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="p-3 rounded-lg bg-white/80 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800">
                    <span className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                      📁 Phân vùng làm việc (App Partition)
                    </span>
                    <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400 break-all select-all">
                      C:\Users\Huu Quy\Pictures\lifeos
                    </span>
                  </div>
                  <div className="p-3 rounded-lg bg-white/80 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800">
                    <span className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                      🛡️ Bảo vệ dữ liệu cá nhân
                    </span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      Tự động sao lưu snapshot trước khi trích xuất. Không bao giờ ghi đè file <code>lifeos.db</code>.
                    </span>
                  </div>
                </div>
              </div>

              {/* Google Drive Card */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-5 shadow-xs">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-2 text-sm font-bold text-slate-800 dark:text-slate-200">
                    <Cloud className="w-5 h-5 text-neutral-900 dark:text-neutral-100" />
                    <span>Phase 5: Google Drive Backup & Sync Engine</span>
                  </div>
                  <Badge variant={gdriveStatus?.connected ? 'success' : 'info'} className="text-xs">
                    {gdriveStatus?.connected ? 'Đã kết nối Google Drive' : 'Local Backup Ready'}
                  </Badge>
                </div>

                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  Đồng bộ và sao lưu dữ liệu đám mây an toàn. <strong>Local SQLite luôn là Single Source of Truth</strong>, 
                  Google Drive lưu trữ các bản snapshot và toàn bộ file đính kèm.
                </p>

                {/* Sync Controls Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Action 1: Sync Now */}
                  <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex flex-col justify-between space-y-2">
                    <div>
                      <span className="font-semibold text-xs text-slate-800 dark:text-slate-200 block">
                        Đồng bộ ngay
                      </span>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400">
                        Tạo bản snapshot an toàn và đẩy lên Google Drive / snapshot local.
                      </span>
                    </div>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={handleSyncGoogleDrive}
                      disabled={isSyncing}
                      className="w-full justify-center mt-2"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isSyncing ? 'animate-spin' : ''}`} />
                      <span>{isSyncing ? 'Đang đồng bộ...' : 'Đồng bộ ngay'}</span>
                    </Button>
                  </div>

                  {/* Action 2: Auto Sync */}
                  <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex flex-col justify-between space-y-2">
                    <div>
                      <span className="font-semibold text-xs text-slate-800 dark:text-slate-200 block">
                        Tự động đồng bộ
                      </span>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400">
                        Tự động tạo snapshot đồng bộ định kỳ khi có thay đổi dữ liệu lớn.
                      </span>
                    </div>
                    <Button
                      variant={gdriveStatus?.auto_sync ? 'success' : 'outline'}
                      size="sm"
                      onClick={handleToggleAutoSync}
                      className="w-full justify-center mt-2"
                    >
                      <Radio className="w-3.5 h-3.5 mr-1.5" />
                      <span>{gdriveStatus?.auto_sync ? 'Đang bật (Auto Sync: ON)' : 'Bật tự động đồng bộ'}</span>
                    </Button>
                  </div>

                  {/* Action 3: Export Zip Bundle */}
                  <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex flex-col justify-between space-y-2">
                    <div>
                      <span className="font-semibold text-xs text-slate-800 dark:text-slate-200 block">
                        Xuất gói sao lưu di động (.zip)
                      </span>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400">
                        Đóng gói toàn bộ database, attachments và manifest thành tệp zip.
                      </span>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleExportZipBundle}
                      className="w-full justify-center mt-2"
                    >
                      <FileArchive className="w-3.5 h-3.5 mr-1.5 text-neutral-900 dark:text-neutral-100" />
                      <span>Tải xuống gói sao lưu (.zip)</span>
                    </Button>
                  </div>

                  {/* Action 4: Import Zip Bundle */}
                  <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex flex-col justify-between space-y-2">
                    <div>
                      <span className="font-semibold text-xs text-slate-800 dark:text-slate-200 block">
                        Khôi phục từ gói sao lưu (.zip)
                      </span>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400">
                        Khôi phục database và file đính kèm với cơ chế sao lưu an toàn tự động.
                      </span>
                    </div>
                    <div>
                      <input
                        type="file"
                        ref={fileInputRef}
                        accept=".zip"
                        onChange={handleImportZipBundle}
                        className="hidden"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isRestoring}
                        className="w-full justify-center mt-2"
                      >
                        <Upload className="w-3.5 h-3.5 mr-1.5 text-emerald-500" />
                        <span>{isRestoring ? 'Đang khôi phục...' : 'Tải lên tệp .zip để khôi phục'}</span>
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Credentials */}
                <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-800/20 text-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-700 dark:text-slate-300 font-semibold flex items-center gap-1.5">
                      <Key className="w-3.5 h-3.5 text-neutral-900 dark:text-neutral-100" />
                      <span>Cấu hình Google Drive Service Account (Tùy chọn)</span>
                    </span>
                    <input
                      type="file"
                      ref={credsInputRef}
                      accept=".json"
                      onChange={handleUploadCredentials}
                      className="hidden"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => credsInputRef.current?.click()}
                    >
                      <Upload className="w-3.5 h-3.5 mr-1" />
                      <span>Tải file service_account.json</span>
                    </Button>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Nếu không cấu hình service account, hệ thống sẽ hoạt động ở chế độ <strong>Portable Sync Bundle</strong> (Xuất/Khôi phục gói ZIP và Snapshot local an toàn).
                  </p>
                </div>

                {/* Sync History */}
                <div className="pt-2 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      Nhật ký đồng bộ (Sync History - {syncHistory.length})
                    </span>
                    {gdriveStatus?.last_sync && (
                      <span className="text-slate-400 text-[11px]">
                        Lần sync cuối: {new Date(gdriveStatus.last_sync).toLocaleString('vi-VN')}
                      </span>
                    )}
                  </div>

                  {syncHistory.length === 0 ? (
                    <div className="text-center py-4 text-xs text-slate-400 bg-slate-50/50 dark:bg-slate-800/20 rounded-lg">
                      Chưa có nhật ký đồng bộ nào.
                    </div>
                  ) : (
                    <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                      {syncHistory.map((item) => {
                        const isSuccess = item.status === 'COMPLETED';
                        return (
                          <div
                            key={item.id}
                            className="flex items-start justify-between p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-800/30 text-xs"
                          >
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-2">
                                <Badge
                                  variant={isSuccess ? 'success' : 'destructive'}
                                  className="text-[10px] py-0 px-1.5"
                                >
                                  {item.sync_type}
                                </Badge>
                                <span className="text-[11px] font-mono text-slate-400">
                                  {new Date(item.created_at).toLocaleString('vi-VN')}
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-600 dark:text-slate-300">
                                {item.details || 'Không có ghi chú'}
                              </p>
                            </div>

                            <span className={`text-[11px] font-semibold ${isSuccess ? 'text-emerald-500' : 'text-rose-500'}`}>
                              {item.status}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Database Status & Local Backups */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4 shadow-xs">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-2 text-sm font-bold text-slate-800 dark:text-slate-200">
                    <Database className="w-4 h-4 text-neutral-900 dark:text-neutral-100" />
                    <span>Cơ sở dữ liệu SQLite & Bản sao lưu cục bộ</span>
                  </div>
                  <Button variant="outline" size="sm" onClick={handleBackupNow} disabled={isBackingUp}>
                    <Download className={`w-3.5 h-3.5 mr-1 ${isBackingUp ? 'animate-spin' : ''}`} />
                    <span>{isBackingUp ? 'Đang tạo...' : 'Tạo snapshot ngay'}</span>
                  </Button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-800/20">
                    <span className="text-slate-400 block mb-0.5">Trạng thái tệp DB</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {dbStatus?.exists ? '✓ Tồn tại và hợp lệ' : 'Chưa khởi tạo'}
                    </span>
                  </div>
                  <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-800/20">
                    <span className="text-slate-400 block mb-0.5">Dung lượng Database</span>
                    <span className="font-semibold font-mono text-slate-800 dark:text-slate-200">
                      {dbStatus?.size_bytes ? `${(dbStatus.size_bytes / 1024).toFixed(1)} KB` : '0 KB'}
                    </span>
                  </div>
                  <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-800/20">
                    <span className="text-slate-400 block mb-0.5">Bản sao lưu cục bộ</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {backups.length} bản snapshot
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ================= TAB 6: DANGER ZONE ================= */}
          {activeTab === 'DANGER' && (
            <div className="space-y-5 animate-in fade-in-50 duration-200">
              <div className="border border-rose-200 dark:border-rose-900/60 bg-rose-50/20 dark:bg-rose-950/10 rounded-xl p-5 space-y-4 shadow-xs">
                <div className="flex items-center gap-2 pb-2 border-b border-rose-200 dark:border-rose-900/60 text-sm font-bold text-rose-700 dark:text-rose-400">
                  <AlertTriangle className="w-4 h-4 text-rose-600" />
                  <span>Vùng nguy hiểm</span>
                </div>

                <div className="space-y-3 text-xs">
                  <span className="font-semibold text-slate-900 dark:text-slate-100 block text-sm">
                    Đặt lại về dữ liệu trống hoàn toàn
                  </span>
                  <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                    Hành động này sẽ xóa sạch toàn bộ nhiệm vụ, khóa học, lịch trình cố định, mục tiêu, nhật ký và định mức màn hình.
                    <strong> Hệ thống không tải lại bất kỳ dữ liệu mẫu (preset) nào</strong> để bạn bắt đầu hoàn toàn mới từ số 0.
                  </p>

                  <div className="p-3 rounded-lg bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-900/60 text-[11px] text-slate-600 dark:text-slate-400">
                    🛡️ <strong>Bảo vệ dữ liệu tự động:</strong> Trước khi xóa, LifeOS luôn tự động tạo một bản sao lưu an toàn (`safety_backup_...db`) trong thư mục `backups` để bạn có thể khôi phục lại bất cứ khi nào cần.
                  </div>

                  <div className="pt-2">
                    <Button
                      variant="destructive"
                      onClick={() => setIsResetModalOpen(true)}
                    >
                      <RotateCcw className="w-4 h-4 mr-1.5" />
                      <span>Xóa sạch về dữ liệu trống</span>
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ================= MODALS ================= */}

      {/* Modal: Chỉnh sửa / Thêm Danh mục */}
      {isCatModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 max-w-md w-full space-y-4 shadow-xl animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-neutral-900 dark:text-neutral-100" />
                <span>{editingCat ? 'Chỉnh sửa Danh mục' : 'Thêm Danh mục Mới'}</span>
              </h3>
              <button onClick={() => setIsCatModalOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCategory} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                  Tên hiển thị danh mục *
                </label>
                <Input
                  type="text"
                  required
                  placeholder="VD: Mạng xã hội, Chơi Game, Luyện thi"
                  value={catLabel}
                  onChange={(e) => setCatLabel(e.target.value)}
                />
              </div>

              {!editingCat && (
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                    Mã danh mục (Viết liền, không dấu)
                  </label>
                  <Input
                    type="text"
                    placeholder="VD: GAMING, TIKTOK"
                    value={catCode}
                    onChange={(e) => setCatCode(e.target.value)}
                  />
                </div>
              )}

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold">
                    Phân loại *
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setIsCatModalOpen(false);
                      setCatActiveTab('TYPES');
                    }}
                    className="text-[11px] text-neutral-900 dark:text-neutral-100 font-semibold hover:underline"
                  >
                    + Quản lý phân loại
                  </button>
                </div>
                <select
                  value={catType}
                  onChange={(e) => setCatType(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-slate-900 dark:text-slate-100 text-xs"
                >
                  {categoryTypes.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.label} ({t.effect === 'BONUS' ? 'Thưởng kỷ luật' : t.effect === 'PENALTY' ? 'Trừ điểm nếu vượt' : 'Trung tính'})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                  Định mức tối đa mỗi ngày (Phút) *
                </label>
                <Input
                  type="number"
                  min="0"
                  step="5"
                  required
                  value={catLimit}
                  onChange={(e) => setCatLimit(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                  Mô tả / Ứng dụng liên quan (Tùy chọn)
                </label>
                <Input
                  type="text"
                  placeholder="VD: Facebook, YouTube, Steam..."
                  value={catDesc}
                  onChange={(e) => setCatDesc(e.target.value)}
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3">
                <Button type="button" variant="outline" onClick={() => setIsCatModalOpen(false)}>
                  Hủy bỏ
                </Button>
                <Button type="submit" variant="primary">
                  {editingCat ? 'Lưu thay đổi' : '+ Tạo danh mục'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Chỉnh sửa / Thêm Phân loại (Category Type) */}
      {isTypeModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 max-w-md w-full space-y-4 shadow-xl animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Sliders className="w-4 h-4 text-neutral-900 dark:text-neutral-100" />
                <span>{editingType ? `Sửa phân loại: ${editingType.label}` : 'Thêm Phân loại Mới'}</span>
              </h3>
              <button onClick={() => setIsTypeModalOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveType} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                  Tên nhóm phân loại *
                </label>
                <Input
                  type="text"
                  required
                  placeholder="VD: Tập trung cao độ, Xao nhãng nặng"
                  value={typeLabel}
                  onChange={(e) => setTypeLabel(e.target.value)}
                />
              </div>

              {!editingType && (
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                    Mã phân loại (ID không dấu, viết hoa)
                  </label>
                  <Input
                    type="text"
                    placeholder="VD: DEEP_WORK, DISTRACTION_HIGH"
                    value={typeId}
                    onChange={(e) => setTypeId(e.target.value)}
                  />
                </div>
              )}

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                  Màu sắc nhận diện
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={typeColor}
                    onChange={(e) => setTypeColor(e.target.value)}
                    className="w-9 h-9 rounded cursor-pointer border border-slate-200 dark:border-slate-700"
                  />
                  <Input
                    type="text"
                    value={typeColor}
                    onChange={(e) => setTypeColor(e.target.value)}
                    className="font-mono text-xs flex-1"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                  Hiệu ứng tính điểm kỷ luật *
                </label>
                <select
                  value={typeEffect}
                  onChange={(e) => setTypeEffect(e.target.value as any)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-slate-900 dark:text-slate-100 text-xs"
                >
                  <option value="NEUTRAL">Trung tính (Không thưởng, không phạt)</option>
                  <option value="BONUS">Thưởng kỷ luật (Cộng điểm nếu duy trì học tập)</option>
                  <option value="PENALTY">Trừ điểm kỷ luật (Phạt điểm nếu vượt định mức)</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                  Mô tả quy chuẩn (Tùy chọn)
                </label>
                <Input
                  type="text"
                  placeholder="VD: Dành cho các hoạt động giải trí gây nghiện"
                  value={typeDesc}
                  onChange={(e) => setTypeDesc(e.target.value)}
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3">
                <Button type="button" variant="outline" onClick={() => setIsTypeModalOpen(false)}>
                  Hủy bỏ
                </Button>
                <Button type="submit" variant="primary">
                  {editingType ? 'Lưu thay đổi' : '+ Tạo phân loại'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Xác nhận Reset Blank Database */}
      {isResetModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-rose-200 dark:border-rose-900 p-6 max-w-md w-full space-y-4 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="w-10 h-10 rounded-full bg-rose-100 dark:bg-rose-950/60 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Xác nhận xóa sạch cơ sở dữ liệu?
                </h3>
                <span className="text-xs text-rose-600 font-medium">Hành động này không thể hoàn tác trực tiếp</span>
              </div>
            </div>

            <div className="space-y-2 text-xs text-slate-600 dark:text-slate-300 leading-relaxed bg-rose-50/50 dark:bg-rose-950/20 p-3 rounded-lg border border-rose-100 dark:border-rose-900/40">
              <p>• Toàn bộ nhiệm vụ, khóa học, lịch trình cố định và nhật ký sẽ bị xóa sạch.</p>
              <p>• Hệ thống sẽ trở về <strong>trạng thái trắng 100%</strong>, không tự động nạp bất kỳ dữ liệu mẫu nào.</p>
              <p>• Bản sao lưu an toàn tự động được lưu trong thư mục `backups/`.</p>
            </div>

            <div className="space-y-1.5 text-xs">
              <label className="block text-slate-700 dark:text-slate-300 font-semibold">
                Nhập từ khóa <span className="font-mono text-rose-600 font-bold">RESET</span> để tiếp tục:
              </label>
              <Input
                type="text"
                value={resetConfirmText}
                onChange={(e) => setResetConfirmText(e.target.value)}
                placeholder="Nhập RESET..."
                className="font-mono text-center tracking-widest uppercase font-bold text-xs"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setIsResetModalOpen(false);
                  setResetConfirmText('');
                }}
                disabled={isResetting}
              >
                Hủy bỏ
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleExecuteReset}
                disabled={resetConfirmText.trim() !== 'RESET' || isResetting}
              >
                {isResetting ? 'Đang xóa sạch...' : 'Xác nhận xóa sạch toàn bộ'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SettingsPage;
