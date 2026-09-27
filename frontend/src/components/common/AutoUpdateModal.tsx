import React, { useState, useEffect, useRef } from 'react';
import {
  Upload,
  RefreshCw,
  FolderSync,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  FileArchive,
  X,
  Sparkles,
  HardDrive,
  RotateCcw,
  GitBranch,
  GitPullRequest,
  GitCommit,
  ExternalLink,
  Settings,
  Download,
  Terminal,
  Check,
  ArrowRight,
  Info
} from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { api } from '../../services/api';

interface AutoUpdateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenChangelog?: () => void;
}

type UpdateTab = 'GITHUB' | 'MANUAL' | 'SETTINGS';

export const AutoUpdateModal: React.FC<AutoUpdateModalProps> = ({
  isOpen,
  onClose,
  onOpenChangelog,
}) => {
  const [activeTab, setActiveTab] = useState<UpdateTab>('GITHUB');

  // App & Git Info
  const [updateInfo, setUpdateInfo] = useState<any>(null);
  const [githubCheck, setGithubCheck] = useState<any>(null);
  const [isCheckingGitHub, setIsCheckingGitHub] = useState(false);
  const [isApplyingGitHub, setIsApplyingGitHub] = useState(false);
  const [githubResult, setGithubResult] = useState<any>(null);

  // GitHub Options
  const [updateMode, setUpdateMode] = useState<'auto' | 'git_pull' | 'download_zip'>('auto');
  const [forceOverwrite, setForceOverwrite] = useState(false);

  // GitHub Config
  const [repoInput, setRepoInput] = useState('hquy09/routify-ts');
  const [branchInput, setBranchInput] = useState('main');
  const [tokenInput, setTokenInput] = useState('');
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [configFeedback, setConfigFeedback] = useState<string | null>(null);

  // Manual Zip State
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isApplyingManual, setIsApplyingManual] = useState(false);
  const [manualResult, setManualResult] = useState<any>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // General Status
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Load Info & Check GitHub
  const handleCheckGitHub = async (showLoading = true) => {
    if (showLoading) setIsCheckingGitHub(true);
    setErrorMessage(null);
    try {
      const [info, checkRes, cfg] = await Promise.all([
        api.settings.getUpdateInfo().catch(() => null),
        api.settings.checkGitHubUpdate({
          repo: repoInput,
          branch: branchInput,
          token: tokenInput || undefined,
        }),
        api.settings.getGitHubConfig().catch(() => null),
      ]);

      if (info) setUpdateInfo(info);
      setGithubCheck(checkRes);

      if (cfg) {
        if (cfg.repo) setRepoInput(cfg.repo);
        if (cfg.branch) setBranchInput(cfg.branch);
        if (cfg.token) setTokenInput(cfg.token);
        if (cfg.mode) setUpdateMode(cfg.mode);
      }
    } catch (err: any) {
      console.error('Failed to check GitHub update:', err);
      setErrorMessage(err?.message || 'Không thể kiểm tra bản cập nhật từ GitHub');
    } finally {
      if (showLoading) setIsCheckingGitHub(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setGithubResult(null);
      setManualResult(null);
      setErrorMessage(null);
      handleCheckGitHub(true);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Apply Update from GitHub
  const handleApplyGitHubUpdate = async () => {
    setIsApplyingGitHub(true);
    setErrorMessage(null);
    setGithubResult(null);

    try {
      const res = await api.settings.applyGitHubUpdate({
        mode: updateMode,
        repo: repoInput,
        branch: branchInput,
        token: tokenInput || undefined,
        force_overwrite: forceOverwrite,
      });

      setGithubResult(res);
      // Re-check after update
      handleCheckGitHub(false);
    } catch (err: any) {
      console.error('Failed to apply GitHub update:', err);
      setErrorMessage(err?.message || 'Có lỗi xảy ra khi cập nhật từ GitHub');
    } finally {
      setIsApplyingGitHub(false);
    }
  };

  // Save GitHub Config
  const handleSaveConfig = async () => {
    setIsSavingConfig(true);
    setConfigFeedback(null);
    try {
      await api.settings.saveGitHubConfig({
        repo: repoInput.trim(),
        branch: branchInput.trim(),
        token: tokenInput.trim(),
        mode: updateMode,
      });
      setConfigFeedback('Đã lưu cấu hình GitHub thành công!');
      setTimeout(() => setConfigFeedback(null), 3000);
      handleCheckGitHub(false);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Không thể lưu cấu hình GitHub');
    } finally {
      setIsSavingConfig(false);
    }
  };

  // Manual File Drop
  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.name.endsWith('.zip')) {
        setSelectedFile(file);
        setErrorMessage(null);
      } else {
        setErrorMessage('Vui lòng chọn gói cập nhật có định dạng nén .zip');
      }
    }
  };

  // Apply Manual Zip
  const handleApplyManual = async () => {
    if (!selectedFile) return;

    setIsApplyingManual(true);
    setErrorMessage(null);
    setManualResult(null);

    try {
      const res = await api.settings.applyUpdatePackage(selectedFile);
      setManualResult(res);
      handleCheckGitHub(false);
    } catch (err: any) {
      console.error('Failed to apply update package:', err);
      setErrorMessage(err?.message || 'Lỗi khi áp dụng gói cập nhật vào phân vùng');
    } finally {
      setIsApplyingManual(false);
    }
  };

  const hasUpdate = Boolean(githubCheck?.has_update);
  const localCommit = githubCheck?.local_info;
  const remoteCommit = githubCheck?.remote_commit;
  const recentCommits = githubCheck?.recent_commits || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-2xl w-full shadow-2xl my-auto max-h-[92vh] flex flex-col overflow-hidden">
        {/* Accent Glow */}
        <div className="h-1.5 w-full bg-gradient-to-r from-emerald-500 via-indigo-500 to-sky-400 shrink-0" />

        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-850/60 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-emerald-600 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
              <GitPullRequest className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-900 dark:text-slate-100 text-base leading-tight flex items-center gap-2">
                <span>Cập nhật ứng dụng từ GitHub</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 border border-indigo-300/60 dark:border-indigo-800 font-mono">
                  v{updateInfo?.current_version || '1.2.0'}
                </span>
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                Đồng bộ mã nguồn trực tiếp từ GitHub & tự động dán vào phân vùng làm việc
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition p-1.5 rounded-lg hover:bg-slate-200/60 dark:hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 bg-slate-100/60 dark:bg-slate-800/40 px-5 pt-2 gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('GITHUB')}
            className={`px-3 py-2 text-xs font-semibold rounded-t-lg transition-all flex items-center gap-1.5 border-b-2 cursor-pointer ${
              activeTab === 'GITHUB'
                ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 border-indigo-600 dark:border-indigo-400 shadow-xs'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 border-transparent'
            }`}
          >
            <GitBranch className="w-3.5 h-3.5" />
            <span>Từ GitHub</span>
            {hasUpdate && (
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse ml-0.5" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('MANUAL')}
            className={`px-3 py-2 text-xs font-semibold rounded-t-lg transition-all flex items-center gap-1.5 border-b-2 cursor-pointer ${
              activeTab === 'MANUAL'
                ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 border-indigo-600 dark:border-indigo-400 shadow-xs'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 border-transparent'
            }`}
          >
            <FileArchive className="w-3.5 h-3.5" />
            <span>Dán gói ZIP thủ công</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('SETTINGS')}
            className={`px-3 py-2 text-xs font-semibold rounded-t-lg transition-all flex items-center gap-1.5 border-b-2 cursor-pointer ml-auto ${
              activeTab === 'SETTINGS'
                ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 border-indigo-600 dark:border-indigo-400 shadow-xs'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 border-transparent'
            }`}
          >
            <Settings className="w-3.5 h-3.5" />
            <span>Cấu hình kho mã nguồn</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Error Message */}
          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs flex items-start gap-2 animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* TAB 1: GITHUB UPDATE */}
          {activeTab === 'GITHUB' && (
            <div className="space-y-4 animate-in fade-in-50 duration-200">
              {/* Success Result */}
              {githubResult && (
                <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 space-y-2.5 animate-in fade-in">
                  <div className="flex items-center gap-2 font-bold text-xs sm:text-sm">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span>{githubResult.message}</span>
                  </div>
                  <p className="text-[11px] text-emerald-700 dark:text-emerald-300">
                    Phương thức: <strong>{githubResult.mode === 'git_pull' ? 'Git Pull (Đồng bộ qua Git)' : 'Tải & dán gói từ GitHub Archive'}</strong>.
                    Bản snapshot an toàn: <code className="font-mono bg-emerald-100 dark:bg-emerald-900/60 px-1 py-0.5 rounded">{githubResult.safety_backup}</code>.
                  </p>
                  <div className="pt-1 flex items-center gap-2">
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => window.location.reload()}
                      className="font-bold text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                    >
                      <RotateCcw className="w-3.5 h-3.5 mr-1" />
                      <span>Tải lại trang ngay để áp dụng</span>
                    </Button>
                  </div>
                </div>
              )}

              {/* GitHub Status Card */}
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-850/50 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-200 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-xs text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                      <GitBranch className="w-4 h-4 text-indigo-500" />
                      <span>Kho mã nguồn:</span>
                    </span>
                    <a
                      href={`https://github.com/${repoInput}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs font-mono font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
                    >
                      <span>{repoInput}</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                    <Badge variant="outline" className="text-[10px] py-0 px-1.5 font-mono">
                      {branchInput}
                    </Badge>
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleCheckGitHub(true)}
                    disabled={isCheckingGitHub}
                    className="text-xs h-7 cursor-pointer"
                  >
                    <RefreshCw className={`w-3 h-3 mr-1 ${isCheckingGitHub ? 'animate-spin' : ''}`} />
                    <span>{isCheckingGitHub ? 'Đang kiểm tra...' : 'Kiểm tra cập nhật'}</span>
                  </Button>
                </div>

                {/* Compare Commit Status */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  {/* Local Commit */}
                  <div className="p-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-500 dark:text-slate-400 text-[11px] flex items-center gap-1">
                        <Terminal className="w-3 h-3" />
                        <span>Phiên bản trên máy bạn:</span>
                      </span>
                      {localCommit?.short_sha && (
                        <span className="font-mono text-[10px] bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded font-bold text-slate-700 dark:text-slate-300">
                          {localCommit.short_sha}
                        </span>
                      )}
                    </div>
                    <p className="font-medium text-slate-800 dark:text-slate-200 line-clamp-1 text-[11px]">
                      {localCommit?.message || 'Chưa có thông tin commit'}
                    </p>
                    <div className="text-[10px] text-slate-400">
                      {localCommit?.author ? `Bởi ${localCommit.author}` : ''}
                    </div>
                  </div>

                  {/* Remote GitHub Commit */}
                  <div className="p-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-500 dark:text-slate-400 text-[11px] flex items-center gap-1">
                        <GitCommit className="w-3 h-3 text-indigo-500" />
                        <span>Bản mới nhất trên GitHub:</span>
                      </span>
                      {remoteCommit?.short_sha && (
                        <span className="font-mono text-[10px] bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 px-1.5 py-0.5 rounded font-bold border border-indigo-200 dark:border-indigo-800">
                          {remoteCommit.short_sha}
                        </span>
                      )}
                    </div>
                    <p className="font-medium text-slate-800 dark:text-slate-200 line-clamp-1 text-[11px]">
                      {remoteCommit?.message || (isCheckingGitHub ? 'Đang kiểm tra...' : 'Không có thông tin')}
                    </p>
                    <div className="text-[10px] text-slate-400">
                      {remoteCommit?.author ? `Bởi ${remoteCommit.author}` : ''}
                    </div>
                  </div>
                </div>

                {/* Update Alert Banner */}
                <div className="pt-1">
                  {hasUpdate ? (
                    <div className="p-2.5 rounded-lg bg-gradient-to-r from-emerald-500/10 via-indigo-500/10 to-transparent border border-emerald-300 dark:border-emerald-800 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="relative flex h-2.5 w-2.5">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                        </span>
                        <strong className="text-emerald-800 dark:text-emerald-300 font-bold">
                          Có bản cập nhật mới trên GitHub!
                        </strong>
                      </div>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400">
                        Bấm nút &quot;Cập nhật ngay&quot; bên dưới
                      </span>
                    </div>
                  ) : (
                    <div className="p-2.5 rounded-lg bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-900/40 flex items-center gap-2 text-xs text-emerald-700 dark:text-emerald-300">
                      <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <span>Ứng dụng của bạn đang đồng bộ với bản mới nhất trên GitHub. Bạn vẫn có thể bấm Cập nhật để đồng bộ lại mã nguồn khi cần.</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Recent GitHub Commits List */}
              {recentCommits.length > 0 && (
                <div className="space-y-2">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                    <span>Các thay đổi gần nhất trên GitHub:</span>
                  </span>

                  <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                    {recentCommits.map((c: any) => (
                      <div
                        key={c.sha}
                        className="p-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 text-xs flex items-center justify-between gap-2"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-mono text-[10px] text-indigo-600 dark:text-indigo-400 font-bold shrink-0 bg-slate-100 dark:bg-slate-800 px-1 rounded">
                            {c.short_sha}
                          </span>
                          <span className="text-slate-800 dark:text-slate-200 truncate text-[11px]">
                            {c.message}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-[10px] text-slate-400 hidden sm:inline">
                            {c.author}
                          </span>
                          {c.url && (
                            <a
                              href={c.url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-slate-400 hover:text-indigo-500"
                              title="Xem commit trên GitHub"
                            >
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Update Method Selection */}
              <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850/30 space-y-2.5">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                  Phương thức cập nhật:
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <label
                    className={`p-2.5 rounded-lg border cursor-pointer flex items-start gap-2.5 transition ${
                      updateMode === 'auto' || updateMode === 'git_pull'
                        ? 'border-indigo-500 bg-indigo-50/40 dark:bg-indigo-950/20 text-indigo-950 dark:text-indigo-200'
                        : 'border-slate-200 dark:border-slate-800 hover:bg-slate-100/50 dark:hover:bg-slate-800/40'
                    }`}
                  >
                    <input
                      type="radio"
                      name="updateMode"
                      checked={updateMode === 'auto' || updateMode === 'git_pull'}
                      onChange={() => setUpdateMode('auto')}
                      className="mt-0.5 text-indigo-600 cursor-pointer"
                    />
                    <div>
                      <div className="font-semibold text-xs flex items-center gap-1.5">
                        <Terminal className="w-3.5 h-3.5 text-indigo-500" />
                        <span>Tự động (Git Pull & Fallback)</span>
                      </div>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                        Đồng bộ qua Git nếu có thể, tự động chuyển sang tải trực tiếp nếu gặp xung đột.
                      </p>
                    </div>
                  </label>

                  <label
                    className={`p-2.5 rounded-lg border cursor-pointer flex items-start gap-2.5 transition ${
                      updateMode === 'download_zip'
                        ? 'border-indigo-500 bg-indigo-50/40 dark:bg-indigo-950/20 text-indigo-950 dark:text-indigo-200'
                        : 'border-slate-200 dark:border-slate-800 hover:bg-slate-100/50 dark:hover:bg-slate-800/40'
                    }`}
                  >
                    <input
                      type="radio"
                      name="updateMode"
                      checked={updateMode === 'download_zip'}
                      onChange={() => setUpdateMode('download_zip')}
                      className="mt-0.5 text-indigo-600 cursor-pointer"
                    />
                    <div>
                      <div className="font-semibold text-xs flex items-center gap-1.5">
                        <Download className="w-3.5 h-3.5 text-emerald-500" />
                        <span>Tải & Dán đè từ GitHub ZIP</span>
                      </div>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                        Tải trực tiếp gói mã nguồn mới nhất từ GitHub và dán đè vào phân vùng.
                      </p>
                    </div>
                  </label>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="forceOverwrite"
                    checked={forceOverwrite}
                    onChange={(e) => setForceOverwrite(e.target.checked)}
                    className="rounded text-indigo-600 cursor-pointer"
                  />
                  <label htmlFor="forceOverwrite" className="text-[11px] text-slate-600 dark:text-slate-400 cursor-pointer">
                    Buộc dán đè toàn bộ file mã nguồn kể cả khi đang ở cùng commit (Force update)
                  </label>
                </div>
              </div>

              {/* Safety notice */}
              <div className="p-3 rounded-xl border border-emerald-200/60 dark:border-emerald-900/40 bg-emerald-50/40 dark:bg-emerald-950/20 text-[11px] text-emerald-800 dark:text-emerald-300 flex items-start gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <strong>Bảo vệ cơ sở dữ liệu an toàn 100%:</strong> Quá trình cập nhật luôn tự động tạo bản sao lưu snapshot tại <code>storage/backups/</code> và tuyệt đối không bao giờ ghi đè tệp cơ sở dữ liệu <code>lifeos.db</code> của bạn.
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: MANUAL ZIP UPLOAD */}
          {activeTab === 'MANUAL' && (
            <div className="space-y-4 animate-in fade-in-50 duration-200">
              {manualResult && (
                <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 space-y-2.5 animate-in fade-in">
                  <div className="flex items-center gap-2 font-bold text-xs sm:text-sm">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span>{manualResult.message}</span>
                  </div>
                  <p className="text-[11px] text-emerald-700 dark:text-emerald-300">
                    Bản snapshot an toàn: <code className="font-mono bg-emerald-100 dark:bg-emerald-900/60 px-1 py-0.5 rounded">{manualResult.safety_backup}</code>.
                  </p>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => window.location.reload()}
                    className="font-bold text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    <RotateCcw className="w-3.5 h-3.5 mr-1" />
                    <span>Tải lại trang ngay</span>
                  </Button>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center justify-between">
                  <span>Gói cập nhật phân vùng (.zip)</span>
                  <span className="text-[11px] font-normal text-slate-400">
                    Dành cho cập nhật offline hoặc bản vá riêng
                  </span>
                </label>

                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleFileDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition flex flex-col items-center justify-center gap-2 ${
                    isDragging
                      ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/20'
                      : selectedFile
                      ? 'border-emerald-500 bg-emerald-50/30 dark:bg-emerald-950/10'
                      : 'border-slate-300 dark:border-slate-700 hover:border-indigo-400 dark:hover:border-indigo-600 bg-slate-50/50 dark:bg-slate-850/30'
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".zip"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        setSelectedFile(e.target.files[0]);
                        setErrorMessage(null);
                      }
                    }}
                  />

                  {selectedFile ? (
                    <>
                      <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                        <FileArchive className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="font-bold text-xs text-slate-900 dark:text-slate-100">
                          {selectedFile.name}
                        </div>
                        <div className="text-[10px] text-slate-500 mt-0.5">
                          {(selectedFile.size / 1024 / 1024).toFixed(2)} MB · Sẵn sàng dán vào phân vùng
                        </div>
                      </div>
                      <span className="text-[11px] text-indigo-600 dark:text-indigo-400 underline">
                        Bấm để chọn file khác
                      </span>
                    </>
                  ) : (
                    <>
                      <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 flex items-center justify-center">
                        <Upload className="w-5 h-5 text-indigo-500" />
                      </div>
                      <div className="font-semibold text-xs text-slate-800 dark:text-slate-200">
                        Kéo thả gói cập nhật (.zip) vào đây hoặc bấm để chọn tệp
                      </div>
                      <p className="text-[10px] text-slate-400">
                        Hệ thống sẽ tự động dán và cập nhật các tệp trong mã nguồn app
                      </p>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: GITHUB CONFIGURATION */}
          {activeTab === 'SETTINGS' && (
            <div className="space-y-4 animate-in fade-in-50 duration-200">
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-850/40 space-y-3">
                <span className="font-bold text-xs text-slate-800 dark:text-slate-200 block">
                  Cấu hình kết nối GitHub Repository
                </span>

                {configFeedback && (
                  <div className="p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs flex items-center gap-2">
                    <Check className="w-4 h-4" />
                    <span>{configFeedback}</span>
                  </div>
                )}

                <div className="space-y-3 text-xs">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      Kho mã nguồn (GitHub Repo Owner / Name):
                    </label>
                    <input
                      type="text"
                      value={repoInput}
                      onChange={(e) => setRepoInput(e.target.value)}
                      placeholder="hquy09/routify-ts"
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono text-xs focus:ring-1 focus:ring-indigo-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      Nhánh cập nhật (Branch):
                    </label>
                    <input
                      type="text"
                      value={branchInput}
                      onChange={(e) => setBranchInput(e.target.value)}
                      placeholder="main"
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono text-xs focus:ring-1 focus:ring-indigo-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      GitHub Personal Access Token (Tùy chọn):
                    </label>
                    <input
                      type="password"
                      value={tokenInput}
                      onChange={(e) => setTokenInput(e.target.value)}
                      placeholder="ghp_xxxxxxxxxxxxxxxxxxxx (nếu dùng private repo hoặc tránh rate-limit)"
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono text-xs focus:ring-1 focus:ring-indigo-500 outline-none"
                    />
                    <p className="text-[10px] text-slate-400 mt-1">
                      Token chỉ cần quyền đọc mã nguồn (public repo không bắt buộc token).
                    </p>
                  </div>

                  <div className="pt-2 flex justify-end">
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={handleSaveConfig}
                      disabled={isSavingConfig}
                      className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white"
                    >
                      <Check className="w-3.5 h-3.5 mr-1" />
                      <span>{isSavingConfig ? 'Đang lưu...' : 'Lưu cấu hình GitHub'}</span>
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-850/90 backdrop-blur-md shrink-0 flex items-center justify-between gap-3">
          {onOpenChangelog && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenChangelog();
              }}
              className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>Xem nhật ký phiên bản</span>
            </button>
          )}

          <div className="flex items-center gap-2 ml-auto">
            <Button variant="outline" size="sm" onClick={onClose} className="text-xs cursor-pointer">
              Đóng
            </Button>

            {activeTab === 'GITHUB' && (
              <Button
                variant="primary"
                size="sm"
                disabled={isApplyingGitHub}
                onClick={handleApplyGitHubUpdate}
                className="font-bold text-xs bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer shadow-xs"
              >
                {isApplyingGitHub ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin mr-1" />
                    <span>Đang cập nhật từ GitHub...</span>
                  </>
                ) : (
                  <>
                    <GitPullRequest className="w-3.5 h-3.5 mr-1" />
                    <span>Cập nhật ngay từ GitHub</span>
                  </>
                )}
              </Button>
            )}

            {activeTab === 'MANUAL' && (
              <Button
                variant="primary"
                size="sm"
                disabled={!selectedFile || isApplyingManual}
                onClick={handleApplyManual}
                className="font-bold text-xs bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer shadow-xs"
              >
                {isApplyingManual ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin mr-1" />
                    <span>Đang dán file...</span>
                  </>
                ) : (
                  <>
                    <FolderSync className="w-3.5 h-3.5 mr-1" />
                    <span>Dán file & Cập nhật</span>
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
