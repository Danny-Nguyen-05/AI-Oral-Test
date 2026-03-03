'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
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

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">New Assignment</h1>

      <form onSubmit={handleCreate} className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
          <input
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none"
            placeholder="e.g., Data Structures Midterm"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Topic</label>
            <input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none"
              placeholder="e.g., Binary Trees"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Difficulty</label>
            <select
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value as 'easy' | 'medium' | 'hard')}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none"
            >
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Time Limit (min)</label>
            <input
              type="number"
              min={1}
              max={30}
              value={timeLimitMin}
              onChange={(e) => setTimeLimitMin(Number(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Max Turns</label>
            <input
              type="number"
              min={3}
              max={20}
              value={maxTurns}
              onChange={(e) => setMaxTurns(Number(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>
        </div>

        <div>
          <div className="flex justify-between items-center mb-2">
            <label className="block text-sm font-medium text-gray-700">Rubric Weights (must sum to 100)</label>
            <button
              type="button"
              onClick={addRubricCategory}
              className="text-sm text-blue-600 hover:text-blue-700"
            >
              + Add Category
            </button>
          </div>
          <div className="space-y-2">
            {rubric.map((r, i) => (
              <div key={i} className="flex gap-2 items-center">
                <input
                  value={r.category}
                  onChange={(e) => {
                    const updated = [...rubric];
                    updated[i] = { ...updated[i], category: e.target.value };
                    setRubric(updated);
                  }}
                  placeholder="Category name"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={r.weight}
                  onChange={(e) => updateRubricWeight(i, Number(e.target.value))}
                  className="w-20 px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
                <span className="text-sm text-gray-500">%</span>
                <button
                  type="button"
                  onClick={() => removeRubricCategory(i)}
                  className="text-red-500 hover:text-red-700 text-sm"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Total: {rubric.reduce((s, r) => s + r.weight, 0)}%
          </p>
        </div>

        {error && <p className="text-red-600 text-sm">{error}</p>}

        <button
          type="submit"
          disabled={saving}
          className="w-full py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 transition"
        >
          {saving ? 'Creating...' : 'Create Assignment'}
        </button>
      </form>
    </div>
  );
}
