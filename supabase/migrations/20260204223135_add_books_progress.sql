-- Add progress columns to books table for reading position
ALTER TABLE public.books ADD COLUMN IF NOT EXISTS current_page INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.books ADD COLUMN IF NOT EXISTS total_pages INTEGER NOT NULL DEFAULT 0;
