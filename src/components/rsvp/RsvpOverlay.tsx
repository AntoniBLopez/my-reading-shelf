import { useEffect, useMemo, useState } from 'react';
import { Loader2, X, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { RsvpPlayer } from '@/components/rsvp/RsvpPlayer';
import { tokenize } from '@/lib/rsvp/tokenize';

interface RsvpOverlayProps {
  pageNumber: number;
  hasNextPage: boolean;
  loadPageText: (pageNumber: number) => Promise<string>;
  onNextPage: () => void;
  onClose: () => void;
}

type LoadState =
  | { status: 'loading' }
  | { status: 'ready'; text: string }
  | { status: 'error' };

export function RsvpLaunchButton({ disabled, onClick }: { disabled?: boolean; onClick: () => void }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8 shrink-0"
          disabled={disabled}
          onClick={onClick}
          aria-label="Lectura rápida"
          title="Lectura rápida"
        >
          <Zap className="h-4 w-4" />
        </Button>
      </TooltipTrigger>
      <TooltipContent className="z-[80]">Lectura rápida</TooltipContent>
    </Tooltip>
  );
}

export function RsvpOverlay({ pageNumber, hasNextPage, loadPageText, onNextPage, onClose }: RsvpOverlayProps) {
  const [state, setState] = useState<LoadState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    setState({ status: 'loading' });
    loadPageText(pageNumber).then(
      (text) => {
        if (!cancelled) setState({ status: 'ready', text });
      },
      () => {
        if (!cancelled) setState({ status: 'error' });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [pageNumber, loadPageText]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      onClose();
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [onClose]);

  const pageText = state.status === 'ready' ? state.text : '';
  const tokens = useMemo(() => (pageText ? tokenize(pageText) : []), [pageText]);

  return (
    <div
      className="absolute inset-0 z-50 flex flex-col bg-background text-foreground"
      role="dialog"
      aria-modal="true"
      aria-label="Lectura rápida"
    >
      <header className="flex items-center justify-between gap-3 border-b px-4 py-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-medium">
            <Zap className="h-4 w-4 text-primary" />
            Lectura rápida
          </p>
          <p className="text-xs text-muted-foreground">Pág. {pageNumber}</p>
        </div>
        <Button variant="ghost" size="icon" className="h-11 w-11 shrink-0" onClick={onClose} aria-label="Cerrar">
          <X className="h-4 w-4" />
        </Button>
      </header>

      {state.status === 'loading' && (
        <div className="flex flex-1 flex-col items-center justify-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Preparando la página…</p>
        </div>
      )}

      {state.status === 'error' && (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
          <p className="text-sm text-destructive">No se pudo leer el texto de esta página.</p>
          <Button variant="outline" onClick={onClose}>Volver</Button>
        </div>
      )}

      {state.status === 'ready' && tokens.length === 0 && (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
          <p className="text-sm text-muted-foreground">Esta página no tiene texto para leer.</p>
          {hasNextPage ? (
            <Button onClick={onNextPage}>Siguiente página</Button>
          ) : (
            <p className="text-sm text-muted-foreground">Has llegado al final del libro</p>
          )}
        </div>
      )}

      {state.status === 'ready' && tokens.length > 0 && (
        <RsvpPlayer
          key={pageNumber}
          tokens={tokens}
          autoPlay
          hasNextPage={hasNextPage}
          onNextPage={onNextPage}
        />
      )}
    </div>
  );
}
