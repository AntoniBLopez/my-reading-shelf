import { useCallback, useState } from 'react';
import {
  readLastSignInMethod,
  writeLastSignInMethod,
  type SignInMethod,
} from '@/lib/lastSignInMethod';

export function useLastSignInMethod() {
  const [lastSignInMethod, setLastSignInMethod] = useState<SignInMethod | null>(() => readLastSignInMethod());

  const rememberSignInMethod = useCallback((method: SignInMethod) => {
    writeLastSignInMethod(method);
    setLastSignInMethod(method);
  }, []);

  return { lastSignInMethod, rememberSignInMethod };
}
