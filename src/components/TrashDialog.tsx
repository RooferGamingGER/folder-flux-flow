import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Button } from './ui/button';
import { RotateCcw, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

type DeletedProject = {
  id: string;
  title: string;
  deleted_at: string | null;
};

export function TrashDialog({
  open,
  onClose,
  deletedProjects,
  onRestore,
  onPermanentDelete,
}: {
  open: boolean;
  onClose: () => void;
  deletedProjects: DeletedProject[];
  onRestore: (id: string) => void;
  onPermanentDelete: (id: string) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trash2 className="w-5 h-5" />
            Papierkorb ({deletedProjects.length})
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {deletedProjects.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Papierkorb ist leer
            </div>
          ) : (
            <div className="space-y-2">
              {deletedProjects.map((project) => (
                <div key={project.id} className="flex items-center justify-between p-4 border rounded-lg bg-card hover:bg-accent/50 transition-colors">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium truncate">{project.title}</h3>
                    <p className="text-xs text-muted-foreground">
                      Gelöscht: {project.deleted_at ? format(new Date(project.deleted_at), 'dd.MM.yyyy HH:mm', { locale: de }) : '–'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onRestore(project.id)}
                      className="flex items-center gap-2"
                    >
                      <RotateCcw className="w-4 h-4" />
                      Wiederherstellen
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => {
                        if (confirm(`Projekt "${project.title}" endgültig löschen? Diese Aktion kann nicht rückgängig gemacht werden!`)) {
                          onPermanentDelete(project.id);
                        }
                      }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
