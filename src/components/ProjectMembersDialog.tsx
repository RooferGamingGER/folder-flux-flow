import { useState } from 'react';
import { useProjectMembers } from '@/hooks/useProjectMembers';
import { useOrganizationUsers } from '@/hooks/useOrganizationUsers';
import { useUserRole } from '@/hooks/useUserRole';
import { Button } from './ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Trash2, UserPlus } from 'lucide-react';
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
  const { members, isLoading, addMember, removeMember } = useProjectMembers(projectId);
  const { users: orgUsers } = useOrganizationUsers();
  const { canManageProjects } = useUserRole();
  const [selectedUserId, setSelectedUserId] = useState('');

  const canManage = canManageProjects;

  const memberIds = new Set(members.map(m => m.user_id));
  const availableUsers = orgUsers.filter(u => !memberIds.has(u.user_id));

  const handleAdd = () => {
    if (!selectedUserId) return;
    addMember(selectedUserId);
    setSelectedUserId('');
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
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
                  <SelectContent>
                    {availableUsers.map((user) => (
                      <SelectItem key={user.user_id} value={user.user_id}>
                        {user.profile?.first_name} {user.profile?.last_name} ({user.profile?.email})
                      </SelectItem>
                    ))}
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
        </div>
      </DialogContent>
    </Dialog>
  );
}
