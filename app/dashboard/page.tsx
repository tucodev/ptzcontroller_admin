"use client";

import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import {
    Camera,
    LogOut,
    Settings,
    Plus,
    Loader2,
    Video,
    Wifi,
    WifiOff,
    Shield,
    AlertTriangle,
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
    const [cameras, setCameras] = useState<CameraConfig[]>([]);
    const [selectedCamera, setSelectedCamera] = useState<CameraConfig | null>(null);
    const [connectionStatus, setConnectionStatus] = useState<
        "disconnected" | "connecting" | "connected"
    >("disconnected");
    const [showAddModal, setShowAddModal] = useState(false);
    const [editCamera, setEditCamera] = useState<CameraConfig | null>(null);
    const [showSettings, setShowSettings] = useState(false);
    const [showAdmin, setShowAdmin] = useState(false);
    const [showProxyDownload, setShowProxyDownload] = useState(false);
    const [failedProxyUrl, setFailedProxyUrl] = useState<string>("");
    const [loading, setLoading] = useState(true);
    const [wsConnection, setWsConnection] = useState<WebSocket | null>(null);
    const [hexLogs, setHexLogs] = useState<HexLogEntry[]>([]);
    const logIdCounter = useRef(0);

    // ── 오프라인 모드 ──────────────────────────────────────────
    // login 페이지에서 sessionStorage 에 저장한 플래그로 판단.
    // API 라우트는 requireSession() 내부에서 DB 상태를 확인해 자동으로 통과시킴.
    const [isOfflineMode, setIsOfflineMode] = useState(false);

    // ─── Hex 모니터 로그 추가 헬퍼 ───────────────────────────
    const addHexLog = useCallback(
        (type: "tx" | "rx", data: number[] | string, description?: string) => {
            const entry: HexLogEntry = {
                id: `${Date.now()}-${logIdCounter.current++}`,
                timestamp: new Date(),
                type,
                data,
                description,
            };
            setHexLogs((prev) => [...prev.slice(-2000), entry]); // Keep last 500 --> 2000 logs
        },
        [],
    );

    // 오프라인 모드 플래그 확인 + 미인증 리다이렉트
    useEffect(() => {
        const offline = sessionStorage.getItem("offlineMode") === "true";
        setIsOfflineMode(offline);
        // 오프라인 모드가 아닌 경우에만 로그인 페이지로 리다이렉트
        if (status === "unauthenticated" && !offline) {
            router.replace("/login");
        }
    }, [status, router]);

    // ─── 카메라 목록 조회 ─────────────────────────────────────
    const fetchCameras = useCallback(async () => {
        try {
            const res = await fetch("/api/config/cameras");
            const data = await res.json();
            setCameras(data?.cameras ?? []);
        } catch (error) {
            console.error("Failed to fetch cameras:", error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        // 정상 로그인 또는 오프라인 모드 둘 다 카메라 목록 로드
        if (status === "authenticated" || isOfflineMode) {
            fetchCameras();
        }
    }, [status, isOfflineMode, fetchCameras]);

    // ─── 카메라 연결 ──────────────────────────────────────────
    const handleConnect = async (camera: CameraConfig) => {
        setConnectionStatus("connecting");
        try {
            const res = await fetch("/api/ptz/connect", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ cameraId: camera.id }),
            });
            const data = await res.json();

            if (camera.operationMode === "proxy" && data?.proxyUrl) {
                // ─── Proxy 모드: WebSocket 직접 연결 ──────────
                const proxyUrl = data.proxyUrl;
                const ws = new WebSocket(proxyUrl);

                // 연결 타임아웃 5초 — 응답 없으면 Proxy 다운로드 모달 표시
                const connectionTimeout = setTimeout(() => {
                    ws.close();
                    setConnectionStatus("disconnected");
                    setFailedProxyUrl(proxyUrl);
                    setShowProxyDownload(true);
                }, 5000);

                ws.onopen = () => {
                    clearTimeout(connectionTimeout);
                    setConnectionStatus("connected");
                    setWsConnection(ws);
                    addHexLog("rx", "WebSocket Connected", proxyUrl);
                };

                ws.onmessage = (event) => {
                    try {
                        const msg = JSON.parse(event.data);
                        switch (msg.type) {
                            case "command_sent":
                                // proxy 가 command 타입 메시지를 처리하고 돌려준 ACK
                                if (msg.packet) addHexLog("rx", msg.packet, "ACK");
                                break;
                            case "raw_sent":
                                // proxy 가 raw 패킷 배열을 그대로 전송한 ACK
                                if (msg.packet) addHexLog("rx", msg.packet, "RAW ACK");
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
                                // ping/pong 헬스체크는 로그 생략
                                break;
                            default:
                                if (msg.data) addHexLog("rx", msg.data, msg.type || "response");
                        }
                    } catch {
                        // JSON 파싱 불가 → raw string 로그
                        addHexLog("rx", event.data, "raw");
                    }
                };

                ws.onerror = () => {
                    clearTimeout(connectionTimeout);
                    setConnectionStatus("disconnected");
                    setFailedProxyUrl(proxyUrl);
                    setShowProxyDownload(true);
                    addHexLog("rx", "WebSocket Error", "error");
                };

                ws.onclose = () => {
                    clearTimeout(connectionTimeout);
                    setConnectionStatus("disconnected");
                    setWsConnection(null);
                    addHexLog("rx", "WebSocket Disconnected", "disconnect");
                };
            } else if (data?.success) {
                // Direct 모드 연결 성공
                setConnectionStatus("connected");
            } else {
                setConnectionStatus("disconnected");
            }
        } catch (error) {
            console.error("Connection error:", error);
            setConnectionStatus("disconnected");
        }
    };

    // ─── 카메라 연결 해제 ─────────────────────────────────────
    const handleDisconnect = async () => {
        // Proxy 모드: WebSocket 닫기
        if (wsConnection) {
            wsConnection.close();
            setWsConnection(null);
        }
        // Direct 모드: 서버 측 TCP 소켓 해제
        if (selectedCamera) {
            await fetch("/api/ptz/disconnect", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ cameraId: selectedCamera.id }),
            });
        }
        setConnectionStatus("disconnected");
    };

    // ─── PTZ 명령 전송 ────────────────────────────────────────
    const sendCommand = async (command: PTZCommand) => {
        if (!selectedCamera) return;

        try {
            const res = await fetch("/api/ptz/command", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ cameraId: selectedCamera.id, command }),
            });
            const data = await res.json();

            // Proxy 모드: 서버가 생성한 패킷을 WebSocket 으로 proxy 에 전송
            if (data?.mode === "proxy" && wsConnection && data?.packet) {
                const cmdDesc = `${command.action}${command.direction ? `:${command.direction}` : ""}`;
                addHexLog("tx", data.packet, cmdDesc);

                // ⚠️ 버그 수정: 'command' 타입은 proxy 가 msg.command.action 을 요구하므로 동작 안 함
                //   'raw' 타입으로 전송해야 proxy 가 packet 배열을 그대로 카메라에 전달
                wsConnection.send(
                    JSON.stringify({ type: "raw", packet: data.packet }),
                );
            }
        } catch (error) {
            console.error("Command error:", error);
        }
    };

    const handleSelectCamera = (camera: CameraConfig) => {
        // 다른 카메라 선택 시 기존 연결 해제
        if (selectedCamera?.id !== camera.id) {
            handleDisconnect();
        }
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
                    </div>

                    <div className="flex items-center gap-3">
                        <span className="text-muted-foreground text-sm hidden sm:block">
                            {isOfflineMode ? "오프라인 모드" : session?.user?.email}
                        </span>
                        {/* admin 역할이고 오프라인이 아닌 경우만 관리자 버튼 표시 */}
                        {!isOfflineMode && (session?.user as { role?: string })?.role === "admin" && (
                            <button
                                onClick={() => setShowAdmin(true)}
                                className="p-2 hover:bg-amber-500/20 text-amber-500 rounded-lg transition-colors"
                                title="관리자 설정"
                            >
                                <Shield className="w-5 h-5" />
                            </button>
                        )}
                        <button
                            onClick={() => setShowSettings(true)}
                            className="p-2 hover:bg-muted rounded-lg transition-colors"
                        >
                            <Settings className="w-5 h-5" />
                        </button>
                        {/* 로그아웃: 오프라인이면 sessionStorage 정리, 온라인이면 signOut */}
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

            {/* ── 오프라인 모드 배너 ───────────────────────────────────── */}
            {isOfflineMode && (
                <div className="bg-amber-500/10 border-b border-amber-500/30 px-4 py-2">
                    <div className="max-w-7xl mx-auto flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400">
                        <AlertTriangle className="w-4 h-4 shrink-0" />
                        <span>
                            오프라인 모드 — DB 연결 없이 실행 중입니다. 관리자 기능을 사용하려면 DB 연결 후 재로그인하세요.
                        </span>
                    </div>
                </div>
            )}

            <main className="max-w-7xl mx-auto px-4 py-6">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Camera List */}
                    <div className="lg:col-span-1">
                        <motion.div
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="bg-card/50 backdrop-blur rounded-xl border border-border p-4"
                        >
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-lg font-semibold flex items-center gap-2">
                                    <Video className="w-5 h-5 text-primary" />
                                    Cameras
                                </h2>
                                <button
                                    onClick={() => setShowAddModal(true)}
                                    className="p-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg transition-colors"
                                >
                                    <Plus className="w-4 h-4" />
                                </button>
                            </div>

                            <CameraList
                                cameras={cameras}
                                selectedCamera={selectedCamera}
                                onSelect={handleSelectCamera}
                                onRefresh={fetchCameras}
                                onEdit={(camera) => {
                                    setEditCamera(camera);
                                    setShowAddModal(true);
                                }}
                            />
                        </motion.div>
                    </div>

                    {/* Control Panel */}
                    <div className="lg:col-span-2">
                        <motion.div
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="bg-card/50 backdrop-blur rounded-xl border border-border p-6"
                        >
                            {selectedCamera ? (
                                <>
                                    {/* Camera Info & Connection */}
                                    <div className="flex items-center justify-between mb-6">
                                        <div>
                                            <h2 className="text-xl font-semibold">
                                                {selectedCamera.name}
                                            </h2>
                                            <p className="text-muted-foreground text-sm">
                                                {selectedCamera.protocol?.toUpperCase()}{" "}|{" "}
                                                {selectedCamera.operationMode === "proxy"
                                                    ? "Proxy Mode"
                                                    : "Direct Mode"}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <div
                                                className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm ${
                                                    connectionStatus === "connected"
                                                        ? "bg-green-500/20 text-green-500 dark:text-green-400"
                                                        : connectionStatus === "connecting"
                                                          ? "bg-yellow-500/20 text-yellow-600 dark:text-yellow-400"
                                                          : "bg-muted text-muted-foreground"
                                                }`}
                                            >
                                                {connectionStatus === "connected" ? (
                                                    <Wifi className="w-4 h-4" />
                                                ) : (
                                                    <WifiOff className="w-4 h-4" />
                                                )}
                                                {connectionStatus === "connecting"
                                                    ? "Connecting..."
                                                    : connectionStatus}
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

                                    {/* PTZ Controls */}
                                    <PTZControlPanel
                                        camera={selectedCamera}
                                        connected={connectionStatus === "connected"}
                                        onCommand={sendCommand}
                                    />
                                </>
                            ) : (
                                <div className="text-center py-16">
                                    <Camera className="w-16 h-16 text-muted-foreground/50 mx-auto mb-4" />
                                    <h3 className="text-lg font-medium text-muted-foreground mb-2">
                                        No Camera Selected
                                    </h3>
                                    <p className="text-muted-foreground/70">
                                        Select a camera from the list or add a new one
                                    </p>
                                </div>
                            )}
                        </motion.div>
                    </div>
                </div>
            </main>

            {/* Modals */}
            {showAddModal && (
                <AddCameraModal
                    onClose={() => {
                        setShowAddModal(false);
                        setEditCamera(null);
                    }}
                    onSave={() => {
                        handleCameraAdded();
                        setEditCamera(null);
                    }}
                    editCamera={editCamera}
                />
            )}

            {showSettings && (
                <SettingsModal onClose={() => setShowSettings(false)} />
            )}

            {showAdmin && (
                <AdminModal onClose={() => setShowAdmin(false)} />
            )}

            <ProxyDownloadModal
                isOpen={showProxyDownload}
                onClose={() => setShowProxyDownload(false)}
                proxyUrl={failedProxyUrl}
            />

            {/* Hex Monitor — 화면 하단 고정 */}
            <HexMonitor logs={hexLogs} onClear={() => setHexLogs([])} />

            {/* Hex Monitor 높이만큼 하단 여백 */}
            <div className="h-12" />
        </div>
    );
}
