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
    Building2,
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

type OfflineStep =
    | "idle"
    | "check"
    | "licensed"
    | "no_license"
    | "upload"
    | "invalid"
    | "new_user_info"
    | "user_confirm";

export default function LoginPage() {
    const router = useRouter();
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [name, setName] = useState("");
    const [organization, setOrganization] = useState("");
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

    // ✅ 신규 사용자 정보 입력 상태
    const [newUserInfo, setNewUserInfo] = useState({
        name: "",
        organization: "",
    });
    const [userCreated, setUserCreated] = useState(false);

    // ✅ 사용자 정보 수집 다이얼로그 상태 (이곳에 추가!)
    const [showUserInfoDialog, setShowUserInfoDialog] = useState(false);
    const [userInfoForRequest, setUserInfoForRequest] = useState({
        email: "",
        name: "",
        organization: "",
    });

    // ── useEffect ──────────────────────────────────────────
    useEffect(() => {
        checkOfflineStatus();
    }, []);

    // ── 함수들 ────────────────────────────────────────────────

    const checkOfflineStatus = async () => {
        setOfflineChecking(true);
        try {
            const res = await fetch("/api/offline-status");
            const data = await res.json();
            setIsOffline(data.offline);
            if (data.offline) {
                await checkLicenseAutoEnter();
            }
        } catch {
            setIsOffline(true);
            await checkLicenseAutoEnter();
        } finally {
            setOfflineChecking(false);
        }
    };

    const checkLicenseAutoEnter = async () => {
        try {
            const res = await fetch("/api/license/verify");
            const data = await res.json();
            if (data.valid) {
                setLicenseInfo({ expiresAt: data.expiresAt });
                setOfflineStep("licensed");
            } else if (data.reason === "NOT_FOUND") {
                setOfflineStep("no_license");
            } else {
                setLicenseError(data.reason ?? "라이선스가 유효하지 않습니다");
                setOfflineStep("invalid");
            }
        } catch {
            setOfflineStep("idle");
        }
    };

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

    const handleOfflineClick = async () => {
        setOfflineStep("check");
        setLicenseError("");
        try {
            const res = await fetch("/api/license/verify");
            const data = await res.json();
            if (data.valid) {
                setLicenseInfo({ expiresAt: data.expiresAt });
                setOfflineStep("licensed");
            } else if (data.reason === "NOT_FOUND") {
                setOfflineStep("no_license");
            } else {
                setLicenseError(data.reason ?? "License invalid");
                setOfflineStep("invalid");
            }
        } catch {
            setLicenseError("License check error");
            setOfflineStep("invalid");
        }
    };

    const handleEnterOffline = async () => {
        sessionStorage.setItem("offlineMode", "true");
        // 서버 API가 읽을 수 있는 쿠키 설정:
        // DB가 LAN 복귀로 다시 online이 돼도 requireSession()이 오프라인 세션을 유지하도록 함
        document.cookie = "ptz-offline-mode=1; path=/; SameSite=Strict";

        // 라이선스에서 사용자 정보 추출 → SQLite 레코드 생성 → userId 쿠키 설정
        try {
            const res = await fetch('/api/offline/prepare', { method: 'POST' });
            if (res.ok) {
                const { userId } = await res.json() as { userId?: string };
                if (userId && userId !== 'offline') {
                    document.cookie =
                        `ptz-offline-userid=${encodeURIComponent(userId)}; path=/; SameSite=Strict`;
                    console.log('[Login] Offline user set:', userId);
                }
            } else {
                // 403 = invalid_license: 쿠키 롤백 + 에러 표시 (오프라인 진입 차단)
                const data = await res.json().catch(() => ({})) as { error?: string; reason?: string };
                if (res.status === 403 && data.error === 'invalid_license') {
                    console.warn('[Login] License invalid during prepare — aborting offline entry');
                    sessionStorage.removeItem("offlineMode");
                    document.cookie = "ptz-offline-mode=; path=/; max-age=0";
                    setLicenseError(data.reason ?? '라이선스가 유효하지 않습니다. 다시 발급받으세요.');
                    setOfflineStep("invalid");
                    return; // 대시보드 이동 중단
                }
                console.warn('[Login] offline prepare failed with status:', res.status);
            }
        } catch (e) {
            console.warn('[Login] offline prepare failed, continuing as offline:', e);
        }

        console.log('[Login] Entering offline mode');
        router.replace("/dashboard");
    };

    // ✅ 사용자 정보 수집 다이얼로그 표시
    const handleCollectUserInfo = async () => {
        try {
            const res = await fetch("/api/auth/session");
            const data = await res.json();

            if (data?.user?.email) {
                setUserInfoForRequest({
                    email: data.user.email,
                    name: data.user.name || "",
                    organization: data.user.organization || "",
                });
            } else {
                setUserInfoForRequest({ email: "", name: "", organization: "" });
            }
        } catch (err) {
            console.warn("[Login] Failed to fetch session:", err);
            setUserInfoForRequest({ email: "", name: "", organization: "" });
        }

        setShowUserInfoDialog(true);
    };

    // ✅ 다이얼로그에서 "다운로드" 버튼 클릭
    const handleDownloadRequestWithUserInfo = async () => {
        if (!userInfoForRequest.email?.trim()) {
            setLicenseError("이메일을 입력하세요");
            return;
        }
        if (!userInfoForRequest.name?.trim()) {
            setLicenseError("이름을 입력하세요");
            return;
        }
        if (!userInfoForRequest.organization?.trim()) {
            setLicenseError("회사/소속을 입력하세요");
            return;
        }

        setDownloadingReq(true);
        setLicenseError("");

        try {
            const params = new URLSearchParams({
                email: userInfoForRequest.email.trim(),
                name: userInfoForRequest.name.trim(),
                org: userInfoForRequest.organization.trim(),
            });

            const res = await fetch(`/api/license/request?${params.toString()}`);
            if (!res.ok) throw new Error("요청 파일 생성 실패");

            const blob = await res.blob();
            const cd = res.headers.get("Content-Disposition") ?? "";
            const filename = cd.match(/filename="(.+)"/)?.[1] ?? "license.ptzreq";

            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = filename;
            a.click();
            URL.revokeObjectURL(url);

            setShowUserInfoDialog(false);
            setOfflineStep("upload");

            console.log("[Login] License request downloaded successfully");
        } catch (e) {
            setLicenseError((e as Error).message);
            console.error("[Login] Download failed:", e);
        } finally {
            setDownloadingReq(false);
        }
    };

    // ✅ 다이얼로그에서 "취소" 버튼 클릭
    const handleCancelUserInfoDialog = () => {
        setShowUserInfoDialog(false);
        setLicenseError("");
    };

    // ✅ 요청 파일 다운로드 버튼 클릭 (다이얼로그 표시)
    const handleDownloadRequest = async () => {
        await handleCollectUserInfo();
    };

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setLoading(true);
        setError("");

        try {
            if (isLogin) {
                if (!email || !password) {
                    setError("이메일과 비밀번호를 입력해주세요");
                    setLoading(false);
                    return;
                }

                console.log('[Login] 온라인 로그인 시도:', email);

                const result = await signIn("credentials", {
                    email,
                    password,
                    redirect: false,
                });

                if (result?.error) {
                    console.error('[Login] 로그인 실패:', result.error);
                    setError(
                        result.error === "CredentialsSignin"
                            ? "이메일 또는 비밀번호가 올바르지 않습니다"
                            : result.error
                    );
                    setLoading(false);
                    return;
                }

                if (result?.ok) {
                    console.log('[Login] 온라인 로그인 성공:', email);
                    router.replace("/dashboard");
                    return;
                }
            } else {
                if (!email || !password || !name || !organization) {
                    setError("모든 필드를 입력해주세요");
                    setLoading(false);
                    return;
                }

                if (password.length < 8) {
                    setError("비밀번호는 8자 이상이어야 합니다");
                    setLoading(false);
                    return;
                }

                console.log('[Login] 회원가입 시도:', email);

                const res = await fetch("/api/signup", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        email,
                        password,
                        name,
                        organization,
                    }),
                });

                const data = await res.json();

                if (!res.ok) {
                    setError(data.error || "회원가입 실패");
                    setLoading(false);
                    return;
                }

                console.log('[Login] 회원가입 성공:', email);

                setIsLogin(true);
                setEmail("");
                setPassword("");
                setName("");
                setOrganization("");
                setError("");
                alert("회원가입이 완료되었습니다. 로그인해주세요.");
                setLoading(false);
                return;
            }
        } catch (err) {
            console.error('[Login] 오류:', err);
            setError(
                err instanceof Error
                    ? err.message
                    : "알 수 없는 오류가 발생했습니다"
            );
        } finally {
            setLoading(false);
        }
    };

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

            const apiEndpoint = isOffline
                ? "/api/license/request-upload"
                : "/api/license/verify";

            console.log('[Login] Uploading license to:', apiEndpoint);

            const res = await fetch(apiEndpoint, {
                method: "POST",
                body: formData,
            });
            const data = await res.json();

            if (res.ok && data.success) {
                setLicenseInfo({ expiresAt: data.expiresAt });

                if (data.userCreated) {
                    console.log('[Login] New user created, showing info form');
                    setUserCreated(true);
                    setOfflineStep("new_user_info");
                } else {
                    console.log('[Login] Existing user, entering offline mode');
                    setUserCreated(false);
                    setOfflineStep("licensed");
                }
            } else {
                const errorMsg = data.error ?? "라이센스 검증에 실패했습니다";
                setLicenseError(errorMsg);
                setOfflineStep("invalid");
                console.warn('[Login] License upload failed:', errorMsg);
            }
        } catch (err) {
            const errorMsg = (err as Error).message || "파일 업로드 중 오류가 발생했습니다";
            setLicenseError(errorMsg);
            setOfflineStep("invalid");
            console.error('[Login] Upload error:', err);
        } finally {
            setUploading(false);
            e.target.value = "";
        }
    };

    const handleEnterOfflineWithInfo = () => {
        if (!newUserInfo.name.trim() || !newUserInfo.organization.trim()) {
            setLicenseError("사용자명과 회사/소속을 모두 입력하세요");
            return;
        }

        sessionStorage.setItem(
            'offlineUserInfo',
            JSON.stringify({
                name: newUserInfo.name.trim(),
                organization: newUserInfo.organization.trim(),
            })
        );
        console.log('[Login] User info saved, entering offline mode');
        handleEnterOffline();
    };

    // ── 오프라인 단계별 컨텐츠 렌더링 ───────────────────────
    const renderOfflineContent = () => {
        if (offlineStep === "check") {
            return (
                <div className="flex items-center justify-center gap-2 py-3 text-sm text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>라이센스 확인 중...</span>
                </div>
            );
        }

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

        if (offlineStep === "new_user_info") {
            return (
                <div className="space-y-4">
                    <div className="flex items-center gap-2 text-green-500">
                        <CheckCircle className="w-4 h-4 shrink-0" />
                        <span className="text-sm font-medium">
                            라이센스 검증 완료
                        </span>
                    </div>

                    <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
                        <p className="text-xs text-blue-700 font-medium">
                            ℹ️ 오프라인 모드로 사용할 사용자 정보를 입력하세요
                        </p>
                    </div>

                    <div>
                        <label className="block text-xs font-medium mb-1">
                            사용자명
                        </label>
                        <input
                            type="text"
                            value={newUserInfo.name}
                            onChange={(e) =>
                                setNewUserInfo({
                                    ...newUserInfo,
                                    name: e.target.value,
                                })
                            }
                            placeholder="예: 홍길동"
                            className="w-full px-3 py-2 bg-muted/50 border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                            autoFocus
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-medium mb-1">
                            회사/소속
                        </label>
                        <input
                            type="text"
                            value={newUserInfo.organization}
                            onChange={(e) =>
                                setNewUserInfo({
                                    ...newUserInfo,
                                    organization: e.target.value,
                                })
                            }
                            placeholder="예: (주)예시회사"
                            className="w-full px-3 py-2 bg-muted/50 border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                        />
                    </div>

                    {licenseError && (
                        <div className="flex items-start gap-2 text-xs text-destructive bg-destructive/10 p-2 rounded-lg">
                            <XCircle className="w-4 h-4 shrink-0 mt-0.5" />
                            <span>{licenseError}</span>
                        </div>
                    )}

                    <button
                        onClick={handleEnterOfflineWithInfo}
                        className="w-full py-2.5 bg-amber-500 hover:bg-amber-500/90 text-white text-sm font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
                    >
                        <WifiOff className="w-4 h-4" />
                        오프라인 모드로 진입
                    </button>

                    <button
                        onClick={() => {
                            setOfflineStep("upload");
                            setLicenseError("");
                            setNewUserInfo({ name: "", organization: "" });
                        }}
                        className="w-full py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                        ← 다른 라이센스 파일 업로드
                    </button>
                </div>
            );
        }

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

                    {/* 오프라인 배너 */}
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

                    {/* 에러 메시지 */}
                    {error && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-lg mb-6"
                        >
                            {error}
                        </motion.div>
                    )}

                    {/* 로그인 / 회원가입 폼 */}
                    {!isOffline && (
                        <form onSubmit={handleSubmit} className="space-y-5">
                            {!isLogin && (
                                <>
                                    <div>
                                        <label className="block text-sm font-medium mb-2">
                                            이름 <span className="text-destructive">*</span>
                                        </label>
                                        <div className="relative">
                                            <UserPlus className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                                            <input
                                                type="text"
                                                value={name}
                                                required
                                                onChange={(e) => setName(e?.target?.value ?? "")}
                                                className="w-full pl-11 pr-4 py-3 bg-muted/50 border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                                                placeholder="홍길동"
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-2">
                                            회사/소속 <span className="text-destructive">*</span>
                                        </label>
                                        <div className="relative">
                                            <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                                            <input
                                                type="text"
                                                value={organization}
                                                required
                                                onChange={(e) => setOrganization(e?.target?.value ?? "")}
                                                className="w-full pl-11 pr-4 py-3 bg-muted/50 border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                                                placeholder="(주)예시회사"
                                            />
                                        </div>
                                    </div>
                                </>
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
                            {/* 비밀번호 찾기 링크 (로그인 모드일 때만) */}
                            {isLogin && (
                                <div className="text-right">
                                    <a
                                        href="/reset-password"
                                        className="text-xs text-primary hover:underline"
                                    >
                                        비밀번호를 잊으셨나요?
                                    </a>
                                </div>
                            )}
                            <button
                                type="submit"
                                disabled={loading}
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
                    )}

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
                        <div className="mt-4 flex justify-center">
                            <a href="https://www.tyche.pro" target="_blank" rel="noopener noreferrer">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                    src="/tyche-horz.svg"
                                    alt="TYCHE Inc."
                                    className="h-7 w-auto opacity-60 hover:opacity-90 transition-opacity dark:hidden"
                                />
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                    src="/tyche-horz-dark.svg"
                                    alt="TYCHE Inc."
                                    className="h-7 w-auto opacity-60 hover:opacity-90 transition-opacity hidden dark:block"
                                />
                            </a>
                        </div>
                    </div>
                </div>
            </motion.div>

            {/* ✅ 사용자 정보 수집 다이얼로그 */}
            <AnimatePresence>
                {showUserInfoDialog && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
                        onClick={handleCancelUserInfoDialog}
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className="bg-card rounded-xl shadow-2xl max-w-md w-full p-6 border border-border"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                                <Mail className="w-5 h-5 text-primary" />
                                라이선스 요청 정보
                            </h3>

                            <p className="text-xs text-muted-foreground mb-4">
                                아래 정보를 입력하면 요청 파일이 생성됩니다.
                            </p>

                            {licenseError && (
                                <div className="bg-destructive/10 border border-destructive/30 text-destructive text-xs p-3 rounded-lg mb-4">
                                    {licenseError}
                                </div>
                            )}

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium mb-2">
                                        이메일 <span className="text-destructive">*</span>
                                    </label>
                                    <input
                                        type="email"
                                        value={userInfoForRequest.email}
                                        onChange={(e) =>
                                            setUserInfoForRequest({
                                                ...userInfoForRequest,
                                                email: e.target.value,
                                            })
                                        }
                                        placeholder="user@example.com"
                                        className="w-full px-3 py-2 bg-muted/50 border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                                        autoFocus
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium mb-2">
                                        이름 <span className="text-destructive">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={userInfoForRequest.name}
                                        onChange={(e) =>
                                            setUserInfoForRequest({
                                                ...userInfoForRequest,
                                                name: e.target.value,
                                            })
                                        }
                                        placeholder="홍길동"
                                        className="w-full px-3 py-2 bg-muted/50 border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium mb-2">
                                        회사/소속 <span className="text-destructive">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={userInfoForRequest.organization}
                                        onChange={(e) =>
                                            setUserInfoForRequest({
                                                ...userInfoForRequest,
                                                organization: e.target.value,
                                            })
                                        }
                                        placeholder="(주)예시회사"
                                        className="w-full px-3 py-2 bg-muted/50 border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                                    />
                                </div>
                            </div>

                            <div className="flex gap-2 mt-6">
                                <button
                                    onClick={handleCancelUserInfoDialog}
                                    className="flex-1 py-2 bg-muted hover:bg-muted/80 text-sm font-medium rounded-lg transition-colors"
                                >
                                    취소
                                </button>
                                <button
                                    onClick={handleDownloadRequestWithUserInfo}
                                    disabled={downloadingReq}
                                    className="flex-1 py-2 bg-primary hover:bg-primary/90 disabled:opacity-50 text-primary-foreground text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
                                >
                                    {downloadingReq ? (
                                        <>
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            생성 중...
                                        </>
                                    ) : (
                                        <>
                                            <Download className="w-4 h-4" />
                                            파일 다운로드
                                        </>
                                    )}
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}