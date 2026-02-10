-- Add position to folders so order within category/uncategorized is stored in DB and syncs across devices
ALTER TABLE public.folders
ADD COLUMN IF NOT EXISTS position INTEGER NOT NULL DEFAULT 0;

-- Index for ordering folders by category and position
CREATE INDEX IF NOT EXISTS idx_folders_category_position ON public.folders(category_id, position);
