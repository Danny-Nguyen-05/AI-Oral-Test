-- OralCheck MVP Database Schema
-- Run this in Supabase SQL Editor

-- ============================================================
-- 1. Tables
-- ============================================================

CREATE TABLE public.assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_user_id uuid NOT NULL REFERENCES auth.users(id),
  title text NOT NULL,
  topic text,
  difficulty text CHECK (difficulty IN ('easy', 'medium', 'hard')),
  time_limit_seconds integer DEFAULT 480, -- 8 minutes
  max_turns integer DEFAULT 10,
  rubric jsonb NOT NULL DEFAULT '[]'::jsonb,
  question_bank jsonb,
  published boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL REFERENCES public.assignments(id) ON DELETE CASCADE,
  student_name text NOT NULL,
  status text NOT NULL DEFAULT 'consent_pending'
    CHECK (status IN (
      'consent_pending',
      'ready_to_start',
      'recording',
      'uploading_recording',
      'recording_uploaded',
      'submitted',
      'recording_failed'
    )),
  started_at timestamptz,
  submitted_at timestamptz,
  ai_state jsonb,
  final_score integer,
  rubric_breakdown jsonb,
  teacher_override_score integer,
  teacher_override_note text,
  recording_url text,
  recording_duration_seconds integer,
  recording_size_bytes bigint,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.transcript_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id uuid NOT NULL REFERENCES public.attempts(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('ai', 'student')),
  content text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.integrity_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id uuid NOT NULL REFERENCES public.attempts(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  detail jsonb,
  created_at timestamptz DEFAULT now()
);

-- ============================================================
-- 2. Indexes
-- ============================================================

CREATE INDEX idx_assignments_teacher ON public.assignments(teacher_user_id);
CREATE INDEX idx_attempts_assignment ON public.attempts(assignment_id);
CREATE INDEX idx_transcript_attempt ON public.transcript_messages(attempt_id);
CREATE INDEX idx_integrity_attempt ON public.integrity_events(attempt_id);

-- ============================================================
-- 3. Public assignments view (limited columns for students)
-- ============================================================

CREATE VIEW public.public_assignments AS
SELECT
  id,
  title,
  topic,
  difficulty,
  time_limit_seconds,
  max_turns,
  rubric,
  question_bank,
  published
FROM public.assignments
WHERE published = true;

-- ============================================================
-- 4. Row Level Security
-- ============================================================

-- Assignments RLS
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "teacher_all_own_assignments"
  ON public.assignments
  FOR ALL
  USING (auth.uid() = teacher_user_id)
  WITH CHECK (auth.uid() = teacher_user_id);

CREATE POLICY "public_read_published_assignments"
  ON public.assignments
  FOR SELECT
  USING (published = true);

-- Attempts RLS
ALTER TABLE public.attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "teacher_select_own_attempts"
  ON public.attempts
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.assignments a
      WHERE a.id = attempts.assignment_id
      AND a.teacher_user_id = auth.uid()
    )
  );

CREATE POLICY "teacher_update_override_attempts"
  ON public.attempts
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.assignments a
      WHERE a.id = attempts.assignment_id
      AND a.teacher_user_id = auth.uid()
    )
  );

-- Service role handles student inserts/updates via server routes

-- Transcript Messages RLS
ALTER TABLE public.transcript_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "teacher_read_transcript"
  ON public.transcript_messages
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.attempts att
      JOIN public.assignments a ON a.id = att.assignment_id
      WHERE att.id = transcript_messages.attempt_id
      AND a.teacher_user_id = auth.uid()
    )
  );

-- Service role handles student writes via server routes

-- Integrity Events RLS
ALTER TABLE public.integrity_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "teacher_read_integrity"
  ON public.integrity_events
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.attempts att
      JOIN public.assignments a ON a.id = att.assignment_id
      WHERE att.id = integrity_events.attempt_id
      AND a.teacher_user_id = auth.uid()
    )
  );

-- ============================================================
-- 5. Storage bucket
-- ============================================================
-- Run in Supabase Dashboard > Storage or via SQL:

INSERT INTO storage.buckets (id, name, public)
VALUES ('recordings', 'recordings', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "teacher_read_recordings"
  ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'recordings'
    AND auth.role() = 'authenticated'
  );

CREATE POLICY "anon_upload_recordings"
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'recordings'
  );

CREATE POLICY "service_role_all_recordings"
  ON storage.objects
  FOR ALL
  USING (bucket_id = 'recordings')
  WITH CHECK (bucket_id = 'recordings');
