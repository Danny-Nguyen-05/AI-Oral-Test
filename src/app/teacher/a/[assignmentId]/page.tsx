'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useRouter, useParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Users, Settings, Share2, Plus, Wand2, Sparkles,
  Save, Trash2, CheckCircle2, Clock, BarChart2, Check, Copy
} from 'lucide-react';
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
  const [linkCopied, setLinkCopied] = useState(false);

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
        openQuestionForEdit(0, normalized);
      } else {
        resetDraft();
      }
    }

    setLoading(false);
  }, [assignmentId, router]);

  useEffect(() => {
    loadAssignment();
  }, [loadAssignment]);

  function resetDraft() {
    setActiveQuestionIndex(null);
    setProblemTitle('');
    setProblemDesc('');
    setFollowups([]);
    setConceptTargets([]);
    setHasUnsavedQuestionDraft(false);
  }

  function openQuestionForEdit(index: number, qList = questions) {
    const question = qList[index];
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
    resetDraft();
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

    // Check for duplicate title
    const isDuplicate = questions.some((q, idx) =>
      idx !== activeQuestionIndex &&
      q.title.toLowerCase().trim() === draft.title.toLowerCase().trim()
    );

    if (isDuplicate) {
      setError('A question with this title already exists in the bank.');
      return;
    }

    setSaving(true);
    setError('');

    const updatedQuestions = [...questions];
    if (activeQuestionIndex !== null && updatedQuestions[activeQuestionIndex]) {
      updatedQuestions[activeQuestionIndex] = draft;
    } else {
      updatedQuestions.push(draft);
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
    resetDraft(); // Clear all boxes after successful save

    setSuccess('Question saved to bank successfully.');
    setSaving(false);
    setTimeout(() => setSuccess(''), 3000);
  }

  async function handleDeleteQuestion(index: number) {
    if (!confirm('Are you sure you want to delete this question from the bank?')) return;

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
      resetDraft();
    } else {
      const nextIndex = Math.min(index, updatedQuestions.length - 1);
      openQuestionForEdit(nextIndex, updatedQuestions);
    }

    setSaving(false);
  }

  async function handlePublish() {
    if (questions.length === 0) {
      setError('Add at least one question to the question bank before publishing');
      return;
    }

    const newStatus = !assignment?.published;
    const { error: uErr } = await supabase
      .from('assignments')
      .update({ published: newStatus })
      .eq('id', assignmentId);

    if (uErr) {
      setError(uErr.message);
    } else {
      setAssignment(prev => prev ? { ...prev, published: newStatus } : null);
      setSuccess(newStatus ? 'Assignment is now live!' : 'Assignment unpublished.');
      setTimeout(() => setSuccess(''), 3000);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-4 border-sky-600/30 border-t-sky-600 rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (!assignment) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="bg-red-50 text-red-600 px-6 py-4 rounded-xl border border-red-100 flex items-center gap-3">
          <Trash2 className="w-5 h-5" />
          <p className="font-medium">Assignment not found</p>
        </div>
      </div>
    );
  }

  const studentLink = `${typeof window !== 'undefined' ? window.location.origin : ''}/a/${assignmentId}`;

  const copyLink = async () => {
    await navigator.clipboard.writeText(studentLink);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-12">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <button
            onClick={() => router.push('/teacher/dashboard')}
            className="flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-800 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Dashboard</span>
          </button>

          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push(`/teacher/a/${assignmentId}/submissions`)}
              className="px-4 py-2 border border-slate-200 text-slate-700 bg-white hover:bg-slate-50 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors shadow-sm"
            >
              <Users className="w-4 h-4" />
              Submissions
            </button>
            <button
              onClick={handlePublish}
              className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-all shadow-sm ${assignment.published
                ? 'bg-amber-100 text-amber-700 hover:bg-amber-200 border border-amber-200/50'
                : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-emerald-600/20'
                }`}
            >
              {assignment.published ? (
                <>Unpublish</>
              ) : (
                <><Share2 className="w-4 h-4" /> Publish</>
              )}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">

        {/* Title Section */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">{assignment.title}</h1>
            {assignment.published && (
              <span className="bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs px-2.5 py-1 rounded-full font-medium flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Live
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-4 text-sm text-slate-500">
            <div className="flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-md border border-slate-200 shadow-sm">
              <BarChart2 className="w-4 h-4 text-slate-400" />
              <span>{assignment.difficulty}</span>
            </div>
            <div className="flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-md border border-slate-200 shadow-sm">
              <Clock className="w-4 h-4 text-slate-400" />
              <span>{assignment.time_limit_seconds / 60} min</span>
            </div>
            <div className="flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-md border border-slate-200 shadow-sm">
              <span className="font-medium text-slate-400">Topic:</span>
              <span>{assignment.topic || 'General'}</span>
            </div>
          </div>
        </div>

        {/* Alerts */}
        <AnimatePresence>
          {assignment.published && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="bg-white border border-sky-200 shadow-sm shadow-sky-100 rounded-xl p-5 mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
            >
              <div>
                <h3 className="font-bold text-slate-800 flex items-center gap-2 mb-1">
                  <Share2 className="w-4 h-4 text-sky-600" />
                  Assessment is Live!
                </h3>
                <p className="text-sm text-slate-500">Share this link with your students to begin.</p>
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <code className="bg-slate-50 border border-slate-200 px-3 py-2 rounded-lg text-sm text-slate-600 flex-1 sm:w-64 truncate">
                  {studentLink}
                </code>
                <button
                  onClick={copyLink}
                  className="p-2 bg-sky-50 text-sky-600 hover:bg-sky-100 rounded-lg transition-colors border border-sky-100 flex-shrink-0"
                  aria-label="Copy link"
                >
                  {linkCopied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                </button>
              </div>
            </motion.div>
          )}

          {error && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl text-sm mb-6 flex items-start gap-2">
              <p>{error}</p>
            </motion.div>
          )}

          {success && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 rounded-xl text-sm mb-6 flex items-start gap-2">
              <CheckCircle2 className="w-5 h-5 shrink-0" />
              <p>{success}</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Layout Split: Questions List & Editor */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

          {/* Left Column: Bank */}
          <div className="lg:col-span-4 space-y-4">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col lg:min-h-[600px]">
              <div className="px-5 py-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                <div>
                  <h2 className="font-bold text-slate-800">Question Bank</h2>
                  <p className="text-xs text-slate-500 mt-0.5">{questions.length} questions saved</p>
                </div>
              </div>

              <div className="p-3 space-y-2 overflow-y-auto flex-1 bg-slate-50/30">
                {questions.length === 0 ? (
                  <div className="text-center p-6 bg-white rounded-xl border border-dashed border-slate-300">
                    <Sparkles className="w-8 h-8 text-sky-300 mx-auto mb-2" />
                    <p className="text-sm text-slate-500">Bank is empty. Students need at least one question.</p>
                  </div>
                ) : (
                  questions.map((q, i) => (
                    <button
                      key={q.id}
                      onClick={() => openQuestionForEdit(i)}
                      className={`w-full text-left p-4 rounded-xl border transition-all ${activeQuestionIndex === i && !hasUnsavedQuestionDraft
                        ? 'bg-white border-sky-300 shadow-sm shadow-sky-100 ring-1 ring-sky-300'
                        : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-sm'
                        }`}
                    >
                      <h3 className={`font-medium text-sm line-clamp-2 ${activeQuestionIndex === i && !hasUnsavedQuestionDraft ? 'text-sky-900' : 'text-slate-700'}`}>
                        {q.title || 'Untitled Question'}
                      </h3>
                    </button>
                  ))
                )}
              </div>

              <div className="p-4 bg-white border-t border-slate-100 space-y-2">
                <button
                  onClick={handleGenerate}
                  disabled={generating}
                  className="w-full flex justify-center items-center gap-2 px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-xl disabled:opacity-50 transition-all shadow-sm shadow-purple-600/20"
                >
                  {generating ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Wand2 className="w-4 h-4" />
                  )}
                  Generate with AI
                </button>
                <button
                  onClick={handleCreateManualQuestion}
                  className="w-full flex justify-center items-center gap-2 px-4 py-2.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-sm font-medium rounded-xl transition-all"
                >
                  <Plus className="w-4 h-4" />
                  Add Manual Question
                </button>
              </div>
            </div>
          </div>

          {/* Right Column: Editor */}
          <div className="lg:col-span-8">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                <div>
                  <h2 className="font-bold text-slate-800 text-lg">
                    {hasUnsavedQuestionDraft ? 'Draft Question' : 'Edit Question'}
                  </h2>
                  {hasUnsavedQuestionDraft && <p className="text-xs font-medium text-amber-600 mt-1">Unsaved changes present</p>}
                </div>
                {activeQuestionIndex !== null && !hasUnsavedQuestionDraft && (
                  <button
                    onClick={() => handleDeleteQuestion(activeQuestionIndex)}
                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Delete Question"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                )}
              </div>

              <div className="p-6 space-y-6">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Problem Title</label>
                  <input
                    value={problemTitle}
                    onChange={(e) => {
                      setProblemTitle(e.target.value);
                      setHasUnsavedQuestionDraft(true);
                    }}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all outline-none text-slate-800"
                    placeholder="e.g. Implement a Binary Search Tree"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Problem Description</label>
                  <textarea
                    value={problemDesc}
                    onChange={(e) => {
                      setProblemDesc(e.target.value);
                      setHasUnsavedQuestionDraft(true);
                    }}
                    rows={6}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all outline-none text-slate-800 resize-y"
                    placeholder="Describe the problem, inputs, and expected outputs..."
                  />
                </div>

                {/* Followups & Targets Split */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* Followups */}
                  <div>
                    <div className="flex justify-between items-end mb-3">
                      <label className="text-sm font-semibold text-slate-700">Followup Hints</label>
                      <button
                        onClick={() => {
                          setFollowups([...followups, '']);
                          setHasUnsavedQuestionDraft(true);
                        }}
                        className="text-xs font-medium text-sky-600 hover:text-sky-700 flex items-center gap-1 bg-sky-50 px-2 py-1 rounded"
                      >
                        <Plus className="w-3 h-3" /> Add
                      </button>
                    </div>
                    <div className="space-y-2">
                      {followups.map((f, i) => (
                        <div key={i} className="flex gap-2">
                          <input
                            value={f}
                            onChange={(e) => {
                              const updated = [...followups];
                              updated[i] = e.target.value;
                              setFollowups(updated);
                              setHasUnsavedQuestionDraft(true);
                            }}
                            className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 outline-none"
                            placeholder={`Hint ${i + 1}`}
                          />
                          <button
                            onClick={() => {
                              setFollowups(followups.filter((_, j) => j !== i));
                              setHasUnsavedQuestionDraft(true);
                            }}
                            className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-100"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                      {followups.length === 0 && (
                        <p className="text-xs text-slate-400 italic py-2">No follow-ups defined.</p>
                      )}
                    </div>
                  </div>

                  {/* Concept Targets */}
                  <div>
                    <div className="flex justify-between items-end mb-3">
                      <label className="text-sm font-semibold text-slate-700">Target Concepts</label>
                      <button
                        onClick={() => {
                          setConceptTargets([...conceptTargets, '']);
                          setHasUnsavedQuestionDraft(true);
                        }}
                        className="text-xs font-medium text-sky-600 hover:text-sky-700 flex items-center gap-1 bg-sky-50 px-2 py-1 rounded"
                      >
                        <Plus className="w-3 h-3" /> Add
                      </button>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {conceptTargets.map((c, i) => (
                        <div key={i} className="flex items-center gap-1 bg-slate-100 border border-slate-200 pl-3 pr-1 py-1 rounded-lg text-sm group focus-within:ring-2 focus-within:ring-sky-500/20 focus-within:border-sky-500">
                          <input
                            value={c}
                            onChange={(e) => {
                              const updated = [...conceptTargets];
                              updated[i] = e.target.value;
                              setConceptTargets(updated);
                              setHasUnsavedQuestionDraft(true);
                            }}
                            className="bg-transparent border-none text-sm w-auto min-w-[60px] max-w-[140px] focus:outline-none text-slate-700 font-medium p-0"
                            placeholder="Concept"
                          />
                          <button
                            onClick={() => {
                              setConceptTargets(conceptTargets.filter((_, j) => j !== i));
                              setHasUnsavedQuestionDraft(true);
                            }}
                            className="p-1 text-slate-400 hover:text-red-500 rounded transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                      {conceptTargets.length === 0 && (
                        <p className="text-xs text-slate-400 italic py-2">No target concepts defined.</p>
                      )}
                    </div>
                  </div>
                </div>

                <hr className="border-slate-100 my-6" />

                <div className="flex justify-end pt-2">
                  <button
                    onClick={handleSaveProblem}
                    disabled={saving || (!problemTitle.trim() && !problemDesc.trim())}
                    className="inline-flex justify-center items-center gap-2 px-6 py-2.5 bg-sky-600 text-white rounded-xl font-medium hover:bg-sky-700 disabled:opacity-50 transition-all shadow-sm shadow-sky-600/20"
                  >
                    {saving ? (
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    Save to Bank
                  </button>
                </div>
              </div>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}
