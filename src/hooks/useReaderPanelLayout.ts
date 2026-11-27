import { useLayoutEffect, useState } from 'react';
import { panelLayoutFor, type PanelLayout } from '@/lib/marks/panelLayout';

export function useReaderPanelLayout(node: HTMLElement | null, active: boolean): PanelLayout {
  const [layout, setLayout] = useState<PanelLayout>(() =>
    panelLayoutFor(typeof window === 'undefined' ? 0 : window.innerWidth),
  );

  useLayoutEffect(() => {
    if (!active || !node) return undefined;
    const apply = () => {
      const dialog = node.closest('[role="dialog"]');
      const measured = dialog instanceof HTMLElement ? dialog : node;
      const next = panelLayoutFor(measured.offsetWidth || window.innerWidth);
      setLayout((current) => (current === next ? current : next));
    };
    apply();
    const observer = new ResizeObserver(apply);
    observer.observe(node);
    const dialog = node.closest('[role="dialog"]');
    if (dialog instanceof HTMLElement && dialog !== node) observer.observe(dialog);
    return () => observer.disconnect();
  }, [node, active]);

  return layout;
}
