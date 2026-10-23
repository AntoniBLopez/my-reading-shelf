import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type ExpandMoreButtonProps = React.ComponentProps<typeof Button>;

/** "Mostrar más" / "Minimizar". Hover and the tap wave come from the shared button styles. */
export function ExpandMoreButton({ className, children, ...props }: ExpandMoreButtonProps) {
  return (
    <Button
      variant="ghost"
      size="sm"
      className={cn('gap-1.5 text-muted-foreground hover:text-foreground', className)}
      {...props}
    >
      {children}
    </Button>
  );
}
