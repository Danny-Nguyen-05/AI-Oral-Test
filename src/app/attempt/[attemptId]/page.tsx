'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useRecording } from '@/hooks/useRecording';
import { useIntegrity } from '@/hooks/useIntegrity';
import MarkdownMessage from '@/components/MarkdownMessage';
import { supabase } from '@/lib/supabase/client';

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

  // Load attempt data
  useEffect(() => {
    const stored = localStorage.getItem(`attempt_${attemptId}`);
    if (stored) {
      const parsed = JSON.parse(stored);
      setAssignmentData(parsed);
    }
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
      handleSubmit();
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
    async function fetchSettings() {
      try {
        const stored = localStorage.getItem(`attempt_${attemptId}`);
        if (!stored) return;
        const { assignmentId } = JSON.parse(stored);

        const res = await fetch('/api/student/createAttempt', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ assignmentId, studentName: '__probe__' }),
        });

        // We don't actually want to create another attempt, just get settings
        // Instead, use the stored data or a separate endpoint
        // For MVP, we'll use default
        void res;
      } catch {
        // Use default time limit
      }
    }

    // Instead, load from the createAttempt response stored in localStorage
    const stored = localStorage.getItem(`attempt_${attemptId}`);
    if (!stored) return;

    // We need to fetch assignment data properly
    async function loadAssignment() {
      try {
        const storedData = localStorage.getItem(`attempt_${attemptId}`);
        if (!storedData) return;
        const { assignmentId } = JSON.parse(storedData);

        // Fetch from public_assignments view using supabase client
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
    void fetchSettings;
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

    // Update status to ready_to_start, then recording
    await updateStatus('ready_to_start');
    await startRecording();
    await updateStatus('recording');
    setPhase('interview');

    // Send initial AI turn to get the first question
    await sendAITurn('Hello, I am ready to begin the assessment.');
  }

  async function sendAITurn(message: string, options: SendAITurnOptions = {}) {
    setSending(true);
    setError('');

    try {
      // Add student message to chat
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
    sendAITurn(msg);
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

    try {
      // Stop recording
      const blob = await stopRecording();
      if (!blob) {
        setError('No recording data available');
        setPhase('interview');
        return;
      }

      recordingBlobRef.current = blob;

      // Update status to uploading
      await updateStatus('uploading_recording');

      // Upload recording directly from client to Supabase Storage
      const stored = localStorage.getItem(`attempt_${attemptId}`);
      const { assignmentId } = stored ? JSON.parse(stored) : { assignmentId: '' };

      if (!assignmentId) {
        throw new Error('Missing assignmentId for upload');
      }

      const recordingExt = 'webm';
      const storagePath = `${assignmentId}/${attemptId}.${recordingExt}`;

      // Simulated progress
      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => Math.min(prev + 10, 90));
      }, 500);

      const { error: storageError } = await supabase.storage
        .from('recordings')
        .upload(storagePath, blob, {
          contentType: blob.type || 'video/webm',
          upsert: true,
        });

      if (storageError) {
        clearInterval(progressInterval);
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

      clearInterval(progressInterval);

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setUploadProgress(100);

      // Now finalize grading
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
      await updateStatus('recording_failed').catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attemptId, phase, stopRecording, router]);

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
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white p-8 rounded-lg shadow-md max-w-lg w-full space-y-6">
          <h1 className="text-2xl font-bold text-gray-900 text-center">
            {(assignmentData as Record<string, unknown>)?.title as string || 'Assessment'}
          </h1>

          {/* Camera Preview */}
          <div className="relative bg-black rounded-lg overflow-hidden aspect-video">
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="w-full h-full object-cover"
            />
            {!hasPermissions && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-800 bg-opacity-80">
                <p className="text-white text-sm">Camera preview will appear here</p>
              </div>
            )}
          </div>

          {/* Permission Button */}
          {!hasPermissions ? (
            <button
              onClick={requestPermissions}
              className="w-full py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition"
            >
              Grant Camera & Microphone Access
            </button>
          ) : (
            <div className="flex items-center gap-2 text-green-600 text-sm">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
              Camera and microphone access granted
            </div>
          )}

          {/* Consent Checkbox */}
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              className="mt-1 w-4 h-4 text-blue-600 rounded"
            />
            <span className="text-sm text-gray-700">
              I consent to being recorded during this assessment. I understand that the recording
              will be reviewed by my instructor. I will speak my thought process out loud while
              typing my answers.
            </span>
          </label>

          {error && <p className="text-red-600 text-sm">{error}</p>}

          {/* Start Button */}
          <button
            onClick={handleStartRecording}
            disabled={!hasPermissions || !consent}
            className="w-full py-3 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition font-medium"
          >
            Start Assessment
          </button>
        </div>
      </div>
    );
  }

  // ======== UPLOADING ========
  if (phase === 'uploading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white p-8 rounded-lg shadow-md max-w-md w-full space-y-6 text-center">
          <h2 className="text-xl font-bold text-gray-900">Uploading Recording...</h2>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div
              className="bg-blue-600 h-3 rounded-full transition-all duration-300"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
          <p className="text-sm text-gray-500">{uploadProgress}% complete</p>
          <p className="text-xs text-gray-400">
            Please do not close this page. Your submission is only valid after upload completes.
          </p>
        </div>
      </div>
    );
  }

  // ======== FINALIZING ========
  if (phase === 'finalizing') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white p-8 rounded-lg shadow-md max-w-md w-full space-y-4 text-center">
          <h2 className="text-xl font-bold text-gray-900">Grading Your Submission...</h2>
          <div className="animate-pulse flex justify-center">
            <div className="w-12 h-12 bg-blue-200 rounded-full" />
          </div>
          <p className="text-sm text-gray-500">AI is reviewing your responses. This may take a moment.</p>
        </div>
      </div>
    );
  }

  // ======== INTERVIEW ========
  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Top Bar */}
      <div className="bg-white border-b border-gray-200 px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-4">
          {/* Recording Indicator */}
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
            <span className="text-sm font-medium text-red-600">REC</span>
          </div>
          {/* Timer */}
          <span className={`text-sm font-mono ${remaining < 60 ? 'text-red-600 font-bold' : 'text-gray-600'}`}>
            {formatTime(remaining)} remaining
          </span>
          {!isFullscreen && (
            <span className="text-xs text-yellow-700 bg-yellow-100 px-2 py-0.5 rounded">
              Fullscreen required
            </span>
          )}
          {isMultiMonitorDetected && (
            <span className="text-xs text-red-700 bg-red-100 px-2 py-0.5 rounded">
              Multi-monitor detected (flagged)
            </span>
          )}
        </div>
        <button
          onClick={handleSubmit}
          disabled={sending || (!hasStudentResponse && !shouldEnd)}
          className="px-4 py-1.5 bg-red-600 text-white text-sm rounded-md hover:bg-red-700 disabled:opacity-50 transition"
        >
          Submit Assessment
        </button>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Camera Preview (sidebar) */}
        <div className="w-48 bg-black flex-shrink-0 relative">
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            className="w-full h-full object-cover"
          />
          <div className="absolute bottom-2 left-2 right-2">
            <div className="bg-black bg-opacity-60 rounded px-2 py-1 text-xs text-white text-center">
              {formatTime(duration)}
            </div>
          </div>
        </div>

        {/* Main Interview Panel */}
        <div className="flex-1 flex flex-col">
          {/* Chat Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {chat.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === 'student' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] p-3 rounded-lg text-sm ${
                    msg.role === 'ai'
                      ? 'bg-blue-50 text-blue-900 border border-blue-100'
                      : 'bg-gray-100 text-gray-900 border border-gray-200'
                  }`}
                >
                  <p className="text-xs font-medium mb-1 opacity-60">
                    {msg.role === 'ai' ? '🤖 CodeCoach' : '👤 You'}
                  </p>
                  {msg.role === 'ai' ? (
                    <MarkdownMessage content={msg.content} />
                  ) : (
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  )}
                </div>
              </div>
            ))}
            {sending && (
              <div className="flex justify-start">
                <div className="bg-blue-50 p-3 rounded-lg text-sm border border-blue-100">
                  <p className="text-blue-600 animate-pulse">CodeCoach is thinking...</p>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Input Area */}
          <div className="border-t border-gray-200 bg-white p-4">
            {shouldEnd && (
              <div className="mb-3 p-2 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-700">
                {endCountdown !== null
                  ? `The interviewer is wrapping up. Auto-submit in ${endCountdown}s.`
                  : 'The interviewer is wrapping up. Please click Submit Assessment before time runs out.'}
              </div>
            )}
            {!isFullscreen && (
              <div className="mb-3 p-2 bg-orange-50 border border-orange-200 rounded text-sm text-orange-700 flex items-center justify-between gap-3">
                <span>You exited fullscreen. Re-enter fullscreen to continue safely.</span>
                <button
                  onClick={requestFullscreenMode}
                  className="px-3 py-1.5 bg-orange-600 text-white rounded text-xs hover:bg-orange-700 transition"
                >
                  Re-enter Fullscreen
                </button>
              </div>
            )}
            {isMultiMonitorDetected && (
              <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
                Multiple monitors were detected. This session has been flagged for instructor review.
              </div>
            )}
            {error && (
              <p className="text-red-600 text-sm mb-2">{error}</p>
            )}
            {!speechSupported && (
              <p className="text-sm text-red-600 mb-2">
                Voice input is not supported in this browser. Please use Chrome or Edge.
              </p>
            )}
            <div className="flex gap-2 items-end">
              <textarea
                value={speechDraft}
                readOnly
                placeholder="Your speech transcript will appear here..."
                rows={4}
                disabled
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm resize-none bg-gray-50 text-gray-700 overflow-y-auto"
              />
              {!isListening ? (
                <button
                  onClick={startListening}
                  disabled={!isRecording || sending || !speechSupported || !isFullscreen || shouldEnd}
                  className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50 transition"
                >
                  Speak
                </button>
              ) : (
                <button
                  onClick={stopListening}
                  className="px-4 py-2 bg-gray-700 text-white rounded-md hover:bg-gray-800 transition"
                >
                  Stop
                </button>
              )}
              <button
                onClick={handleSendMessage}
                disabled={!isRecording || sending || isListening || !speechDraft.trim() || !isFullscreen || shouldEnd}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 transition self-end"
              >
                Send
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-2">
              Voice-only mode: click Speak, answer out loud, then click Stop and Send.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
