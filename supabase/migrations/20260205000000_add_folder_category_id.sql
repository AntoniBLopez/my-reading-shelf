-- Add category_id to folders so folder-to-category assignment is stored in DB and syncs across devices
ALTER TABLE public.folders
ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES public.folder_categories(id) ON DELETE SET NULL;

-- Optional: index for filtering folders by category
CREATE INDEX IF NOT EXISTS idx_folders_category_id ON public.folders(category_id);
