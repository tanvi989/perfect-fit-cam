import { useCallback } from 'react';
import { useCamera } from '@/hooks/useCamera';
import { CameraPermission } from './CameraPermission';
import { CameraView } from './CameraView';

export function TryOnApp() {
  const { cameraState, error, videoRef, requestCamera } = useCamera();

  const handleRequestCamera = useCallback(() => {
    requestCamera();
  }, [requestCamera]);

  // Show permission screen if camera not granted
  if (cameraState !== 'granted') {
    return (
      <CameraPermission
        cameraState={cameraState}
        error={error}
        onRequestCamera={handleRequestCamera}
      />
    );
  }

  // Show camera view with face detection
  return <CameraView videoRef={videoRef} />;
}