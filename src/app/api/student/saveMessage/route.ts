import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  try {
    const { attemptId, role, content } = await req.json();

    if (!attemptId || !role || !content) {
      return NextResponse.json({ error: 'attemptId, role, and content required' }, { status: 400 });
    }

    if (!['ai', 'student'].includes(role)) {
      return NextResponse.json({ error: 'role must be ai or student' }, { status: 400 });
    }

    const supabase = getServiceSupabase();

    const { error } = await supabase
      .from('transcript_messages')
      .insert({ attempt_id: attemptId, role, content });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('saveMessage error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
