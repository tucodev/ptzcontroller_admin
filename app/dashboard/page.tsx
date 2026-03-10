"use client";

import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import {
    Camera, LogOut, Settings, Plus, Loader2,
    Video, Wifi, WifiOff, Shield, AlertTriangle, ShieldCheck, Lock,
} from "lucide-react";
import PTZControlPanel from "@/components/ptz-control-panel";
import CameraList from "@/components/camera-list";
import AddCameraModal from "@/components/add-camera-modal";
import SettingsModal from "@/components/settings-modal";
import { ProxyDownloadModal } from "@/components/proxy-download-modal";
import AdminModal from "@/components/admin-modal";
import HexMonitor, { HexLogEntry } from "@/components/hex-monitor";
import { CameraConfig, PTZCommand } from "@/lib/types";

export default function DashboardPage() {
    const { data: session, status } = useSession() ?? {};
    const router = useRouter();
    const [cameras, setCameras]             = useState<CameraConfig[]>([]);
    const [selectedCamera, setSelectedCamera] = useState<CameraConfig | null>(null);
    const [connectionStatus, setConnectionStatus] =
        useState<"disconnected" | "connecting" | "connected">("disconnected");
    const [showAddModal, setShowAddModal]   = useState(false);
    const [editCamera, setEditCamera]       = useState<CameraConfig | null>(null);
    const [showSettings, setShowSettings]   = useState(false);
    const [showAdmin, setShowAdmin]         = useState(false);
    const [showProxyDownload, setShowProxyDownload] = useState(false);
    const [failedProxyUrl, setFailedProxyUrl] = useState("");
    const [loading, setLoading]             = useState(true);
    const [wsConnection, setWsConnection]   = useState<WebSocket | null>(null);
    const [hexLogs, setHexLogs]             = useState<HexLogEntry[]>([]);
    const logIdCounter = useRef(0);
    const MAX_HEX_LOGS = 500; // Circular buffer 최대 크기

    // ── 오프라인 모드 ──────────────────────────────────────────
    const [isOfflineMode, setIsOfflineMode] = useState(false);

    // ── 라이선스 상태 (헤더 뱃지용) ───────────────────────────
    const [isLicensed, setIsLicensed]       = useState(false);
    const [licenseExpiry, setLicenseExpiry] = useState('');

    // ── PTZ 기능 허가 여부 ────────────────────────────────────
    // - 오프라인 모드: 유효한 라이선스 파일이 있어야 허가
    // - 온라인 모드:  neon DB의 approved 필드(=true) 이거나 관리자 계정
    const sessionUser = session?.user as { approved?: boolean; role?: string } | undefined;
    const isApproved: boolean = isOfflineMode
        ? isLicensed
        : (sessionUser?.approved === true || sessionUser?.role === 'admin');

    // ─── Hex 로그 추가 (Circular buffer) ─────────────────────
    const addHexLog = useCallback(
        (type: "tx" | "rx", data: number[] | string, description?: string) => {
            const entry: HexLogEntry = {
                id:          `${Date.now()}-${logIdCounter.current++}`,
                timestamp:   new Date(),
                type,
                data,
                description,
            };
            setHexLogs((prev) => {
                if (prev.length >= MAX_HEX_LOGS) {
                    const next = new Array(MAX_HEX_LOGS);
                    for (let i = 0; i < MAX_HEX_LOGS - 1; i++) next[i] = prev[i + 1];
                    next[MAX_HEX_LOGS - 1] = entry;
                    return next;
                }
                return [...prev, entry];
            });
        },
        [],
    );

    // ─── 카메라 목록 조회 ─────────────────────────────────────
    const fetchCameras = useCallback(async () => {
        try {
            const res  = await fetch("/api/config/cameras");
            const data = await res.json();
            setCameras(data?.cameras ?? []);
        } catch (err) {
            console.error("Failed to fetch cameras:", err);
        } finally {
            setLoading(false);
        }
    }, []);

    // 오프라인 모드 플래그 확인 + 미인증 리다이렉트
    useEffect(() => {
        const offline = sessionStorage.getItem("offlineMode") === "true";
        setIsOfflineMode(offline);
        if (status === "unauthenticated" && !offline) router.replace("/login");
        if (offline && status === "loading") fetchCameras();
    }, [status, router, fetchCameras]);

    // 라이선스 상태 확인
    useEffect(() => {
        fetch("/api/license/verify")
            .then((r) => r.json())
            .then((d) => {
                if (d.valid) { setIsLicensed(true); setLicenseExpiry(d.expiresAt ?? ""); }
            })
            .catch(() => {});
    }, []);

    useEffect(() => {
        if (status === "authenticated" || isOfflineMode) fetchCameras();
    }, [status, isOfflineMode, fetchCameras]);

    // ─── 카메라 연결 (Proxy 전용) ─────────────────────────────
    const handleConnect = async (camera: CameraConfig) => {
        if (!isApproved) return; // 허가 없으면 연결 차단
        setConnectionStatus("connecting");
        try {
            const res  = await fetch("/api/ptz/connect", {
                method:  "POST",
                headers: { "Content-Type": "application/json" },
                body:    JSON.stringify({ cameraId: camera.id }),
            });
            const data = await res.json();

            if (!data?.proxyUrl) {
                setConnectionStatus("disconnected");
                return;
            }

            // proxyUrl로 직접 WebSocket 연결
            const wsUrl = data.proxyUrl as string;
            const ws    = new WebSocket(wsUrl);

            // 5초 내 연결 실패 → Proxy 다운로드 안내
            const timeout = setTimeout(() => {
                ws.close();
                setConnectionStatus("disconnected");
                setFailedProxyUrl(wsUrl);
                setShowProxyDownload(true);
            }, 5000);

            ws.onopen = () => {
                clearTimeout(timeout);
                addHexLog("rx", "WebSocket Connected", wsUrl);

                // connect 메시지를 먼저 전송 후 상태 업데이트
                // (setWsConnection/setConnectionStatus 가 리렌더링을 유발하므로
                //  send 를 먼저 호출해야 토큰 인증 중 버퍼링된 메시지와 타이밍이 맞음)
                ws.send(JSON.stringify({
                    type:   "connect",
                    config: {
                        host:         camera.host         ?? '',
                        port:         camera.port         ?? 4001,
                        protocol:     camera.protocol     ?? 'pelcod',
                        address:      camera.address      ?? 1,
                        // ONVIF 전용 필드
                        username:     camera.username     ?? '',
                        password:     camera.password     ?? '',
                        profileToken: camera.profileToken ?? '',
                    },
                }));

                setWsConnection(ws);
                setConnectionStatus("connected");
            };

            ws.onmessage = (event) => {
                try {
                    const msg = JSON.parse(event.data);
                    switch (msg.type) {
                        case "command_sent":
                            // proxy → 카메라로 나간 패킷 → TX
                            if (msg.packet) addHexLog("tx", msg.packet, "→ Camera");
                            break;
                        case "camera_data":
                            // 카메라 → proxy → 브라우저 수신 데이터 → RX
                            if (msg.packet) addHexLog("rx", msg.packet, "← Camera");
                            break;
                        case "connected":
                            addHexLog("rx", msg.message || "PTZ Connected", "connect");
                            break;
                        case "disconnected":
                            addHexLog("rx", "PTZ Disconnected", "disconnect");
                            break;
                        case "error":
                            addHexLog("rx", `Error: ${msg.message}`, "error");
                            break;
                        case "pong":
                            // heartbeat 응답 — 로그 생략
                            break;
                        default:
                            if (msg.data) addHexLog("rx", msg.data, msg.type || "response");
                    }
                } catch {
                    addHexLog("rx", event.data, "raw");
                }
            };

            ws.onerror = () => {
                clearTimeout(timeout);
                setConnectionStatus("disconnected");
                setFailedProxyUrl(wsUrl);
                setShowProxyDownload(true);
                addHexLog("rx", "WebSocket Error", "error");
            };

            ws.onclose = () => {
                clearTimeout(timeout);
                setConnectionStatus("disconnected");
                setWsConnection(null);
                addHexLog("rx", "WebSocket Disconnected", "disconnect");
            };
        } catch (err) {
            console.error("Connection error:", err);
            setConnectionStatus("disconnected");
        }
    };

    // ─── 카메라 연결 해제 ─────────────────────────────────────
    const handleDisconnect = useCallback(() => {
        if (wsConnection) {
            // proxy 에 연결 해제 요청 후 WebSocket 닫기
            try { wsConnection.send(JSON.stringify({ type: "disconnect" })); } catch { /* ignore */ }
            wsConnection.close();
            setWsConnection(null);
        }
        setConnectionStatus("disconnected");
    }, [wsConnection]);

    // ─── Heartbeat (30초마다 WebSocket 상태 확인) ─────────────
    useEffect(() => {
        if (connectionStatus !== "connected") return;

        const HEARTBEAT_MS = 30_000;
        const timer = setInterval(() => {
            if (!wsConnection || wsConnection.readyState !== WebSocket.OPEN) {
                addHexLog("rx", "Heartbeat: 연결 끊김 감지", "heartbeat");
                setConnectionStatus("disconnected");
                setWsConnection(null);
                return;
            }
            try {
                wsConnection.send(JSON.stringify({ type: "ping" }));
            } catch {
                setConnectionStatus("disconnected");
                setWsConnection(null);
            }
        }, HEARTBEAT_MS);

        return () => clearInterval(timer);
    }, [connectionStatus, wsConnection, addHexLog]);

    // ─── PTZ 명령 전송 (WebSocket 직접 전송) ─────────────────
    const sendCommand = useCallback((command: PTZCommand) => {
        if (!isApproved) return; // 허가 없으면 명령 차단
        if (!selectedCamera || !wsConnection || wsConnection.readyState !== WebSocket.OPEN) return;

        wsConnection.send(JSON.stringify({
            type:    "command",
            command: {
                ...command,
                address:  selectedCamera.address  ?? 1,
                protocol: selectedCamera.protocol ?? "pelcod",
            },
        }));
    }, [isApproved, selectedCamera, wsConnection]);

    const handleSelectCamera = (camera: CameraConfig) => {
        if (selectedCamera?.id !== camera.id) handleDisconnect();
        setSelectedCamera(camera);
    };

    const handleCameraAdded = () => {
        fetchCameras();
        setShowAddModal(false);
    };

    if ((status === "loading" && !isOfflineMode) || loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background">
                <Loader2 className="w-10 h-10 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background">
            {/* Header */}
            <header className="sticky top-0 z-50 backdrop-blur-lg bg-background/80 border-b border-border">
                <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="bg-primary/20 p-2 rounded-lg">
                            <Camera className="w-6 h-6 text-primary" />
                        </div>
                        <h1 className="text-xl font-bold">TYCHE PTZ Controller</h1>
                        {isLicensed && (
                            <div
                                title={`오프라인 라이선스 보유중${licenseExpiry ? " · 만료: " + licenseExpiry.slice(0, 10) : ""}`}
                                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-500/15 border border-green-500/40 text-green-500 text-xs font-semibold select-none"
                            >
                                <ShieldCheck className="w-3.5 h-3.5" />
                                <span className="hidden sm:inline">Licensed</span>
                            </div>
                        )}
                    </div>
                    <div className="flex items-center gap-3">
                        <span className="text-muted-foreground text-sm hidden sm:block">
                            {isOfflineMode ? "오프라인 모드" : session?.user?.email}
                        </span>
                        {!isOfflineMode && (session?.user as { role?: string })?.role === "admin" && (
                            <button
                                onClick={() => setShowAdmin(true)}
                                className="p-2 hover:bg-amber-500/20 text-amber-500 rounded-lg transition-colors"
                                title="관리자 설정"
                            >
                                <Shield className="w-5 h-5" />
                            </button>
                        )}
                        <button onClick={() => setShowSettings(true)} className="p-2 hover:bg-muted rounded-lg transition-colors">
                            <Settings className="w-5 h-5" />
                        </button>
                        <button
                            onClick={async () => {
                                if (isOfflineMode) {
                                    sessionStorage.removeItem("offlineMode");
                                } else {
                                    await signOut({ redirect: false });
                                }
                                window.location.href = "/login";
                            }}
                            className="p-2 hover:bg-muted rounded-lg transition-colors text-destructive"
                            title="로그아웃"
                        >
                            <LogOut className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            </header>

            {/* 오프라인 배너 */}
            {isOfflineMode && (
                <div className="bg-amber-500/10 border-b border-amber-500/30 px-4 py-2">
                    <div className="max-w-7xl mx-auto flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400">
                        <AlertTriangle className="w-4 h-4 shrink-0" />
                        <span>오프라인 모드 — DB 연결 없이 실행 중입니다. 관리자 기능을 사용하려면 DB 연결 후 재로그인하세요.</span>
                    </div>
                </div>
            )}

            <main className="max-w-7xl mx-auto px-4 py-6">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Camera List */}
                    <div className="lg:col-span-1">
                        <motion.div
                            initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
                            className="relative bg-card/50 backdrop-blur rounded-xl border border-border p-4"
                        >
                            {/* 허가 없음 오버레이 */}
                            {!isApproved && (
                                <div className="absolute inset-0 z-10 rounded-xl bg-background/80 backdrop-blur-sm flex flex-col items-center justify-center gap-2">
                                    <Lock className="w-8 h-8 text-amber-500" />
                                    <p className="font-semibold text-amber-500 text-sm">PTZ 제어 제한됨</p>
                                    <p className="text-xs text-muted-foreground text-center px-4">
                                        {isOfflineMode
                                            ? "유효한 오프라인 라이선스가 없습니다"
                                            : "관리자 승인이 필요합니다 (설정 → 라이선스 발급 요청)"}
                                    </p>
                                </div>
                            )}
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-lg font-semibold flex items-center gap-2">
                                    <Video className="w-5 h-5 text-primary" />
                                    Cameras
                                </h2>
                                <button
                                    onClick={() => isApproved && setShowAddModal(true)}
                                    disabled={!isApproved}
                                    className={`p-2 rounded-lg transition-colors ${
                                        isApproved
                                            ? "bg-primary hover:bg-primary/90 text-primary-foreground"
                                            : "bg-muted text-muted-foreground cursor-not-allowed"
                                    }`}
                                    title={!isApproved ? "PTZ 제어 권한 없음" : "카메라 추가"}
                                >
                                    <Plus className="w-4 h-4" />
                                </button>
                            </div>
                            <CameraList
                                cameras={cameras}
                                selectedCamera={selectedCamera}
                                onSelect={isApproved ? handleSelectCamera : () => {}}
                                onRefresh={fetchCameras}
                                onEdit={isApproved ? (camera) => { setEditCamera(camera); setShowAddModal(true); } : undefined}
                            />
                        </motion.div>
                    </div>

                    {/* Control Panel */}
                    <div className="lg:col-span-2">
                        <motion.div
                            initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
                            className="relative bg-card/50 backdrop-blur rounded-xl border border-border p-6"
                        >
                            {/* 허가 없음 오버레이 */}
                            {!isApproved && (
                                <div className="absolute inset-0 z-10 rounded-xl bg-background/80 backdrop-blur-sm flex flex-col items-center justify-center gap-2">
                                    <Lock className="w-12 h-12 text-amber-500" />
                                    <p className="font-semibold text-amber-500">PTZ 제어 비활성화</p>
                                    <p className="text-sm text-muted-foreground text-center max-w-xs">
                                        {isOfflineMode
                                            ? "유효한 오프라인 라이선스가 없어 카메라 제어를 사용할 수 없습니다."
                                            : "라이선스 발급 요청 후 관리자 승인이 필요합니다. (우측 상단 ⚙ 설정)"}
                                    </p>
                                </div>
                            )}
                            {selectedCamera ? (
                                <>
                                    <div className="flex items-center justify-between mb-6">
                                        <div>
                                            <h2 className="text-xl font-semibold">{selectedCamera.name}</h2>
                                            <p className="text-muted-foreground text-sm">
                                                {selectedCamera.protocol?.toUpperCase()} | Proxy Mode
                                                {selectedCamera.proxyUrl && (
                                                    <span className="ml-1 text-xs opacity-60">
                                                        ({selectedCamera.proxyUrl})
                                                    </span>
                                                )}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm ${
                                                connectionStatus === "connected"
                                                    ? "bg-green-500/20 text-green-500 dark:text-green-400"
                                                    : connectionStatus === "connecting"
                                                        ? "bg-yellow-500/20 text-yellow-600 dark:text-yellow-400"
                                                        : "bg-muted text-muted-foreground"
                                            }`}>
                                                {connectionStatus === "connected"
                                                    ? <Wifi className="w-4 h-4" />
                                                    : <WifiOff className="w-4 h-4" />}
                                                {connectionStatus === "connecting" ? "Connecting..." : connectionStatus}
                                            </div>
                                            {connectionStatus === "disconnected" ? (
                                                <button
                                                    onClick={() => handleConnect(selectedCamera)}
                                                    className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg transition-colors text-sm font-medium"
                                                >
                                                    Connect
                                                </button>
                                            ) : (
                                                <button
                                                    onClick={handleDisconnect}
                                                    className="px-4 py-2 bg-destructive hover:bg-destructive/90 text-destructive-foreground rounded-lg transition-colors text-sm font-medium"
                                                >
                                                    Disconnect
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                    <PTZControlPanel
                                        camera={selectedCamera}
                                        connected={connectionStatus === "connected"}
                                        onCommand={sendCommand}
                                    />
                                </>
                            ) : (
                                <div className="text-center py-16">
                                    <Camera className="w-16 h-16 text-muted-foreground/50 mx-auto mb-4" />
                                    <h3 className="text-lg font-medium text-muted-foreground mb-2">No Camera Selected</h3>
                                    <p className="text-muted-foreground/70">Select a camera from the list or add a new one</p>
                                </div>
                            )}
                        </motion.div>
                    </div>
                </div>
            </main>

            {/* Modals */}
            {showAddModal && (
                <AddCameraModal
                    onClose={() => { setShowAddModal(false); setEditCamera(null); }}
                    onSave={() => { handleCameraAdded(); setEditCamera(null); }}
                    editCamera={editCamera}
                />
            )}
            {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
            {showAdmin    && <AdminModal    onClose={() => setShowAdmin(false)} />}

            <ProxyDownloadModal
                isOpen={showProxyDownload}
                onClose={() => setShowProxyDownload(false)}
                proxyUrl={failedProxyUrl}
            />

            <HexMonitor logs={hexLogs} onClear={() => setHexLogs([])} />
            <div className="h-12" />
        </div>
    );
}
