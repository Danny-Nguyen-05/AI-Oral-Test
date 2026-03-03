'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Plus, LogOut, FileText, Clock, BarChart2, CheckCircle2, CircleDashed } from 'lucide-react';
import type { Assignment } from '@/lib/types';

export default function TeacherDashboard() {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/teacher/login');
        return;
      }

      const { data } = await supabase
        .from('assignments')
        .select('*')
        .eq('teacher_user_id', session.user.id)
        .order('created_at', { ascending: false });

      setAssignments((data as Assignment[]) || []);
      setLoading(false);
    }
    load();
  }, [router]);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push('/teacher/login');
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-4 border-sky-600/30 border-t-sky-600 rounded-full animate-spin" />
          <p className="text-slate-500 font-medium">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-12">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-sky-600 p-1.5 rounded-md text-white">
              <FileText className="w-5 h-5" />
            </div>
            <span className="font-bold text-slate-800 text-lg tracking-tight">Teacher Dashboard</span>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-800 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Assignments</h1>
            <p className="text-slate-500 mt-1">Manage and create AI oral assessments</p>
          </div>
          <Link
            href="/teacher/new"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-sky-600 hover:bg-sky-700 text-white rounded-xl font-medium transition-all shadow-sm shadow-sky-600/20 hover:shadow-md hover:-translate-y-0.5"
          >
            <Plus className="w-5 h-5" />
            New Assignment
          </Link>
        </div>

        {assignments.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white border border-slate-200 border-dashed rounded-2xl p-12 text-center"
          >
            <div className="bg-sky-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <FileText className="w-8 h-8 text-sky-500" />
            </div>
            <h3 className="text-lg font-semibold text-slate-800 mb-1">No assignments yet</h3>
            <p className="text-slate-500 mb-6 max-w-sm mx-auto">Get started by creating your first AI-powered oral technical assessment.</p>
            <Link
              href="/teacher/new"
              className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg font-medium transition-colors"
            >
              <Plus className="w-4 h-4" />
              Create First Assignment
            </Link>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {assignments.map((a, i) => (
              <motion.div
                key={a.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: i * 0.05 }}
                className="group bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:border-sky-200 transition-all p-5 flex flex-col"
              >
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h2 className="text-lg font-bold text-slate-800 group-hover:text-sky-700 transition-colors line-clamp-1">{a.title}</h2>
                    <div className="flex items-center gap-2 mt-2">
                      <span
                        className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${a.published
                            ? 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20'
                            : 'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/20'
                          }`}
                      >
                        {a.published ? <CheckCircle2 className="w-3.5 h-3.5" /> : <CircleDashed className="w-3.5 h-3.5" />}
                        {a.published ? 'Published' : 'Draft'}
                      </span>
                      <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-1 rounded-md">
                        {a.difficulty}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-4 text-sm text-slate-500 mb-6">
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-slate-400" />
                    <span>{a.time_limit_seconds / 60} min</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <BarChart2 className="w-4 h-4 text-slate-400" />
                    <span className="truncate max-w-[120px]">{a.topic || 'General'}</span>
                  </div>
                </div>

                <div className="mt-auto pt-4 border-t border-slate-100 flex gap-2 w-full">
                  <Link
                    href={`/teacher/a/${a.id}`}
                    className="flex-1 text-center text-sm font-medium px-4 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-lg transition-colors"
                  >
                    Edit Details
                  </Link>
                  <Link
                    href={`/teacher/a/${a.id}/submissions`}
                    className="flex-1 text-center text-sm font-medium px-4 py-2 bg-sky-50 hover:bg-sky-100 text-sky-700 rounded-lg transition-colors"
                  >
                    Submissions
                  </Link>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
