'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowLeft, Users, Clock, Award, FileText, ChevronRight } from 'lucide-react';
import type { Attempt } from '@/lib/types';

export default function SubmissionsList() {
  const params = useParams();
  const router = useRouter();
  const assignmentId = params.assignmentId as string;

  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [assignmentTitle, setAssignmentTitle] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      router.push('/teacher/login');
      return;
    }

    const { data: aData } = await supabase
      .from('assignments')
      .select('title')
      .eq('id', assignmentId)
      .single();

    if (aData) setAssignmentTitle(aData.title);

    const { data } = await supabase
      .from('attempts')
      .select('*')
      .eq('assignment_id', assignmentId)
      .order('created_at', { ascending: false });

    setAttempts((data as Attempt[]) || []);
    setLoading(false);
  }, [assignmentId, router]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-4 border-sky-600/30 border-t-sky-600 rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-12">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link
            href={`/teacher/a/${assignmentId}`}
            className="flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-800 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Assignment</span>
          </Link>
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
            <Users className="w-4 h-4 text-sky-600" />
            {attempts.length} Submissions
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8">
        <div className="mb-8 flex items-center gap-4">
          <div className="bg-sky-100 p-3 rounded-xl text-sky-600">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Student Submissions</h1>
            <p className="text-slate-500 mt-1 font-medium">{assignmentTitle}</p>
          </div>
        </div>

        {attempts.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-16 bg-white border border-slate-200 border-dashed rounded-2xl"
          >
            <Users className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-slate-700">No submissions yet</h3>
            <p className="text-slate-500 mt-1">When students complete the assessment, their results will appear here.</p>
          </motion.div>
        ) : (
          <div className="space-y-4">
            {attempts.map((att, i) => (
              <motion.div
                key={att.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: i * 0.05 }}
              >
                <Link
                  href={`/teacher/attempt/${att.id}`}
                  className="group block bg-white p-5 rounded-2xl shadow-sm border border-slate-200 hover:border-sky-300 hover:shadow-md transition-all flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-slate-600 text-lg">
                      {att.student_name ? att.student_name.charAt(0).toUpperCase() : '?'}
                    </div>
                    <div>
                      <p className="text-lg font-bold text-slate-800 group-hover:text-sky-700 transition-colors">{att.student_name}</p>
                      <div className="flex items-center gap-3 mt-1 5 text-sm">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${att.status === 'submitted' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
                          }`}>
                          {att.status.replace(/_/g, ' ').toUpperCase()}
                        </span>
                        {att.submitted_at && (
                          <span className="flex items-center gap-1 text-slate-500">
                            <Clock className="w-3.5 h-3.5" />
                            {new Date(att.submitted_at).toLocaleDateString()} at {new Date(att.submitted_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-6 w-full sm:w-auto mt-2 sm:mt-0 pt-4 sm:pt-0 border-t sm:border-0 border-slate-100">
                    <div className="text-right flex-1 sm:flex-none">
                      {att.final_score !== null ? (
                        <div className="flex flex-col items-end">
                          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-0.5">Score</span>
                          <span className="text-2xl font-black text-slate-800 flex items-baseline gap-1">
                            {att.teacher_override_score !== null ? (
                              <span className="text-sky-600 flex items-center gap-1">
                                {att.teacher_override_score}
                                <Award className="w-5 h-5 text-sky-500" />
                              </span>
                            ) : (
                              <span className={att.final_score >= 80 ? 'text-emerald-600' : att.final_score >= 60 ? 'text-amber-600' : 'text-red-500'}>
                                {att.final_score}
                              </span>
                            )}
                            <span className="text-sm font-medium text-slate-400">/ 100</span>
                          </span>
                          {att.teacher_override_score !== null && (
                            <span className="text-xs text-slate-400 mt-1 line-through">AI: {att.final_score}</span>
                          )}
                        </div>
                      ) : (
                        <div className="text-sm font-medium text-slate-400 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100">
                          Not Graded
                        </div>
                      )}
                    </div>
                    <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-sky-500 group-hover:translate-x-1 transition-all" />
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
