import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { FolderPlus, Loader2 } from 'lucide-react';

interface CreateFolderDialogProps {
  onCreate: (name: string, description?: string) => Promise<any>;
}

export function CreateFolderDialog({ onCreate }: CreateFolderDialogProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) return;
    
    setLoading(true);
    const result = await onCreate(name.trim(), description.trim() || undefined);
    setLoading(false);
    
    if (result) {
      setOpen(false);
      setName('');
      setDescription('');
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2 gradient-hero">
          <FolderPlus className="w-4 h-4" />
          Nueva Carpeta
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-serif text-xl">Crear nueva carpeta</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-4 pt-4"
          onSubmit={(e) => {
            e.preventDefault();
            handleCreate();
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="folder-name">Nombre de la carpeta</Label>
            <Input
              id="folder-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Novelas de ciencia ficción"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="folder-description">Descripción (opcional)</Label>
            <Textarea
              id="folder-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Añade contexto sobre esta colección..."
              rows={3}
            />
          </div>
          <Button
            type="submit"
            className="w-full gradient-hero"
            disabled={!name.trim() || loading}
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Creando...
              </>
            ) : (
              'Crear carpeta'
            )}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
