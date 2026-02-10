-- Create folder_categories table for grouping folders in the library
CREATE TABLE public.folder_categories (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    name TEXT NOT NULL,
    position INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.folder_categories ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view their own folder_categories"
ON public.folder_categories FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own folder_categories"
ON public.folder_categories FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own folder_categories"
ON public.folder_categories FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own folder_categories"
ON public.folder_categories FOR DELETE
USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_folder_categories_updated_at
BEFORE UPDATE ON public.folder_categories
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
