import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  Award,
  Target,
  Flame,
  TrendingUp,
  CheckCircle2,
  AlertCircle,
  Trophy,
  Sparkles,
  Calendar,
  Layers,
  ArrowUpRight
} from 'lucide-react';
import { DailyBarChart } from '../components/dashboard/DailyBarChart';
import { ActivityHeatmap } from '../components/dashboard/ActivityHeatmap';
import { CountdownSection } from '../components/countdown/CountdownSection';
import { CountdownModal } from '../components/countdown/CountdownModal';
import { DashboardStats, HeatmapDay, BarChartItem, CountdownItem } from '../types';
import { api } from '../services/api';

export const DashboardPage: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [heatmapDays, setHeatmapDays] = useState<HeatmapDay[]>([]);
  const [chartItems, setChartItems] = useState<BarChartItem[]>([]);
  const [period, setPeriod] = useState('DAY');

  // Countdowns State
  const [countdowns, setCountdowns] = useState<CountdownItem[]>([]);
  const [isCountdownModalOpen, setIsCountdownModalOpen] = useState(false);
  const [countdownToEdit, setCountdownToEdit] = useState<CountdownItem | null>(null);

  const loadData = async () => {
    try {
      const [s, h, c, cds] = await Promise.all([
        api.dashboard.getStats(),
        api.dashboard.getHeatmap(182), // 26 weeks
        api.dashboard.getBarChart(period),
        api.countdowns.list(),
      ]);
      setStats(s);
      setHeatmapDays(h);
      setChartItems(c.items);
      setCountdowns(cds);
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    }
  };

  const handleSaveCountdown = async (data: Partial<CountdownItem>) => {
    try {
      if (countdownToEdit) {
        await api.countdowns.update(countdownToEdit.id, data);
      } else {
        await api.countdowns.create(data);
      }
      const cds = await api.countdowns.list();
      setCountdowns(cds);
    } catch (err) {
      console.error('Failed to save countdown:', err);
      throw err;
    }
  };

  const handleDeleteCountdown = async (id: number) => {
    if (!confirm('Bạn có chắc chắn muốn xóa sự kiện đếm ngược này?')) return;
    try {
      await api.countdowns.delete(id);
      const cds = await api.countdowns.list();
      setCountdowns(cds);
    } catch (err) {
      console.error('Failed to delete countdown:', err);
    }
  };

  const handleTogglePinCountdown = async (item: CountdownItem) => {
    try {
      await api.countdowns.update(item.id, { is_pinned: !item.is_pinned });
      const cds = await api.countdowns.list();
      setCountdowns(cds);
    } catch (err) {
      console.error('Failed to pin/unpin countdown:', err);
    }
  };

  useEffect(() => {
    loadData();
    const handleRefresh = () => loadData();
    window.addEventListener('lifeos_task_updated', handleRefresh);
    window.addEventListener('lifeos_schedule_updated', handleRefresh);
    return () => {
      window.removeEventListener('lifeos_task_updated', handleRefresh);
      window.removeEventListener('lifeos_schedule_updated', handleRefresh);
    };
  }, [period]);

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      {/* 1. Minimalist Top Header (Buttons moved to Left Sidebar as requested) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
            <BarChart3 className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100">
                Hiệu suất cá nhân & Phân tích
              </h2>
              <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                Real-time
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Theo dõi nhịp độ hoàn thành nhiệm vụ, tích lũy điểm năng lượng XP, streak và tiến độ mục tiêu
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 self-end sm:self-center">
          <Calendar className="w-3.5 h-3.5 text-indigo-500" />
          <span>Hôm nay: {new Date().toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit' })}</span>
        </div>
      </div>

      {/* 2. Professional 2-Column Layout (Left: Metrics Status, Right: Visual Charts) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
        
        {/* ================= LEFT COLUMN: THU GỌN CÁC TRẠNG THÁI HIỆU SUẤT ================= */}
        <div className="xl:col-span-4 space-y-4">
          
          {/* Card 1: 4 Trạng thái hiệu suất thu gọn (Đã hoàn thành, Điểm độ khó, Chuỗi, Chậm trễ) */}
          {stats && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs space-y-3.5">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                  <span>Tổng hợp chỉ số trạng thái</span>
                </span>
                <span className="text-[10px] text-slate-400">Tuần này</span>
              </div>

              {/* 1.1. Đã hoàn thành */}
              <div className="p-3 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200/70 dark:border-emerald-800/60 flex items-center justify-between">
                <div>
                  <div className="text-[11px] font-semibold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Đã hoàn thành</span>
                  </div>
                  <div className="mt-1 flex items-baseline gap-1.5">
                    <span className="text-xl font-extrabold text-slate-900 dark:text-slate-100">
                      {stats.tasks_completed}
                    </span>
                    <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">nhiệm vụ</span>
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Tỷ lệ tuần: <strong className="text-slate-800 dark:text-slate-200">{stats.completion_rate_this_week}%</strong>
                  </div>
                </div>
                <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-sm">
                  ✓
                </div>
              </div>

              {/* 1.2. Điểm nỗ lực & Điểm độ khó (XP) */}
              <div className="p-3 rounded-xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/70 dark:border-amber-800/60 flex items-center justify-between">
                <div>
                  <div className="text-[11px] font-semibold text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                    <Flame className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                    <span>Điểm nỗ lực & Độ khó</span>
                  </div>
                  <div className="mt-1 flex items-baseline gap-1.5">
                    <span className="text-xl font-extrabold text-amber-600 dark:text-amber-400">
                      +{stats.total_difficulty_points}
                    </span>
                    <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">XP</span>
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Tích lũy từ độ khó các bài tập
                  </div>
                </div>
                <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold text-sm">
                  ⚡
                </div>
              </div>

              {/* 1.3. Chuỗi ngày liên tiếp (Streak) */}
              <div className="p-3 rounded-xl bg-orange-50/60 dark:bg-orange-950/20 border border-orange-200/70 dark:border-orange-800/60 flex items-center justify-between">
                <div>
                  <div className="text-[11px] font-semibold text-orange-800 dark:text-orange-300 flex items-center gap-1.5">
                    <Trophy className="w-3.5 h-3.5 text-orange-500" />
                    <span>Chuỗi ngày liên tiếp</span>
                  </div>
                  <div className="mt-1 flex items-baseline gap-1.5">
                    <span className="text-xl font-extrabold text-orange-600 dark:text-orange-400">
                      {stats.current_streak}
                    </span>
                    <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">ngày</span>
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Kỷ lục cao nhất: <strong className="text-slate-800 dark:text-slate-200">{stats.best_streak} ngày 🔥</strong>
                  </div>
                </div>
                <div className="w-10 h-10 rounded-xl bg-orange-100 dark:bg-orange-900/40 text-orange-600 dark:text-orange-400 flex items-center justify-center font-bold text-sm">
                  🔥
                </div>
              </div>

              {/* 1.4. Chậm trễ & Cần chú ý */}
              <div className="p-3 rounded-xl bg-rose-50/60 dark:bg-rose-950/20 border border-rose-200/70 dark:border-rose-800/60 flex items-center justify-between">
                <div>
                  <div className="text-[11px] font-semibold text-rose-800 dark:text-rose-300 flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 text-rose-500" />
                    <span>Chậm trễ & Cần chú ý</span>
                  </div>
                  <div className="mt-1 flex items-baseline gap-2.5">
                    <div>
                      <span className="text-lg font-bold text-rose-600 dark:text-rose-400">{stats.tasks_delayed}</span>
                      <span className="text-[10px] text-slate-500 ml-1">trễ</span>
                    </div>
                    <div className="h-3 w-px bg-rose-200 dark:border-rose-800" />
                    <div>
                      <span className="text-lg font-bold text-amber-600 dark:text-amber-400">{stats.tasks_partial}</span>
                      <span className="text-[10px] text-slate-500 ml-1">một phần</span>
                    </div>
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Chưa xong: <strong className="text-slate-800 dark:text-slate-200">{stats.tasks_incomplete} nhiệm vụ</strong>
                  </div>
                </div>
                <div className="w-10 h-10 rounded-xl bg-rose-100 dark:bg-rose-900/40 text-rose-600 dark:text-rose-400 flex items-center justify-center font-bold text-sm">
                  ⚠️
                </div>
              </div>
            </div>
          )}

          {/* Card 2: Tiến độ Mục tiêu & Dự án (ĐẨY LÊN TRÊN THEO YÊU CẦU NGƯỜI DÙNG) */}
          {stats && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs space-y-3">
              <div className="flex items-center justify-between pb-1 border-b border-slate-100 dark:border-slate-800">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                  <Target className="w-3.5 h-3.5 text-amber-500" />
                  <span>Mục tiêu & Dự án quan trọng</span>
                </span>
                <span className="text-[10px] text-slate-400">{stats.goals.length} mục tiêu</span>
              </div>

              {stats.goals.length === 0 ? (
                <p className="text-[11px] text-slate-400 text-center py-2 italic">
                  Chưa có dữ liệu mục tiêu. Hãy tạo mục tiêu ở tab Nhiệm vụ.
                </p>
              ) : (
                <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
                  {stats.goals.slice(0, 5).map((g) => (
                    <div key={g.goal_id} className="p-2 rounded-xl bg-slate-50 dark:bg-slate-850/60 border border-slate-200/80 dark:border-slate-800 space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-800 dark:text-slate-200 truncate pr-2">
                          {g.title}
                        </span>
                        <span className="text-xs font-mono font-bold text-indigo-600 dark:text-indigo-400 shrink-0">
                          {g.completion_rate}%
                        </span>
                      </div>
                      <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-1.5 overflow-hidden">
                        <div
                          className="bg-indigo-600 dark:bg-indigo-400 h-full rounded-full transition-all"
                          style={{ width: `${g.completion_rate}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-[10px] text-slate-400">
                        <span>{g.category || 'Mục tiêu'}</span>
                        <span>{g.completed_tasks}/{g.total_tasks} hoàn thành</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Card 3: Tỷ lệ hoàn thành theo chu kỳ (Hôm nay, Tuần này, Tháng này) */}
          {stats && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs space-y-3">
              <div className="flex items-center justify-between pb-1 border-b border-slate-100 dark:border-slate-800">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Tỷ lệ hoàn thành theo chu kỳ</span>
                </span>
              </div>

              {/* Hôm nay */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-600 dark:text-slate-400">Hôm nay</span>
                  <span className="font-bold text-slate-900 dark:text-slate-100 font-mono">
                    {stats.completion_rate_today}%
                  </span>
                </div>
                <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-indigo-600 dark:bg-indigo-500 h-full rounded-full transition-all duration-500"
                    style={{ width: `${stats.completion_rate_today}%` }}
                  />
                </div>
              </div>

              {/* Tuần này */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-600 dark:text-slate-400">Tuần này</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                    {stats.completion_rate_this_week}%
                  </span>
                </div>
                <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                    style={{ width: `${stats.completion_rate_this_week}%` }}
                  />
                </div>
              </div>

              {/* Tháng này */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-600 dark:text-slate-400">Tháng này</span>
                  <span className="font-bold text-sky-600 dark:text-sky-400 font-mono">
                    {stats.completion_rate_this_month}%
                  </span>
                </div>
                <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-sky-500 h-full rounded-full transition-all duration-500"
                    style={{ width: `${stats.completion_rate_this_month}%` }}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ================= RIGHT COLUMN: MỤC TIÊU & ĐẾM NGƯỢC LÊN ĐẦU, TIẾP ĐẾN LÀ BIỂU ĐỒ & HEATMAP ================= */}
        <div className="xl:col-span-8 space-y-5">
          
          {/* 1. Phân bổ mục tiêu & sự kiện đếm ngược (ĐẨY LÊN ĐẦU THEO YÊU CẦU NGƯỜI DÙNG) */}
          <CountdownSection
            countdowns={countdowns}
            onOpenCreate={() => {
              setCountdownToEdit(null);
              setIsCountdownModalOpen(true);
            }}
            onOpenEdit={(item) => {
              setCountdownToEdit(item);
              setIsCountdownModalOpen(true);
            }}
            onDelete={handleDeleteCountdown}
            onTogglePin={handleTogglePinCountdown}
          />

          {/* 2. Biểu đồ cột năng suất theo thời gian (DailyBarChart) */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
            <DailyBarChart
              items={chartItems}
              period={period}
              onChangePeriod={(p) => setPeriod(p)}
            />
          </div>

          {/* 3. Bản đồ nhiệt hoạt động đóng góp (ActivityHeatmap) */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
            <ActivityHeatmap days={heatmapDays} />
          </div>
        </div>
      </div>

      {/* Countdown Create / Edit Modal */}
      <CountdownModal
        isOpen={isCountdownModalOpen}
        onClose={() => {
          setIsCountdownModalOpen(false);
          setCountdownToEdit(null);
        }}
        onSave={handleSaveCountdown}
        countdownToEdit={countdownToEdit}
      />
    </div>
  );
};
