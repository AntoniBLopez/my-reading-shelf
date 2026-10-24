import { describe, expect, it } from 'vitest';
import { isFullscreenKey, isToggleKey, isTypingTarget } from '@/lib/keyboard';

describe('reader keys', () => {
  it('should treat bare f and F as the fullscreen key', () => {
    expect(isFullscreenKey({ key: 'f' })).toBe(true);
    expect(isFullscreenKey({ key: 'F' })).toBe(true);
    expect(isFullscreenKey({ key: 'f', ctrlKey: true })).toBe(false);
    expect(isFullscreenKey({ key: 'F', metaKey: true })).toBe(false);
    expect(isFullscreenKey({ key: 'f', altKey: true })).toBe(false);
    expect(isFullscreenKey({ key: 'F', shiftKey: true })).toBe(false);
    expect(isFullscreenKey({ key: 'g' })).toBe(false);
  });

  it('should treat Space and Enter as the toggle keys', () => {
    expect(isToggleKey({ key: ' ', code: 'Space' })).toBe(true);
    expect(isToggleKey({ key: 'Enter', code: 'Enter' })).toBe(true);
    expect(isToggleKey({ key: 'ArrowLeft', code: 'ArrowLeft' })).toBe(false);
  });

  it('should ignore keys while typing in a field', () => {
    const input = document.createElement('input');
    const area = document.createElement('textarea');
    const editable = document.createElement('div');
    editable.setAttribute('contenteditable', 'true');
    const nested = document.createElement('span');
    editable.append(nested);
    const button = document.createElement('button');
    document.body.append(input, area, editable, button);
    expect(isTypingTarget(input)).toBe(true);
    expect(isTypingTarget(area)).toBe(true);
    expect(isTypingTarget(editable)).toBe(true);
    expect(isTypingTarget(nested)).toBe(true);
    expect(isTypingTarget(button)).toBe(false);
    expect(isTypingTarget(null)).toBe(false);
    input.remove();
    area.remove();
    editable.remove();
    button.remove();
  });
});
