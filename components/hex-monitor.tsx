'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ChevronUp, 
  ChevronDown, 
  Trash2, 
  Download,
  Terminal,
  ArrowUpCircle,
  ArrowDownCircle,
  Pause,
  Play
} from 'lucide-react';

export interface HexLogEntry {
  id: string;
  timestamp: Date;
  type: 'tx' | 'rx';
  data: number[] | string;
  description?: string;
}

interface HexMonitorProps {
  logs: HexLogEntry[];
  onClear: () => void;
}

export default function HexMonitor({ logs, onClear }: HexMonitorProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [panelHeight, setPanelHeight] = useState(200);
  const logContainerRef = useRef<HTMLDivElement>(null);
  const resizeRef = useRef<HTMLDivElement>(null);
  const [isResizing, setIsResizing] = useState(false);

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (!isPaused && logContainerRef.current && isExpanded) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs, isPaused, isExpanded]);

  // Handle resize
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const newHeight = window.innerHeight - e.clientY;
      setPanelHeight(Math.max(100, Math.min(500, newHeight)));
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  const formatHex = (data: number[] | string): string => {
    if (typeof data === 'string') {
      // Already formatted or raw string
      return data;
    }
    return data.map(b => b.toString(16).toUpperCase().padStart(2, '0')).join(' ');
  };

  const formatTime = (date: Date): string => {
    return date.toLocaleTimeString('ko-KR', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }) + '.' + date.getMilliseconds().toString().padStart(3, '0');
  };

  const exportLogs = () => {
    const content = logs.map(log => {
      const hex = formatHex(log.data);
      return `[${formatTime(log.timestamp)}] ${log.type.toUpperCase()} | ${hex}${log.description ? ` | ${log.description}` : ''}`;
    }).join('\n');

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ptz-hex-log-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const txCount = logs.filter(l => l.type === 'tx').length;
  const rxCount = logs.filter(l => l.type === 'rx').length;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40">
      {/* Resize Handle */}
      {isExpanded && (
        <div
          ref={resizeRef}
          onMouseDown={() => setIsResizing(true)}
          className="h-1 bg-border hover:bg-primary cursor-ns-resize transition-colors"
        />
      )}

      {/* Header Bar */}
      <div 
        className="bg-card/95 backdrop-blur border-t border-border px-4 py-2 flex items-center justify-between cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-primary" />
            <span className="font-medium text-sm">Hex Monitor</span>
          </div>
          
          {/* Stats */}
          <div className="flex items-center gap-3 text-xs">
            <div className="flex items-center gap-1 text-green-500">
              <ArrowUpCircle className="w-3.5 h-3.5" />
              <span>TX: {txCount}</span>
            </div>
            <div className="flex items-center gap-1 text-blue-500">
              <ArrowDownCircle className="w-3.5 h-3.5" />
              <span>RX: {rxCount}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isExpanded && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsPaused(!isPaused);
                }}
                className={`p-1.5 rounded transition-colors ${
                  isPaused 
                    ? 'bg-yellow-500/20 text-yellow-500' 
                    : 'hover:bg-muted text-muted-foreground'
                }`}
                title={isPaused ? 'Resume' : 'Pause'}
              >
                {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  exportLogs();
                }}
                className="p-1.5 hover:bg-muted rounded transition-colors text-muted-foreground"
                title="Export Logs"
              >
                <Download className="w-4 h-4" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onClear();
                }}
                className="p-1.5 hover:bg-destructive/20 rounded transition-colors text-muted-foreground hover:text-destructive"
                title="Clear Logs"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </>
          )}
          {isExpanded ? (
            <ChevronDown className="w-5 h-5 text-muted-foreground" />
          ) : (
            <ChevronUp className="w-5 h-5 text-muted-foreground" />
          )}
        </div>
      </div>

      {/* Log Content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: panelHeight }}
            exit={{ height: 0 }}
            transition={{ duration: 0.2 }}
            className="bg-card/95 backdrop-blur border-t border-border overflow-hidden"
          >
            <div
              ref={logContainerRef}
              className="h-full overflow-y-auto font-mono text-xs p-2 space-y-0.5"
              style={{ height: panelHeight }}
            >
              {logs.length === 0 ? (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  <p>데이터 전송 시 Hex 코드가 여기에 표시됩니다</p>
                </div>
              ) : (
                logs.map((log) => (
                  <div
                    key={log.id}
                    className={`flex items-start gap-2 py-1 px-2 rounded ${
                      log.type === 'tx' 
                        ? 'bg-green-500/10 hover:bg-green-500/20' 
                        : 'bg-blue-500/10 hover:bg-blue-500/20'
                    }`}
                  >
                    <span className="text-muted-foreground w-24 flex-shrink-0">
                      {formatTime(log.timestamp)}
                    </span>
                    <span className={`w-8 flex-shrink-0 font-bold ${
                      log.type === 'tx' ? 'text-green-500' : 'text-blue-500'
                    }`}>
                      {log.type.toUpperCase()}
                    </span>
                    <span className="flex-1 text-foreground">
                      {formatHex(log.data)}
                    </span>
                    {log.description && (
                      <span className="text-muted-foreground flex-shrink-0">
                        {log.description}
                      </span>
                    )}
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
