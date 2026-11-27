-- Per-book word marks. One row holds the book's list so offline sync matches reading progress.
CREATE TABLE public.book_word_marks (
    book_id UUID PRIMARY KEY REFERENCES public.books(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    marks JSONB NOT NULL DEFAULT '[]'::jsonb,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.book_word_marks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own word marks"
ON public.book_word_marks FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own word marks"
ON public.book_word_marks FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own word marks"
ON public.book_word_marks FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own word marks"
ON public.book_word_marks FOR DELETE
USING (auth.uid() = user_id);

CREATE TRIGGER update_book_word_marks_updated_at
BEFORE UPDATE ON public.book_word_marks
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
