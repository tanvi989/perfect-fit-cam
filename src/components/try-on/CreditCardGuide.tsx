import { cn } from '@/lib/utils';
import { CreditCard } from 'lucide-react';

interface CreditCardGuideProps {
  isValid: boolean;
  cardDetected: boolean;
  cardFullyVisible: boolean;
}

export function CreditCardGuide({ isValid, cardDetected, cardFullyVisible }: CreditCardGuideProps) {
  return (
    <div className="absolute inset-0 pointer-events-none z-10">
      {/* Credit card guide - positioned below face oval for mobile visibility */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {/* Face oval area reference */}
        <div className="relative w-[280px] h-[360px] md:w-[320px] md:h-[420px]">
          {/* Credit card guide box - positioned below the face oval on mobile, on cheek for desktop */}
          <div 
            className={cn(
              "absolute transition-all duration-300",
              // Mobile: positioned below the oval, centered
              // Desktop: positioned on the right cheek area
              "left-1/2 -translate-x-1/2 top-[105%]",
              "md:left-auto md:translate-x-0 md:top-[55%] md:-right-[45%]",
              // Card dimensions: ~85.6mm x 53.98mm ratio
              "w-[120px] h-[75px] md:w-[140px] md:h-[88px]",
              // Border styling based on state
              "border-2 rounded-lg",
              !cardDetected && "border-yellow-400 border-dashed",
              cardDetected && !cardFullyVisible && "border-orange-400",
              cardDetected && cardFullyVisible && !isValid && "border-orange-400",
              isValid && "border-green-400"
            )}
          >
            {/* Corner markers for card guide */}
            <div className={cn(
              "absolute -top-1 -left-1 w-3 h-3 md:w-4 md:h-4 border-l-2 border-t-2 rounded-tl-md transition-colors duration-300",
              !cardDetected ? "border-yellow-400" : isValid ? "border-green-400" : "border-orange-400"
            )} />
            <div className={cn(
              "absolute -top-1 -right-1 w-3 h-3 md:w-4 md:h-4 border-r-2 border-t-2 rounded-tr-md transition-colors duration-300",
              !cardDetected ? "border-yellow-400" : isValid ? "border-green-400" : "border-orange-400"
            )} />
            <div className={cn(
              "absolute -bottom-1 -left-1 w-3 h-3 md:w-4 md:h-4 border-l-2 border-b-2 rounded-bl-md transition-colors duration-300",
              !cardDetected ? "border-yellow-400" : isValid ? "border-green-400" : "border-orange-400"
            )} />
            <div className={cn(
              "absolute -bottom-1 -right-1 w-3 h-3 md:w-4 md:h-4 border-r-2 border-b-2 rounded-br-md transition-colors duration-300",
              !cardDetected ? "border-yellow-400" : isValid ? "border-green-400" : "border-orange-400"
            )} />

            {/* Card icon inside the guide */}
            <div className="absolute inset-0 flex items-center justify-center">
              <CreditCard 
                className={cn(
                  "w-6 h-6 md:w-8 md:h-8 transition-colors duration-300",
                  !cardDetected && "text-yellow-400/50",
                  cardDetected && !isValid && "text-orange-400/70",
                  isValid && "text-green-400/70"
                )} 
              />
            </div>
          </div>

          {/* Instruction label for card - above card guide on mobile, above on desktop */}
          <div 
            className={cn(
              "absolute left-1/2 -translate-x-1/2 top-[98%]",
              "md:left-auto md:translate-x-0 md:top-[48%] md:-right-[45%] md:-translate-y-full",
              "px-2 py-1 rounded text-xs font-medium whitespace-nowrap",
              "bg-black/60 backdrop-blur-sm transition-colors duration-300",
              !cardDetected && "text-yellow-400",
              cardDetected && !isValid && "text-orange-400",
              isValid && "text-green-400"
            )}
          >
            {!cardDetected ? "Place card here" : 
             !cardFullyVisible ? "Card not fully visible" :
             isValid ? "Card detected ✓" : "Adjust card position"}
          </div>
        </div>
      </div>
    </div>
  );
}
