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
  const mimeTypeRef = useRef<string>('video/webm');

  const requestPermissions = useCallback(async (): Promise<boolean> => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640, max: 960 },
          height: { ideal: 360, max: 540 },
          frameRate: { ideal: 12, max: 15 },
          facingMode: 'user',
        },
        audio: {
          noiseSuppression: true,
          echoCancellation: true,
          autoGainControl: true,
        },
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

    const mimeType = MediaRecorder.isTypeSupported('video/mp4;codecs=avc1.42E01E,mp4a.40.2')
      ? 'video/mp4;codecs=avc1.42E01E,mp4a.40.2'
      : MediaRecorder.isTypeSupported('video/mp4')
      ? 'video/mp4'
      : MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
      ? 'video/webm;codecs=vp9,opus'
      : MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')
      ? 'video/webm;codecs=vp8,opus'
      : 'video/webm';

    mimeTypeRef.current = mimeType;

    const recorder = new MediaRecorder(currentStream, {
      mimeType,
      videoBitsPerSecond: 250000,
      audioBitsPerSecond: 48000,
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
    recorder.start();

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
        const blob = new Blob(chunksRef.current, { type: mimeTypeRef.current });

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
