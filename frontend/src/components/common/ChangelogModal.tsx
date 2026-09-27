import React, { useState } from 'react';
import {
  Sparkles,
  X,
  CheckCircle2,
  Calendar,
  Layers,
  ArrowRight,
  ShieldCheck,
  Zap,
  BarChart3,
  Clock,
  Pin
} from 'lucide-react';
import { Button } from '../ui/button';

export interface ChangelogHighlight {
  category: string;
  icon: string;
  content: string;
}

export interface ChangelogRelease {
  version: string;
  date: string;
  title: string;
  is_latest: boolean;
  highlights: ChangelogHighlight[];
}

interface ChangelogModalProps {
  isOpen: boolean;
  onClose: () => void;
  releases?: ChangelogRelease[];
  currentVersion?: string;
  onOpenAutoUpdate?: () => void;
}

const DEFAULT_RELEASES: ChangelogRelease[] = [
  {
    version: '27.9.6',
    date: '27/09/2026',
    title: 'Bản Phát Hành v27.9.6 (Commit c64b8ba)',
    is_latest: true,
    highlights: [
      {
        category: 'Cập nhật từ GitHub',
        icon: '🐙',
        content:
          'Tích hợp đồng bộ mã nguồn 1-click trực tiếp từ GitHub (hquy09/routify-ts:main) qua Git Pull hoặc GitHub Archive Zip. Lưu mốc hash c64b8ba để tự động đối chiếu các bản cập nhật mới tiếp theo.',
      },
      {
        category: 'Hiệu suất cá nhân 2 Cột',
        icon: '📊',
        content:
          'Tái cấu trúc giao diện 2 cột cân bằng: Cột trái thu gọn gọn gàng các trạng thái Đã hoàn thành, Điểm nỗ lực XP, Chuỗi ngày Streak và Chậm trễ; Cột phải mở rộng tối đa canvas cho biểu đồ cột và Heatmap.',
      },
      {
        category: 'Sidebar Tinh Giản',
        icon: '⚡',
        content:
          'Chuyển các nút "Đánh giá tuần" và "Toàn màn hình" sang Sidebar bên trái với chế độ thu gọn/mở rộng trực quan, tích hợp huy hiệu phiên bản v27.9.6.',
      },
      {
        category: 'Bảo vệ an toàn dữ liệu',
        icon: '🛡️',
        content:
          'Tự động tạo snapshot sao lưu khẩn cấp trước khi cập nhật. Tuyệt đối không bao giờ ghi đè tệp cơ sở dữ liệu SQLite lifeos.db của người dùng.',
      },
    ],
  },
  {
    version: '1.1.0',
    date: '25/09/2026',
    title: 'Đại Tu Modal Tạo Nhiệm Vụ Cho Học Sinh & Sinh Viên',
    is_latest: false,
    highlights: [
      {
        category: 'Cộng Thời Lượng 2 Chiều',
        icon: '⏱️',
        content:
          'Cộng nhanh thời lượng thông minh: Tự động tính Giờ bắt đầu = Hạn chót - Thời lượng khi bắt đầu đang để trống (VD: Hạn chót 21:00, bấm +30p -> Bắt đầu 20:30).',
      },
      {
        category: 'Preset Khung Giờ Chuẩn 24H',
        icon: '🌅',
        content:
          'Khung giờ học tập chuẩn (Sáng, Chiều, Tối, Đêm) kèm tô đậm nút đang chọn và chuẩn hóa 24 giờ toàn diện.',
      },
      {
        category: 'Sticky Live Preview Card',
        icon: '📋',
        content:
          'Thẻ xem trước thực tế ghim dính ở cột phải với đếm ngược hạn chót và thanh tiến độ việc con.',
      },
      {
        category: 'Checklist Việc Con Tương Tác',
        icon: '✅',
        content:
          'Danh sách việc con có checkbox tick trực tiếp, nút chuyển Lên/Xuống và thanh tiến độ phần trăm.',
      },
    ],
  },
  {
    version: '1.0.0',
    date: '23/09/2026',
    title: 'Khởi Chạy Routify & Tích Hợp TKB THPT Ngô Gia Tự',
    is_latest: false,
    highlights: [
      {
        category: 'TKB Trường Học',
        icon: '🏫',
        content:
          'Tự động giải mã AES-256 dữ liệu TKB 37 lớp trường THPT số 1 Ngô Gia Tự Đắk Lắk, 1-click điền bảng ma trận.',
      },
      {
        category: 'Lịch Cố Định & Phân Tầng',
        icon: '📌',
        content:
          'Lịch định kỳ tuần, phân loại môn học và tự động gán nhiệm vụ theo khung giờ học.',
      },
      {
        category: 'Sao Lưu & Đồng Bộ',
        icon: '💾',
        content:
          'Tích hợp Google Drive và sao lưu an toàn SQLite bảo vệ toàn vẹn dữ liệu.',
      },
    ],
  },
];

export const ChangelogModal: React.FC<ChangelogModalProps> = ({
  isOpen,
  onClose,
  releases = DEFAULT_RELEASES,
  currentVersion = '27.9.6',
  onOpenAutoUpdate,
}) => {
  const [dontShowAgain, setDontShowAgain] = useState(true);

  if (!isOpen) return null;

  const handleDismiss = () => {
    if (dontShowAgain) {
      localStorage.setItem('lifeos_last_seen_changelog_version', currentVersion);
    }
    onClose();
  };

  const latestRelease = releases.find((r) => r.is_latest) || releases[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-2xl w-full shadow-2xl my-auto max-h-[90vh] flex flex-col overflow-hidden">
        {/* Accent Glow Top Bar */}
        <div className="h-1.5 w-full bg-gradient-to-r from-indigo-500 via-purple-500 to-amber-400 shrink-0" />

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-850/60 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
              <Sparkles className="w-5 h-5 text-amber-300 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-slate-900 dark:text-slate-100 text-base leading-tight">
                  Nhật ký cập nhật Routify
                </h3>
                <span className="px-2 py-0.5 text-[10px] font-extrabold rounded-full bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 border border-indigo-300/80 dark:border-indigo-800">
                  v{currentVersion}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                Các tính năng mới, cải tiến trải nghiệm và sửa lỗi định kỳ
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleDismiss}
            className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition p-1.5 rounded-lg hover:bg-slate-200/60 dark:hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Changelog Content */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
          {/* Latest Release Featured Card */}
          {latestRelease && (
            <div className="p-4 rounded-2xl bg-gradient-to-br from-indigo-50/80 to-purple-50/40 dark:from-indigo-950/30 dark:to-purple-950/20 border border-indigo-200 dark:border-indigo-800/60 shadow-xs space-y-3.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-md bg-indigo-600 text-white font-extrabold text-xs">
                    Mới nhất · v{latestRelease.version}
                  </span>
                  <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-slate-400" />
                    <span>{latestRelease.date}</span>
                  </span>
                </div>
                <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Bản chính thức</span>
                </span>
              </div>

              <h4 className="font-bold text-slate-900 dark:text-slate-100 text-sm sm:text-base">
                {latestRelease.title}
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                {latestRelease.highlights.map((h, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-xl bg-white/90 dark:bg-slate-850/80 border border-slate-200/80 dark:border-slate-800 flex items-start gap-2.5 shadow-2xs"
                  >
                    <span className="text-lg p-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 shrink-0">
                      {h.icon}
                    </span>
                    <div className="min-w-0">
                      <div className="font-bold text-slate-900 dark:text-slate-100 text-xs">
                        {h.category}
                      </div>
                      <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5 leading-relaxed">
                        {h.content}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Older Releases History */}
          <div className="space-y-4">
            <h5 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-slate-400" />
              <span>Lịch sử các phiên bản trước</span>
            </h5>

            <div className="space-y-3">
              {releases
                .filter((r) => !r.is_latest)
                .map((rel) => (
                  <div
                    key={rel.version}
                    className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-850/40 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-slate-800 dark:text-slate-200">
                        Phiên bản {rel.version} — {rel.title}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {rel.date}
                      </span>
                    </div>
                    <ul className="space-y-1">
                      {rel.highlights.map((h, i) => (
                        <li
                          key={i}
                          className="text-[11px] text-slate-600 dark:text-slate-400 flex items-start gap-1.5"
                        >
                          <span className="text-indigo-500 font-bold shrink-0">•</span>
                          <span>
                            <strong>{h.category}:</strong> {h.content}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-850/90 backdrop-blur-md shrink-0 flex flex-wrap items-center justify-between gap-3">
          <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-slate-600 dark:text-slate-300">
            <input
              type="checkbox"
              checked={dontShowAgain}
              onChange={(e) => setDontShowAgain(e.target.checked)}
              className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 dark:border-slate-700 cursor-pointer"
            />
            <span>Không tự động hiển thị lại cho phiên bản {currentVersion}</span>
          </label>

          <div className="flex items-center gap-2 ml-auto">
            {onOpenAutoUpdate && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  handleDismiss();
                  onOpenAutoUpdate();
                }}
                className="text-xs"
              >
                <span>Kiểm tra cập nhật</span>
              </Button>
            )}

            <Button
              variant="primary"
              size="sm"
              onClick={handleDismiss}
              className="font-bold text-xs px-4"
            >
              <span>Đã hiểu & Bắt đầu</span>
              <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
