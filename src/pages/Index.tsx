import { useAuth, AuthProvider } from '@/hooks/useAuth';
import { AuthForm } from '@/components/AuthForm';
import { MainLayout } from '@/components/MainLayout';

function AppContent() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <img src="/icon-dark.png" alt="My Reading Shelf" className="w-16 h-16 object-contain animate-pulse" />
      </div>
    );
  }

  if (!user) {
    return <AuthForm />;
  }

  return <MainLayout />;
}

const Index = () => {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
};

export default Index;
