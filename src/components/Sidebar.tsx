import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from 'next-themes';
import {
  BookOpen,
  LayoutDashboard,
  Library,
  LogOut,
  User,
  Sun,
  Moon,
  PanelLeftClose,
  PanelRightOpen,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type View = 'dashboard' | 'library';

interface SidebarProps {
  currentView: View;
  onViewChange: (view: View) => void;
  /** Llamado al navegar (p. ej. para cerrar el sheet en móvil) */
  onNavigate?: () => void;
  /** Solo desktop: sidebar colapsado (solo se ve el botón para abrir) */
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export function Sidebar({ currentView, onViewChange, onNavigate, collapsed = false, onToggleCollapse }: SidebarProps) {
  const { user, signOut, isLocalOnly } = useAuth();
  const { theme, setTheme } = useTheme();

  const navItems = [
    { id: 'dashboard' as View, label: 'Dashboard', icon: LayoutDashboard },
    { id: 'library' as View, label: 'Biblioteca', icon: Library },
  ];

  const handleNavClick = (view: View) => {
    onViewChange(view);
    onNavigate?.();
  };

  return (
    <div className="w-64 bg-sidebar flex flex-col h-full min-h-0">
      <div className="p-6 border-b border-sidebar-border shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl gradient-hero">
            <BookOpen className="w-6 h-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-serif font-semibold text-lg text-sidebar-foreground">
              My Reading Shell
            </h1>
            <p className="text-xs text-muted-foreground">Tu espacio de lectura</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-1 overflow-auto">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => handleNavClick(item.id)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-left ${
              currentView === item.id
                ? 'bg-sidebar-accent text-sidebar-primary font-medium'
                : 'text-sidebar-foreground hover:bg-sidebar-accent/50'
            }`}
          >
            <item.icon className="w-5 h-5 shrink-0" />
            {item.label}
          </button>
        ))}
      </nav>

      <div className="p-4 border-t border-sidebar-border space-y-3 shrink-0">
        <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-sidebar-accent/50">
          <div className="p-2 rounded-full bg-primary/10 shrink-0">
            <User className="w-4 h-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate text-sidebar-foreground">
              {isLocalOnly ? 'Modo local' : user?.email?.split('@')[0]}
            </p>
            <p className="text-xs text-muted-foreground truncate">
              {isLocalOnly ? 'Datos solo en este dispositivo' : user?.email}
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="w-full justify-start gap-2 text-muted-foreground"
          title={theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
        >
          {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          {theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
        </Button>
        {!isLocalOnly && (
          <Button
            variant="ghost"
            size="sm"
            onClick={signOut}
            className="w-full justify-start gap-2 text-muted-foreground hover:text-destructive"
          >
            <LogOut className="w-4 h-4" />
            Cerrar sesión
          </Button>
        )}
      </div>
        </>
      )}
    </div>
  );
}
