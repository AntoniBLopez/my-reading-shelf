import { Folder, Book } from '@/types/library';
import { FolderCard } from './FolderCard';
import { CreateFolderDialog } from './CreateFolderDialog';
import { Library as LibraryIcon } from 'lucide-react';

interface LibraryProps {
  folders: Folder[];
  books: Book[];
  onCreateFolder: (name: string, description?: string) => Promise<any>;
  onUpdateFolder: (id: string, updates: Partial<Pick<Folder, 'name' | 'description'>>) => Promise<boolean>;
  onDeleteFolder: (id: string) => Promise<boolean>;
  onUploadBook: (folderId: string, file: File, title: string) => Promise<Book | null>;
  onToggleBookRead: (id: string, isRead: boolean) => Promise<boolean>;
  onRenameBook: (id: string, updates: Partial<Pick<Book, 'title'>>) => Promise<boolean>;
  onDeleteBook: (id: string) => Promise<boolean>;
  onProgressUpdate: (id: string, currentPage: number, totalPages: number) => Promise<boolean>;
  getBooksByFolder: (folderId: string) => Book[];
  getBookUrl: (filePath: string) => Promise<string | null>;
}

export function Library({
  folders,
  books,
  onCreateFolder,
  onUpdateFolder,
  onDeleteFolder,
  onUploadBook,
  onToggleBookRead,
  onRenameBook,
  onDeleteBook,
  onProgressUpdate,
  getBooksByFolder,
  getBookUrl,
}: LibraryProps) {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-serif font-semibold">Mi Biblioteca</h1>
          <p className="text-muted-foreground mt-1">Organiza tus libros en carpetas</p>
        </div>
        <CreateFolderDialog onCreate={onCreateFolder} />
      </div>

      {folders.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {folders.map((folder) => (
            <FolderCard
              key={folder.id}
              folder={folder}
              books={getBooksByFolder(folder.id)}
              onUpdate={onUpdateFolder}
              onDelete={onDeleteFolder}
              onUploadBook={onUploadBook}
              onToggleBookRead={onToggleBookRead}
              onRenameBook={onRenameBook}
              onDeleteBook={onDeleteBook}
              onProgressUpdate={onProgressUpdate}
              getBookUrl={getBookUrl}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="p-4 rounded-2xl bg-primary/10 mb-4">
            <LibraryIcon className="w-12 h-12 text-primary" />
          </div>
          <h3 className="text-xl font-serif font-semibold mb-2">Tu biblioteca está vacía</h3>
          <p className="text-muted-foreground mb-6 max-w-md">
            Crea tu primera carpeta para empezar a organizar tus libros
          </p>
          <CreateFolderDialog onCreate={onCreateFolder} />
        </div>
      )}
    </div>
  );
}
