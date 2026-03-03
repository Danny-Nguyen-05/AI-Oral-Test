'use client';

import { useRef, useState, useCallback } from 'react';

interface UseRecordingOptions {
  onError?: (error: string) => void;
}

interface UseRecordingReturn {
  isRecording: boolean;
  isPaused: boolean;
  duration: number;
  stream: MediaStream | null;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<Blob | null>;
  requestPermissions: () => Promise<boolean>;
  hasPermissions: boolean;
}

export function useRecording(opts: UseRecordingOptions = {}): UseRecordingReturn {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused] = useState(false);
  const [duration, setDuration] = useState(0);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [hasPermissions, setHasPermissions] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);
  const streamRef = useRef<MediaStream | null>(null);

  const requestPermissions = useCallback(async (): Promise<boolean> => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      streamRef.current = mediaStream;
      setStream(mediaStream);
      setHasPermissions(true);
      return true;
    } catch (err) {
      console.error('Permission error:', err);
      opts.onError?.('Camera and microphone permissions are required');
      setHasPermissions(false);
      return false;
    }
  }, [opts]);

  const startRecording = useCallback(async () => {
    const currentStream = streamRef.current;
    if (!currentStream) {
      opts.onError?.('No media stream available');
      return;
    }

    chunksRef.current = [];

    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
      ? 'video/webm;codecs=vp9,opus'
      : MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')
      ? 'video/webm;codecs=vp8,opus'
      : 'video/webm';

    const recorder = new MediaRecorder(currentStream, {
      mimeType,
      videoBitsPerSecond: 500000,
    });

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        chunksRef.current.push(e.data);
      }
    };

    recorder.onerror = () => {
      opts.onError?.('Recording error occurred');
    };

    mediaRecorderRef.current = recorder;
    recorder.start(1000); // collect chunks every second

    startTimeRef.current = Date.now();
    timerRef.current = setInterval(() => {
      setDuration(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);

    setIsRecording(true);
  }, [opts]);

  const stopRecording = useCallback(async (): Promise<Blob | null> => {
    return new Promise((resolve) => {
      const recorder = mediaRecorderRef.current;
      if (!recorder || recorder.state === 'inactive') {
        resolve(null);
        return;
      }

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'video/webm' });

        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }

        setIsRecording(false);
        setDuration(Math.floor((Date.now() - startTimeRef.current) / 1000));
        resolve(blob);
      };

      recorder.stop();

      // Stop all tracks
      streamRef.current?.getTracks().forEach((track) => track.stop());
    });
  }, []);

  return {
    isRecording,
    isPaused,
    duration,
    stream,
    startRecording,
    stopRecording,
    requestPermissions,
    hasPermissions,
  };
}
