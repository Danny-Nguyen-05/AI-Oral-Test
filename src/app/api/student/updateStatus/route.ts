import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase/server';
import { VALID_STATUS_TRANSITIONS, AttemptStatus } from '@/lib/types';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { attemptId, status, ...optionalFields } = body;

    if (!attemptId || !status) {
      return NextResponse.json({ error: 'attemptId and status required' }, { status: 400 });
    }

    const supabase = getServiceSupabase();

    // Get current attempt
    const { data: attempt, error: gErr } = await supabase
      .from('attempts')
      .select('status')
      .eq('id', attemptId)
      .single();

    if (gErr || !attempt) {
      return NextResponse.json({ error: 'Attempt not found' }, { status: 404 });
    }

    // Enforce valid status transitions
    const currentStatus = attempt.status as AttemptStatus;
    const allowed = VALID_STATUS_TRANSITIONS[currentStatus] || [];
    if (!allowed.includes(status as AttemptStatus)) {
      return NextResponse.json(
        { error: `Invalid transition from ${currentStatus} to ${status}` },
        { status: 400 }
      );
    }

    // Build update payload
    const update: Record<string, unknown> = { status };

    if (status === 'recording') {
      update.started_at = new Date().toISOString();
    }

    // Allow optional fields like recording_url, recording_duration_seconds, etc.
    const allowedFields = [
      'recording_url',
      'recording_duration_seconds',
      'recording_size_bytes',
    ];
    for (const field of allowedFields) {
      if (optionalFields[field] !== undefined) {
        update[field] = optionalFields[field];
      }
    }

    const { data: updated, error: uErr } = await supabase
      .from('attempts')
      .update(update)
      .eq('id', attemptId)
      .select()
      .single();

    if (uErr) {
      return NextResponse.json({ error: uErr.message }, { status: 500 });
    }

    return NextResponse.json({ attempt: updated });
  } catch (err) {
    console.error('updateStatus error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
