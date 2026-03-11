import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { PrismaAdapter } from '@next-auth/prisma-adapter';
import { prisma } from './db';
import bcrypt from 'bcryptjs';
import {
  saveOfflineUser,
  verifyOfflinePassword,
  initOfflineDb,
  updateOfflineModeStatus,
} from './offline-db';
import { verifyOfflineLicense } from './offline-mode';

// 앱 시작 시 오프라인 DB 초기화
try {
  initOfflineDb();
  console.log('[Auth] Offline DB initialized successfully');
} catch (err) {
  console.warn('[Auth] Offline DB initialization failed (non-critical):', err);
}

// Desktop 모드 감지
const IS_DESKTOP_MODE = process.env.PTZ_DESKTOP_MODE === 'true';

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          console.warn('[Auth] Missing email or password');
          return null;
        }

        const DB_AUTH_TIMEOUT_MS = 3_000;
        const modeLabel = IS_DESKTOP_MODE ? 'Desktop' : 'Admin';
        
        // ==========================================
        // 1. Online authentication (all versions)
        // ==========================================
        try {
          console.log(`[Auth] Online login attempt (${modeLabel}):`, credentials.email);
          const user = await Promise.race([
            prisma.user.findUnique({
              where: { email: credentials.email },
              select: {
                id: true,
                email: true,
                name: true,
                password: true,
                role: true,
                organization: true,
                approved: true,
              }
            }),
            new Promise<null>((resolve) =>
              setTimeout(() => resolve(null), DB_AUTH_TIMEOUT_MS)
            ),
          ]);

          if (user && user.password) {
            const isValid = await bcrypt.compare(credentials.password, user.password);
            if (isValid) {
              console.log(`[Auth] OK Online login success (${modeLabel}):`, credentials.email);
              
              // Sync to offline DB
              try {
                await saveOfflineUser({
                  email: user.email,
                  name: user.name || 'User',
                  organization: user.organization || undefined,
                  passwordHash: user.password,
                  role: (user.role as 'user' | 'admin') || 'user',
                  lastOnlineLoginAt: new Date().toISOString(),
                  lastSyncAt: new Date().toISOString(),
                  platform: process.platform,
                  appVersion: process.env.npm_package_version,
                });
                console.log('[Auth] OK Offline DB sync:', credentials.email);
              } catch (err) {
                console.warn('[Auth] WARN Offline DB sync failed:', err);
              }
              
              return {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role,
                organization: user.organization ?? '',
                approved: user.approved ?? false,
              };
            }
          }
        } catch (error) {
          console.log(`[Auth] Online DB unavailable (${modeLabel}):`, error instanceof Error ? error.message : String(error));
        }

        // ==========================================
        // 2. Offline fallback (Desktop only)
        // ==========================================
        if (IS_DESKTOP_MODE) {
          console.log('[Auth] Desktop offline fallback attempt:', credentials.email);
          try {
            // License verification required
            const licenseStatus = await verifyOfflineLicense();
            if (!licenseStatus.valid) {
              console.warn('[Auth] FAIL Desktop offline: no valid license, reason:', licenseStatus.reason);
              return null;
            }
            console.log('[Auth] OK Desktop license verified:', licenseStatus.expiresAt);

            // Local DB authentication after license check
            const offlineUser = await verifyOfflinePassword(
              credentials.email,
              credentials.password,
              bcrypt
            );
            
            if (offlineUser) {
              console.log('[Auth] OK Desktop offline login success (license + local DB):', credentials.email);
              updateOfflineModeStatus(offlineUser.email, true);

              return {
                id: offlineUser.id,
                email: offlineUser.email,
                name: offlineUser.name,
                role: offlineUser.role,
                approved: true, // 유효한 라이선스로 인증 완료 → PTZ 기능 허가
              };
            } else {
              console.warn('[Auth] FAIL Desktop offline login: password mismatch');
            }
          } catch (err) {
            console.error('[Auth] ERROR Desktop offline auth error:', err instanceof Error ? err.message : String(err));
          }
        } else {
          // Admin: no offline fallback
          console.warn('[Auth] FAIL Admin online auth failed, no offline fallback:', credentials.email);
        }

        return null;
      },
    }),
  ],

  session: {
    strategy: 'jwt',
    maxAge: 24 * 60 * 60,
  },
  callbacks: {
    async jwt({ token, user, trigger }) {
      // 최초 로그인: user 객체에서 토큰 필드 채우기
      if (user) {
        token.role         = (user as { role?: string })?.role ?? 'user';
        token.id           = user?.id;
        token.organization = (user as { organization?: string })?.organization ?? '';
        token.approved     = (user as { approved?: boolean })?.approved ?? false;
      }
      // 프로필 업데이트 후 update() 호출 시: DB에서 최신 정보 재조회
      if (trigger === 'update' && token.id) {
        try {
          const fresh = await prisma.user.findUnique({
            where: { id: token.id as string },
            select: { name: true, organization: true, approved: true },
          });
          if (fresh) {
            token.name         = fresh.name         ?? token.name;
            token.organization = fresh.organization ?? '';
            token.approved     = fresh.approved     ?? false;
          }
        } catch (e) {
          console.warn('[auth] JWT trigger=update DB refresh failed:', e);
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session?.user) {
        (session.user as { role?: string }).role             = token?.role as string;
        (session.user as { id?: string }).id                 = token?.id as string;
        (session.user as { organization?: string }).organization = (token?.organization as string) ?? '';
        (session.user as { approved?: boolean }).approved    = (token?.approved as boolean) ?? false;
      }
      return session;
    },
  },
  pages: {
    signIn: '/login',
  },
  secret: process.env.NEXTAUTH_SECRET,
};

