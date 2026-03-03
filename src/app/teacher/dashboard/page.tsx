'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
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
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-bold text-gray-900">My Assignments</h1>
        <div className="flex gap-3">
          <Link
            href="/teacher/new"
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition"
          >
            + New Assignment
          </Link>
          <button
            onClick={handleLogout}
            className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-100 transition"
          >
            Logout
          </button>
        </div>
      </div>

      {assignments.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <p>No assignments yet. Create your first one!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {assignments.map((a) => (
            <div key={a.id} className="bg-white p-5 rounded-lg shadow-sm border border-gray-200">
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">{a.title}</h2>
                  <p className="text-sm text-gray-500 mt-1">
                    {a.topic} · {a.difficulty} · {a.time_limit_seconds / 60} min
                  </p>
                  <span
                    className={`inline-block mt-2 text-xs px-2 py-1 rounded-full ${
                      a.published
                        ? 'bg-green-100 text-green-700'
                        : 'bg-yellow-100 text-yellow-700'
                    }`}
                  >
                    {a.published ? 'Published' : 'Draft'}
                  </span>
                </div>
                <div className="flex gap-2">
                  <Link
                    href={`/teacher/a/${a.id}`}
                    className="text-sm px-3 py-1.5 border border-gray-300 rounded-md hover:bg-gray-50 transition"
                  >
                    Edit
                  </Link>
                  <Link
                    href={`/teacher/a/${a.id}/submissions`}
                    className="text-sm px-3 py-1.5 border border-blue-300 text-blue-600 rounded-md hover:bg-blue-50 transition"
                  >
                    Submissions
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
