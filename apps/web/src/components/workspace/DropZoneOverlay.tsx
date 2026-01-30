'use client';

import { cn } from '@/lib/utils';

export type DropPosition = 'left' | 'right' | 'top' | 'bottom' | 'center' | null;

interface DropZoneOverlayProps {
  isActive: boolean;
  position: DropPosition;
  isDark: boolean;
}

export function DropZoneOverlay({ isActive, position, isDark }: DropZoneOverlayProps) {
  if (!isActive || !position) return null;

  const getPreviewStyle = (): React.CSSProperties => {
    switch (position) {
      case 'left':
        return { left: 0, top: 0, width: '50%', height: '100%' };
      case 'right':
        return { right: 0, top: 0, width: '50%', height: '100%' };
      case 'top':
        return { left: 0, top: 0, width: '100%', height: '50%' };
      case 'bottom':
        return { left: 0, bottom: 0, width: '100%', height: '50%' };
      case 'center':
        return { left: 0, top: 0, width: '100%', height: '100%' };
      default:
        return {};
    }
  };

  return (
    <div className="absolute inset-0 z-50 pointer-events-none">
      {/* Preview highlight */}
      <div
        className={cn(
          'absolute transition-all duration-200 rounded-lg',
          'bg-gray-500/30 border-2 border-gray-400'
        )}
        style={getPreviewStyle()}
      />

      {/* Drop zone indicators */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="grid grid-cols-3 grid-rows-3 w-full h-full gap-1 p-4">
          {/* Top zone */}
          <div className="col-start-2 row-start-1" />

          {/* Left zone */}
          <div className="col-start-1 row-start-2" />

          {/* Center zone */}
          <div className="col-start-2 row-start-2" />

          {/* Right zone */}
          <div className="col-start-3 row-start-2" />

          {/* Bottom zone */}
          <div className="col-start-2 row-start-3" />
        </div>
      </div>
    </div>
  );
}

// Helper to calculate drop position based on mouse coordinates
export function calculateDropPosition(
  containerRect: DOMRect,
  mouseX: number,
  mouseY: number
): DropPosition {
  const relX = mouseX - containerRect.left;
  const relY = mouseY - containerRect.top;
  const { width, height } = containerRect;

  // Define zones (outer 30% = edge zones, center = full replacement)
  const edgeThreshold = 0.3;

  const leftEdge = width * edgeThreshold;
  const rightEdge = width * (1 - edgeThreshold);
  const topEdge = height * edgeThreshold;
  const bottomEdge = height * (1 - edgeThreshold);

  if (relX < leftEdge) return 'left';
  if (relX > rightEdge) return 'right';
  if (relY < topEdge) return 'top';
  if (relY > bottomEdge) return 'bottom';
  return 'center';
}
