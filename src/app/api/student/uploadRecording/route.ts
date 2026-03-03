import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const attemptId = formData.get('attemptId') as string;
    const assignmentId = formData.get('assignmentId') as string;
    const file = formData.get('file') as File;

    if (!attemptId || !assignmentId || !file) {
      return NextResponse.json(
        { error: 'attemptId, assignmentId, and file required' },
        { status: 400 }
      );
    }

    const supabase = getServiceSupabase();

    const storagePath = `${assignmentId}/${attemptId}.webm`;
    const buffer = Buffer.from(await file.arrayBuffer());

    const { error: uploadError } = await supabase.storage
      .from('recordings')
      .upload(storagePath, buffer, {
        contentType: 'video/webm',
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
