# OralCheck — AI Oral Technical Assessments

**Live Demo → [ai-oral-test.vercel.app](https://ai-oral-test.vercel.app/)**

**Video Demo → [youtu.be/QoI6bxI1NLE](https://youtu.be/QoI6bxI1NLE)**

---

## What It Is

OralCheck is a full-stack AI-powered oral assessment platform I built to rethink how CS education evaluates students. Instead of asking students to write code on a whiteboard or pass a syntax quiz, they sit down with an AI interviewer and *talk through* their thinking, exactly like a real technical interview.

The core thesis: syntax knowledge is becoming obsolete. What matters is whether a student can reason out loud, communicate tradeoffs, and evaluate code under pressure. OralCheck trains and tests exactly that.

---

## The Problem It Solves

Traditional CS assessments reward memorization. Multiple choice tests, auto-graded coding challenges, and fill-in-the-blank questions tell you almost nothing about whether a student actually understands what they're doing.

As a former TA, I watched students who could copy-paste a perfect solution from Stack Overflow completely fall apart when asked *why* it worked. And I watched students who wrote messy, imperfect code but demonstrated genuine deep understanding get marked down unfairly.

OralCheck bridges that gap. It puts the emphasis on *communicating* understanding, not just producing it.

---

## How It Works

**For Teachers:**
1. Create an assignment with a topic, difficulty level, time limit, and a custom grading rubric
2. Use the AI question generator to instantly populate a question bank, or write problems manually
3. Publish the assignment and share a link with students
4. Review submissions: watch the video recording, read the full transcript, inspect the AI-generated rubric breakdown, and optionally override the score

**For Students:**
1. Open the teacher-provided link and enter your name
2. Grant camera and microphone access
3. Enter fullscreen and start the assessment
4. Speak your answers to the AI interviewer, it asks follow-up questions, probes edge cases, and adapts difficulty in real time based on your responses
5. Submit when done; the recording and transcript are automatically graded

---

## Key Features

**AI Interviewer**
The AI drives a structured interview across 8 phases: introduction, clarifying questions, approach discussion, solution walkthrough, complexity analysis, edge cases, follow-ups, and wrap-up. It adapts in real time: if you're struggling, it eases up. If you're flying, it pushes harder.

**Automated Grading**
After submission, a separate AI grader analyzes the full transcript against the teacher's rubric. It produces a per-category score breakdown with rationale and direct evidence quotes pulled from what the student said.

**Integrity Tooling**
The platform enforces fullscreen mode, detects multi-monitor setups, and logs integrity events (tab switches, window blur, clipboard usage, suspicious keyboard shortcuts, camera/mic mutes) so teachers have full visibility into the session.

**Video Recording**
The entire session is recorded and uploaded to Supabase Storage. Teachers can watch it back alongside the transcript.

**Teacher Dashboard**
Full assignment management: create, edit, publish/unpublish, browse submissions, view scores, and override AI grades with a note.

---

## Technical Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router) |
| AI / LLM | Google Gemini Flash |
| Database | Supabase (PostgreSQL + RLS) |
| Storage | Supabase Storage |
| Auth | Supabase Auth (Google OAuth) |
| Styling | Tailwind CSS + Framer Motion |
| Deployment | Vercel |

**Architecture highlights:**
- All AI calls go through server-side API routes — no client-side API key exposure
- Attempt status transitions are enforced server-side with a strict state machine (`consent_pending → ready_to_start → recording → uploading_recording → recording_uploaded → submitted`)
- Row-level security policies ensure teachers only see their own data; student writes go through the service role
- Speech recognition uses the browser-native Web Speech API; TTS uses the Web Speech Synthesis API — no third-party dependencies for voice

---

## What's Next

The "evaluate AI-generated code" module: instead of asking students to produce code, show them code and ask them to read it, explain it, find the bugs, and optimize it. This directly trains the skill that matters most in 2025 — critically evaluating output from AI tools rather than blindly accepting it.

---

## Project Structure

```
src/
├── app/
│   ├── a/[assignmentId]/          # Student entry page
│   ├── attempt/[attemptId]/       # Live interview + done screen
│   ├── teacher/                   # Dashboard, assignment editor, submission viewer
│   └── api/                       # Server-side API routes (AI, student actions)
├── components/
│   └── MarkdownMessage.tsx        # Renders AI messages with math support
├── hooks/
│   ├── useRecording.ts            # MediaRecorder abstraction
│   └── useIntegrity.ts            # Integrity event logging
└── lib/
    ├── ai/                        # Prompts, provider abstraction, validation
    ├── supabase/                  # Client + server Supabase instances
    └── types.ts                   # Shared TypeScript types
```

---

Built by Danny — CS student, former TA, and strong believer that the future of CS education is about thinking out loud, not typing the right syntax.
