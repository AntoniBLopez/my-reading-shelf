import { useState } from 'react';
import { Folder, Book, BookState, FolderCategory } from '@/types/library';
import { FolderCard } from './FolderCard';
import { CreateFolderDialog } from './CreateFolderDialog';
import {
  Library as LibraryIcon,
  GripVertical,
  FolderPlus,
  Tag,
  MoreVertical,
  Pencil,
  Trash2,
  ChevronDown,
  ChevronUp,
  RefreshCw,
} from 'lucide-react';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  TouchSensor,
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
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';

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
  onDeleteCategoryWithContents: (id: string) => Promise<boolean>;
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
  onRefresh?: () => Promise<void>;
}

function SortableFolderCard({
  folder,
  books,
  showDragHandle,
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
  showDragHandle: boolean;
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
        {showDragHandle && (
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
        )}
        <div className="flex-1 min-w-0">
          <FolderCard
            folder={folder}
            books={books}
            leftAttached={showDragHandle}
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

function SectionDropZone({
  dropId,
  activeDragId,
  children,
}: {
  dropId: string;
  activeDragId: string | null;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: dropId });
  const showDropHighlight =
    isOver && (activeDragId == null || !String(activeDragId).startsWith('category-'));
  return (
    <div
      ref={setNodeRef}
      className={`min-h-[84px] rounded-xl transition-colors ${showDropHighlight ? 'bg-primary/10 ring-2 ring-primary/30' : ''}`}
    >
      {children}
    </div>
  );
}

function SortableCategorySection({
  categoryId,
  sectionId,
  title,
  sectionFolders,
  folderLimit,
  isExpanded,
  onToggleExpand,
  showCategoryDragHandle,
  renderSectionWithOptions,
}: {
  categoryId: string;
  sectionId: string;
  title: string;
  sectionFolders: Folder[];
  folderLimit: number;
  isExpanded: boolean;
  onToggleExpand: () => void;
  showCategoryDragHandle: boolean;
  renderSectionWithOptions: (options: {
    setNodeRef: (node: HTMLElement | null) => void;
    style: React.CSSProperties;
    dragHandleListeners: object;
    dragHandleAttributes: object;
    folderLimit: number;
    isExpanded: boolean;
    onToggleExpand: () => void;
    showCategoryDragHandle: boolean;
  }) => React.ReactNode;
}) {
  const { setNodeRef, transform, transition, isDragging, listeners, attributes } = useSortable({
    id: `category-${categoryId}`,
  });
  const style = { transform: CSS.Transform.toString(transform), transition };
  return (
    <div className={isDragging ? 'opacity-50' : ''}>
      {renderSectionWithOptions({
        setNodeRef,
        style,
        dragHandleListeners: listeners,
        dragHandleAttributes: attributes as object,
        folderLimit,
        isExpanded,
        onToggleExpand,
        showCategoryDragHandle,
      })}
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
  onDeleteCategoryWithContents,
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
  onRefresh,
}: LibraryProps) {
  const [refreshing, setRefreshing] = useState(false);
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
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [deleteCategoryConfirmId, setDeleteCategoryConfirmId] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const isMobile = useIsMobile();
  const folderLimit = isMobile ? 2 : 4;

  const getFolderCountInCategory = (categoryId: string) => {
    const sec = sections.categories.find(c => c.category.id === categoryId);
    return sec?.folders.length ?? 0;
  };

  const handleRequestDeleteCategory = (categoryId: string) => {
    if (getFolderCountInCategory(categoryId) >= 1) {
      setDeleteCategoryConfirmId(categoryId);
    } else {
      onDeleteCategory(categoryId);
    }
  };

  const handleConfirmDeleteCategoryMoveFolders = async () => {
    if (!deleteCategoryConfirmId) return;
    await onDeleteCategory(deleteCategoryConfirmId);
    setDeleteCategoryConfirmId(null);
  };

  const handleConfirmDeleteCategoryWithContents = async () => {
    if (!deleteCategoryConfirmId) return;
    await onDeleteCategoryWithContents(deleteCategoryConfirmId);
    setDeleteCategoryConfirmId(null);
  };

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 8 },
    })
  );

  const allFolderIds = sections.uncategorized.map(f => f.id).concat(
    sections.categories.flatMap(c => c.folders.map(f => f.id))
  );
  const showFolderDragHandle =
    allFolderIds.length > 1 || (allFolderIds.length === 1 && sections.categories.length >= 1);

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
    setActiveDragId(null);
    const activeStr = String(activeId ?? '');

    if (activeStr.startsWith('category-')) {
      const activeCategoryId = activeStr.replace('category-', '');
      if (!overId || !String(overId).startsWith('category-')) return;
      const overCategoryId = String(overId).replace('category-', '');
      const currentOrder = sections.categories.map(c => c.category.id);
      const oldIndex = currentOrder.indexOf(activeCategoryId);
      const newIndex = currentOrder.indexOf(overCategoryId);
      if (oldIndex === -1 || newIndex === -1) return;
      const [removed] = currentOrder.splice(oldIndex, 1);
      const insertIndex = oldIndex < newIndex ? newIndex - 1 : newIndex;
      currentOrder.splice(insertIndex, 0, removed);
      onReorderCategories([...currentOrder]);
      return;
    }

    if (activeStr.startsWith('folder-')) {
      const folderId = activeStr.replace('folder-', '');
      const target = getTargetFromOver(overId, folderId);
      if (!target) return;
      onReorderFolders(folderId, target.categoryId, target.index);
    }
  };

  const toggleSectionExpanded = (sectionId: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(sectionId)) next.delete(sectionId);
      else next.add(sectionId);
      return next;
    });
  };

  const renderSection = (
    sectionId: string,
    title: string,
    sectionFolders: Folder[],
    isCategory?: boolean,
    categoryId?: string,
    options?: {
      folderLimit: number;
      isExpanded: boolean;
      onToggleExpand: () => void;
      setNodeRef?: (node: HTMLElement | null) => void;
      style?: React.CSSProperties;
      dragHandleListeners?: object;
      dragHandleAttributes?: object;
      showCategoryDragHandle?: boolean;
      activeDragId?: string | null;
    }
  ) => {
    const limit = options?.folderLimit ?? folderLimit;
    const isExpanded = options?.isExpanded ?? true;
    const onToggleExpand = options?.onToggleExpand ?? (() => {});
    const showCollapse = sectionFolders.length > limit;
    const displayedFolders = showCollapse && !isExpanded ? sectionFolders.slice(0, limit) : sectionFolders;
    const hiddenCount = sectionFolders.length - displayedFolders.length;

    return (
    <div
      key={sectionId}
      ref={options?.setNodeRef}
      style={options?.style}
      className="rounded-2xl border border-border bg-muted/20 dark:bg-muted/10 p-4 shadow-sm"
    >
      <div className="flex items-center gap-2 mb-3">
        {options?.showCategoryDragHandle && options?.dragHandleListeners != null && options?.dragHandleAttributes != null && (
          <div
            className="flex items-center justify-center shrink-0 w-8 h-8 rounded-lg cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground hover:bg-muted/50 touch-none"
            {...options.dragHandleListeners}
            {...options.dragHandleAttributes}
            aria-label="Arrastrar para ordenar categoría"
          >
            <GripVertical className="w-4 h-4" />
          </div>
        )}
        {isCategory && categoryId ? (
          <>
            <div className="flex items-center gap-2 flex-1 min-w-0">
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
                  <Tag className="w-4 h-4 text-muted-foreground shrink-0" />
                  <h2 className="font-serif text-lg font-semibold text-foreground truncate">{title}</h2>
                </>
              )}
            </div>
            {editingCategoryId !== categoryId && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 ml-auto">
                    <MoreVertical className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
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
            )}
          </>
        ) : (
          <h2 className="font-serif text-lg font-semibold text-muted-foreground">{title}</h2>
        )}
      </div>
      <SectionDropZone
        dropId={categoryId === undefined ? 'drop-uncategorized' : `drop-${categoryId}`}
        activeDragId={options?.activeDragId ?? null}
      >
        {/* Mobile/tablet: una columna (100% por card); desktop: dos columnas (50% por card) */}
        <div className="flex flex-col gap-3 lg:hidden">
          {displayedFolders.map(folder => (
            <SortableFolderCard
              key={folder.id}
              folder={folder}
              books={getBooksByFolder(folder.id)}
              showDragHandle={showFolderDragHandle}
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
        <div className="hidden lg:flex lg:flex-row gap-3">
          {[0, 1].map(col => (
            <div key={col} className="flex flex-col gap-3 flex-1 min-w-0">
              {displayedFolders
                .filter((_, i) => i % 2 === col)
                .map(folder => (
                  <SortableFolderCard
                    key={folder.id}
                    folder={folder}
                    books={getBooksByFolder(folder.id)}
                    showDragHandle={showFolderDragHandle}
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
          ))}
        </div>
        {showCollapse && (
          <div className="mt-3 flex justify-center">
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 text-muted-foreground hover:text-foreground"
              onClick={onToggleExpand}
            >
              {isExpanded ? (
                <>
                  <ChevronUp className="w-4 h-4" />
                  Minimizar
                </>
              ) : (
                <>
                  <ChevronDown className="w-4 h-4" />
                  Mostrar más{hiddenCount > 0 ? ` (${hiddenCount} más)` : ''}
                </>
              )}
            </Button>
          </div>
        )}
      </SectionDropZone>
    </div>
  );
  };

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
          <Button variant="outline" className="gap-2 h-10" onClick={() => { setCreateCategoryFromFolderId(null); setCreateCategoryOpen(true); setNewCategoryName(''); }}>
            <Tag className="w-4 h-4" />
            Nueva categoría
          </Button>
          <CreateFolderDialog onCreate={onCreateFolder} />
          {onRefresh && (
            <Button
              variant="outline"
              size="icon"
              onClick={async () => {
                setRefreshing(true);
                await onRefresh();
                setRefreshing(false);
              }}
              disabled={refreshing}
              title="Actualizar carpetas, categorías y libros"
              aria-label="Actualizar"
              className="shrink-0"
            >
              <RefreshCw className={cn('w-4 h-4', refreshing && 'animate-spin')} />
            </Button>
          )}
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
            <SortableContext
              items={sections.categories.map(c => `category-${c.category.id}`)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-8">
                {renderSection(
                  SECTION_UNCATEGORIZED,
                  'Sin categoría',
                  sections.uncategorized,
                  undefined,
                  undefined,
                  {
                    folderLimit,
                    isExpanded: expandedSections.has(SECTION_UNCATEGORIZED),
                    onToggleExpand: () => toggleSectionExpanded(SECTION_UNCATEGORIZED),
                    activeDragId,
                  }
                )}
                {sections.categories.map(({ category, folders: catFolders }) => (
                  <SortableCategorySection
                    key={category.id}
                    categoryId={category.id}
                    sectionId={`section-${category.id}`}
                    title={category.name}
                    sectionFolders={catFolders}
                    folderLimit={folderLimit}
                    isExpanded={expandedSections.has(`section-${category.id}`)}
                    onToggleExpand={() => toggleSectionExpanded(`section-${category.id}`)}
                    showCategoryDragHandle={sections.categories.length > 1}
                    renderSectionWithOptions={opts =>
                      renderSection(
                        `section-${category.id}`,
                        category.name,
                        catFolders,
                        true,
                        category.id,
                        { ...opts, activeDragId }
                      )
                    }
                  />
                ))}
              </div>
            </SortableContext>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {sections.uncategorized.map(folder => (
                <SortableFolderCard
                  key={folder.id}
                  folder={folder}
                  books={getBooksByFolder(folder.id)}
                  showDragHandle={showFolderDragHandle}
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

        <DragOverlay dropAnimation={null}>
          {activeFolderId ? (
            <div className="opacity-90 shadow-lg touch-none select-none" style={{ touchAction: 'none' }}>
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
        <AlertDialogContent className="w-[calc(100vw-2rem)] max-w-lg max-h-[85vh] overflow-y-auto">
          <AlertDialogHeader className="w-full">
            <AlertDialogTitle className="font-serif">
              ¿Eliminar categoría {deleteCategoryConfirmId ? `«${sections.categories.find(c => c.category.id === deleteCategoryConfirmId)?.category.name ?? ''}»` : ''}?
            </AlertDialogTitle>
            <AlertDialogDescription className="block w-full max-w-full min-w-0">
              Esta categoría tiene al menos una carpeta. Puedes mover todas las carpetas (y sus libros) a &quot;Sin categoría&quot; o eliminar la categoría junto con todas las carpetas y libros que contiene.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:space-x-2 sm:space-y-0">
            <AlertDialogCancel className="m-0 w-full sm:w-auto">Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDeleteCategoryMoveFolders} className="w-full sm:w-auto whitespace-normal text-center">
              Mover a Sin categoría
            </AlertDialogAction>
            <AlertDialogAction onClick={handleConfirmDeleteCategoryWithContents} className="w-full sm:w-auto whitespace-normal text-center bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Eliminar categoría, carpetas y libros
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
