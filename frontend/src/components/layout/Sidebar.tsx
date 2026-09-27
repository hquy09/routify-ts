import React from 'react';
import {
  Calendar as CalendarIcon,
  CheckSquare,
  BookOpen,
  BarChart3,
  Archive,
  Settings as SettingsIcon,
  Star,
  Plus,
  PanelLeftClose,
  PanelLeft,
  Smartphone,
  HelpCircle,
  HeartPulse,
  Award,
  Maximize2,
  Minimize2,
  Sparkles,
  FolderSync
} from 'lucide-react';
import { Button } from '../ui/button';

export type NavTab = 'dashboard' | 'calendar' | 'tasks' | 'courses' | 'wellbeing' | 'screentime' | 'archive' | 'settings';

interface SidebarProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  onOpenQuickAdd: () => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  onOpenLegend?: () => void;
  onOpenWeeklyReview?: () => void;
  onToggleFullScreen?: () => void;
  isFullScreen?: boolean;
  onOpenChangelog?: () => void;
  onOpenAutoUpdate?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  onOpenQuickAdd,
  isCollapsed = false,
  onToggleCollapse,
  onOpenLegend,
  onOpenWeeklyReview,
  onToggleFullScreen,
  isFullScreen = false,
  onOpenChangelog,
  onOpenAutoUpdate,
}) => {
  const navItems: { id: NavTab; label: string; icon: React.ReactNode }[] = [
    { id: 'dashboard', label: 'Tổng quan & Hiệu suất', icon: <BarChart3 className="w-4 h-4 shrink-0" /> },
    { id: 'calendar', label: 'Lịch biểu', icon: <CalendarIcon className="w-4 h-4 shrink-0" /> },
    { id: 'tasks', label: 'Nhiệm vụ', icon: <CheckSquare className="w-4 h-4 shrink-0" /> },
    { id: 'courses', label: 'Khóa học', icon: <BookOpen className="w-4 h-4 shrink-0" /> },
    { id: 'wellbeing', label: 'Sức khỏe tinh thần', icon: <HeartPulse className="w-4 h-4 shrink-0 text-rose-500" /> },
    { id: 'screentime', label: 'Cân bằng kỹ thuật số', icon: <Smartphone className="w-4 h-4 shrink-0" /> },
    { id: 'archive', label: 'Kho lưu trữ', icon: <Archive className="w-4 h-4 shrink-0" /> },
    { id: 'settings', label: 'Cài đặt', icon: <SettingsIcon className="w-4 h-4 shrink-0" /> },
  ];

  // ISO Week calculation for badge
  const now = new Date();
  const date = new Date(now.getTime());
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + 3 - ((date.getDay() + 6) % 7));
  const week1 = new Date(date.getFullYear(), 0, 4);
  const currentWeekNumber = 1 + Math.round(((date.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);

  return (
    <aside
      className={`${
        isCollapsed ? 'w-16' : 'w-60'
      } bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col justify-between select-none h-screen sticky top-0 transition-all duration-300 ease-in-out shrink-0 z-30 shadow-sm`}
    >
      <div className="flex-1 min-h-0 flex flex-col">
        {/* Brand Header */}
        <div
          className={`p-3.5 flex items-center ${
            isCollapsed ? 'justify-center' : 'justify-between'
          } border-b border-slate-200 dark:border-slate-800 shrink-0`}
        >
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div
              onClick={onToggleCollapse}
              className="w-8 h-8 rounded-lg bg-neutral-100 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 flex items-center justify-center shrink-0 cursor-pointer hover:bg-neutral-200 dark:hover:bg-neutral-700 transition shadow-xs relative"
              title={isCollapsed ? 'Routify • Mở rộng thanh điều hướng' : 'Thu gọn thanh điều hướng'}
            >
              <Star className="w-4 h-4 text-black stroke-black fill-white" strokeWidth={2.5} />
              {isCollapsed && (
                <span className="absolute -top-1 -right-1 flex h-2 w-2">
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500 ring-1 ring-white dark:ring-slate-900" />
                </span>
              )}
            </div>
            {!isCollapsed && (
              <div className="flex items-center gap-1.5 truncate">
                <span className="text-base font-extrabold text-slate-900 dark:text-slate-100 tracking-tight truncate">
                  Routify
                </span>
                <span className="px-1.5 py-0.5 text-[9px] font-bold tracking-wider uppercase rounded-md bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200/80 dark:border-indigo-800/80 text-indigo-600 dark:text-indigo-400 select-none shrink-0 shadow-2xs">
                  v1.2
                </span>
              </div>
            )}
          </div>

          {onToggleCollapse && !isCollapsed && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onToggleCollapse}
              title="Thu gọn thanh điều hướng"
            >
              <PanelLeftClose className="w-4 h-4" />
            </Button>
          )}
        </div>

        {/* Quick Add Button */}
        <div className="p-2.5 shrink-0">
          {isCollapsed ? (
            <Button
              variant="primary"
              size="icon"
              onClick={onOpenQuickAdd}
              title="Tạo nhiệm vụ mới"
              className="w-10 h-10 mx-auto"
            >
              <Plus className="w-5 h-5" />
            </Button>
          ) : (
            <Button
              variant="primary"
              onClick={onOpenQuickAdd}
              className="w-full justify-center"
            >
              <Plus className="w-4 h-4" />
              <span>Tạo nhiệm vụ mới</span>
            </Button>
          )}
        </div>

        {/* Nav Items (Scrollable if many tabs) */}
        <nav className="px-2 space-y-1 mt-1 flex-1 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSelectTab(item.id)}
                title={isCollapsed ? item.label : undefined}
                className={`w-full flex items-center ${
                  isCollapsed ? 'justify-center p-2.5' : 'gap-3 px-3 py-2'
                } rounded-lg text-xs font-medium transition ${
                  isActive
                    ? 'bg-neutral-900 text-white shadow-xs dark:bg-white dark:text-neutral-900 font-semibold'
                    : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:text-white dark:hover:bg-neutral-800/60'
                }`}
              >
                {item.icon}
                {!isCollapsed && <span className="truncate">{item.label}</span>}
              </button>
            );
          })}
        </nav>

        {/* ================= QUICK ACTIONS: ĐÁNH GIÁ TUẦN & TOÀN MÀN HÌNH ================= */}
        <div className="p-2 border-t border-slate-200 dark:border-slate-800 shrink-0 space-y-1">
          {!isCollapsed && (
            <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Công cụ nhanh
            </div>
          )}

          {/* Đánh giá tuần */}
          {onOpenWeeklyReview && (
            <button
              onClick={onOpenWeeklyReview}
              title={isCollapsed ? `Đánh giá tuần (Tuần ${currentWeekNumber})` : undefined}
              className={`w-full flex items-center ${
                isCollapsed ? 'justify-center p-2' : 'justify-between px-2.5 py-1.5'
              } rounded-lg text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-amber-50 hover:text-amber-700 dark:hover:bg-amber-950/30 dark:hover:text-amber-300 transition cursor-pointer border border-transparent hover:border-amber-200 dark:hover:border-amber-800/60`}
            >
              <div className="flex items-center gap-2.5">
                <Award className="w-4 h-4 text-amber-500 shrink-0" />
                {!isCollapsed && <span className="truncate">Đánh giá tuần</span>}
              </div>
              {!isCollapsed && (
                <span className="text-[10px] font-bold font-mono px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300">
                  W{currentWeekNumber}
                </span>
              )}
            </button>
          )}

          {/* Toàn màn hình */}
          {onToggleFullScreen && (
            <button
              onClick={onToggleFullScreen}
              title={isCollapsed ? (isFullScreen ? 'Thu nhỏ (ESC)' : 'Toàn màn hình') : undefined}
              className={`w-full flex items-center ${
                isCollapsed ? 'justify-center p-2' : 'justify-between px-2.5 py-1.5'
              } rounded-lg text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer border border-transparent`}
            >
              <div className="flex items-center gap-2.5">
                {isFullScreen ? (
                  <Minimize2 className="w-4 h-4 text-indigo-500 shrink-0" />
                ) : (
                  <Maximize2 className="w-4 h-4 text-slate-500 shrink-0" />
                )}
                {!isCollapsed && <span>{isFullScreen ? 'Thu nhỏ lại' : 'Toàn màn hình'}</span>}
              </div>
              {!isCollapsed && (
                <span className="text-[9px] font-mono text-slate-400">
                  {isFullScreen ? 'ESC' : 'Full'}
                </span>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Footer info & Expand toggle when collapsed */}
      <div className="p-2.5 border-t border-neutral-200 dark:border-neutral-800 shrink-0">
        {isCollapsed ? (
          <div className="flex flex-col items-center gap-2">
            <button
              onClick={onToggleCollapse}
              className="p-1.5 rounded-lg text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:text-neutral-200 dark:hover:bg-neutral-800 transition cursor-pointer"
              title="Mở rộng thanh điều hướng"
            >
              <PanelLeft className="w-4 h-4" />
            </button>

            {onOpenChangelog && (
              <button
                onClick={onOpenChangelog}
                className="w-8 h-8 rounded-lg bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-xs transition cursor-pointer"
                title="Nhật ký cập nhật (Changelog v1.2)"
              >
                <Sparkles className="w-4 h-4 text-amber-500" />
              </button>
            )}

            {onOpenAutoUpdate && (
              <button
                onClick={onOpenAutoUpdate}
                className="w-8 h-8 rounded-lg bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:hover:bg-emerald-900 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-xs transition cursor-pointer"
                title="Cập nhật từ GitHub (Auto Update)"
              >
                <FolderSync className="w-4 h-4" />
              </button>
            )}

            {onOpenLegend && (
              <button
                onClick={onOpenLegend}
                className="w-8 h-8 rounded-lg bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-200 flex items-center justify-center font-bold text-xs transition cursor-pointer"
                title="Bảng chú giải ký hiệu"
              >
                <HelpCircle className="w-4 h-4" />
              </button>
            )}

            <span
              className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"
              title="Dữ liệu nội bộ sẵn sàng"
            />
          </div>
        ) : (
          <div className="space-y-1.5">
            <div className="bg-neutral-50 border border-neutral-200 dark:bg-neutral-850 dark:border-neutral-800 rounded-lg p-2.5 flex items-center justify-between text-[11px] text-neutral-600 dark:text-neutral-400">
              <span className="flex items-center gap-1.5 font-medium">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                Dữ liệu nội bộ
              </span>

              <div className="flex items-center gap-1">
                {onOpenAutoUpdate && (
                  <button
                    onClick={onOpenAutoUpdate}
                    className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 hover:text-emerald-600 transition cursor-pointer"
                    title="Cập nhật từ GitHub (Auto Update)"
                  >
                    <FolderSync className="w-3.5 h-3.5" />
                  </button>
                )}
                {onOpenChangelog && (
                  <button
                    onClick={onOpenChangelog}
                    className="px-1.5 py-0.5 rounded bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 font-mono text-[10px] font-bold hover:bg-indigo-200 transition"
                    title="Xem nhật ký cập nhật (Changelog)"
                  >
                    v1.2
                  </button>
                )}
              </div>
            </div>

            {onOpenLegend && (
              <button
                onClick={onOpenLegend}
                className="w-full flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800/80 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300 text-xs font-medium transition cursor-pointer"
                title="Xem bảng chú giải ký hiệu và quy chuẩn"
              >
                <HelpCircle className="w-3.5 h-3.5 text-neutral-600 dark:text-neutral-400" />
                <span>Chú giải ký hiệu</span>
              </button>
            )}
          </div>
        )}
      </div>
    </aside>
  );
};
