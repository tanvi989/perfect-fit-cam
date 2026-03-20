import { useState, useCallback, useRef, useEffect } from 'react';
import type { CameraState } from '@/types/face-validation';

interface UseCameraProps {
  onStreamReady?: (stream: MediaStream) => void;
}

function isPermissionDenied(err: unknown): boolean {
  return (
    err instanceof DOMException &&
    (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError')
  );
}

/** Try progressively simpler constraints — strict resolution often causes OverconstrainedError. */
async function getVideoStream(): Promise<MediaStream> {
  const md = navigator.mediaDevices;
  if (!md?.getUserMedia) {
    throw new DOMException(
      'Camera API is not available. Use http://localhost or https, or try another browser.',
      'NotSupportedError'
    );
  }

  const attempts: MediaStreamConstraints[] = [
    {
      video: {
        facingMode: 'user',
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
      audio: false,
    },
    { video: { facingMode: 'user' }, audio: false },
    { video: true, audio: false },
  ];

  let lastError: unknown;
  for (const constraints of attempts) {
    try {
      return await md.getUserMedia(constraints);
    } catch (err) {
      lastError = err;
      if (isPermissionDenied(err)) {
        throw err;
      }
    }
  }
  throw lastError;
}

function mapCameraError(err: unknown): { state: CameraState; message: string } {
  if (err instanceof DOMException) {
    if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
      return {
        state: 'denied',
        message:
          'Camera access was denied. Please allow camera access in your browser settings.',
      };
    }
    if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
      return {
        state: 'error',
        message: 'No camera found. Please connect a camera and try again.',
      };
    }
    if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
      return {
        state: 'error',
        message:
          'The camera is in use by another app or could not be started. Close other apps using the camera and try again.',
      };
    }
    if (err.name === 'OverconstrainedError' || err.name === 'ConstraintNotSatisfiedError') {
      return {
        state: 'error',
        message:
          'Your camera does not support the requested settings. Try again or use a different camera.',
      };
    }
    if (err.name === 'SecurityError') {
      return {
        state: 'error',
        message:
          'Camera is blocked for this page. Open the app at http://localhost: or https:// and allow access.',
      };
    }
    if (err.name === 'AbortError') {
      return {
        state: 'error',
        message: 'Camera request was interrupted. Click Try Again.',
      };
    }
    if (err.name === 'NotSupportedError') {
      return { state: 'error', message: err.message };
    }
  }
  if (err instanceof Error) {
    return {
      state: 'error',
      message: err.message || 'Failed to access camera. Please try again.',
    };
  }
  return {
    state: 'error',
    message: 'Failed to access camera. Please try again.',
  };
}

export function useCamera({ onStreamReady }: UseCameraProps = {}) {
  const [cameraState, setCameraState] = useState<CameraState>('requesting');
  const [error, setError] = useState<string | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const onStreamReadyRef = useRef(onStreamReady);
  onStreamReadyRef.current = onStreamReady;

  const attachStream = useCallback(() => {
    if (videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(console.error);
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const requestCamera = useCallback(async () => {
    setCameraState('requesting');
    setError(null);
    stopCamera();

    try {
      const stream = await getVideoStream();
      streamRef.current = stream;
      attachStream();
      setCameraState('granted');
      onStreamReadyRef.current?.(stream);
    } catch (err) {
      console.error('Camera access error:', err);
      const { state, message } = mapCameraError(err);
      setCameraState(state);
      setError(message);
    }
  }, [attachStream, stopCamera]);

  // Auto-request once on mount (Strict Mode–safe: cancel in-flight if unmounted)
  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      setCameraState('requesting');
      setError(null);
      try {
        const stream = await getVideoStream();
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        setCameraState('granted');
        onStreamReadyRef.current?.(stream);
        // attachStream runs in the follow-up effect when videoRef exists
      } catch (err) {
        if (cancelled) return;
        console.error('Camera access error:', err);
        const { state, message } = mapCameraError(err);
        setCameraState(state);
        setError(message);
      }
    };

    void run();

    return () => {
      cancelled = true;
      stopCamera();
    };
  }, [stopCamera]);

  useEffect(() => {
    if (cameraState === 'granted' && streamRef.current) {
      attachStream();
    }
  }, [cameraState, attachStream]);

  return {
    cameraState,
    error,
    videoRef,
    streamRef,
    requestCamera,
    stopCamera,
  };
}
