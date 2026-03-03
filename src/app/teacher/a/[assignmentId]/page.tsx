'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useRouter, useParams } from 'next/navigation';
import type { Assignment, SelectedProblem, QuestionBank } from '@/lib/types';

function normalizeQuestions(questionBank: QuestionBank | null): SelectedProblem[] {
  if (!questionBank) return [];
  if (Array.isArray(questionBank.questions) && questionBank.questions.length > 0) {
    return questionBank.questions;
  }
  if (questionBank.selected_problem) {
    return [questionBank.selected_problem];
  }
  return [];
}

export default function AssignmentDetail() {
  const params = useParams();
  const router = useRouter();
  const assignmentId = params.assignmentId as string;

  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [questions, setQuestions] = useState<SelectedProblem[]>([]);
  const [activeQuestionIndex, setActiveQuestionIndex] = useState<number | null>(null);

  const [problemTitle, setProblemTitle] = useState('');
  const [problemDesc, setProblemDesc] = useState('');
  const [followups, setFollowups] = useState<string[]>([]);
  const [conceptTargets, setConceptTargets] = useState<string[]>([]);
  const [hasUnsavedQuestionDraft, setHasUnsavedQuestionDraft] = useState(false);

  const loadAssignment = useCallback(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      router.push('/teacher/login');
      return;
    }

    const { data } = await supabase
      .from('assignments')
      .select('*')
      .eq('id', assignmentId)
      .single();

    if (data) {
      const a = data as Assignment;
      setAssignment(a);

      const normalized = normalizeQuestions(a.question_bank as QuestionBank | null);
      setQuestions(normalized);

      if (normalized.length > 0) {
        const first = normalized[0];
        setActiveQuestionIndex(0);
        setProblemTitle(first.title || '');
        setProblemDesc(first.description || '');
        setFollowups(first.followups || []);
        setConceptTargets(first.concept_targets || []);
      } else {
        setActiveQuestionIndex(null);
        setProblemTitle('');
        setProblemDesc('');
        setFollowups([]);
        setConceptTargets([]);
      }

      setHasUnsavedQuestionDraft(false);
    }

    setLoading(false);
  }, [assignmentId, router]);

  useEffect(() => {
    loadAssignment();
  }, [loadAssignment]);

  function openQuestionForEdit(index: number) {
    const question = questions[index];
    if (!question) return;

    setActiveQuestionIndex(index);
    setProblemTitle(question.title || '');
    setProblemDesc(question.description || '');
    setFollowups(question.followups || []);
    setConceptTargets(question.concept_targets || []);
    setHasUnsavedQuestionDraft(false);
    setError('');
    setSuccess('');
  }

  function handleCreateManualQuestion() {
    setActiveQuestionIndex(null);
    setProblemTitle('');
    setProblemDesc('');
    setFollowups(['']);
    setConceptTargets(['']);
    setHasUnsavedQuestionDraft(true);
    setError('');
    setSuccess('Create your own question, then click Save Question.');
  }

  async function handleGenerate() {
    if (!assignment) return;

    setGenerating(true);
    setError('');
    setSuccess('');

    try {
      const res = await fetch('/api/ai/generateQuestion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: assignment.topic,
          difficulty: assignment.difficulty,
          existingQuestionTitles: questions.map((q) => q.title),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      const sp: SelectedProblem = data.selected_problem;
      setActiveQuestionIndex(null);
      setProblemTitle(sp.title || '');
      setProblemDesc(sp.description || '');
      setFollowups(sp.followups || []);
      setConceptTargets(sp.concept_targets || []);
      setHasUnsavedQuestionDraft(true);
      setSuccess('AI generated a new draft question. Review/modify and click Save Question.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate');
    }

    setGenerating(false);
  }

  function buildDraftQuestion(): SelectedProblem | null {
    const trimmedTitle = problemTitle.trim();
    const trimmedDesc = problemDesc.trim();

    if (!trimmedTitle || !trimmedDesc) return null;

    const existingId =
      activeQuestionIndex !== null && questions[activeQuestionIndex]
        ? questions[activeQuestionIndex].id
        : crypto.randomUUID();

    return {
      id: existingId,
      title: trimmedTitle,
      description: trimmedDesc,
      followups: followups.map((f) => f.trim()).filter(Boolean),
      concept_targets: conceptTargets.map((c) => c.trim()).filter(Boolean),
    };
  }

  async function handleSaveProblem() {
    const draft = buildDraftQuestion();
    if (!draft) {
      setError('Problem title and description are required');
      return;
    }

    setSaving(true);
    setError('');

    const updatedQuestions = [...questions];
    let savedIndex = activeQuestionIndex;

    if (activeQuestionIndex !== null && updatedQuestions[activeQuestionIndex]) {
      updatedQuestions[activeQuestionIndex] = draft;
    } else {
      updatedQuestions.push(draft);
      savedIndex = updatedQuestions.length - 1;
    }

    const { error: uErr } = await supabase
      .from('assignments')
      .update({ question_bank: { questions: updatedQuestions } })
      .eq('id', assignmentId);

    if (uErr) {
      setError(uErr.message);
      setSaving(false);
      return;
    }

    setQuestions(updatedQuestions);
    setActiveQuestionIndex(null);
    setProblemTitle('');
    setProblemDesc('');
    setFollowups(['']);
    setConceptTargets(['']);
    setHasUnsavedQuestionDraft(true);
    setSuccess('Question saved to bank! You can add another question now.');
    setSaving(false);

    if (savedIndex !== null && savedIndex >= 0) {
      // Keep UI list current without overriding the fresh draft state.
      setQuestions(updatedQuestions);
    }
  }

  async function handleDeleteQuestion(index: number) {
    const updatedQuestions = questions.filter((_, i) => i !== index);

    setSaving(true);
    setError('');

    const { error: uErr } = await supabase
      .from('assignments')
      .update({ question_bank: { questions: updatedQuestions } })
      .eq('id', assignmentId);

    if (uErr) {
      setError(uErr.message);
      setSaving(false);
      return;
    }

    setQuestions(updatedQuestions);

    if (updatedQuestions.length === 0) {
      setActiveQuestionIndex(null);
      setProblemTitle('');
      setProblemDesc('');
      setFollowups([]);
      setConceptTargets([]);
      setHasUnsavedQuestionDraft(false);
    } else {
      const nextIndex = Math.min(index, updatedQuestions.length - 1);
      openQuestionForEdit(nextIndex);
    }

    setSuccess('Question removed from bank.');
    setSaving(false);
    loadAssignment();
  }

  async function handlePublish() {
    if (questions.length === 0) {
      setError('Add at least one question to the question bank before publishing');
      return;
    }

    const { error: uErr } = await supabase
      .from('assignments')
      .update({ published: !assignment?.published })
      .eq('id', assignmentId);

    if (uErr) {
      setError(uErr.message);
    } else {
      setSuccess(assignment?.published ? 'Unpublished!' : 'Published!');
      loadAssignment();
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  if (!assignment) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-red-600">Assignment not found</p>
      </div>
    );
  }

  const studentLink = `${typeof window !== 'undefined' ? window.location.origin : ''}/a/${assignmentId}`;

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{assignment.title}</h1>
          <p className="text-sm text-gray-500 mt-1">
            {assignment.topic} · {assignment.difficulty} · {assignment.time_limit_seconds / 60} min · {assignment.max_turns} turns
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => router.push('/teacher/dashboard')}
            className="px-4 py-2 border border-gray-300 rounded-md text-sm hover:bg-gray-50 transition"
          >
            ← Dashboard
          </button>
          <button
            onClick={handlePublish}
            className={`px-4 py-2 rounded-md text-sm transition ${
              assignment.published
                ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
                : 'bg-green-600 text-white hover:bg-green-700'
            }`}
          >
            {assignment.published ? 'Unpublish' : 'Publish'}
          </button>
          <button
            onClick={() => router.push(`/teacher/a/${assignmentId}/submissions`)}
            className="px-4 py-2 border border-gray-300 rounded-md text-sm hover:bg-gray-50 transition"
          >
            Submissions
          </button>
        </div>
      </div>

      {assignment.published && (
        <div className="bg-blue-50 border border-blue-200 rounded-md p-4 mb-6">
          <p className="text-sm text-blue-700">
            <strong>Student link:</strong>{' '}
            <code className="bg-blue-100 px-2 py-0.5 rounded text-xs">{studentLink}</code>
          </p>
          <button
            onClick={() => navigator.clipboard.writeText(studentLink)}
            className="mt-2 text-xs text-blue-600 hover:text-blue-700"
          >
            Copy to clipboard
          </button>
        </div>
      )}

      {error && <p className="text-red-600 text-sm mb-4">{error}</p>}
      {success && <p className="text-green-600 text-sm mb-4">{success}</p>}

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Question Bank ({questions.length})</h2>
          <div className="flex gap-2">
            <button
              onClick={handleCreateManualQuestion}
              className="px-4 py-2 border border-gray-300 text-gray-700 text-sm rounded-md hover:bg-gray-50 transition"
            >
              Create Manually
            </button>
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="px-4 py-2 bg-purple-600 text-white text-sm rounded-md hover:bg-purple-700 disabled:opacity-50 transition"
            >
              {generating ? 'Generating...' : 'Generate Question'}
            </button>
          </div>
        </div>

        {questions.length > 0 && (
          <div className="mb-5 border border-gray-200 rounded-md p-3 bg-gray-50">
            <p className="text-xs font-medium text-gray-600 mb-2">Saved Questions</p>
            <div className="space-y-2">
              {questions.map((q, i) => (
                <div key={q.id} className="flex items-center justify-between gap-2 bg-white border border-gray-200 rounded p-2">
                  <button
                    onClick={() => openQuestionForEdit(i)}
                    className={`text-left flex-1 text-sm ${activeQuestionIndex === i ? 'text-blue-700 font-medium' : 'text-gray-700'}`}
                  >
                    {i + 1}. {q.title}
                  </button>
                  <button
                    onClick={() => handleDeleteQuestion(i)}
                    className="text-xs text-red-600 hover:text-red-700"
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {questions.length === 0 && !hasUnsavedQuestionDraft && (
          <div className="bg-gray-50 border border-gray-200 rounded-md p-3 text-sm text-gray-600 mb-4">
            Add multiple questions manually or generate with AI. Students will receive a random question from this bank.
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Problem Title</label>
            <input
              value={problemTitle}
              onChange={(e) => {
                setProblemTitle(e.target.value);
                setHasUnsavedQuestionDraft(true);
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Problem Description</label>
            <textarea
              value={problemDesc}
              onChange={(e) => {
                setProblemDesc(e.target.value);
                setHasUnsavedQuestionDraft(true);
              }}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Followup Questions</label>
            {followups.map((f, i) => (
              <div key={i} className="flex gap-2 mb-2">
                <input
                  value={f}
                  onChange={(e) => {
                    const updated = [...followups];
                    updated[i] = e.target.value;
                    setFollowups(updated);
                    setHasUnsavedQuestionDraft(true);
                  }}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
                <button
                  onClick={() => {
                    setFollowups(followups.filter((_, j) => j !== i));
                    setHasUnsavedQuestionDraft(true);
                  }}
                  className="text-red-500 text-sm"
                >
                  ✕
                </button>
              </div>
            ))}
            <button
              onClick={() => {
                setFollowups([...followups, '']);
                setHasUnsavedQuestionDraft(true);
              }}
              className="text-sm text-blue-600 hover:text-blue-700"
            >
              + Add Followup
            </button>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Concept Targets</label>
            <div className="flex flex-wrap gap-2">
              {conceptTargets.map((c, i) => (
                <span key={i} className="flex items-center gap-1 bg-gray-100 px-2 py-1 rounded text-sm">
                  <input
                    value={c}
                    onChange={(e) => {
                      const updated = [...conceptTargets];
                      updated[i] = e.target.value;
                      setConceptTargets(updated);
                      setHasUnsavedQuestionDraft(true);
                    }}
                    className="bg-transparent border-none text-sm w-auto focus:outline-none"
                    size={c.length || 10}
                  />
                  <button
                    onClick={() => {
                      setConceptTargets(conceptTargets.filter((_, j) => j !== i));
                      setHasUnsavedQuestionDraft(true);
                    }}
                    className="text-red-400 hover:text-red-600"
                  >
                    ✕
                  </button>
                </span>
              ))}
              <button
                onClick={() => {
                  setConceptTargets([...conceptTargets, '']);
                  setHasUnsavedQuestionDraft(true);
                }}
                className="text-sm text-blue-600 hover:text-blue-700"
              >
                + Add
              </button>
            </div>
          </div>

          {hasUnsavedQuestionDraft && (
            <p className="text-xs text-amber-600">You have unsaved question draft changes.</p>
          )}

          <button
            onClick={handleSaveProblem}
            disabled={saving}
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:opacity-50 transition"
          >
            {saving ? 'Saving...' : 'Save Question'}
          </button>
        </div>
      </div>
    </div>
  );
}
