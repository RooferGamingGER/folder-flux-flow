import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Button } from './ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { RotateCcw, Trash2, Folder, FileText } from 'lucide-react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

type DeletedProject = {
  id: string;
  title: string;
  deleted_at: string | null;
};

type DeletedFolder = {
  id: string;
  name: string;
  deleted_at: string | null;
};

export function TrashDialog({
  open,
  onClose,
  deletedProjects,
  deletedFolders,
  onRestoreProject,
  onPermanentDeleteProject,
  onRestoreFolder,
  onPermanentDeleteFolder,
}: {
  open: boolean;
  onClose: () => void;
  deletedProjects: DeletedProject[];
  deletedFolders: DeletedFolder[];
  onRestoreProject: (id: string) => void;
  onPermanentDeleteProject: (id: string) => void;
  onRestoreFolder: (id: string) => void;
  onPermanentDeleteFolder: (id: string) => void;
}) {
  const totalItems = deletedProjects.length + deletedFolders.length;
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trash2 className="w-5 h-5" />
            Papierkorb ({totalItems})
          </DialogTitle>
        </DialogHeader>
        
        <Tabs defaultValue="projects" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="projects" className="flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Projekte ({deletedProjects.length})
            </TabsTrigger>
            <TabsTrigger value="folders" className="flex items-center gap-2">
              <Folder className="w-4 h-4" />
              Ordner ({deletedFolders.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="projects" className="mt-4">
            <div className="space-y-4">
              {deletedProjects.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Keine gelöschten Projekte
                </div>
              ) : (
                <div className="space-y-2">
                  {deletedProjects.map((project) => (
                    <div key={project.id} className="flex items-center justify-between p-4 border rounded-lg bg-card hover:bg-accent/50 transition-colors">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-muted-foreground" />
                          <h3 className="font-medium truncate">{project.title}</h3>
                        </div>
                        <p className="text-xs text-muted-foreground ml-6">
                          Gelöscht: {project.deleted_at ? format(new Date(project.deleted_at), 'dd.MM.yyyy HH:mm', { locale: de }) : '–'}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 ml-4">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onRestoreProject(project.id)}
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
                              onPermanentDeleteProject(project.id);
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
          </TabsContent>

          <TabsContent value="folders" className="mt-4">
            <div className="space-y-4">
              {deletedFolders.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Keine gelöschten Ordner
                </div>
              ) : (
                <div className="space-y-2">
                  {deletedFolders.map((folder) => (
                    <div key={folder.id} className="flex items-center justify-between p-4 border rounded-lg bg-card hover:bg-accent/50 transition-colors">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <Folder className="w-4 h-4 text-muted-foreground" />
                          <h3 className="font-medium truncate">{folder.name}</h3>
                        </div>
                        <p className="text-xs text-muted-foreground ml-6">
                          Gelöscht: {folder.deleted_at ? format(new Date(folder.deleted_at), 'dd.MM.yyyy HH:mm', { locale: de }) : '–'}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 ml-4">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onRestoreFolder(folder.id)}
                          className="flex items-center gap-2"
                        >
                          <RotateCcw className="w-4 h-4" />
                          Wiederherstellen
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => {
                            if (confirm(`Ordner "${folder.name}" endgültig löschen? Alle enthaltenen Projekte werden ebenfalls gelöscht! Diese Aktion kann nicht rückgängig gemacht werden!`)) {
                              onPermanentDeleteFolder(folder.id);
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
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
