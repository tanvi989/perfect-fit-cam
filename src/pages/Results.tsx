import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCaptureData } from '@/context/CaptureContext';
import { MeasurementsTab } from '@/components/try-on/MeasurementsTab';
import { FramesTab } from '@/components/try-on/FramesTab';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Ruler, Glasses, RefreshCw } from 'lucide-react';

export default function Results() {
  const navigate = useNavigate();
  const { capturedData } = useCaptureData();

  // Redirect to home if no captured data
  useEffect(() => {
    if (!capturedData) {
      navigate('/');
    }
  }, [capturedData, navigate]);

  if (!capturedData) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border">
        <div className="container max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/')}
              className="shrink-0"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-xl font-semibold text-foreground">Results</h1>
              <p className="text-sm text-muted-foreground">
                Your face measurements and frame selection
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            onClick={() => navigate('/')}
            className="flex items-center gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            <span>Retake Photo</span>
          </Button>
        </div>
      </header>

      {/* Main content */}
      <main className="container max-w-4xl mx-auto">
        <Tabs defaultValue="measurements" className="w-full">
          <TabsList className="w-full grid grid-cols-2 h-14 bg-muted/50 p-1 mx-4 mt-4 rounded-xl">
            <TabsTrigger 
              value="measurements" 
              className="flex items-center gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-lg h-full"
            >
              <Ruler className="h-4 w-4" />
              <span>Precise Measurements</span>
            </TabsTrigger>
            <TabsTrigger 
              value="frames"
              className="flex items-center gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-lg h-full"
            >
              <Glasses className="h-4 w-4" />
              <span>Frame Selection</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="measurements" className="mt-0">
            <MeasurementsTab />
          </TabsContent>

          <TabsContent value="frames" className="mt-0">
            <FramesTab />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
