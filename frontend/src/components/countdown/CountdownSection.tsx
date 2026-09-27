import React, { useState, useEffect } from 'react';
import {
  Calendar as CalendarIcon, Clock, Plus, Edit2, Trash2, Pin,
  Award, Sparkles, CheckCircle2, ChevronRight, RotateCcw, RotateCw, LayoutGrid
} from 'lucide-react';
import { CountdownItem } from '../../types';
import { Button } from '../ui/button';
import { isLightColor, getReadableColorOnLight } from '../../utils/colorUtils';

interface CountdownSectionProps {
  countdowns: CountdownItem[];
  onOpenCreate: () => void;
  onOpenEdit: (item: CountdownItem) => void;
  onDelete: (id: number) => Promise<void>;
  onTogglePin: (item: CountdownItem) => Promise<void>;
}

const pad = (n: number) => String(n).padStart(2, '0');

function getTimeDiff(targetIso: string) {
  const targetDate = new Date(targetIso);
  const now = new Date();
  const diffMs = targetDate.getTime() - now.getTime();

  if (diffMs <= 0) {
    return {
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
      isPast: true,
      text: 'Đã diễn ra',
      totalSeconds: 0,
    };
  }

  const totalSecs = Math.floor(diffMs / 1000);
  const days = Math.floor(totalSecs / 86400);
  const hours = Math.floor((totalSecs % 86400) / 3600);
  const minutes = Math.floor((totalSecs % 3600) / 60);
  const seconds = totalSecs % 60;

  let text = '';
  if (days > 0) {
    text = `Còn ${days} ngày ${hours}h`;
  } else if (hours > 0) {
    text = `Còn ${hours} giờ ${minutes}p`;
  } else {
    text = `Còn ${minutes} phút ${seconds}s`;
  }

  return { days, hours, minutes, seconds, isPast: false, text, totalSeconds: totalSecs };
}

function calculateProgressStats(targetDateIso: string, createdAtIso?: string, now: Date = new Date()) {
  const targetMs = new Date(targetDateIso).getTime();
  const nowMs = now.getTime();

  if (targetMs <= nowMs) {
    return {
      remainingPct: 0,
      elapsedPct: 100,
      totalDays: 0,
      formattedRemaining: '0%',
      formattedElapsed: '100%',
    };
  }

  let createdMs = createdAtIso ? new Date(createdAtIso).getTime() : 0;
  if (!createdMs || isNaN(createdMs) || createdMs >= targetMs) {
    createdMs = targetMs - (30 * 86400 * 1000);
  }

  if (createdMs > nowMs) {
    createdMs = nowMs;
  }

  const totalDurationMs = Math.max(targetMs - createdMs, 60 * 1000);
  const remainingMs = Math.max(0, targetMs - nowMs);
  const rawRemainingPct = (remainingMs / totalDurationMs) * 100;
  const remainingPct = Math.min(100, Math.max(0, rawRemainingPct));
  const elapsedPct = Math.min(100, Math.max(0, 100 - remainingPct));

  let formattedRemaining: string;
  if (remainingPct >= 99.9 && remainingPct < 100) {
    formattedRemaining = '99.9%';
  } else if (remainingPct > 0 && remainingPct <= 0.1) {
    formattedRemaining = '0.1%';
  } else {
    formattedRemaining = `${remainingPct.toFixed(1)}%`;
  }

  let formattedElapsed: string;
  if (elapsedPct >= 99.9 && elapsedPct < 100) {
    formattedElapsed = '99.9%';
  } else if (elapsedPct > 0 && elapsedPct <= 0.1) {
    formattedElapsed = '0.1%';
  } else {
    formattedElapsed = `${elapsedPct.toFixed(1)}%`;
  }

  const totalDays = Math.max(1, Math.ceil(totalDurationMs / (86400 * 1000)));

  return {
    remainingPct,
    elapsedPct,
    totalDays,
    formattedRemaining,
    formattedElapsed,
  };
}

export const CountdownSection: React.FC<CountdownSectionProps> = ({
  countdowns,
  onOpenCreate,
  onOpenEdit,
  onDelete,
  onTogglePin,
}) => {
  const [now, setNow] = useState(new Date());

  // Ticking timer every second
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  if (countdowns.length === 0) {
    return (
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-6 shadow-xs text-center space-y-3">
        <div className="w-12 h-12 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center mx-auto text-2xl">
          🎓
        </div>
        <div>
          <h3 className="font-bold text-neutral-900 dark:text-neutral-100 text-sm">
            Đếm ngược Ngày thi & Mục tiêu
          </h3>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 max-w-sm mx-auto">
            Tạo động lực học tập mỗi ngày bằng cách cài đặt ngày thi tốt nghiệp, thi chứng chỉ, hoặc mục tiêu cá nhân.
          </p>
        </div>
        <Button variant="primary" onClick={onOpenCreate}>
          <Plus className="w-4 h-4" />
          <span>Thêm ngày thi / mục tiêu đầu tiên</span>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-neutral-900 dark:text-neutral-100" />
          <h3 className="font-bold text-neutral-900 dark:text-neutral-100 text-sm">
            Đếm ngược Ngày thi & Sự kiện ({countdowns.length})
          </h3>
        </div>
        <Button variant="outline" onClick={onOpenCreate}>
          <Plus className="w-3.5 h-3.5" />
          <span>Thêm mới</span>
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {countdowns.map((item) => {
          const diff = getTimeDiff(item.target_date);
          const targetD = new Date(item.target_date);
          const formattedDate = `${pad(targetD.getDate())}/${pad(targetD.getMonth() + 1)}/${targetD.getFullYear()}`;
          const progressStats = calculateProgressStats(item.target_date, item.created_at, now);

          // Custom color styling
          const itemColor = item.color && item.color.startsWith('#') ? item.color : '#000000';
          const isCustomColor = itemColor.toLowerCase() !== '#000000' && itemColor.toLowerCase() !== '#171717';
          const mode = item.display_mode || 'CIRCULAR';

          // Cover Studio properties
          let coverConfig: any = {};
          if (item.cover_config) {
            try {
              coverConfig = typeof item.cover_config === 'string' ? JSON.parse(item.cover_config) : item.cover_config;
            } catch {}
          }
          const coverStyle = item.cover_style || 'DEFAULT';
          const isFonty = coverStyle === 'FONTY';
          const isSwiss = coverStyle === 'SWISS';
          const isCounterClockwise = isSwiss && coverConfig.swiss_direction === 'COUNTER_CLOCKWISE';
          const isGridStyle = coverStyle === 'GRID';
          const gridShape = coverConfig.grid_shape || 'CIRCLE';
          const gridFill = coverConfig.grid_fill || 'FILLED';
          const gridColor = coverConfig.grid_color || itemColor;
          const textAlign = coverConfig.align || 'left';
          const detailMode = coverConfig.detail_mode || 'SIMPLE';

          const gradientColor1 = coverConfig.gradient_color1 || '#4f46e5';
          const gradientColor2 = coverConfig.gradient_color2 || '#ec4899';

          // Circular gauge params
          const circleR = 26;
          const circleCircumference = 2 * Math.PI * circleR; // ~163.36
          const strokeOffset = circleCircumference - (progressStats.remainingPct / 100) * circleCircumference;

          // Alignment helpers
          const alignContainerClass =
            textAlign === 'center'
              ? 'text-center items-center'
              : textAlign === 'right'
              ? 'text-right items-end'
              : 'text-left items-start';

          const alignFlexJustify =
            textAlign === 'center'
              ? 'justify-center'
              : textAlign === 'right'
              ? 'justify-end'
              : 'justify-start';

          const alignTextClass =
            textAlign === 'center'
              ? 'text-center'
              : textAlign === 'right'
              ? 'text-right'
              : 'text-left';

          return (
            <div key={item.id} className="relative group">
              {/* Pinned Goal Continuous Surrounding Aura / Halo */}
              {item.is_pinned && (
                <div
                  className="absolute -inset-1 sm:-inset-1.5 rounded-3xl bg-gradient-to-r from-amber-400 via-orange-400 to-yellow-300 opacity-75 blur-md animate-pinned-aura pointer-events-none z-0"
                  aria-hidden="true"
                />
              )}

              <div
                className={`rounded-2xl border p-4 transition-all shadow-xs flex flex-col justify-between relative overflow-hidden h-full z-10 ${
                  isFonty
                    ? 'text-white border-transparent shadow-md'
                    : isSwiss
                    ? 'bg-neutral-950 dark:bg-black text-white border-neutral-800 shadow-md'
                    : isGridStyle
                    ? 'bg-neutral-900 dark:bg-neutral-950 text-white border-neutral-800 shadow-md'
                    : coverStyle === 'MINIMAL'
                    ? 'bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 text-neutral-900 dark:text-neutral-100'
                    : 'bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 text-neutral-900 dark:text-neutral-100'
                } ${
                  item.is_pinned
                    ? 'ring-2 ring-amber-400 shadow-[0_0_25px_rgba(251,191,36,0.35)] dark:shadow-[0_0_35px_rgba(251,191,36,0.45)]'
                    : ''
                }`}
              style={{
                background: isFonty
                  ? `linear-gradient(135deg, ${gradientColor1}, ${gradientColor2})`
                  : undefined,
                borderColor: item.is_pinned
                  ? 'rgba(251, 191, 36, 0.65)'
                  : !isFonty && !isSwiss && !isGridStyle && isCustomColor
                  ? `${itemColor}45`
                  : undefined,
                boxShadow: isFonty
                  ? `0 8px 24px -4px ${gradientColor1}50`
                  : item.is_pinned
                  ? '0 6px 20px -4px rgba(251, 191, 36, 0.25)'
                  : !isFonty && !isSwiss && !isGridStyle && isCustomColor
                  ? `0 4px 20px -8px ${itemColor}25`
                  : undefined,
              }}
            >
              {/* Pinned Top Golden Accent Line */}
              {item.is_pinned && (
                <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500 z-20 pointer-events-none" />
              )}

              {/* Ambient color glow */}
              {!isFonty && !isSwiss && !isGridStyle && isCustomColor && (
                <div
                  className="absolute -top-10 -right-10 w-28 h-28 rounded-full blur-2xl pointer-events-none opacity-30"
                  style={{ backgroundColor: itemColor }}
                />
              )}

              {/* Top Row: Icon, Category Tag, Pinned Badge, Title, Action Buttons */}
              <div className="relative z-10 w-full">
                <div className="flex items-start justify-between gap-2">
                  <div className={`flex items-center gap-2 flex-1 min-w-0 ${alignFlexJustify}`}>
                    <span className="text-xl shrink-0">{item.icon || '🎓'}</span>
                    <div className={`min-w-0 flex-1 ${alignTextClass}`}>
                      <div className={`flex items-center gap-1.5 flex-wrap ${alignFlexJustify}`}>
                        {/* Category tag */}
                        <span
                          className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full transition-all ${
                            isFonty
                              ? 'bg-white/20 text-white'
                              : isSwiss || isGridStyle
                              ? 'bg-white/10 text-white/90 border border-white/20'
                              : isCustomColor
                              ? ''
                              : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400'
                          }`}
                          style={
                            !isFonty && !isSwiss && !isGridStyle && isCustomColor
                              ? {
                                  backgroundColor: `${itemColor}15`,
                                  color: isLightColor(itemColor) ? getReadableColorOnLight(itemColor) : itemColor,
                                  border: `1px solid ${itemColor}35`,
                                }
                              : undefined
                          }
                        >
                          {item.category === 'EXAM' ? 'Ngày thi' : item.category === 'GOAL' ? 'Mục tiêu' : item.category === 'EVENT' ? 'Sự kiện' : 'Khác'}
                        </span>

                        {/* Pinned tag */}
                        {item.is_pinned && (
                          <span className="inline-flex items-center gap-1 text-[9px] font-black px-2 py-0.5 rounded-full bg-amber-400 text-neutral-950 border border-amber-300 shadow-2xs font-mono">
                            <Pin className="w-2.5 h-2.5 fill-neutral-950 text-neutral-950" />
                            <span>ĐÃ GHIM</span>
                          </span>
                        )}
                      </div>
                      <h4 className={`font-extrabold text-sm mt-1 truncate leading-snug tracking-tight ${isFonty ? 'text-white' : ''} ${alignTextClass}`}>
                        {item.title}
                      </h4>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0 ml-1">
                    <button
                      type="button"
                      onClick={() => onTogglePin(item)}
                      className={`p-1 rounded transition ${item.is_pinned ? 'text-amber-400 scale-110' : isFonty || isSwiss || isGridStyle ? 'text-white/60 hover:text-white' : 'text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200'}`}
                      title={item.is_pinned ? 'Bỏ ghim' : 'Ghim lên đầu'}
                    >
                      <Pin className={`w-3.5 h-3.5 ${item.is_pinned ? 'fill-amber-400 text-amber-400' : ''}`} />
                    </button>
                    <button
                      type="button"
                      onClick={() => onOpenEdit(item)}
                      className={`p-1 rounded transition ${isFonty || isSwiss || isGridStyle ? 'text-white/60 hover:text-white' : 'text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200'}`}
                      title="Chỉnh sửa"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(item.id)}
                      className={`p-1 rounded transition ${isFonty || isSwiss || isGridStyle ? 'text-white/60 hover:text-rose-300' : 'text-neutral-400 hover:text-rose-600'}`}
                      title="Xóa đếm ngược"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Main Countdown Body based on coverStyle & detailMode */}
              <div className={`mt-3 mb-2 w-full flex flex-col ${alignContainerClass}`}>
                {diff.isPast ? (
                  <div className="text-xs font-bold py-1.5 px-3 rounded-lg bg-neutral-100 dark:bg-neutral-800 text-neutral-500">
                    🎉 Đã diễn ra ({formattedDate})
                  </div>
                ) : isFonty ? (
                  /* --- 1. FONTY TYPO STYLE --- */
                  detailMode === 'SIMPLE' ? (
                    <div className={`flex flex-col py-1 ${alignContainerClass}`}>
                      <div className={`text-5xl font-black font-mono tracking-tight drop-shadow-md leading-none ${
                        isLightColor(gradientColor1) && isLightColor(gradientColor2) ? 'text-neutral-950' : 'text-white'
                      }`}>
                        {diff.days}
                      </div>
                      <div className={`text-[11px] font-bold uppercase tracking-widest mt-1 ${
                        isLightColor(gradientColor1) && isLightColor(gradientColor2) ? 'text-neutral-900/80' : 'text-white/90'
                      }`}>
                        NGÀY CÒN LẠI
                      </div>
                      <div className={`mt-2 inline-flex items-center gap-1.5 text-[10px] font-mono px-2.5 py-0.5 rounded-full backdrop-blur-xs ${
                        isLightColor(gradientColor1) && isLightColor(gradientColor2) ? 'bg-black/10 text-neutral-950' : 'bg-white/20 text-white'
                      }`}>
                        <span>⏳ Còn: {progressStats.formattedRemaining}</span>
                      </div>
                    </div>
                  ) : (
                    <div className={`flex flex-col gap-1.5 py-1 ${alignContainerClass}`}>
                      <div className={`flex items-center gap-1.5 font-mono font-black text-sm sm:text-base ${
                        isLightColor(gradientColor1) && isLightColor(gradientColor2) ? 'text-neutral-950' : 'text-white'
                      }`}>
                        <span className={`px-2 py-1 rounded-md ${
                          isLightColor(gradientColor1) && isLightColor(gradientColor2) ? 'bg-black/10 text-neutral-950' : 'bg-white/20 text-white'
                        }`}>{diff.days}d</span>
                        <span>:</span>
                        <span className={`px-2 py-1 rounded-md ${
                          isLightColor(gradientColor1) && isLightColor(gradientColor2) ? 'bg-black/10 text-neutral-950' : 'bg-white/20 text-white'
                        }`}>{pad(diff.hours)}h</span>
                        <span>:</span>
                        <span className={`px-2 py-1 rounded-md ${
                          isLightColor(gradientColor1) && isLightColor(gradientColor2) ? 'bg-black/10 text-neutral-950' : 'bg-white/20 text-white'
                        }`}>{pad(diff.minutes)}m</span>
                        <span>:</span>
                        <span className={`px-2 py-1 rounded-md ${
                          isLightColor(gradientColor1) && isLightColor(gradientColor2) ? 'bg-black/10 text-neutral-950' : 'bg-white/20 text-white'
                        }`}>{pad(diff.seconds)}s</span>
                      </div>
                      <div className={`text-[10px] mt-0.5 ${
                        isLightColor(gradientColor1) && isLightColor(gradientColor2) ? 'text-neutral-800' : 'text-white/80'
                      }`}>
                        ⏳ Còn lại {progressStats.formattedRemaining} • Đã qua {progressStats.formattedElapsed}
                      </div>
                    </div>
                  )
                ) : isSwiss ? (
                  /* --- 2. SWISS STYLE --- */
                  <div className={`flex items-center gap-3 py-1 ${alignFlexJustify}`}>
                    {/* Directional Circular SVG Gauge */}
                    <div className="relative w-14 h-14 shrink-0 flex items-center justify-center">
                      <svg
                        className={`w-14 h-14 transform ${
                          isCounterClockwise ? '-rotate-90 scale-x-[-1]' : '-rotate-90'
                        }`}
                        viewBox="0 0 60 60"
                      >
                        <circle cx="30" cy="30" r={circleR} stroke="rgba(255,255,255,0.15)" strokeWidth="4" fill="none" />
                        <circle
                          cx="30"
                          cy="30"
                          r={circleR}
                          stroke="#ffffff"
                          strokeWidth="4"
                          strokeDasharray={circleCircumference}
                          strokeDashoffset={strokeOffset}
                          strokeLinecap="round"
                          fill="none"
                          className="transition-all duration-700"
                        />
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center font-mono text-[10px] font-bold text-neutral-400">
                        {isCounterClockwise ? '↺' : '↻'}
                      </div>
                    </div>

                    <div className={`flex flex-col ${alignContainerClass}`}>
                      {detailMode === 'SIMPLE' ? (
                        <>
                          <div className="text-3xl font-black font-mono leading-none">
                            {diff.days}<span className="text-xs font-sans font-medium text-neutral-400 ml-1">ngày</span>
                          </div>
                          <div className="text-[10px] uppercase tracking-widest text-neutral-400 mt-1">
                            {isCounterClockwise ? '↺ Ngược chiều kim' : '↻ Thuận chiều kim'} • Còn {progressStats.formattedRemaining}
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="font-mono text-sm font-bold leading-tight">
                            {diff.days}d {pad(diff.hours)}h {pad(diff.minutes)}m {pad(diff.seconds)}s
                          </div>
                          <div className="text-[10px] uppercase tracking-widest text-neutral-400 mt-1">
                            {isCounterClockwise ? '↺ Swiss Ngược' : '↻ Swiss Thuận'} • {progressStats.formattedRemaining}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                ) : isGridStyle ? (
                  /* --- 3. GRID MATRIX STYLE --- */
                  <div className={`space-y-2 py-1 w-full flex flex-col ${alignContainerClass}`}>
                    {detailMode === 'SIMPLE' ? (
                      <div className="font-mono text-2xl font-black leading-none">
                        {diff.days} <span className="text-xs font-sans font-medium opacity-70">ngày còn lại</span>
                      </div>
                    ) : (
                      <div className="font-mono text-xs font-bold leading-none">
                        {diff.days}d {pad(diff.hours)}h {pad(diff.minutes)}m {pad(diff.seconds)}s
                      </div>
                    )}

                    {/* Matrix of Dots */}
                    <div className={`flex gap-1.5 flex-wrap ${alignFlexJustify}`}>
                      {Array.from({ length: 16 }).map((_, i) => (
                        <div
                          key={i}
                          className={`w-3 h-3 transition-transform ${
                            gridShape === 'SQUARE' ? 'rounded-xs' : 'rounded-full'
                          } ${
                            gridFill === 'OUTLINE' ? 'border-2 bg-transparent' : ''
                          }`}
                          style={{
                            backgroundColor: gridFill === 'FILLED' ? gridColor : 'transparent',
                            borderColor: gridColor,
                          }}
                        />
                      ))}
                    </div>
                    <div className="text-[9px] opacity-70 font-mono">
                      Lưới {gridShape === 'SQUARE' ? 'ô vuông' : 'chấm tròn'} • {gridFill === 'FILLED' ? 'Tô đặc' : 'Mỗi viền'} • Còn {progressStats.formattedRemaining}
                    </div>
                  </div>
                ) : (
                  /* --- 4 & 5. DEFAULT & MINIMAL STYLE --- */
                  <div className={`w-full flex flex-col py-1 ${alignContainerClass}`}>
                    {detailMode === 'SIMPLE' ? (
                      <div className={`flex flex-col ${alignContainerClass}`}>
                        <div className="text-4xl font-black font-mono leading-none tracking-tight">
                          {diff.days} <span className="text-xs font-sans font-medium text-neutral-500">ngày</span>
                        </div>
                        <div className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider mt-1">
                          Thời gian còn lại • ⏳ Còn {progressStats.formattedRemaining}
                        </div>
                        {/* Simple progress bar */}
                        <div className="w-full bg-neutral-200 dark:bg-neutral-800 h-1.5 rounded-full overflow-hidden mt-2 max-w-[200px]">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${progressStats.remainingPct}%`,
                              backgroundColor: isCustomColor ? itemColor : 'currentColor',
                            }}
                          />
                        </div>
                      </div>
                    ) : (
                      <div className={`flex flex-col gap-1.5 ${alignContainerClass}`}>
                        <div className={`flex items-center gap-1 font-mono font-bold text-xs sm:text-sm ${alignFlexJustify}`}>
                          {(() => {
                            const isLight = isLightColor(itemColor);
                            const badgeStyle = isCustomColor ? {
                              backgroundColor: `${itemColor}15`,
                              borderColor: `${itemColor}45`,
                              color: isLight ? getReadableColorOnLight(itemColor) : itemColor,
                            } : undefined;

                            return (
                              <>
                                <span className="bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 border border-neutral-200/60 dark:border-neutral-700/60 px-1.5 py-0.5 rounded" style={badgeStyle}>{diff.days}d</span>
                                <span className="text-neutral-400">:</span>
                                <span className="bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 border border-neutral-200/60 dark:border-neutral-700/60 px-1.5 py-0.5 rounded" style={badgeStyle}>{pad(diff.hours)}h</span>
                                <span className="text-neutral-400">:</span>
                                <span className="bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 border border-neutral-200/60 dark:border-neutral-700/60 px-1.5 py-0.5 rounded" style={badgeStyle}>{pad(diff.minutes)}m</span>
                                <span className="text-neutral-400">:</span>
                                <span className="bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 border border-neutral-200/60 dark:border-neutral-700/60 px-1.5 py-0.5 rounded" style={badgeStyle}>{pad(diff.seconds)}s</span>
                              </>
                            );
                          })()}
                        </div>
                        <div className="text-[10px] text-neutral-500 dark:text-neutral-400">
                          ⏳ Còn {progressStats.formattedRemaining} • Đã qua {progressStats.formattedElapsed}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Bottom detail row */}
              <div
                className={`pt-2.5 mt-1 border-t text-[11px] flex items-center justify-between relative z-10 w-full ${
                  isFonty || isSwiss || isGridStyle
                    ? 'border-white/15 text-white/70'
                    : 'border-neutral-100 dark:border-neutral-800 text-neutral-500 dark:text-neutral-400'
                }`}
              >
                <span>🗓️ {formattedDate}</span>
                {item.notes ? (
                  <span className="truncate max-w-[140px] italic">"{item.notes}"</span>
                ) : (
                  <span>{diff.text}</span>
                )}
              </div>
            </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
