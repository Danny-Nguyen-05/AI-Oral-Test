import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  try {
    const { attemptId, eventType, detail } = await req.json();

    if (!attemptId || !eventType) {
      return NextResponse.json({ error: 'attemptId and eventType required' }, { status: 400 });
    }

    const supabase = getServiceSupabase();

    const { error } = await supabase
      .from('integrity_events')
      .insert({
        attempt_id: attemptId,
        event_type: eventType,
        detail: detail || null,
      });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('logIntegrity error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
