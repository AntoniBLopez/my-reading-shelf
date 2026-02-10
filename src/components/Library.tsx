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
  DragOverEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  pointerWithin,
  rectIntersection,
  closestCenter,
  useDroppable,
} from '@dnd-kit/core';
import { SortableContext, useSortable, rectSortingStrategy, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS, getEventCoordinates } from '@dnd-kit/utilities';
import type { Modifier } from '@dnd-kit/core';

/** Snaps the overlay so the left handle (grab area) is under the cursor/finger, not the center. */
const snapLeftHandleToCursor: Modifier = (args) => {
  const { activatorEvent, draggingNodeRect, transform } = args;
  if (!draggingNodeRect || !activatorEvent) return transform;
  const coords = getEventCoordinates(activatorEvent);
  if (!coords) return transform;
  const offsetX = coords.x - draggingNodeRect.left;
  const offsetY = coords.y - draggingNodeRect.top;
  const grabX = 20;
  const grabY = draggingNodeRect.height / 2;
  return {
    x: transform.x + offsetX - grabX,
    y: transform.y + offsetY - grabY,
    scaleX: transform.scaleX,
    scaleY: transform.scaleY,
  };
};
import { Button } from '@/components/ui/button';
import { ExpandMoreButton } from './ExpandMoreButton';
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
  onMoveBook?: (bookId: string, targetFolderId: string) => Promise<boolean>;
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
  onMoveBook,
  allFolders,
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
  onMoveBook?: (bookId: string, targetFolderId: string) => Promise<boolean>;
  allFolders?: { id: string; name: string }[];
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
    <div ref={setNodeRef} style={style} className={`min-w-0 ${isDragging ? 'opacity-90 z-[100]' : ''}`}>
      <div className="flex items-start">
        {showDragHandle && (
          <div
            className="flex items-center justify-center shrink-0 w-10 h-[102px] border-y border-l border-border border-r-0 rounded-l-lg rounded-r-none bg-muted/30"
            style={{ touchAction: 'none' }}
            aria-hidden
          >
            <button
              type="button"
              className="w-full h-full flex items-center justify-center rounded-l-[7px] rounded-r-none cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
              style={{ touchAction: 'none' }}
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
            onMoveBook={onMoveBook}
            allFolders={allFolders}
            onOpenCreateCategory={onOpenCreateCategory}
          />
        </div>
      </div>
    </div>
  );
}

function DropPlaceholder() {
  return (
    <div
      className="min-h-[84px] rounded-xl border-2 border-dashed border-primary/50 bg-primary/10 flex items-center justify-center text-sm text-muted-foreground"
      aria-hidden
    >
    </div>
  );
}

/** Mantiene el tamaño de la celda al arrastrar una carpeta para que el grid no se contraiga. */
function FolderSlotPlaceholder({ showDragHandle }: { showDragHandle: boolean }) {
  return (
    <div className="min-w-0 flex items-start" style={{ minHeight: 102 }}>
      {showDragHandle && <div className="shrink-0 w-10 h-[102px]" aria-hidden />}
      <div className="flex-1 min-w-0 min-h-[100px] rounded-lg border border-transparent" aria-hidden />
    </div>
  );
}

function SlotDropZone({
  slotId,
  showPlaceholder,
}: {
  slotId: string;
  showPlaceholder: boolean;
}) {
  const { setNodeRef } = useDroppable({ id: slotId });
  return (
    <div
      ref={setNodeRef}
      className="min-h-[102px] rounded-xl"
      style={{ gridColumn: 'span 1', gridRow: 'span 1' }}
    >
      {showPlaceholder ? <DropPlaceholder /> : null}
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
      className={`min-h-[84px] rounded-xl transition-colors duration-150 ${showDropHighlight ? 'bg-primary/15 ring-2 ring-primary ring-offset-2 ring-offset-background' : ''}`}
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
  onMoveBook,
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
  const allFolders = [...sections.uncategorized, ...sections.categories.flatMap(c => c.folders)].map(f => ({ id: f.id, name: f.name }));
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
  const [overlayWidth, setOverlayWidth] = useState<number | null>(null);
  const [dropTarget, setDropTarget] = useState<{ categoryId: string | null; index: number } | null>(null);
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

  // TouchSensor primero para que en tablet/móvil se use touch (delay+tolerance); en desktop PointerSensor
  const sensors = useSensors(
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 10 },
    }),
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
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
    if (overStr.startsWith('slot-')) {
      const rest = overStr.slice(5);
      const firstDash = rest.indexOf('-');
      if (firstDash < 0) return null;
      const categoryKey = rest.slice(0, firstDash);
      const index = parseInt(rest.slice(firstDash + 1), 10);
      if (Number.isNaN(index) || index < 0) return null;
      const categoryId = categoryKey === 'uncategorized' ? null : categoryKey;
      return { categoryId, index };
    }
    const activeStr = String(activeFolderId);
    if (overStr.startsWith('drop-')) {
      if (overStr === 'drop-uncategorized') {
        const index = sections.uncategorized.filter(f => String(f.id) !== activeStr).length;
        return { categoryId: null, index };
      }
      const categoryId = overStr.replace('drop-', '');
      const sec = sections.categories.find(c => c.category.id === categoryId);
      const index = sec ? sec.folders.filter(f => String(f.id) !== activeStr).length : 0;
      return { categoryId, index };
    }
    if (!overStr.startsWith('folder-')) return null;
    const overFolderId = overStr.replace('folder-', '');
    if (String(overFolderId) === activeStr) return null;
    for (let i = 0; i < sections.uncategorized.length; i++) {
      if (String(sections.uncategorized[i].id) === overFolderId) return { categoryId: null, index: i };
    }
    for (const sec of sections.categories) {
      const idx = sec.folders.findIndex(f => String(f.id) === overFolderId);
      if (idx !== -1) return { categoryId: sec.category.id, index: idx };
    }
    return null;
  };

  const handleDragStart = (event: DragStartEvent) => {
    const id = event.active.id;
    setDropTarget(null);
    if (String(id).startsWith('folder-')) {
      setActiveFolderId(String(id).replace('folder-', ''));
      const activator = document.querySelector(`[data-id="${id}"]`);
      const wrapper = activator?.parentElement?.parentElement ?? (activator as Element | null);
      if (wrapper) setOverlayWidth((wrapper as Element).getBoundingClientRect().width);
    } else {
      setOverlayWidth(null);
    }
  };

  const handleDragOver = (event: DragOverEvent) => {
    const overId = event.over?.id != null ? String(event.over.id) : null;
    const activeStr = String(event.active.id ?? '');
    if (!overId || !activeStr.startsWith('folder-')) {
      setDropTarget(null);
      return;
    }
    const activeFolderIdFromEvent = activeStr.replace('folder-', '');
    const target = getTargetFromOver(overId, activeFolderIdFromEvent);
    setDropTarget(target);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const activeId = event.active.id;
    const overId = event.over?.id != null ? String(event.over.id) : null;
    setActiveFolderId(null);
    setActiveDragId(null);
    setDropTarget(null);
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

    const sectionCategoryIdForDrop = categoryId ?? null;
    const categoryKey = sectionCategoryIdForDrop === null ? 'uncategorized' : sectionCategoryIdForDrop;
    const list = displayedFolders;
    const showSlotOverlay = activeFolderId != null;
    const slotCount = list.length + 1;
    const dropTargetMatchesSection =
      dropTarget != null && dropTarget.categoryId === sectionCategoryIdForDrop;

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
            className="flex items-center justify-center shrink-0 w-8 h-8 rounded-lg cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground hover:bg-muted/50"
            style={{ touchAction: 'none' }}
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
        {/* Mobile/tablet: una columna (100% por card); durante drag evitar que el scroll robe el gesto */}
        <div className={cn('relative flex flex-col gap-3 lg:hidden', showSlotOverlay && 'touch-none')}>
          {list.slice(0, limit).map(folder =>
            String(folder.id) === String(activeFolderId) ? (
              <FolderSlotPlaceholder key={folder.id} showDragHandle={showFolderDragHandle} />
            ) : (
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
                onMoveBook={onMoveBook}
                allFolders={allFolders}
                onOpenCreateCategory={handleOpenCreateCategory}
              />
            )
          )}
          {showCollapse && (
            <div
              className={`expandable-section ${isExpanded ? 'expandable-section--open' : 'expandable-section--closed'}`}
            >
              <div className="flex flex-col gap-3">
                {list.slice(limit).map(folder =>
                  String(folder.id) === String(activeFolderId) ? (
                    <FolderSlotPlaceholder key={folder.id} showDragHandle={showFolderDragHandle} />
                  ) : (
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
                onMoveBook={onMoveBook}
                allFolders={allFolders}
                onOpenCreateCategory={handleOpenCreateCategory}
                    />
                  )
                )}
              </div>
            </div>
          )}
          {showSlotOverlay && (
            <div className="absolute inset-0 z-10 flex flex-col gap-3 pointer-events-none [&>div]:pointer-events-auto">
              {Array.from({ length: slotCount }, (_, i) => (
                <SlotDropZone
                  key={`slot-${i}`}
                  slotId={`slot-${categoryKey}-${i}`}
                  showPlaceholder={dropTarget != null && dropTargetMatchesSection && dropTarget.index === i}
                />
              ))}
            </div>
          )}
        </div>
        <div className={cn('relative hidden lg:block', showSlotOverlay && 'touch-none')}>
          <div className="grid grid-cols-2 gap-3">
{list.slice(0, limit).map(folder =>
              String(folder.id) === String(activeFolderId) ? (
                <FolderSlotPlaceholder key={folder.id} showDragHandle={showFolderDragHandle} />
              ) : (
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
                onMoveBook={onMoveBook}
                allFolders={allFolders}
                onOpenCreateCategory={handleOpenCreateCategory}
                />
              )
            )}
            {showCollapse && (
              <div
                className={`col-span-2 expandable-section ${isExpanded ? 'expandable-section--open' : 'expandable-section--closed'}`}
              >
                <div className="grid grid-cols-2 gap-3">
                  {list.slice(limit).map(folder =>
                    String(folder.id) === String(activeFolderId) ? (
                      <FolderSlotPlaceholder key={folder.id} showDragHandle={showFolderDragHandle} />
                    ) : (
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
                onMoveBook={onMoveBook}
                allFolders={allFolders}
                onOpenCreateCategory={handleOpenCreateCategory}
                      />
                    )
                  )}
                </div>
              </div>
            )}
          </div>
          {showSlotOverlay && (
            <div className="absolute inset-0 z-10 grid grid-cols-2 gap-3 pointer-events-none [&>div]:pointer-events-auto">
              {Array.from({ length: slotCount }, (_, i) => (
                <SlotDropZone
                  key={`slot-${i}`}
                  slotId={`slot-${categoryKey}-${i}`}
                  showPlaceholder={dropTarget != null && dropTargetMatchesSection && dropTarget.index === i}
                />
              ))}
            </div>
          )}
        </div>
        {showCollapse && (
          <div className="mt-3 flex justify-center">
            <ExpandMoreButton onClick={onToggleExpand}>
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
            </ExpandMoreButton>
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
            <h1 className="text-3xl font-serif font-semibold">My Reading Shelf</h1>
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
          <h1 className="text-3xl font-serif font-semibold">My Reading Shelf</h1>
          <p className="text-muted-foreground mt-1">
            {hasCategories ? 'Organiza tus carpetas en categorías y ordena por arrastre' : 'Organiza tus libros en carpetas. Arrastra para ordenar.'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" className="gap-2 h-10 shrink-0" onClick={() => { setCreateCategoryFromFolderId(null); setCreateCategoryOpen(true); setNewCategoryName(''); }}>
            <Tag className="w-4 h-4 shrink-0" />
            <span className="sm:hidden">Categoría</span>
            <span className="hidden sm:inline">Nueva categoría</span>
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
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={allFolderIds.map(id => `folder-${id}`)} strategy={rectSortingStrategy}>
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
            (() => {
              const uncatList = sections.uncategorized;
              const uncatSlotCount = uncatList.length + 1;
              return (
                <div className="relative">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {uncatList.map(folder =>
                      String(folder.id) === String(activeFolderId) ? (
                        <FolderSlotPlaceholder key={folder.id} showDragHandle={showFolderDragHandle} />
                      ) : (
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
                onMoveBook={onMoveBook}
                allFolders={allFolders}
                onOpenCreateCategory={handleOpenCreateCategory}
                        />
                      )
                    )}
                  </div>
                  {activeFolderId != null && (
                    <div className="absolute inset-0 z-10 grid grid-cols-1 lg:grid-cols-2 gap-4 pointer-events-none [&>div]:pointer-events-auto">
                      {Array.from({ length: uncatSlotCount }, (_, i) => (
                        <SlotDropZone
                          key={`slot-${i}`}
                          slotId={`slot-uncategorized-${i}`}
                          showPlaceholder={dropTarget != null && dropTarget.categoryId === null && dropTarget.index === i}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })()
          )}
        </SortableContext>

        <DragOverlay dropAnimation={null} modifiers={[snapLeftHandleToCursor]}>
          {activeFolderId ? (
            <div className="opacity-95 shadow-lg touch-none select-none flex items-start rounded-lg overflow-hidden border border-border bg-card shrink-0" style={{ touchAction: 'none', width: overlayWidth ?? undefined, minWidth: overlayWidth != null ? undefined : 280, maxWidth: overlayWidth != null ? undefined : 'min(400px, 90vw)' }}>
              {showFolderDragHandle && (
                <div className="shrink-0 w-10 h-[102px] border-y border-l border-border border-r-0 rounded-l-lg rounded-r-none bg-muted/30 flex items-center justify-center" aria-hidden>
                  <GripVertical className="w-4 h-4 text-muted-foreground" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <FolderCard
                  folder={folders.find(f => String(f.id) === String(activeFolderId))!}
                  books={getBooksByFolder(activeFolderId)}
                  leftAttached={showFolderDragHandle}
                  onUpdate={onUpdateFolder}
                  onDelete={onDeleteFolder}
                  onUploadBook={onUploadBook}
                  onToggleBookRead={onToggleBookRead}
                  onSetBookState={onSetBookState}
                  onRenameBook={onRenameBook}
                  onDeleteBook={onDeleteBook}
                  onProgressUpdate={onProgressUpdate}
                  getBookUrl={getBookUrl}
                  onMoveBook={onMoveBook}
                  allFolders={allFolders}
                  onOpenCreateCategory={handleOpenCreateCategory}
                />
              </div>
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
        <AlertDialogContent className="max-h-[85vh] overflow-y-auto">
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
