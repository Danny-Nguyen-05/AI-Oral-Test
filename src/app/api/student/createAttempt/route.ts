import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  try {
    const { assignmentId, studentName } = await req.json();

    if (!assignmentId || !studentName) {
      return NextResponse.json({ error: 'assignmentId and studentName required' }, { status: 400 });
    }

    const supabase = getServiceSupabase();

    // Validate assignment is published
    const { data: assignment, error: aErr } = await supabase
      .from('assignments')
      .select('*')
      .eq('id', assignmentId)
      .eq('published', true)
      .single();

    if (aErr || !assignment) {
      return NextResponse.json({ error: 'Assignment not found or not published' }, { status: 404 });
    }

    // Build initial AI state
    const questionBank = assignment.question_bank as {
      questions?: { id: string; concept_targets?: string[] }[];
      selected_problem?: { id: string; concept_targets?: string[] };
    } | null;

    const questions = questionBank?.questions || [];
    const fallbackSelected = questionBank?.selected_problem;
    const selectedProblem = questions.length > 0
      ? questions[Math.floor(Math.random() * questions.length)]
      : fallbackSelected;

    const initialState = {
      phase: 'A',
      turn_index: 0,
      max_turns: assignment.max_turns || 10,
      selected_problem_id: selectedProblem?.id || '',
      asked_followups: [],
      concept_targets_remaining: selectedProblem?.concept_targets || [],
      difficulty_adjustment: 'same',
      should_end: false,
      reason_to_end: '',
    };

    const { data: attempt, error: cErr } = await supabase
      .from('attempts')
      .insert({
        assignment_id: assignmentId,
        student_name: studentName,
        status: 'consent_pending',
        ai_state: initialState,
      })
      .select()
      .single();

    if (cErr) {
      return NextResponse.json({ error: cErr.message }, { status: 500 });
    }

    return NextResponse.json({
      attemptId: attempt.id,
      assignment: {
        id: assignment.id,
        title: assignment.title,
        topic: assignment.topic,
        difficulty: assignment.difficulty,
        time_limit_seconds: assignment.time_limit_seconds,
        max_turns: assignment.max_turns,
        rubric: assignment.rubric,
        question_bank: assignment.question_bank,
      },
      aiState: initialState,
    });
  } catch (err) {
    console.error('createAttempt error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
