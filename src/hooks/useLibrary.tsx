import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase, isSupabaseConfigured } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Folder, Book, BookState, getBookState, FolderCategory } from '@/types/library';
import { toast } from 'sonner';
import {
  getLocalFolders,
  setLocalFolders,
  getLocalBooks,
  setLocalBooks,
  getLocalCategories,
  setLocalCategories,
  getLocalFolderLayout,
  setLocalFolderLayout,
  type FolderLayout,
  savePdfBlob,
  getPdfBlobUrl,
  deletePdfBlob,
  LOCAL_USER_ID,
} from '@/lib/localStorage';

export function useLibrary() {
  const { user } = useAuth();
  const [folders, setFolders] = useState<Folder[]>([]);
  const [books, setBooks] = useState<Book[]>([]);
  const [categories, setCategories] = useState<FolderCategory[]>([]);
  const [layout, setLayout] = useState<FolderLayout>(() => getLocalFolderLayout());
  const [loading, setLoading] = useState(true);

  const isLocal = !user || !isSupabaseConfigured() || user.id === LOCAL_USER_ID;
  const pendingDeleteRef = useRef<{ id: string; book: Book; timeout: ReturnType<typeof setTimeout>; isLocal: boolean } | null>(null);
  const pendingFolderDeleteRef = useRef<{
    id: string;
    folder: Folder;
    booksInFolder: Book[];
    timeout: ReturnType<typeof setTimeout>;
    isLocal: boolean;
  } | null>(null);

  const fetchFolders = useCallback(async () => {
    if (!user) return;
    if (isLocal) {
      setFolders(getLocalFolders());
      return;
    }
    if (!supabase) return;
    const { data, error } = await supabase
      .from('folders')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) {
      toast.error('Error al cargar carpetas');
      console.error(error);
    } else {
      setFolders(data || []);
    }
  }, [user, isLocal]);

  const fetchBooks = useCallback(async () => {
    if (!user) return;
    if (isLocal) {
      setBooks(getLocalBooks());
      return;
    }
    if (!supabase) return;
    const { data, error } = await supabase
      .from('books')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) {
      toast.error('Error al cargar libros');
      console.error(error);
    } else {
      const booksWithProgress = (data || []).map(book => ({
        ...book,
        current_page: (book as any).current_page ?? 0,
        total_pages: (book as any).total_pages ?? 0,
      })) as Book[];
      setBooks(booksWithProgress);
    }
  }, [user, isLocal]);

  const fetchCategories = useCallback(async () => {
    if (!user) return;
    if (isLocal) {
      setCategories(getLocalCategories());
      return;
    }
    if (!supabase) return;
    const { data, error } = await supabase
      .from('folder_categories')
      .select('*')
      .order('position', { ascending: true });
    if (error) {
      toast.error('Error al cargar categorías');
      console.error(error);
    } else {
      const list = (data || []) as FolderCategory[];
      setCategories(list);
      const order = list.map(c => c.id);
      setLayout(prev => ({ ...prev, categoryOrder: order }));
      const currentLayout = getLocalFolderLayout();
      setLocalFolderLayout({ ...currentLayout, categoryOrder: order });
    }
  }, [user, isLocal]);

  useEffect(() => {
    if (user) {
      setLayout(getLocalFolderLayout());
      setLoading(true);
      if (isLocal) {
        setCategories(getLocalCategories());
        setFolders(getLocalFolders());
        setBooks(getLocalBooks());
        setLoading(false);
      } else {
        Promise.all([fetchFolders(), fetchBooks(), fetchCategories()]).finally(() => setLoading(false));
      }
    }
  }, [user, isLocal, fetchFolders, fetchBooks, fetchCategories]);

  const createFolder = async (name: string, description?: string) => {
    if (!user) return null;
    const now = new Date().toISOString();
    const folder: Folder = {
      id: crypto.randomUUID(),
      user_id: user.id,
      name,
      description: description ?? null,
      created_at: now,
      updated_at: now,
    };
    if (isLocal) {
      const next = [folder, ...getLocalFolders()];
      setLocalFolders(next);
      setFolders(next);
      const newPositions = { ...layout.folderPositions };
      newPositions[folder.id] = { categoryId: null, position: 0 };
      Object.keys(newPositions).forEach(id => {
        if (id !== folder.id && newPositions[id].categoryId === null) newPositions[id] = { ...newPositions[id], position: newPositions[id].position + 1 };
      });
      const newLayout = { ...layout, folderPositions: newPositions };
      setLayout(newLayout);
      setLocalFolderLayout(newLayout);
      toast.success('Carpeta creada');
      return folder;
    }
    if (!supabase) return null;
    const { data, error } = await supabase
      .from('folders')
      .insert({ name, description, user_id: user.id, category_id: null, position: 0 })
      .select()
      .single();
    if (error) {
      toast.error('Error al crear carpeta');
      console.error(error);
      return null;
    }
    const newFolder = { ...data, category_id: null, position: 0 } as Folder;
    const uncategorized = folders.filter(f => !f.category_id);
    if (uncategorized.length > 0) {
      await Promise.all(
        uncategorized.map(f => supabase.from('folders').update({ position: (f.position ?? 0) + 1 }).eq('id', f.id))
      );
    }
    setFolders(prev => [
      newFolder,
      ...prev.map(f => (f.category_id ? f : { ...f, position: (f.position ?? 0) + 1 })),
    ]);
    toast.success('Carpeta creada');
    return newFolder;
  };

  const updateFolder = async (id: string, updates: Partial<Pick<Folder, 'name' | 'description'>>) => {
    if (isLocal) {
      const next = getLocalFolders().map(f => (f.id === id ? { ...f, ...updates } : f));
      setLocalFolders(next);
      setFolders(next);
      toast.success('Carpeta actualizada');
      return true;
    }
    if (!supabase) return false;
    const { error } = await supabase.from('folders').update(updates).eq('id', id);
    if (error) {
      toast.error('Error al actualizar carpeta');
      console.error(error);
      return false;
    }
    setFolders(prev => prev.map(f => (f.id === id ? { ...f, ...updates } : f)));
    toast.success('Carpeta actualizada');
    return true;
  };

  const runPendingLocalFolderDelete = () => {
    if (!pendingFolderDeleteRef.current) return;
    const { booksInFolder: pendingBooks } = pendingFolderDeleteRef.current;
    pendingFolderDeleteRef.current = null;
    pendingBooks.forEach(b => deletePdfBlob(b.id));
  };

  const deleteFolder = async (id: string) => {
    const folder = folders.find(f => f.id === id);
    if (!folder) return false;
    const booksInFolder = books.filter(b => b.folder_id === id);

    if (pendingFolderDeleteRef.current) {
      runPendingLocalFolderDelete();
    }

    const isLocalDelete = isLocal;
    const nextFolders = folders.filter(f => f.id !== id);
    const nextBooks = books.filter(b => b.folder_id !== id);
    setFolders(nextFolders);
    setBooks(nextBooks);
    if (isLocalDelete) {
      setLocalFolders(nextFolders);
      setLocalBooks(nextBooks);
    }

    if (!isLocalDelete && supabase) {
      try {
        for (const b of booksInFolder) {
          await supabase.storage.from('pdfs').remove([b.file_path]);
          const { error: bookErr } = await supabase.from('books').delete().eq('id', b.id);
          if (bookErr) throw bookErr;
        }
        const { error: folderErr } = await supabase.from('folders').delete().eq('id', id);
        if (folderErr) throw folderErr;
        toast.success('Carpeta eliminada');
        return true;
      } catch (err) {
        setFolders(prev => (prev.some(f => f.id === id) ? prev : [folder, ...prev]));
        setBooks(prev => {
          const restored = booksInFolder.filter(b => !prev.some(p => p.id === b.id));
          return restored.length ? [...restored, ...prev] : prev;
        });
        toast.error('Error al eliminar la carpeta');
        console.error(err);
        return false;
      }
    }

    const timeout = setTimeout(runPendingLocalFolderDelete, 5000);
    pendingFolderDeleteRef.current = { id, folder, booksInFolder, timeout, isLocal: true };

    toast.success('Carpeta eliminada', {
      duration: 5000,
      action: {
        label: 'Deshacer',
        onClick: () => {
          if (!pendingFolderDeleteRef.current || pendingFolderDeleteRef.current.id !== id) return;
          clearTimeout(pendingFolderDeleteRef.current.timeout);
          pendingFolderDeleteRef.current = null;
          setFolders(prev => {
            const exists = prev.some(f => f.id === id);
            return exists ? prev : [folder, ...prev];
          });
          setBooks(prev => {
            const restored = booksInFolder.filter(b => !prev.some(p => p.id === b.id));
            return restored.length ? [...restored, ...prev] : prev;
          });
          const localFolders = getLocalFolders();
          if (!localFolders.some(f => f.id === id)) setLocalFolders([folder, ...localFolders]);
          const localBooks = getLocalBooks();
          const toRestore = booksInFolder.filter(b => !localBooks.some(lb => lb.id === b.id));
          if (toRestore.length) setLocalBooks([...toRestore, ...localBooks]);
        },
      },
    });

    return true;
  };

  const uploadBook = async (folderId: string, file: File, title: string) => {
    if (!user) return null;
    const now = new Date().toISOString();
    const bookId = crypto.randomUUID();

    if (isLocal) {
      await savePdfBlob(bookId, file);
      const book: Book = {
        id: bookId,
        folder_id: folderId,
        user_id: user.id,
        title,
        file_path: `local://${bookId}`,
        file_name: file.name.toLowerCase(),
        is_read: false,
        read_at: null,
        current_page: 0,
        total_pages: 0,
        created_at: now,
        updated_at: now,
      };
      const nextBooks = [book, ...getLocalBooks()];
      setLocalBooks(nextBooks);
      setBooks(nextBooks);
      toast.success('Libro añadido');
      return book;
    }
    if (!supabase) return null;
    const fileExt = file.name.split('.').pop();
    const filePath = `${user.id}/${folderId}/${Date.now()}.${fileExt}`;
    const { error: uploadError } = await supabase.storage.from('pdfs').upload(filePath, file);
    if (uploadError) {
      toast.error('Error al subir el archivo');
      console.error(uploadError);
      return null;
    }
    const { data, error } = await supabase
      .from('books')
      .insert({
        folder_id: folderId,
        user_id: user.id,
        title,
        file_path: filePath,
        file_name: file.name.toLowerCase(),
      })
      .select()
      .single();
    if (error) {
      toast.error('Error al guardar el libro');
      console.error(error);
      return null;
    }
    const bookWithProgress: Book = {
      ...data,
      current_page: (data as any).current_page ?? 0,
      total_pages: (data as any).total_pages ?? 0,
    };
    setBooks(prev => [bookWithProgress, ...prev]);
    toast.success('Libro añadido');
    return bookWithProgress;
  };

  const setBookState = async (id: string, state: BookState) => {
    const book = books.find(b => b.id === id);
    if (!book) return false;
    const totalPages = book.total_pages || 1;
    const updates: Partial<Book> =
      state === 'Leído'
        ? {
            is_read: true,
            read_at: new Date().toISOString(),
            current_page: totalPages,
            total_pages: totalPages,
          }
        : state === 'Pendiente'
          ? {
              is_read: false,
              read_at: null,
              current_page: 1,
            }
          : {
              is_read: false,
              read_at: null,
              current_page: book.current_page <= 1 ? 2 : book.current_page,
              total_pages: book.current_page <= 1 ? (book.total_pages || 2) : book.total_pages,
            };
    if (isLocal) {
      const next = getLocalBooks().map(b => (b.id === id ? { ...b, ...updates } : b));
      setLocalBooks(next);
      setBooks(next);
      toast.success(state === 'Leído' ? '¡Libro marcado como leído!' : state === 'Pendiente' ? 'Libro marcado como pendiente' : 'Libro en progreso');
      return true;
    }
    if (!supabase) return false;
    const { error } = await supabase.from('books').update(updates).eq('id', id);
    if (error) {
      toast.error('Error al actualizar estado');
      console.error(error);
      return false;
    }
    setBooks(prev => prev.map(b => (b.id === id ? { ...b, ...updates } : b)));
    toast.success(state === 'Leído' ? '¡Libro marcado como leído!' : state === 'Pendiente' ? 'Libro marcado como pendiente' : 'Libro en progreso');
    return true;
  };

  const toggleBookRead = async (id: string, isRead: boolean) => {
    return setBookState(id, isRead ? 'Leído' : 'Pendiente');
  };

  const updateBook = async (id: string, updates: Partial<Pick<Book, 'title'>>) => {
    if (!updates.title?.trim()) return false;
    if (isLocal) {
      const next = getLocalBooks().map(b => (b.id === id ? { ...b, ...updates } : b));
      setLocalBooks(next);
      setBooks(next);
      toast.success('Libro renombrado');
      return true;
    }
    if (!supabase) return false;
    const { error } = await supabase.from('books').update(updates).eq('id', id);
    if (error) {
      toast.error('Error al renombrar');
      console.error(error);
      return false;
    }
    setBooks(prev => prev.map(b => (b.id === id ? { ...b, ...updates } : b)));
    toast.success('Libro renombrado');
    return true;
  };

  const updateBookProgress = async (id: string, currentPage: number, totalPages: number) => {
    const book = books.find(b => b.id === id);
    if (!book) return false;
    const isRead = currentPage >= totalPages;
    const updates = {
      current_page: currentPage,
      total_pages: totalPages,
      is_read: isRead || book.is_read,
      read_at: isRead && !book.is_read ? new Date().toISOString() : book.read_at,
    };
    if (isLocal) {
      const next = getLocalBooks().map(b => (b.id === id ? { ...b, ...updates } : b));
      setLocalBooks(next);
      setBooks(next);
      return true;
    }
    if (!supabase) return false;
    const { error } = await supabase.from('books').update(updates).eq('id', id);
    if (error) {
      console.error('Error updating progress:', error);
      return false;
    }
    setBooks(prev => prev.map(b => (b.id === id ? { ...b, ...updates } : b)));
    return true;
  };

  const getBookUrl = async (filePath: string): Promise<string | null> => {
    if (filePath.startsWith('local://')) {
      const id = filePath.replace('local://', '');
      return getPdfBlobUrl(id);
    }
    if (!supabase) return null;
    const { data, error } = await supabase.storage.from('pdfs').createSignedUrl(filePath, 3600);
    if (error) {
      console.error('Error getting signed URL:', error);
      return null;
    }
    return data.signedUrl;
  };

  const deleteBook = async (id: string) => {
    const book = books.find(b => b.id === id);
    if (!book) return false;

    const runPendingDelete = async () => {
      const pending = pendingDeleteRef.current;
      if (!pending) return;
      const { id: pendingId, book: pendingBook, isLocal: pendingLocal } = pending;
      pendingDeleteRef.current = null;

      if (pendingLocal) {
        await deletePdfBlob(pendingId);
        return;
      }
      if (!supabase) return;
      try {
        const { error: storageError } = await supabase.storage.from('pdfs').remove([pendingBook.file_path]);
        if (storageError) console.warn('Error eliminando PDF del storage:', storageError);
        const { error: deleteError } = await supabase.from('books').delete().eq('id', pendingId);
        if (deleteError) {
          throw deleteError;
        }
      } catch (err) {
        console.error('Error eliminando libro:', err);
        toast.error('No se pudo eliminar el libro');
        setBooks(prev => {
          const exists = prev.some(b => b.id === pendingId);
          return exists ? prev : [pendingBook, ...prev];
        });
      }
    };

    if (pendingDeleteRef.current) {
      runPendingDelete();
    }

    const isLocalDelete = isLocal;
    const nextBooks = books.filter(b => b.id !== id);
    setBooks(nextBooks);
    if (isLocalDelete) {
      setLocalBooks(nextBooks);
    }

    const timeout = setTimeout(() => {
      runPendingDelete();
    }, 5000);
    pendingDeleteRef.current = { id, book, timeout, isLocal: isLocalDelete };

    toast.success('Libro eliminado', {
      duration: 5000,
      action: {
        label: 'Deshacer',
        onClick: () => {
          if (!pendingDeleteRef.current || pendingDeleteRef.current.id !== id) return;
          clearTimeout(pendingDeleteRef.current.timeout);
          pendingDeleteRef.current = null;
          setBooks(prev => {
            const exists = prev.some(b => b.id === id);
            return exists ? prev : [book, ...prev];
          });
          if (isLocalDelete) {
            const local = getLocalBooks();
            if (!local.some(b => b.id === id)) setLocalBooks([book, ...local]);
          }
        },
      },
    });

    return true;
  };

  const getBooksByFolder = (folderId: string) => {
    const stateOrder: Record<BookState, number> = { 'En progreso': 0, Pendiente: 1, Leído: 2 };
    const inFolder = books.filter(b => b.folder_id === folderId);
    const orderIds = layout.bookOrder?.[folderId];
    if (orderIds?.length) {
      const byId = new Map(inFolder.map(b => [b.id, b]));
      const ordered: Book[] = [];
      for (const id of orderIds) {
        const b = byId.get(id);
        if (b) ordered.push(b);
      }
      inFolder.forEach(b => { if (!orderIds.includes(b.id)) ordered.push(b); });
      return ordered;
    }
    return [...inFolder].sort((a, b) => stateOrder[getBookState(a)] - stateOrder[getBookState(b)]);
  };

  const reorderBooks = (folderId: string, fromIndex: number, toIndex: number) => {
    const ordered = getBooksByFolder(folderId).map(b => b.id);
    if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || fromIndex >= ordered.length || toIndex >= ordered.length) return;
    const next = [...ordered];
    const [removed] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, removed);
    const newBookOrder = { ...layout.bookOrder, [folderId]: next };
    persistLayout({ ...layout, bookOrder: newBookOrder });
  };

  const moveBook = async (bookId: string, targetFolderId: string): Promise<boolean> => {
    const book = books.find(b => b.id === bookId);
    if (!book || book.folder_id === targetFolderId) return false;
    const sourceFolderId = book.folder_id;
    const updates = { folder_id: targetFolderId };
    if (isLocal) {
      const next = getLocalBooks().map(b => (b.id === bookId ? { ...b, ...updates } : b));
      setLocalBooks(next);
      setBooks(next);
    } else if (supabase) {
      const { error } = await supabase.from('books').update(updates).eq('id', bookId);
      if (error) {
        toast.error('Error al mover el libro');
        console.error(error);
        return false;
      }
      setBooks(prev => prev.map(b => (b.id === bookId ? { ...b, ...updates } : b)));
    } else return false;
    const sourceOrder = (layout.bookOrder?.[sourceFolderId] ?? []).filter((id: string) => id !== bookId);
    const targetOrder = layout.bookOrder?.[targetFolderId] ?? getBooksByFolder(targetFolderId).map(b => b.id);
    const newTargetOrder = targetOrder.includes(bookId) ? targetOrder : [...targetOrder, bookId];
    persistLayout({
      ...layout,
      bookOrder: {
        ...layout.bookOrder,
        [sourceFolderId]: sourceOrder,
        [targetFolderId]: newTargetOrder,
      },
    });
    toast.success('Libro movido');
    return true;
  };

  /** Carpetas y categorías ordenadas para la UI: sin categoría primero, luego cada categoría. */
  const getOrderedSections = (): { uncategorized: Folder[]; categories: { category: FolderCategory; folders: Folder[] }[] } => {
    const folderPositions = layout.folderPositions;
    const categoryOrder = layout.categoryOrder;
    // Con Supabase usamos solo la BD como fuente de verdad (category_id y position) para evitar que localStorage rompa la consistencia entre dispositivos
    const withLayout = isLocal
      ? folders.map(f => {
          const key = String(f.id);
          return {
            ...f,
            category_id: folderPositions[key]?.categoryId ?? f.category_id ?? null,
            position: folderPositions[key]?.position ?? f.position ?? 999,
          };
        })
      : folders.map(f => ({
          ...f,
          category_id: f.category_id ?? null,
          position: f.position ?? 999,
        }));
    const uncategorized = withLayout.filter(f => !f.category_id).sort((a, b) => a.position - b.position);
    const sortedCategories = [...categories].sort((a, b) => {
      const ai = categoryOrder.indexOf(a.id);
      const bi = categoryOrder.indexOf(b.id);
      if (ai === -1 && bi === -1) return a.position - b.position;
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    });
    const categoriesWithFolders = sortedCategories.map(cat => ({
      category: cat,
      folders: withLayout.filter(f => f.category_id === cat.id).sort((a, b) => a.position - b.position),
    }));
    return { uncategorized, categories: categoriesWithFolders };
  };

  const persistLayout = (newLayout: FolderLayout) => {
    setLayout(newLayout);
    setLocalFolderLayout(newLayout);
  };

  const createCategory = async (name: string) => {
    if (!user) return null;
    const trimmedName = name.trim();
    if (isLocal) {
      const now = new Date().toISOString();
      const category: FolderCategory = {
        id: crypto.randomUUID(),
        user_id: user.id,
        name: trimmedName,
        position: categories.length,
        created_at: now,
        updated_at: now,
      };
      const next = [...categories, category];
      setCategories(next);
      setLocalCategories(next);
      persistLayout({ ...layout, categoryOrder: [...layout.categoryOrder, category.id] });
      toast.success('Categoría creada');
      return category;
    }
    if (!supabase) return null;
    const { data, error } = await supabase
      .from('folder_categories')
      .insert({ user_id: user.id, name: trimmedName, position: categories.length })
      .select()
      .single();
    if (error) {
      toast.error('Error al crear categoría');
      console.error(error);
      return null;
    }
    const category = data as FolderCategory;
    const next = [...categories, category];
    setCategories(next);
    setLocalCategories(next);
    persistLayout({ ...layout, categoryOrder: [...layout.categoryOrder, category.id] });
    toast.success('Categoría creada');
    return category;
  };

  const updateCategory = async (id: string, updates: Partial<Pick<FolderCategory, 'name'>>) => {
    const next = categories.map(c => (c.id === id ? { ...c, ...updates, updated_at: new Date().toISOString() } : c));
    setCategories(next);
    setLocalCategories(next);
    if (!isLocal && supabase) {
      const { error } = await supabase.from('folder_categories').update(updates).eq('id', id);
      if (error) {
        toast.error('Error al actualizar categoría');
        console.error(error);
        return false;
      }
    }
    toast.success('Categoría actualizada');
    return true;
  };

  const deleteCategory = async (id: string) => {
    if (!isLocal && supabase) {
      const { error: updateError } = await supabase
        .from('folders')
        .update({ category_id: null })
        .eq('category_id', id);
      if (updateError) {
        toast.error('Error al actualizar carpetas');
        console.error(updateError);
        return false;
      }
      const { error } = await supabase.from('folder_categories').delete().eq('id', id);
      if (error) {
        toast.error('Error al eliminar categoría');
        console.error(error);
        return false;
      }
    }
    const nextCategories = categories.filter(c => c.id !== id);
    setCategories(nextCategories);
    setLocalCategories(nextCategories);
    const newPositions = { ...layout.folderPositions };
    Object.keys(newPositions).forEach(fid => {
      if (newPositions[fid].categoryId === id) newPositions[fid] = { categoryId: null, position: newPositions[fid].position };
    });
    persistLayout({
      folderPositions: newPositions,
      categoryOrder: layout.categoryOrder.filter(cid => cid !== id),
    });
    toast.success('Categoría eliminada');
    return true;
  };

  const deleteCategoryWithContents = async (id: string) => {
    const { categories: catsWithFolders } = getOrderedSections();
    const sec = catsWithFolders.find(c => c.category.id === id);
    const folderIds = sec?.folders.map(f => f.id) ?? [];
    for (const fid of folderIds) {
      await deleteFolder(fid);
    }
    if (!isLocal && supabase) {
      const { error } = await supabase.from('folder_categories').delete().eq('id', id);
      if (error) {
        toast.error('Error al eliminar categoría');
        console.error(error);
        return false;
      }
    }
    const nextCategories = categories.filter(c => c.id !== id);
    setCategories(nextCategories);
    setLocalCategories(nextCategories);
    const newPositions = { ...layout.folderPositions };
    folderIds.forEach(fid => delete newPositions[fid]);
    persistLayout({
      folderPositions: newPositions,
      categoryOrder: layout.categoryOrder.filter(cid => cid !== id),
    });
    toast.success('Categoría, carpetas y libros eliminados');
    return true;
  };

  const reorderFolders = (folderId: string, targetCategoryId: string | null, targetIndex: number) => {
    const folderIdStr = String(folderId);
    const folder = folders.find(f => String(f.id) === folderIdStr);
    if (!folder) return;
    const { uncategorized, categories: catsWithFolders } = getOrderedSections();
    const newPositions = { ...layout.folderPositions };

    const targetFolderIds =
      targetCategoryId === null
        ? uncategorized.map(f => String(f.id)).filter(id => id !== folderIdStr)
        : (catsWithFolders.find(c => c.category.id === targetCategoryId)?.folders ?? []).map(f => String(f.id)).filter(id => id !== folderIdStr);
    const inserted = [...targetFolderIds.slice(0, targetIndex), folderIdStr, ...targetFolderIds.slice(targetIndex)];
    inserted.forEach((id, pos) => {
      newPositions[id] = { categoryId: targetCategoryId, position: pos };
    });

    const sourceUncategorized = uncategorized.filter(f => String(f.id) !== folderIdStr);
    sourceUncategorized.forEach((f, pos) => {
      newPositions[String(f.id)] = { categoryId: null, position: pos };
    });

    catsWithFolders.forEach(({ category, folders: catFolders }) => {
      if (category.id === targetCategoryId) {
        inserted.forEach((id, pos) => {
          newPositions[id] = { categoryId: category.id, position: pos };
        });
      } else {
        const inCat = catFolders.filter(f => String(f.id) !== folderIdStr);
        inCat.forEach((f, pos) => {
          newPositions[String(f.id)] = { categoryId: category.id, position: pos };
        });
      }
    });
    persistLayout({ ...layout, folderPositions: newPositions });

    if (!isLocal) {
      setFolders(prev =>
        prev.map(f => {
          const p = newPositions[String(f.id)];
          if (!p) return f;
          return { ...f, category_id: p.categoryId, position: p.position };
        })
      );
    }

    if (!isLocal && supabase) {
      const isValidUuid = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
      const entries = Object.entries(newPositions).filter(([id]) => isValidUuid(id));
      Promise.all(
        entries.map(([id, { categoryId, position }]) =>
          supabase.from('folders').update({ category_id: categoryId, position }).eq('id', id)
        )
      ).then(results => {
        const err = results.find(r => r.error);
        if (err?.error) {
          toast.error('Error al guardar el orden de las carpetas');
          console.error(err.error);
        }
      });
    }
  };

  const reorderCategories = async (categoryIds: string[]) => {
    persistLayout({ ...layout, categoryOrder: categoryIds });
    if (!isLocal && supabase) {
      await Promise.all(
        categoryIds.map((id, index) =>
          supabase.from('folder_categories').update({ position: index }).eq('id', id)
        )
      );
    }
  };

  const stats = {
    totalBooks: books.length,
    readBooks: books.filter(b => b.is_read).length,
    unreadBooks: books.filter(b => !b.is_read).length,
    totalFolders: folders.length,
  };

  return {
    folders,
    books,
    categories,
    loading,
    stats,
    isLocal,
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
    moveBook,
    uploadBook,
    toggleBookRead,
    setBookState,
    updateBook,
    deleteBook,
    getBooksByFolder,
    updateBookProgress,
    getBookUrl,
    refreshData: () => Promise.all([fetchFolders(), fetchBooks(), fetchCategories()]),
  };
}
