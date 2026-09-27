import React, { useState, useEffect, useMemo } from 'react';
import {
  BookOpen, Plus, Clock, Layers, X, Trash2, Search,
  ChevronsDown, ChevronsUp, GraduationCap, CheckCircle2,
  Edit3, Palette, Check, Sparkles, FileText, Target, Zap, Flame, Calendar, HeartPulse,
  Swords, AlignLeft, AlignCenter, AlignRight, Trophy, ShieldAlert, Award,
  RotateCcw, Crown, Star
} from 'lucide-react';
import { CourseTree } from '../components/courses/CourseTree';
import { CreateStudyTaskModal } from '../components/courses/CreateStudyTaskModal';
import { EditCourseNodeModal } from '../components/courses/EditCourseNodeModal';
import { CourseBurnoutModal } from '../components/courses/CourseBurnoutModal';
import { Course, CourseNode, Goal, FixedSchedule, CountdownItem, CountdownCoverConfig } from '../types';
import { api } from '../services/api';
import { Button } from '../components/ui/button';
import { getCourseMasteryInfo, isCourseGamificationEnabled, setCourseGamificationEnabled, COURSE_RANK_TIERS } from '../utils/courseGamification';
import { isMentalHealthEnabled } from '../utils/featureFlags';

const COURSE_COLORS = [
  { label: 'Emerald', hex: '#10b981' },
  { label: 'Sky', hex: '#0284c7' },
  { label: 'Blue', hex: '#3b82f6' },
  { label: 'Indigo', hex: '#6366f1' },
  { label: 'Purple', hex: '#8b5cf6' },
  { label: 'Rose', hex: '#f43f5e' },
  { label: 'Amber', hex: '#f59e0b' },
  { label: 'Teal', hex: '#0d9488' },
  { label: 'Slate', hex: '#64748b' },
  { label: 'Dark', hex: '#1e293b' },
];

const COURSE_COVER_STYLES = [
  { value: 'DEFAULT', label: 'Cơ bản', desc: 'Viền màu thanh lịch chuẩn' },
  { value: 'FONTY', label: 'Fonty Typo', desc: 'Đổ dốc 2 màu Gradient & Typo' },
  { value: 'SWISS', label: 'Swiss Style', desc: 'Vòng cung Thụy Sĩ tối giản' },
  { value: 'GRID', label: 'Grid Ma trận', desc: 'Lưới ô tiến độ bài học' },
  { value: 'MINIMAL', label: 'Tối giản', desc: 'Siêu tinh gọn' },
];

const GRADIENT_PRESETS = [
  { name: 'Hoàng Hôn', c1: '#f43f5e', c2: '#f59e0b' },
  { name: 'Cyber Neon', c1: '#6366f1', c2: '#a855f7' },
  { name: 'Lục Bảo', c1: '#059669', c2: '#10b981' },
  { name: 'Đại Dương', c1: '#06b6d4', c2: '#3b82f6' },
  { name: 'Bóng Đêm', c1: '#1e1b4b', c2: '#4338ca' },
  { name: 'Hồng Đỏ', c1: '#e11d48', c2: '#be123c' },
];

interface CoursesPageProps {
  onNavigateTab?: (tab: string) => void;
}

export const CoursesPage: React.FC<CoursesPageProps> = ({ onNavigateTab }) => {
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<number | null>(null);
  const [courseDetail, setCourseDetail] = useState<Course | null>(null);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [fixedSchedules, setFixedSchedules] = useState<FixedSchedule[]>([]);
  const [countdowns, setCountdowns] = useState<CountdownItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Gamification setting state (Default: OFF)
  const [isGamificationOn, setIsGamificationOn] = useState<boolean>(() => isCourseGamificationEnabled());

  // Search & view controls
  const [searchTerm, setSearchTerm] = useState('');
  const [isAllExpanded, setIsAllExpanded] = useState<boolean | undefined>(undefined);

  // Modals
  const [nodeForTask, setNodeForTask] = useState<CourseNode | null>(null);
  const [isAddCourseModalOpen, setIsAddCourseModalOpen] = useState(false);
  const [isEditCourseModalOpen, setIsEditCourseModalOpen] = useState(false);
  const [isAddNodeModalOpen, setIsAddNodeModalOpen] = useState(false);
  const [isEditNodeModalOpen, setIsEditNodeModalOpen] = useState(false);
  const [isBurnoutModalOpen, setIsBurnoutModalOpen] = useState(false);
  const [editingNode, setEditingNode] = useState<CourseNode | null>(null);
  const [parentNodeId, setParentNodeId] = useState<number | null>(null);

  // New course form
  const [newCourseTitle, setNewCourseTitle] = useState('');
  const [newCourseDesc, setNewCourseDesc] = useState('');
  const [newCourseInstructor, setNewCourseInstructor] = useState('');
  const [newCourseColor, setNewCourseColor] = useState('#10b981');
  const [newCourseCountdownId, setNewCourseCountdownId] = useState<number | undefined>(undefined);
  const [newCourseCoverStyle, setNewCourseCoverStyle] = useState<'DEFAULT' | 'FONTY' | 'SWISS' | 'GRID' | 'MINIMAL'>('DEFAULT');
  const [newCourseGradient1, setNewCourseGradient1] = useState('#4f46e5');
  const [newCourseGradient2, setNewCourseGradient2] = useState('#ec4899');
  const [newCourseAlign, setNewCourseAlign] = useState<'left' | 'center' | 'right'>('left');
  const [newCourseSwissDirection, setNewCourseSwissDirection] = useState<'CLOCKWISE' | 'COUNTER_CLOCKWISE'>('CLOCKWISE');
  const [newCourseGridShape, setNewCourseGridShape] = useState<'SQUARE' | 'CIRCLE'>('CIRCLE');
  const [newCourseGridFill, setNewCourseGridFill] = useState<'FILLED' | 'OUTLINE'>('FILLED');
  const [newCourseGridColor, setNewCourseGridColor] = useState('#10b981');

  // Edit course form
  const [editingCourseId, setEditingCourseId] = useState<number | null>(null);
  const [editCourseTitle, setEditCourseTitle] = useState('');
  const [editCourseDesc, setEditCourseDesc] = useState('');
  const [editCourseInstructor, setEditCourseInstructor] = useState('');
  const [editCourseColor, setEditCourseColor] = useState('#10b981');
  const [editCourseCountdownId, setEditCourseCountdownId] = useState<number | undefined>(undefined);
  const [editCourseCoverStyle, setEditCourseCoverStyle] = useState<'DEFAULT' | 'FONTY' | 'SWISS' | 'GRID' | 'MINIMAL'>('DEFAULT');
  const [editCourseGradient1, setEditCourseGradient1] = useState('#4f46e5');
  const [editCourseGradient2, setEditCourseGradient2] = useState('#ec4899');
  const [editCourseAlign, setEditCourseAlign] = useState<'left' | 'center' | 'right'>('left');
  const [editCourseSwissDirection, setEditCourseSwissDirection] = useState<'CLOCKWISE' | 'COUNTER_CLOCKWISE'>('CLOCKWISE');
  const [editCourseGridShape, setEditCourseGridShape] = useState<'SQUARE' | 'CIRCLE'>('CIRCLE');
  const [editCourseGridFill, setEditCourseGridFill] = useState<'FILLED' | 'OUTLINE'>('FILLED');
  const [editCourseGridColor, setEditCourseGridColor] = useState('#10b981');

  // New node form
  const [newNodeTitle, setNewNodeTitle] = useState('');
  const [newNodeType, setNewNodeType] = useState('LESSON');
  const [newNodeDuration, setNewNodeDuration] = useState<number>(45);

  const loadCourses = async () => {
    setIsLoading(true);
    try {
      const list = await api.courses.list();
      setCourses(list);
      if (list.length > 0) {
        setSelectedCourseId((prev) => {
          if (prev && list.some((c) => c.id === prev)) return prev;
          return list[0].id;
        });
      } else {
        setSelectedCourseId(null);
        setCourseDetail(null);
      }
    } catch (err) {
      console.error('Failed to load courses:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadCourseDetail = async (id: number) => {
    try {
      const detail = await api.courses.get(id);
      setCourseDetail(detail);
    } catch (err) {
      console.error('Failed to load course detail:', err);
    }
  };

  const loadGoals = async () => {
    try {
      const res = await api.goals.list();
      setGoals(res);
    } catch (err) {
      console.error('Failed to load goals:', err);
    }
  };

  const loadFixedSchedules = async () => {
    try {
      const res = await api.schedules.list();
      setFixedSchedules(res);
    } catch (err) {
      console.error('Failed to load fixed schedules:', err);
    }
  };

  const loadCountdowns = async () => {
    try {
      const res = await api.countdowns.list();
      setCountdowns(res);
    } catch (err) {
      console.error('Failed to load countdowns:', err);
    }
  };

  useEffect(() => {
    loadCourses();
    loadGoals();
    loadFixedSchedules();
    loadCountdowns();
  }, []);

  // Sync gamification toggle from settings
  useEffect(() => {
    const handleGamificationUpdated = () => {
      setIsGamificationOn(isCourseGamificationEnabled());
    };
    window.addEventListener('lifeos_gamification_updated', handleGamificationUpdated);
    return () => window.removeEventListener('lifeos_gamification_updated', handleGamificationUpdated);
  }, []);

  useEffect(() => {
    if (selectedCourseId) {
      loadCourseDetail(selectedCourseId);
    } else {
      setCourseDetail(null);
    }
  }, [selectedCourseId]);

  const handleToggleNodeStatus = async (node: CourseNode) => {
    try {
      const newStatus = node.status === 'COMPLETED' ? 'NOT_STARTED' : 'COMPLETED';
      await api.courses.updateNode(node.id, { status: newStatus });
      if (selectedCourseId) await loadCourseDetail(selectedCourseId);
      await loadCourses();
      window.dispatchEvent(new CustomEvent('lifeos_courses_updated'));
    } catch (err) {
      console.error('Failed to toggle node status:', err);
    }
  };

  const handleResetCourseMastery = async (courseId: number) => {
    if (window.confirm('Bạn có chắc chắn muốn đặt lại điểm EXP và Rank của khóa học này về 0 (Tập sự)?')) {
      try {
        await api.courses.resetMastery(courseId);
        if (selectedCourseId === courseId) await loadCourseDetail(courseId);
        await loadCourses();
        window.dispatchEvent(new CustomEvent('lifeos_courses_updated'));
      } catch (err) {
        console.error('Failed to reset course mastery:', err);
        alert('Không thể đặt lại điểm Rank.');
      }
    }
  };

  const handleDeleteNode = async (nodeId: number) => {
    if (window.confirm('Bạn có chắc chắn muốn xóa mục này và các mục con?')) {
      try {
        await api.courses.deleteNode(nodeId);
        if (selectedCourseId) await loadCourseDetail(selectedCourseId);
        await loadCourses();
      } catch (err) {
        console.error('Failed to delete node:', err);
      }
    }
  };

  const handleDeleteCourse = async (courseId: number, courseTitle: string) => {
    if (window.confirm(`Bạn có chắc chắn muốn xóa khóa học "${courseTitle}" và toàn bộ bài học bên trong?`)) {
      try {
        await api.courses.delete(courseId);
        await loadCourses();
      } catch (err) {
        console.error('Failed to delete course:', err);
      }
    }
  };

  const handleOpenEditCourse = (course: Course) => {
    setEditingCourseId(course.id);
    setEditCourseTitle(course.title);
    setEditCourseDesc(course.description || '');
    setEditCourseInstructor(course.instructor || '');
    setEditCourseColor(course.color || '#10b981');
    setEditCourseCountdownId(course.countdown_id ? Number(course.countdown_id) : undefined);

    let cfg: any = {};
    if (course.cover_config) {
      try {
        cfg = typeof course.cover_config === 'string' ? JSON.parse(course.cover_config) : course.cover_config;
      } catch {}
    }
    setEditCourseCoverStyle((course.cover_style as any) || 'DEFAULT');
    setEditCourseGradient1(cfg.gradient_color1 || '#4f46e5');
    setEditCourseGradient2(cfg.gradient_color2 || '#ec4899');
    setEditCourseAlign(cfg.align || 'left');
    setEditCourseSwissDirection(cfg.swiss_direction || 'CLOCKWISE');
    setEditCourseGridShape(cfg.grid_shape || 'CIRCLE');
    setEditCourseGridFill(cfg.grid_fill || 'FILLED');
    setEditCourseGridColor(cfg.grid_color || course.color || '#10b981');

    setIsEditCourseModalOpen(true);
  };

  const handleUpdateCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCourseId || !editCourseTitle.trim()) return;
    try {
      const coverConfigObj: CountdownCoverConfig = {
        align: editCourseAlign,
        gradient_color1: editCourseGradient1,
        gradient_color2: editCourseGradient2,
        swiss_direction: editCourseSwissDirection,
        grid_shape: editCourseGridShape,
        grid_fill: editCourseGridFill,
        grid_color: editCourseGridColor,
      };

      await api.courses.update(editingCourseId, {
        title: editCourseTitle.trim(),
        description: editCourseDesc.trim() || undefined,
        instructor: editCourseInstructor.trim() || undefined,
        color: editCourseColor,
        countdown_id: editCourseCountdownId || null,
        cover_style: editCourseCoverStyle,
        cover_config: JSON.stringify(coverConfigObj),
      });
      setIsEditCourseModalOpen(false);
      await loadCourses();
      if (selectedCourseId === editingCourseId) {
        await loadCourseDetail(editingCourseId);
      }
    } catch (err) {
      console.error('Failed to update course:', err);
      alert('Không thể cập nhật khóa học. Vui lòng kiểm tra lại!');
    }
  };

  const handleCreateCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCourseTitle.trim()) return;
    try {
      const coverConfigObj: CountdownCoverConfig = {
        align: newCourseAlign,
        gradient_color1: newCourseGradient1,
        gradient_color2: newCourseGradient2,
        swiss_direction: newCourseSwissDirection,
        grid_shape: newCourseGridShape,
        grid_fill: newCourseGridFill,
        grid_color: newCourseGridColor,
      };

      const created = await api.courses.create({
        title: newCourseTitle.trim(),
        description: newCourseDesc.trim() || undefined,
        instructor: newCourseInstructor.trim() || undefined,
        color: newCourseColor,
        countdown_id: newCourseCountdownId || undefined,
        cover_style: newCourseCoverStyle,
        cover_config: JSON.stringify(coverConfigObj),
      });
      setIsAddCourseModalOpen(false);
      setNewCourseTitle('');
      setNewCourseDesc('');
      setNewCourseInstructor('');
      setNewCourseColor('#10b981');
      setNewCourseCountdownId(undefined);
      setNewCourseCoverStyle('DEFAULT');
      setNewCourseGradient1('#4f46e5');
      setNewCourseGradient2('#ec4899');
      setNewCourseAlign('left');
      setNewCourseSwissDirection('CLOCKWISE');
      setNewCourseGridShape('CIRCLE');
      setNewCourseGridFill('FILLED');
      setNewCourseGridColor('#10b981');
      await loadCourses();
      setSelectedCourseId(created.id);
    } catch (err: any) {
      console.error('Failed to create course:', err);
      alert('Không thể tạo khóa học: ' + (err?.message || 'Vui lòng kiểm tra lại'));
    }
  };

  const handleCreateNode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNodeTitle.trim() || !selectedCourseId) return;
    try {
      await api.courses.createNode({
        course_id: selectedCourseId,
        parent_id: parentNodeId || undefined,
        title: newNodeTitle.trim(),
        type: newNodeType as any,
        duration: newNodeType === 'LESSON' ? newNodeDuration : undefined,
        status: 'NOT_STARTED',
        progress: 0.0,
      });
      setIsAddNodeModalOpen(false);
      setNewNodeTitle('');
      setParentNodeId(null);
      await loadCourseDetail(selectedCourseId);
      await loadCourses();
    } catch (err) {
      console.error('Failed to create node:', err);
    }
  };

  const handleOpenEditNode = (node: CourseNode) => {
    setEditingNode(node);
    setIsEditNodeModalOpen(true);
  };

  const handleSaveNode = async (nodeId: number, nodeData: Partial<CourseNode>) => {
    try {
      await api.courses.updateNode(nodeId, nodeData);
      if (selectedCourseId) await loadCourseDetail(selectedCourseId);
      await loadCourses();
    } catch (err) {
      console.error('Failed to save node:', err);
      throw err;
    }
  };

  const handleCreateStudyTask = async (data: any) => {
    try {
      await api.courses.createStudyTask(data);
      alert('Đã lên lịch Study Task thông minh thành công và liên kết với bài học!');
      if (selectedCourseId) await loadCourseDetail(selectedCourseId);
      await loadCourses();
      window.dispatchEvent(new CustomEvent('lifeos_task_updated'));
    } catch (err) {
      console.error('Failed to create study task:', err);
      throw err;
    }
  };

  const handleCreateScheduleEvent = async (data: {
    title: string;
    course_id: number;
    course_node_id?: number;
    day_of_week: number;
    start_time: string;
    end_time: string;
    category?: string;
    color?: string;
    location?: string;
    description?: string;
    create_attached_task?: boolean;
    task_priority?: string;
    task_difficulty?: number;
  }) => {
    try {
      const created = await api.schedules.create({
        title: data.title,
        day_of_week: data.day_of_week,
        start_time: data.start_time,
        end_time: data.end_time,
        category: data.category || 'STUDY',
        color: data.color || '#10b981',
        location: data.location || undefined,
        description: data.description || undefined,
        course_id: data.course_id,
        course_node_id: data.course_node_id,
        repeat_rule: 'WEEKLY',
        is_active: true,
      });

      if (data.create_attached_task && data.course_node_id) {
        await api.courses.createStudyTask({
          lesson_id: data.course_node_id,
          title: `Ôn tập: ${data.title}`,
          difficulty: data.task_difficulty || 2,
          priority: data.task_priority || 'MEDIUM',
          fixed_schedule_id: created.id,
        });
      }

      await loadFixedSchedules();
      if (selectedCourseId) await loadCourseDetail(selectedCourseId);
      window.dispatchEvent(new CustomEvent('lifeos_schedule_updated'));
      window.dispatchEvent(new CustomEvent('lifeos_task_updated'));
    } catch (err: any) {
      console.error('Failed to create schedule event:', err);
      alert('Không thể tạo lịch học: ' + (err?.message || 'Vui lòng thử lại'));
      throw err;
    }
  };

  // Calculate total duration in minutes for the course
  const totalDurationMinutes = useMemo(() => {
    if (!courseDetail?.root_nodes) return 0;
    const sumDurations = (nodes: CourseNode[]): number => {
      let total = 0;
      for (const n of nodes) {
        total += n.duration || 0;
        if (n.children && n.children.length > 0) {
          total += sumDurations(n.children);
        }
      }
      return total;
    };
    return sumDurations(courseDetail.root_nodes);
  }, [courseDetail]);

  const durationHours = (totalDurationMinutes / 60).toFixed(1);

  // Course cover styling and gamification calculations
  const courseCoverConfig = useMemo(() => {
    if (!courseDetail?.cover_config) return {};
    if (typeof courseDetail.cover_config === 'string') {
      try {
        return JSON.parse(courseDetail.cover_config);
      } catch {
        return {};
      }
    }
    return courseDetail.cover_config;
  }, [courseDetail?.cover_config]);

  const courseCoverStyle = courseDetail?.cover_style || 'DEFAULT';
  const isCourseFonty = courseCoverStyle === 'FONTY';
  const isCourseSwiss = courseCoverStyle === 'SWISS';
  const isCourseGrid = courseCoverStyle === 'GRID';
  const isCourseMinimal = courseCoverStyle === 'MINIMAL';
  const courseAlign = courseCoverConfig.align || 'left';
  const courseFontyGrad = isCourseFonty
    ? `linear-gradient(135deg, ${courseCoverConfig.gradient_color1 || '#4f46e5'}, ${courseCoverConfig.gradient_color2 || '#ec4899'})`
    : undefined;

  const courseMasteryInfo = useMemo(() => {
    return getCourseMasteryInfo(courseDetail?.mastery_points || 0);
  }, [courseDetail?.mastery_points]);

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <GraduationCap className="w-5 h-5 text-neutral-900 dark:text-neutral-100" />
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Khóa học & Lộ trình</h2>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Quản lý cây kiến thức đa cấp, liên kết mục tiêu đếm ngược và phân tích thông minh nguy cơ Burnout
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Quick Gamification Toggle */}
          <button
            type="button"
            onClick={() => {
              const nextVal = !isGamificationOn;
              setCourseGamificationEnabled(nextVal);
              setIsGamificationOn(nextVal);
            }}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all shadow-2xs cursor-pointer active:scale-95 ${
              isGamificationOn
                ? 'bg-gradient-to-r from-amber-500/15 via-orange-500/15 to-purple-500/15 border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300 ring-1 ring-amber-400/50'
                : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
            title="Bật/Tắt tính năng cày cuốc EXP và 10 Bậc Danh hiệu cho khóa học"
          >
            <Swords className={`w-3.5 h-3.5 ${isGamificationOn ? 'text-amber-500 animate-bounce' : 'text-slate-400'}`} />
            <span>Chế độ Cày Cuốc: <strong className={isGamificationOn ? 'text-amber-600 dark:text-amber-400' : ''}>{isGamificationOn ? 'BẬT' : 'TẮT'}</strong></span>
          </button>

          <Button
            variant="primary"
            onClick={() => setIsAddCourseModalOpen(true)}
            className="shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>Thêm Khóa học mới</span>
          </Button>
        </div>
      </div>

      {/* Gamification Teaser Callout when OFF */}
      {!isGamificationOn && courses.length > 0 && (
        <div className="p-3.5 rounded-2xl bg-gradient-to-r from-amber-500/10 via-purple-500/10 to-indigo-500/10 border border-amber-200/80 dark:border-amber-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-2xs">
          <div className="flex items-center gap-2.5">
            <span className="text-xl shrink-0">⚔️</span>
            <div>
              <span className="font-bold text-slate-900 dark:text-slate-100">
                Tính năng Cày Cuốc & 10 Bậc Danh Hiệu đang TẮT
              </span>
              <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">
                Bật chế độ cày cuốc để tích lũy EXP sau mỗi bài hoàn thành, thăng hạng từ 🛡️ Tập Sự lên ⚔️ Chiến Thần và 🌌 Tuyệt Đối Thần Vương!
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setCourseGamificationEnabled(true);
              setIsGamificationOn(true);
            }}
            className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold text-xs shrink-0 shadow-sm transition active:scale-95 flex items-center gap-1.5 cursor-pointer"
          >
            <Swords className="w-3.5 h-3.5" />
            <span>Bật Cày Cuốc Ngay</span>
          </button>
        </div>
      )}

      {/* Courses Cards Selector */}
      {courses.length > 0 ? (
        <div className="flex items-stretch gap-3 overflow-x-auto pb-2 scrollbar-thin">
          {courses.map((c) => {
            const isSelected = c.id === selectedCourseId;
            const courseColor = c.color || '#10b981';
            let cardCfg: any = {};
            if (c.cover_config) {
              try {
                cardCfg = typeof c.cover_config === 'string' ? JSON.parse(c.cover_config) : c.cover_config;
              } catch {}
            }
            const isCardFonty = c.cover_style === 'FONTY';
            const isCardSwiss = c.cover_style === 'SWISS';
            const isCardGrid = c.cover_style === 'GRID';
            const isCardMinimal = c.cover_style === 'MINIMAL';
            const cardAlign = cardCfg.align || 'left';
            const cardGradient = isCardFonty
              ? `linear-gradient(135deg, ${cardCfg.gradient_color1 || '#4f46e5'}, ${cardCfg.gradient_color2 || '#ec4899'})`
              : undefined;
            const cardMastery = getCourseMasteryInfo(c.mastery_points || 0);
            const gridShape = cardCfg.grid_shape || 'CIRCLE';
            const gridFill = cardCfg.grid_fill || 'FILLED';
            const gridColor = cardCfg.grid_color || courseColor;
            const swissDirection = cardCfg.swiss_direction || 'CLOCKWISE';
            const isCounterClockwise = swissDirection === 'COUNTER_CLOCKWISE';

            return (
              <div
                key={c.id}
                onClick={() => setSelectedCourseId(c.id)}
                className={`group relative rounded-2xl border-2 min-w-[260px] sm:min-w-[290px] max-w-[320px] transition-all cursor-pointer shadow-xs overflow-hidden flex flex-col justify-between ${
                  isSelected
                    ? isGamificationOn && cardMastery.currentTier.level === 11
                      ? 'border-amber-400 dark:border-amber-400 shadow-md shadow-amber-500/25 -translate-y-0.5'
                      : 'border-indigo-600 dark:border-indigo-400 shadow-md -translate-y-0.5'
                    : isGamificationOn && cardMastery.currentTier.level === 11
                    ? 'border-amber-400/80 dark:border-amber-500/70 shadow-xs shadow-amber-500/10 hover:border-amber-400 hover:-translate-y-0.5'
                    : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-xs hover:-translate-y-0.5'
                }`}
              >
                {/* 1. Dedicated Course Cover Header Area */}
                <div
                  className={`p-3.5 relative transition-all flex flex-col justify-between min-h-[96px] ${
                    isCardFonty
                      ? 'text-white'
                      : isCardSwiss
                      ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-950'
                      : isCardGrid
                      ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100'
                      : isCardMinimal
                      ? 'bg-slate-50 dark:bg-slate-900/60 text-slate-900 dark:text-slate-100 border-b border-slate-200 dark:border-slate-800'
                      : 'bg-gradient-to-br from-slate-100 to-slate-50 dark:from-slate-800 dark:to-slate-850 text-slate-900 dark:text-slate-100'
                  }`}
                  style={{
                    background: isCardFonty
                      ? cardGradient
                      : isCardMinimal
                      ? undefined
                      : !isCardSwiss && !isCardGrid
                      ? `linear-gradient(135deg, ${courseColor}25, ${courseColor}08)`
                      : undefined,
                  }}
                >
                  {/* Grid background texture if GRID style */}
                  {isCardGrid && (
                    <div className="absolute inset-0 opacity-25 pointer-events-none p-2 flex flex-wrap gap-1 content-start overflow-hidden">
                      {Array.from({ length: 48 }).map((_, i) => (
                        <div
                          key={i}
                          className={`w-2 h-2 ${gridShape === 'SQUARE' ? 'rounded-xs' : 'rounded-full'}`}
                          style={
                            gridFill === 'OUTLINE'
                              ? { border: `1.5px solid ${gridColor}`, backgroundColor: 'transparent' }
                              : { backgroundColor: gridColor }
                          }
                        />
                      ))}
                    </div>
                  )}

                  {/* Top row of cover: Style tag & Action buttons */}
                  <div className="flex items-center justify-between gap-1 relative z-10">
                    <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${
                      isCardFonty
                        ? 'bg-white/20 text-white'
                        : isCardSwiss
                        ? 'bg-white/20 text-white dark:bg-neutral-900/20 dark:text-neutral-900'
                        : 'bg-white/80 dark:bg-slate-900/80 text-slate-700 dark:text-slate-300'
                    }`}>
                      {c.cover_style || 'DEFAULT'}
                    </span>

                    {/* Quick action buttons */}
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity bg-black/20 dark:bg-white/20 backdrop-blur-xs rounded-lg p-0.5">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenEditCourse(c);
                        }}
                        className="p-1 rounded text-white hover:bg-white/20 transition"
                        title={`Sửa khóa học "${c.title}"`}
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteCourse(c.id, c.title);
                        }}
                        className="p-1 rounded text-rose-300 hover:text-rose-100 hover:bg-rose-500/30 transition"
                        title={`Xóa khóa học "${c.title}"`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Middle: Title & Swiss Circle Graphic */}
                  <div className="flex items-center justify-between gap-2 mt-2 relative z-10">
                    <div className={`min-w-0 flex-1 ${cardAlign === 'center' ? 'text-center' : cardAlign === 'right' ? 'text-right' : 'text-left'}`}>
                      <h4 className="font-extrabold text-xs sm:text-sm line-clamp-1 leading-snug tracking-tight" title={c.title}>
                        {c.title}
                      </h4>
                      <p className={`text-[10px] mt-0.5 truncate ${isCardFonty || isCardSwiss ? 'opacity-80' : 'text-slate-500 dark:text-slate-400'}`}>
                        {c.instructor ? `GV: ${c.instructor}` : 'Tự học'}
                      </p>
                    </div>

                    {/* Swiss circular arc graphic on cover */}
                    {isCardSwiss && (
                      <div className="relative w-8 h-8 shrink-0 flex items-center justify-center">
                        <svg className={`w-8 h-8 ${isCounterClockwise ? '-rotate-90 scale-x-[-1]' : '-rotate-90'}`} viewBox="0 0 36 36">
                          <path
                            className="text-white/20 dark:text-neutral-900/20"
                            strokeWidth="4"
                            stroke="currentColor"
                            fill="none"
                            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                          />
                          <path
                            className="text-amber-400"
                            strokeWidth="4"
                            strokeDasharray={`${c.overall_progress || 0}, 100`}
                            strokeLinecap="round"
                            stroke="currentColor"
                            fill="none"
                            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                          />
                        </svg>
                        <span className="absolute text-[8px] font-mono font-bold">{c.overall_progress || 0}%</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* 2. Card Body Info */}
                <div className="p-3 bg-white dark:bg-slate-900 space-y-2 flex-1 flex flex-col justify-between">
                  <div>
                    {/* Countdown deadline badge if attached */}
                    {c.countdown_title && (
                      <div className="flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/80 mb-2 truncate">
                        <span>{c.countdown_icon || '🎓'}</span>
                        <span className="truncate">{c.countdown_title}</span>
                        <span className="font-bold shrink-0 ml-auto">({c.countdown_days_left}d)</span>
                      </div>
                    )}

                    {/* Gamification Rank Badge & EXP (Active when gamification is ON) */}
                    {isGamificationOn && (
                      <div className={`relative overflow-hidden flex items-center justify-between gap-1 p-1.5 rounded-lg border text-[10px] transition-all ${
                        cardMastery.currentTier.level === 11
                          ? 'bg-gradient-to-r from-amber-500/20 via-rose-500/20 to-purple-500/20 border-amber-400 dark:border-amber-400 text-amber-900 dark:text-amber-200 shadow-xs'
                          : cardMastery.currentTier.level >= 9
                          ? 'bg-gradient-to-r from-amber-500/10 via-rose-500/10 to-purple-500/10 border-amber-300/80 dark:border-amber-700/80'
                          : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700/60'
                      }`}>
                        {/* High-tier continuous aura vapor glow */}
                        {cardMastery.currentTier.level >= 8 && (
                          <div
                            className="absolute inset-0 pointer-events-none opacity-20 blur-xs animate-rank-vapor"
                            style={{ background: cardMastery.currentTier.gradientBg }}
                          />
                        )}
                        <span className="inline-flex items-center gap-1 font-bold relative z-10">
                          <span className={cardMastery.currentTier.level >= 8 ? 'animate-rank-flame inline-block' : ''}>{cardMastery.currentTier.icon}</span>
                          <span className="font-mono">{cardMastery.currentTier.title}</span>
                          {cardMastery.mythicStage && (
                            <span className="text-[9px] font-black text-amber-600 dark:text-amber-300 font-mono">
                              [{cardMastery.mythicStage.romanNumeral}] {cardMastery.mythicStage.starsDisplay}
                            </span>
                          )}
                        </span>
                        <span className="font-mono font-bold text-amber-600 dark:text-amber-400 relative z-10">
                          {(c.mastery_points || 0).toLocaleString()} EXP
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Progress Bar */}
                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80">
                    <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400 mb-1">
                      <span className="font-bold text-slate-800 dark:text-slate-200">{c.overall_progress || 0}%</span>
                      <span>{c.completed_nodes_count || 0}/{c.total_nodes_count || 0} bài</span>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{
                          width: `${c.overall_progress || 0}%`,
                          backgroundColor: courseColor,
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 border border-dashed border-slate-300 dark:border-slate-800 rounded-2xl p-8 text-center space-y-3 shadow-xs">
          <BookOpen className="w-8 h-8 mx-auto text-slate-400" />
          <div>
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">Chưa có khóa học nào</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Hãy tạo khóa học đầu tiên để bắt đầu tổ chức cây bài học và lên lịch học tập.
            </p>
          </div>
          <Button
            variant="primary"
            size="sm"
            onClick={() => setIsAddCourseModalOpen(true)}
          >
            <Plus className="w-4 h-4" />
            <span>Tạo Khóa học ngay</span>
          </Button>
        </div>
      )}

      {/* Selected Course Dashboard Banner */}
      {courseDetail && (
        <div
          className={`border rounded-2xl p-5 shadow-xs space-y-4 relative overflow-hidden transition-all ${
            isCourseFonty
              ? 'text-white border-transparent shadow-md'
              : isCourseSwiss
              ? 'bg-neutral-950 text-white dark:bg-neutral-950 dark:text-white border-neutral-800 shadow-md'
              : isCourseGrid
              ? 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100'
              : isCourseMinimal
              ? 'bg-slate-50/70 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
          }`}
          style={{
            background: courseFontyGrad,
            boxShadow: isCourseFonty
              ? `0 6px 28px -4px ${courseCoverConfig.gradient_color1 || '#4f46e5'}40`
              : undefined,
          }}
        >
          {/* Grid background texture if GRID style */}
          {isCourseGrid && (
            <div className="absolute inset-0 opacity-15 pointer-events-none p-4 flex flex-wrap gap-2 content-start overflow-hidden">
              {Array.from({ length: 60 }).map((_, i) => (
                <div
                  key={i}
                  className={`w-3 h-3 ${courseCoverConfig.grid_shape === 'SQUARE' ? 'rounded-xs' : 'rounded-full'}`}
                  style={
                    courseCoverConfig.grid_fill === 'OUTLINE'
                      ? { border: `1.5px solid ${courseCoverConfig.grid_color || courseDetail.color || '#10b981'}`, backgroundColor: 'transparent' }
                      : { backgroundColor: courseCoverConfig.grid_color || courseDetail.color || '#10b981' }
                  }
                />
              ))}
            </div>
          )}

          {/* Top accent border with course color */}
          {!isCourseFonty && (
            <div
              className="absolute top-0 left-0 right-0 h-1.5"
              style={{ backgroundColor: courseDetail.color || '#10b981' }}
            />
          )}

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-1 relative z-10">
            <div className={`min-w-0 flex-1 ${courseAlign === 'center' ? 'text-center' : courseAlign === 'right' ? 'text-right' : 'text-left'}`}>
              <div className={`flex items-center gap-2.5 flex-wrap ${courseAlign === 'center' ? 'justify-center' : courseAlign === 'right' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className="w-3 h-3 rounded-full shrink-0 shadow-xs"
                  style={{ backgroundColor: courseDetail.color || '#10b981' }}
                />
                <h3 className={`text-lg font-bold ${isCourseFonty || isCourseSwiss ? 'text-white drop-shadow-sm' : 'text-slate-900 dark:text-slate-100'}`}>
                  {courseDetail.title}
                </h3>
                {courseDetail.instructor && (
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    isCourseFonty || isCourseSwiss
                      ? 'bg-white/20 text-white'
                      : 'text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800'
                  }`}>
                    Giảng viên: <strong className={isCourseFonty || isCourseSwiss ? 'text-white' : 'text-slate-700 dark:text-slate-300'}>{courseDetail.instructor}</strong>
                  </span>
                )}
                <span className={`text-[10px] uppercase font-mono font-bold px-2 py-0.5 rounded-full ${
                  isCourseFonty
                    ? 'bg-white/25 text-white'
                    : isCourseSwiss
                    ? 'bg-amber-400/20 text-amber-300 border border-amber-400/30'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700'
                }`}>
                  {courseCoverStyle}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Wellbeing & Mental Health Management Navigation (Tạm đóng khi tắt tính năng) */}
              {isMentalHealthEnabled() && (
                <>
                  {onNavigateTab && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onNavigateTab('wellbeing')}
                      className="text-xs font-semibold bg-gradient-to-r from-rose-50 to-indigo-50 dark:from-rose-950/40 dark:to-indigo-950/40 border-rose-200 dark:border-rose-800/80 text-rose-700 dark:text-rose-300 hover:opacity-90 shadow-2xs"
                      title="Mở bảng điều khiển Quản lý Sức khỏe Tinh thần & Độ Căng toàn diện"
                    >
                      <HeartPulse className="w-3.5 h-3.5 text-rose-500 mr-1 animate-pulse" />
                      <span>Quản lý Sức khỏe Tinh thần</span>
                    </Button>
                  )}

                  {/* Quick Burnout & Sleep Modal */}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsBurnoutModalOpen(true)}
                    className="text-xs font-semibold bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-950/40 dark:to-purple-950/40 border-indigo-200 dark:border-indigo-800/80 text-indigo-700 dark:text-indigo-300 hover:from-indigo-100 hover:to-purple-100 shadow-2xs"
                    title="Phân tích nhanh nguy cơ Burnout cho riêng khóa học này"
                  >
                    <Zap className="w-3.5 h-3.5 text-amber-500 mr-1" />
                    <span>Xem nhanh Burnout</span>
                  </Button>
                </>
              )}

              <Button
                variant="outline"
                size="sm"
                onClick={() => handleOpenEditCourse(courseDetail)}
                className="text-xs font-semibold"
                title="Chỉnh sửa thông tin khóa học, ghi chú và màu sắc"
              >
                <Edit3 className="w-3.5 h-3.5 mr-1" />
                <span>Sửa Khóa học</span>
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setParentNodeId(null);
                  setIsAddNodeModalOpen(true);
                }}
              >
                <Plus className="w-3.5 h-3.5 text-neutral-900 dark:text-neutral-100" />
                <span>Thêm Phần / Chương gốc</span>
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => handleDeleteCourse(courseDetail.id, courseDetail.title)}
                className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/20 border-rose-200 dark:border-rose-900/40"
                title="Xóa khóa học này"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Xóa</span>
              </Button>
            </div>
          </div>

          {/* LINKED COUNTDOWN & STUDY PACE HIGHLIGHT CARD */}
          {courseDetail.countdown_title ? (
            <div className="p-3.5 rounded-2xl bg-gradient-to-r from-indigo-50/80 via-purple-50/50 to-indigo-50/80 dark:from-indigo-950/30 dark:via-purple-950/20 dark:to-indigo-950/30 border border-indigo-200 dark:border-indigo-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-2xs">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 dark:bg-indigo-400/10 flex items-center justify-center text-xl select-none shrink-0">
                  {courseDetail.countdown_icon || '🎓'}
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-slate-900 dark:text-slate-100">
                      Mục tiêu: {courseDetail.countdown_title}
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-700">
                      Còn {courseDetail.countdown_days_left} ngày
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">
                    Để hoàn thành kịp tiến độ: cần học <strong className="text-indigo-600 dark:text-indigo-400 font-mono font-bold">{Math.round(courseDetail.estimated_daily_study_minutes || 0)} phút/ngày</strong> (~{courseDetail.estimated_daily_lessons || 0} bài/ngày liên tục).
                  </p>
                </div>
              </div>

              <Button
                size="sm"
                variant="primary"
                onClick={() => setIsBurnoutModalOpen(true)}
                className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white shrink-0 shadow-xs flex items-center gap-1.5"
              >
                <Zap className="w-3.5 h-3.5 text-amber-300" />
                <span>Xem Ma trận Tải & Burnout</span>
              </Button>
            </div>
          ) : (
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/30 border border-dashed border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
              <span className="flex items-center gap-1.5">
                <Target className="w-3.5 h-3.5 text-indigo-500" />
                <span>Khóa học chưa liên kết với Mục tiêu đếm ngược nào. Bấm "Sửa Khóa học" để gắn kỳ thi / deadline và kích hoạt ước tính tốc độ học!</span>
              </span>
              <button
                onClick={() => handleOpenEditCourse(courseDetail)}
                className="text-indigo-600 dark:text-indigo-400 font-bold hover:underline shrink-0 text-xs"
              >
                Gắn ngay →
              </button>
            </div>
          )}

          {/* Course Notes / Syllabus Callout */}
          {courseDetail.description && (
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 text-xs">
              <div className="flex items-center gap-1.5 font-semibold text-slate-700 dark:text-slate-300 mb-1">
                <FileText className="w-3.5 h-3.5 text-slate-500" />
                <span>Ghi chú & Định hướng khóa học:</span>
              </div>
              <p className="text-slate-600 dark:text-slate-400 whitespace-pre-line leading-relaxed">
                {courseDetail.description}
              </p>
            </div>
          )}

          {/* Gamification Callout when OFF in detail banner */}
          {!isGamificationOn && (
            <div className="p-3.5 rounded-xl bg-gradient-to-r from-amber-500/10 via-purple-500/10 to-indigo-500/10 border border-amber-200/80 dark:border-amber-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-2xs">
              <div className="flex items-center gap-2.5">
                <span className="text-xl shrink-0">⚔️</span>
                <div>
                  <span className="font-bold text-slate-800 dark:text-slate-200">
                    Chế độ Cày Cuốc & 10 Bậc Danh Hiệu đang TẮT
                  </span>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Kích hoạt để tích lũy EXP bài học, mở khóa danh hiệu từ 🛡️ Tập Sự đến ⚔️ Chiến Thần và 🌌 Tuyệt Đối Thần Vương!
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setCourseGamificationEnabled(true);
                  setIsGamificationOn(true);
                }}
                className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold text-xs shrink-0 shadow-sm transition active:scale-95 flex items-center gap-1.5 cursor-pointer"
              >
                <Swords className="w-3.5 h-3.5" />
                <span>Bật Chế Độ Cày Cuốc Ngay</span>
              </button>
            </div>
          )}

          {/* COURSE GAMIFICATION MASTERY BANNER (11 RANKS TIERS + RADIATING AURA & DYNAMIC MYTHIC SCALING) */}
          {isGamificationOn && (
            <div className="relative group my-2">
              {/* Continuous Radiating Aura Effect (Hiệu ứng Khí & Hào Quang toả ra liên tục) */}
              <div className="absolute -inset-1.5 rounded-2xl pointer-events-none overflow-visible">
                {/* Outward Radiating Wave 1 */}
                <div
                  className="absolute inset-0 rounded-2xl animate-rank-radiate-1"
                  style={{
                    backgroundColor: courseMasteryInfo.mythicStage?.auraColor || courseMasteryInfo.currentTier.color,
                    boxShadow: `0 0 24px ${courseMasteryInfo.mythicStage?.auraColor || courseMasteryInfo.currentTier.color}80`,
                  }}
                />
                {/* Outward Radiating Wave 2 (Staggered continuous flow) */}
                <div
                  className="absolute inset-0 rounded-2xl animate-rank-radiate-2"
                  style={{
                    backgroundColor: courseMasteryInfo.mythicStage?.auraColor || courseMasteryInfo.currentTier.color,
                    boxShadow: `0 0 36px ${courseMasteryInfo.mythicStage?.auraColor || courseMasteryInfo.currentTier.color}60`,
                  }}
                />
                {/* Swirling energy vapor / mist around edges */}
                <div
                  className="absolute -inset-1 rounded-2xl opacity-35 blur-md animate-rank-vapor"
                  style={{
                    background: courseMasteryInfo.currentTier.gradientBg,
                  }}
                />
              </div>

              {/* Main Banner Card */}
              <div
                className={`p-4 rounded-xl border-2 transition-all duration-500 relative overflow-hidden ${
                  isCourseFonty
                    ? 'bg-black/40 backdrop-blur-md border-white/20 text-white'
                    : courseMasteryInfo.currentTier.level === 11
                    ? 'bg-gradient-to-r from-amber-500/15 via-rose-500/15 to-purple-500/20 border-amber-400 dark:border-amber-400'
                    : courseMasteryInfo.currentTier.level >= 9
                    ? 'bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-rose-500/10 dark:from-amber-950/40 dark:via-orange-950/40 dark:to-rose-950/40 border-amber-400/80 dark:border-amber-500/80'
                    : 'bg-white/95 dark:bg-slate-900/95 border-slate-300 dark:border-slate-700'
                }`}
                style={{
                  borderColor: courseMasteryInfo.mythicStage?.auraColor || (courseMasteryInfo.currentTier.level >= 6 ? courseMasteryInfo.currentTier.color : undefined),
                  boxShadow: courseMasteryInfo.mythicStage
                    ? courseMasteryInfo.mythicStage.boxShadow
                    : courseMasteryInfo.currentTier.glowShadow,
                }}
              >
                {/* Mythic Background Ambient Glow */}
                {courseMasteryInfo.mythicStage && (
                  <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-35">
                    <div
                      className="absolute -top-12 -right-12 w-56 h-56 rounded-full blur-2xl animate-pulse"
                      style={{ backgroundColor: courseMasteryInfo.mythicStage.auraColor }}
                    />
                    <div
                      className="absolute -bottom-12 -left-12 w-56 h-56 rounded-full blur-2xl animate-pulse"
                      style={{ backgroundColor: '#a855f7', animationDuration: `${courseMasteryInfo.mythicStage.pulseSpeedSec}s` }}
                    />
                  </div>
                )}

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 relative z-10">
                  {/* Left: Rank Badge & Title with continuous radiating icon aura */}
                  <div className="flex items-center gap-3">
                    <div className="relative shrink-0">
                      {/* Radiating aura halo behind icon */}
                      <div
                        className="absolute -inset-2 rounded-2xl animate-rank-radiate-1 pointer-events-none opacity-60"
                        style={{
                          backgroundColor: courseMasteryInfo.mythicStage?.auraColor || courseMasteryInfo.currentTier.color,
                          filter: 'blur(8px)',
                        }}
                      />
                      <div
                        className="absolute -inset-1 rounded-2xl animate-rank-vapor pointer-events-none opacity-50"
                        style={{
                          background: courseMasteryInfo.currentTier.gradientBg,
                          filter: 'blur(4px)',
                        }}
                      />
                      <div
                        className={`relative z-10 w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shadow-inner select-none transition-all duration-300 ${
                          courseMasteryInfo.currentTier.level === 11
                            ? 'bg-gradient-to-br from-amber-400 via-rose-500 via-purple-600 to-cyan-400 text-white animate-rank-flame shadow-md ring-2 ring-amber-300'
                            : courseMasteryInfo.currentTier.level >= 9
                            ? 'bg-gradient-to-br from-amber-400 via-rose-500 to-purple-600 text-white animate-rank-flame'
                            : courseMasteryInfo.currentTier.level >= 6
                            ? 'bg-gradient-to-br from-indigo-500 to-purple-600 text-white'
                            : 'bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400'
                        }`}
                      >
                        <span className="animate-rank-vapor inline-block">{courseMasteryInfo.currentTier.icon}</span>
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`text-xs uppercase font-extrabold tracking-wider px-2 py-0.5 rounded-full ${
                            courseMasteryInfo.currentTier.level === 11
                              ? 'bg-gradient-to-r from-amber-400 via-rose-500 to-purple-600 text-white font-black shadow-xs'
                              : courseMasteryInfo.currentTier.level >= 9
                              ? 'bg-amber-400 text-slate-950 font-black shadow-xs'
                              : 'bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300'
                          }`}
                        >
                          Tier {courseMasteryInfo.currentTier.level} / 11
                        </span>
                        <h4 className={`text-sm font-bold ${isCourseFonty ? 'text-white' : 'text-slate-900 dark:text-slate-100'}`}>
                          {courseMasteryInfo.currentTier.title}
                        </h4>
                        {courseMasteryInfo.mythicStage ? (
                          <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-gradient-to-r from-amber-500 via-rose-500 to-purple-600 text-white shadow-xs flex items-center gap-1 animate-pulse">
                            <span>{courseMasteryInfo.mythicStage.stageTitle}</span>
                            <span className="opacity-90">• {courseMasteryInfo.mythicStage.subtitle}</span>
                            <span>{courseMasteryInfo.mythicStage.starsDisplay}</span>
                          </span>
                        ) : (
                          courseMasteryInfo.currentTier.level >= 9 && (
                            <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-gradient-to-r from-rose-500 to-amber-500 text-white shadow-xs animate-bounce">
                              {courseMasteryInfo.currentTier.level === 10 ? 'TUYỆT ĐỐI' : 'CHIẾN THẦN'}
                            </span>
                          )
                        )}
                      </div>
                      <p className={`text-xs mt-0.5 ${isCourseFonty ? 'text-white/80' : 'text-slate-500 dark:text-slate-400'}`}>
                        {courseMasteryInfo.mythicStage ? (
                          <span className="inline-flex items-center gap-1.5 font-medium text-amber-700 dark:text-amber-300">
                            <Sparkles className="w-3.5 h-3.5 shrink-0 text-amber-500 animate-spin" style={{ animationDuration: '6s' }} />
                            <span>{courseMasteryInfo.mythicStage.auraName}</span>
                            <span className="opacity-70">({courseMasteryInfo.mythicStage.surplusXP.toLocaleString()} EXP vượt mốc Thần Thoại)</span>
                          </span>
                        ) : (
                          courseMasteryInfo.currentTier.description
                        )}
                      </p>
                    </div>
                  </div>

                  {/* Right: EXP Numbers & Reset Button */}
                  <div className="text-left sm:text-right sm:shrink-0 flex sm:flex-col items-baseline sm:items-end justify-between sm:justify-center gap-1.5">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleResetCourseMastery(courseDetail.id)}
                        className="p-1 rounded-md text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition"
                        title="Đặt lại điểm Rank và EXP của khóa học này về 0"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                      </button>
                      <div className="flex items-baseline gap-1.5">
                        <span className={`text-xl font-extrabold font-mono ${
                          courseMasteryInfo.currentTier.level === 11
                            ? 'text-transparent bg-clip-text bg-gradient-to-r from-amber-500 via-rose-500 to-purple-600'
                            : isCourseFonty
                            ? 'text-amber-300'
                            : 'text-amber-600 dark:text-amber-400'
                        }`}>
                          {(courseDetail.mastery_points || 0).toLocaleString()}
                        </span>
                        <span className={`text-xs font-semibold ${isCourseFonty ? 'text-white/70' : 'text-slate-500 dark:text-slate-400'}`}>
                          EXP Khóa học
                        </span>
                      </div>
                    </div>
                    <div className={`text-[11px] font-mono mt-0.5 ${isCourseFonty ? 'text-white/70' : 'text-slate-500 dark:text-slate-400'}`}>
                      {courseMasteryInfo.nextTier ? (
                        <>
                          Cần <strong className={isCourseFonty ? 'text-white' : 'text-slate-700 dark:text-slate-200'}>{courseMasteryInfo.xpNeededForNext.toLocaleString()} EXP</strong> để lên {courseMasteryInfo.nextTier.icon} {courseMasteryInfo.nextTier.title}
                        </>
                      ) : courseMasteryInfo.mythicStage ? (
                        courseMasteryInfo.mythicStage.nextStageXP ? (
                          <span>
                            Cần <strong className="text-amber-500 dark:text-amber-400 font-bold">{(courseMasteryInfo.mythicStage.nextStageXP - (courseDetail.mastery_points || 0)).toLocaleString()} EXP</strong> thăng lên Tầng {courseMasteryInfo.mythicStage.stage + 1}
                          </span>
                        ) : (
                          <span className="text-amber-400 font-bold">★ Cảnh giới Thần Tối Thượng Vĩnh Hằng!</span>
                        )
                      ) : (
                        <span className="text-amber-400 font-bold">★ Cảnh giới Tối thượng Vĩnh cửu!</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* EXP Progress Bar */}
                <div className="mt-3 relative z-10">
                  <div className="flex items-center justify-between text-[11px] mb-1 font-mono">
                    <span className={isCourseFonty ? 'text-white/80' : 'text-slate-600 dark:text-slate-400'}>
                      {courseMasteryInfo.mythicStage
                        ? `Tiến độ ${courseMasteryInfo.mythicStage.stageTitle}: ${courseMasteryInfo.mythicStage.stageProgressPercent}%`
                        : `Tiến độ Cày cuốc: ${courseMasteryInfo.progressPercent}%`}
                    </span>
                    <span className={isCourseFonty ? 'text-white/80' : 'text-slate-600 dark:text-slate-400'}>
                      {courseMasteryInfo.nextTier
                        ? `${courseMasteryInfo.xpInCurrentTier.toLocaleString()} / ${(courseMasteryInfo.nextTier.min_xp - courseMasteryInfo.currentTier.min_xp).toLocaleString()} EXP`
                        : courseMasteryInfo.mythicStage
                        ? courseMasteryInfo.mythicStage.nextStageXP
                          ? `${(courseMasteryInfo.mythicStage.surplusXP).toLocaleString()} / ${(courseMasteryInfo.mythicStage.nextStageXP - 60000).toLocaleString()} EXP Thần Cảnh`
                          : '★ Đỉnh Phong Cảnh Giới Tối Cao'
                        : 'Đỉnh cao Thần Vương'}
                    </span>
                  </div>
                  <div className={`w-full h-2.5 rounded-full overflow-hidden ${isCourseFonty ? 'bg-white/20' : 'bg-slate-200 dark:bg-slate-800'}`}>
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${
                        courseMasteryInfo.currentTier.level === 11
                          ? 'bg-gradient-to-r from-amber-400 via-rose-500 via-purple-500 to-cyan-400 animate-pulse'
                          : courseMasteryInfo.currentTier.level >= 9
                          ? 'bg-gradient-to-r from-amber-400 via-rose-500 to-purple-500 animate-pulse'
                          : 'bg-gradient-to-r from-amber-500 to-indigo-500'
                      }`}
                      style={{ width: `${courseMasteryInfo.mythicStage ? courseMasteryInfo.mythicStage.stageProgressPercent : courseMasteryInfo.progressPercent}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* SWISS STYLE GAUGE INDICATOR */}
          {courseCoverStyle === 'SWISS' && (
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">Phong cách tối giản Thụy Sĩ</span>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Tiến độ bài học: {courseDetail.completed_nodes_count} / {courseDetail.total_nodes_count} mục hoàn thành ({courseCoverConfig.swiss_direction === 'COUNTER_CLOCKWISE' ? '↺ Ngược chiều kim đồng hồ' : '↻ Theo chiều kim đồng hồ'})
                </p>
              </div>
              <div className="relative w-12 h-12 shrink-0 flex items-center justify-center">
                <svg className={`w-12 h-12 ${courseCoverConfig.swiss_direction === 'COUNTER_CLOCKWISE' ? '-rotate-90 scale-x-[-1]' : '-rotate-90'}`} viewBox="0 0 36 36">
                  <path
                    className="text-slate-200 dark:text-slate-700"
                    strokeWidth="3.5"
                    stroke="currentColor"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                  <path
                    style={{ stroke: courseDetail.color || '#10b981' }}
                    strokeWidth="3.5"
                    strokeDasharray={`${courseDetail.overall_progress}, 100`}
                    strokeLinecap="round"
                    stroke="currentColor"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                </svg>
                <span className="absolute text-[10px] font-bold font-mono text-slate-800 dark:text-slate-200">
                  {courseDetail.overall_progress}%
                </span>
              </div>
            </div>
          )}

          {/* GRID STYLE MATRIX INDICATOR */}
          {courseCoverStyle === 'GRID' && courseDetail.total_nodes_count > 0 && (
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
                <span className="flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-indigo-500" />
                  <span>Lưới Ma trận Bài học ({courseDetail.completed_nodes_count}/{courseDetail.total_nodes_count} hoàn thành - {courseCoverConfig.grid_shape === 'SQUARE' ? 'Hình vuông' : 'Hình tròn'} / {courseCoverConfig.grid_fill === 'OUTLINE' ? 'Viền' : 'Đầy'})</span>
                </span>
                <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">{courseDetail.overall_progress}%</span>
              </div>
              <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-1">
                {Array.from({ length: Math.min(courseDetail.total_nodes_count, 120) }).map((_, idx) => {
                  const isCompleted = idx < courseDetail.completed_nodes_count;
                  const shapeClass = courseCoverConfig.grid_shape === 'SQUARE' ? 'rounded-xs' : 'rounded-full';
                  const gridFill = courseCoverConfig.grid_fill || 'FILLED';
                  const gridColor = courseCoverConfig.grid_color || courseDetail.color || '#10b981';
                  return (
                    <div
                      key={idx}
                      className={`w-3 h-3 transition-all ${shapeClass} ${
                        isCompleted
                          ? 'shadow-2xs'
                          : 'border border-slate-300 dark:border-slate-700 bg-transparent'
                      }`}
                      style={{
                        backgroundColor: isCompleted
                          ? gridFill === 'OUTLINE'
                            ? 'transparent'
                            : gridColor
                          : undefined,
                        border: isCompleted && gridFill === 'OUTLINE'
                          ? `2px solid ${gridColor}`
                          : !isCompleted
                          ? (gridColor ? `1px solid ${gridColor}40` : undefined)
                          : undefined,
                      }}
                      title={`Mục #${idx + 1}: ${isCompleted ? 'Đã hoàn thành' : 'Chưa hoàn thành'}`}
                    />
                  );
                })}
              </div>
            </div>
          )}

          {/* Progress Banner Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-neutral-50 dark:bg-neutral-800/40 p-3.5 rounded-xl border border-neutral-200 dark:border-neutral-700/60">
            <div>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-medium">Tiến độ tổng thể</span>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span className="text-2xl font-bold font-mono text-neutral-900 dark:text-neutral-100">
                  {courseDetail.overall_progress}%
                </span>
              </div>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-medium">Đã hoàn thành</span>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">
                  {courseDetail.completed_nodes_count}
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400 font-normal">mục</span>
              </div>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-medium">Còn lại</span>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span className="text-2xl font-bold text-slate-700 dark:text-slate-300">
                  {Math.max(0, courseDetail.total_nodes_count - courseDetail.completed_nodes_count)}
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400 font-normal">mục</span>
              </div>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-medium">Tổng thời lượng bài học</span>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span className="text-2xl font-bold text-neutral-900 dark:text-neutral-100 font-mono">
                  {durationHours}
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400 font-normal">giờ ({totalDurationMinutes}p)</span>
              </div>
            </div>
          </div>

          {/* Progress Bar With Color */}
          <div className="w-full bg-neutral-100 dark:bg-neutral-800 rounded-full h-3 overflow-hidden p-0.5">
            <div
              className="h-full rounded-full transition-all duration-500 shadow-xs"
              style={{
                width: `${courseDetail.overall_progress}%`,
                backgroundColor: courseDetail.color || '#10b981',
              }}
            />
          </div>
        </div>
      )}

      {/* Course Tree Explorer */}
      {courseDetail && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-neutral-900 dark:text-neutral-100" />
              <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">Cấu trúc kiến thức & Bài học</h4>
            </div>

            {/* Toolbar: Search input + Expand / Collapse all */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* Quick Search in Course */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Tìm bài học..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8 pr-3 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-neutral-900 dark:focus:ring-neutral-100 w-44 sm:w-56"
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>

              {/* Expand / Collapse All */}
              <button
                onClick={() => setIsAllExpanded(true)}
                className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-medium flex items-center gap-1 transition"
                title="Mở rộng tất cả các mục"
              >
                <ChevronsDown className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Mở rộng</span>
              </button>

              <button
                onClick={() => setIsAllExpanded(false)}
                className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-medium flex items-center gap-1 transition"
                title="Thu gọn tất cả các mục"
              >
                <ChevronsUp className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Thu gọn</span>
              </button>
            </div>
          </div>

          {courseDetail.root_nodes && (
            <CourseTree
              nodes={courseDetail.root_nodes}
              searchTerm={searchTerm}
              isAllExpanded={isAllExpanded}
              onToggleNodeStatus={handleToggleNodeStatus}
              onOpenCreateStudyTask={handleOpenEditNode}
              onEditNode={handleOpenEditNode}
              onAddChildNode={(parentPId) => {
                setParentNodeId(parentPId);
                setIsAddNodeModalOpen(true);
              }}
              onDeleteNode={handleDeleteNode}
            />
          )}
        </div>
      )}

      {/* Burnout & Sleep Analysis Modal */}
      <CourseBurnoutModal
        course={courseDetail}
        isOpen={isBurnoutModalOpen}
        onClose={() => setIsBurnoutModalOpen(false)}
      />

      {/* Edit Course Node Modal (Unified Node Editor + Smart Task Scheduler) */}
      <EditCourseNodeModal
        node={editingNode}
        isOpen={isEditNodeModalOpen}
        onClose={() => {
          setIsEditNodeModalOpen(false);
          setEditingNode(null);
        }}
        goals={goals}
        fixedSchedules={fixedSchedules}
        onSaveNode={handleSaveNode}
        onCreateTask={handleCreateStudyTask}
        onCreateEvent={handleCreateScheduleEvent}
      />

      {/* Legacy/Quick Study Task Modal */}
      <CreateStudyTaskModal
        node={nodeForTask}
        isOpen={!!nodeForTask}
        onClose={() => setNodeForTask(null)}
        goals={goals}
        onConfirm={handleCreateStudyTask}
        onCreateEvent={handleCreateScheduleEvent}
      />

      {/* Add Course Modal */}
      {isAddCourseModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
              <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base">Tạo Khóa học mới</h3>
              <button onClick={() => setIsAddCourseModalOpen(false)} className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreateCourse} className="space-y-4 mt-4 text-xs">
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">Tên khóa học *</label>
                <input
                  type="text"
                  required
                  placeholder="VD: Toán Thầy Đức, Lý Thầy Tuấn, IELTS Reading..."
                  value={newCourseTitle}
                  onChange={(e) => setNewCourseTitle(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-neutral-900 dark:focus:ring-neutral-100"
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">Giảng viên / Nguồn học</label>
                <input
                  type="text"
                  placeholder="VD: Thầy Đức / Coursera / Youtube"
                  value={newCourseInstructor}
                  onChange={(e) => setNewCourseInstructor(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-neutral-900 dark:focus:ring-neutral-100"
                />
              </div>

              {/* Countdown Target Association */}
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1 flex items-center gap-1.5">
                  <Target className="w-3.5 h-3.5 text-indigo-500" />
                  <span>Đính kèm Mục tiêu Đếm ngược (Kỳ thi / Deadline)</span>
                </label>
                <select
                  value={newCourseCountdownId || ''}
                  onChange={(e) => setNewCourseCountdownId(e.target.value ? Number(e.target.value) : undefined)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-neutral-900 dark:focus:ring-neutral-100 text-xs"
                >
                  <option value="">-- Không đính kèm mục tiêu --</option>
                  {countdowns.map((cd) => (
                    <option key={cd.id} value={cd.id}>
                      {cd.icon || '🎓'} {cd.title} (Hạn: {new Date(cd.target_date).toLocaleDateString('vi-VN')})
                    </option>
                  ))}
                </select>
              </div>

              {/* Color Palette Picker */}
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1.5 flex items-center gap-1.5">
                  <Palette className="w-3.5 h-3.5" />
                  <span>Màu sắc nhận diện khóa học</span>
                </label>
                <div className="flex items-center gap-2 flex-wrap p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60">
                  {COURSE_COLORS.map((c) => (
                    <button
                      key={c.hex}
                      type="button"
                      onClick={() => setNewCourseColor(c.hex)}
                      className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${
                        newCourseColor === c.hex
                          ? 'ring-2 ring-offset-2 ring-neutral-900 dark:ring-white scale-110 shadow-sm'
                          : 'hover:scale-105 opacity-80 hover:opacity-100'
                      }`}
                      style={{ backgroundColor: c.hex }}
                      title={c.label}
                    >
                      {newCourseColor === c.hex && <Check className="w-3.5 h-3.5 text-white" />}
                    </button>
                  ))}
                </div>
              </div>

              {/* Cover Studio Configuration */}
              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-3">
                <div className="flex items-center gap-1.5 font-bold text-slate-800 dark:text-slate-200">
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  <span>Studio Thiết kế Bìa Khóa học</span>
                </div>

                <div>
                  <label className="block text-slate-600 dark:text-slate-400 font-medium mb-1.5">
                    Phong cách bìa (Cover Style)
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {COURSE_COVER_STYLES.map((style) => (
                      <button
                        key={style.value}
                        type="button"
                        onClick={() => setNewCourseCoverStyle(style.value as any)}
                        className={`p-2.5 rounded-xl border text-left transition-all ${
                          newCourseCoverStyle === style.value
                            ? 'border-indigo-600 dark:border-indigo-400 bg-indigo-50/70 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-bold ring-1 ring-indigo-500'
                            : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 text-slate-700 dark:text-slate-300 hover:border-slate-300'
                        }`}
                      >
                        <div className="text-xs font-semibold">{style.label}</div>
                        <div className="text-[10px] text-slate-400 font-normal mt-0.5 leading-tight">{style.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Fonty 2-gradient customization */}
                {newCourseCoverStyle === 'FONTY' && (
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-3 animate-in fade-in duration-150">
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
                      Đổ dốc 2 màu (Fonty Gradients)
                    </span>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] text-slate-500 block mb-1">Màu khởi đầu (Color 1)</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={newCourseGradient1}
                            onChange={(e) => setNewCourseGradient1(e.target.value)}
                            className="w-8 h-8 rounded cursor-pointer border-0 bg-transparent shrink-0"
                          />
                          <input
                            type="text"
                            value={newCourseGradient1}
                            onChange={(e) => setNewCourseGradient1(e.target.value)}
                            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded px-2 py-1 text-xs font-mono"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-500 block mb-1">Màu kết thúc (Color 2)</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={newCourseGradient2}
                            onChange={(e) => setNewCourseGradient2(e.target.value)}
                            className="w-8 h-8 rounded cursor-pointer border-0 bg-transparent shrink-0"
                          />
                          <input
                            type="text"
                            value={newCourseGradient2}
                            onChange={(e) => setNewCourseGradient2(e.target.value)}
                            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded px-2 py-1 text-xs font-mono"
                          />
                        </div>
                      </div>
                    </div>

                    <div>
                      <span className="text-[10px] text-slate-400 block mb-1">Bộ màu gợi ý:</span>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {GRADIENT_PRESETS.map((p) => (
                          <button
                            key={p.name}
                            type="button"
                            onClick={() => {
                              setNewCourseGradient1(p.c1);
                              setNewCourseGradient2(p.c2);
                            }}
                            className="px-2 py-1 rounded text-[10px] font-medium text-white shadow-2xs transition hover:scale-105"
                            style={{ background: `linear-gradient(135deg, ${p.c1}, ${p.c2})` }}
                          >
                            {p.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Swiss Direction */}
                {newCourseCoverStyle === 'SWISS' && (
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2 animate-in fade-in duration-150">
                    <label className="text-[10px] text-slate-500 block mb-1">Hướng chạy vòng cung Thụy Sĩ</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setNewCourseSwissDirection('CLOCKWISE')}
                        className={`p-2 rounded-lg border text-xs font-semibold flex items-center justify-center gap-1.5 transition ${
                          newCourseSwissDirection === 'CLOCKWISE'
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                            : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        <span>↻ Thuận kim đồng hồ</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setNewCourseSwissDirection('COUNTER_CLOCKWISE')}
                        className={`p-2 rounded-lg border text-xs font-semibold flex items-center justify-center gap-1.5 transition ${
                          newCourseSwissDirection === 'COUNTER_CLOCKWISE'
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                            : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        <span>↺ Ngược kim đồng hồ</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Grid matrix customization */}
                {newCourseCoverStyle === 'GRID' && (
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-3 animate-in fade-in duration-150">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      <div>
                        <label className="text-[10px] text-slate-500 block mb-1">Hình dạng ô</label>
                        <div className="grid grid-cols-2 gap-1 p-0.5 rounded-lg bg-slate-100 dark:bg-slate-800">
                          <button
                            type="button"
                            onClick={() => setNewCourseGridShape('CIRCLE')}
                            className={`py-1 rounded text-xs text-center font-semibold transition ${
                              newCourseGridShape === 'CIRCLE'
                                ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-xs'
                                : 'text-slate-500'
                            }`}
                          >
                            Tròn
                          </button>
                          <button
                            type="button"
                            onClick={() => setNewCourseGridShape('SQUARE')}
                            className={`py-1 rounded text-xs text-center font-semibold transition ${
                              newCourseGridShape === 'SQUARE'
                                ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-xs'
                                : 'text-slate-500'
                            }`}
                          >
                            Vuông
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className="text-[10px] text-slate-500 block mb-1">Kiểu ô</label>
                        <div className="grid grid-cols-2 gap-1 p-0.5 rounded-lg bg-slate-100 dark:bg-slate-800">
                          <button
                            type="button"
                            onClick={() => setNewCourseGridFill('FILLED')}
                            className={`py-1 rounded text-xs text-center font-semibold transition ${
                              newCourseGridFill === 'FILLED'
                                ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-xs'
                                : 'text-slate-500'
                            }`}
                          >
                            Bọc đầy
                          </button>
                          <button
                            type="button"
                            onClick={() => setNewCourseGridFill('OUTLINE')}
                            className={`py-1 rounded text-xs text-center font-semibold transition ${
                              newCourseGridFill === 'OUTLINE'
                                ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-xs'
                                : 'text-slate-500'
                            }`}
                          >
                            Mỗi viền
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className="text-[10px] text-slate-500 block mb-1">Màu ô Grid</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={newCourseGridColor}
                            onChange={(e) => setNewCourseGridColor(e.target.value)}
                            className="w-7 h-7 rounded cursor-pointer border-0 bg-transparent shrink-0"
                          />
                          <span className="font-mono text-xs text-slate-600 dark:text-slate-400 uppercase">
                            {newCourseGridColor}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Text Alignment */}
                <div className="flex items-center justify-between">
                  <label className="text-slate-600 dark:text-slate-400 font-medium">Căn lề chữ bìa</label>
                  <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
                    <button
                      type="button"
                      onClick={() => setNewCourseAlign('left')}
                      className={`p-1.5 rounded transition ${newCourseAlign === 'left' ? 'bg-white dark:bg-slate-700 shadow-2xs text-indigo-600 dark:text-indigo-400' : 'text-slate-400 hover:text-slate-600'}`}
                      title="Căn trái"
                    >
                      <AlignLeft className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewCourseAlign('center')}
                      className={`p-1.5 rounded transition ${newCourseAlign === 'center' ? 'bg-white dark:bg-slate-700 shadow-2xs text-indigo-600 dark:text-indigo-400' : 'text-slate-400 hover:text-slate-600'}`}
                      title="Căn giữa"
                    >
                      <AlignCenter className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewCourseAlign('right')}
                      className={`p-1.5 rounded transition ${newCourseAlign === 'right' ? 'bg-white dark:bg-slate-700 shadow-2xs text-indigo-600 dark:text-indigo-400' : 'text-slate-400 hover:text-slate-600'}`}
                      title="Căn phải"
                    >
                      <AlignRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Live Preview Card */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-[11px] text-slate-500 font-medium block">
                      Xem trước bìa (Live Preview)
                    </label>
                    <span className="text-[10px] text-slate-400 font-mono">
                      Kiểu: {newCourseCoverStyle} • Lề: {newCourseAlign}
                    </span>
                  </div>

                  <div
                    className={`p-4 rounded-xl border transition-all flex flex-col justify-between min-h-[120px] ${
                      newCourseCoverStyle === 'FONTY'
                        ? 'text-white border-transparent'
                        : newCourseCoverStyle === 'SWISS'
                        ? 'bg-neutral-950 dark:bg-black text-white border-neutral-800'
                        : newCourseCoverStyle === 'GRID'
                        ? 'bg-slate-900 dark:bg-neutral-950 text-white border-slate-800'
                        : newCourseCoverStyle === 'MINIMAL'
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 border-slate-200 dark:border-slate-800'
                        : 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 border-slate-200 dark:border-slate-800'
                    } ${
                      newCourseAlign === 'center'
                        ? 'text-center items-center'
                        : newCourseAlign === 'right'
                        ? 'text-right items-end'
                        : 'text-left items-start'
                    }`}
                    style={{
                      background: newCourseCoverStyle === 'FONTY'
                        ? `linear-gradient(135deg, ${newCourseGradient1}, ${newCourseGradient2})`
                        : undefined,
                      borderColor: newCourseCoverStyle !== 'FONTY' && newCourseCoverStyle !== 'SWISS' && newCourseCoverStyle !== 'GRID' && newCourseColor
                        ? `${newCourseColor}45`
                        : undefined,
                      boxShadow: newCourseCoverStyle === 'FONTY'
                        ? `0 6px 20px -4px ${newCourseGradient1}50`
                        : newCourseCoverStyle !== 'SWISS' && newCourseCoverStyle !== 'GRID' && newCourseColor
                        ? `0 4px 16px -6px ${newCourseColor}30`
                        : undefined,
                    }}
                  >
                    {/* Top Row: Color indicator & Title */}
                    <div
                      className={`w-full flex items-center gap-2 ${
                        newCourseAlign === 'center' ? 'justify-center text-center' : newCourseAlign === 'right' ? 'justify-end text-right' : 'justify-start text-left'
                      }`}
                    >
                      <div className="w-3 h-3 rounded-full shrink-0 shadow-xs" style={{ backgroundColor: newCourseColor }} />
                      <span className={`font-bold text-sm leading-snug ${newCourseCoverStyle === 'FONTY' ? 'text-white drop-shadow-xs' : ''}`}>
                        {newCourseTitle.trim() || 'Tên khóa học demo'}
                      </span>
                    </div>

                    {/* Middle: Instructor */}
                    <div className={`text-[11px] mt-1 w-full ${newCourseCoverStyle === 'FONTY' ? 'text-white/80' : 'text-slate-500 dark:text-slate-400'} ${
                      newCourseAlign === 'center' ? 'text-center' : newCourseAlign === 'right' ? 'text-right' : 'text-left'
                    }`}>
                      {newCourseInstructor ? `GV: ${newCourseInstructor}` : 'Tự học'}
                    </div>

                    {/* Style-specific visualization */}
                    <div className="w-full mt-3 pt-2 border-t border-current/10">
                      {newCourseCoverStyle === 'SWISS' ? (
                        <div className={`flex items-center gap-3 ${
                          newCourseAlign === 'center' ? 'justify-center' : newCourseAlign === 'right' ? 'justify-end' : 'justify-start'
                        }`}>
                          <div className="relative w-10 h-10 shrink-0 flex items-center justify-center">
                            <svg
                              className={`w-10 h-10 transform ${
                                newCourseSwissDirection === 'COUNTER_CLOCKWISE' ? '-rotate-90 scale-x-[-1]' : '-rotate-90'
                              }`}
                              viewBox="0 0 36 36"
                            >
                              <circle cx="18" cy="18" r="14" stroke="rgba(255,255,255,0.2)" strokeWidth="3" fill="none" />
                              <circle cx="18" cy="18" r="14" stroke="#ffffff" strokeWidth="3" strokeDasharray="88" strokeDashoffset="35" strokeLinecap="round" fill="none" />
                            </svg>
                            <span className="absolute text-[9px] font-mono font-bold">
                              {newCourseSwissDirection === 'CLOCKWISE' ? '↻' : '↺'}
                            </span>
                          </div>
                          <div className={`text-[10px] font-mono opacity-80 ${newCourseAlign === 'center' ? 'text-center' : newCourseAlign === 'right' ? 'text-right' : 'text-left'}`}>
                            <span>Tiến độ 60%</span>
                            <span className="block text-neutral-400 text-[9px]">{newCourseSwissDirection === 'CLOCKWISE' ? 'Thuận chiều kim' : 'Ngược chiều kim'}</span>
                          </div>
                        </div>
                      ) : newCourseCoverStyle === 'GRID' ? (
                        <div className={`flex flex-col gap-1.5 ${
                          newCourseAlign === 'center' ? 'items-center' : newCourseAlign === 'right' ? 'items-end' : 'items-start'
                        }`}>
                          <div className={`flex gap-1.5 flex-wrap ${
                            newCourseAlign === 'center' ? 'justify-center' : newCourseAlign === 'right' ? 'justify-end' : 'justify-start'
                          }`}>
                            {Array.from({ length: 14 }).map((_, i) => (
                              <div
                                key={i}
                                className={`w-3 h-3 ${
                                  newCourseGridShape === 'SQUARE' ? 'rounded-xs' : 'rounded-full'
                                } ${
                                  newCourseGridFill === 'OUTLINE' ? 'border-2 bg-transparent' : ''
                                }`}
                                style={{
                                  backgroundColor: newCourseGridFill === 'FILLED' ? newCourseGridColor : 'transparent',
                                  borderColor: newCourseGridColor,
                                }}
                              />
                            ))}
                          </div>
                          <span className="text-[9px] opacity-70 font-mono">
                            Lưới {newCourseGridShape === 'SQUARE' ? 'ô vuông' : 'chấm tròn'} • {newCourseGridFill === 'FILLED' ? 'Tô đặc' : 'Mỗi viền'}
                          </span>
                        </div>
                      ) : newCourseCoverStyle === 'FONTY' ? (
                        <div className={`text-[11px] font-mono opacity-90 ${newCourseAlign === 'center' ? 'text-center' : newCourseAlign === 'right' ? 'text-right' : 'text-left'}`}>
                          <span>12 / 20 bài học • Hoàn thành 60%</span>
                        </div>
                      ) : (
                        <div className={`space-y-1.5 ${newCourseAlign === 'center' ? 'text-center' : newCourseAlign === 'right' ? 'text-right' : 'text-left'}`}>
                          <div className={`flex items-center justify-between text-[10px] text-slate-500 font-medium ${
                            newCourseAlign === 'center' ? 'justify-center gap-4' : newCourseAlign === 'right' ? 'justify-end gap-2' : ''
                          }`}>
                            <span>60% hoàn thành</span>
                            <span>12/20 bài</span>
                          </div>
                          <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
                            <div className="h-full rounded-full w-3/5" style={{ backgroundColor: newCourseColor }} />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">Ghi chú & Định hướng khóa học</label>
                <textarea
                  rows={3}
                  value={newCourseDesc}
                  onChange={(e) => setNewCourseDesc(e.target.value)}
                  placeholder="Ghi chú mục tiêu, giáo trình, syllabus hoặc các lưu ý khi học..."
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-neutral-900 dark:focus:ring-neutral-100 resize-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsAddCourseModalOpen(false)}
                >
                  Hủy
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                >
                  Tạo khóa học
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Course Modal */}
      {isEditCourseModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-neutral-900 dark:text-white" />
                <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base">Chỉnh sửa Khóa học</h3>
              </div>
              <button onClick={() => setIsEditCourseModalOpen(false)} className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleUpdateCourse} className="space-y-4 mt-4 text-xs">
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">Tên khóa học *</label>
                <input
                  type="text"
                  required
                  placeholder="VD: Toán Thầy Đức, Lý Thầy Tuấn, IELTS Reading..."
                  value={editCourseTitle}
                  onChange={(e) => setEditCourseTitle(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-neutral-900 dark:focus:ring-neutral-100"
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">Giảng viên / Nguồn học</label>
                <input
                  type="text"
                  placeholder="VD: Thầy Đức / Coursera / Youtube"
                  value={editCourseInstructor}
                  onChange={(e) => setEditCourseInstructor(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-neutral-900 dark:focus:ring-neutral-100"
                />
              </div>

              {/* Countdown Target Association */}
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1 flex items-center gap-1.5">
                  <Target className="w-3.5 h-3.5 text-indigo-500" />
                  <span>Đính kèm Mục tiêu Đếm ngược (Kỳ thi / Deadline)</span>
                </label>
                <select
                  value={editCourseCountdownId || ''}
                  onChange={(e) => setEditCourseCountdownId(e.target.value ? Number(e.target.value) : undefined)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-neutral-900 dark:focus:ring-neutral-100 text-xs"
                >
                  <option value="">-- Không đính kèm mục tiêu --</option>
                  {countdowns.map((cd) => (
                    <option key={cd.id} value={cd.id}>
                      {cd.icon || '🎓'} {cd.title} (Hạn: {new Date(cd.target_date).toLocaleDateString('vi-VN')})
                    </option>
                  ))}
                </select>
              </div>

              {/* Color Palette Picker */}
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1.5 flex items-center gap-1.5">
                  <Palette className="w-3.5 h-3.5" />
                  <span>Màu sắc nhận diện khóa học</span>
                </label>
                <div className="flex items-center gap-2 flex-wrap p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60">
                  {COURSE_COLORS.map((c) => (
                    <button
                      key={c.hex}
                      type="button"
                      onClick={() => setEditCourseColor(c.hex)}
                      className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${
                        editCourseColor === c.hex
                          ? 'ring-2 ring-offset-2 ring-neutral-900 dark:ring-white scale-110 shadow-sm'
                          : 'hover:scale-105 opacity-80 hover:opacity-100'
                      }`}
                      style={{ backgroundColor: c.hex }}
                      title={c.label}
                    >
                      {editCourseColor === c.hex && <Check className="w-3.5 h-3.5 text-white" />}
                    </button>
                  ))}
                </div>
              </div>

              {/* Cover Studio Configuration */}
              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-3">
                <div className="flex items-center gap-1.5 font-bold text-slate-800 dark:text-slate-200">
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  <span>Studio Thiết kế Bìa Khóa học</span>
                </div>

                <div>
                  <label className="block text-slate-600 dark:text-slate-400 font-medium mb-1.5">
                    Phong cách bìa (Cover Style)
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {COURSE_COVER_STYLES.map((style) => (
                      <button
                        key={style.value}
                        type="button"
                        onClick={() => setEditCourseCoverStyle(style.value as any)}
                        className={`p-2.5 rounded-xl border text-left transition-all ${
                          editCourseCoverStyle === style.value
                            ? 'border-indigo-600 dark:border-indigo-400 bg-indigo-50/70 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-bold ring-1 ring-indigo-500'
                            : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 text-slate-700 dark:text-slate-300 hover:border-slate-300'
                        }`}
                      >
                        <div className="text-xs font-semibold">{style.label}</div>
                        <div className="text-[10px] text-slate-400 font-normal mt-0.5 leading-tight">{style.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Fonty 2-gradient customization */}
                {editCourseCoverStyle === 'FONTY' && (
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-3 animate-in fade-in duration-150">
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
                      Đổ dốc 2 màu (Fonty Gradients)
                    </span>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] text-slate-500 block mb-1">Màu khởi đầu (Color 1)</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={editCourseGradient1}
                            onChange={(e) => setEditCourseGradient1(e.target.value)}
                            className="w-8 h-8 rounded cursor-pointer border-0 bg-transparent shrink-0"
                          />
                          <input
                            type="text"
                            value={editCourseGradient1}
                            onChange={(e) => setEditCourseGradient1(e.target.value)}
                            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded px-2 py-1 text-xs font-mono"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-500 block mb-1">Màu kết thúc (Color 2)</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={editCourseGradient2}
                            onChange={(e) => setEditCourseGradient2(e.target.value)}
                            className="w-8 h-8 rounded cursor-pointer border-0 bg-transparent shrink-0"
                          />
                          <input
                            type="text"
                            value={editCourseGradient2}
                            onChange={(e) => setEditCourseGradient2(e.target.value)}
                            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded px-2 py-1 text-xs font-mono"
                          />
                        </div>
                      </div>
                    </div>

                    <div>
                      <span className="text-[10px] text-slate-400 block mb-1">Bộ màu gợi ý:</span>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {GRADIENT_PRESETS.map((p) => (
                          <button
                            key={p.name}
                            type="button"
                            onClick={() => {
                              setEditCourseGradient1(p.c1);
                              setEditCourseGradient2(p.c2);
                            }}
                            className="px-2 py-1 rounded text-[10px] font-medium text-white shadow-2xs transition hover:scale-105"
                            style={{ background: `linear-gradient(135deg, ${p.c1}, ${p.c2})` }}
                          >
                            {p.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Swiss Direction */}
                {editCourseCoverStyle === 'SWISS' && (
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2 animate-in fade-in duration-150">
                    <label className="text-[10px] text-slate-500 block mb-1">Hướng chạy vòng cung Thụy Sĩ</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setEditCourseSwissDirection('CLOCKWISE')}
                        className={`p-2 rounded-lg border text-xs font-semibold flex items-center justify-center gap-1.5 transition ${
                          editCourseSwissDirection === 'CLOCKWISE'
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                            : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        <span>↻ Thuận kim đồng hồ</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditCourseSwissDirection('COUNTER_CLOCKWISE')}
                        className={`p-2 rounded-lg border text-xs font-semibold flex items-center justify-center gap-1.5 transition ${
                          editCourseSwissDirection === 'COUNTER_CLOCKWISE'
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                            : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        <span>↺ Ngược kim đồng hồ</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Grid matrix customization */}
                {editCourseCoverStyle === 'GRID' && (
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-3 animate-in fade-in duration-150">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      <div>
                        <label className="text-[10px] text-slate-500 block mb-1">Hình dạng ô</label>
                        <div className="grid grid-cols-2 gap-1 p-0.5 rounded-lg bg-slate-100 dark:bg-slate-800">
                          <button
                            type="button"
                            onClick={() => setEditCourseGridShape('CIRCLE')}
                            className={`py-1 rounded text-xs text-center font-semibold transition ${
                              editCourseGridShape === 'CIRCLE'
                                ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-xs'
                                : 'text-slate-500'
                            }`}
                          >
                            Tròn
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditCourseGridShape('SQUARE')}
                            className={`py-1 rounded text-xs text-center font-semibold transition ${
                              editCourseGridShape === 'SQUARE'
                                ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-xs'
                                : 'text-slate-500'
                            }`}
                          >
                            Vuông
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className="text-[10px] text-slate-500 block mb-1">Kiểu ô</label>
                        <div className="grid grid-cols-2 gap-1 p-0.5 rounded-lg bg-slate-100 dark:bg-slate-800">
                          <button
                            type="button"
                            onClick={() => setEditCourseGridFill('FILLED')}
                            className={`py-1 rounded text-xs text-center font-semibold transition ${
                              editCourseGridFill === 'FILLED'
                                ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-xs'
                                : 'text-slate-500'
                            }`}
                          >
                            Bọc đầy
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditCourseGridFill('OUTLINE')}
                            className={`py-1 rounded text-xs text-center font-semibold transition ${
                              editCourseGridFill === 'OUTLINE'
                                ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-xs'
                                : 'text-slate-500'
                            }`}
                          >
                            Mỗi viền
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className="text-[10px] text-slate-500 block mb-1">Màu ô Grid</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={editCourseGridColor}
                            onChange={(e) => setEditCourseGridColor(e.target.value)}
                            className="w-7 h-7 rounded cursor-pointer border-0 bg-transparent shrink-0"
                          />
                          <span className="font-mono text-xs text-slate-600 dark:text-slate-400 uppercase">
                            {editCourseGridColor}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Text Alignment */}
                <div className="flex items-center justify-between">
                  <label className="text-slate-600 dark:text-slate-400 font-medium">Căn lề chữ bìa</label>
                  <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
                    <button
                      type="button"
                      onClick={() => setEditCourseAlign('left')}
                      className={`p-1.5 rounded transition ${editCourseAlign === 'left' ? 'bg-white dark:bg-slate-700 shadow-2xs text-indigo-600 dark:text-indigo-400' : 'text-slate-400 hover:text-slate-600'}`}
                      title="Căn trái"
                    >
                      <AlignLeft className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditCourseAlign('center')}
                      className={`p-1.5 rounded transition ${editCourseAlign === 'center' ? 'bg-white dark:bg-slate-700 shadow-2xs text-indigo-600 dark:text-indigo-400' : 'text-slate-400 hover:text-slate-600'}`}
                      title="Căn giữa"
                    >
                      <AlignCenter className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditCourseAlign('right')}
                      className={`p-1.5 rounded transition ${editCourseAlign === 'right' ? 'bg-white dark:bg-slate-700 shadow-2xs text-indigo-600 dark:text-indigo-400' : 'text-slate-400 hover:text-slate-600'}`}
                      title="Căn phải"
                    >
                      <AlignRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Live Preview Card */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-[11px] text-slate-500 font-medium block">
                      Xem trước bìa (Live Preview)
                    </label>
                    <span className="text-[10px] text-slate-400 font-mono">
                      Kiểu: {editCourseCoverStyle} • Lề: {editCourseAlign}
                    </span>
                  </div>

                  <div
                    className={`p-4 rounded-xl border transition-all flex flex-col justify-between min-h-[120px] ${
                      editCourseCoverStyle === 'FONTY'
                        ? 'text-white border-transparent'
                        : editCourseCoverStyle === 'SWISS'
                        ? 'bg-neutral-950 dark:bg-black text-white border-neutral-800'
                        : editCourseCoverStyle === 'GRID'
                        ? 'bg-slate-900 dark:bg-neutral-950 text-white border-slate-800'
                        : editCourseCoverStyle === 'MINIMAL'
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 border-slate-200 dark:border-slate-800'
                        : 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 border-slate-200 dark:border-slate-800'
                    } ${
                      editCourseAlign === 'center'
                        ? 'text-center items-center'
                        : editCourseAlign === 'right'
                        ? 'text-right items-end'
                        : 'text-left items-start'
                    }`}
                    style={{
                      background: editCourseCoverStyle === 'FONTY'
                        ? `linear-gradient(135deg, ${editCourseGradient1}, ${editCourseGradient2})`
                        : undefined,
                      borderColor: editCourseCoverStyle !== 'FONTY' && editCourseCoverStyle !== 'SWISS' && editCourseCoverStyle !== 'GRID' && editCourseColor
                        ? `${editCourseColor}45`
                        : undefined,
                      boxShadow: editCourseCoverStyle === 'FONTY'
                        ? `0 6px 20px -4px ${editCourseGradient1}50`
                        : editCourseCoverStyle !== 'SWISS' && editCourseCoverStyle !== 'GRID' && editCourseColor
                        ? `0 4px 16px -6px ${editCourseColor}30`
                        : undefined,
                    }}
                  >
                    {/* Top Row: Color indicator & Title */}
                    <div
                      className={`w-full flex items-center gap-2 ${
                        editCourseAlign === 'center' ? 'justify-center text-center' : editCourseAlign === 'right' ? 'justify-end text-right' : 'justify-start text-left'
                      }`}
                    >
                      <div className="w-3 h-3 rounded-full shrink-0 shadow-xs" style={{ backgroundColor: editCourseColor }} />
                      <span className={`font-bold text-sm leading-snug ${editCourseCoverStyle === 'FONTY' ? 'text-white drop-shadow-xs' : ''}`}>
                        {editCourseTitle.trim() || 'Tên khóa học demo'}
                      </span>
                    </div>

                    {/* Middle: Instructor */}
                    <div className={`text-[11px] mt-1 w-full ${editCourseCoverStyle === 'FONTY' ? 'text-white/80' : 'text-slate-500 dark:text-slate-400'} ${
                      editCourseAlign === 'center' ? 'text-center' : editCourseAlign === 'right' ? 'text-right' : 'text-left'
                    }`}>
                      {editCourseInstructor ? `GV: ${editCourseInstructor}` : 'Tự học'}
                    </div>

                    {/* Style-specific visualization */}
                    <div className="w-full mt-3 pt-2 border-t border-current/10">
                      {editCourseCoverStyle === 'SWISS' ? (
                        <div className={`flex items-center gap-3 ${
                          editCourseAlign === 'center' ? 'justify-center' : editCourseAlign === 'right' ? 'justify-end' : 'justify-start'
                        }`}>
                          <div className="relative w-10 h-10 shrink-0 flex items-center justify-center">
                            <svg
                              className={`w-10 h-10 transform ${
                                editCourseSwissDirection === 'COUNTER_CLOCKWISE' ? '-rotate-90 scale-x-[-1]' : '-rotate-90'
                              }`}
                              viewBox="0 0 36 36"
                            >
                              <circle cx="18" cy="18" r="14" stroke="rgba(255,255,255,0.2)" strokeWidth="3" fill="none" />
                              <circle cx="18" cy="18" r="14" stroke="#ffffff" strokeWidth="3" strokeDasharray="88" strokeDashoffset="35" strokeLinecap="round" fill="none" />
                            </svg>
                            <span className="absolute text-[9px] font-mono font-bold">
                              {editCourseSwissDirection === 'CLOCKWISE' ? '↻' : '↺'}
                            </span>
                          </div>
                          <div className={`text-[10px] font-mono opacity-80 ${editCourseAlign === 'center' ? 'text-center' : editCourseAlign === 'right' ? 'text-right' : 'text-left'}`}>
                            <span>Tiến độ 60%</span>
                            <span className="block text-neutral-400 text-[9px]">{editCourseSwissDirection === 'CLOCKWISE' ? 'Thuận chiều kim' : 'Ngược chiều kim'}</span>
                          </div>
                        </div>
                      ) : editCourseCoverStyle === 'GRID' ? (
                        <div className={`flex flex-col gap-1.5 ${
                          editCourseAlign === 'center' ? 'items-center' : editCourseAlign === 'right' ? 'items-end' : 'items-start'
                        }`}>
                          <div className={`flex gap-1.5 flex-wrap ${
                            editCourseAlign === 'center' ? 'justify-center' : editCourseAlign === 'right' ? 'justify-end' : 'justify-start'
                          }`}>
                            {Array.from({ length: 14 }).map((_, i) => (
                              <div
                                key={i}
                                className={`w-3 h-3 ${
                                  editCourseGridShape === 'SQUARE' ? 'rounded-xs' : 'rounded-full'
                                } ${
                                  editCourseGridFill === 'OUTLINE' ? 'border-2 bg-transparent' : ''
                                }`}
                                style={{
                                  backgroundColor: editCourseGridFill === 'FILLED' ? editCourseGridColor : 'transparent',
                                  borderColor: editCourseGridColor,
                                }}
                              />
                            ))}
                          </div>
                          <span className="text-[9px] opacity-70 font-mono">
                            Lưới {editCourseGridShape === 'SQUARE' ? 'ô vuông' : 'chấm tròn'} • {editCourseGridFill === 'FILLED' ? 'Tô đặc' : 'Mỗi viền'}
                          </span>
                        </div>
                      ) : editCourseCoverStyle === 'FONTY' ? (
                        <div className={`text-[11px] font-mono opacity-90 ${editCourseAlign === 'center' ? 'text-center' : editCourseAlign === 'right' ? 'text-right' : 'text-left'}`}>
                          <span>12 / 20 bài học • Hoàn thành 60%</span>
                        </div>
                      ) : (
                        <div className={`space-y-1.5 ${editCourseAlign === 'center' ? 'text-center' : editCourseAlign === 'right' ? 'text-right' : 'text-left'}`}>
                          <div className={`flex items-center justify-between text-[10px] text-slate-500 font-medium ${
                            editCourseAlign === 'center' ? 'justify-center gap-4' : editCourseAlign === 'right' ? 'justify-end gap-2' : ''
                          }`}>
                            <span>60% hoàn thành</span>
                            <span>12/20 bài</span>
                          </div>
                          <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
                            <div className="h-full rounded-full w-3/5" style={{ backgroundColor: editCourseColor }} />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">Ghi chú & Định hướng khóa học</label>
                <textarea
                  rows={3}
                  value={editCourseDesc}
                  onChange={(e) => setEditCourseDesc(e.target.value)}
                  placeholder="Ghi chú mục tiêu, giáo trình, syllabus hoặc các lưu ý khi học..."
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-neutral-900 dark:focus:ring-neutral-100 resize-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsEditCourseModalOpen(false)}
                >
                  Hủy
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                >
                  Lưu thay đổi
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Node Modal */}
      {isAddNodeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
              <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base">
                {parentNodeId ? 'Thêm mục con' : 'Thêm mục gốc vào khóa học'}
              </h3>
              <button onClick={() => setIsAddNodeModalOpen(false)} className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreateNode} className="space-y-4 mt-4 text-xs">
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">Tiêu đề mục *</label>
                <input
                  type="text"
                  required
                  placeholder="VD: Chương 1: Đạo hàm, Bài 1: Khái niệm cơ bản..."
                  value={newNodeTitle}
                  onChange={(e) => setNewNodeTitle(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-neutral-900 dark:focus:ring-neutral-100"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">Loại mục</label>
                  <select
                    value={newNodeType}
                    onChange={(e) => setNewNodeType(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-neutral-900 dark:focus:ring-neutral-100"
                  >
                    <option value="SECTION">📁 Phần lớn</option>
                    <option value="CHAPTER">📑 Chương</option>
                    <option value="LESSON">📖 Bài học</option>
                    <option value="TOPIC">💡 Chủ đề</option>
                    <option value="RESOURCE">📎 Tài liệu</option>
                  </select>
                </div>
                {newNodeType === 'LESSON' ? (
                  <div>
                    <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">Thời lượng (Phút)</label>
                    <input
                      type="number"
                      value={newNodeDuration}
                      onChange={(e) => setNewNodeDuration(Number(e.target.value))}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-neutral-900 dark:focus:ring-neutral-100"
                    />
                  </div>
                ) : (
                  <div className="flex items-center text-[10px] text-slate-500 italic pt-6">
                    (Không bắt buộc thời lượng)
                  </div>
                )}
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsAddNodeModalOpen(false)}
                >
                  Hủy
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                >
                  Thêm mục
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
