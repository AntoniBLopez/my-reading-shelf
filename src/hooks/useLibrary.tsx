import { useState, useEffect, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Folder, Book } from '@/types/library';
import { toast } from 'sonner';
import {
  getLocalFolders,
  setLocalFolders,
  getLocalBooks,
  setLocalBooks,
  savePdfBlob,
  getPdfBlobUrl,
  deletePdfBlob,
  LOCAL_USER_ID,
} from '@/lib/localStorage';

export function useLibrary() {
  const { user } = useAuth();
  const [folders, setFolders] = useState<Folder[]>([]);
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);

  const isLocal = !user || !isSupabaseConfigured() || user.id === LOCAL_USER_ID;

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

  useEffect(() => {
    if (user) {
      setLoading(true);
      if (isLocal) {
        setFolders(getLocalFolders());
        setBooks(getLocalBooks());
        setLoading(false);
      } else {
        Promise.all([fetchFolders(), fetchBooks()]).finally(() => setLoading(false));
      }
    }
  }, [user, isLocal, fetchFolders, fetchBooks]);

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
      toast.success('Carpeta creada');
      return folder;
    }
    if (!supabase) return null;
    const { data, error } = await supabase
      .from('folders')
      .insert({ name, description, user_id: user.id })
      .select()
      .single();
    if (error) {
      toast.error('Error al crear carpeta');
      console.error(error);
      return null;
    }
    setFolders(prev => [data, ...prev]);
    toast.success('Carpeta creada');
    return data;
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

  const deleteFolder = async (id: string) => {
    if (isLocal) {
      const nextFolders = getLocalFolders().filter(f => f.id !== id);
      const nextBooks = getLocalBooks().filter(b => b.folder_id !== id);
      setLocalFolders(nextFolders);
      setLocalBooks(nextBooks);
      setFolders(nextFolders);
      setBooks(nextBooks);
      toast.success('Carpeta eliminada');
      return true;
    }
    if (!supabase) return false;
    const { error } = await supabase.from('folders').delete().eq('id', id);
    if (error) {
      toast.error('Error al eliminar carpeta');
      console.error(error);
      return false;
    }
    setFolders(prev => prev.filter(f => f.id !== id));
    setBooks(prev => prev.filter(b => b.folder_id !== id));
    toast.success('Carpeta eliminada');
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

  const toggleBookRead = async (id: string, isRead: boolean) => {
    const updates = {
      is_read: isRead,
      read_at: isRead ? new Date().toISOString() : null,
    };
    if (isLocal) {
      const next = getLocalBooks().map(b => (b.id === id ? { ...b, ...updates } : b));
      setLocalBooks(next);
      setBooks(next);
      toast.success(isRead ? '¡Libro marcado como leído!' : 'Libro marcado como pendiente');
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
    toast.success(isRead ? '¡Libro marcado como leído!' : 'Libro marcado como pendiente');
    return true;
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
    if (isLocal) {
      await deletePdfBlob(id);
      const next = getLocalBooks().filter(b => b.id !== id);
      setLocalBooks(next);
      setBooks(next);
      toast.success('Libro eliminado');
      return true;
    }
    if (!supabase) return false;
    await supabase.storage.from('pdfs').remove([book.file_path]);
    const { error } = await supabase.from('books').delete().eq('id', id);
    if (error) {
      toast.error('Error al eliminar libro');
      console.error(error);
      return false;
    }
    setBooks(prev => prev.filter(b => b.id !== id));
    toast.success('Libro eliminado');
    return true;
  };

  const getBooksByFolder = (folderId: string) => books.filter(b => b.folder_id === folderId);

  const stats = {
    totalBooks: books.length,
    readBooks: books.filter(b => b.is_read).length,
    unreadBooks: books.filter(b => !b.is_read).length,
    totalFolders: folders.length,
  };

  return {
    folders,
    books,
    loading,
    stats,
    isLocal,
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
    refreshData: () => Promise.all([fetchFolders(), fetchBooks()]),
  };
}
