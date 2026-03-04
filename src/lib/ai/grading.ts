import { getServiceSupabase } from '@/lib/supabase/server';
import { callAI } from '@/lib/ai/provider';
import { FINAL_GRADER_SYSTEM_PROMPT, buildGraderUserMessage } from '@/lib/ai/prompts';
import { validateFinalGrade } from '@/lib/ai/validate';

export async function finalizeAttempt(attemptId: string) {
    const supabase = getServiceSupabase();

    // Load attempt
    const { data: attempt, error: aErr } = await supabase
        .from('attempts')
        .select('*')
        .eq('id', attemptId)
        .single();

    if (aErr || !attempt) {
        throw new Error('Attempt not found');
    }

    // Verify recording is uploaded
    if (attempt.status !== 'recording_uploaded' && attempt.status !== 'submitted') {
        // If it's already submitted, we might be re-grading or it was already handled.
        // For now, let's allow re-grading or just return if already done.
        if (attempt.status === 'submitted') return { already_submitted: true };
        throw new Error(`Cannot finalize: status is ${attempt.status}, expected recording_uploaded`);
    }

    // Load assignment
    const { data: assignment, error: asErr } = await supabase
        .from('assignments')
        .select('*')
        .eq('id', attempt.assignment_id)
        .single();

    if (asErr || !assignment) {
        throw new Error('Assignment not found');
    }

    // Load transcript
    const { data: messages } = await supabase
        .from('transcript_messages')
        .select('role, content')
        .eq('attempt_id', attemptId)
        .order('created_at', { ascending: true });

    // Load integrity events
    const { data: integrityEvents } = await supabase
        .from('integrity_events')
        .select('event_type, detail, created_at')
        .eq('attempt_id', attemptId);

    const integritySummary: Record<string, number> = {};
    (integrityEvents || []).forEach((e: { event_type: string }) => {
        integritySummary[e.event_type] = (integritySummary[e.event_type] || 0) + 1;
    });

    const questionBank = assignment.question_bank as {
        questions?: Record<string, unknown>[];
        selected_problem?: Record<string, unknown>;
    } | null;
    const bankQuestions = questionBank?.questions || [];
    const selectedProblemId = (attempt.ai_state as { selected_problem_id?: string } | null)?.selected_problem_id;
    const selectedFromBank = bankQuestions.find(
        (q) => String((q as { id?: string }).id || '') === String(selectedProblemId || '')
    );
    const selectedProblem = selectedFromBank || questionBank?.selected_problem || bankQuestions[0] || {};

    const userMessage = buildGraderUserMessage({
        assignment_settings: {
            title: assignment.title,
            topic: assignment.topic,
            difficulty: assignment.difficulty,
            time_limit_seconds: assignment.time_limit_seconds,
            max_turns: assignment.max_turns,
        },
        rubric: assignment.rubric || [],
        selected_problem: selectedProblem,
        transcript: (messages || []).map((m: { role: string; content: string }) => ({
            role: m.role,
            content: m.content,
        })),
        integrity_summary: integritySummary,
    });

    const rawResponse = await callAI(FINAL_GRADER_SYSTEM_PROMPT, userMessage);
    const parsed = JSON.parse(rawResponse);
    const validated = validateFinalGrade(parsed);

    // Update attempt with final grade
    const { error: updateErr } = await supabase
        .from('attempts')
        .update({
            status: 'submitted',
            submitted_at: new Date().toISOString(),
            final_score: validated.final_score,
            rubric_breakdown: validated.rubric_breakdown,
        })
        .eq('id', attemptId);

    if (updateErr) throw updateErr;

    return validated;
}
