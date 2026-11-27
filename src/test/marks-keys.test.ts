import { describe, expect, it } from 'vitest';
import { isFullscreenKey, isToggleKey, isTypingTarget } from '@/lib/keyboard';
import { isMarkWordKey, isReviewPanelKey } from '@/lib/marks/keys';
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
});
