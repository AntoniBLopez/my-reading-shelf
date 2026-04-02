import type { Folder, Book, FolderCategory } from '@/types/library';

const FOLDERS_KEY = 'reading-shelf-folders';
const BOOKS_KEY = 'reading-shelf-books';
const CATEGORIES_KEY = 'reading-shelf-categories';
const LAYOUT_KEY = 'reading-shelf-layout';
const OFFLINE_BOOK_UPDATES_KEY = 'reading-shelf-offline-book-updates';
const DB_NAME = 'reading-shelf-pdfs';
const STORE_NAME = 'blobs';

export interface FolderLayout {
  folderPositions: Record<string, { categoryId: string | null; position: number }>;
  categoryOrder: string[];
  /** Por carpeta: orden de ids de libros (solo en app/localStorage). */
  bookOrder: Record<string, string[]>;
}

export interface PendingBookUpdate {
  id: string;
  user_id: string;
  book_id: string;
  updates: Partial<
    Pick<Book, 'title' | 'is_read' | 'read_at' | 'current_page' | 'total_pages' | 'last_viewed_at' | 'folder_id' | 'position'>
  >;
  created_at: string;
}

export function getLocalFolders(): Folder[] {
  try {
    const raw = localStorage.getItem(FOLDERS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function setLocalFolders(folders: Folder[]): void {
  localStorage.setItem(FOLDERS_KEY, JSON.stringify(folders));
}

export function getLocalCategories(): FolderCategory[] {
  try {
    const raw = localStorage.getItem(CATEGORIES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function setLocalCategories(categories: FolderCategory[]): void {
  localStorage.setItem(CATEGORIES_KEY, JSON.stringify(categories));
}

export function getLocalFolderLayout(): FolderLayout {
  try {
    const raw = localStorage.getItem(LAYOUT_KEY);
    if (!raw) return { folderPositions: {}, categoryOrder: [], bookOrder: {} };
    const parsed = JSON.parse(raw) as FolderLayout;
    return {
      folderPositions: parsed.folderPositions ?? {},
      categoryOrder: parsed.categoryOrder ?? [],
      bookOrder: parsed.bookOrder ?? {},
    };
  } catch {
    return { folderPositions: {}, categoryOrder: [], bookOrder: {} };
  }
}

export function setLocalFolderLayout(layout: FolderLayout): void {
  localStorage.setItem(LAYOUT_KEY, JSON.stringify(layout));
}

export function getLocalBooks(): Book[] {
  try {
    const raw = localStorage.getItem(BOOKS_KEY);
    const data = raw ? JSON.parse(raw) : [];
    return data.map((b: Book) => ({
      ...b,
      current_page: b.current_page ?? 0,
      total_pages: b.total_pages ?? 0,
    }));
  } catch {
    return [];
  }
}

export function setLocalBooks(books: Book[]): void {
  localStorage.setItem(BOOKS_KEY, JSON.stringify(books));
}

export function getPendingBookUpdates(userId?: string): PendingBookUpdate[] {
  try {
    const raw = localStorage.getItem(OFFLINE_BOOK_UPDATES_KEY);
    const data = raw ? (JSON.parse(raw) as PendingBookUpdate[]) : [];
    if (!userId) return data;
    return data.filter((item) => item.user_id === userId);
  } catch {
    return [];
  }
}

export function setPendingBookUpdates(queue: PendingBookUpdate[]): void {
  localStorage.setItem(OFFLINE_BOOK_UPDATES_KEY, JSON.stringify(queue));
}

export function enqueuePendingBookUpdate(item: Omit<PendingBookUpdate, 'id' | 'created_at'>): PendingBookUpdate {
  const all = getPendingBookUpdates();
  const existingIndex = all.findIndex(
    (q) => q.user_id === item.user_id && q.book_id === item.book_id
  );
  const now = new Date().toISOString();

  if (existingIndex >= 0) {
    const updated: PendingBookUpdate = {
      ...all[existingIndex],
      updates: { ...all[existingIndex].updates, ...item.updates },
      created_at: now,
    };
    all[existingIndex] = updated;
    setPendingBookUpdates(all);
    return updated;
  }

  const created: PendingBookUpdate = {
    id: crypto.randomUUID(),
    user_id: item.user_id,
    book_id: item.book_id,
    updates: item.updates,
    created_at: now,
  };
  setPendingBookUpdates([...all, created]);
  return created;
}

export function removePendingBookUpdates(ids: string[]): void {
  if (!ids.length) return;
  const idSet = new Set(ids);
  const all = getPendingBookUpdates();
  setPendingBookUpdates(all.filter((q) => !idSet.has(q.id)));
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE_NAME, { keyPath: 'id' });
    };
  });
}

export async function savePdfBlob(id: string, file: Blob): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.put({ id, blob: file });
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => reject(tx.error);
  });
}

export async function getPdfBlobUrl(id: string): Promise<string | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(id);
    req.onsuccess = () => {
      db.close();
      const row = req.result;
      if (row?.blob instanceof Blob) {
        resolve(URL.createObjectURL(row.blob));
      } else {
        resolve(null);
      }
    };
    req.onerror = () => reject(req.error);
  });
}

export async function getPdfBlob(id: string): Promise<Blob | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(id);
    req.onsuccess = () => {
      db.close();
      const row = req.result;
      if (row?.blob instanceof Blob) resolve(row.blob);
      else resolve(null);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function hasPdfBlob(id: string): Promise<boolean> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.getKey(id);
    req.onsuccess = () => {
      db.close();
      resolve(req.result != null);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function deletePdfBlob(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => reject(tx.error);
  });
}

export const LOCAL_USER_ID = 'local';
