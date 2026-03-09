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

// ── 오프라인 라이센스 UI 단계 ───────────────────────────────
type OfflineStep =
    | "idle"              // 오프라인 배너만 표시
    | "check"             // 기존 라이센스 확인 중
    | "licensed"          // 유효한 라이센스 있음 → 바로 진행 가능
    | "no_license"        // 라이센스 없음 → 요청 파일 안내
    | "upload"            // 라이센스 파일 업로드 대기
    | "invalid"           // 라이센스 검증 실패
    | "new_user_info"     // ✅ NEW: 신규 사용자 정보 입력
    | "user_confirm";     // ✅ NEW: 사용자 승인 대기

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

    // ✅ NEW: 신규 사용자 정보 입력 상태
    const [newUserInfo, setNewUserInfo] = useState({
        name: "",
        organization: "",
    });
    const [userCreated, setUserCreated] = useState(false);
    
    // 페이지 로드 시 DB 연결 상태 확인 (서버 측 타임아웃 3초 이내 응답)
    useEffect(() => {
        checkOfflineStatus();
    }, []);

    const checkOfflineStatus = async () => {
        setOfflineChecking(true);
        try {
            const res = await fetch("/api/offline-status");
            const data = await res.json();
            setIsOffline(data.offline);
            // 오프라인 확인 즉시 라이선스 체크 시작 (Desktop 자동 진입 지원)
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

    // 오프라인 확인 즉시 유효 라이선스 존재 시 자동으로 licensed 단계로 이동
    // → Desktop에서 새로고침 없이도 바로 오프라인 모드 진입 가능
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
        
    // ── 라이센스 통과 → 오프라인 모드 진입 ──────────────────
    // ✅ NEW: 오프라인 모드 진입 (기존 함수 개선)
    const handleEnterOffline = () => {
        sessionStorage.setItem("offlineMode", "true");
        console.log('[Login] Entering offline mode');
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

    // ── 로그인 / 회원가입 폼 제출 ────────────────────────
    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setLoading(true);
        setError("");

        try {
            if (isLogin) {
                // ───────────────────────────────────────────
                // 로그인 모드
                // ───────────────────────────────────────────
                if (!email || !password) {
                    setError("이메일과 비밀번호를 입력해주세요");
                    setLoading(false);
                    return;
                }

                console.log('[Login] 온라인 로그인 시도:', email);

                // NextAuth 자격증명 제공자로 로그인
                const result = await signIn("credentials", {
                    email,
                    password,
                    redirect: false,
                });

                if (result?.error) {
                    console.error('[Login] ❌ 로그인 실패:', result.error);
                    setError(
                        result.error === "CredentialsSignin"
                            ? "이메일 또는 비밀번호가 올바르지 않습니다"
                            : result.error
                    );
                    setLoading(false);
                    return;
                }

                if (result?.ok) {
                    console.log('[Login] ✅ 온라인 로그인 성공:', email);
                    setError("");
                    
                    // 대시보드로 이동
                    router.replace("/dashboard");
                    return;
                }
            } else {
                // ───────────────────────────────────────────
                // 회원가입 모드
                // ───────────────────────────────────────────
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

                console.log('[Login] ✅ 회원가입 성공:', email);
                
                // 회원가입 성공 → 로그인 폼으로 전환
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
            console.error('[Login] ❌ 오류:', err);
            setError(
                err instanceof Error
                    ? err.message
                    : "알 수 없는 오류가 발생했습니다"
            );
        } finally {
            setLoading(false);
        }
    };    
    // ── 라이센스 파일 업로드 + 검증 ─────────────────────────
    // ✅ NEW: 라이센스 업로드 후 처리
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
                
                // ✅ NEW: userCreated 필드 확인
                if (data.userCreated) {
                    console.log('[Login] New user created, showing info form');
                    setUserCreated(true);
                    setOfflineStep("new_user_info");  // ← 신규 사용자 정보 입력 단계
                } else {
                    console.log('[Login] Existing user, entering offline mode');
                    setUserCreated(false);
                    setOfflineStep("licensed");  // ← 바로 진입
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

    // ✅ NEW: 사용자 정보 입력 후 오프라인 모드 진입
    const handleEnterOfflineWithInfo = () => {
        // 사용자 정보 저장 (sessionStorage에 임시 저장)
        if (!newUserInfo.name.trim() || !newUserInfo.organization.trim()) {
            setLicenseError("사용자명과 회사/소속을 모두 입력하세요");
            return;
        }
        
        // 사용자 정보 저장 (sessionStorage에 임시 저장)
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

        // ✅ NEW: [new_user_info] 신규 사용자 정보 입력
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
        
        // ✅ NEW: [user_confirm] 사용자 승인 대기 (선택사항)
        // 현재는 new_user_info에서 바로 진입하므로 생략
        // 필요시 추가 가능
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

                    {/* ── 로그인 / 회원가입 폼 (오프라인 시 숨김) ──── */}
                    {!isOffline && <form onSubmit={handleSubmit} className="space-y-5">
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
                    </form>}

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
