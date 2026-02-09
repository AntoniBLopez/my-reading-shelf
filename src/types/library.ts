export interface FolderCategory {
  id: string;
  user_id: string;
  name: string;
  position: number;
  created_at: string;
  updated_at: string;
}

export interface Folder {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
  /** Orden dentro de la biblioteca o dentro de su categoría (solo en app/localStorage). */
  position?: number;
  /** Id de categoría; null = sin categoría (solo en app/localStorage). */
  category_id?: string | null;
}

/** Estado de lectura del libro (derivado de is_read + current_page en la UI). */
export type BookState = 'Pendiente' | 'En progreso' | 'Leído';

export interface Book {
  id: string;
  user_id: string;
  folder_id: string;
  title: string;
  file_path: string;
  file_name: string;
  is_read: boolean;
  read_at: string | null;
  current_page: number;
  total_pages: number;
  created_at: string;
  updated_at: string;
}

/** Deriva el estado visible a partir de is_read y current_page (sin nueva columna en DB). */
export function getBookState(book: Book): BookState {
  if (book.is_read) return 'Leído';
  const page = book.current_page ?? 0;
  return page > 1 ? 'En progreso' : 'Pendiente';
}
