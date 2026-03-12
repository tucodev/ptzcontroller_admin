import { NextRequest, NextResponse } from 'next/server';
import { requireSession, getSessionUser } from '@/lib/auth-utils';
import { getSettingsAsync, saveSettingsAsync } from '@/lib/config-manager';

function resolveUserId(
  session: Awaited<ReturnType<typeof requireSession>>['session'],
  request: NextRequest,
): string {
  if (!session) {
    const val = request.cookies.get('ptz-offline-userid')?.value;
    if (val) return decodeURIComponent(val);
    return 'offline';
  }
  const user = getSessionUser(session as { user?: unknown }) as { email?: string; id?: string };
  return user.email ?? user.id ?? 'offline';
}

export async function GET(request: NextRequest) {
  const { session, error } = await requireSession();
  if (error) return error;

  const userId = resolveUserId(session, request);
  try {
    const settings = await getSettingsAsync(userId);
    return NextResponse.json({ settings });
  } catch (e) {
    console.error('Get settings error:', e);
    return NextResponse.json({ error: 'Failed to get settings' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const { session, error } = await requireSession();
  if (error) return error;

  const userId = resolveUserId(session, request);
  try {
    const body = await request.json();
    const updated = await saveSettingsAsync(body, userId);
    return NextResponse.json({ success: true, settings: updated });
  } catch (e) {
    console.error('Save settings error:', e);
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 });
  }
}
