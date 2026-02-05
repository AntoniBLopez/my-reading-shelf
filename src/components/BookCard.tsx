import { useState, useEffect } from 'react';
import { Book } from '@/types/library';
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
import { FileText, MoreVertical, Trash2, Check, Clock, BookOpen, Pencil } from 'lucide-react';
import PDFViewer from './PDFViewer';

interface BookCardProps {
  book: Book;
  onToggleRead: (id: string, isRead: boolean) => Promise<boolean>;
  onRename: (id: string, updates: Partial<Pick<Book, 'title'>>) => Promise<boolean>;
  onDelete: (id: string) => Promise<boolean>;
  onProgressUpdate: (id: string, currentPage: number, totalPages: number) => Promise<boolean>;
  getBookUrl: (filePath: string) => Promise<string | null>;
}

export function BookCard({ book, onToggleRead, onRename, onDelete, onProgressUpdate, getBookUrl }: BookCardProps) {
  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const [isRenameOpen, setIsRenameOpen] = useState(false);
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

  const progressPercent = book.total_pages > 0 
    ? Math.round((book.current_page / book.total_pages) * 100) 
    : 0;

  return (
    <>
      <div 
        className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors group cursor-pointer"
        onClick={() => setIsViewerOpen(true)}
      >
        <div className={`p-2 rounded-lg ${book.is_read ? 'bg-success/10' : 'bg-accent/20'}`}>
          <FileText className={`w-4 h-4 ${book.is_read ? 'text-success' : 'text-accent'}`} />
        </div>
        
        <div className="flex-1 min-w-0">
          <p className="font-medium truncate">{book.title}</p>
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
        </div>

        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          {book.is_read ? (
            <Badge variant="outline" className="gap-1 border-success/30 text-success text-xs">
              <Check className="w-3 h-3" />
              Leído
            </Badge>
          ) : (
            <Badge variant="outline" className="gap-1 text-xs">
              <Clock className="w-3 h-3" />
              Pendiente
            </Badge>
          )}

          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={() => setIsViewerOpen(true)}
          >
            <BookOpen className="w-4 h-4" />
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <MoreVertical className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="cursor-pointer">
              <DropdownMenuItem onClick={() => setIsViewerOpen(true)}>
                <BookOpen className="w-4 h-4 mr-2" />
                Leer
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => {
                  setTimeout(() => setIsRenameOpen(true), 0);
                }}
              >
                <Pencil className="w-4 h-4 mr-2" />
                Renombrar
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onToggleRead(book.id, !book.is_read)}>
                {book.is_read ? (
                  <>
                    <Clock className="w-4 h-4 mr-2" />
                    Marcar como pendiente
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4 mr-2" />
                    Marcar como leído
                  </>
                )}
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => onDelete(book.id)}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Eliminar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
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
    </>
  );
}
