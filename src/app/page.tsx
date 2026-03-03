'use client';
import Link from 'next/link';

export default function Home() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center space-y-6 max-w-md mx-auto px-4">
        <h1 className="text-4xl font-bold text-gray-900">OralCheck</h1>
        <p className="text-gray-600">AI-powered oral technical assessments</p>
        <div className="space-y-3">
          <Link
            href="/teacher/login"
            className="block w-full py-3 px-6 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            Teacher Login
          </Link>
          <p className="text-sm text-gray-500">
            Students: use the link shared by your teacher
          </p>
        </div>
      </div>
    </div>
  );
}
