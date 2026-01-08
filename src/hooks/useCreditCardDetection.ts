import { useCallback, useRef, useState, useEffect } from 'react';

// Standard credit card dimensions: 85.6mm x 53.98mm
// Aspect ratio: ~1.586
const CARD_ASPECT_RATIO = 85.6 / 53.98; // ~1.586
const ASPECT_RATIO_TOLERANCE = 0.3; // Allow some deviation

interface CardDetectionState {
  cardDetected: boolean;
  cardFullyVisible: boolean;
  cardInPosition: boolean;
  cardTilted: boolean;
  cardBounds: { x: number; y: number; width: number; height: number } | null;
  confidenceScore: number;
}

interface UseCreditCardDetectionProps {
  videoRef: React.RefObject<HTMLVideoElement>;
  canvasRef: React.RefObject<HTMLCanvasElement>;
  isActive: boolean;
  cardGuideArea: { x: number; y: number; width: number; height: number } | null;
}

export function useCreditCardDetection({
  videoRef,
  canvasRef,
  isActive,
  cardGuideArea,
}: UseCreditCardDetectionProps) {
  const [detectionState, setDetectionState] = useState<CardDetectionState>({
    cardDetected: false,
    cardFullyVisible: false,
    cardInPosition: false,
    cardTilted: false,
    cardBounds: null,
    confidenceScore: 0,
  });

  const lastProcessTime = useRef<number>(0);
  const animationFrameRef = useRef<number>();

  // Detect rectangular shapes that could be credit cards using edge detection
  const detectCard = useCallback(() => {
    if (!videoRef.current || !canvasRef.current || !cardGuideArea) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx || video.readyState < 2) return;

    // Set canvas size to match video
    const width = video.videoWidth;
    const height = video.videoHeight;
    canvas.width = width;
    canvas.height = height;

    // Draw mirrored image (to match camera display)
    ctx.save();
    ctx.translate(width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0);
    ctx.restore();

    // Get image data for the card guide area
    const guideX = Math.floor(cardGuideArea.x * width);
    const guideY = Math.floor(cardGuideArea.y * height);
    const guideWidth = Math.floor(cardGuideArea.width * width);
    const guideHeight = Math.floor(cardGuideArea.height * height);

    // Ensure we're within bounds
    const safeX = Math.max(0, Math.min(guideX, width - guideWidth));
    const safeY = Math.max(0, Math.min(guideY, height - guideHeight));
    const safeWidth = Math.min(guideWidth, width - safeX);
    const safeHeight = Math.min(guideHeight, height - safeY);

    if (safeWidth <= 0 || safeHeight <= 0) return;

    const imageData = ctx.getImageData(safeX, safeY, safeWidth, safeHeight);
    const data = imageData.data;

    // Simple edge detection using Sobel-like approach
    // Look for strong edges that form a rectangle
    let edgePixels = 0;
    let totalPixels = safeWidth * safeHeight;
    let horizontalEdges = 0;
    let verticalEdges = 0;

    for (let y = 1; y < safeHeight - 1; y++) {
      for (let x = 1; x < safeWidth - 1; x++) {
        const idx = (y * safeWidth + x) * 4;
        const idxLeft = (y * safeWidth + (x - 1)) * 4;
        const idxRight = (y * safeWidth + (x + 1)) * 4;
        const idxUp = ((y - 1) * safeWidth + x) * 4;
        const idxDown = ((y + 1) * safeWidth + x) * 4;

        // Calculate grayscale values
        const gray = (data[idx] + data[idx + 1] + data[idx + 2]) / 3;
        const grayLeft = (data[idxLeft] + data[idxLeft + 1] + data[idxLeft + 2]) / 3;
        const grayRight = (data[idxRight] + data[idxRight + 1] + data[idxRight + 2]) / 3;
        const grayUp = (data[idxUp] + data[idxUp + 1] + data[idxUp + 2]) / 3;
        const grayDown = (data[idxDown] + data[idxDown + 1] + data[idxDown + 2]) / 3;

        // Horizontal gradient (for vertical edges)
        const gx = Math.abs(grayRight - grayLeft);
        // Vertical gradient (for horizontal edges)
        const gy = Math.abs(grayDown - grayUp);

        const edgeStrength = Math.sqrt(gx * gx + gy * gy);

        if (edgeStrength > 30) {
          edgePixels++;
          if (gx > gy) verticalEdges++;
          else horizontalEdges++;
        }
      }
    }

    // Calculate edge density
    const edgeDensity = edgePixels / totalPixels;
    
    // A credit card should have clear rectangular edges
    // We expect moderate edge density with balanced horizontal/vertical edges
    const edgeBalance = Math.min(horizontalEdges, verticalEdges) / Math.max(horizontalEdges, verticalEdges, 1);
    
    // Score based on edge characteristics
    const hasRectangularShape = edgeDensity > 0.03 && edgeDensity < 0.25;
    const hasBalancedEdges = edgeBalance > 0.3;
    
    // Calculate confidence score
    let confidence = 0;
    if (hasRectangularShape) confidence += 0.4;
    if (hasBalancedEdges) confidence += 0.3;
    if (edgeDensity > 0.05 && edgeDensity < 0.15) confidence += 0.3;

    // Check for card-like color distribution (credit cards often have uniform areas)
    let colorVariance = 0;
    const sampleSize = Math.min(1000, totalPixels);
    const step = Math.floor(totalPixels / sampleSize);
    let sumR = 0, sumG = 0, sumB = 0, count = 0;
    
    for (let i = 0; i < data.length; i += step * 4) {
      sumR += data[i];
      sumG += data[i + 1];
      sumB += data[i + 2];
      count++;
    }
    
    const avgR = sumR / count;
    const avgG = sumG / count;
    const avgB = sumB / count;
    
    for (let i = 0; i < data.length; i += step * 4) {
      colorVariance += Math.pow(data[i] - avgR, 2);
      colorVariance += Math.pow(data[i + 1] - avgG, 2);
      colorVariance += Math.pow(data[i + 2] - avgB, 2);
    }
    colorVariance /= (count * 3);

    // Credit cards have moderate color variance (not too uniform like empty space, not too varied like face)
    const hasCardLikeColors = colorVariance > 500 && colorVariance < 5000;
    if (hasCardLikeColors) confidence += 0.2;

    // Determine detection state - stricter thresholds for mobile
    // Require higher confidence to avoid false positives
    const cardDetected = confidence > 0.7;
    const cardFullyVisible = confidence > 0.8;
    const cardInPosition = confidence > 0.85;
    const cardTilted = hasBalancedEdges && edgeBalance < 0.5;

    setDetectionState({
      cardDetected,
      cardFullyVisible,
      cardInPosition,
      cardTilted,
      cardBounds: cardDetected ? cardGuideArea : null,
      confidenceScore: confidence,
    });
  }, [videoRef, canvasRef, cardGuideArea]);

  useEffect(() => {
    if (!isActive || !cardGuideArea) {
      setDetectionState({
        cardDetected: false,
        cardFullyVisible: false,
        cardInPosition: false,
        cardTilted: false,
        cardBounds: null,
        confidenceScore: 0,
      });
      return;
    }

    const processFrame = () => {
      const now = performance.now();
      if (now - lastProcessTime.current < 200) { // 5 FPS for card detection
        animationFrameRef.current = requestAnimationFrame(processFrame);
        return;
      }
      lastProcessTime.current = now;

      detectCard();
      animationFrameRef.current = requestAnimationFrame(processFrame);
    };

    processFrame();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isActive, cardGuideArea, detectCard]);

  return detectionState;
}
