'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useRecording } from '@/hooks/useRecording';
import { useIntegrity } from '@/hooks/useIntegrity';
import MarkdownMessage from '@/components/MarkdownMessage';
import { supabase } from '@/lib/supabase/client';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Video, Mic, AlertTriangle, Send, CheckCircle2, Clock,
  MessageSquare, UserCircle, ShieldAlert, Sparkles, Loader2, Maximize, StopCircle
} from 'lucide-react';

type Phase = 'consent' | 'interview' | 'uploading' | 'finalizing' | 'done';

interface ChatMessage {
  role: 'ai' | 'student';
  content: string;
}

interface SendAITurnOptions {
  skipStudentChat?: boolean;
  timerWrapUp?: boolean;
}

type SpeechRecognitionInstance = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type SpeechRecognitionEvent = {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: {
      isFinal: boolean;
      length: number;
      [innerIndex: number]: {
        transcript: string;
      };
    };
  };
};

export default function AttemptPage() {
  const params = useParams();
  const router = useRouter();
  const attemptId = params.attemptId as string;

  const [phase, setPhase] = useState<Phase>('consent');
  const [consent, setConsent] = useState(false);
  const [assignmentData, setAssignmentData] = useState<Record<string, unknown> | null>(null);
  const [chat, setChat] = useState<ChatMessage[]>([]);
  const [speechDraft, setSpeechDraft] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [timeLimitSeconds, setTimeLimitSeconds] = useState(480);
  const [shouldEnd, setShouldEnd] = useState(false);
  const [endCountdown, setEndCountdown] = useState<number | null>(null);
  const [wrapUpRequested, setWrapUpRequested] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isMultiMonitorDetected, setIsMultiMonitorDetected] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const recordingBlobRef = useRef<Blob | null>(null);
  const speechRecognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const finalTranscriptRef = useRef('');
  const hasLoggedExtendedDisplayRef = useRef(false);
  const hasLoggedFullscreenExitRef = useRef(false);
  const hasAnnouncedEndRef = useRef(false);
  const hasStartedAutoSubmitRef = useRef(false);

  const { isRecording, duration, stream, startRecording, stopRecording, requestPermissions, hasPermissions } =
    useRecording({ onError: (e) => setError(e) });

  const { logIntegrity } = useIntegrity({ attemptId, enabled: phase === 'interview' });

  function getStoredAttemptData(): Record<string, unknown> | null {
    const stored = localStorage.getItem(`attempt_${attemptId}`);
    if (!stored) return null;

    try {
      const parsed = JSON.parse(stored) as Record<string, unknown>;
      return parsed && typeof parsed === 'object' ? parsed : null;
    } catch {
      return null;
    }
  }

  // Load attempt data
  useEffect(() => {
    const parsed = getStoredAttemptData();
    if (parsed) setAssignmentData(parsed);
  }, [attemptId]);

  // Set video preview from stream
  useEffect(() => {
    if (stream && videoRef.current) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chat]);

  // Speech recognition support check
  useEffect(() => {
    const SpeechRecognitionCtor = (window as unknown as {
      SpeechRecognition?: new () => SpeechRecognitionInstance;
      webkitSpeechRecognition?: new () => SpeechRecognitionInstance;
    }).SpeechRecognition
      || (window as unknown as {
        webkitSpeechRecognition?: new () => SpeechRecognitionInstance;
      }).webkitSpeechRecognition;

    setSpeechSupported(Boolean(SpeechRecognitionCtor));
  }, []);

  // Time limit enforcement
  useEffect(() => {
    if (!isRecording) return;
    if (duration >= timeLimitSeconds) {
      void handleSubmit();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [duration, timeLimitSeconds, isRecording]);

  // Monitor media track events
  useEffect(() => {
    if (!stream) return;

    const videoTrack = stream.getVideoTracks()[0];
    const audioTrack = stream.getAudioTracks()[0];

    if (videoTrack) {
      videoTrack.onended = () => {
        logIntegrity('camera_ended');
      };
      videoTrack.onmute = () => {
        logIntegrity('camera_muted');
      };
    }

    if (audioTrack) {
      audioTrack.onended = () => {
        logIntegrity('mic_ended');
      };
      audioTrack.onmute = () => {
        logIntegrity('mic_muted');
      };
      audioTrack.onunmute = () => {
        logIntegrity('mic_unmuted');
      };
    }
  }, [stream, logIntegrity]);

  // Fullscreen integrity
  useEffect(() => {
    const handleFullscreenChange = () => {
      const active = Boolean(document.fullscreenElement);
      setIsFullscreen(active);

      if (phase === 'interview' && !active) {
        if (!hasLoggedFullscreenExitRef.current) {
          hasLoggedFullscreenExitRef.current = true;
          logIntegrity('fullscreen_exit');
        }
        setError('Fullscreen is required during assessment. Please re-enter fullscreen.');
      }

      if (active) {
        setError((prev) =>
          prev === 'Fullscreen is required during assessment. Please re-enter fullscreen.'
            ? ''
            : prev
        );
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    handleFullscreenChange();

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, [phase, logIntegrity]);

  // Best-effort multi-monitor detection
  useEffect(() => {
    if (phase !== 'interview') return;

    let intervalId: ReturnType<typeof setInterval> | null = null;

    const checkMultiMonitor = async () => {
      try {
        let detected = false;

        const screenWithExtended = window.screen as Screen & { isExtended?: boolean };
        if (screenWithExtended.isExtended) {
          detected = true;
          setIsMultiMonitorDetected(true);
          if (!hasLoggedExtendedDisplayRef.current) {
            hasLoggedExtendedDisplayRef.current = true;
            logIntegrity('multiple_monitor_detected', { method: 'screen.isExtended' });
          }
        }

        const windowWithDetails = window as Window & {
          getScreenDetails?: () => Promise<{ screens?: { isPrimary?: boolean }[] }>;
        };

        if (typeof windowWithDetails.getScreenDetails === 'function') {
          const details = await windowWithDetails.getScreenDetails();
          const screenCount = details.screens?.length || 0;
          if (screenCount > 1) {
            detected = true;
            setIsMultiMonitorDetected(true);
            if (!hasLoggedExtendedDisplayRef.current) {
              hasLoggedExtendedDisplayRef.current = true;
              logIntegrity('multiple_monitor_detected', {
                method: 'getScreenDetails',
                screenCount,
              });
            }
          }
        }

        if (!detected) {
          setIsMultiMonitorDetected(false);
        }
      } catch {
        // Not supported/allowed; no-op.
      }
    };

    checkMultiMonitor();
    intervalId = setInterval(checkMultiMonitor, 10000);

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [phase, logIntegrity]);

  // Fetch assignment settings for time limit
  useEffect(() => {
    async function loadAssignment() {
      try {
        const parsed = getStoredAttemptData();
        const assignmentId = typeof parsed?.assignmentId === 'string' ? parsed.assignmentId : '';
        if (!assignmentId) return;

        const { createClient } = await import('@supabase/supabase-js');
        const supabase = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        );

        const { data } = await supabase
          .from('assignments')
          .select('time_limit_seconds, title, topic, question_bank')
          .eq('id', assignmentId)
          .eq('published', true)
          .single();

        if (data) {
          setTimeLimitSeconds(data.time_limit_seconds || 480);
          setAssignmentData((prev) => ({ ...prev, ...data }));
        }
      } catch {
        // Use defaults
      }
    }

    loadAssignment();
  }, [attemptId]);

  async function updateStatus(status: string, extras?: Record<string, unknown>) {
    await fetch('/api/student/updateStatus', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ attemptId, status, ...extras }),
    });
  }

  async function requestFullscreenMode() {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      }
      setIsFullscreen(Boolean(document.fullscreenElement));
      return true;
    } catch {
      setError('Unable to enter fullscreen. Please allow fullscreen and try again.');
      logIntegrity('fullscreen_request_failed');
      return false;
    }
  }

  async function handleStartRecording() {
    if (!hasPermissions || !consent) return;

    const fullscreenOk = await requestFullscreenMode();
    if (!fullscreenOk) return;

    await updateStatus('ready_to_start');
    await startRecording();
    await updateStatus('recording');
    setPhase('interview');

    void sendAITurn('Hello, I am ready to begin the assessment.');
  }

  async function sendAITurn(message: string, options: SendAITurnOptions = {}) {
    setSending(true);
    setError('');

    try {
      if (!options.skipStudentChat && message !== 'Hello, I am ready to begin the assessment.') {
        setChat((prev) => [...prev, { role: 'student', content: message }]);
      }

      const res = await fetch('/api/ai/turn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          attemptId,
          studentMessage: message,
          timerWrapUp: options.timerWrapUp || false,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setChat((prev) => [...prev, { role: 'ai', content: data.ai_message }]);

      if (data.should_end) {
        const shouldAutoSubmit = remaining > 30;

        if (!hasAnnouncedEndRef.current) {
          hasAnnouncedEndRef.current = true;
          setChat((prev) => [
            ...prev,
            {
              role: 'ai',
              content: shouldAutoSubmit
                ? 'I am wrapping up this assessment now. Your submission will be auto-submitted in 10 seconds.'
                : 'I am wrapping up this assessment now. Please click **Submit Assessment** before time runs out.',
            },
          ]);
        }

        setShouldEnd(true);
        if (shouldAutoSubmit) {
          hasStartedAutoSubmitRef.current = false;
          setEndCountdown(10);
        } else {
          setEndCountdown(null);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to communicate with AI');
    }
    setSending(false);
  }

  function handleSendMessage() {
    if (!speechDraft.trim() || sending || isListening) return;
    const msg = speechDraft.trim();
    setSpeechDraft('');
    finalTranscriptRef.current = '';
    void sendAITurn(msg);
  }

  function startListening() {
    if (!speechSupported || sending || !isRecording || isListening) return;

    const SpeechRecognitionCtor = (window as unknown as {
      SpeechRecognition?: new () => SpeechRecognitionInstance;
      webkitSpeechRecognition?: new () => SpeechRecognitionInstance;
    }).SpeechRecognition
      || (window as unknown as {
        webkitSpeechRecognition?: new () => SpeechRecognitionInstance;
      }).webkitSpeechRecognition;

    if (!SpeechRecognitionCtor) {
      setError('Speech recognition is not supported in this browser.');
      return;
    }

    setError('');
    finalTranscriptRef.current = speechDraft.trim();

    const recognition = new SpeechRecognitionCtor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event) => {
      let finalChunk = finalTranscriptRef.current;
      let interimChunk = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const phrase = event.results[i][0].transcript.trim();
        if (!phrase) continue;

        if (event.results[i].isFinal) {
          finalChunk = finalChunk ? `${finalChunk} ${phrase}` : phrase;
        } else {
          interimChunk = interimChunk ? `${interimChunk} ${phrase}` : phrase;
        }
      }

      finalTranscriptRef.current = finalChunk.trim();
      const combined = [finalTranscriptRef.current, interimChunk.trim()]
        .filter(Boolean)
        .join(' ')
        .trim();

      setSpeechDraft(combined);
    };

    recognition.onerror = (event) => {
      setError(`Speech recognition error: ${event.error}`);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    speechRecognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  }

  function stopListening() {
    speechRecognitionRef.current?.stop();
    setIsListening(false);
  }

  useEffect(() => {
    return () => {
      speechRecognitionRef.current?.stop();
    };
  }, []);

  const handleSubmit = useCallback(async () => {
    if (phase === 'uploading' || phase === 'finalizing' || phase === 'done') return;

    setPhase('uploading');
    setError('');
    let progressInterval: ReturnType<typeof setInterval> | null = null;

    try {
      const blob = await stopRecording();
      if (!blob) {
        setError('No recording data available');
        setPhase('interview');
        return;
      }

      recordingBlobRef.current = blob;
      await updateStatus('uploading_recording');

      const parsed = getStoredAttemptData();
      const assignmentId = typeof parsed?.assignmentId === 'string' ? parsed.assignmentId : '';

      if (!assignmentId) {
        throw new Error('Missing assignmentId for upload');
      }

      const recordingExt = 'webm';
      const storagePath = `${assignmentId}/${attemptId}.${recordingExt}`;

      progressInterval = setInterval(() => {
        setUploadProgress((prev) => Math.min(prev + 10, 90));
      }, 500);

      const { error: storageError } = await supabase.storage
        .from('recordings')
        .upload(storagePath, blob, {
          contentType: blob.type || 'video/webm',
          upsert: true,
        });

      if (storageError) {
        throw new Error(storageError.message);
      }

      setUploadProgress(95);

      const res = await fetch('/api/student/uploadRecording', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          attemptId,
          assignmentId,
          storagePath,
          recordingDurationSeconds: duration,
          recordingSizeBytes: blob.size,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setUploadProgress(100);
      setPhase('finalizing');

      const finalRes = await fetch('/api/ai/finalize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ attemptId }),
      });

      const finalData = await finalRes.json();
      if (!finalRes.ok) throw new Error(finalData.error);

      setPhase('done');
      router.push(`/attempt/${attemptId}/done`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
      setPhase('interview');
      await updateStatus('recording_failed').catch(() => { });
    } finally {
      if (progressInterval) {
        clearInterval(progressInterval);
      }
    }
  }, [attemptId, phase, stopRecording, router, duration]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const remaining = Math.max(0, timeLimitSeconds - duration);
  const hasStudentResponse = chat.some((m) => m.role === 'student');

  useEffect(() => {
    if (
      phase !== 'interview'
      || !isRecording
      || sending
      || shouldEnd
      || wrapUpRequested
      || remaining > 30
      || remaining <= 0
    ) {
      return;
    }

    setWrapUpRequested(true);
    void sendAITurn(
      'System note: 30 seconds remain. Please wrap up the interview with concise final prompts.',
      { skipStudentChat: true, timerWrapUp: true }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, isRecording, sending, shouldEnd, wrapUpRequested, remaining]);

  useEffect(() => {
    if (phase !== 'interview' || endCountdown === null) return;

    if (endCountdown <= 0) {
      if (!hasStartedAutoSubmitRef.current) {
        hasStartedAutoSubmitRef.current = true;
        void handleSubmit();
      }
      return;
    }

    const timeout = setTimeout(() => {
      setEndCountdown((prev) => (prev === null ? null : prev - 1));
    }, 1000);

    return () => clearTimeout(timeout);
  }, [endCountdown, phase, handleSubmit]);

  // ======== CONSENT GATE ========
  if (phase === 'consent') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 overflow-hidden relative">
        <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-sky-900/30 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute w-full h-full bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />

        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-slate-800/80 backdrop-blur-xl p-8 rounded-3xl shadow-2xl border border-slate-700 max-w-2xl w-full z-10 w-11/12">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold text-white mb-2">
              {(assignmentData as Record<string, unknown>)?.title as string || 'Assessment Final Setup'}
            </h1>
            <p className="text-slate-400 text-sm font-medium">Please review and grant necessary permissions.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div className="relative bg-black rounded-2xl overflow-hidden aspect-video border border-slate-700 shadow-inner">
              <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                className="w-full h-full object-cover"
              />
              {!hasPermissions && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/90 text-slate-400 gap-3">
                  <Video className="w-8 h-8 opacity-50" />
                  <p className="text-xs font-semibold px-4 text-center">Camera preview will appear here</p>
                </div>
              )}
            </div>

            <div className="flex flex-col justify-center space-y-4">
              {!hasPermissions ? (
                <div className="bg-sky-900/30 border border-sky-500/30 p-4 rounded-xl text-center">
                  <div className="flex justify-center gap-2 mb-3 text-sky-400">
                    <Video className="w-5 h-5" />
                    <Mic className="w-5 h-5" />
                  </div>
                  <p className="text-sm text-sky-100 mb-4 font-medium">We need access to your camera and microphone for this oral assessment.</p>
                  <button
                    onClick={requestPermissions}
                    className="w-full py-2.5 bg-sky-600 hover:bg-sky-500 text-white rounded-lg transition font-semibold text-sm shadow-lg shadow-sky-600/20"
                  >
                    Grant Access
                  </button>
                </div>
              ) : (
                <div className="bg-emerald-900/30 border border-emerald-500/30 p-4 rounded-xl text-center text-emerald-400 flex flex-col items-center justify-center h-full gap-2">
                  <CheckCircle2 className="w-8 h-8" />
                  <p className="text-sm font-medium text-emerald-100">Permissions granted</p>
                </div>
              )}
            </div>
          </div>

          <label className="flex items-start gap-4 p-4 bg-slate-900/50 rounded-xl border border-slate-700/50 cursor-pointer mb-6 group hover:bg-slate-900/80 transition-colors">
            <div className="mt-1 flex-shrink-0">
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                className="w-5 h-5 accent-sky-500 rounded cursor-pointer"
              />
            </div>
            <div className="text-sm text-slate-300 leading-relaxed">
              I consent to having my screen, camera, and microphone recorded during this assessment. I understand that the recording will be sent to my instructor for grading purposes. <strong className="text-white font-semibold">I will speak my thought process clearly.</strong>
            </div>
          </label>

          {error && <p className="text-red-400 text-sm mb-4 text-center font-medium bg-red-900/20 py-2 rounded-lg">{error}</p>}

          <button
            onClick={handleStartRecording}
            disabled={!hasPermissions || !consent}
            className="w-full py-3.5 bg-sky-600 text-white rounded-xl hover:bg-sky-500 disabled:opacity-50 disabled:bg-slate-700 transition font-bold text-lg shadow-lg shadow-sky-600/20 disabled:shadow-none flex items-center justify-center gap-2"
          >
            Enter Assessment Mode
          </button>
        </motion.div>
      </div>
    );
  }

  // ======== UPLOADING / FINALIZING ========
  if (phase === 'uploading' || phase === 'finalizing') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-slate-800 p-10 rounded-3xl shadow-2xl border border-slate-700 max-w-sm w-full text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-slate-700 mb-6 drop-shadow-xl border border-slate-600">
            {phase === 'uploading' ? (
              <Loader2 className="w-8 h-8 text-sky-400 animate-spin" />
            ) : (
              <Sparkles className="w-8 h-8 text-purple-400 animate-pulse" />
            )}
          </div>

          <h2 className="text-xl font-bold text-white mb-2">
            {phase === 'uploading' ? 'Uploading Recording...' : 'AI is Grading...'}
          </h2>

          {phase === 'uploading' && (
            <div className="w-full bg-slate-700 rounded-full h-2.5 mt-6 mb-3 overflow-hidden">
              <div
                className="bg-sky-500 h-2.5 rounded-full transition-all duration-300 ease-out"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          )}

          <p className="text-sm text-slate-400 mb-2">
            {phase === 'uploading' ? `${uploadProgress}% complete` : 'Analyzing your transcript and rubric...'}
          </p>
          <p className="text-xs text-amber-400/80 font-medium">
            Please do not close this window.
          </p>
        </motion.div>
      </div>
    );
  }

  // ======== INTERVIEW ========
  return (
    <div className="h-screen flex flex-col bg-slate-50 font-sans overflow-hidden">
      {/* Top Header */}
      <header className="bg-slate-900 border-b border-slate-800 px-6 py-3 flex items-center justify-between shadow-md z-20 shrink-0">
        <div className="flex items-center gap-6">
          <div className="flex flex-col">
            <span className="text-white font-bold tracking-tight">Oral Assessment</span>
            <span className="text-slate-400 text-xs font-medium">{(assignmentData as Record<string, unknown>)?.title as string}</span>
          </div>

          <div className="h-6 w-px bg-slate-700 mx-2" />

          {/* Recording Indicator */}
          <div className="flex items-center gap-2 bg-red-500/10 px-3 py-1.5 rounded-full border border-red-500/20">
            <div className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
            <span className="text-xs font-bold text-red-500 tracking-wider">REC</span>
            <span className="text-xs font-mono text-red-400 ml-1">{formatTime(duration)}</span>
          </div>

          <div className="flex gap-2">
            {!isFullscreen && (
              <span className="flex items-center gap-1.5 text-xs font-semibold text-amber-500 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-md">
                <Maximize className="w-3.5 h-3.5" /> Fullscreen Required
              </span>
            )}
            {isMultiMonitorDetected && (
              <span className="flex items-center gap-1.5 text-xs font-semibold text-red-400 bg-red-500/10 border border-red-500/20 px-2.5 py-1 rounded-md">
                <ShieldAlert className="w-3.5 h-3.5" /> Multi-Monitor
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Timer */}
          <div className={`flex items-center gap-2 px-4 py-1.5 rounded-lg border ${remaining < 60 ? 'bg-red-500/10 border-red-500/30' : 'bg-slate-800 border-slate-700'
            }`}>
            <Clock className={`w-4 h-4 ${remaining < 60 ? 'text-red-400 animate-pulse' : 'text-slate-400'}`} />
            <span className={`text-sm font-mono font-bold tracking-wider ${remaining < 60 ? 'text-red-400' : 'text-white'}`}>
              {formatTime(remaining)}
            </span>
          </div>

          <button
            onClick={handleSubmit}
            disabled={sending || (!hasStudentResponse && !shouldEnd)}
            className="px-5 py-2 bg-red-600 text-white text-sm font-bold rounded-lg hover:bg-red-500 disabled:opacity-50 disabled:hover:bg-red-600 transition-colors shadow-lg shadow-red-600/20 flex items-center gap-2"
          >
            Submit Assessment
          </button>
        </div>
      </header>

      {/* Main Workspace Layout */}
      <div className="flex-1 flex overflow-hidden">

        {/* Left Sidebar: Video & Instructions */}
        <div className="w-64 lg:w-80 bg-slate-900 border-r border-slate-800 flex flex-col shrink-0">

          <div className="p-4 flex-1">
            <div className="relative bg-black rounded-xl overflow-hidden aspect-[4/3] border border-slate-700 shadow-inner mb-4">
              <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                className="w-full h-full object-cover transform scale-x-[-1]"
              />
              <div className="absolute top-2 left-2 flex gap-1">
                <div className="bg-black/60 backdrop-blur-md px-2 py-1 rounded text-[10px] font-bold text-white uppercase tracking-wider flex items-center gap-1.5 border border-white/10">
                  <Video className="w-3 h-3 text-sky-400" /> You
                </div>
              </div>
            </div>

            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
              <h3 className="font-semibold text-white text-sm flex items-center gap-2 mb-2">
                <ShieldAlert className="w-4 h-4 text-sky-400" /> Proctored Session
              </h3>
              <ul className="text-xs text-slate-400 space-y-2 leading-relaxed">
                <li>• Speak constantly to explain your thoughts.</li>
                <li>• Do not switch tabs.</li>
                <li>• Stay in fullscreen mode.</li>
                <li>• CodeCoach AI is directing the interview.</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Right Main Area: Chat & Input */}
        <div className="flex-1 flex flex-col min-w-0 bg-white relative">

          {/* Chat Transcript */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-10 space-y-6">
            <AnimatePresence>
              {chat.map((msg, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex ${msg.role === 'student' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`flex gap-3 max-w-[85%] lg:max-w-[75%] ${msg.role === 'student' ? 'flex-row-reverse' : 'flex-row'}`}>

                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 border ${msg.role === 'ai' ? 'bg-sky-100 text-sky-600 border-sky-200' : 'bg-slate-100 text-slate-600 border-slate-200'
                      }`}>
                      {msg.role === 'ai' ? <Sparkles className="w-4 h-4" /> : <UserCircle className="w-5 h-5 text-slate-400" />}
                    </div>

                    <div className={`p-4 rounded-2xl shadow-sm border ${msg.role === 'ai'
                        ? 'bg-white border-slate-200 rounded-tl-none'
                        : 'bg-sky-600 text-white border-sky-500 rounded-tr-none'
                      }`}
                    >
                      <div className={`text-[10px] font-bold uppercase tracking-wider mb-2 ${msg.role === 'ai' ? 'text-sky-600' : 'text-sky-200'}`}>
                        {msg.role === 'ai' ? 'CodeCoach AI' : 'You'}
                      </div>

                      <div className={`prose prose-sm max-w-none ${msg.role === 'student' ? 'prose-invert text-white' : 'text-slate-800'}`}>
                        {msg.role === 'ai' ? (
                          <MarkdownMessage content={msg.content} />
                        ) : (
                          <p className="whitespace-pre-wrap leading-relaxed m-0">{msg.content}</p>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
              {sending && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
                  <div className="flex gap-3">
                    <div className="w-8 h-8 rounded-full bg-sky-100 border border-sky-200 flex items-center justify-center shrink-0">
                      <Sparkles className="w-4 h-4 text-sky-600" />
                    </div>
                    <div className="bg-white border border-slate-200 p-4 rounded-2xl rounded-tl-none shadow-sm flex items-center gap-2">
                      <div className="w-2 h-2 bg-sky-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                      <div className="w-2 h-2 bg-sky-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                      <div className="w-2 h-2 bg-sky-400 rounded-full animate-bounce"></div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            <div ref={chatEndRef} className="h-4" />
          </div>

          {/* Bottom Input Area */}
          <div className="bg-slate-50 border-t border-slate-200 p-4 sm:p-6 shrink-0 z-10 shadow-[0_-4px_20px_rgba(0,0,0,0.02)]">

            <div className="max-w-4xl mx-auto space-y-3">

              <AnimatePresence>
                {shouldEnd && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800 font-medium flex items-center gap-2 shadow-sm">
                    <AlertTriangle className="w-4 h-4 shrink-0 text-amber-500" />
                    {endCountdown !== null
                      ? `The interviewer is wrapping up. Auto-submit in ${endCountdown}s.`
                      : 'The interviewer is wrapping up. Please click Submit Assessment before time runs out.'}
                  </motion.div>
                )}
                {!isFullscreen && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="p-3 bg-orange-50 border border-orange-200 rounded-xl text-sm font-medium text-orange-800 flex items-center justify-between gap-3 shadow-sm">
                    <div className="flex items-center gap-2">
                      <Maximize className="w-4 h-4 shrink-0 text-orange-500" />
                      <span>You exited fullscreen. Re-enter fullscreen to continue securely.</span>
                    </div>
                    <button
                      onClick={requestFullscreenMode}
                      className="px-3 py-1.5 bg-orange-600 text-white rounded-lg text-xs hover:bg-orange-700 transition font-bold whitespace-nowrap shadow-sm shadow-orange-600/20"
                    >
                      Enter Fullscreen
                    </button>
                  </motion.div>
                )}
                {error && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm font-medium text-red-700 flex items-center gap-2 shadow-sm">
                    <AlertTriangle className="w-4 h-4 shrink-0 text-red-500" />
                    {error}
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="flex gap-3">
                <div className="flex-1 relative">
                  <textarea
                    value={speechDraft}
                    readOnly
                    placeholder={isListening ? "Listening to your voice..." : "Click 'Start Speaking' to dictate your answer..."}
                    rows={3}
                    disabled
                    className={`w-full px-4 py-3 rounded-xl text-sm resize-none transition-all outline-none border ${isListening
                        ? 'bg-sky-50 border-sky-300 ring-2 ring-sky-500/20 text-slate-800'
                        : 'bg-white border-slate-300 text-slate-600 shadow-inner'
                      }`}
                  />
                  {isListening && (
                    <div className="absolute right-3 bottom-4 flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-ping" />
                      <span className="text-[10px] font-bold text-red-500 uppercase tracking-wider">Listening</span>
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-2 shrink-0 w-[140px]">
                  {!isListening ? (
                    <button
                      onClick={startListening}
                      disabled={!isRecording || sending || !speechSupported || !isFullscreen || shouldEnd}
                      className="flex-1 flex justify-center items-center gap-2 px-4 bg-slate-800 text-white rounded-xl hover:bg-slate-700 disabled:opacity-50 disabled:hover:bg-slate-800 transition-all font-semibold shadow-sm text-sm"
                    >
                      <Mic className="w-4 h-4" />
                      Speak
                    </button>
                  ) : (
                    <button
                      onClick={stopListening}
                      className="flex-1 flex justify-center items-center gap-2 px-4 bg-amber-100 text-amber-800 border border-amber-300 rounded-xl hover:bg-amber-200 transition-all font-semibold shadow-sm text-sm"
                    >
                      <StopCircle className="w-4 h-4" />
                      Stop
                    </button>
                  )}

                  <button
                    onClick={handleSendMessage}
                    disabled={!isRecording || sending || isListening || !speechDraft.trim() || !isFullscreen || shouldEnd}
                    className="flex-1 flex justify-center items-center gap-2 px-4 bg-sky-600 text-white rounded-xl hover:bg-sky-500 disabled:opacity-50 disabled:hover:bg-sky-600 transition-all font-semibold shadow-sm shadow-sky-600/20 text-sm"
                  >
                    <Send className="w-4 h-4" />
                    Send
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
