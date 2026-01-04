import { useCaptureData } from '@/context/CaptureContext';
import { Ruler, Eye, MoveHorizontal, Activity, Glasses } from 'lucide-react';
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

  const { measurements, processedImageDataUrl, glassesDetected } = capturedData;

  // Calculate confidence based on PD value range (typical adult PD is 54-74mm)
  const getConfidence = (pd: number): 'low' | 'medium' | 'high' => {
    if (pd >= 54 && pd <= 74) return 'high';
    if (pd >= 48 && pd <= 80) return 'medium';
    return 'low';
  };

  const confidence = getConfidence(measurements.pd_total);

  const getConfidenceBadge = (conf: 'low' | 'medium' | 'high') => {
    const variants = {
      low: 'bg-destructive/10 text-destructive',
      medium: 'bg-yellow-500/10 text-yellow-600',
      high: 'bg-medical-success/10 text-medical-success',
    };
    return (
      <Badge variant="outline" className={variants[conf]}>
        {conf.charAt(0).toUpperCase() + conf.slice(1)} Confidence
      </Badge>
    );
  };

  return (
    <div className="space-y-6 p-4">
      {/* Captured Image */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Eye className="h-5 w-5 text-primary" />
              Processed Image
            </CardTitle>
            {glassesDetected && (
              <Badge variant="outline" className="bg-primary/10 text-primary">
                <Glasses className="h-3 w-3 mr-1" />
                Glasses Removed
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="relative rounded-lg overflow-hidden bg-muted aspect-video">
            <img
              src={processedImageDataUrl}
              alt="Processed face"
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
            {getConfidenceBadge(confidence)}
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4">
            <div className="text-5xl font-bold text-primary">
              {measurements.pd_total.toFixed(1)}
              <span className="text-2xl font-normal text-muted-foreground ml-1">mm</span>
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              Total pupillary distance
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-border">
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Left PD</p>
              <p className="text-2xl font-semibold text-foreground">
                {measurements.pd_left.toFixed(1)} mm
              </p>
            </div>
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Right PD</p>
              <p className="text-2xl font-semibold text-foreground">
                {measurements.pd_right.toFixed(1)} mm
              </p>
            </div>
          </div>
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
                {measurements.face_width.toFixed(1)} mm
              </p>
            </div>
            <div className="bg-muted/50 rounded-lg p-4 text-center">
              <p className="text-sm text-muted-foreground">Face Height</p>
              <p className="text-xl font-semibold text-foreground">
                {measurements.face_height.toFixed(1)} mm
              </p>
            </div>
            <div className="bg-muted/50 rounded-lg p-4 text-center">
              <p className="text-sm text-muted-foreground">Fitting Height</p>
              <p className="text-xl font-semibold text-foreground">
                {measurements.fitting_height.toFixed(1)} mm
              </p>
            </div>
            <div className="bg-muted/50 rounded-lg p-4 text-center">
              <p className="text-sm text-muted-foreground">Face Ratio</p>
              <p className="text-xl font-semibold text-foreground">
                {measurements.face_shape_ratio.toFixed(2)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Nose Measurements */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            Nose Bridge Measurements
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-muted/50 rounded-lg p-4 text-center">
              <p className="text-sm text-muted-foreground">Left</p>
              <p className="text-xl font-semibold text-foreground">
                {measurements.nose_left.toFixed(1)} mm
              </p>
            </div>
            <div className="bg-muted/50 rounded-lg p-4 text-center">
              <p className="text-sm text-muted-foreground">Right</p>
              <p className="text-xl font-semibold text-foreground">
                {measurements.nose_right.toFixed(1)} mm
              </p>
            </div>
            <div className="bg-muted/50 rounded-lg p-4 text-center">
              <p className="text-sm text-muted-foreground">Total</p>
              <p className="text-xl font-semibold text-foreground">
                {measurements.face_width.toFixed(1)} mm
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
