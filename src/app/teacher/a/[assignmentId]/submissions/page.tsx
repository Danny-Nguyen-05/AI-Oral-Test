'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
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
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Submissions</h1>
          <p className="text-sm text-gray-500">{assignmentTitle}</p>
        </div>
        <Link
          href={`/teacher/a/${assignmentId}`}
          className="px-4 py-2 border border-gray-300 rounded-md text-sm hover:bg-gray-50 transition"
        >
          ← Back to Assignment
        </Link>
      </div>

      {attempts.length === 0 ? (
        <p className="text-center text-gray-500 py-12">No submissions yet.</p>
      ) : (
        <div className="space-y-3">
          {attempts.map((att) => (
            <Link
              key={att.id}
              href={`/teacher/attempt/${att.id}`}
              className="block bg-white p-4 rounded-lg shadow-sm border border-gray-200 hover:border-blue-300 transition"
            >
              <div className="flex justify-between items-center">
                <div>
                  <p className="font-medium text-gray-900">{att.student_name}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    Status: <span className="font-medium">{att.status}</span>
                    {att.submitted_at && ` · Submitted ${new Date(att.submitted_at).toLocaleString()}`}
                  </p>
                </div>
                <div className="text-right">
                  {att.final_score !== null && (
                    <p className="text-2xl font-bold text-blue-600">{att.final_score}</p>
                  )}
                  {att.teacher_override_score !== null && (
                    <p className="text-sm text-orange-600">
                      Override: {att.teacher_override_score}
                    </p>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
