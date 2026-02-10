import { useState, useEffect } from 'react';
import { Book, getBookState, type BookState } from '@/types/library';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { FileText, MoreVertical, Trash2, Check, Clock, Pencil, CheckCheck, BookMarked, GripVertical, RotateCcw } from 'lucide-react';
import PDFViewer from './PDFViewer';

export interface BookCardProps {
  book: Book;
  /** Props para conectar la franja de arrastre con useSortable (drag and drop) */
  dragHandleProps?: { listeners: object; attributes: object };
  onToggleRead: (id: string, isRead: boolean) => Promise<boolean>;
  onSetState: (id: string, state: BookState) => Promise<boolean>;
  onRename: (id: string, updates: Partial<Pick<Book, 'title'>>) => Promise<boolean>;
  onDelete: (id: string) => Promise<boolean>;
  onProgressUpdate: (id: string, currentPage: number, totalPages: number) => Promise<boolean>;
  getBookUrl: (filePath: string) => Promise<string | null>;
}

export function BookCard({ book, dragHandleProps, onToggleRead, onSetState, onRename, onDelete, onProgressUpdate, getBookUrl }: BookCardProps) {
  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const [isRenameOpen, setIsRenameOpen] = useState(false);
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [renameTitle, setRenameTitle] = useState(book.title);

  useEffect(() => {
    if (isRenameOpen) setRenameTitle(book.title);
  }, [isRenameOpen, book.title]);

  const handleRename = async () => {
    const title = renameTitle.trim();
    if (!title) return;
    const success = await onRename(book.id, { title });
    if (success) setIsRenameOpen(false);
  };

  const handleResetToNotStarted = async () => {
    await onSetState(book.id, 'Pendiente');
    setIsResetConfirmOpen(false);
  };

  const state = getBookState(book);

  const progressPercent = book.total_pages > 0 
    ? Math.round((book.current_page / book.total_pages) * 100) 
    : 0;

  return (
    <>
      <div className="flex rounded-lg bg-muted/50 hover:bg-muted transition-colors overflow-hidden">
        {dragHandleProps && (
          <div
            className="flex items-center justify-center shrink-0 w-9 border-r border-border/50 rounded-l-lg bg-muted/80 text-muted-foreground cursor-grab active:cursor-grabbing touch-none"
            aria-label="Arrastrar para ordenar"
            {...dragHandleProps.attributes}
            {...dragHandleProps.listeners}
          >
            <GripVertical className="w-4 h-4" />
          </div>
        )}
        <div
          className="flex items-start gap-3 p-3 flex-1 min-w-0 group cursor-pointer"
          onClick={() => setIsViewerOpen(true)}
        >
          <div
            className={`p-2 rounded-lg shrink-0 ${
              state === 'Leído' ? 'bg-success/10' : state === 'En progreso' ? 'bg-primary/10' : 'bg-muted'
            }`}
          >
            <FileText
              className={`w-4 h-4 ${
                state === 'Leído' ? 'text-success' : state === 'En progreso' ? 'text-primary' : 'text-muted-foreground'
              }`}
            />
          </div>

          <div className="flex-1 min-w-0">
          <Tooltip>
            <TooltipTrigger asChild>
              <p className="font-medium truncate">{book.title}</p>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-[min(90vw,320px)]">
              {book.title}
            </TooltipContent>
          </Tooltip>
          <div className="flex items-center gap-2 mt-1">
            {book.total_pages > 0 ? (
              <>
                <Progress value={progressPercent} className="flex-1 h-1.5 max-w-[100px]" />
                <span className="text-xs text-muted-foreground">
                  {progressPercent}% · Pág. {book.current_page}/{book.total_pages}
                </span>
              </>
            ) : (
              <span className="text-xs text-muted-foreground">{book.file_name}</span>
            )}
          </div>
          <div className="flex items-center gap-1.5 mt-1.5">
            {state === 'Leído' && (
              <Badge variant="outline" className="gap-1 border-success/30 text-success text-xs w-fit">
                <Check className="w-3 h-3" />
                Leído
              </Badge>
            )}
            {state === 'En progreso' && (
              <Badge variant="outline" className="gap-1 border-primary/30 text-primary text-xs w-fit">
                <BookMarked className="w-3 h-3" />
                En progreso
              </Badge>
            )}
            {state === 'Pendiente' && (
              <Badge variant="outline" className="gap-1 text-xs w-fit">
                <Clock className="w-3 h-3" />
                Pendiente
              </Badge>
            )}
          </div>
        </div>

        <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreVertical className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="cursor-pointer">
              <DropdownMenuItem
                onSelect={() => {
                  setTimeout(() => setIsRenameOpen(true), 0);
                }}
              >
                <Pencil className="w-4 h-4 mr-2" />
                Renombrar
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onSetState(book.id, 'Leído')} disabled={state === 'Leído'}>
                <Check className="w-4 h-4 mr-2" />
                Marcar como leído
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => {
                  if (state !== 'Pendiente') setTimeout(() => setIsResetConfirmOpen(true), 0);
                }}
                disabled={state === 'Pendiente'}
              >
                <Clock className="w-4 h-4 mr-2" />
                Marcar como pendiente
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => setTimeout(() => setIsDeleteConfirmOpen(true), 0)}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Eliminar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          </div>
        </div>
      </div>

      <PDFViewer
        book={book}
        isOpen={isViewerOpen}
        onClose={() => setIsViewerOpen(false)}
        onProgressUpdate={onProgressUpdate}
        getBookUrl={getBookUrl}
      />

      <Dialog open={isRenameOpen} onOpenChange={setIsRenameOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-serif">Renombrar libro</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <Input
              value={renameTitle}
              onChange={(e) => setRenameTitle(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleRename()}
              placeholder="Nombre del libro"
            />
            <Button onClick={handleRename} className="w-full" disabled={!renameTitle.trim()}>
              Guardar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isResetConfirmOpen} onOpenChange={setIsResetConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-full bg-primary/10">
                <RotateCcw className="w-5 h-5 text-primary" />
              </div>
              <AlertDialogTitle className="font-serif">¿Reiniciar progreso?</AlertDialogTitle>
            </div>
            <AlertDialogDescription>
              El libro pasará a <strong>página 1</strong> y se marcará como <strong>pendiente</strong>. ¿Continuar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleResetToNotStarted}>
              Reiniciar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
        <AlertDialogContent className="max-h-[85vh] overflow-y-auto">
          <AlertDialogHeader className="w-full">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-full bg-destructive/10 shrink-0">
                <Trash2 className="w-5 h-5 text-destructive" />
              </div>
              <AlertDialogTitle className="font-serif">¿Eliminar libro?</AlertDialogTitle>
            </div>
            <AlertDialogDescription className="w-full">
              Se eliminará <strong>{book.title}</strong>. Podrás deshacer desde la notificación durante unos segundos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:space-x-2 sm:space-y-0">
            <AlertDialogCancel className="m-0 w-full sm:w-auto">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setIsDeleteConfirmOpen(false);
                onDelete(book.id);
              }}
              className="w-full sm:w-auto bg-destructive text-destructive-foreground hover:bg-destructive/90 gap-2"
            >
              <Trash2 className="w-4 h-4" />
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
