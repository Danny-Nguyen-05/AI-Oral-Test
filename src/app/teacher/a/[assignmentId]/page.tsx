'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useRouter, useParams } from 'next/navigation';
import type { Assignment, SelectedProblem, QuestionBank } from '@/lib/types';

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

  // Editable problem fields
  const [problemTitle, setProblemTitle] = useState('');
  const [problemDesc, setProblemDesc] = useState('');
  const [followups, setFollowups] = useState<string[]>([]);
  const [conceptTargets, setConceptTargets] = useState<string[]>([]);

  const loadAssignment = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
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
      const qb = a.question_bank as QuestionBank | null;
      if (qb?.selected_problem) {
        setProblemTitle(qb.selected_problem.title);
        setProblemDesc(qb.selected_problem.description);
        setFollowups(qb.selected_problem.followups || []);
        setConceptTargets(qb.selected_problem.concept_targets || []);
      }
    }
    setLoading(false);
  }, [assignmentId, router]);

  useEffect(() => {
    loadAssignment();
  }, [loadAssignment]);

  async function handleGenerate() {
    if (!assignment) return;
    setGenerating(true);
    setError('');

    try {
      const res = await fetch('/api/ai/generateQuestion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: assignment.topic,
          difficulty: assignment.difficulty,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      const sp: SelectedProblem = data.selected_problem;
      setProblemTitle(sp.title);
      setProblemDesc(sp.description);
      setFollowups(sp.followups);
      setConceptTargets(sp.concept_targets);

      // Save to DB
      await supabase
        .from('assignments')
        .update({
          question_bank: { selected_problem: sp },
        })
        .eq('id', assignmentId);

      setSuccess('Question generated successfully!');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate');
    }
    setGenerating(false);
  }

  async function handleSaveProblem() {
    setSaving(true);
    setError('');

    const qb = assignment?.question_bank as QuestionBank | null;
    const sp: SelectedProblem = {
      id: qb?.selected_problem?.id || crypto.randomUUID(),
      title: problemTitle,
      description: problemDesc,
      followups,
      concept_targets: conceptTargets,
    };

    const { error: uErr } = await supabase
      .from('assignments')
      .update({ question_bank: { selected_problem: sp } })
      .eq('id', assignmentId);

    if (uErr) {
      setError(uErr.message);
    } else {
      setSuccess('Problem saved!');
      loadAssignment();
    }
    setSaving(false);
  }

  async function handlePublish() {
    if (!assignment?.question_bank) {
      setError('Generate or create a question before publishing');
      return;
    }

    const { error: uErr } = await supabase
      .from('assignments')
      .update({ published: !assignment.published })
      .eq('id', assignmentId);

    if (uErr) {
      setError(uErr.message);
    } else {
      setSuccess(assignment.published ? 'Unpublished!' : 'Published!');
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
    <div className="max-w-3xl mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{assignment.title}</h1>
          <p className="text-sm text-gray-500 mt-1">
            {assignment.topic} · {assignment.difficulty} · {assignment.time_limit_seconds / 60} min · {assignment.max_turns} turns
          </p>
        </div>
        <div className="flex gap-2">
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

      {/* Question Bank Section */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Question Bank</h2>
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="px-4 py-2 bg-purple-600 text-white text-sm rounded-md hover:bg-purple-700 disabled:opacity-50 transition"
          >
            {generating ? 'Generating...' : 'Generate Question Bank'}
          </button>
        </div>

        {problemTitle ? (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Problem Title</label>
              <input
                value={problemTitle}
                onChange={(e) => setProblemTitle(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Problem Description</label>
              <textarea
                value={problemDesc}
                onChange={(e) => setProblemDesc(e.target.value)}
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
                      const u = [...followups];
                      u[i] = e.target.value;
                      setFollowups(u);
                    }}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                  <button
                    onClick={() => setFollowups(followups.filter((_, j) => j !== i))}
                    className="text-red-500 text-sm"
                  >
                    ✕
                  </button>
                </div>
              ))}
              <button
                onClick={() => setFollowups([...followups, ''])}
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
                        const u = [...conceptTargets];
                        u[i] = e.target.value;
                        setConceptTargets(u);
                      }}
                      className="bg-transparent border-none text-sm w-auto focus:outline-none"
                      size={c.length || 10}
                    />
                    <button
                      onClick={() => setConceptTargets(conceptTargets.filter((_, j) => j !== i))}
                      className="text-red-400 hover:text-red-600"
                    >
                      ✕
                    </button>
                  </span>
                ))}
                <button
                  onClick={() => setConceptTargets([...conceptTargets, ''])}
                  className="text-sm text-blue-600 hover:text-blue-700"
                >
                  + Add
                </button>
              </div>
            </div>

            <button
              onClick={handleSaveProblem}
              disabled={saving}
              className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:opacity-50 transition"
            >
              {saving ? 'Saving...' : 'Save Problem'}
            </button>
          </div>
        ) : (
          <p className="text-gray-500 text-sm">
            No question generated yet. Click &quot;Generate Question Bank&quot; to create one.
          </p>
        )}
      </div>
    </div>
  );
}
