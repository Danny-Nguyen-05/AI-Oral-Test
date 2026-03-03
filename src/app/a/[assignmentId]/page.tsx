'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { motion } from 'framer-motion';
import { GraduationCap, Clock, AlertTriangle, ArrowRight, Video, Mic, CheckCircle2 } from 'lucide-react';

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
        setError('Assignment not found or not currently published. Ask your teacher for the updated link.');
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
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-4 border-sky-600/30 border-t-sky-600 rounded-full animate-spin" />
          <p className="text-slate-500 font-medium">Loading Assessment...</p>
        </div>
      </div>
    );
  }

  if (!assignment) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-8 h-8" />
          </div>
          <h1 className="text-xl font-bold text-slate-800 mb-2">Assessment Unavailable</h1>
          <p className="text-slate-500 text-sm leading-relaxed">{error}</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      {/* Background Ornaments */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-sky-200/40 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-sky-300/30 rounded-full blur-[100px] pointer-events-none" />

      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white p-8 sm:p-10 rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-200/60 max-w-lg w-full z-10 relative">
        <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-sky-600 p-3 rounded-2xl text-white shadow-lg shadow-sky-600/30">
          <GraduationCap className="w-8 h-8" />
        </div>

        <div className="text-center mt-6 mb-8">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-800 tracking-tight">{assignment.title}</h1>
          <div className="flex flex-wrap justify-center items-center gap-2 mt-3">
            <span className="inline-flex items-center px-2.5 py-1 rounded bg-slate-100 text-slate-600 text-xs font-semibold">
              {assignment.topic || 'General Topic'}
            </span>
            <span className="inline-flex items-center px-2.5 py-1 rounded bg-slate-100 text-slate-600 text-xs font-semibold">
              {assignment.difficulty}
            </span>
          </div>
        </div>

        <div className="bg-amber-50 border border-amber-200/60 rounded-xl p-5 mb-8">
          <h3 className="font-bold text-amber-800 text-sm mb-3 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" /> Wait before starting
          </h3>
          <ul className="space-y-3 text-sm text-amber-700/90 font-medium">
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
              <span>Provide your name or student ID below.</span>
            </li>
            <li className="flex items-start gap-2">
              <div className="flex gap-1 shrink-0 mt-0.5 text-amber-600"><Video className="w-4 h-4" /><Mic className="w-4 h-4" /></div>
              <span>Ensure your camera and microphone are working. You will be recorded.</span>
            </li>
            <li className="flex items-start gap-2">
              <Clock className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
              <span>You will have exactly <b>{assignment.time_limit_seconds / 60} minutes</b> once you begin.</span>
            </li>
          </ul>
        </div>

        <form onSubmit={handleStart} className="space-y-6">
          <div className="space-y-2">
            <label className="block text-sm font-bold text-slate-700">
              Identity Verification
            </label>
            <input
              required
              value={studentName}
              onChange={(e) => setStudentName(e.target.value)}
              placeholder="Full Name or Student ID"
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all outline-none font-medium text-slate-800 placeholder:text-slate-400"
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl text-sm font-medium">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={creating || !studentName.trim()}
            className="group w-full flex justify-center items-center gap-2 py-3.5 bg-sky-600 hover:bg-sky-700 text-white rounded-xl font-bold text-lg disabled:opacity-50 disabled:hover:bg-sky-600 transition-all shadow-lg shadow-sky-600/20 hover:shadow-sky-600/40 relative overflow-hidden"
          >
            {creating ? (
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Preparing Environment...
              </div>
            ) : (
              <>
                Start Assessment
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </>
            )}
          </button>
        </form>
      </motion.div>
    </div>
  );
}
