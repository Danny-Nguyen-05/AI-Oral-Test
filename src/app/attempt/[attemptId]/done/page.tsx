'use client';

import { useParams } from 'next/navigation';

export default function AttemptDone() {
  const params = useParams();
  const attemptId = params.attemptId as string;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white p-8 rounded-lg shadow-md max-w-md w-full text-center space-y-6">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
          <svg className="w-8 h-8 text-green-600" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
              clipRule="evenodd"
            />
          </svg>
        </div>

        <h1 className="text-2xl font-bold text-gray-900">Assessment Submitted!</h1>

        <p className="text-gray-600">
          Your recording and responses have been submitted successfully. Your instructor will
          review your submission.
        </p>

        <div className="bg-gray-50 rounded-md p-4">
          <p className="text-xs text-gray-500">Attempt ID</p>
          <p className="text-sm font-mono text-gray-700 mt-1 break-all">{attemptId}</p>
        </div>

        <p className="text-sm text-gray-500">
          You can safely close this window.
        </p>
      </div>
    </div>
  );
}
