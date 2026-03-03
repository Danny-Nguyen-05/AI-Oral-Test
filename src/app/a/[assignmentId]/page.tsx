'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';

export default function StudentEntry() {
  const params = useParams();
  const router = useRouter();
  const assignmentId = params.assignmentId as string;

  const [assignment, setAssignment] = useState<{
    title: string;
    topic: string;
    difficulty: string;
    time_limit_seconds: number;
  } | null>(null);
  const [studentName, setStudentName] = useState('');
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadAssignment() {
      const { data } = await supabase
        .from('assignments')
        .select('title, topic, difficulty, time_limit_seconds, published')
        .eq('id', assignmentId)
        .eq('published', true)
        .single();

      if (data) {
        setAssignment(data);
      } else {
        setError('Assignment not found or not published');
      }
      setLoading(false);
    }
    loadAssignment();
  }, [assignmentId]);

  async function handleStart(e: React.FormEvent) {
    e.preventDefault();
    if (!studentName.trim()) return;
    setCreating(true);
    setError('');

    try {
      const res = await fetch('/api/student/createAttempt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignmentId, studentName: studentName.trim() }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      // Store attemptId in localStorage
      localStorage.setItem(`attempt_${data.attemptId}`, JSON.stringify({
        attemptId: data.attemptId,
        assignmentId,
        studentName: studentName.trim(),
      }));

      router.push(`/attempt/${data.attemptId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create attempt');
      setCreating(false);
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
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Assessment Not Available</h1>
          <p className="text-gray-500">{error || 'This assessment is not published.'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="bg-white p-8 rounded-lg shadow-md max-w-md w-full space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">{assignment.title}</h1>
          <p className="text-sm text-gray-500 mt-2">
            {assignment.topic} · {assignment.difficulty} · {assignment.time_limit_seconds / 60} min
          </p>
        </div>

        <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4 text-sm text-yellow-800">
          <p className="font-medium mb-1">Before you begin:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>You will need a camera and microphone</li>
            <li>Recording is mandatory for the entire session</li>
            <li>You will speak on camera while typing answers</li>
            <li>An AI interviewer will ask you questions</li>
            <li>Time limit: {assignment.time_limit_seconds / 60} minutes</li>
          </ul>
        </div>

        <form onSubmit={handleStart} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Your Name / Student ID
            </label>
            <input
              required
              value={studentName}
              onChange={(e) => setStudentName(e.target.value)}
              placeholder="Enter your name"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          {error && <p className="text-red-600 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={creating || !studentName.trim()}
            className="w-full py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 transition"
          >
            {creating ? 'Setting up...' : 'Continue to Assessment'}
          </button>
        </form>
      </div>
    </div>
  );
}
