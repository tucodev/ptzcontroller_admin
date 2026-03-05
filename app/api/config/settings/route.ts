import { NextRequest, NextResponse } from 'next/server';
import { requireSession, getSessionUser } from '@/lib/auth-utils';
import { getSettingsAsync, saveSettingsAsync } from '@/lib/config-manager';

function resolveUserId(session: Awaited<ReturnType<typeof requireSession>>['session']): string {
  if (!session) return 'offline';
  const user = getSessionUser(session as { user?: unknown });
  const id = user.id;
  if (!id || typeof id !== 'string' || id.trim() === '') return 'offline';
  return id;
}

export async function GET() {
  const { session, error } = await requireSession();
  if (error) return error;

  const userId = resolveUserId(session);
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

  const userId = resolveUserId(session);
  try {
    const body = await request.json();
    const updated = await saveSettingsAsync(body, userId);
    return NextResponse.json({ success: true, settings: updated });
  } catch (e) {
    console.error('Save settings error:', e);
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 });
  }
}
