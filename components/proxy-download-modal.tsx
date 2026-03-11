'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { X, Download, AlertTriangle, ExternalLink, Terminal, Copy, Check, Loader2 } from 'lucide-react';
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
  const [copied, setCopied] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<ProxyFile[]>([]);
  const [filesLoading, setFilesLoading] = useState(false);

  // 모달 열릴 때마다 업로드된 파일 목록 조회
  useEffect(() => {
    if (!isOpen) return;
    setFilesLoading(true);
    fetch('/api/admin/proxy-file')
      .then(r => r.json())
      .then(d => setUploadedFiles(d.files ?? []))
      .catch(() => setUploadedFiles([]))
      .finally(() => setFilesLoading(false));
  }, [isOpen]);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  function formatBytes(bytes: number) {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }

  // 업로드된 파일 아이콘
  function fileIcon(filename: string) {
    if (filename.endsWith('.exe') || filename.endsWith('.msi')) return '🖥️';
    if (filename.endsWith('.dmg') || filename.endsWith('.appimage')) return '🍎';
    if (filename.endsWith('.sh')) return '🐧';
    return '📦';
  }

  // 업로드된 파일이 있으면 상단에 표시, 없으면 기본 링크
  const hasUploaded = uploadedFiles.length > 0;

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
              ) : hasUploaded ? (
                /* 관리자가 업로드한 파일 우선 표시 */
                <>
                  {uploadedFiles.map((file) => (
                    <a
                      key={file.filename}
                      href={file.downloadUrl}
                      download={file.filename}
                      className="flex items-center gap-4 p-4 bg-primary/5 hover:bg-primary/10 border border-primary/20 rounded-lg transition-colors group"
                    >
                      <span className="text-2xl">{fileIcon(file.filename)}</span>
                      <div className="flex-1">
                        <p className="font-medium text-foreground group-hover:text-primary transition-colors font-mono text-sm">
                          {file.filename}
                        </p>
                        <p className="text-xs text-muted-foreground">{formatBytes(file.size)}</p>
                      </div>
                      <Download className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
                    </a>
                  ))}
                  {/* 소스 ZIP은 보조로 표시 */}
                  <a
                    href="/api/download/ptz-proxy"
                    download="ptz-proxy-standalone.zip"
                    className="flex items-center gap-4 p-3 bg-muted/30 hover:bg-muted/50 border border-border rounded-lg transition-colors group"
                  >
                    <span className="text-xl">📄</span>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors">
                        소스 코드 (ZIP)
                      </p>
                      <p className="text-xs text-muted-foreground">Node.js 필요 · 직접 빌드</p>
                    </div>
                    <Download className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                  </a>
                </>
              ) : (
                /* 업로드 파일 없을 때 기본 링크 */
                <>
                  <a
                    href="https://github.com/ptzcontroller_admin/ptz-proxy/releases/latest"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-4 p-4 bg-muted/50 hover:bg-muted border border-border rounded-lg transition-colors group"
                  >
                    <span className="text-2xl">📦</span>
                    <div className="flex-1">
                      <p className="font-medium text-foreground group-hover:text-primary transition-colors">
                        GitHub Releases
                      </p>
                      <p className="text-sm text-muted-foreground">Latest stable release</p>
                    </div>
                    <ExternalLink className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
                  </a>
                  <a
                    href="/api/download/ptz-proxy"
                    download="ptz-proxy-standalone.zip"
                    className="flex items-center gap-4 p-4 bg-muted/50 hover:bg-muted border border-border rounded-lg transition-colors group"
                  >
                    <span className="text-2xl">💾</span>
                    <div className="flex-1">
                      <p className="font-medium text-foreground group-hover:text-primary transition-colors">
                        소스 코드 다운로드 (ZIP)
                      </p>
                      <p className="text-sm text-muted-foreground">이 서버에서 직접 다운로드</p>
                    </div>
                    <Download className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
                  </a>
                </>
              )}
            </div>

            {/* Quick Start Command */}
            <div className="mb-6 p-4 bg-zinc-900 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-zinc-400 flex items-center gap-1">
                  <Terminal className="w-3 h-3" /> 빠른 실행 (Node.js)
                </span>
                <button
                  onClick={() => handleCopy('npm install && node ptz-proxy.js 9902')}
                  className="text-xs text-zinc-400 hover:text-white flex items-center gap-1 transition-colors"
                >
                  {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  {copied ? '복사됨' : '복사'}
                </button>
              </div>
              <code className="text-sm text-green-400 font-mono">
                npm install && node ptz-proxy.js 9902
              </code>
            </div>

            {/* Close */}
            <div className="flex justify-end">
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
