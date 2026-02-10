import { useState, useEffect, useCallback } from 'react';
import { Sidebar } from './Sidebar';
import { Dashboard } from './Dashboard';
import { Library } from './Library';
import { useLibrary } from '@/hooks/useLibrary';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from 'next-themes';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Loader2, LayoutDashboard, Library as LibraryIcon, Menu, User, Sun, Moon, LogOut, PanelLeftClose, PanelRightOpen } from 'lucide-react';
import { cn } from '@/lib/utils';

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
  const { user, signOut, isLocalOnly } = useAuth();
  const { theme, setTheme } = useTheme();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
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
    deleteCategoryWithContents,
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
    refreshData,
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
    <div className="flex flex-col min-h-screen bg-background lg:flex-row">
      {/* Sidebar desktop (lg+): colapsable; móvil/tablet usan bottom nav */}
      <aside
        className={cn(
          'hidden lg:flex lg:shrink-0 lg:h-screen lg:sticky lg:top-0 border-r border-sidebar-border bg-sidebar transition-[width] duration-200 ease-out',
          sidebarCollapsed ? 'lg:w-14' : 'lg:w-64'
        )}
      >
        <Sidebar
          currentView={currentView}
          onViewChange={setCurrentView}
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed(c => !c)}
        />
      </aside>

      {/* Botón fuera del sidenav: arriba a la izquierda del área de contenido (solo desktop) */}
      <div className="flex-1 relative min-w-0 flex flex-col">
        <Button
          variant="outline"
          size="icon"
          onClick={() => setSidebarCollapsed(c => !c)}
          className="hidden lg:flex absolute top-0 left-0 z-20 h-9 w-9 rounded-l-none rounded-r-lg border border-l-0 border-sidebar-border bg-sidebar text-sidebar-foreground hover:bg-sidebar-accent shadow-sm"
          title={sidebarCollapsed ? 'Abrir menú' : 'Minimizar menú'}
          aria-label={sidebarCollapsed ? 'Abrir menú' : 'Minimizar menú'}
        >
          {sidebarCollapsed ? <PanelRightOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
        </Button>
        <main className={cn('flex-1 p-4 lg:pl-14 lg:pr-8 lg:pt-8 overflow-auto min-w-0', 'pb-20 lg:pb-8')}>
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
              onDeleteCategoryWithContents={deleteCategoryWithContents}
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
              onRefresh={async () => { await refreshData(); }}
            />
          )}
        </div>
        </main>
      </div>

      {/* Bottom nav: solo en móvil/tablet (estilo app nativa) */}
      <nav
        className="lg:hidden fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around border-t border-border bg-background/95 backdrop-blur pt-2"
        style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}
      >
        <Button
          variant="ghost"
          className={cn(
            'flex flex-col items-center gap-0.5 py-3 px-4 rounded-none min-w-0 flex-1 h-auto text-muted-foreground',
            currentView === 'dashboard' && 'text-primary bg-primary/10'
          )}
          onClick={() => setCurrentView('dashboard')}
        >
          <LayoutDashboard className="w-5 h-5 shrink-0" />
          <span className="text-xs">Inicio</span>
        </Button>
        <Button
          variant="ghost"
          className={cn(
            'flex flex-col items-center gap-0.5 py-3 px-4 rounded-none min-w-0 flex-1 h-auto text-muted-foreground',
            currentView === 'library' && 'text-primary bg-primary/10'
          )}
          onClick={() => setCurrentView('library')}
        >
          <LibraryIcon className="w-5 h-5 shrink-0" />
          <span className="text-xs">Biblioteca</span>
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="flex flex-col items-center gap-0.5 py-3 px-4 rounded-none min-w-0 flex-1 h-auto text-muted-foreground"
              aria-label="Menú"
            >
              <Menu className="w-5 h-5 shrink-0" />
              <span className="text-xs">Menú</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="center" className="mb-2 w-56">
            <DropdownMenuLabel className="font-normal">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-muted-foreground" />
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">
                    {isLocalOnly ? 'Modo local' : user?.email?.split('@')[0]}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {isLocalOnly ? 'Solo en este dispositivo' : user?.email}
                  </p>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
              {theme === 'dark' ? <Sun className="w-4 h-4 mr-2" /> : <Moon className="w-4 h-4 mr-2" />}
              {theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
            </DropdownMenuItem>
            {!isLocalOnly && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => signOut()}
                  className="text-destructive focus:text-destructive"
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  Cerrar sesión
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </nav>
    </div>
  );
}
