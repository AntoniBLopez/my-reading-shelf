import { useState } from 'react';
import { Folder, Book, BookState, FolderCategory } from '@/types/library';
import { FolderCard } from './FolderCard';
import { CreateFolderDialog } from './CreateFolderDialog';
import { Library as LibraryIcon, GripVertical, FolderPlus, Tag } from 'lucide-react';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  rectIntersection,
  useDroppable,
} from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import { MoreVertical, Pencil, Trash2 } from 'lucide-react';

const SECTION_UNCATEGORIZED = 'uncategorized';

interface LibraryProps {
  folders: Folder[];
  books: Book[];
  categories: FolderCategory[];
  getOrderedSections: () => { uncategorized: Folder[]; categories: { category: FolderCategory; folders: Folder[] }[] };
  onCreateFolder: (name: string, description?: string) => Promise<any>;
  onUpdateFolder: (id: string, updates: Partial<Pick<Folder, 'name' | 'description'>>) => Promise<boolean>;
  onDeleteFolder: (id: string) => Promise<boolean>;
  onCreateCategory: (name: string) => Promise<FolderCategory | null>;
  onUpdateCategory: (id: string, updates: Partial<Pick<FolderCategory, 'name'>>) => Promise<boolean>;
  onDeleteCategory: (id: string) => Promise<boolean>;
  onReorderFolders: (folderId: string, targetCategoryId: string | null, targetIndex: number) => void;
  onReorderCategories: (categoryIds: string[]) => void;
  onReorderBooks: (folderId: string, fromIndex: number, toIndex: number) => void;
  onUploadBook: (folderId: string, file: File, title: string) => Promise<Book | null>;
  onToggleBookRead: (id: string, isRead: boolean) => Promise<boolean>;
  onSetBookState: (id: string, state: BookState) => Promise<boolean>;
  onRenameBook: (id: string, updates: Partial<Pick<Book, 'title'>>) => Promise<boolean>;
  onDeleteBook: (id: string) => Promise<boolean>;
  onProgressUpdate: (id: string, currentPage: number, totalPages: number) => Promise<boolean>;
  getBooksByFolder: (folderId: string) => Book[];
  getBookUrl: (filePath: string) => Promise<string | null>;
}

function SortableFolderCard({
  folder,
  books,
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
}: {
  folder: Folder;
  books: Book[];
  onUpdate: (id: string, updates: Partial<Pick<Folder, 'name' | 'description'>>) => Promise<boolean>;
  onDelete: (id: string) => Promise<boolean>;
  onUploadBook: (folderId: string, file: File, title: string) => Promise<Book | null>;
  onToggleBookRead: (id: string, isRead: boolean) => Promise<boolean>;
  onSetBookState: (id: string, state: BookState) => Promise<boolean>;
  onRenameBook: (id: string, updates: Partial<Pick<Book, 'title'>>) => Promise<boolean>;
  onDeleteBook: (id: string) => Promise<boolean>;
  onProgressUpdate: (id: string, currentPage: number, totalPages: number) => Promise<boolean>;
  getBookUrl: (filePath: string) => Promise<string | null>;
  onReorderBooks: (folderId: string, fromIndex: number, toIndex: number) => void;
  onOpenCreateCategory?: (folderId: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `folder-${folder.id}`,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  return (
    <div ref={setNodeRef} style={style} className={`min-w-0 ${isDragging ? 'opacity-50' : ''}`}>
      <div className="flex items-start">
        <div
          className="flex items-center justify-center shrink-0 w-10 h-[102px] border-y border-l border-border border-r-0 rounded-l-lg rounded-r-none bg-muted/30"
          aria-hidden
        >
          <button
            type="button"
            className="w-full h-full flex items-center justify-center rounded-l-[7px] rounded-r-none cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground hover:bg-muted/50 touch-none transition-colors"
            {...listeners}
            {...attributes}
            aria-label="Arrastrar carpeta para ordenar"
          >
            <GripVertical className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 min-w-0">
          <FolderCard
            folder={folder}
            books={books}
            leftAttached
            onUpdate={onUpdate}
            onDelete={onDelete}
            onUploadBook={onUploadBook}
            onToggleBookRead={onToggleBookRead}
            onSetBookState={onSetBookState}
            onRenameBook={onRenameBook}
            onDeleteBook={onDeleteBook}
            onProgressUpdate={onProgressUpdate}
            getBookUrl={getBookUrl}
            onReorderBooks={onReorderBooks}
            onOpenCreateCategory={onOpenCreateCategory}
          />
        </div>
      </div>
    </div>
  );
}

function SectionDropZone({ dropId, children }: { dropId: string; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: dropId });
  return (
    <div
      ref={setNodeRef}
      className={`min-h-[84px] rounded-xl transition-colors ${isOver ? 'bg-primary/10 ring-2 ring-primary/30' : ''}`}
    >
      {children}
    </div>
  );
}

export function Library({
  folders,
  books,
  categories,
  getOrderedSections,
  onCreateFolder,
  onUpdateFolder,
  onDeleteFolder,
  onCreateCategory,
  onUpdateCategory,
  onDeleteCategory,
  onReorderFolders,
  onReorderCategories,
  onReorderBooks,
  onUploadBook,
  onToggleBookRead,
  onSetBookState,
  onRenameBook,
  onDeleteBook,
  onProgressUpdate,
  getBooksByFolder,
  getBookUrl,
}: LibraryProps) {
  const sections = getOrderedSections();
  const hasCategories = categories.length > 0;
  const [createCategoryOpen, setCreateCategoryOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [createCategoryFromFolderId, setCreateCategoryFromFolderId] = useState<string | null>(null);
  const handleOpenCreateCategory = (folderId: string) => {
    setCreateCategoryFromFolderId(folderId);
    setCreateCategoryOpen(true);
    setNewCategoryName('');
  };
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editingCategoryName, setEditingCategoryName] = useState('');
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
  const [deleteCategoryConfirmId, setDeleteCategoryConfirmId] = useState<string | null>(null);

  const getBookCountInCategory = (categoryId: string) => {
    const sec = sections.categories.find(c => c.category.id === categoryId);
    if (!sec) return 0;
    return sec.folders.reduce((n, f) => n + getBooksByFolder(f.id).length, 0);
  };

  const handleRequestDeleteCategory = (categoryId: string) => {
    if (getBookCountInCategory(categoryId) >= 1) {
      setDeleteCategoryConfirmId(categoryId);
    } else {
      onDeleteCategory(categoryId);
    }
  };

  const handleConfirmDeleteCategory = async () => {
    if (!deleteCategoryConfirmId) return;
    await onDeleteCategory(deleteCategoryConfirmId);
    setDeleteCategoryConfirmId(null);
  };

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  const allFolderIds = sections.uncategorized.map(f => f.id).concat(
    sections.categories.flatMap(c => c.folders.map(f => f.id))
  );

  const handleCreateCategory = async () => {
    const name = newCategoryName.trim();
    if (!name) return;
    const category = await onCreateCategory(name);
    setNewCategoryName('');
    setCreateCategoryOpen(false);
    if (category && createCategoryFromFolderId) {
      onReorderFolders(createCategoryFromFolderId, category.id, 0);
      setCreateCategoryFromFolderId(null);
    }
  };

  const handleUpdateCategory = async () => {
    if (!editingCategoryId) return;
    await onUpdateCategory(editingCategoryId, { name: editingCategoryName.trim() });
    setEditingCategoryId(null);
  };

  const getTargetFromOver = (overId: string | null, activeFolderId: string): { categoryId: string | null; index: number } | null => {
    if (!overId) return null;
    const overStr = String(overId);
    if (overStr.startsWith('drop-')) {
      if (overStr === 'drop-uncategorized') {
        const index = sections.uncategorized.filter(f => f.id !== activeFolderId).length;
        return { categoryId: null, index };
      }
      const categoryId = overStr.replace('drop-', '');
      const sec = sections.categories.find(c => c.category.id === categoryId);
      const index = sec ? sec.folders.filter(f => f.id !== activeFolderId).length : 0;
      return { categoryId, index };
    }
    if (!overStr.startsWith('folder-')) return null;
    const overFolderId = overStr.replace('folder-', '');
    if (overFolderId === activeFolderId) return null;
    for (let i = 0; i < sections.uncategorized.length; i++) {
      if (sections.uncategorized[i].id === overFolderId) return { categoryId: null, index: i };
    }
    for (const sec of sections.categories) {
      const idx = sec.folders.findIndex(f => f.id === overFolderId);
      if (idx !== -1) return { categoryId: sec.category.id, index: idx };
    }
    return null;
  };

  const handleDragStart = (event: DragStartEvent) => {
    const id = event.active.id;
    if (String(id).startsWith('folder-')) setActiveFolderId(String(id).replace('folder-', ''));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const activeId = event.active.id;
    const overId = event.over?.id != null ? String(event.over.id) : null;
    setActiveFolderId(null);
    if (activeId == null || !String(activeId).startsWith('folder-')) return;
    const folderId = String(activeId).replace('folder-', '');
    const target = getTargetFromOver(overId, folderId);
    if (!target) return;
    onReorderFolders(folderId, target.categoryId, target.index);
  };

  const renderSection = (
    sectionId: string,
    title: string,
    sectionFolders: Folder[],
    isCategory?: boolean,
    categoryId?: string
  ) => (
    <div
      key={sectionId}
      className="rounded-2xl border border-border bg-muted/20 dark:bg-muted/10 p-4 shadow-sm"
    >
      <div className="flex items-center gap-2 mb-3">
        {isCategory && categoryId ? (
          <div className="flex items-center gap-2 flex-1">
            {editingCategoryId === categoryId ? (
              <>
                <Input
                  value={editingCategoryName}
                  onChange={e => setEditingCategoryName(e.target.value)}
                  className="h-8 max-w-[200px]"
                  onKeyDown={e => e.key === 'Enter' && handleUpdateCategory()}
                />
                <Button size="sm" onClick={handleUpdateCategory}>
                  Guardar
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setEditingCategoryId(null)}>
                  Cancelar
                </Button>
              </>
            ) : (
              <>
                <Tag className="w-4 h-4 text-muted-foreground" />
                <h2 className="font-serif text-lg font-semibold text-foreground">{title}</h2>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-7 w-7">
                      <MoreVertical className="w-3 h-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    <DropdownMenuItem onClick={() => { setEditingCategoryId(categoryId); setEditingCategoryName(title); }}>
                      <Pencil className="w-4 h-4 mr-2" />
                      Editar
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleRequestDeleteCategory(categoryId)} className="text-destructive">
                      <Trash2 className="w-4 h-4 mr-2" />
                      Eliminar categoría
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            )}
          </div>
        ) : (
          <h2 className="font-serif text-lg font-semibold text-muted-foreground">{title}</h2>
        )}
      </div>
      <SectionDropZone dropId={categoryId === undefined ? 'drop-uncategorized' : `drop-${categoryId}`}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {sectionFolders.map(folder => (
            <SortableFolderCard
            key={folder.id}
            folder={folder}
            books={getBooksByFolder(folder.id)}
            onUpdate={onUpdateFolder}
            onDelete={onDeleteFolder}
            onUploadBook={onUploadBook}
            onToggleBookRead={onToggleBookRead}
            onSetBookState={onSetBookState}
            onRenameBook={onRenameBook}
            onDeleteBook={onDeleteBook}
            onProgressUpdate={onProgressUpdate}
            getBookUrl={getBookUrl}
            onReorderBooks={onReorderBooks}
            onOpenCreateCategory={handleOpenCreateCategory}
          />
          ))}
        </div>
      </SectionDropZone>
    </div>
  );

  if (folders.length === 0) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-serif font-semibold">My Reading Shell</h1>
          <p className="text-muted-foreground mt-1">Organiza tus libros en carpetas</p>
          </div>
          <CreateFolderDialog onCreate={onCreateFolder} />
        </div>
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
        <Dialog open={createCategoryOpen} onOpenChange={(open) => { setCreateCategoryOpen(open); if (!open) setCreateCategoryFromFolderId(null); }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="font-serif">Nueva categoría</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <Label>Nombre</Label>
              <Input
                value={newCategoryName}
                onChange={e => setNewCategoryName(e.target.value)}
                placeholder="Ej: Novela, Ensayo..."
                onKeyDown={e => e.key === 'Enter' && handleCreateCategory()}
              />
              <Button onClick={handleCreateCategory} disabled={!newCategoryName.trim()}>
                Crear
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-serif font-semibold">My Reading Shell</h1>
          <p className="text-muted-foreground mt-1">
            {hasCategories ? 'Organiza tus carpetas en categorías y ordena por arrastre' : 'Organiza tus libros en carpetas. Arrastra para ordenar.'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {hasCategories && (
            <Button variant="outline" size="sm" className="gap-2" onClick={() => { setCreateCategoryFromFolderId(null); setCreateCategoryOpen(true); setNewCategoryName(''); }}>
              <Tag className="w-4 h-4" />
              Nueva categoría
            </Button>
          )}
          <CreateFolderDialog onCreate={onCreateFolder} />
        </div>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={rectIntersection}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={allFolderIds.map(id => `folder-${id}`)} strategy={verticalListSortingStrategy}>
          {hasCategories ? (
            <div className="space-y-8">
              {renderSection(SECTION_UNCATEGORIZED, 'Sin categoría', sections.uncategorized)}
              {sections.categories.map(({ category, folders: catFolders }) =>
                renderSection(`section-${category.id}`, category.name, catFolders, true, category.id)
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {sections.uncategorized.map(folder => (
                <SortableFolderCard
                  key={folder.id}
                  folder={folder}
                  books={getBooksByFolder(folder.id)}
                  onUpdate={onUpdateFolder}
                  onDelete={onDeleteFolder}
                  onUploadBook={onUploadBook}
                  onToggleBookRead={onToggleBookRead}
                  onSetBookState={onSetBookState}
                  onRenameBook={onRenameBook}
                  onDeleteBook={onDeleteBook}
                  onProgressUpdate={onProgressUpdate}
                  getBookUrl={getBookUrl}
                  onReorderBooks={onReorderBooks}
                  onOpenCreateCategory={handleOpenCreateCategory}
                />
              ))}
            </div>
          )}
        </SortableContext>

        <DragOverlay>
          {activeFolderId ? (
            <div className="opacity-90 shadow-lg">
              <FolderCard
                folder={folders.find(f => f.id === activeFolderId)!}
                books={getBooksByFolder(activeFolderId)}
                onUpdate={onUpdateFolder}
                onDelete={onDeleteFolder}
                onUploadBook={onUploadBook}
                onToggleBookRead={onToggleBookRead}
                onSetBookState={onSetBookState}
                onRenameBook={onRenameBook}
                onDeleteBook={onDeleteBook}
                onProgressUpdate={onProgressUpdate}
                getBookUrl={getBookUrl}
                onOpenCreateCategory={handleOpenCreateCategory}
              />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      <Dialog open={createCategoryOpen} onOpenChange={(open) => { setCreateCategoryOpen(open); if (!open) setCreateCategoryFromFolderId(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-serif">Nueva categoría</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <Label>Nombre</Label>
            <Input
              value={newCategoryName}
              onChange={e => setNewCategoryName(e.target.value)}
              placeholder="Ej: Novela, Ensayo..."
              onKeyDown={e => e.key === 'Enter' && handleCreateCategory()}
            />
            <Button onClick={handleCreateCategory} disabled={!newCategoryName.trim()}>
              Crear
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteCategoryConfirmId} onOpenChange={(open) => { if (!open) setDeleteCategoryConfirmId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-serif">
              ¿Eliminar categoría {deleteCategoryConfirmId ? `«${sections.categories.find(c => c.category.id === deleteCategoryConfirmId)?.category.name ?? ''}»` : ''}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Esta categoría contiene al menos un libro en sus carpetas. Las carpetas pasarán a &quot;Sin categoría&quot; y los libros no se eliminarán.
              ¿Quieres eliminar la categoría de todos modos?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDeleteCategory} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
