import { useState, useCallback, useEffect, useRef } from 'react';
import { useTheme } from 'next-themes';
import { Document, Page, pdfjs } from 'react-pdf';
import { Book } from '@/types/library';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  ChevronLeft,
  ChevronRight,
  X,
  ZoomIn,
  ZoomOut,
  BookOpen,
  Loader2,
  Maximize2,
  Minimize2,
  Moon,
  Sun,
  Square,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import 'react-pdf/src/Page/AnnotationLayer.css';
import 'react-pdf/src/Page/TextLayer.css';

// Configure PDF.js worker (use https so it works in all contexts)
const pdfjsBase = `https://unpkg.com/pdfjs-dist@${pdfjs.version}`;
pdfjs.GlobalWorkerOptions.workerSrc = `${pdfjsBase}/build/pdf.worker.min.mjs`;

// Enable JPEG2000 (JPX) decoding: worker must load openjpeg.wasm from the same origin/CDN
const pdfDocOptions = {
  useWorkerFetch: true,
  wasmUrl: `${pdfjsBase}/wasm/`,
  iccUrl: `${pdfjsBase}/iccs/`,
};

const MIN_SCALE = 0.1;
const MAX_SCALE = 2;
const SWIPE_THRESHOLD = 60;
const DOUBLE_TAP_MS = 500;
const MAX_TAP_DURATION_MS = 250;
/** Snap page width to this grid so layout jitter at 70% zoom doesn't trigger re-renders */
const PAGE_WIDTH_SNAP_PX = 64;

interface PDFViewerProps {
  book: Book;
  isOpen: boolean;
  onClose: () => void;
  onProgressUpdate: (id: string, currentPage: number, totalPages: number) => Promise<boolean>;
  getBookUrl: (filePath: string) => Promise<string | null>;
}

export default function PDFViewer({ book, isOpen, onClose, onProgressUpdate, getBookUrl }: PDFViewerProps) {
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState<number>(book.current_page || 1);
  const [scale, setScale] = useState<number>(0.7);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pageWidth, setPageWidth] = useState<number>(600);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fullscreenHeaderVisible, setFullscreenHeaderVisible] = useState(true);
  const [showFullscreenHint, setShowFullscreenHint] = useState(false);
  const [isMobileOrTablet, setIsMobileOrTablet] = useState(false);
  const { resolvedTheme, setTheme } = useTheme();
  // Freeze theme when dialog opens so parent re-renders (e.g. after page change) don't cause light/dark flicker
  const [viewerDarkMode, setViewerDarkMode] = useState(false);
  const [showBookBorder, setShowBookBorder] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const fullscreenRef = useRef<HTMLDivElement>(null);
  const touchStartRef = useRef<{ x: number; y: number; scale: number; distance: number; touchedAt?: number } | null>(null);
  const lastTapTimeRef = useRef<number>(0);
  const fullscreenHintTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scaleRef = useRef<number>(0.7);
  const pinchRafRef = useRef<number | null>(null);
  const pendingScaleRef = useRef<number | null>(null);
  const isPinchingRef = useRef(false);
  const [zoomInputValue, setZoomInputValue] = useState('');
  const zoomInputRef = useRef<HTMLInputElement>(null);
  const [pageInputValue, setPageInputValue] = useState('');
  const lastPageWidthRef = useRef<number>(600);
  const resizeRafRef = useRef<number | null>(null);

  scaleRef.current = scale;

  useEffect(() => {
    const mq = typeof window !== 'undefined' ? window.matchMedia('(max-width: 1023px)') : null;
    if (!mq) return;
    const onChange = () => setIsMobileOrTablet(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    if (isFullscreen) {
      setFullscreenHeaderVisible(true);
      setShowFullscreenHint(true);
      if (fullscreenHintTimeoutRef.current) clearTimeout(fullscreenHintTimeoutRef.current);
      fullscreenHintTimeoutRef.current = setTimeout(() => {
        setShowFullscreenHint(false);
        fullscreenHintTimeoutRef.current = null;
      }, 3000);
    } else {
      setShowFullscreenHint(false);
      if (fullscreenHintTimeoutRef.current) {
        clearTimeout(fullscreenHintTimeoutRef.current);
        fullscreenHintTimeoutRef.current = null;
      }
      setFullscreenHeaderVisible(true);
    }
    return () => {
      if (fullscreenHintTimeoutRef.current) clearTimeout(fullscreenHintTimeoutRef.current);
    };
  }, [isFullscreen]);

  // Reset URL when dialog closes so next open shows loading for the (possibly new) book
  useEffect(() => {
    if (!isOpen) {
      setPdfUrl(null);
      setError(null);
    }
  }, [isOpen]);

  // Suppress known JPEG2000 warning while viewer is open (OpenJPEG not bundled; PDF still renders)
  useEffect(() => {
    if (!isOpen) return;
    const orig = console.warn;
    console.warn = (...args: unknown[]) => {
      const msg = typeof args[0] === 'string' ? args[0] : String(args[0] ?? '');
      if (msg.includes('JpxError') || msg.includes('OpenJPEG')) return;
      orig.apply(console, args);
    };
    return () => { console.warn = orig; };
  }, [isOpen]);

  // React-PDF needs an explicit width for the canvas to render correctly (FAQ: don't rely on CSS alone).
  // Only update when width changes meaningfully and throttle to one update per frame to avoid flicker.
  useEffect(() => {
    if (!isOpen || !containerRef.current) return;
    const el = containerRef.current;
    const ro = new ResizeObserver((entries) => {
      const { width } = entries[0]?.contentRect ?? {};
      if (typeof width !== 'number' || width <= 0) return;
      if (resizeRafRef.current !== null) cancelAnimationFrame(resizeRafRef.current);
      resizeRafRef.current = requestAnimationFrame(() => {
        resizeRafRef.current = null;
        const snapped = Math.round(width / PAGE_WIDTH_SNAP_PX) * PAGE_WIDTH_SNAP_PX;
        const clamped = Math.max(PAGE_WIDTH_SNAP_PX, snapped);
        if (clamped !== lastPageWidthRef.current) {
          lastPageWidthRef.current = clamped;
          setPageWidth(clamped);
        }
      });
    });
    ro.observe(el);
    const rawInitial = el.getBoundingClientRect().width || 600;
    const initial = Math.max(PAGE_WIDTH_SNAP_PX, Math.round(rawInitial / PAGE_WIDTH_SNAP_PX) * PAGE_WIDTH_SNAP_PX);
    lastPageWidthRef.current = initial;
    setPageWidth(initial);
    return () => {
      if (resizeRafRef.current !== null) cancelAnimationFrame(resizeRafRef.current);
      ro.disconnect();
    };
  }, [isOpen, pdfUrl]);

  // Load PDF URL on open (works for both Supabase signed URL and local blob URL).
  // Only show loading when we don't have a URL yet (initial load), not when effect re-runs e.g. after page change.
  useEffect(() => {
    if (isOpen && book.file_path) {
      if (!pdfUrl) setLoading(true);
      setError(null);
      getBookUrl(book.file_path)
        .then((url) => {
          if (url) setPdfUrl(url);
          else {
            setError('No se pudo cargar el PDF');
            setLoading(false);
          }
        })
        .catch(() => {
          setError('No se pudo cargar el PDF');
          setLoading(false);
        });
    }
  }, [isOpen, book.file_path, getBookUrl]);

  // Restore last read position only when dialog opens (not on every book.current_page update, to avoid jump when user clicks next/prev)
  useEffect(() => {
    if (!isOpen) return;
    if (book.current_page > 0) {
      setPageNumber(book.current_page);
    } else {
      setPageNumber(1);
    }
  }, [isOpen]);

  // Freeze theme for the viewer when dialog opens so re-renders don't cause light/dark flicker
  useEffect(() => {
    if (isOpen && (resolvedTheme === 'dark' || resolvedTheme === 'light')) {
      setViewerDarkMode(resolvedTheme === 'dark');
    }
  }, [isOpen, resolvedTheme]);

  // Sync page input with current page number
  useEffect(() => {
    setPageInputValue(String(pageNumber));
  }, [pageNumber]);

  const onDocumentLoadSuccess = useCallback(({ numPages: total }: { numPages: number }) => {
    setNumPages(total);
    setLoading(false);

    // Update total pages if changed
    if (total !== book.total_pages) {
      onProgressUpdate(book.id, book.current_page || 1, total);
    }
  }, [book.id, book.total_pages, book.current_page, onProgressUpdate]);

  const onDocumentLoadError = useCallback((error: Error) => {
    console.error('PDF load error:', error);
    setError('Error al cargar el PDF');
    setLoading(false);
  }, []);

  const onInternalLinkClick = useCallback(
    ({ pageNumber: targetPage }: { pageNumber: number }) => {
      const p = Math.max(1, Math.min(targetPage, numPages || targetPage));
      setPageNumber(p);
    },
    [numPages]
  );

  const goToPage = useCallback((page: number) => {
    const newPage = Math.max(1, Math.min(page, numPages));
    setPageNumber(newPage);
    // Progress is saved on close (handleClose) to avoid parent re-renders and page/theme jump
  }, [numPages]);

  const applyPageFromInput = useCallback(() => {
    const n = parseInt(pageInputValue, 10);
    if (!isNaN(n) && numPages > 0) {
      goToPage(Math.max(1, Math.min(n, numPages)));
    } else {
      setPageInputValue(String(pageNumber));
    }
  }, [pageInputValue, numPages, pageNumber, goToPage]);

  const setScaleClamped = useCallback((updater: (s: number) => number) => {
    setScale(s => Math.max(MIN_SCALE, Math.min(MAX_SCALE, updater(s))));
  }, []);

  const applyZoomFromInput = useCallback(() => {
    const n = parseInt(zoomInputValue.replace(/%/g, ''), 10);
    if (!isNaN(n)) {
      const newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, n / 100));
      setScale(newScale);
      setZoomInputValue(String(Math.round(newScale * 100)));
    } else {
      setZoomInputValue(String(Math.round(scale * 100)));
    }
    zoomInputRef.current?.blur();
  }, [zoomInputValue, scale]);

  const syncZoomInputFromScale = useCallback(() => {
    if (isPinchingRef.current) return;
    setZoomInputValue(String(Math.round(scale * 100)));
  }, [scale]);

  useEffect(() => {
    syncZoomInputFromScale();
  }, [scale, syncZoomInputFromScale]);

  const getTouchDistance = (touches: React.TouchEvent['touches']) => {
    if (touches.length < 2) return 0;
    const a = touches[0];
    const b = touches[1];
    return Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY);
  };

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      e.preventDefault();
      isPinchingRef.current = true;
      const dist = getTouchDistance(e.touches);
      touchStartRef.current = {
        x: 0,
        y: 0,
        scale: scaleRef.current,
        distance: dist > 0 ? dist : 1,
      };
    } else if (e.touches.length === 1) {
      isPinchingRef.current = false;
      touchStartRef.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
        scale: scaleRef.current,
        distance: 0,
        touchedAt: Date.now(),
      };
    }
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2 && touchStartRef.current && touchStartRef.current.distance > 0) {
      e.preventDefault();
      const newDist = getTouchDistance(e.touches);
      if (newDist < 1) return;
      const ratio = newDist / touchStartRef.current.distance;
      const newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, touchStartRef.current.scale * ratio));
      pendingScaleRef.current = newScale;
      if (pinchRafRef.current === null) {
        pinchRafRef.current = requestAnimationFrame(() => {
          pinchRafRef.current = null;
          if (pendingScaleRef.current !== null) {
            setScale(pendingScaleRef.current);
            pendingScaleRef.current = null;
          }
        });
      }
    }
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 0) {
      const start = touchStartRef.current;
      touchStartRef.current = null;
      isPinchingRef.current = false;
      if (pinchRafRef.current !== null) {
        cancelAnimationFrame(pinchRafRef.current);
        pinchRafRef.current = null;
      }
      if (pendingScaleRef.current !== null) {
        setScale(pendingScaleRef.current);
        pendingScaleRef.current = null;
      }
      if (start && start.distance === 0 && e.changedTouches[0]) {
        const end = e.changedTouches[0];
        const dx = end.clientX - start.x;
        const dy = end.clientY - start.y;
        const isHorizontalSwipe = Math.abs(dx) > SWIPE_THRESHOLD && Math.abs(dx) > Math.abs(dy);
        if (isHorizontalSwipe) {
          if (dx < 0) goToPage(pageNumber + 1);
          else goToPage(pageNumber - 1);
        } else if (isFullscreen) {
          const now = Date.now();
          const touchDuration = start.touchedAt != null ? now - start.touchedAt : Infinity;
          const wasQuickTap = touchDuration < MAX_TAP_DURATION_MS;
          if (wasQuickTap && lastTapTimeRef.current > 0 && now - lastTapTimeRef.current < DOUBLE_TAP_MS) {
            lastTapTimeRef.current = 0;
            setFullscreenHeaderVisible(v => !v);
          } else if (wasQuickTap) {
            lastTapTimeRef.current = now;
          }
        }
      }
    } else if (e.touches.length === 2) {
      const dist = getTouchDistance(e.touches);
      touchStartRef.current = {
        x: 0,
        y: 0,
        scale: scaleRef.current,
        distance: dist > 0 ? dist : 1,
      };
    }
  }, [goToPage, pageNumber, isFullscreen]);

  const handleMouseDown = useCallback(() => {
    if (!isFullscreen) return;
    const now = Date.now();
    if (lastTapTimeRef.current > 0 && now - lastTapTimeRef.current < DOUBLE_TAP_MS) {
      lastTapTimeRef.current = 0;
      setFullscreenHeaderVisible(v => !v);
    } else {
      lastTapTimeRef.current = now;
    }
  }, [isFullscreen]);

  // Navegación con flechas del teclado
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('input') || target.closest('textarea') || target.isContentEditable) return;
      if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
        e.preventDefault();
        goToPage(pageNumber - 1);
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
        e.preventDefault();
        goToPage(pageNumber + 1);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, pageNumber, goToPage]);

  // Touch listeners with passive: false so preventDefault() works for pinch (evita zoom del navegador)
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && touchStartRef.current?.distance) {
        e.preventDefault();
      }
    };
    el.addEventListener('touchmove', onMove, { passive: false });
    return () => el.removeEventListener('touchmove', onMove);
  }, []);

  const handleClose = useCallback(() => {
    // Save final progress before closing
    if (numPages > 0) {
      onProgressUpdate(book.id, pageNumber, numPages);
    }
    onClose();
  }, [book.id, pageNumber, numPages, onProgressUpdate, onClose]);

  const progressPercent = numPages > 0 ? Math.round((pageNumber / numPages) * 100) : 0;

  const toggleFullscreen = useCallback(async () => {
    const el = fullscreenRef.current;
    if (!el) return;
    const doc = document as Document & { webkitFullscreenElement?: Element; webkitExitFullscreen?: () => Promise<void> };
    const elAny = el as HTMLDivElement & { webkitRequestFullscreen?: () => Promise<void> };
    const inNativeFullscreen = !!(document.fullscreenElement ?? doc.webkitFullscreenElement);
    // En tablet/mobile no usar la Fullscreen API para evitar el gesto nativo "swipe down to exit" al hacer scroll
    const isMobileOrTablet = typeof window !== 'undefined' && window.matchMedia('(max-width: 1023px)').matches;

    if (inNativeFullscreen || isFullscreen) {
      if (inNativeFullscreen) {
        try {
          if (document.exitFullscreen) await document.exitFullscreen();
          else if (doc.webkitExitFullscreen) await doc.webkitExitFullscreen();
        } catch { /* ignore */ }
      }
      setIsFullscreen(false);
      return;
    }

    if (isMobileOrTablet) {
      setIsFullscreen(true);
      return;
    }

    try {
      if (el.requestFullscreen) {
        await el.requestFullscreen();
        setIsFullscreen(true);
      } else if (elAny.webkitRequestFullscreen) {
        await elAny.webkitRequestFullscreen();
        setIsFullscreen(true);
      } else {
        setIsFullscreen(true);
      }
    } catch {
      setIsFullscreen(true);
    }
  }, [isFullscreen]);

  useEffect(() => {
    const onFullscreenChange = () => {
      const doc = document as Document & { webkitFullscreenElement?: Element };
      if (!document.fullscreenElement && !doc.webkitFullscreenElement) setIsFullscreen(false);
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    document.addEventListener('webkitfullscreenchange', onFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', onFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', onFullscreenChange);
    };
  }, []);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent
        className={cn(
          'flex flex-col p-0',
          isFullscreen
            ? 'fixed inset-0 w-[100vw] h-[100dvh] max-w-none rounded-none z-[100] border-0 translate-x-0 translate-y-0 left-0 top-0 right-0 bottom-0'
            : 'max-w-4xl h-[90vh]'
        )}
        hideCloseButton
      >
        {!isFullscreen && (
        <DialogHeader className="px-4 py-3 border-b bg-muted/50">
          <div className="flex items-center justify-between">
            <DialogTitle className="font-serif flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-primary" />
              {book.title}
            </DialogTitle>
            <Button variant="ghost" size="icon" onClick={handleClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>

          {/* Progress bar */}
          <div className="flex items-center gap-3 mt-2">
            <Progress value={progressPercent} className="flex-1 h-2" />
            <span className="text-sm font-medium text-primary">{progressPercent}%</span>
          </div>
        </DialogHeader>
        )}

        {/* Área de pantalla completa: toolbar + contenido (zoom y páginas disponibles en fullscreen) */}
        <div ref={fullscreenRef} className="flex-1 flex flex-col min-h-0 min-w-0 relative">
          {isFullscreen && showFullscreenHint && (
            <div className="absolute top-[40px] left-0 right-0 z-10 flex justify-center pt-3 pb-2 px-4 pointer-events-none">
              <p className="text-xs sm:text-sm text-center text-foreground/90 bg-background/95 backdrop-blur rounded-lg px-3 py-2 shadow-md border border-border/50">
                {isMobileOrTablet
                  ? 'Haz doble toque para ocultar/mostrar la barra'
                  : 'Haz doble clic para ocultar/mostrar la barra'}
              </p>
            </div>
          )}
          {/* Toolbar: responsive — wraps to 2 rows on small screens so all controls fit; en fullscreen se puede ocultar con doble toque en tablet/móvil */}
          {(!isFullscreen || fullscreenHeaderVisible) && (
          <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-2 px-2 sm:px-4 py-2 border-b bg-background shrink-0 min-w-0">
            {/* Pagination */}
            <div className="flex items-center gap-1 sm:gap-2 min-w-0 shrink-0">
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={() => goToPage(pageNumber - 1)}
                disabled={pageNumber <= 1}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <div className="flex items-center gap-0.5 sm:gap-1 min-w-0 justify-center">
                <span className="hidden sm:inline text-xs sm:text-sm text-muted-foreground shrink-0">Pág</span>
                <Input
                  type="text"
                  inputMode="numeric"
                  className="w-9 sm:w-12 h-8 text-center text-sm px-0.5 shrink-0"
                  value={pageInputValue}
                  onChange={(e) => setPageInputValue(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  onBlur={applyPageFromInput}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') applyPageFromInput();
                  }}
                  title="Número de página"
                />
                <span className="text-xs sm:text-sm text-muted-foreground shrink-0 whitespace-nowrap">/ {numPages || '…'}</span>
              </div>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={() => goToPage(pageNumber + 1)}
                disabled={pageNumber >= numPages}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>

            {/* Fullscreen, theme, zoom — wraps on very narrow screens */}
            <div className="flex flex-wrap items-center gap-1 sm:gap-2 min-w-0 shrink-0 justify-end">
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={toggleFullscreen}
                title={isFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}
              >
                {isFullscreen ? (
                  <Minimize2 className="w-4 h-4" />
                ) : (
                  <Maximize2 className="w-4 h-4" />
                )}
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={() => setShowBookBorder(b => !b)}
                title={showBookBorder ? 'Ocultar borde del libro' : 'Mostrar borde del libro'}
              >
                <Square className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={() => {
                  const nextDark = !viewerDarkMode;
                  setViewerDarkMode(nextDark);
                  setTheme(nextDark ? 'dark' : 'light');
                }}
                title={viewerDarkMode ? 'Modo claro' : 'Modo oscuro'}
              >
                {viewerDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={() => setScaleClamped(s => s - 0.1)}
                disabled={scale <= MIN_SCALE}
                title="Menos zoom"
              >
                <ZoomOut className="w-4 h-4" />
              </Button>
              <Input
                ref={zoomInputRef}
                type="text"
                inputMode="numeric"
                className="w-10 sm:w-14 h-8 text-center text-sm px-0.5 shrink-0"
                value={zoomInputValue}
                onChange={(e) => setZoomInputValue(e.target.value.replace(/\D/g, '').slice(0, 4))}
                onBlur={applyZoomFromInput}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') applyZoomFromInput();
                }}
                title="Zoom %"
              />
              <span className="text-xs sm:text-sm text-muted-foreground shrink-0">%</span>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={() => setScaleClamped(s => s + 0.1)}
                disabled={scale >= MAX_SCALE}
                title="Más zoom"
              >
                <ZoomIn className="w-4 h-4" />
              </Button>
            </div>
          </div>
          )}

          {/* PDF Content: contenedor con scroll; el hijo crece con el PDF para poder scroll hasta arriba/abajo */}
          <div
            className={`relative flex-1 overflow-auto min-w-0 min-h-0 ${viewerDarkMode ? 'bg-black' : 'bg-white'}`}
            onMouseDown={handleMouseDown}
          >
            <div
              ref={containerRef}
              className={`relative min-h-full min-w-full shrink-0 flex items-center justify-center p-4 touch-manipulation ${viewerDarkMode ? 'bg-black' : 'bg-white'}`}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              onWheel={(e) => {
                if (e.altKey) {
                  e.preventDefault();
                  const delta = -Math.sign(e.deltaY) * 0.05;
                  setScaleClamped(s => s + delta);
                }
              }}
            >
              {loading && (
                <div className={`absolute inset-0 flex flex-col items-center justify-center gap-3 ${viewerDarkMode ? 'bg-black text-neutral-200' : 'bg-white'}`}>
                  <Loader2 className={`w-8 h-8 animate-spin ${viewerDarkMode ? 'text-neutral-300' : 'text-primary'}`} />
                  <p className={viewerDarkMode ? 'text-neutral-400' : 'text-muted-foreground'}>Cargando PDF...</p>
                </div>
              )}

              {error && (
                <div className={`flex flex-col items-center justify-center h-full gap-3 ${viewerDarkMode ? 'bg-black' : 'bg-white'}`}>
                  <p className="text-destructive">{error}</p>
                  <Button variant="outline" onClick={handleClose}>Cerrar</Button>
                </div>
              )}

              {pdfUrl && !error && (
                <div
                  className={cn(
                    'min-h-full w-full flex items-center justify-center',
                    viewerDarkMode ? 'pdf-viewer-dark-wrapper' : 'bg-white'
                  )}
                >
                  <Document
                    file={pdfUrl}
                    options={pdfDocOptions}
                    onLoadSuccess={onDocumentLoadSuccess}
                    onLoadError={onDocumentLoadError}
                    onItemClick={onInternalLinkClick}
                    loading={null}
                    className={cn('shadow-lg', showBookBorder && 'border border-border')}
                  >
                    <Page
                      pageNumber={pageNumber}
                      width={pageWidth}
                      scale={scale}
                      loading={null}
                      className="bg-white"
                      renderTextLayer={true}
                      renderAnnotationLayer={true}
                    />
                  </Document>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer with page info — hidden in fullscreen to maximize PDF area */}
        {!isFullscreen && (
        <div className="px-4 py-2 border-t bg-muted/50 text-center text-sm text-muted-foreground">
          {pageNumber === numPages && numPages > 0 ? (
            <span className="text-success font-medium">🎉 ¡Has llegado al final!</span>
          ) : (
            <span>Te quedan {numPages - pageNumber} páginas</span>
          )}
        </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
