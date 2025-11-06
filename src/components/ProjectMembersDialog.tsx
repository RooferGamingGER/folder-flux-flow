import { useState } from 'react';
import { useProjectMembers } from '@/hooks/useProjectMembers';
import { useOrganizationUsers } from '@/hooks/useOrganizationUsers';
import { useUserRole } from '@/hooks/useUserRole';
import { Button } from './ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Trash2, UserPlus, LogOut } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';

export function ProjectMembersDialog({ 
  projectId,
  open,
  onClose 
}: { 
  projectId: string; 
  open: boolean;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const { 
    members, 
    directMembers, 
    folderMembers, 
    isLoading, 
    accessInfo, 
    addMember, 
    removeMember, 
    leaveProject 
  } = useProjectMembers(projectId);
  const { users: orgUsers } = useOrganizationUsers();
  const { canManageProjects } = useUserRole();
  const [selectedUserId, setSelectedUserId] = useState('');

  const canManage = canManageProjects;
  const isMember = members.some(m => m.user_id === user?.id);
  const canLeave = accessInfo?.canLeave;

  const allMemberIds = new Set([
    ...directMembers.map((m: any) => m.user_id),
    ...folderMembers.map((m: any) => m.user_id)
  ]);
  const availableUsers = orgUsers.filter((u: any) => !allMemberIds.has(u.user_id));

  const handleAdd = () => {
    if (!selectedUserId) return;
    addMember(selectedUserId);
    setSelectedUserId('');
  };

  const handleLeave = () => {
    if (confirm('Möchtest du dieses Projekt wirklich verlassen?')) {
      leaveProject();
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Projekt-Mitglieder</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {canManage && (
            <div className="border rounded-lg p-4 bg-card">
              <h3 className="font-semibold mb-4">Mitglied hinzufügen</h3>
              <div className="flex gap-2">
                <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Benutzer auswählen..." />
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px]">
                    {availableUsers.length === 0 ? (
                      <div className="px-4 py-3 text-sm text-muted-foreground text-center">
                        Keine weiteren Benutzer verfügbar
                      </div>
                    ) : (
                      availableUsers.map((user) => (
                        <SelectItem key={user.user_id} value={user.user_id}>
                          {user.profile?.first_name} {user.profile?.last_name} ({user.profile?.email})
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                <Button onClick={handleAdd} disabled={!selectedUserId}>
                  <UserPlus className="w-4 h-4 mr-2" />
                  Hinzufügen
                </Button>
              </div>
            </div>
          )}

          {/* Mitglieder-Übersicht */}
          <div className="space-y-6">
            {/* Sektion 1: Direkte Mitglieder */}
            <div>
              <h3 className="font-semibold mb-2">Direkt zugewiesene Mitglieder</h3>
              <p className="text-xs text-muted-foreground mb-3">
                Diese Benutzer wurden explizit zu diesem Projekt hinzugefügt.
              </p>
              {isLoading ? (
                <p className="text-muted-foreground">Lädt...</p>
              ) : directMembers.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">Keine direkten Mitglieder</p>
              ) : (
                <div className="space-y-2">
                  {directMembers.map((member: any) => (
                    <div key={member.id} className="flex items-center justify-between p-3 border rounded-lg bg-card">
                      <div className="flex-1">
                        <p className="font-medium">
                          {member.profile?.first_name} {member.profile?.last_name}
                          {member.user_id === user?.id && ' (Du)'}
                        </p>
                        <p className="text-sm text-muted-foreground">{member.profile?.email}</p>
                      </div>
                      {canManage && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeMember(member.user_id)}
                          className="text-destructive hover:text-destructive"
                          title="Aus Projekt entfernen"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Sektion 2: Ordner-Mitglieder */}
            {folderMembers.length > 0 && (
              <div>
                <h3 className="font-semibold mb-2">Zugriff über Ordner</h3>
                <p className="text-xs text-muted-foreground mb-3">
                  Diese Benutzer haben Zugriff, weil sie Mitglied des zugeordneten Ordners sind.
                </p>
                <div className="space-y-2">
                  {folderMembers.map((member: any) => (
                    <div key={member.id} className="flex items-center justify-between p-3 border rounded-lg bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium">
                            {member.profile?.first_name} {member.profile?.last_name}
                            {member.user_id === user?.id && ' (Du)'}
                          </p>
                          <span className="text-xs px-2 py-0.5 rounded-full bg-blue-200 dark:bg-blue-800 text-blue-700 dark:text-blue-300">
                            Ordner
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground">{member.profile?.email}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-2 italic">
                  💡 Um diese Benutzer zu entfernen, bearbeite die Mitglieder des zugeordneten Ordners.
                </p>
              </div>
            )}
          </div>

          {canLeave && (
            <div className="border-t pt-4 space-y-2">
              {accessInfo?.hasFolderAccess && !isMember && (
                <div className="text-xs text-muted-foreground bg-blue-50 dark:bg-blue-950 p-2 rounded border border-blue-200 dark:border-blue-800">
                  ℹ️ <strong>Hinweis:</strong> Du hast Zugriff über den Ordner. 
                  Das Projekt wird aus deiner Ansicht entfernt, bleibt aber über den Ordner verfügbar.
                </div>
              )}
              {accessInfo?.hasFolderAccess && isMember && (
                <div className="text-xs text-muted-foreground bg-yellow-50 dark:bg-yellow-950 p-2 rounded border border-yellow-200 dark:border-yellow-800">
                  ℹ️ <strong>Hinweis:</strong> Nach dem Verlassen hast du weiterhin Zugriff über den zugeordneten Ordner.
                </div>
              )}
              <Button 
                variant="outline" 
                className="w-full text-orange-600 hover:text-orange-700"
                onClick={handleLeave}
              >
                <LogOut className="w-4 h-4 mr-2" />
                {isMember ? 'Projekt verlassen' : 'Projekt ausblenden'}
              </Button>
            </div>
          )}

          {!canLeave && !accessInfo?.hasFullAccess && (
            <div className="text-sm text-muted-foreground bg-muted/50 p-3 rounded border">
              {accessInfo?.hasFolderAccess && (
                <>
                  ℹ️ Du hast Zugriff über einen Ordner. Um den Zugriff zu entfernen, verlasse den entsprechenden Ordner.
                </>
              )}
              {accessInfo?.isOwner && (
                <>
                  ℹ️ Du bist Eigentümer dieses Projekts und kannst es nicht verlassen. Übertrage das Projekt an einen anderen User oder lösche es.
                </>
              )}
            </div>
          )}

          {accessInfo?.hasFullAccess && (
            <div className="text-sm text-muted-foreground bg-blue-50 dark:bg-blue-950 p-3 rounded border border-blue-200 dark:border-blue-800">
              🔒 Als Geschäftsführer/Bürokraft hast du immer Zugriff auf alle Projekte.
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
