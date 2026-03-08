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
          // 온라인 DB 시도 (3초 타임아웃)
          console.log('[Auth] Attempting online authentication for:', credentials.email);
          const user = await Promise.race([
            prisma.user.findUnique({ 
              where: { email: credentials.email } 
            }),
            new Promise<null>((resolve) =>
              setTimeout(() => resolve(null), DB_AUTH_TIMEOUT_MS)
            ),
          ]);

          if (user && user.password) {
            const isValid = await bcrypt.compare(credentials.password, user.password);
            if (isValid) {
              console.log('[Auth] Online login successful:', credentials.email);
              
              // ✅ 온라인 로그인 성공 → 오프라인 DB에 저장
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
                console.log('[Auth] Offline user saved:', user.email);
              } catch (err) {
                console.warn('[Auth] Failed to save offline user:', err);
              }
              
              return {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role,
              };
            } else {
              console.warn('[Auth] Online login failed - invalid password:', credentials.email);
            }
          } else {
            if (user) {
              console.warn('[Auth] Online login failed - no password hash:', credentials.email);
            } else {
              console.warn('[Auth] Online login failed - user not found:', credentials.email);
            }
          }
        } catch (error) {
          console.error('[Auth] Online DB error:', (error as Error).message);
        }

        // DB 오프라인 또는 온라인 로그인 실패 → 오프라인 저장소 확인
        console.log('[Auth] Attempting offline authentication...');
        try {
          const offlineUser = await verifyOfflinePassword(
            credentials.email,
            credentials.password,
            bcrypt
          );
          
          if (offlineUser) {
            console.log('[Auth] Offline login successful:', credentials.email);
            
            // 오프라인 모드 상태 업데이트
            updateOfflineModeStatus(offlineUser.email, true);
            
            return {
              id: offlineUser.id,
              email: offlineUser.email,
              name: offlineUser.name,
              role: offlineUser.role,
            };
          } else {
            console.warn('[Auth] Offline login failed:', credentials.email);
          }
        } catch (err) {
          console.error('[Auth] Offline authentication error:', err);
        }

        console.warn('[Auth] Login failed for:', credentials.email);
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
