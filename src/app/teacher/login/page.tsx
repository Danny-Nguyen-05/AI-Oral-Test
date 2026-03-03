'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

export default function TeacherLogin() {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        router.push('/teacher/dashboard');
      }
    });
  }, [router]);

  async function handleGoogleLogin() {
    setLoading(true);
    setError('');

    const { error: signInError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/teacher/dashboard`,
      },
    });

    if (signInError) {
      setError(signInError.message);
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="bg-white p-8 rounded-lg shadow-md max-w-md w-full space-y-6">
        <h1 className="text-2xl font-bold text-slate-800 text-center">Teacher Login</h1>
        <p className="text-sm text-slate-600 text-center">
          Sign in with your Google account to access teacher tools.
        </p>
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <button
          onClick={handleGoogleLogin}
          disabled={loading}
          className="w-full py-2 bg-sky-600 text-white rounded-md hover:bg-sky-700 disabled:opacity-50 transition"
        >
          {loading ? 'Redirecting...' : 'Continue with Google'}
        </button>
      </div>
    </div>
  );
}
