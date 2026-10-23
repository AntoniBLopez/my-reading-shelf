import { useEffect, useState } from 'react';

const TOUCH_PRIMARY = '(pointer: coarse), (hover: none)';

export function useCoarsePointer() {
  const [coarse, setCoarse] = useState(() => window.matchMedia(TOUCH_PRIMARY).matches);

  useEffect(() => {
    const media = window.matchMedia(TOUCH_PRIMARY);
    const sync = () => setCoarse(media.matches);
    sync();
    media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  }, []);

  return coarse;
}
