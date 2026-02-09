import { useState, useEffect, useCallback } from 'react';
import { Sidebar } from './Sidebar';
import { Dashboard } from './Dashboard';
import { Library } from './Library';
import { useLibrary } from '@/hooks/useLibrary';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Loader2, MoreVertical } from 'lucide-react';

type View = 'dashboard' | 'library';

function getViewFromSearchParams(): View {
  const params = new URLSearchParams(window.location.search);
  const tab = params.get('tab');
  if (tab === 'library' || tab === 'dashboard') return tab;
  return 'dashboard';
}

export function MainLayout() {
  const [currentView, setCurrentViewState] = useState<View>(getViewFromSearchParams);

  const setCurrentView = useCallback((view: View) => {
    setCurrentViewState(view);
    const url = new URL(window.location.href);
    url.searchParams.set('tab', view);
    window.history.replaceState(null, '', url.pathname + (url.searchParams.toString() ? '?' + url.searchParams.toString() : ''));
  }, []);

  useEffect(() => {
    const onPopState = () => {
      const view = getViewFromSearchParams();
      setCurrentViewState(view);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const {
    folders,
    books,
    categories,
    loading,
    stats,
    createFolder,
    updateFolder,
    deleteFolder,
    createCategory,
    updateCategory,
    deleteCategory,
    getOrderedSections,
    reorderFolders,
    reorderCategories,
    reorderBooks,
    uploadBook,
    toggleBookRead,
    setBookState,
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
    <div className="flex flex-col min-h-screen bg-background md:flex-row">
      {/* Header móvil: solo visible en pantallas pequeñas */}
      <header className="flex md:hidden items-center justify-between gap-4 px-4 py-3 border-b border-border bg-background shrink-0">
        <h1 className="font-serif font-semibold text-lg text-foreground truncate">My Reading Shell</h1>
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0"
          onClick={() => setMobileMenuOpen(true)}
          aria-label="Abrir menú"
        >
          <MoreVertical className="w-5 h-5" />
        </Button>
      </header>

      {/* Sheet menú móvil */}
      <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <SheetContent side="left" className="p-0 w-64 max-w-[85vw]">
          <Sidebar
            currentView={currentView}
            onViewChange={setCurrentView}
            onNavigate={() => setMobileMenuOpen(false)}
          />
        </SheetContent>
      </Sheet>

      {/* Sidebar desktop: oculto en móvil */}
      <aside className="hidden md:flex md:w-64 md:shrink-0 md:h-screen md:sticky md:top-0 border-r border-sidebar-border">
        <Sidebar currentView={currentView} onViewChange={setCurrentView} />
      </aside>

      <main className="flex-1 p-4 md:p-8 overflow-auto min-w-0">
        <div className="max-w-5xl mx-auto">
          {currentView === 'dashboard' ? (
            <Dashboard stats={stats} />
          ) : (
            <Library
              folders={folders}
              books={books}
              categories={categories}
              getOrderedSections={getOrderedSections}
              onCreateFolder={createFolder}
              onUpdateFolder={updateFolder}
              onDeleteFolder={deleteFolder}
              onCreateCategory={createCategory}
              onUpdateCategory={updateCategory}
              onDeleteCategory={deleteCategory}
              onReorderFolders={reorderFolders}
              onReorderCategories={reorderCategories}
              onReorderBooks={reorderBooks}
              onUploadBook={uploadBook}
              onToggleBookRead={toggleBookRead}
              onSetBookState={setBookState}
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
