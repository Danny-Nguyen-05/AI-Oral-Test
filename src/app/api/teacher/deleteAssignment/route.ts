import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getServiceSupabase } from '@/lib/supabase/server';

export async function DELETE(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const token = authHeader.slice(7);

    const userSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    );

    const { data: { user }, error: authError } = await userSupabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { assignmentId } = await req.json() as { assignmentId?: string };
    if (!assignmentId) {
      return NextResponse.json({ error: 'assignmentId required' }, { status: 400 });
    }

    const supabase = getServiceSupabase();

    const { data: assignment } = await supabase
      .from('assignments')
      .select('id, teacher_user_id')
      .eq('id', assignmentId)
      .single();

    if (!assignment || assignment.teacher_user_id !== user.id) {
      return NextResponse.json({ error: 'Assignment not found or unauthorized' }, { status: 404 });
    }

    // Collect recording storage paths before deleting
    const { data: attempts } = await supabase
      .from('attempts')
      .select('recording_url')
      .eq('assignment_id', assignmentId)
      .not('recording_url', 'is', null);

    if (attempts && attempts.length > 0) {
      const paths = attempts.map((a) => a.recording_url).filter(Boolean) as string[];
      if (paths.length > 0) {
        await supabase.storage.from('recordings').remove(paths);
      }
    }

    // Deleting the assignment cascades to attempts, transcript_messages, integrity_events
    const { error: deleteError } = await supabase
      .from('assignments')
      .delete()
      .eq('id', assignmentId);

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('deleteAssignment error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
