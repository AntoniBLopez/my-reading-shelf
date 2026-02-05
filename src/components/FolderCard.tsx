import { useState } from 'react';
import { Folder, Book } from '@/types/library';
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
} from 'lucide-react';
import { BookCard } from './BookCard';

interface FolderCardProps {
  folder: Folder;
  books: Book[];
  onUpdate: (id: string, updates: Partial<Pick<Folder, 'name' | 'description'>>) => Promise<boolean>;
  onDelete: (id: string) => Promise<boolean>;
  onUploadBook: (folderId: string, file: File, title: string) => Promise<Book | null>;
  onToggleBookRead: (id: string, isRead: boolean) => Promise<boolean>;
  onRenameBook: (id: string, updates: Partial<Pick<Book, 'title'>>) => Promise<boolean>;
  onDeleteBook: (id: string) => Promise<boolean>;
  onProgressUpdate: (id: string, currentPage: number, totalPages: number) => Promise<boolean>;
  getBookUrl: (filePath: string) => Promise<string | null>;
}

export function FolderCard({
  folder,
  books,
  onUpdate,
  onDelete,
  onUploadBook,
  onToggleBookRead,
  onRenameBook,
  onDeleteBook,
  onProgressUpdate,
  getBookUrl,
}: FolderCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [editName, setEditName] = useState(folder.name);
  const [editDescription, setEditDescription] = useState(folder.description || '');
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 });

  const readCount = books.filter(b => b.is_read).length;
  const totalCount = books.length;

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
    <Card className="shadow-card hover:shadow-hover transition-all duration-300 animate-fade-in">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div
            className="flex items-center gap-3 cursor-pointer flex-1"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            <div className="p-2 rounded-lg bg-primary/10">
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

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreVertical className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setIsEditOpen(true)}>
                <Edit2 className="w-4 h-4 mr-2" />
                Editar
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onDelete(folder.id)}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Eliminar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="flex items-center gap-2 mt-3">
          <Badge variant="secondary" className="gap-1">
            <BookOpen className="w-3 h-3" />
            {totalCount} libros
          </Badge>
          {readCount > 0 && (
            <Badge variant="outline" className="gap-1 border-success/30 text-success">
              <BookCheck className="w-3 h-3" />
              {readCount} leídos
            </Badge>
          )}
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
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle className="font-serif">Subir libros (PDF)</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label htmlFor="file">Selecciona uno o varios PDF</Label>
                    <Input
                      id="file"
                      type="file"
                      accept=".pdf,application/pdf"
                      multiple
                      onChange={handleFileChange}
                    />
                  </div>
                  {uploadFiles.length > 0 && (
                    <div className="space-y-2">
                      <Label>{uploadFiles.length} archivo(s) listo(s)</Label>
                      <ul className="max-h-40 overflow-auto rounded-md border bg-muted/30 p-2 space-y-1 text-sm">
                        {uploadFiles.map((f, i) => (
                          <li key={i} className="flex items-center justify-between gap-2">
                            <span className="truncate">{f.name}</span>
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
                    className="w-full gradient-hero"
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
              {books.map((book) => (
                <BookCard
                  key={book.id}
                  book={book}
                  onToggleRead={onToggleBookRead}
                  onRename={onRenameBook}
                  onDelete={onDeleteBook}
                  onProgressUpdate={onProgressUpdate}
                  getBookUrl={getBookUrl}
                />
              ))}
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
    </Card>
  );
}
