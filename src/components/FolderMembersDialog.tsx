import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { useFolderMembers } from '@/hooks/useFolderMembers';
import { useOrganizationUsers } from '@/hooks/useOrganizationUsers';
import { useUserRole } from '@/hooks/useUserRole';
import { Button } from './ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Trash2, UserPlus, LogOut } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

export function FolderMembersDialog({ 
  folderId, 
  open,
  onClose 
}: { 
  folderId: string; 
  open: boolean;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const { members, isLoading, accessInfo, addMember, removeMember, leaveFolder } = useFolderMembers(folderId);
  const { users: orgUsers } = useOrganizationUsers();
  const { canManageProjects } = useUserRole();
  const [selectedUserId, setSelectedUserId] = useState('');

  const canManage = canManageProjects;
  const isMember = members.some(m => m.user_id === user?.id);
  const canLeave = isMember && accessInfo?.canLeave;

  const memberIds = new Set(members.map(m => m.user_id));
  const availableUsers = orgUsers.filter(u => !memberIds.has(u.user_id));

  const handleAdd = () => {
    if (!selectedUserId) return;
    addMember(selectedUserId);
    setSelectedUserId('');
  };

  const handleLeave = () => {
    if (confirm('Möchtest du diesen Ordner wirklich verlassen? Du verlierst den Zugriff auf alle Projekte in diesem Ordner.')) {
      leaveFolder();
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Ordner-Mitglieder verwalten</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <p className="text-sm text-blue-900 dark:text-blue-100">
              ℹ️ Mitglieder haben Zugriff auf <strong>alle Projekte</strong> in diesem Ordner. 
              Die Berechtigungen hängen von ihrer Rolle ab.
            </p>
          </div>

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

          <div>
            <h3 className="font-semibold mb-4">Zugewiesene Mitglieder</h3>
            {isLoading ? (
              <p className="text-muted-foreground">Lädt...</p>
            ) : members.length === 0 ? (
              <p className="text-muted-foreground">Keine Mitglieder zugewiesen</p>
            ) : (
              <div className="space-y-2">
                {members.map((member) => (
                  <div key={member.id} className="flex items-center justify-between p-3 border rounded-lg bg-card">
                    <div>
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
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {canLeave && (
            <div className="border-t pt-4">
              <Button 
                variant="outline" 
                className="w-full text-orange-600 hover:text-orange-700"
                onClick={handleLeave}
              >
                <LogOut className="w-4 h-4 mr-2" />
                Ordner verlassen
              </Button>
            </div>
          )}

          {!canLeave && !accessInfo?.hasFullAccess && (
            <div className="text-sm text-muted-foreground bg-muted/50 p-3 rounded border">
              {accessInfo?.isOwner && (
                <>
                  ℹ️ Du bist Eigentümer dieses Ordners und kannst ihn nicht verlassen. Übertrage den Ordner an einen anderen User oder lösche ihn.
                </>
              )}
            </div>
          )}

          {accessInfo?.hasFullAccess && (
            <div className="text-sm text-muted-foreground bg-blue-50 dark:bg-blue-950 p-3 rounded border border-blue-200 dark:border-blue-800">
              🔒 Als Geschäftsführer/Bürokraft hast du immer Zugriff auf alle Ordner.
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
