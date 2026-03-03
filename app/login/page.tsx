"use client";

import { useState, useEffect } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
    Camera,
    Mail,
    Lock,
    Loader2,
    Eye,
    EyeOff,
    UserPlus,
    WifiOff,
    RefreshCw,
    Download,
    Upload,
    CheckCircle,
    XCircle,
    FileKey,
    AlertTriangle,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

// ── 오프라인 라이센스 UI 단계 ───────────────────────────────
type OfflineStep =
    | "idle" // 오프라인 배너만 표시
    | "check" // 기존 라이센스 확인 중
    | "licensed" // 유효한 라이센스 있음 → 바로 진행 가능
    | "no_license" // 라이센스 없음 → 요청 파일 안내
    | "upload" // 라이센스 파일 업로드 대기
    | "invalid"; // 라이센스 검증 실패

export default function LoginPage() {
    const router = useRouter();
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [name, setName] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    // ── 오프라인 + 라이센스 상태 ────────────────────────────
    const [isOffline, setIsOffline] = useState(false);
    const [offlineChecking, setOfflineChecking] = useState(true);
    const [retrying, setRetrying] = useState(false);
    const [offlineStep, setOfflineStep] = useState<OfflineStep>("idle");
    const [licenseInfo, setLicenseInfo] = useState<{
        expiresAt: string;
    } | null>(null);
    const [licenseError, setLicenseError] = useState("");
    const [uploading, setUploading] = useState(false);
    const [downloadingReq, setDownloadingReq] = useState(false);

    // 페이지 로드 시 DB 연결 상태 확인
    useEffect(() => {
        checkOfflineStatus();
    }, []);

    const checkOfflineStatus = async () => {
        setOfflineChecking(true);
        try {
            const res = await fetch("/api/offline-status");
            const data = await res.json();
            setIsOffline(data.offline);
        } catch {
            setIsOffline(true);
        } finally {
            setOfflineChecking(false);
        }
    };

    // DB 재연결 시도
    const handleRetryConnection = async () => {
        setRetrying(true);
        setError("");
        try {
            const res = await fetch("/api/offline-status", { method: "POST" });
            const data = await res.json();
            setIsOffline(data.offline);
            if (!data.offline) setOfflineStep("idle");
        } catch {
            setIsOffline(true);
        } finally {
            setRetrying(false);
        }
    };

    // ── "오프라인으로 계속" 클릭 → 라이센스 확인 ────────────
    const handleOfflineClick = async () => {
        setOfflineStep("check");
        setLicenseError("");
        try {
            const res = await fetch("/api/license/verify");
            const data = await res.json();
            if (data.valid) {
                // 유효한 라이센스 있음
                setLicenseInfo({ expiresAt: data.expiresAt });
                setOfflineStep("licensed");
            } else if (data.reason === "NOT_FOUND") {
                // 라이센스 파일 없음
                setOfflineStep("no_license");
            } else {
                // 라이센스 있지만 무효
                setLicenseError(data.reason ?? "라이센스가 유효하지 않습니다");
                setOfflineStep("invalid");
            }
        } catch {
            setLicenseError("라이센스 확인 중 오류가 발생했습니다");
            setOfflineStep("invalid");
        }
    };

    // ── 라이센스 통과 → 오프라인 모드 진입 ──────────────────
    const handleEnterOffline = () => {
        sessionStorage.setItem("offlineMode", "true");
        router.replace("/dashboard");
    };

    // ── 요청 파일 다운로드 ───────────────────────────────────
    const handleDownloadRequest = async () => {
        setDownloadingReq(true);
        try {
            const res = await fetch("/api/license/request");
            if (!res.ok) throw new Error("요청 파일 생성 실패");
            const blob = await res.blob();
            const cd = res.headers.get("Content-Disposition") ?? "";
            const name = cd.match(/filename="(.+)"/)?.[1] ?? "license.ptzreq";
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = name;
            a.click();
            URL.revokeObjectURL(url);
            // 다운로드 후 업로드 단계로 이동
            setOfflineStep("upload");
        } catch (e) {
            setLicenseError((e as Error).message);
        } finally {
            setDownloadingReq(false);
        }
    };

    // ── 라이센스 파일 업로드 + 검증 ─────────────────────────
    const handleLicenseUpload = async (
        e: React.ChangeEvent<HTMLInputElement>,
    ) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setUploading(true);
        setLicenseError("");
        try {
            const formData = new FormData();
            formData.append("license", file);
            const res = await fetch("/api/license/verify", {
                method: "POST",
                body: formData,
            });
            const data = await res.json();
            if (res.ok && data.success) {
                setLicenseInfo({ expiresAt: data.expiresAt });
                setOfflineStep("licensed");
            } else {
                setLicenseError(data.error ?? "라이센스 검증에 실패했습니다");
                setOfflineStep("invalid");
            }
        } catch {
            setLicenseError("파일 업로드 중 오류가 발생했습니다");
            setOfflineStep("invalid");
        } finally {
            setUploading(false);
            e.target.value = ""; // input 초기화 (같은 파일 재시도 가능하도록)
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setLoading(true);
        try {
            if (!isLogin) {
                // Sign up
                const res = await fetch("/api/signup", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ email, password, name }),
                });
                const data = await res.json();
                if (!res?.ok) {
                    setError(data?.error ?? "Signup failed");
                    setLoading(false);
                    return;
                }
            }
            const result = await signIn("credentials", {
                email,
                password,
                redirect: false,
            });
            if (result?.error) {
                setError("Invalid credentials");
                setLoading(false);
            } else router.replace("/dashboard");
        } catch {
            setError("An error occurred");
            setLoading(false);
        }
    };

    // ── 오프라인 단계별 컨텐츠 렌더링 ───────────────────────
    const renderOfflineContent = () => {
        // [check] 확인 중 스피너
        if (offlineStep === "check") {
            return (
                <div className="flex items-center justify-center gap-2 py-3 text-sm text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>라이센스 확인 중...</span>
                </div>
            );
        }

        // [licensed] 유효한 라이센스 확인됨
        if (offlineStep === "licensed") {
            return (
                <div className="space-y-3">
                    <div className="flex items-center gap-2 text-green-500">
                        <CheckCircle className="w-4 h-4 shrink-0" />
                        <span className="text-sm font-medium">
                            라이센스 확인됨
                        </span>
                    </div>
                    {licenseInfo && (
                        <p className="text-xs text-muted-foreground">
                            만료일: {licenseInfo.expiresAt.slice(0, 10)}
                        </p>
                    )}
                    <button
                        onClick={handleEnterOffline}
                        className="w-full py-2.5 bg-amber-500 hover:bg-amber-500/90 text-white text-sm font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
                    >
                        <WifiOff className="w-4 h-4" />
                        오프라인 모드로 진입
                    </button>
                </div>
            );
        }

        // [no_license] 라이센스 없음 → 요청 파일 안내
        if (offlineStep === "no_license") {
            return (
                <div className="space-y-3">
                    <p className="text-xs text-muted-foreground leading-relaxed">
                        오프라인 모드는 제공자의 라이센스가 필요합니다. 아래에서
                        요청 파일을 다운로드하여 제공자에게 전달하세요.
                    </p>
                    <button
                        onClick={handleDownloadRequest}
                        disabled={downloadingReq}
                        className="w-full py-2 bg-blue-600 hover:bg-blue-600/90 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
                    >
                        {downloadingReq ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <Download className="w-4 h-4" />
                        )}
                        요청 파일 다운로드 (.ptzreq)
                    </button>
                    <p className="text-xs text-muted-foreground text-center">
                        라이센스(.ptzlic)를 받으셨나요?
                    </p>
                    <label className="w-full py-2 bg-muted hover:bg-muted/80 text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer">
                        <Upload className="w-4 h-4" />
                        라이센스 파일 업로드 (.ptzlic)
                        <input
                            type="file"
                            accept=".ptzlic"
                            className="hidden"
                            onChange={handleLicenseUpload}
                        />
                    </label>
                </div>
            );
        }

        // [upload] 요청 파일 다운로드 완료 → 라이센스 파일 대기
        if (offlineStep === "upload") {
            return (
                <div className="space-y-3">
                    <div className="flex items-start gap-2 text-xs text-muted-foreground">
                        <FileKey className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                        <span>
                            요청 파일이 다운로드되었습니다. 제공자에게 전달하고
                            발급받은 라이센스 파일을 업로드하세요.
                        </span>
                    </div>
                    {licenseError && (
                        <div className="flex items-start gap-2 text-xs text-destructive bg-destructive/10 p-2 rounded-lg">
                            <XCircle className="w-4 h-4 shrink-0 mt-0.5" />
                            <span className="whitespace-pre-line">
                                {licenseError}
                            </span>
                        </div>
                    )}
                    {uploading ? (
                        <div className="flex items-center justify-center gap-2 py-2 text-sm text-muted-foreground">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>검증 중...</span>
                        </div>
                    ) : (
                        <label className="w-full py-2.5 bg-amber-500 hover:bg-amber-500/90 text-white text-sm font-semibold rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer">
                            <Upload className="w-4 h-4" />
                            라이센스 파일 업로드 (.ptzlic)
                            <input
                                type="file"
                                accept=".ptzlic"
                                className="hidden"
                                onChange={handleLicenseUpload}
                            />
                        </label>
                    )}
                    <button
                        onClick={() => setOfflineStep("no_license")}
                        className="w-full py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                        ← 돌아가기
                    </button>
                </div>
            );
        }

        // [invalid] 라이센스 검증 실패
        if (offlineStep === "invalid") {
            return (
                <div className="space-y-3">
                    <div className="flex items-start gap-2 text-xs text-destructive bg-destructive/10 p-2 rounded-lg">
                        <XCircle className="w-4 h-4 shrink-0 mt-0.5" />
                        <span className="whitespace-pre-line">
                            {licenseError}
                        </span>
                    </div>
                    <label className="w-full py-2 bg-muted hover:bg-muted/80 text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer">
                        <Upload className="w-4 h-4" />
                        다른 라이센스 파일 업로드
                        <input
                            type="file"
                            accept=".ptzlic"
                            className="hidden"
                            onChange={handleLicenseUpload}
                        />
                    </label>
                    <button
                        onClick={() => {
                            setOfflineStep("idle");
                            setLicenseError("");
                        }}
                        className="w-full py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                        ← 돌아가기
                    </button>
                </div>
            );
        }

        // [idle] 초기 오프라인 배너
        return (
            <div className="space-y-3">
                <div className="flex items-center gap-2">
                    <WifiOff className="w-4 h-4 text-amber-500 shrink-0" />
                    <span className="text-sm font-semibold text-amber-500">
                        DB 서버에 연결할 수 없습니다
                    </span>
                </div>
                <p className="text-xs text-muted-foreground">
                    오프라인 모드로 계속하려면 제공자 라이센스가 필요합니다.
                </p>
                <div className="flex gap-2">
                    <button
                        onClick={handleOfflineClick}
                        className="flex-1 py-2 bg-amber-500 hover:bg-amber-500/90 text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-1.5"
                    >
                        <FileKey className="w-3.5 h-3.5" />
                        오프라인으로 계속
                    </button>
                    <button
                        onClick={handleRetryConnection}
                        disabled={retrying}
                        title="DB 재연결 시도"
                        className="px-3 py-2 bg-muted hover:bg-muted/80 disabled:opacity-50 rounded-lg transition-colors"
                    >
                        <RefreshCw
                            className={`w-4 h-4 ${retrying ? "animate-spin" : ""}`}
                        />
                    </button>
                </div>
            </div>
        );
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-md"
            >
                <div className="bg-card/50 backdrop-blur-lg rounded-2xl shadow-2xl border border-border p-8">
                    {/* Logo */}
                    <div className="flex items-center justify-center mb-8">
                        <div className="bg-primary/20 p-4 rounded-full">
                            <Camera className="w-12 h-12 text-primary" />
                        </div>
                    </div>
                    <h1 className="text-2xl font-bold text-center mb-2">
                        PTZ Controller
                    </h1>
                    <p className="text-muted-foreground text-center mb-6">
                        {isLogin
                            ? "Sign in to control your cameras"
                            : "Create an account"}
                    </p>

                    {/* ── 오프라인 배너 (DB 오프라인일 때만 표시) ─────── */}
                    <AnimatePresence>
                        {!offlineChecking && isOffline && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: "auto" }}
                                exit={{ opacity: 0, height: 0 }}
                                className="mb-6 overflow-hidden"
                            >
                                <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4">
                                    {renderOfflineContent()}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* ── 에러 메시지 ──────────────────────────────── */}
                    {error && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-lg mb-6"
                        >
                            {error}
                        </motion.div>
                    )}

                    {/* ── 로그인 / 회원가입 폼 ─────────────────────── */}
                    <form onSubmit={handleSubmit} className="space-y-5">
                        {!isLogin && (
                            <div>
                                <label className="block text-sm font-medium mb-2">
                                    Name
                                </label>
                                <div className="relative">
                                    <UserPlus className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                                    <input
                                        type="text"
                                        value={name}
                                        onChange={(e) =>
                                            setName(e?.target?.value ?? "")
                                        }
                                        className="w-full pl-11 pr-4 py-3 bg-muted/50 border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                                        placeholder="Your name"
                                    />
                                </div>
                            </div>
                        )}
                        <div>
                            <label className="block text-sm font-medium mb-2">
                                Email
                            </label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) =>
                                        setEmail(e?.target?.value ?? "")
                                    }
                                    className="w-full pl-11 pr-4 py-3 bg-muted/50 border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                                    placeholder="you@example.com"
                                    required
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-2">
                                Password
                            </label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                                <input
                                    type={showPassword ? "text" : "password"}
                                    value={password}
                                    onChange={(e) =>
                                        setPassword(e?.target?.value ?? "")
                                    }
                                    className="w-full pl-11 pr-12 py-3 bg-muted/50 border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                                    placeholder="••••••••"
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={() =>
                                        setShowPassword(!showPassword)
                                    }
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                >
                                    {showPassword ? (
                                        <EyeOff className="w-5 h-5" />
                                    ) : (
                                        <Eye className="w-5 h-5" />
                                    )}
                                </button>
                            </div>
                        </div>
                        <button
                            type="submit"
                            disabled={loading || offlineChecking}
                            className="w-full py-3 bg-primary hover:bg-primary/90 disabled:bg-primary/50 text-primary-foreground font-medium rounded-lg transition-all flex items-center justify-center gap-2"
                        >
                            {loading ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                            ) : isLogin ? (
                                "Sign In"
                            ) : (
                                "Create Account"
                            )}
                        </button>
                    </form>

                    <div className="mt-6 text-center">
                        <button
                            onClick={() => {
                                setIsLogin(!isLogin);
                                setError("");
                            }}
                            className="text-primary hover:text-primary/80 text-sm"
                        >
                            {isLogin
                                ? "Don't have an account? Sign up"
                                : "Already have an account? Sign in"}
                        </button>
                        <label className="block text-sm font-medium mb-2">
                            <a href="https://www.tyche.pro" target="_blank">
                                TYCHE Inc.
                            </a>
                        </label>
                    </div>
                </div>
            </motion.div>
        </div>
    );
}
