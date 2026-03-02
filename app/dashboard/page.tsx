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
    const [selectedCamera, setSelectedCamera] = useState<CameraConfig | null>(
        null,
    );
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

    // Helper to add hex log
    const addHexLog = useCallback(
        (type: "tx" | "rx", data: number[] | string, description?: string) => {
            const entry: HexLogEntry = {
                id: `${Date.now()}-${logIdCounter.current++}`,
                timestamp: new Date(),
                type,
                data,
                description,
            };
            setHexLogs((prev) => [...prev.slice(-500), entry]); // Keep last 500 logs
        },
        [],
    );

    useEffect(() => {
        if (status === "unauthenticated") {
            router.replace("/login");
        }
    }, [status, router]);

    // Fetch cameras
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
        if (status === "authenticated") {
            fetchCameras();
        }
    }, [status, fetchCameras]);

    // Handle camera connection
    const handleConnect = async (camera: CameraConfig) => {
        setConnectionStatus("connecting");
        try {
            const res = await fetch("/api/ptz/connect", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ cameraId: camera?.id }),
            });

            const data = await res.json();

            if (camera?.operationMode === "proxy" && data?.proxyUrl) {
                // Connect via WebSocket for proxy mode
                const proxyUrl = data.proxyUrl;
                const ws = new WebSocket(proxyUrl);

                // 연결 타임아웃 설정 (5초)
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
                                // PTZ 명령 응답 - 실제 전송된 패킷
                                if (msg.packet) {
                                    addHexLog("rx", msg.packet, "ACK");
                                }
                                break;
                            case "raw_sent":
                                // Raw 패킷 응답
                                if (msg.packet) {
                                    addHexLog("rx", msg.packet, "RAW ACK");
                                }
                                break;
                            case "connected":
                                addHexLog(
                                    "rx",
                                    msg.message || "PTZ Connected",
                                    "connect",
                                );
                                break;
                            case "disconnected":
                                addHexLog(
                                    "rx",
                                    "PTZ Disconnected",
                                    "disconnect",
                                );
                                break;
                            case "error":
                                addHexLog(
                                    "rx",
                                    `Error: ${msg.message}`,
                                    "error",
                                );
                                break;
                            case "pong":
                                // ping/pong은 로깅하지 않음
                                break;
                            default:
                                // 기타 응답
                                if (msg.data) {
                                    addHexLog(
                                        "rx",
                                        msg.data,
                                        msg.type || "response",
                                    );
                                }
                        }
                    } catch {
                        // raw string 메시지
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
                setConnectionStatus("connected");
            } else {
                setConnectionStatus("disconnected");
            }
        } catch (error) {
            console.error("Connection error:", error);
            setConnectionStatus("disconnected");
        }
    };

    const handleDisconnect = async () => {
        if (wsConnection) {
            wsConnection?.close?.();
            setWsConnection(null);
        }
        if (selectedCamera) {
            await fetch("/api/ptz/disconnect", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ cameraId: selectedCamera?.id }),
            });
        }
        setConnectionStatus("disconnected");
    };

    // Send PTZ command
    const sendCommand = async (command: PTZCommand) => {
        if (!selectedCamera) return;

        try {
            const res = await fetch("/api/ptz/command", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    cameraId: selectedCamera?.id,
                    command,
                }),
            });

            const data = await res.json();

            // For proxy mode, send via WebSocket
            if (data?.mode === "proxy" && wsConnection && data?.packet) {
                // TX 로그 추가
                const cmdDesc = `${command.action}${command.direction ? `:${command.direction}` : ""}`;
                addHexLog("tx", data.packet, cmdDesc);

                wsConnection?.send?.(
                    JSON.stringify({
                        type: "command",
                        packet: data.packet,
                    }),
                );
            }
        } catch (error) {
            console.error("Command error:", error);
        }
    };

    const handleSelectCamera = (camera: CameraConfig) => {
        if (selectedCamera?.id !== camera?.id) {
            handleDisconnect();
        }
        setSelectedCamera(camera);
    };

    const handleCameraAdded = () => {
        fetchCameras();
        setShowAddModal(false);
    };

    if (status === "loading" || loading) {
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
                        <h1 className="text-xl font-bold">PTZ Controller</h1>
                    </div>

                    <div className="flex items-center gap-3">
                        <span className="text-muted-foreground text-sm hidden sm:block">
                            {session?.user?.email}
                        </span>
                        {(session?.user as { role?: string })?.role === 'admin' && (
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
                        {/* resoulve tuco modify logout redirect problem */}
                        <button
                            onClick={async () => {
                                await signOut({ redirect: false });
                                window.location.href = "/login";
                            }}
                            className="p-2 hover:bg-muted rounded-lg transition-colors text-destructive"
                        >
                            <LogOut className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            </header>

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
                                                {selectedCamera?.name}
                                            </h2>
                                            <p className="text-muted-foreground text-sm">
                                                {selectedCamera?.protocol?.toUpperCase?.()}{" "}
                                                |{" "}
                                                {selectedCamera?.operationMode ===
                                                "proxy"
                                                    ? "Proxy Mode"
                                                    : "Direct Mode"}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <div
                                                className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm ${
                                                    connectionStatus ===
                                                    "connected"
                                                        ? "bg-green-500/20 text-green-500 dark:text-green-400"
                                                        : connectionStatus ===
                                                            "connecting"
                                                          ? "bg-yellow-500/20 text-yellow-600 dark:text-yellow-400"
                                                          : "bg-muted text-muted-foreground"
                                                }`}
                                            >
                                                {connectionStatus ===
                                                "connected" ? (
                                                    <Wifi className="w-4 h-4" />
                                                ) : (
                                                    <WifiOff className="w-4 h-4" />
                                                )}
                                                {connectionStatus ===
                                                "connecting"
                                                    ? "Connecting..."
                                                    : connectionStatus}
                                            </div>
                                            {connectionStatus ===
                                            "disconnected" ? (
                                                <button
                                                    onClick={() =>
                                                        handleConnect(
                                                            selectedCamera,
                                                        )
                                                    }
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
                                        connected={
                                            connectionStatus === "connected"
                                        }
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
                                        Select a camera from the list or add a
                                        new one
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

            {/* Hex Monitor - Docked at bottom */}
            <HexMonitor logs={hexLogs} onClear={() => setHexLogs([])} />

            {/* Bottom padding for Hex Monitor */}
            <div className="h-12" />
        </div>
    );
}
