import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      attemptId,
      assignmentId,
      storagePath,
      recordingDurationSeconds,
      recordingSizeBytes,
    } = body as {
      attemptId?: string;
      assignmentId?: string;
      storagePath?: string;
      recordingDurationSeconds?: number;
      recordingSizeBytes?: number;
    };

    if (!attemptId || !assignmentId || !storagePath) {
      return NextResponse.json(
        { error: 'attemptId, assignmentId, and storagePath required' },
        { status: 400 }
      );
    }

    const supabase = getServiceSupabase();

    const { data: attempt, error: attemptErr } = await supabase
      .from('attempts')
      .select('id, assignment_id, status')
      .eq('id', attemptId)
      .single();

    if (attemptErr || !attempt) {
      return NextResponse.json({ error: 'Attempt not found' }, { status: 404 });
    }

    if (attempt.assignment_id !== assignmentId) {
      return NextResponse.json({ error: 'assignmentId does not match attempt' }, { status: 400 });
    }

    if (attempt.status !== 'uploading_recording') {
      return NextResponse.json(
        { error: `Invalid attempt status ${attempt.status}; expected uploading_recording` },
        { status: 400 }
      );
    }

    const expectedPrefix = `${assignmentId}/${attemptId}.`;
    if (!storagePath.startsWith(expectedPrefix)) {
      return NextResponse.json({ error: 'Invalid storagePath for attempt' }, { status: 400 });
    }

    const { error: signedUrlErr } = await supabase.storage
      .from('recordings')
      .createSignedUrl(storagePath, 60);

    if (signedUrlErr) {
      return NextResponse.json(
        { error: `Uploaded recording not found at storagePath: ${signedUrlErr.message}` },
        { status: 400 }
      );
    }

    // Update attempt with recording info
    const { error: updateError } = await supabase
      .from('attempts')
      .update({
        status: 'recording_uploaded',
        recording_url: storagePath,
        recording_duration_seconds:
          Number.isFinite(recordingDurationSeconds)
            ? recordingDurationSeconds
            : null,
        recording_size_bytes:
          Number.isFinite(recordingSizeBytes)
            ? recordingSizeBytes
            : null,
      })
      .eq('id', attemptId);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, recording_url: storagePath });
  } catch (err) {
    console.error('uploadRecording error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
