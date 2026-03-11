'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { X, Download, AlertTriangle, ExternalLink, Loader2, Cloud, Clock } from 'lucide-react';
import { useState, useEffect } from 'react';

interface ProxyDownloadModalProps {
  isOpen: boolean;
  onClose: () => void;
  proxyUrl?: string;
}

interface ProxyFile {
  filename: string;
  size: number;
  downloadUrl: string;
}

export function ProxyDownloadModal({ isOpen, onClose, proxyUrl }: ProxyDownloadModalProps) {
  const [uploadedFiles, setUploadedFiles] = useState<ProxyFile[]>([]);
  const [cloudDownloadUrl, setCloudDownloadUrl] = useState<string | null>(null);
  const [filesLoading, setFilesLoading] = useState(false);

  // 모달 열릴 때마다 업로드된 파일 목록 + Cloud Download URL 조회
  useEffect(() => {
    if (!isOpen) return;
    setFilesLoading(true);
    fetch('/api/admin/proxy-file')
      .then(r => r.json())
      .then(d => {
        setUploadedFiles(d.files ?? []);
        setCloudDownloadUrl(d.cloudDownloadUrl ?? null);
      })
      .catch(() => {
        setUploadedFiles([]);
        setCloudDownloadUrl(null);
      })
      .finally(() => setFilesLoading(false));
  }, [isOpen]);

  function formatBytes(bytes: number) {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }

  function fileIcon(filename: string) {
    if (filename.endsWith('.exe') || filename.endsWith('.msi')) return '🖥️';
    if (filename.endsWith('.dmg') || filename.endsWith('.appimage')) return '🍎';
    if (filename.endsWith('.sh')) return '🐧';
    return '📦';
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="bg-card border border-border rounded-xl p-6 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-500/20 rounded-lg">
                  <AlertTriangle className="w-6 h-6 text-amber-500" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-foreground">PTZ Proxy 연결 실패</h2>
                  <p className="text-sm text-muted-foreground">Proxy 서버에 연결할 수 없습니다</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-muted rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>

            {/* Connection Info */}
            {proxyUrl && (
              <div className="mb-6 p-4 bg-muted/50 rounded-lg border border-border">
                <p className="text-sm text-muted-foreground mb-1">연결 시도한 주소:</p>
                <code className="text-sm font-mono text-foreground break-all">{proxyUrl}</code>
              </div>
            )}

            {/* Instructions */}
            <div className="mb-6 space-y-3">
              <h3 className="font-semibold text-foreground">해결 방법</h3>
              <div className="space-y-2">
                {['PTZ Proxy를 아래에서 다운로드하세요', 'PTZ 카메라에 접근 가능한 PC에서 실행하세요', '다시 연결을 시도하세요'].map((step, i) => (
                  <div key={i} className="flex gap-3">
                    <span className="flex-shrink-0 w-6 h-6 bg-primary/20 text-primary rounded-full flex items-center justify-center text-sm font-bold">{i + 1}</span>
                    <p className="text-sm text-foreground pt-0.5">{step}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Download Links */}
            <div className="space-y-3 mb-6">
              <h3 className="font-semibold text-foreground flex items-center gap-2">
                <Download className="w-4 h-4" /> 다운로드
              </h3>

              {filesLoading ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <>
                  {/* ① Cloud Download — 관리자가 URL을 설정한 경우에만 표시 */}
                  {cloudDownloadUrl && (
                    <a
                      href={cloudDownloadUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-4 p-4 bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/30 rounded-lg transition-colors group"
                    >
                      <div className="p-2 bg-sky-500/20 rounded-lg">
                        <Cloud className="w-5 h-5 text-sky-400" />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-foreground group-hover:text-sky-400 transition-colors">
                          Cloud Download
                        </p>
                        <p className="text-xs text-muted-foreground truncate max-w-xs">{cloudDownloadUrl}</p>
                      </div>
                      <ExternalLink className="w-5 h-5 text-muted-foreground group-hover:text-sky-400 transition-colors" />
                    </a>
                  )}

                  {/* ② 실행 파일 다운로드 — 업로드 파일 있으면 제공, 없으면 준비 중 안내 */}
                  {uploadedFiles.length > 0 ? (
                    uploadedFiles.map((file) => (
                      <a
                        key={file.filename}
                        href={file.downloadUrl}
                        download={file.filename}
                        className="flex items-center gap-4 p-4 bg-primary/5 hover:bg-primary/10 border border-primary/20 rounded-lg transition-colors group"
                      >
                        <span className="text-2xl">{fileIcon(file.filename)}</span>
                        <div className="flex-1">
                          <p className="font-medium text-foreground group-hover:text-primary transition-colors">
                            실행 파일 다운로드
                          </p>
                          <p className="text-xs text-muted-foreground font-mono">{file.filename} · {formatBytes(file.size)}</p>
                        </div>
                        <Download className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
                      </a>
                    ))
                  ) : (
                    <div className="flex items-center gap-4 p-4 bg-muted/30 border border-border rounded-lg">
                      <div className="p-2 bg-muted rounded-lg">
                        <Clock className="w-5 h-5 text-muted-foreground" />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-muted-foreground">준비 중</p>
                        <p className="text-xs text-muted-foreground">제공자에게 문의하세요</p>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Tyche Logo */}
            <div className="flex items-center justify-center pt-4 border-t border-border">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/tyche-horz.svg"
                alt="TYCHE Inc."
                className="h-6 w-auto opacity-40 dark:hidden"
              />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/tyche-horz-dark.svg"
                alt="TYCHE Inc."
                className="h-6 w-auto opacity-40 hidden dark:block"
              />
            </div>

            {/* Close */}
            <div className="flex justify-end mt-4">
              <button
                onClick={onClose}
                className="px-4 py-2 bg-muted hover:bg-muted/80 text-foreground rounded-lg transition-colors"
              >
                닫기
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
