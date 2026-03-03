import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase/server';
import { callAI } from '@/lib/ai/provider';
import { INTERVIEWER_SYSTEM_PROMPT, buildInterviewerUserMessage } from '@/lib/ai/prompts';
import { validateInterviewTurn } from '@/lib/ai/validate';

export async function POST(req: NextRequest) {
  try {
    const { attemptId, studentMessage } = await req.json();

    if (!attemptId || !studentMessage) {
      return NextResponse.json({ error: 'attemptId and studentMessage required' }, { status: 400 });
    }

    const supabase = getServiceSupabase();

    // Load attempt
    const { data: attempt, error: aErr } = await supabase
      .from('attempts')
      .select('*')
      .eq('id', attemptId)
      .single();

    if (aErr || !attempt) {
      return NextResponse.json({ error: 'Attempt not found' }, { status: 404 });
    }

    if (attempt.status !== 'recording') {
      return NextResponse.json({ error: 'Attempt is not in recording state' }, { status: 400 });
    }

    // Load assignment
    const { data: assignment, error: asErr } = await supabase
      .from('assignments')
      .select('*')
      .eq('id', attempt.assignment_id)
      .single();

    if (asErr || !assignment) {
      return NextResponse.json({ error: 'Assignment not found' }, { status: 404 });
    }

    // Load transcript
    const { data: messages } = await supabase
      .from('transcript_messages')
      .select('role, content')
      .eq('attempt_id', attemptId)
      .order('created_at', { ascending: true });

    // Load integrity summary
    const { data: integrityEvents } = await supabase
      .from('integrity_events')
      .select('event_type, detail, created_at')
      .eq('attempt_id', attemptId);

    const integritySummary: Record<string, number> = {};
    (integrityEvents || []).forEach((e: { event_type: string }) => {
      integritySummary[e.event_type] = (integritySummary[e.event_type] || 0) + 1;
    });

    // Save student message to transcript first
    await supabase
      .from('transcript_messages')
      .insert({ attempt_id: attemptId, role: 'student', content: studentMessage });

    const transcript = [
      ...(messages || []).map((m: { role: string; content: string }) => ({
        role: m.role,
        content: m.content,
      })),
      { role: 'student', content: studentMessage },
    ];

    const questionBank = assignment.question_bank as { selected_problem?: Record<string, unknown> } | null;

    // Call AI
    const userMessage = buildInterviewerUserMessage({
      assignment_settings: {
        title: assignment.title,
        topic: assignment.topic,
        difficulty: assignment.difficulty,
        time_limit_seconds: assignment.time_limit_seconds,
        max_turns: assignment.max_turns,
      },
      rubric: assignment.rubric || [],
      selected_problem: questionBank?.selected_problem || {},
      state: attempt.ai_state,
      transcript,
      student_message: studentMessage,
      integrity_summary: integritySummary,
    });

    const rawResponse = await callAI(INTERVIEWER_SYSTEM_PROMPT, userMessage);
    const parsed = JSON.parse(rawResponse);
    const validated = validateInterviewTurn(parsed);

    // Save AI message to transcript
    await supabase
      .from('transcript_messages')
      .insert({ attempt_id: attemptId, role: 'ai', content: validated.ai_message });

    // Update AI state on attempt
    await supabase
      .from('attempts')
      .update({ ai_state: validated.next_state })
      .eq('id', attemptId);

    return NextResponse.json({
      ai_message: validated.ai_message,
      next_state: validated.next_state,
      should_end: validated.next_state.should_end,
      flags: validated.flags,
    });
  } catch (err) {
    console.error('AI turn error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'AI turn failed' },
      { status: 500 }
    );
  }
}
