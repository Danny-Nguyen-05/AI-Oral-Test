import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const attemptId = formData.get('attemptId') as string;
    const assignmentId = formData.get('assignmentId') as string;
    const file = formData.get('file') as File;
    const durationRaw = formData.get('recordingDurationSeconds');
    const recordingDurationSeconds = durationRaw ? Number(durationRaw) : null;

    if (!attemptId || !assignmentId || !file) {
      return NextResponse.json(
        { error: 'attemptId, assignmentId, and file required' },
        { status: 400 }
      );
    }

    const supabase = getServiceSupabase();

    const fileName = file.name || `${attemptId}.webm`;
    const extension = fileName.includes('.') ? fileName.split('.').pop()?.toLowerCase() : 'webm';
    const safeExtension = extension === 'mp4' ? 'mp4' : 'webm';
    const storagePath = `${assignmentId}/${attemptId}.${safeExtension}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    const { error: uploadError } = await supabase.storage
      .from('recordings')
      .upload(storagePath, buffer, {
        contentType: file.type || (safeExtension === 'mp4' ? 'video/mp4' : 'video/webm'),
        upsert: true,
      });

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }

    // Get public/signed URL
    const { data: urlData } = supabase.storage
      .from('recordings')
      .getPublicUrl(storagePath);

    const recordingUrl = urlData.publicUrl;

    // Update attempt with recording info
    const { error: updateError } = await supabase
      .from('attempts')
      .update({
        status: 'recording_uploaded',
        recording_url: recordingUrl,
        recording_duration_seconds:
          recordingDurationSeconds !== null && Number.isFinite(recordingDurationSeconds)
            ? recordingDurationSeconds
            : null,
        recording_size_bytes: file.size,
      })
      .eq('id', attemptId);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, recording_url: recordingUrl });
  } catch (err) {
    console.error('uploadRecording error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
