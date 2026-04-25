import React, { useState } from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useIsMobile } from "@/hooks/use-mobile";

export default function ClickableTooltip({ children, content, triggerText }) {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);

  if (isMobile) {
    return (
      <TooltipProvider>
        <Tooltip open={open} onOpenChange={setOpen}>
          <TooltipTrigger asChild>
            <span 
              className="cursor-pointer underline decoration-dotted" 
              onClick={() => setOpen(!open)}
            >
              {triggerText}
            </span>
          </TooltipTrigger>
          <TooltipContent className="text-xs space-y-1 text-left p-3 max-w-xs">
            {content}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="cursor-help underline decoration-dotted">
            {triggerText}
          </span>
        </TooltipTrigger>
        <TooltipContent className="text-xs space-y-1 text-left p-3 max-w-xs">
          {content}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}