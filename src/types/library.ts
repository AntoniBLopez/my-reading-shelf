export interface Folder {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

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
