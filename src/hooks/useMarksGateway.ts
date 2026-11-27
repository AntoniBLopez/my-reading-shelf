import { useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { LOCAL_USER_ID } from '@/lib/localStorage';
import { supabaseMarks } from '@/lib/marks/remote';
import { createGateway, type MarksGateway } from '@/lib/marks/store';

export function useMarksGateway(): MarksGateway {
  const { user } = useAuth();
  const userId = user?.id ?? LOCAL_USER_ID;
  const remote = useMemo(
    () => (supabase && userId !== LOCAL_USER_ID ? supabaseMarks(supabase) : null),
    [userId],
  );
  return useMemo(() => createGateway(userId, remote), [userId, remote]);
}
