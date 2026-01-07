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
      {/* Credit card guide rectangle - positioned on the right cheek area */}
      <div className="absolute inset-0 flex items-center justify-center">
        {/* Position relative to the face oval */}
        <div className="relative w-[280px] h-[360px] md:w-[320px] md:h-[420px]">
          {/* Credit card guide box - positioned on right cheek (user's perspective, mirrored in camera) */}
          <div 
            className={cn(
              "absolute transition-all duration-300",
              // Position below and to the right of center (near cheek area)
              "top-[55%] -right-[60%]",
              // Card dimensions: ~85.6mm x 53.98mm ratio
              "w-[140px] h-[88px] md:w-[160px] md:h-[100px]",
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
              "absolute -top-1 -left-1 w-4 h-4 border-l-2 border-t-2 rounded-tl-md transition-colors duration-300",
              !cardDetected ? "border-yellow-400" : isValid ? "border-green-400" : "border-orange-400"
            )} />
            <div className={cn(
              "absolute -top-1 -right-1 w-4 h-4 border-r-2 border-t-2 rounded-tr-md transition-colors duration-300",
              !cardDetected ? "border-yellow-400" : isValid ? "border-green-400" : "border-orange-400"
            )} />
            <div className={cn(
              "absolute -bottom-1 -left-1 w-4 h-4 border-l-2 border-b-2 rounded-bl-md transition-colors duration-300",
              !cardDetected ? "border-yellow-400" : isValid ? "border-green-400" : "border-orange-400"
            )} />
            <div className={cn(
              "absolute -bottom-1 -right-1 w-4 h-4 border-r-2 border-b-2 rounded-br-md transition-colors duration-300",
              !cardDetected ? "border-yellow-400" : isValid ? "border-green-400" : "border-orange-400"
            )} />

            {/* Card icon inside the guide */}
            <div className="absolute inset-0 flex items-center justify-center">
              <CreditCard 
                className={cn(
                  "w-8 h-8 md:w-10 md:h-10 transition-colors duration-300",
                  !cardDetected && "text-yellow-400/50",
                  cardDetected && !isValid && "text-orange-400/70",
                  isValid && "text-green-400/70"
                )} 
              />
            </div>
          </div>

          {/* Instruction label for card */}
          <div 
            className={cn(
              "absolute top-[48%] -right-[60%] transform -translate-y-full",
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
