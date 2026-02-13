import { BookOpen, BookCheck, Clock, FolderOpen, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

interface DashboardProps {
  stats: {
    totalBooks: number;
    readBooks: number;
    unreadBooks: number;
    totalFolders: number;
  };
  onNavigateToLibrary?: () => void;
}

export function Dashboard({ stats, onNavigateToLibrary }: DashboardProps) {
  const readPercentage = stats.totalBooks > 0 
    ? Math.round((stats.readBooks / stats.totalBooks) * 100) 
    : 0;

  const statCards = [
    {
      title: 'Total',
      value: stats.totalBooks,
      icon: BookOpen,
      color: 'text-primary',
      bgColor: 'bg-primary/10',
    },
    {
      title: 'Leídos',
      value: stats.readBooks,
      icon: BookCheck,
      color: 'text-success',
      bgColor: 'bg-success/10',
    },
    {
      title: 'Por Leer',
      value: stats.unreadBooks,
      icon: Clock,
      color: 'text-muted-foreground',
      bgColor: 'bg-accent/20',
    },
    {
      title: 'Carpetas',
      value: stats.totalFolders,
      icon: FolderOpen,
      color: 'text-muted-foreground',
      bgColor: 'bg-muted',
    },
  ];

  return (
    <div className="space-y-4 md:space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl md:text-3xl font-serif font-semibold">Dashboard</h1>
        <p className="text-sm md:text-base text-muted-foreground mt-1">Resumen de tu biblioteca personal</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 md:gap-4">
        {statCards.map((stat) => {
          const isClickable = (stat.title === 'Total' || stat.title === 'Carpetas') && onNavigateToLibrary;
          const card = (
            <Card
              key={stat.title}
              className={`shadow-card hover:shadow-hover transition-shadow duration-300 ${isClickable ? 'cursor-pointer' : ''}`}
              onClick={isClickable ? onNavigateToLibrary : undefined}
              role={isClickable ? 'button' : undefined}
              tabIndex={isClickable ? 0 : undefined}
              onKeyDown={isClickable ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onNavigateToLibrary(); } } : undefined}
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 md:p-6 md:pb-2">
                <CardTitle className="text-xs md:text-sm font-medium text-muted-foreground leading-tight">
                  {stat.title}
                </CardTitle>
                <div className={`p-1.5 md:p-2 rounded-lg shrink-0 ${stat.bgColor}`}>
                  <stat.icon className={`w-3.5 h-3.5 md:w-4 md:h-4 ${stat.color}`} />
                </div>
              </CardHeader>
              <CardContent className="p-3 pt-0 md:p-6 md:pt-0">
                <div className="text-xl md:text-3xl font-serif font-bold">{stat.value}</div>
              </CardContent>
            </Card>
          );
          return card;
        })}
      </div>

      <Card className="shadow-card">
        <CardHeader className="p-4 md:p-6">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 md:w-5 md:h-5 text-primary shrink-0" />
            <CardTitle className="font-serif text-lg md:text-2xl">Progreso de Lectura</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 p-4 pt-0 md:p-6 md:pt-0">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Libros leídos</span>
            <span className="font-medium">{readPercentage}%</span>
          </div>
          <Progress value={readPercentage} className="h-3" />
          <p className="text-sm text-muted-foreground">
            Has leído {stats.readBooks} de {stats.totalBooks} libros en tu biblioteca
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
