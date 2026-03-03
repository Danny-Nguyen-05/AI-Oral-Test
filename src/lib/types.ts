// ============================================================
// Shared types for OralCheck
// ============================================================

export interface Assignment {
  id: string;
  teacher_user_id: string;
  title: string;
  topic: string | null;
  difficulty: 'easy' | 'medium' | 'hard' | null;
  time_limit_seconds: number;
  max_turns: number;
  rubric: RubricWeight[];
  question_bank: QuestionBank | null;
  published: boolean;
  created_at: string;
}

export interface RubricWeight {
  category: string;
  weight: number; // 0-100, all weights should sum to 100
}

export interface QuestionBank {
  selected_problem: SelectedProblem;
}

export interface SelectedProblem {
  id: string;
  title: string;
  description: string;
  followups: string[];
  concept_targets: string[];
}

export interface Attempt {
  id: string;
  assignment_id: string;
  student_name: string;
  status: AttemptStatus;
  started_at: string | null;
  submitted_at: string | null;
  ai_state: AIState | null;
  final_score: number | null;
  rubric_breakdown: RubricBreakdownItem[] | null;
  teacher_override_score: number | null;
  teacher_override_note: string | null;
  recording_url: string | null;
  recording_duration_seconds: number | null;
  recording_size_bytes: number | null;
  created_at: string;
}

export type AttemptStatus =
  | 'consent_pending'
  | 'ready_to_start'
  | 'recording'
  | 'uploading_recording'
  | 'recording_uploaded'
  | 'submitted'
  | 'recording_failed';

export const VALID_STATUS_TRANSITIONS: Record<AttemptStatus, AttemptStatus[]> = {
  consent_pending: ['ready_to_start'],
  ready_to_start: ['recording'],
  recording: ['uploading_recording', 'recording_failed'],
  uploading_recording: ['recording_uploaded', 'recording_failed'],
  recording_uploaded: ['submitted'],
  submitted: [],
  recording_failed: ['recording', 'uploading_recording'],
};

export interface AIState {
  phase: 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H';
  turn_index: number;
  max_turns: number;
  selected_problem_id: string;
  asked_followups: string[];
  concept_targets_remaining: string[];
  difficulty_adjustment: 'easier' | 'same' | 'harder';
  should_end: boolean;
  reason_to_end: string;
}

export interface TranscriptMessage {
  id: string;
  attempt_id: string;
  role: 'ai' | 'student';
  content: string;
  created_at: string;
}

export interface IntegrityEvent {
  id: string;
  attempt_id: string;
  event_type: string;
  detail: Record<string, unknown> | null;
  created_at: string;
}

// AI response schemas
export interface InterviewTurnResponse {
  mode: 'interview_turn';
  ai_message: string;
  next_state: AIState;
  turn_assessment: TurnAssessment;
  flags: TurnFlags;
}

export interface TurnAssessment {
  understanding: number;
  approach: number;
  correctness_reasoning: number;
  complexity: number;
  edge_cases: number;
  communication: number;
  notes_for_teacher: string;
}

export interface TurnFlags {
  needs_clarification: boolean;
  suspected_copy_paste_language: boolean;
  off_topic: boolean;
}

export interface FinalGradeResponse {
  mode: 'final_grade';
  final_score: number;
  rubric_breakdown: RubricBreakdownItem[];
  strengths: string[];
  improvements: string[];
  teacher_summary: string;
  student_feedback: string;
  integrity_flags: IntegrityFlag[];
  pass_fail_recommendation: 'pass' | 'review' | 'fail';
}

export interface RubricBreakdownItem {
  category: string;
  weight: number;
  score: number;
  rationale: string;
  evidence_quotes: string[];
}

export interface IntegrityFlag {
  type: string;
  severity: 'low' | 'medium' | 'high';
  detail: string;
}
