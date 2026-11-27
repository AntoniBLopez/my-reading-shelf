import type { SupabaseClient } from '@supabase/supabase-js';
import type { Json } from '@/integrations/supabase/types';
import { sanitizeMarks, type MarksRemote } from './store';
import type { WordMark } from './types';

export function supabaseMarks(client: SupabaseClient): MarksRemote {
  return {
    async pull(userId, bookId) {
      const { data, error } = await client
        .from('book_word_marks')
        .select('marks')
        .eq('book_id', bookId)
        .eq('user_id', userId)
        .maybeSingle();
      if (error || !data) return error ? null : [];
      return sanitizeMarks(data.marks);
    },
    async push(userId, bookId, marks) {
      const { error } = await client.from('book_word_marks').upsert({
        book_id: bookId,
        user_id: userId,
        marks: marks as unknown as Json,
        updated_at: new Date().toISOString(),
      });
      return !error;
    },
  };
}

export type { WordMark };
