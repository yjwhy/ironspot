import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from 'expo-speech-recognition';
import { useEffect, useRef, useState } from 'react';

import { MIC_HARD_CAP_TIMEOUT_MS, MIC_SILENCE_TIMEOUT_MS } from '../constants';

export type VoiceErrorKind = 'permission_denied' | 'recognition_failed' | 'silence';

export interface VoiceError {
  readonly kind: VoiceErrorKind;
  readonly message: string;
}

interface UseVoiceInputResult {
  readonly isListening: boolean;
  readonly transcript: string;
  readonly error: VoiceError | null;
  readonly start: () => Promise<void>;
  readonly stop: () => void;
}

/**
 * Wraps expo-speech-recognition with continuous mode + a JS 1s silence
 * auto-stop and an 8s hard cap. continuous: false would let the platform
 * endpointer decide, but iOS/Android disagree on the silence threshold —
 * doing it in JS gives consistent UX. Hard cap protects against the silent-
 * input failure mode (mic blocked / ambient noise too low) where partial
 * results never arrive and the silence timer therefore never starts.
 */
export function useVoiceInput(): UseVoiceInputResult {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<VoiceError | null>(null);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hardCapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function clearTimers() {
    if (silenceTimerRef.current !== null) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    if (hardCapTimerRef.current !== null) {
      clearTimeout(hardCapTimerRef.current);
      hardCapTimerRef.current = null;
    }
  }

  useSpeechRecognitionEvent('result', (event) => {
    const latest = event.results[0]?.transcript ?? '';
    setTranscript(latest);
    // Reset the silence timer on each partial result — a new utterance fragment
    // restarts the "is the user still speaking?" clock.
    if (silenceTimerRef.current !== null) {
      clearTimeout(silenceTimerRef.current);
    }
    silenceTimerRef.current = setTimeout(() => {
      ExpoSpeechRecognitionModule.stop();
    }, MIC_SILENCE_TIMEOUT_MS);
  });

  useSpeechRecognitionEvent('error', (event) => {
    setError({
      kind: 'recognition_failed',
      message: event.message === '' ? '음성 인식에 실패했어요' : event.message,
    });
    setIsListening(false);
    clearTimers();
  });

  useSpeechRecognitionEvent('end', () => {
    setIsListening(false);
    clearTimers();
  });

  useEffect(function cleanupOnUnmount() {
    return () => {
      clearTimers();
      ExpoSpeechRecognitionModule.stop();
    };
  }, []);

  async function start(): Promise<void> {
    setError(null);
    setTranscript('');
    const permission = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!permission.granted) {
      setError({
        kind: 'permission_denied',
        message: '마이크/음성 인식 권한이 필요해요',
      });
      return;
    }
    ExpoSpeechRecognitionModule.start({
      lang: 'ko-KR',
      interimResults: true,
      continuous: true,
    });
    setIsListening(true);
    hardCapTimerRef.current = setTimeout(() => {
      ExpoSpeechRecognitionModule.stop();
      if (transcript === '') {
        setError({ kind: 'silence', message: '음성을 인식하지 못했어요' });
      }
    }, MIC_HARD_CAP_TIMEOUT_MS);
  }

  function stop(): void {
    ExpoSpeechRecognitionModule.stop();
  }

  return { isListening, transcript, error, start, stop };
}
