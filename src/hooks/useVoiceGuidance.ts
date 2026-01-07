import { useCallback, useRef, useEffect } from 'react';

interface VoiceGuidanceOptions {
  enabled?: boolean;
  debounceMs?: number;
  voice?: string;
}

export function useVoiceGuidance(options: VoiceGuidanceOptions = {}) {
  const { enabled = true, debounceMs = 2000 } = options;
  const lastSpokenRef = useRef<string>('');
  const lastSpokenTimeRef = useRef<number>(0);
  const synthRef = useRef<SpeechSynthesis | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      synthRef.current = window.speechSynthesis;
    }
    return () => {
      if (synthRef.current) {
        synthRef.current.cancel();
      }
    };
  }, []);

  const speak = useCallback((message: string) => {
    if (!enabled || !synthRef.current) return;

    const now = Date.now();
    // Debounce: don't repeat same message within debounceMs
    if (message === lastSpokenRef.current && now - lastSpokenTimeRef.current < debounceMs) {
      return;
    }

    // Cancel any ongoing speech
    synthRef.current.cancel();

    const utterance = new SpeechSynthesisUtterance(message);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    // Try to use a natural voice
    const voices = synthRef.current.getVoices();
    const preferredVoice = voices.find(v => 
      v.lang.startsWith('en') && (v.name.includes('Natural') || v.name.includes('Female'))
    ) || voices.find(v => v.lang.startsWith('en'));
    
    if (preferredVoice) {
      utterance.voice = preferredVoice;
    }

    synthRef.current.speak(utterance);
    lastSpokenRef.current = message;
    lastSpokenTimeRef.current = now;
  }, [enabled, debounceMs]);

  const speakGuidance = useCallback((validationChecks: Array<{ id: string; passed: boolean; message: string }>) => {
    if (!enabled) return;

    // Priority order for guidance
    const distanceCheck = validationChecks.find(c => c.id === 'distance');
    const positionCheck = validationChecks.find(c => c.id === 'position' || c.id === 'face-detected');
    const tiltCheck = validationChecks.find(c => c.id === 'tilt' || c.id === 'head-straight');
    const rotationCheck = validationChecks.find(c => c.id === 'rotation' || c.id === 'no-rotation');
    const cardCheck = validationChecks.find(c => c.id === 'credit-card');

    // Speak the most important failed check
    if (distanceCheck && !distanceCheck.passed) {
      if (distanceCheck.message.includes('closer')) {
        speak('Please move closer to the camera');
      } else if (distanceCheck.message.includes('back')) {
        speak('Please move back from the camera');
      }
      return;
    }

    if (positionCheck && !positionCheck.passed) {
      speak('Please center your face in the oval guide');
      return;
    }

    if (tiltCheck && !tiltCheck.passed) {
      speak('Please keep your head straight, avoid tilting');
      return;
    }

    if (rotationCheck && !rotationCheck.passed) {
      speak('Please look straight at the camera');
      return;
    }

    // Credit card check
    if (cardCheck && !cardCheck.passed) {
      if (cardCheck.message.includes('not visible')) {
        speak('Credit card is not fully visible. Please ensure the entire card is in the box');
      } else if (cardCheck.message.includes('tilted')) {
        speak('Please hold the card flat without tilting');
      } else {
        speak('Please place a credit card flat on your cheek, inside the yellow box');
      }
      return;
    }
  }, [enabled, speak]);

  const cancel = useCallback(() => {
    if (synthRef.current) {
      synthRef.current.cancel();
    }
  }, []);

  return { speak, speakGuidance, cancel };
}
