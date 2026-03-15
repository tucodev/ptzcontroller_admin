import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { saveOfflineUser } from "@/lib/offline-db";
import { isSmtpConfigured, sendSignupNotifyEmail } from "@/lib/email";
import { isSmsConfigured, getSmsSettings, sendSmsToAdmins } from "@/lib/sms";

// seed 계정 — 첫 번째 실제 사용자 판단 시 제외
const SEED_EMAILS = new Set(["john@doe.com"]);

export async function POST(request: NextRequest) {
    try {
        const { email, password, name, organization } =
            (await request.json()) ?? {};

        // ───────────────────────────────────────────────────────────
        // 1단계: 필드 검증
        // ───────────────────────────────────────────────────────────
        if (!email || !password) {
            return NextResponse.json(
                { error: "Email and password are required" },
                { status: 400 },
            );
        }
        if (!name || !name.trim()) {
            return NextResponse.json(
                { error: "이름을 입력해주세요" },
                { status: 400 },
            );
        }
        if (!organization || !organization.trim()) {
            return NextResponse.json(
                { error: "회사/소속을 입력해주세요" },
                { status: 400 },
            );
        }

        // ───────────────────────────────────────────────────────────
        // 2단계: 중복 확인
        // ───────────────────────────────────────────────────────────
        const existingUser = await prisma.user.findUnique({
            where: { email },
        });
        if (existingUser) {
            return NextResponse.json(
                { error: "User already exists" },
                { status: 400 },
            );
        }

        // ───────────────────────────────────────────────────────────
        // 3단계: 역할 결정 (첫 번째 실제 가입자는 admin)
        // ───────────────────────────────────────────────────────────
        const realUserCount = await prisma.user.count({
            where: { email: { notIn: [...SEED_EMAILS] } },
        });
        const role = realUserCount === 0 ? "admin" : "user";

        // ───────────────────────────────────────────────────────────
        // 4단계: 온라인 DB (Prisma) 에 사용자 생성
        // ───────────────────────────────────────────────────────────
        const hashedPassword = await bcrypt.hash(password, 12);
        const user = await prisma.user.create({
            data: {
                email,
                password: hashedPassword,
                name: name.trim(),
                organization: organization.trim(),
                role,
            },
        });
        console.log("[Signup] ✅ User created in Prisma DB:", email);

        // ───────────────────────────────────────────────────────────
        // 5단계: ✅ 오프라인 DB (SQLite) 에도 저장 (중요!)
        // ───────────────────────────────────────────────────────────
        try {
            await saveOfflineUser({
                email: user.email,
                name: user.name || "User",
                organization: user.organization || undefined,
                passwordHash: hashedPassword, // ✅ bcrypt 해시된 비밀번호
                role: (user.role as "user" | "admin") || "user",
                lastOnlineLoginAt: new Date().toISOString(),
                lastSyncAt: new Date().toISOString(),
                isActive: 1,
                platform: process.platform,
                appVersion: process.env.npm_package_version,
            });
            console.log("[Signup] ✅ User also saved to SQLite DB:", email);
        } catch (offlineErr) {
            console.error(
                "[Signup] ⚠️ Failed to save user to SQLite:",
                offlineErr,
            );
            // 주의: 온라인 회원가입은 성공했으나 오프라인 동기화는 실패
            // → 로그인 시도: 온라인 성공, 나중에 오프라인 로그인 불가능
            // → 로그에 경고하지만 회원가입은 계속 진행 (중요함!)
        }

        // ───────────────────────────────────────────────────────────
        // 6단계: 관리자에게 가입 알림 (fire-and-forget)
        // ───────────────────────────────────────────────────────────
        if (isSmtpConfigured()) {
            (async () => {
                try {
                    const admins = await prisma.user.findMany({
                        where: { role: "admin" },
                        select: { email: true },
                    });
                    const adminEmails = admins
                        .map((a: { email: string }) => a.email)
                        .filter(Boolean);
                    if (adminEmails.length > 0) {
                        const result = await sendSignupNotifyEmail(adminEmails, {
                            name: name.trim(),
                            email,
                            org: organization.trim(),
                            role,
                        });
                        if (result.success) {
                            console.log("[Signup] Admin notification sent to:", adminEmails.join(", "));
                        } else {
                            console.error("[Signup] Admin notification FAILED:", result.error);
                        }
                    }
                } catch (e) {
                    console.error("[Signup] Admin notification error:", e);
                }
            })();
        }

        // ───────────────────────────────────────────────────────────
        // 7단계: SMS 알림 (fire-and-forget)
        // ───────────────────────────────────────────────────────────
        if (isSmsConfigured()) {
            (async () => {
                try {
                    const { smsNotifySignup } = await getSmsSettings();
                    if (smsNotifySignup) {
                        const result = await sendSmsToAdmins(
                            `[PTZ] 새 사용자 가입: ${name.trim()} (${email})`,
                        );
                        if (result.success) {
                            console.log("[Signup] SMS notification sent");
                        } else {
                            console.error("[Signup] SMS notification FAILED:", result.error);
                        }
                    }
                } catch (e) {
                    console.error("[Signup] SMS notification error:", e);
                }
            })();
        }

        // ───────────────────────────────────────────────────────────
        // 8단계: 성공 응답
        // ───────────────────────────────────────────────────────────
        return NextResponse.json({
            success: true,
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                organization: user.organization,
                role: user.role,
            },
        });
    } catch (err) {
        console.error("[Signup] ❌ Error:", err);
        return NextResponse.json(
            { error: "Failed to create user" },
            { status: 500 },
        );
    }
}
