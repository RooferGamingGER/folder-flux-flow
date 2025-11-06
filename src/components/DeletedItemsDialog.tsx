import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Tabs, TabsList, TabsContent, TabsTrigger } from './ui/tabs';
import { Button } from './ui/button';
import { FileText, MessageSquare, RotateCcw } from 'lucide-react';
import { useDeletedFiles } from '@/hooks/useDeletedFiles';
import { useDeletedMessages } from '@/hooks/useDeletedMessages';
import { formatDistanceToNow } from 'date-fns';
import { de } from 'date-fns/locale';

export function DeletedItemsDialog({ 
  open, 
  onClose 
}: { 
  open: boolean; 
  onClose: () => void; 
}) {
  const { deletedFiles, isLoading: filesLoading, restoreFile } = useDeletedFiles();
  const { deletedMessages, isLoading: messagesLoading, restoreMessage } = useDeletedMessages();

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Gelöschte Inhalte</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="files" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="files">
              <FileText className="w-4 h-4 mr-2" />
              Dateien ({deletedFiles.length})
            </TabsTrigger>
            <TabsTrigger value="messages">
              <MessageSquare className="w-4 h-4 mr-2" />
              Nachrichten ({deletedMessages.length})
            </TabsTrigger>
          </TabsList>

          {/* Dateien Tab */}
          <TabsContent value="files" className="space-y-4 max-h-[60vh] overflow-y-auto">
            {filesLoading ? (
              <p className="text-muted-foreground">Lädt...</p>
            ) : deletedFiles.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                Keine gelöschten Dateien gefunden
              </p>
            ) : (
              deletedFiles.map((file: any) => (
                <div key={file.id} className="border rounded-lg p-4 space-y-2">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="font-medium">{file.name}</p>
                      <p className="text-sm text-muted-foreground">
                        Projekt: {file.projects?.title}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Gelöscht von: {file.profiles?.first_name} {file.profiles?.last_name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(file.deleted_at), { 
                          addSuffix: true, 
                          locale: de 
                        })}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => restoreFile(file.id)}
                    >
                      <RotateCcw className="w-4 h-4 mr-2" />
                      Wiederherstellen
                    </Button>
                  </div>
                </div>
              ))
            )}
          </TabsContent>

          {/* Nachrichten Tab */}
          <TabsContent value="messages" className="space-y-4 max-h-[60vh] overflow-y-auto">
            {messagesLoading ? (
              <p className="text-muted-foreground">Lädt...</p>
            ) : deletedMessages.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                Keine gelöschten Nachrichten gefunden
              </p>
            ) : (
              deletedMessages.map((msg: any) => (
                <div key={msg.id} className="border rounded-lg p-4 space-y-2">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="font-medium line-clamp-2">
                        {msg.content?.text || 'Nachricht ohne Text'}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Projekt: {msg.projects?.title}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Von: {msg.profiles?.first_name} {msg.profiles?.last_name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(msg.deleted_at), { 
                          addSuffix: true, 
                          locale: de 
                        })}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => restoreMessage(msg.id)}
                    >
                      <RotateCcw className="w-4 h-4 mr-2" />
                      Wiederherstellen
                    </Button>
                  </div>
                </div>
              ))
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
