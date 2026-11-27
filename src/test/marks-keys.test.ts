import { describe, expect, it } from 'vitest';
import { isFullscreenKey, isToggleKey, isTypingTarget } from '@/lib/keyboard';
import { isApplePlatform, isMarkWordKey, isReviewPanelKey, markTooltip, panelTooltip } from '@/lib/marks/keys';
import { turnDirectionFromKey } from '@/lib/pageTurnGesture';

describe('word mark shortcuts', () => {
  it('should use Ctrl+Alt+M and Ctrl+Alt+L without taking fullscreen, space, or arrows', () => {
    const mark = { code: 'KeyM', ctrlKey: true, altKey: true };
    const panel = { code: 'KeyL', ctrlKey: true, altKey: true };
    expect(isMarkWordKey(mark)).toBe(true);
    expect(isReviewPanelKey(panel)).toBe(true);
    expect(isFullscreenKey({ key: 'm', ctrlKey: true, altKey: true })).toBe(false);
    expect(isFullscreenKey({ key: 'f' })).toBe(true);
    expect(isMarkWordKey({ code: 'KeyF', ctrlKey: true, altKey: true })).toBe(false);
    expect(isToggleKey({ key: 'm', code: 'KeyM' })).toBe(false);
    expect(isToggleKey({ key: ' ', code: 'Space' })).toBe(true);
    expect(turnDirectionFromKey('ArrowRight')).toBe('next');
    expect(turnDirectionFromKey('m')).toBeNull();
    expect(isMarkWordKey({ code: 'KeyM', ctrlKey: true, altKey: true, shiftKey: true })).toBe(false);
  });

  it('should leave keys inside the review panel to that panel', () => {
    const panel = document.createElement('div');
    panel.setAttribute('data-mark-ui', '');
    const card = document.createElement('article');
    panel.append(card);
    document.body.append(panel);
    expect(isTypingTarget(card)).toBe(true);
    expect(isTypingTarget(document.body)).toBe(false);
    panel.remove();
  });

  it('should show Mac glyphs and keep Ctrl+Alt on other platforms', () => {
    expect(isApplePlatform('Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0)')).toBe(true);
    expect(isApplePlatform('Mozilla/5.0 (Windows NT 10.0)')).toBe(false);
    expect(markTooltip(true)).toBe('Marcar palabra (⌃⌥M)');
    expect(panelTooltip(false)).toBe('Palabras marcadas (Ctrl+Alt+L)');
  });
});
