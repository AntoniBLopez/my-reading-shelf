/** Drop or resume a reader gesture when the document stops painting. */
export function bindPageTurnRecovery(onHide: () => void, onShow: () => void): () => void {
  const hide = () => onHide();
  const show = () => {
    if (document.visibilityState === 'hidden') return;
    onShow();
  };
  const onVisibility = () => {
    if (document.visibilityState === 'hidden') hide();
    else show();
  };
  const pairs: Array<[EventTarget, string, () => void]> = [
    [document, 'visibilitychange', onVisibility],
    [window, 'pagehide', hide],
    [window, 'pageshow', show],
    [window, 'blur', hide],
    [document, 'freeze', hide],
    [document, 'resume', show],
  ];
  for (const [target, type, handler] of pairs) target.addEventListener(type, handler);
  return () => {
    for (const [target, type, handler] of pairs) target.removeEventListener(type, handler);
  };
}
