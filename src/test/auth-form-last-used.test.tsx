import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { AuthForm } from '@/components/AuthForm';
import { LastUsedSignInControl } from '@/components/auth/LastUsedSignInMarker';
import { LAST_SIGN_IN_METHOD_KEY } from '@/lib/lastSignInMethod';

const { signIn, signUp, resetPassword } = vi.hoisted(() => ({
  signIn: vi.fn(),
  signUp: vi.fn(),
  resetPassword: vi.fn(),
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ signIn, signUp, resetPassword }),
}));

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

describe('AuthForm last used sign-in marker', () => {
  beforeEach(() => {
    localStorage.clear();
    signIn.mockReset();
    signUp.mockReset();
    resetPassword.mockReset();
    signIn.mockResolvedValue({ error: null });
    signUp.mockResolvedValue({ error: null });
    resetPassword.mockResolvedValue({ error: null });
  });

  it('GIVEN a stored email sign-in WHEN the sign-in view is shown THEN the email field is marked', async () => {
    localStorage.setItem(LAST_SIGN_IN_METHOD_KEY, 'email');
    render(<AuthForm />);

    const email = screen.getByLabelText('Email');
    expect(email).toHaveClass('last-used-sign-in');
    expect(email).toHaveAttribute('data-last-used', 'true');
    expect(email.className).toContain('pl-10');
    expect(screen.getByTestId('last-used-sign-in-caption')).toHaveTextContent(
      'La última vez iniciaste sesión con Email',
    );
    expect(screen.getByRole('button', { name: 'Iniciar Sesión' })).not.toHaveClass('last-used-sign-in');

    fireEvent.click(screen.getByRole('button', { name: '¿No tienes cuenta? Regístrate' }));
    expect(screen.queryByTestId('last-used-sign-in-caption')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Email')).not.toHaveClass('last-used-sign-in');

    fireEvent.click(screen.getByRole('button', { name: '¿Ya tienes cuenta? Inicia sesión' }));
    fireEvent.click(screen.getByRole('button', { name: '¿Olvidaste tu contraseña?' }));
    expect(screen.queryByTestId('last-used-sign-in-caption')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Email')).not.toHaveClass('last-used-sign-in');
  });

  it('GIVEN no stored method WHEN the form renders THEN no marker is shown', () => {
    render(<AuthForm />);
    expect(screen.queryByTestId('last-used-sign-in-caption')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Email')).not.toHaveClass('last-used-sign-in');
  });

  it('GIVEN the sign-in view WHEN email sign-in succeeds THEN the method is stored', async () => {
    signIn.mockResolvedValueOnce({ error: new Error('Credenciales incorrectas') });
    render(<AuthForm />);

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'tu@email.com' } });
    fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'secret1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar Sesión' }));
    await vi.waitFor(() => {
      expect(signIn).toHaveBeenCalledTimes(1);
      expect(screen.getByRole('button', { name: 'Iniciar Sesión' })).toBeEnabled();
    });
    expect(localStorage.getItem(LAST_SIGN_IN_METHOD_KEY)).toBeNull();

    signIn.mockResolvedValueOnce({ error: null });
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar Sesión' }));
    await vi.waitFor(() => {
      expect(localStorage.getItem(LAST_SIGN_IN_METHOD_KEY)).toBe('email');
    });
  });

  it('GIVEN sign-up or a reset link WHEN it succeeds THEN no method is stored', async () => {
    const { unmount } = render(<AuthForm />);

    fireEvent.click(screen.getByRole('button', { name: '¿No tienes cuenta? Regístrate' }));
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'tu@email.com' } });
    fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'Secret1!' } });
    fireEvent.click(screen.getByRole('button', { name: 'Crear Cuenta' }));
    await vi.waitFor(() => {
      expect(signUp).toHaveBeenCalled();
    });
    expect(localStorage.getItem(LAST_SIGN_IN_METHOD_KEY)).toBeNull();

    unmount();
    render(<AuthForm />);
    fireEvent.click(screen.getByRole('button', { name: '¿Olvidaste tu contraseña?' }));
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'tu@email.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar enlace' }));
    await vi.waitFor(() => {
      expect(resetPassword).toHaveBeenCalled();
    });
    expect(localStorage.getItem(LAST_SIGN_IN_METHOD_KEY)).toBeNull();
  });
});

describe('LastUsedSignInControl', () => {
  it('should keep a social button’s own classes and only add the marker', () => {
    render(
      <LastUsedSignInControl active>
        <button type="button" className="border bg-background text-foreground">
          Google
        </button>
      </LastUsedSignInControl>,
    );

    const button = screen.getByRole('button', { name: 'Google' });
    expect(button).toHaveClass('border', 'bg-background', 'text-foreground', 'last-used-sign-in');
    expect(button.parentElement).toHaveClass('last-used-sign-in-glow');
  });
});
