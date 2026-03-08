import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { PrismaAdapter } from '@next-auth/prisma-adapter';
import { prisma } from './db';
import bcrypt from 'bcryptjs';
import {
  getOfflineUser,
  saveOfflineUser,
  verifyOfflinePassword,
  initOfflineDb,
  updateOfflineModeStatus,
} from './offline-db';

// 앱 시작 시 오프라인 DB 초기화
try {
  initOfflineDb();
  console.log('[Auth] Offline DB initialized successfully');
} catch (err) {
  console.warn('[Auth] Offline DB initialization failed (non-critical):', err);
}

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
        
        try {
          console.log('[Auth] 온라인 로그인 시도:', credentials.email);
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
              }
            }),
            new Promise<null>((resolve) =>
              setTimeout(() => resolve(null), DB_AUTH_TIMEOUT_MS)
            ),
          ]);

          if (user && user.password) {
            const isValid = await bcrypt.compare(credentials.password, user.password);
            if (isValid) {
              console.log('[Auth] ✅ 온라인 로그인 성공:', credentials.email);
              
              // ✅ 반드시 오프라인 DB에 저장 (중요!)
              try {
                const savedUser = await saveOfflineUser({
                  email: user.email,
                  name: user.name || 'User',
                  organization: user.organization || undefined,
                  passwordHash: user.password,  // 온라인 DB의 bcrypt 해시
                  role: (user.role as 'user' | 'admin') || 'user',
                  lastOnlineLoginAt: new Date().toISOString(),
                  lastSyncAt: new Date().toISOString(),
                  platform: process.platform,
                  appVersion: process.env.npm_package_version,
                });
                console.log('[Auth] ✅ 오프라인 DB 저장 완료:', savedUser.email);
              } catch (err) {
                console.error('[Auth] ❌ 오프라인 DB 저장 실패:', err);
                // 온라인 로그인은 성공했으므로 계속 진행
              }
              
              return {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role,
              };
            }
          }
        } catch (error) {
          console.error('[Auth] 온라인 DB 에러:', error instanceof Error ? error.message : String(error));
        }

        // DB 오프라인 또는 온라인 로그인 실패 → 오프라인 저장소 확인
        console.log('[Auth] 오프라인 로그인 시도 중...');
        try {
          const offlineUser = await verifyOfflinePassword(
            credentials.email,
            credentials.password,
            bcrypt
          );
          
          if (offlineUser) {
            console.log('[Auth] ✅ 오프라인 로그인 성공:', credentials.email);
            
            // 오프라인 모드 상태 업데이트
            updateOfflineModeStatus(offlineUser.email, true);
            
            return {
              id: offlineUser.id,
              email: offlineUser.email,
              name: offlineUser.name,
              role: offlineUser.role,
            };
          } else {
            console.warn('[Auth] ❌ 오프라인 로그인 실패:', credentials.email);
          }
        } catch (err) {
          console.error('[Auth] 오프라인 인증 에러:', err instanceof Error ? err.message : String(err));
        }

        console.warn('[Auth] ❌ 로그인 실패 (온라인/오프라인 모두):', credentials.email);
        return null;
      },
    }),
  ],

  session: {
    strategy: 'jwt',
    maxAge: 24 * 60 * 60, // 24 hours
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as { role?: string })?.role ?? 'user';
        token.id = user?.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session?.user) {
        (session.user as { role?: string }).role = token?.role as string;
        (session.user as { id?: string }).id = token?.id as string;
      }
      return session;
    },
  },
  pages: {
    signIn: '/login',
  },
  secret: process.env.NEXTAUTH_SECRET,
};
