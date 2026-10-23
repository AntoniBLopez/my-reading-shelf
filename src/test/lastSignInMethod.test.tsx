import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { AuthProvider, useAuth } from '@/hooks/useAuth';
import {
  LAST_SIGN_IN_METHOD_KEY,
  lastSignInMethodCaption,
  readLastSignInMethod,
  writeLastSignInMethod,
} from '@/lib/lastSignInMethod';

function SignOutButton() {
  const { signOut } = useAuth();
  return (
    <button type="button" onClick={() => void signOut()}>
      Salir
    </button>
  );
}

describe('last sign-in method storage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('stores a method in its own key and ignores anything else', () => {
    expect(readLastSignInMethod()).toBeNull();

    writeLastSignInMethod('email');
    expect(localStorage.getItem(LAST_SIGN_IN_METHOD_KEY)).toBe('email');
    expect(readLastSignInMethod()).toBe('email');

    localStorage.setItem(LAST_SIGN_IN_METHOD_KEY, 'github');
    expect(readLastSignInMethod()).toBeNull();

    writeLastSignInMethod('google');
    expect(readLastSignInMethod()).toBe('google');
    expect(lastSignInMethodCaption('google')).toBe('La última vez iniciaste sesión con Google');
    expect(lastSignInMethodCaption('email')).toBe('La última vez iniciaste sesión con Email');
  });

  it('leaves the key in place when other storage is removed and when signing out', () => {
    writeLastSignInMethod('email');
    localStorage.setItem('reading-shelf-folders', '[]');
    localStorage.removeItem('reading-shelf-folders');

    render(
      <AuthProvider>
        <SignOutButton />
      </AuthProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Salir' }));

    expect(localStorage.getItem(LAST_SIGN_IN_METHOD_KEY)).toBe('email');
    expect(readLastSignInMethod()).toBe('email');
  });

  it('does not throw when storage is blocked', () => {
    const getItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });

    expect(readLastSignInMethod()).toBeNull();
    expect(() => writeLastSignInMethod('email')).not.toThrow();

    getItem.mockRestore();
    setItem.mockRestore();
  });
});
