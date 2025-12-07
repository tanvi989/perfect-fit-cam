import { useCaptureData } from '@/context/CaptureContext';
import { Ruler, Eye, MoveHorizontal, Activity } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export function MeasurementsTab() {
  const { capturedData } = useCaptureData();

  if (!capturedData) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">No measurement data available</p>
      </div>
    );
  }

  const { landmarks, pdMeasurement } = capturedData;

  const getConfidenceBadge = (confidence: 'low' | 'medium' | 'high') => {
    const variants = {
      low: 'bg-destructive/10 text-destructive',
      medium: 'bg-yellow-500/10 text-yellow-600',
      high: 'bg-medical-success/10 text-medical-success',
    };
    return (
      <Badge variant="outline" className={variants[confidence]}>
        {confidence.charAt(0).toUpperCase() + confidence.slice(1)} Confidence
      </Badge>
    );
  };

  // Calculate face dimensions from landmarks
  const faceWidth = Math.abs(landmarks.faceRight.x - landmarks.faceLeft.x);
  const faceHeight = Math.abs(landmarks.chin.y - landmarks.forehead.y);

  // Calculate head tilt and rotation
  const deltaY = landmarks.rightEye.y - landmarks.leftEye.y;
  const deltaX = landmarks.rightEye.x - landmarks.leftEye.x;
  const roll = Math.atan2(deltaY, deltaX) * (180 / Math.PI);

  const faceCenter = (landmarks.faceLeft.x + landmarks.faceRight.x) / 2;
  const offset = (landmarks.noseTip.x - faceCenter) / (landmarks.faceRight.x - landmarks.faceLeft.x);
  const yaw = offset * 60;

  return (
    <div className="space-y-6 p-4">
      {/* Captured Image */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Eye className="h-5 w-5 text-primary" />
            Captured Image
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative rounded-lg overflow-hidden bg-muted aspect-video">
            <img
              src={capturedData.imageDataUrl}
              alt="Captured face"
              className="w-full h-full object-cover"
            />
          </div>
        </CardContent>
      </Card>

      {/* PD Measurement */}
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <MoveHorizontal className="h-5 w-5 text-primary" />
              Pupillary Distance (PD)
            </CardTitle>
            {getConfidenceBadge(pdMeasurement.confidence)}
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4">
            <div className="text-5xl font-bold text-primary">
              {pdMeasurement.value.toFixed(1)}
              <span className="text-2xl font-normal text-muted-foreground ml-1">mm</span>
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              Total pupillary distance
            </p>
          </div>

          {pdMeasurement.leftPD && pdMeasurement.rightPD && (
            <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-border">
              <div className="text-center">
                <p className="text-sm text-muted-foreground">Left PD</p>
                <p className="text-2xl font-semibold text-foreground">
                  {pdMeasurement.leftPD.toFixed(1)} mm
                </p>
              </div>
              <div className="text-center">
                <p className="text-sm text-muted-foreground">Right PD</p>
                <p className="text-2xl font-semibold text-foreground">
                  {pdMeasurement.rightPD.toFixed(1)} mm
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Face Measurements */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Ruler className="h-5 w-5 text-primary" />
            Face Dimensions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-muted/50 rounded-lg p-4 text-center">
              <p className="text-sm text-muted-foreground">Face Width</p>
              <p className="text-xl font-semibold text-foreground">
                {(faceWidth * 100).toFixed(0)}%
              </p>
            </div>
            <div className="bg-muted/50 rounded-lg p-4 text-center">
              <p className="text-sm text-muted-foreground">Face Height</p>
              <p className="text-xl font-semibold text-foreground">
                {(faceHeight * 100).toFixed(0)}%
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Head Position */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            Head Position
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-muted/50 rounded-lg p-4 text-center">
              <p className="text-sm text-muted-foreground">Tilt (Roll)</p>
              <p className="text-xl font-semibold text-foreground">
                {roll.toFixed(1)}°
              </p>
            </div>
            <div className="bg-muted/50 rounded-lg p-4 text-center">
              <p className="text-sm text-muted-foreground">Rotation (Yaw)</p>
              <p className="text-xl font-semibold text-foreground">
                {yaw.toFixed(1)}°
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
