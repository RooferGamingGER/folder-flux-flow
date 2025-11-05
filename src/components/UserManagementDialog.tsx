import { useState } from 'react';
import { useOrganizationUsers } from '@/hooks/useOrganizationUsers';
import { useUserRole } from '@/hooks/useUserRole';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Trash2, UserPlus, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';

const roleLabels = {
  geschaeftsfuehrer: 'Geschäftsführer',
  buerokraft: 'Bürokraft',
  team_projektleiter: 'Team- & Projektleiter',
  vorarbeiter: 'Vorarbeiter',
  mitarbeiter: 'Mitarbeiter',
  azubi: 'Azubi',
};

export function UserManagementDialog({ 
  open, 
  onClose 
}: { 
  open: boolean; 
  onClose: () => void;
}) {
  const { users, isLoading, inviteUser, removeUser, isInviting } = useOrganizationUsers();
  const { isAdmin } = useUserRole();
  const [email, setEmail] = useState('');
  const [selectedRole, setSelectedRole] = useState('mitarbeiter');

  if (!isAdmin) return null;

  const handleInvite = () => {
    if (!email.trim()) return;
    inviteUser({ email, role: selectedRole });
    setEmail('');
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Benutzerverwaltung</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          <div className="border rounded-lg p-4 bg-card">
            <h3 className="font-semibold mb-4">Neuen Benutzer einladen</h3>
            <div className="flex gap-2">
              <Input
                type="email"
                placeholder="E-Mail-Adresse"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="flex-1"
              />
              <Select value={selectedRole} onValueChange={setSelectedRole}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(roleLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={handleInvite} disabled={isInviting || !email.trim()}>
                <UserPlus className="w-4 h-4 mr-2" />
                Einladen
              </Button>
            </div>
          </div>

          <div>
            <h3 className="font-semibold mb-4">Organisationsmitglieder</h3>
            {isLoading ? (
              <p className="text-muted-foreground">Lädt...</p>
            ) : users.length === 0 ? (
              <p className="text-muted-foreground">Keine Benutzer gefunden</p>
            ) : (
              <div className="space-y-2">
                {users.map((user) => (
                  <div key={user.id} className="flex items-center justify-between p-3 border rounded-lg bg-card">
                    <div>
                      <p className="font-medium">
                        {user.profile?.first_name} {user.profile?.last_name}
                      </p>
                      <p className="text-sm text-muted-foreground">{user.profile?.email}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {roleLabels[user.role as keyof typeof roleLabels]}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeUser(user.user_id)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
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
