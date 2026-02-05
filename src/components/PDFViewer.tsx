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
} from 'lucide-react';
import 'react-pdf/src/Page/AnnotationLayer.css';
import 'react-pdf/src/Page/TextLayer.css';

// Configure PDF.js worker (use https so it works in all contexts)
pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

const MIN_SCALE = 0.1;
const MAX_SCALE = 2;
const SWIPE_THRESHOLD = 60;

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
  const [scale, setScale] = useState<number>(1);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pageWidth, setPageWidth] = useState<number>(600);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const { resolvedTheme, setTheme } = useTheme();
  // Freeze theme when dialog opens so parent re-renders (e.g. after page change) don't cause light/dark flicker
  const [viewerDarkMode, setViewerDarkMode] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const fullscreenRef = useRef<HTMLDivElement>(null);
  const touchStartRef = useRef<{ x: number; y: number; scale: number; distance: number } | null>(null);
  const [zoomInputValue, setZoomInputValue] = useState('');
  const zoomInputRef = useRef<HTMLInputElement>(null);
  const [pageInputValue, setPageInputValue] = useState('');

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

  // React-PDF needs an explicit width for the canvas to render correctly (FAQ: don't rely on CSS alone)
  useEffect(() => {
    if (!isOpen || !containerRef.current) return;
    const el = containerRef.current;
    const ro = new ResizeObserver((entries) => {
      const { width } = entries[0]?.contentRect ?? {};
      if (typeof width === 'number' && width > 0) setPageWidth(width);
    });
    ro.observe(el);
    setPageWidth(el.getBoundingClientRect().width || 600);
    return () => ro.disconnect();
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
    setZoomInputValue(String(Math.round(scale * 100)));
  }, [scale]);

  useEffect(() => {
    syncZoomInputFromScale();
  }, [scale, syncZoomInputFromScale]);

  const getTouchDistance = (touches: TouchList) => {
    if (touches.length < 2) return 0;
    const a = touches[0];
    const b = touches[1];
    return Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY);
  };

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      e.preventDefault();
      touchStartRef.current = {
        x: 0,
        y: 0,
        scale,
        distance: getTouchDistance(e.touches),
      };
    } else if (e.touches.length === 1) {
      touchStartRef.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
        scale,
        distance: 0,
      };
    }
  }, [scale]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2 && touchStartRef.current && touchStartRef.current.distance > 0) {
      e.preventDefault();
      const newDist = getTouchDistance(e.touches);
      const ratio = newDist / touchStartRef.current.distance;
      const newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, touchStartRef.current.scale * ratio));
      setScale(newScale);
      touchStartRef.current = { ...touchStartRef.current, scale: newScale, distance: newDist };
    }
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 0) {
      const start = touchStartRef.current;
      touchStartRef.current = null;
      if (start && start.distance === 0 && e.changedTouches[0]) {
        const end = e.changedTouches[0];
        const dx = end.clientX - start.x;
        const dy = end.clientY - start.y;
        if (Math.abs(dx) > SWIPE_THRESHOLD && Math.abs(dx) > Math.abs(dy)) {
          if (dx < 0) goToPage(pageNumber + 1);
          else goToPage(pageNumber - 1);
        }
      }
    } else if (e.touches.length === 2) {
      touchStartRef.current = {
        x: 0,
        y: 0,
        scale,
        distance: getTouchDistance(e.touches),
      };
    }
  }, [goToPage, pageNumber, scale]);

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
    try {
      if (!document.fullscreenElement) {
        await el.requestFullscreen();
        setIsFullscreen(true);
      } else {
        await document.exitFullscreen();
        setIsFullscreen(false);
      }
    } catch {
      setIsFullscreen(false);
    }
  }, []);

  useEffect(() => {
    const onFullscreenChange = () => {
      if (!document.fullscreenElement) setIsFullscreen(false);
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-4xl h-[90vh] flex flex-col p-0" hideCloseButton>
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

        {/* Área de pantalla completa: toolbar + contenido (zoom y páginas disponibles en fullscreen) */}
        <div ref={fullscreenRef} className="flex-1 flex flex-col min-h-0 min-w-0">
          {/* Toolbar */}
          <div className="flex items-center justify-between px-4 py-2 border-b bg-background shrink-0">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => goToPage(pageNumber - 1)}
                disabled={pageNumber <= 1}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <div className="flex items-center gap-1 min-w-[100px] justify-center">
                <span className="text-sm text-muted-foreground">Página</span>
                <Input
                  type="text"
                  inputMode="numeric"
                  className="w-12 h-8 text-center text-sm px-1"
                  value={pageInputValue}
                  onChange={(e) => setPageInputValue(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  onBlur={applyPageFromInput}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') applyPageFromInput();
                  }}
                  title="Escribe el número de página y pulsa Enter"
                />
                <span className="text-sm text-muted-foreground">de {numPages || '...'}</span>
              </div>
              <Button
                variant="outline"
                size="icon"
                onClick={() => goToPage(pageNumber + 1)}
                disabled={pageNumber >= numPages}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={toggleFullscreen}
                title={isFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa (enfoque)'}
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
                onClick={() => setTheme(viewerDarkMode ? 'light' : 'dark')}
                title={viewerDarkMode ? 'Modo claro' : 'Modo oscuro'}
              >
                {viewerDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setScaleClamped(s => s - 0.1)}
                disabled={scale <= MIN_SCALE}
              >
                <ZoomOut className="w-4 h-4" />
              </Button>
              <Input
                ref={zoomInputRef}
                type="text"
                inputMode="numeric"
                className="w-14 h-8 text-center text-sm px-1"
                value={zoomInputValue}
                onChange={(e) => setZoomInputValue(e.target.value.replace(/\D/g, '').slice(0, 4))}
                onBlur={applyZoomFromInput}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') applyZoomFromInput();
                }}
                title="Haz clic y escribe el porcentaje de zoom (10–200). ALT + scroll también cambia el zoom."
              />
              <span className="text-sm text-muted-foreground">%</span>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setScaleClamped(s => s + 0.1)}
                disabled={scale >= MAX_SCALE}
              >
                <ZoomIn className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* PDF Content */}
          <div className={`relative flex-1 overflow-auto min-w-0 flex flex-col ${viewerDarkMode ? 'bg-neutral-900' : 'bg-muted/30'}`}>
            {isFullscreen && (
              <Button
                variant="secondary"
                size="sm"
                className="absolute top-2 right-2 z-10 shadow-lg"
                onClick={toggleFullscreen}
              >
                <Minimize2 className="w-4 h-4 mr-1" />
                Salir de pantalla completa
              </Button>
            )}
            <div
              ref={containerRef}
              className={`flex-1 overflow-auto flex items-start justify-center p-4 min-w-0 touch-manipulation ${viewerDarkMode ? 'bg-black' : ''}`}
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
                <div className={`flex flex-col items-center justify-center h-full min-h-[200px] gap-3 w-full ${viewerDarkMode ? 'bg-black text-neutral-200' : ''}`}>
                  <Loader2 className={`w-8 h-8 animate-spin ${viewerDarkMode ? 'text-neutral-300' : 'text-primary'}`} />
                  <p className={viewerDarkMode ? 'text-neutral-400' : 'text-muted-foreground'}>Cargando PDF...</p>
                </div>
              )}

              {error && (
                <div className={`flex flex-col items-center justify-center h-full gap-3 ${viewerDarkMode ? 'bg-black' : ''}`}>
                  <p className="text-destructive">{error}</p>
                  <Button variant="outline" onClick={handleClose}>Cerrar</Button>
                </div>
              )}

              {pdfUrl && !error && (
                <div
                  className={`min-h-full w-full flex items-start justify-center ${viewerDarkMode ? 'bg-[#000000]' : 'bg-white'}`}
                >
                  <Document
                    file={pdfUrl}
                    onLoadSuccess={onDocumentLoadSuccess}
                    onLoadError={onDocumentLoadError}
                    onItemClick={onInternalLinkClick}
                    loading={null}
                    className={`shadow-lg ${viewerDarkMode ? 'pdf-viewer-dark' : ''}`}
                  >
                    <Page
                      pageNumber={pageNumber}
                      width={pageWidth}
                      scale={scale}
                      loading={null}
                      className={viewerDarkMode ? 'pdf-viewer-dark-page [&_canvas]:invert [&_.react-pdf__Page__textContent]:invert [&_.react-pdf__Page__annotations]:invert' : 'bg-white'}
                      renderTextLayer={true}
                      renderAnnotationLayer={true}
                    />
                  </Document>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer with page info */}
        <div className="px-4 py-2 border-t bg-muted/50 text-center text-sm text-muted-foreground">
          {pageNumber === numPages && numPages > 0 ? (
            <span className="text-success font-medium">🎉 ¡Has llegado al final!</span>
          ) : (
            <span>Te quedan {numPages - pageNumber} páginas</span>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
