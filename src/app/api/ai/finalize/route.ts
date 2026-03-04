import { NextRequest, NextResponse } from 'next/server';
import { finalizeAttempt } from '@/lib/ai/grading';

export const maxDuration = 60; // Allow up to 60s for AI grading on Vercel

export async function POST(req: NextRequest) {
  try {
    const { attemptId } = await req.json();

    if (!attemptId) {
      return NextResponse.json({ error: 'attemptId required' }, { status: 400 });
    }

    const result = await finalizeAttempt(attemptId);
    return NextResponse.json(result);
  } catch (err) {
    console.error('AI finalize error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Finalize failed' },
      { status: 500 }
    );
  }
}
