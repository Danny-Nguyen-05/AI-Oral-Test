'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useRouter, useParams } from 'next/navigation';
import type { Attempt, TranscriptMessage, IntegrityEvent, RubricBreakdownItem } from '@/lib/types';

export default function AttemptDetail() {
  const params = useParams();
  const router = useRouter();
  const attemptId = params.attemptId as string;

  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [messages, setMessages] = useState<TranscriptMessage[]>([]);
  const [integrityEvents, setIntegrityEvents] = useState<IntegrityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [playbackUrl, setPlaybackUrl] = useState<string | null>(null);

  const [overrideScore, setOverrideScore] = useState('');
  const [overrideNote, setOverrideNote] = useState('');
  const [savingOverride, setSavingOverride] = useState(false);

  const load = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      router.push('/teacher/login');
      return;
    }

    const [{ data: att }, { data: msgs }, { data: events }] = await Promise.all([
      supabase.from('attempts').select('*').eq('id', attemptId).single(),
      supabase
        .from('transcript_messages')
        .select('*')
        .eq('attempt_id', attemptId)
        .order('created_at', { ascending: true }),
      supabase
        .from('integrity_events')
        .select('*')
        .eq('attempt_id', attemptId)
        .order('created_at', { ascending: true }),
    ]);

    if (att) {
      setAttempt(att as Attempt);
      setOverrideScore(att.teacher_override_score?.toString() || '');
      setOverrideNote(att.teacher_override_note || '');
    }
    setMessages((msgs as TranscriptMessage[]) || []);
    setIntegrityEvents((events as IntegrityEvent[]) || []);
    setLoading(false);
  }, [attemptId, router]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    async function preparePlaybackUrl() {
      if (!attempt?.recording_url) {
        setPlaybackUrl(null);
        return;
      }

      const path = extractRecordingPath(attempt.recording_url);
      if (!path) {
        setPlaybackUrl(attempt.recording_url);
        return;
      }

      const { data, error } = await supabase.storage
        .from('recordings')
        .createSignedUrl(path, 60 * 60);

      if (error || !data?.signedUrl) {
        setPlaybackUrl(attempt.recording_url);
        return;
      }

      setPlaybackUrl(data.signedUrl);
    }

    preparePlaybackUrl();
  }, [attempt?.recording_url]);

  function extractRecordingPath(recordingUrl: string): string | null {
    if (!recordingUrl) return null;

    if (!recordingUrl.includes('/recordings/')) {
      return recordingUrl;
    }

    const marker = '/recordings/';
    const start = recordingUrl.indexOf(marker);
    if (start === -1) return null;

    const afterBucket = recordingUrl.slice(start + marker.length);
    const path = afterBucket.split('?')[0];

    try {
      return decodeURIComponent(path);
    } catch {
      return path;
    }
  }

  async function handleSaveOverride() {
    setSavingOverride(true);
    await supabase
      .from('attempts')
      .update({
        teacher_override_score: overrideScore ? parseInt(overrideScore) : null,
        teacher_override_note: overrideNote || null,
      })
      .eq('id', attemptId);
    setSavingOverride(false);
    load();
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  if (!attempt) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-red-600">Attempt not found</p>
      </div>
    );
  }

  const rubricBreakdown = (attempt.rubric_breakdown || []) as RubricBreakdownItem[];

  return (
    <div className="max-w-5xl mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {attempt.student_name}&apos;s Submission
          </h1>
          <p className="text-sm text-gray-500">
            Status: {attempt.status}
            {attempt.submitted_at && ` · Submitted ${new Date(attempt.submitted_at).toLocaleString()}`}
          </p>
        </div>
        <button
          onClick={() => router.back()}
          className="px-4 py-2 border border-gray-300 rounded-md text-sm hover:bg-gray-50 transition"
        >
          ← Back
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Video + Score */}
        <div className="space-y-6">
          {/* Video Player */}
          {attempt.recording_url && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <h2 className="text-lg font-semibold text-gray-900 mb-3">Recording</h2>
              <video
                src={playbackUrl || attempt.recording_url}
                controls
                className="w-full rounded-md bg-black"
              />
              <p className="text-xs text-gray-500 mt-2">
                Duration: {attempt.recording_duration_seconds ? `${Math.round(attempt.recording_duration_seconds)}s` : 'N/A'}
                {' · '}Size: {attempt.recording_size_bytes ? `${(attempt.recording_size_bytes / 1024 / 1024).toFixed(1)} MB` : 'N/A'}
              </p>
            </div>
          )}

          {/* Score & Rubric */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Score</h2>
            {attempt.final_score !== null ? (
              <>
                <div className="text-center mb-4">
                  <p className="text-5xl font-bold text-blue-600">{attempt.final_score}</p>
                  <p className="text-sm text-gray-500">/100</p>
                </div>

                {rubricBreakdown.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="text-sm font-medium text-gray-700">Rubric Breakdown</h3>
                    {rubricBreakdown.map((item, i) => (
                      <div key={i} className="border border-gray-100 rounded p-3">
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-sm font-medium">{item.category}</span>
                          <span className="text-sm">
                            {item.score}/100 ({item.weight}%)
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                          <div
                            className="bg-blue-600 h-2 rounded-full"
                            style={{ width: `${item.score}%` }}
                          />
                        </div>
                        <p className="text-xs text-gray-600">{item.rationale}</p>
                        {item.evidence_quotes?.length > 0 && (
                          <div className="mt-1">
                            {item.evidence_quotes.map((q, j) => (
                              <p key={j} className="text-xs text-gray-400 italic">&ldquo;{q}&rdquo;</p>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <p className="text-gray-500 text-sm">Not graded yet</p>
            )}
          </div>

          {/* Teacher Override */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Teacher Override</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-gray-700 mb-1">Override Score (0-100)</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={overrideScore}
                  onChange={(e) => setOverrideScore(e.target.value)}
                  placeholder="Leave blank to use AI score"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-700 mb-1">Note</label>
                <textarea
                  value={overrideNote}
                  onChange={(e) => setOverrideNote(e.target.value)}
                  rows={2}
                  placeholder="Reason for override..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
              <button
                onClick={handleSaveOverride}
                disabled={savingOverride}
                className="px-4 py-2 bg-orange-600 text-white text-sm rounded-md hover:bg-orange-700 disabled:opacity-50 transition"
              >
                {savingOverride ? 'Saving...' : 'Save Override'}
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Transcript + Integrity */}
        <div className="space-y-6">
          {/* Transcript */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Transcript</h2>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {messages.length === 0 ? (
                <p className="text-gray-500 text-sm">No transcript available</p>
              ) : (
                messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`p-3 rounded-lg text-sm ${
                      msg.role === 'ai'
                        ? 'bg-blue-50 text-blue-900'
                        : 'bg-gray-100 text-gray-900'
                    }`}
                  >
                    <p className="text-xs font-medium mb-1 uppercase">
                      {msg.role === 'ai' ? '🤖 CodeCoach' : '👤 Student'}
                    </p>
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      {new Date(msg.created_at).toLocaleTimeString()}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Integrity Events */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Integrity Events</h2>
            {integrityEvents.length === 0 ? (
              <p className="text-gray-500 text-sm">No integrity events</p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {integrityEvents.map((evt) => (
                  <div
                    key={evt.id}
                    className="flex items-center gap-3 py-2 border-b border-gray-100 last:border-0"
                  >
                    <span className="text-xs text-gray-400 whitespace-nowrap">
                      {new Date(evt.created_at).toLocaleTimeString()}
                    </span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        evt.event_type === 'tab_switch' || evt.event_type === 'window_blur'
                          ? 'bg-yellow-100 text-yellow-700'
                          : evt.event_type === 'camera_ended' || evt.event_type === 'disconnect'
                          ? 'bg-red-100 text-red-700'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {evt.event_type}
                    </span>
                    {evt.detail && (
                      <span className="text-xs text-gray-500">
                        {JSON.stringify(evt.detail)}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
