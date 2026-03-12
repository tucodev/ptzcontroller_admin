"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Camera, Mail, Lock, Loader2, Eye, EyeOff, CheckCircle, ArrowLeft } from "lucide-react";
import { motion } from "framer-motion";

export default function ResetPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  // ── 이메일 입력 (forgot-password) 상태 ───────────────
  const [email, setEmail] = useState("");
  const [requestSent, setRequestSent] = useState(false);
  const [requestLoading, setRequestLoading] = useState(false);
  const [requestError, setRequestError] = useState("");

  // ── 새 비밀번호 입력 (reset-password) 상태 ────────────
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError] = useState("");
  const [resetSuccess, setResetSuccess] = useState(false);

  // ── Forgot Password 요청 ──────────────────────────────
  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRequestError("");
    setRequestLoading(true);

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setRequestError(data.error || "요청에 실패했습니다.");
      } else {
        setRequestSent(true);
      }
    } catch {
      setRequestError("서버에 연결할 수 없습니다.");
    } finally {
      setRequestLoading(false);
    }
  };

  // ── Reset Password 처리 ───────────────────────────────
  const handleResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetError("");

    if (newPassword.length < 8) {
      setResetError("비밀번호는 8자 이상이어야 합니다.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setResetError("비밀번호가 일치하지 않습니다.");
      return;
    }

    setResetLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setResetError(data.error || "비밀번호 변경에 실패했습니다.");
      } else {
        setResetSuccess(true);
        setTimeout(() => router.push("/login"), 3000);
      }
    } catch {
      setResetError("서버에 연결할 수 없습니다.");
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        {/* 로고 */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary/20 rounded-2xl mb-4">
            <Camera className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold">PTZ Controller</h1>
          <p className="text-muted-foreground mt-1">비밀번호 재설정</p>
        </div>

        <div className="bg-card/80 backdrop-blur border border-border rounded-2xl p-6 shadow-lg">
          {/* ── 토큰 없음: 이메일 입력 폼 ─────────────────── */}
          {!token && !requestSent && (
            <form onSubmit={handleForgotSubmit} className="space-y-4">
              <p className="text-sm text-muted-foreground mb-4">
                가입한 이메일 주소를 입력하면 비밀번호 재설정 링크를 보내드립니다.
              </p>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="이메일 주소"
                  required
                  className="w-full pl-10 pr-4 py-3 bg-muted border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
              {requestError && (
                <p className="text-destructive text-sm">{requestError}</p>
              )}
              <button
                type="submit"
                disabled={requestLoading || !email.trim()}
                className="w-full py-3 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {requestLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Mail className="w-4 h-4" />
                )}
                재설정 링크 보내기
              </button>
            </form>
          )}

          {/* ── 이메일 발송 완료 ──────────────────────────── */}
          {!token && requestSent && (
            <div className="text-center py-4">
              <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
              <h3 className="font-medium mb-2">이메일이 발송되었습니다</h3>
              <p className="text-sm text-muted-foreground mb-4">
                등록된 이메일이라면 비밀번호 재설정 링크가<br />
                발송됩니다. 메일함을 확인해주세요.
              </p>
              <p className="text-xs text-muted-foreground">
                메일이 도착하지 않으면 스팸함을 확인하거나<br />
                관리자에게 문의하세요.
              </p>
            </div>
          )}

          {/* ── 토큰 있음: 새 비밀번호 입력 폼 ────────────── */}
          {token && !resetSuccess && (
            <form onSubmit={handleResetSubmit} className="space-y-4">
              <p className="text-sm text-muted-foreground mb-4">
                새로운 비밀번호를 입력해주세요. (8자 이상)
              </p>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="새 비밀번호"
                  required
                  minLength={8}
                  className="w-full pl-10 pr-10 py-3 bg-muted border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="비밀번호 확인"
                  required
                  minLength={8}
                  className="w-full pl-10 pr-4 py-3 bg-muted border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
              {resetError && (
                <p className="text-destructive text-sm">{resetError}</p>
              )}
              <button
                type="submit"
                disabled={resetLoading || !newPassword || !confirmPassword}
                className="w-full py-3 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {resetLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Lock className="w-4 h-4" />
                )}
                비밀번호 변경
              </button>
            </form>
          )}

          {/* ── 리셋 성공 ─────────────────────────────────── */}
          {token && resetSuccess && (
            <div className="text-center py-4">
              <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
              <h3 className="font-medium mb-2">비밀번호가 변경되었습니다</h3>
              <p className="text-sm text-muted-foreground">
                잠시 후 로그인 페이지로 이동합니다...
              </p>
            </div>
          )}

          {/* ── 로그인으로 돌아가기 ───────────────────────── */}
          <div className="mt-4 text-center">
            <button
              onClick={() => router.push("/login")}
              className="text-sm text-primary hover:underline inline-flex items-center gap-1"
            >
              <ArrowLeft className="w-3 h-3" />
              로그인으로 돌아가기
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
