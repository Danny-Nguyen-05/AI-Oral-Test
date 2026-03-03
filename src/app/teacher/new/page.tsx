'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowLeft, Save, Plus, X, ListPlus } from 'lucide-react';
import type { RubricWeight } from '@/lib/types';

const DEFAULT_RUBRIC: RubricWeight[] = [
  { category: 'Understanding', weight: 20 },
  { category: 'Approach', weight: 20 },
  { category: 'Correctness & Reasoning', weight: 20 },
  { category: 'Complexity Analysis', weight: 15 },
  { category: 'Edge Cases', weight: 10 },
  { category: 'Communication', weight: 15 },
];

export default function NewAssignment() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [topic, setTopic] = useState('');
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [timeLimitMin, setTimeLimitMin] = useState(8);
  const [maxTurns, setMaxTurns] = useState(10);
  const [rubric, setRubric] = useState<RubricWeight[]>(DEFAULT_RUBRIC);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function updateRubricWeight(index: number, weight: number) {
    const updated = [...rubric];
    updated[index] = { ...updated[index], weight };
    setRubric(updated);
  }

  function addRubricCategory() {
    setRubric([...rubric, { category: '', weight: 0 }]);
  }

  function removeRubricCategory(index: number) {
    setRubric(rubric.filter((_, i) => i !== index));
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    const totalWeight = rubric.reduce((sum, r) => sum + r.weight, 0);
    if (totalWeight !== 100) {
      setError(`Rubric weights must sum to 100 (currently ${totalWeight})`);
      return;
    }

    setSaving(true);

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      router.push('/teacher/login');
      return;
    }

    const { data, error: insertErr } = await supabase
      .from('assignments')
      .insert({
        teacher_user_id: session.user.id,
        title,
        topic,
        difficulty,
        time_limit_seconds: timeLimitMin * 60,
        max_turns: maxTurns,
        rubric,
        published: false,
      })
      .select()
      .single();

    if (insertErr) {
      setError(insertErr.message);
      setSaving(false);
      return;
    }

    router.push(`/teacher/a/${data.id}`);
  }

  const totalWeight = rubric.reduce((s, r) => s + r.weight, 0);

  return (
    <div className="min-h-screen bg-slate-50 pb-12">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-6 h-16 flex items-center">
          <button
            type="button"
            onClick={() => router.push('/teacher/dashboard')}
            className="flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-800 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Dashboard</span>
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden"
        >
          <div className="bg-slate-50/50 border-b border-slate-100 px-8 py-6">
            <h1 className="text-2xl font-bold text-slate-800">Create New Assignment</h1>
            <p className="text-slate-500 mt-1">Configure an AI assessment for your students.</p>
          </div>

          <form onSubmit={handleCreate} className="p-8 space-y-8">
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Assignment Title <span className="text-red-500">*</span></label>
                <input
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all outline-none"
                  placeholder="e.g., Data Structures Midterm"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Focus Topic</label>
                  <input
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all outline-none"
                    placeholder="e.g., Binary Trees"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Difficulty Level</label>
                  <div className="relative">
                    <select
                      value={difficulty}
                      onChange={(e) => setDifficulty(e.target.value as 'easy' | 'medium' | 'hard')}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all outline-none appearance-none"
                    >
                      <option value="easy">Easy</option>
                      <option value="medium">Medium</option>
                      <option value="hard">Hard</option>
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-slate-500">
                      <svg className="h-4 w-4 fill-current" viewBox="0 0 20 20"><path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" /></svg>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Time Limit (minutes)</label>
                  <input
                    type="number"
                    min={1}
                    max={30}
                    value={timeLimitMin}
                    onChange={(e) => setTimeLimitMin(Number(e.target.value))}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all outline-none"
                  />
                  <p className="text-xs text-slate-500 mt-1.5">Max allowed time for the entire oral assessment</p>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Max Interview Turns</label>
                  <input
                    type="number"
                    min={3}
                    max={20}
                    value={maxTurns}
                    onChange={(e) => setMaxTurns(Number(e.target.value))}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all outline-none"
                  />
                  <p className="text-xs text-slate-500 mt-1.5">A turn is one message from AI + one from student</p>
                </div>
              </div>
            </div>

            <hr className="border-slate-100" />

            <div>
              <div className="flex justify-between items-end mb-4">
                <div>
                  <label className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                    <ListPlus className="w-4 h-4 text-sky-600" />
                    Grading Rubric
                  </label>
                  <p className="text-xs text-slate-500 mt-1">Weights must sum to exactly 100%.</p>
                </div>
                <button
                  type="button"
                  onClick={addRubricCategory}
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-sky-600 hover:text-sky-700 bg-sky-50 hover:bg-sky-100 px-3 py-1.5 rounded-lg transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Add Category
                </button>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-2 space-y-2">
                {rubric.map((r, i) => (
                  <div key={i} className="flex gap-2 items-center bg-white p-2 rounded-lg border border-slate-100 shadow-sm">
                    <input
                      value={r.category}
                      onChange={(e) => {
                        const updated = [...rubric];
                        updated[i] = { ...updated[i], category: e.target.value };
                        setRubric(updated);
                      }}
                      placeholder="Category name"
                      className="flex-1 px-3 py-2 bg-transparent border-none text-sm focus:ring-0 outline-none placeholder:text-slate-400 font-medium text-slate-700"
                    />
                    <div className="w-px h-6 bg-slate-200"></div>
                    <div className="relative flex items-center pr-3">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={r.weight}
                        onChange={(e) => updateRubricWeight(i, Number(e.target.value))}
                        className="w-16 px-2 py-1 bg-slate-50 border border-slate-200 rounded-md text-sm text-center focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                      />
                      <span className="text-sm font-medium text-slate-400 ml-1.5">%</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeRubricCategory(i)}
                      className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex justify-end mt-3">
                <span className={`text-sm font-semibold px-3 py-1 rounded-full ${totalWeight === 100 ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                  Total Weight: {totalWeight}%
                </span>
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm flex items-start gap-2">
                <div className="shrink-0 mt-0.5"><X className="w-4 h-4" /></div>
                <p>{error}</p>
              </div>
            )}

            <div className="pt-4 flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 px-6 py-2.5 bg-sky-600 text-white rounded-xl font-medium hover:bg-sky-700 disabled:opacity-50 transition-all shadow-sm shadow-sky-600/20 hover:shadow-md"
              >
                {saving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    Create Assignment
                  </>
                )}
              </button>
            </div>
          </form>
        </motion.div>
      </main>
    </div>
  );
}
