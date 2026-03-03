'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useRouter, useParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowLeft, Clock, Video, Award, AlertTriangle, MessageSquare, Save, UserCircle, Sparkles, Check } from 'lucide-react';
import type { Attempt, TranscriptMessage, IntegrityEvent, RubricBreakdownItem } from '@/lib/types';
import MarkdownMessage from '@/components/MarkdownMessage';

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
    if (!recordingUrl.includes('/recordings/')) return recordingUrl;

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
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-4 border-sky-600/30 border-t-sky-600 rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (!attempt) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="bg-red-50 text-red-600 px-6 py-4 rounded-xl border border-red-100 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5" />
          <p className="font-medium">Attempt not found</p>
        </div>
      </div>
    );
  }

  const rubricBreakdown = (attempt.rubric_breakdown || []) as RubricBreakdownItem[];

  return (
    <div className="min-h-screen bg-slate-50 pb-12">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-800 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Submissions</span>
          </button>
          <div className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide border ${attempt.status === 'submitted'
            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
            : 'bg-slate-100 text-slate-600 border-slate-200'
            }`}>
            {attempt.status.replace(/_/g, ' ')}
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        <div className="mb-8 flex items-end justify-between">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-slate-200 text-slate-600 rounded-2xl flex items-center justify-center text-2xl font-bold shadow-sm">
              {attempt.student_name ? attempt.student_name.charAt(0).toUpperCase() : '?'}
            </div>
            <div>
              <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
                {attempt.student_name}
              </h1>
              <div className="flex items-center gap-3 mt-1.5 text-sm text-slate-500 font-medium">
                {attempt.submitted_at && (
                  <span className="flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-slate-400" />
                    Submitted {new Date(attempt.submitted_at).toLocaleDateString()} at {new Date(attempt.submitted_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

          {/* Left Column: Grade & Video */}
          <div className="lg:col-span-5 space-y-6">

            {/* Grade Card */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center gap-2">
                <Award className="w-5 h-5 text-sky-600" />
                <h2 className="font-bold text-slate-800 text-lg">Evaluation Result</h2>
              </div>

              <div className="p-6">
                {attempt.final_score !== null ? (
                  <>
                    <div className="flex flex-col items-center justify-center mb-6">
                      <div className="relative flex items-center justify-center">
                        <svg className="w-32 h-32 transform -rotate-90">
                          <circle cx="64" cy="64" r="56" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-slate-100" />
                          <circle cx="64" cy="64" r="56" stroke="currentColor" strokeWidth="8" fill="transparent"
                            strokeDasharray={351.858}
                            strokeDashoffset={351.858 - (351.858 * (attempt.teacher_override_score !== null ? attempt.teacher_override_score : attempt.final_score)) / 100}
                            strokeLinecap="round"
                            className={attempt.teacher_override_score !== null ? 'text-sky-500 transition-all duration-1000' : attempt.final_score >= 80 ? 'text-emerald-500 transition-all duration-1000' : attempt.final_score >= 60 ? 'text-amber-500 transition-all duration-1000' : 'text-red-500 transition-all duration-1000'}
                          />
                        </svg>
                        <div className="absolute flex flex-col items-center">
                          <span className="text-4xl font-extrabold text-slate-800">
                            {attempt.teacher_override_score !== null ? attempt.teacher_override_score : attempt.final_score}
                          </span>
                          <span className="text-sm font-medium text-slate-400">/ 100</span>
                        </div>
                      </div>
                      {attempt.teacher_override_score !== null && (
                        <span className="mt-3 px-3 py-1 bg-sky-50 text-sky-700 text-xs font-semibold rounded-full border border-sky-100">
                          Teacher Override (AI: {attempt.final_score})
                        </span>
                      )}
                    </div>

                    {rubricBreakdown.length > 0 && (
                      <div className="space-y-4 pt-4 border-t border-slate-100">
                        {rubricBreakdown.map((item, i) => (
                          <div key={i} className="bg-slate-50 border border-slate-100 rounded-xl p-4">
                            <div className="flex justify-between items-center mb-2">
                              <span className="font-semibold text-slate-700 text-sm">{item.category}</span>
                              <span className="text-sm font-bold text-slate-800">
                                {item.score}<span className="text-slate-400 font-normal">/{item.weight} pts</span>
                              </span>
                            </div>
                            <div className="w-full bg-slate-200 rounded-full h-1.5 mb-3">
                              <div
                                className="bg-sky-500 h-1.5 rounded-full"
                                style={{ width: `${(item.score / item.weight) * 100}%` }}
                              />
                            </div>
                            <p className="text-sm text-slate-600 leading-relaxed mb-3">{item.rationale}</p>
                            {item.evidence_quotes?.length > 0 && (
                              <div className="space-y-1.5 mt-2 p-3 bg-white rounded-lg border border-slate-100 text-xs">
                                <p className="font-semibold text-slate-500 mb-1">Evidence Quotes:</p>
                                {item.evidence_quotes.map((q, j) => (
                                  <p key={j} className="text-slate-600 italic border-l-2 border-sky-200 pl-2 py-0.5">&ldquo;{q}&rdquo;</p>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-center py-8">
                    <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
                      <Award className="w-6 h-6 text-slate-300" />
                    </div>
                    <p className="text-slate-500 font-medium">Not graded yet</p>
                  </div>
                )}
              </div>
            </motion.div>

            {/* Teacher Override */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
                <h2 className="font-bold text-slate-800">Teacher Override</h2>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Override Score (0-100)</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={overrideScore}
                    onChange={(e) => setOverrideScore(e.target.value)}
                    placeholder="Leave blank to use AI score"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all outline-none text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Override Note</label>
                  <textarea
                    value={overrideNote}
                    onChange={(e) => setOverrideNote(e.target.value)}
                    rows={2}
                    placeholder="Reason for manual override..."
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all outline-none text-slate-800 resize-y"
                  />
                </div>
                <button
                  onClick={handleSaveOverride}
                  disabled={savingOverride}
                  className="w-full inline-flex justify-center items-center gap-2 px-6 py-2.5 bg-sky-600 text-white rounded-xl font-medium hover:bg-sky-700 disabled:opacity-50 transition-all shadow-sm shadow-sky-600/20"
                >
                  {savingOverride ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  Save Override
                </button>
              </div>
            </motion.div>
          </div>

          {/* Right Column: Transcript, Video, Integrity */}
          <div className="lg:col-span-7 space-y-6">

            {/* Video Player */}
            {attempt.recording_url && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <Video className="w-5 h-5 text-sky-600" />
                    <h2 className="font-bold text-slate-800 text-lg">Recording</h2>
                  </div>
                  <div className="flex items-center gap-3 text-xs font-semibold text-slate-500 bg-white px-2 py-1 rounded-md border border-slate-200 shadow-sm">
                    <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 text-slate-400" /> {attempt.recording_duration_seconds ? `${Math.round(attempt.recording_duration_seconds)}s` : 'N/A'}</span>
                  </div>
                </div>
                <div className="p-4 bg-slate-900 flex justify-center mt-0 rounded-b-xl border-x border-b border-slate-200 shadow-inner">
                  <video
                    src={playbackUrl || attempt.recording_url}
                    controls
                    className="w-full max-h-[400px] object-contain rounded-lg shadow-lg"
                  />
                </div>
              </motion.div>
            )}

            {/* Transcript */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col max-h-[600px]">
              <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center gap-2 shrink-0">
                <MessageSquare className="w-5 h-5 text-sky-600" />
                <h2 className="font-bold text-slate-800 text-lg">Interview Transcript</h2>
              </div>
              <div className="p-6 overflow-y-auto flex-1 space-y-6 bg-slate-50/30">
                {messages.length === 0 ? (
                  <div className="text-center py-10">
                    <MessageSquare className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                    <p className="text-slate-500 font-medium">No transcript available</p>
                  </div>
                ) : (
                  messages.map((msg) => (
                    <div key={msg.id} className={`flex ${msg.role === 'ai' ? 'justify-start' : 'justify-end'}`}>
                      <div className={`max-w-[85%] flex gap-3 ${msg.role === 'ai' ? 'flex-row' : 'flex-row-reverse'}`}>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 border ${msg.role === 'ai' ? 'bg-sky-100 text-sky-600 border-sky-200' : 'bg-white text-slate-600 border-slate-200 shadow-sm'
                          }`}>
                          {msg.role === 'ai' ? <Sparkles className="w-4 h-4" /> : <UserCircle className="w-5 h-5" />}
                        </div>

                        <div className={`p-4 rounded-2xl shadow-sm border ${msg.role === 'ai'
                          ? 'bg-white border-slate-200 rounded-tl-none'
                          : 'bg-sky-600 text-white border-sky-500 rounded-tr-none'
                          }`}>
                          <div className={`text-xs font-bold mb-1.5 uppercase tracking-wider ${msg.role === 'ai' ? 'text-sky-600' : 'text-sky-100'
                            }`}>
                            {msg.role === 'ai' ? 'AI Interviewer' : 'Student'}
                          </div>
                          <div className={`prose prose-sm max-w-none ${msg.role === 'student' ? 'prose-invert text-white' : 'text-slate-700'}`}>
                            {msg.role === 'ai' ? (
                              <MarkdownMessage content={msg.content} />
                            ) : (
                              <p className="whitespace-pre-wrap">{msg.content}</p>
                            )}
                          </div>
                          <div className={`text-[10px] font-medium mt-2 flex justify-end ${msg.role === 'ai' ? 'text-slate-400' : 'text-sky-200'
                            }`}>
                            {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </motion.div>

            {/* Integrity Events */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                <h2 className="font-bold text-slate-800 text-lg">Integrity Log</h2>
              </div>
              <div className="p-0">
                {integrityEvents.length === 0 ? (
                  <div className="p-6 text-center">
                    <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-emerald-50 mb-2">
                      <Check className="w-5 h-5 text-emerald-500" />
                    </div>
                    <p className="text-slate-600 font-medium text-sm">No integrity events recorded.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 max-h-64 overflow-y-auto">
                    {integrityEvents.map((evt) => (
                      <div key={evt.id} className="p-4 flex items-start gap-4 hover:bg-slate-50 transition-colors">
                        <span className="text-xs font-semibold text-slate-400 mt-0.5 whitespace-nowrap w-16">
                          {new Date(evt.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <div>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wide mb-1 ${evt.event_type === 'tab_switch' || evt.event_type === 'window_blur'
                            ? 'bg-amber-100 text-amber-700'
                            : evt.event_type === 'camera_ended' || evt.event_type === 'disconnect'
                              ? 'bg-red-100 text-red-700'
                              : 'bg-slate-100 text-slate-600'
                            }`}>
                            {evt.event_type.replace('_', ' ')}
                          </span>
                          {evt.detail && (
                            <p className="text-sm text-slate-600 bg-white border border-slate-200 rounded p-2 mt-1 shadow-sm break-all">
                              {JSON.stringify(evt.detail)}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        </div>
      </main>
    </div>
  );
}
