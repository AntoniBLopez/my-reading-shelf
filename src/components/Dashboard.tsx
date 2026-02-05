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
}

export function Dashboard({ stats }: DashboardProps) {
  const readPercentage = stats.totalBooks > 0 
    ? Math.round((stats.readBooks / stats.totalBooks) * 100) 
    : 0;

  const statCards = [
    {
      title: 'Total de Libros',
      value: stats.totalBooks,
      icon: BookOpen,
      color: 'text-primary',
      bgColor: 'bg-primary/10',
    },
    {
      title: 'Libros Leídos',
      value: stats.readBooks,
      icon: BookCheck,
      color: 'text-success',
      bgColor: 'bg-success/10',
    },
    {
      title: 'Por Leer',
      value: stats.unreadBooks,
      icon: Clock,
      color: 'text-accent',
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
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-serif font-semibold">Dashboard</h1>
        <p className="text-muted-foreground mt-1">Resumen de tu biblioteca personal</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat) => (
          <Card key={stat.title} className="shadow-card hover:shadow-hover transition-shadow duration-300">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.title}
              </CardTitle>
              <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                <stat.icon className={`w-4 h-4 ${stat.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-serif font-bold">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="shadow-card">
        <CardHeader>
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-primary" />
            <CardTitle className="font-serif">Progreso de Lectura</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
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
