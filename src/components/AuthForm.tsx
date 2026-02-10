import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { BookOpen, Mail, Lock, Loader2 } from 'lucide-react';

const MIN_PASSWORD_LENGTH = 8;
const PASSWORD_REQUIREMENTS = 'Al menos una minúscula, una mayúscula, un número y un carácter especial.';

function validatePassword(password: string): { valid: boolean; message?: string } {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return { valid: false, message: `Mínimo ${MIN_PASSWORD_LENGTH} caracteres. ${PASSWORD_REQUIREMENTS}` };
  }
  if (!/[a-z]/.test(password)) {
    return { valid: false, message: `Falta una minúscula. ${PASSWORD_REQUIREMENTS}` };
  }
  if (!/[A-Z]/.test(password)) {
    return { valid: false, message: `Falta una mayúscula. ${PASSWORD_REQUIREMENTS}` };
  }
  if (!/[0-9]/.test(password)) {
    return { valid: false, message: `Falta un número. ${PASSWORD_REQUIREMENTS}` };
  }
  if (!/[^a-zA-Z0-9]/.test(password)) {
    return { valid: false, message: `Falta un carácter especial (ej. !@#$%). ${PASSWORD_REQUIREMENTS}` };
  }
  return { valid: true };
}

export function AuthForm() {
  const [isLogin, setIsLogin] = useState(true);
  const [forgotPassword, setForgotPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn, signUp, resetPassword } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (forgotPassword) {
      setLoading(true);
      try {
        const { error } = await resetPassword(email);
        if (error) {
          toast.error(error.message);
        } else {
          toast.success('Revisa tu email: te hemos enviado un enlace para restablecer la contraseña.');
          setForgotPassword(false);
        }
      } finally {
        setLoading(false);
      }
      return;
    }
    if (!isLogin) {
      const result = validatePassword(password);
      if (!result.valid) {
        toast.error(result.message);
        return;
      }
    }
    setLoading(true);

    try {
      if (isLogin) {
        const { error } = await signIn(email, password);
        if (error) {
          toast.error(error.message);
        } else {
          toast.success('¡Bienvenido de vuelta!');
        }
      } else {
        const { error } = await signUp(email, password);
        if (error) {
          toast.error(error.message);
        } else {
          toast.success('¡Cuenta creada! Revisa tu email para confirmar.');
        }
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md shadow-book animate-fade-in">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 gradient-hero rounded-2xl flex items-center justify-center shadow-lg">
            <BookOpen className="w-8 h-8 text-primary-foreground" />
          </div>
          <div>
            <CardTitle className="text-3xl font-serif">My Reading Shelf</CardTitle>
            <CardDescription className="text-base mt-2">
              {forgotPassword
                ? 'Te enviaremos un enlace para restablecer tu contraseña'
                : isLogin
                  ? 'Accede a tu colección de libros'
                  : 'Crea tu biblioteca personal'}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium">
                Email
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="tu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10"
                  required
                />
              </div>
            </div>
            {!forgotPassword && (
              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-medium">
                  Contraseña
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    placeholder={isLogin ? '••••••••' : 'Mín. 8 caracteres, mayúscula, minúscula, número y símbolo'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10"
                    required
                    minLength={isLogin ? 6 : MIN_PASSWORD_LENGTH}
                  />
                </div>
                {!isLogin && (
                  <p className="text-xs text-muted-foreground">
                    {PASSWORD_REQUIREMENTS}
                  </p>
                )}
              </div>
            )}
            <Button
              type="submit"
              className="w-full gradient-hero text-primary-foreground hover:opacity-90 transition-opacity"
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : null}
              {forgotPassword ? 'Enviar enlace' : isLogin ? 'Iniciar Sesión' : 'Crear Cuenta'}
            </Button>
          </form>
          <div className="mt-6 text-center space-y-2">
            {forgotPassword ? (
              <button
                type="button"
                onClick={() => setForgotPassword(false)}
                className="text-sm text-muted-foreground hover:text-primary transition-colors block w-full"
              >
                Volver a iniciar sesión
              </button>
            ) : (
              <>
                {isLogin && (
                  <button
                    type="button"
                    onClick={() => setForgotPassword(true)}
                    className="text-sm text-muted-foreground hover:text-primary transition-colors block w-full"
                  >
                    ¿Olvidaste tu contraseña?
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsLogin(!isLogin)}
                  className="text-sm text-muted-foreground hover:text-primary transition-colors"
                >
                  {isLogin ? '¿No tienes cuenta? Regístrate' : '¿Ya tienes cuenta? Inicia sesión'}
                </button>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
