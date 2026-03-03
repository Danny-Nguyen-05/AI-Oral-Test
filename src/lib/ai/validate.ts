// ============================================================
// JSON schema validation helpers
// ============================================================

import type { InterviewTurnResponse, FinalGradeResponse } from '@/lib/types';

export function validateInterviewTurn(raw: unknown): InterviewTurnResponse {
  const obj = raw as Record<string, unknown>;
  if (obj.mode !== 'interview_turn') throw new Error('Invalid mode, expected interview_turn');
  if (typeof obj.ai_message !== 'string') throw new Error('Missing ai_message');
  if (!obj.next_state || typeof obj.next_state !== 'object') throw new Error('Missing next_state');
  if (!obj.turn_assessment || typeof obj.turn_assessment !== 'object') throw new Error('Missing turn_assessment');
  if (!obj.flags || typeof obj.flags !== 'object') throw new Error('Missing flags');

  const ns = obj.next_state as Record<string, unknown>;
  const validPhases = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
  if (!validPhases.includes(ns.phase as string)) throw new Error('Invalid phase');
  if (typeof ns.turn_index !== 'number') throw new Error('Invalid turn_index');
  if (typeof ns.should_end !== 'boolean') throw new Error('Invalid should_end');

  return obj as unknown as InterviewTurnResponse;
}

export function validateFinalGrade(raw: unknown): FinalGradeResponse {
  const obj = raw as Record<string, unknown>;
  if (obj.mode !== 'final_grade') throw new Error('Invalid mode, expected final_grade');
  if (typeof obj.final_score !== 'number' || obj.final_score < 0 || obj.final_score > 100) {
    throw new Error('Invalid final_score');
  }
  if (!Array.isArray(obj.rubric_breakdown)) throw new Error('Missing rubric_breakdown');
  if (!Array.isArray(obj.strengths)) throw new Error('Missing strengths');
  if (!Array.isArray(obj.improvements)) throw new Error('Missing improvements');
  if (typeof obj.teacher_summary !== 'string') throw new Error('Missing teacher_summary');
  if (typeof obj.student_feedback !== 'string') throw new Error('Missing student_feedback');

  const validRecs = ['pass', 'review', 'fail'];
  if (!validRecs.includes(obj.pass_fail_recommendation as string)) {
    throw new Error('Invalid pass_fail_recommendation');
  }

  return obj as unknown as FinalGradeResponse;
}
