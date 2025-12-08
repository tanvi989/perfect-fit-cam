import { useState, useEffect } from 'react';
import { processFrameImage } from '@/lib/removeBackground';
import type { GlassesFrame } from '@/types/face-validation';

export interface ProcessedFrame extends GlassesFrame {
  processedImageUrl: string;
  isProcessing: boolean;
  error?: string;
}

export function useProcessedFrames(frames: GlassesFrame[]) {
  const [processedFrames, setProcessedFrames] = useState<ProcessedFrame[]>(
    frames.map((frame) => ({
      ...frame,
      processedImageUrl: frame.imageUrl,
      isProcessing: true,
    }))
  );
  const [isProcessing, setIsProcessing] = useState(true);
  const [processingProgress, setProcessingProgress] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const processAllFrames = async () => {
      setIsProcessing(true);
      setProcessingProgress(0);

      const results: ProcessedFrame[] = [];

      for (let i = 0; i < frames.length; i++) {
        const frame = frames[i];
        
        if (cancelled) break;

        try {
          console.log(`Processing frame ${i + 1}/${frames.length}: ${frame.name}`);
          const processedUrl = await processFrameImage(frame.imageUrl);
          
          results.push({
            ...frame,
            processedImageUrl: processedUrl,
            isProcessing: false,
          });
        } catch (error) {
          console.error(`Failed to process frame ${frame.name}:`, error);
          results.push({
            ...frame,
            processedImageUrl: frame.imageUrl, // Fallback to original
            isProcessing: false,
            error: 'Failed to remove background',
          });
        }

        if (!cancelled) {
          setProcessingProgress(((i + 1) / frames.length) * 100);
          setProcessedFrames([...results, ...frames.slice(i + 1).map((f) => ({
            ...f,
            processedImageUrl: f.imageUrl,
            isProcessing: true,
          }))]);
        }
      }

      if (!cancelled) {
        setProcessedFrames(results);
        setIsProcessing(false);
      }
    };

    processAllFrames();

    return () => {
      cancelled = true;
    };
  }, [frames]);

  return { processedFrames, isProcessing, processingProgress };
}
