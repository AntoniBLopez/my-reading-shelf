import { useState } from 'react';
import { Folder, Book, BookState } from '@/types/library';
import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
} from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
  DialogTrigger,
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  FolderOpen,
  MoreVertical,
  Edit2,
  Trash2,
  Upload,
  BookOpen,
  BookCheck,
  Loader2,
  X,
  Tag,
} from 'lucide-react';
import { BookCard } from './BookCard';

interface FolderCardProps {
  folder: Folder;
  books: Book[];
  /** Si true, la card no tiene borde/redondeo izquierdo (para unir con handle de arrastre) */
  leftAttached?: boolean;
  onUpdate: (id: string, updates: Partial<Pick<Folder, 'name' | 'description'>>) => Promise<boolean>;
  onDelete: (id: string) => Promise<boolean>;
  onUploadBook: (folderId: string, file: File, title: string) => Promise<Book | null>;
  onToggleBookRead: (id: string, isRead: boolean) => Promise<boolean>;
  onSetBookState: (id: string, state: BookState) => Promise<boolean>;
  onRenameBook: (id: string, updates: Partial<Pick<Book, 'title'>>) => Promise<boolean>;
  onDeleteBook: (id: string) => Promise<boolean>;
  onProgressUpdate: (id: string, currentPage: number, totalPages: number) => Promise<boolean>;
  getBookUrl: (filePath: string) => Promise<string | null>;
  onReorderBooks?: (folderId: string, fromIndex: number, toIndex: number) => void;
  /** Abre el diálogo de nueva categoría (desde el menú de la carpeta) */
  onOpenCreateCategory?: () => void;
}

function SortableBookCard({
  book,
  onToggleBookRead,
  onSetBookState,
  onRenameBook,
  onDeleteBook,
  onProgressUpdate,
  getBookUrl,
}: {
  book: Book;
  onToggleBookRead: (id: string, isRead: boolean) => Promise<boolean>;
  onSetBookState: (id: string, state: BookState) => Promise<boolean>;
  onRenameBook: (id: string, updates: Partial<Pick<Book, 'title'>>) => Promise<boolean>;
  onDeleteBook: (id: string) => Promise<boolean>;
  onProgressUpdate: (id: string, currentPage: number, totalPages: number) => Promise<boolean>;
  getBookUrl: (filePath: string) => Promise<string | null>;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `book-${book.id}`,
  });
  const style = { transform: CSS.Transform.toString(transform), transition };
  return (
    <div ref={setNodeRef} style={style} className={isDragging ? 'opacity-50' : ''}>
      <BookCard
        book={book}
        dragHandleProps={{ listeners, attributes: attributes as object }}
        onToggleRead={onToggleBookRead}
        onSetState={onSetBookState}
        onRename={onRenameBook}
        onDelete={onDeleteBook}
        onProgressUpdate={onProgressUpdate}
        getBookUrl={getBookUrl}
      />
    </div>
  );
}

export function FolderCard({
  folder,
  books,
  leftAttached,
  onUpdate,
  onDelete,
  onUploadBook,
  onToggleBookRead,
  onSetBookState,
  onRenameBook,
  onDeleteBook,
  onProgressUpdate,
  getBookUrl,
  onReorderBooks,
  onOpenCreateCategory,
}: FolderCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [editName, setEditName] = useState(folder.name);
  const [editDescription, setEditDescription] = useState(folder.description || '');
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 });

  const readCount = books.filter(b => b.is_read).length;
  const totalCount = books.length;

  const bookSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const handleBookDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!onReorderBooks || !over || active.id === over.id) return;
    const fromIndex = books.findIndex(b => `book-${b.id}` === active.id);
    const toIndex = books.findIndex(b => `book-${b.id}` === over.id);
    if (fromIndex === -1 || toIndex === -1) return;
    onReorderBooks(folder.id, fromIndex, toIndex);
  };

  const handleEdit = async () => {
    const success = await onUpdate(folder.id, {
      name: editName,
      description: editDescription || null,
    });
    if (success) {
      setIsEditOpen(false);
    }
  };

  const formatBookTitle = (fileName: string) => {
    const withoutExt = fileName.replace(/\.pdf$/i, '');
    return withoutExt
      .replace(/_/g, ' ')
      .replace(/\s*-\s*/g, ' - ')
      .trim();
  };

  const handleUpload = async () => {
    if (uploadFiles.length === 0) return;
    setUploading(true);
    setUploadProgress({ current: 0, total: uploadFiles.length });
    let done = 0;
    for (const file of uploadFiles) {
      const title = formatBookTitle(file.name);
      await onUploadBook(folder.id, file, title);
      done += 1;
      setUploadProgress({ current: done, total: uploadFiles.length });
    }
    setUploading(false);
    setUploadProgress({ current: 0, total: 0 });
    setIsUploadOpen(false);
    setUploadFiles([]);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files?.length) {
      const pdfs = Array.from(files).filter(f => f.name.toLowerCase().endsWith('.pdf'));
      setUploadFiles(pdfs);
    }
    e.target.value = '';
  };

  const removeFile = (index: number) => {
    setUploadFiles(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <Card
      className={
        leftAttached
          ? `rounded-l-none ${isExpanded ? 'rounded-bl-lg' : ''} shadow-none hover:shadow-none transition-all duration-300 animate-fade-in`
          : 'shadow-card hover:shadow-hover transition-all duration-300 animate-fade-in'
      }
    >
      <CardHeader
        className="h-[100px] min-h-[100px] flex flex-col justify-center pb-3 cursor-pointer select-none"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="p-2 rounded-lg bg-primary/10 shrink-0">
              <FolderOpen className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <CardTitle className="font-serif text-lg truncate">{folder.name}</CardTitle>
              {folder.description && (
                <CardDescription className="mt-1 line-clamp-2">
                  {folder.description}
                </CardDescription>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Badge variant="secondary" className="gap-1">
              <BookOpen className="w-3 h-3" />
              {totalCount}
            </Badge>
            {readCount > 0 && (
              <Badge variant="outline" className="gap-1 border-success/30 text-success">
                <BookCheck className="w-3 h-3" />
                {readCount} leídos
              </Badge>
            )}
            <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreVertical className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onOpenCreateCategory?.()}>
                <Tag className="w-4 h-4 mr-2" />
                Crear categoría
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setIsEditOpen(true)}>
                <Edit2 className="w-4 h-4 mr-2" />
                Editar
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
      </CardHeader>

      {isExpanded && (
        <CardContent className="pt-0 space-y-3 animate-fade-in">
          <div className="border-t pt-4">
            <Dialog open={isUploadOpen} onOpenChange={setIsUploadOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="w-full gap-2">
                  <Upload className="w-4 h-4" />
                  Subir PDF
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md overflow-hidden">
                <DialogHeader>
                  <DialogTitle className="font-serif">Subir libros (PDF)</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-4 min-w-0 overflow-hidden">
                  <div className="space-y-2 min-w-0">
                    <Label htmlFor="file">Selecciona uno o varios PDF</Label>
                    <Input
                      id="file"
                      type="file"
                      accept=".pdf,application/pdf"
                      multiple
                      onChange={handleFileChange}
                      className="cursor-pointer min-w-0"
                    />
                  </div>
                  {uploadFiles.length > 0 && (
                    <div className="space-y-2 min-w-0">
                      <Label>{uploadFiles.length} archivo(s) listo(s)</Label>
                      <ul className="max-h-40 overflow-auto rounded-md border bg-muted/30 p-2 space-y-1 text-sm min-w-0">
                        {uploadFiles.map((f, i) => (
                          <li key={i} className="flex items-center justify-between gap-2 min-w-0">
                            <span className="truncate min-w-0">{f.name}</span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 shrink-0 text-destructive"
                              onClick={() => removeFile(i)}
                            >
                              <X className="w-3 h-3" />
                            </Button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <Button
                    onClick={handleUpload}
                    className="w-full gradient-hero min-w-0"
                    disabled={uploadFiles.length === 0 || uploading}
                  >
                    {uploading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Subiendo {uploadProgress.current} de {uploadProgress.total}...
                      </>
                    ) : (
                      `Subir ${uploadFiles.length > 0 ? uploadFiles.length + ' libro(s)' : 'libro'}`
                    )}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {books.length > 0 ? (
            <div className="space-y-2">
              {onReorderBooks ? (
                <DndContext
                  sensors={bookSensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleBookDragEnd}
                >
                  <SortableContext
                    items={books.map(b => `book-${b.id}`)}
                    strategy={verticalListSortingStrategy}
                  >
                    {books.map((book) => (
                      <SortableBookCard
                        key={book.id}
                        book={book}
                        onToggleBookRead={onToggleBookRead}
                        onSetBookState={onSetBookState}
                        onRenameBook={onRenameBook}
                        onDeleteBook={onDeleteBook}
                        onProgressUpdate={onProgressUpdate}
                        getBookUrl={getBookUrl}
                      />
                    ))}
                  </SortableContext>
                </DndContext>
              ) : (
                books.map((book) => (
                  <BookCard
                    key={book.id}
                    book={book}
                    onToggleRead={onToggleBookRead}
                    onSetState={onSetBookState}
                    onRename={onRenameBook}
                    onDelete={onDeleteBook}
                    onProgressUpdate={onProgressUpdate}
                    getBookUrl={getBookUrl}
                  />
                ))
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              No hay libros en esta carpeta
            </p>
          )}
        </CardContent>
      )}

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-serif">Editar carpeta</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nombre</Label>
              <Input
                id="name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Descripción</Label>
              <Textarea
                id="description"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                placeholder="Añade contexto sobre esta carpeta..."
              />
            </div>
            <Button onClick={handleEdit} className="w-full gradient-hero">
              Guardar cambios
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-full bg-destructive/10">
                <Trash2 className="w-5 h-5 text-destructive" />
              </div>
              <AlertDialogTitle className="font-serif">¿Eliminar carpeta?</AlertDialogTitle>
            </div>
            <AlertDialogDescription>
              Se eliminará la carpeta <strong>{folder.name}</strong>
              {totalCount > 0 && (
                <> y sus <strong>{totalCount} libro{totalCount !== 1 ? 's' : ''}</strong></>
              )}
              . Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setIsDeleteConfirmOpen(false);
                onDelete(folder.id);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 gap-2"
            >
              <Trash2 className="w-4 h-4" />
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
