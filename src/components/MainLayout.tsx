import { useState } from 'react';
import { Sidebar } from './Sidebar';
import { Dashboard } from './Dashboard';
import { Library } from './Library';
import { useLibrary } from '@/hooks/useLibrary';
import { Loader2 } from 'lucide-react';

type View = 'dashboard' | 'library';

export function MainLayout() {
  const [currentView, setCurrentView] = useState<View>('dashboard');
  const {
    folders,
    books,
    loading,
    stats,
    createFolder,
    updateFolder,
    deleteFolder,
    uploadBook,
    toggleBookRead,
    updateBook,
    deleteBook,
    getBooksByFolder,
    updateBookProgress,
    getBookUrl,
  } = useLibrary();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Cargando tu biblioteca...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar currentView={currentView} onViewChange={setCurrentView} />
      <main className="flex-1 p-8 overflow-auto">
        <div className="max-w-5xl mx-auto">
          {currentView === 'dashboard' ? (
            <Dashboard stats={stats} />
          ) : (
            <Library
              folders={folders}
              books={books}
              onCreateFolder={createFolder}
              onUpdateFolder={updateFolder}
              onDeleteFolder={deleteFolder}
              onUploadBook={uploadBook}
              onToggleBookRead={toggleBookRead}
              onRenameBook={updateBook}
              onDeleteBook={deleteBook}
              onProgressUpdate={updateBookProgress}
              getBooksByFolder={getBooksByFolder}
              getBookUrl={getBookUrl}
            />
          )}
        </div>
      </main>
    </div>
  );
}
