import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ExpandMoreButtonProps extends React.ComponentProps<typeof Button> {}

/**
 * Botón "Mostrar más" / "Minimizar" con ripple en táctil y sin hover en tablet/mobile.
 * Usar clase expand-more-btn (ya aplicada) para que en @media (hover: none) no quede el hover fijo.
 */
export function ExpandMoreButton({ className, onPointerDown, children, ...props }: ExpandMoreButtonProps) {
  const [ripple, setRipple] = useState<{ x: number; y: number } | null>(null);

  const handlePointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    const el = e.currentTarget;
    if (el && (e.pointerType === 'touch' || e.pointerType === 'mouse')) {
      const rect = el.getBoundingClientRect();
      setRipple({ x: e.clientX - rect.left, y: e.clientY - rect.top });
      setTimeout(() => setRipple(null), 600);
    }
    onPointerDown?.(e);
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      className={cn('relative overflow-hidden expand-more-btn gap-1.5 text-muted-foreground hover:text-foreground', className)}
      onPointerDown={handlePointerDown}
      {...props}
    >
      {ripple && (
        <span
          className="bottom-nav-ripple"
          style={{ left: ripple.x, top: ripple.y }}
        />
      )}
      {children}
    </Button>
  );
}
