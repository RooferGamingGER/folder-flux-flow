import { useState } from 'react';
import { useOrganizationUsers } from '@/hooks/useOrganizationUsers';
import { useUserRole } from '@/hooks/useUserRole';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Trash2, UserPlus, Edit, Copy, X } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
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
  const { users, isLoading, createUser, updateUser, deleteUser, isCreating, isUpdating } = useOrganizationUsers();
  const { isAdmin } = useUserRole();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [selectedRole, setSelectedRole] = useState('mitarbeiter');
  const [temporaryPassword, setTemporaryPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);

  if (!isAdmin) return null;

  const handleCreate = async () => {
    if (!firstName.trim() || !lastName.trim() || !email.trim()) {
      toast({
        title: 'Fehler',
        description: 'Bitte alle Felder ausfüllen',
        variant: 'destructive'
      });
      return;
    }

    try {
      const result = await createUser({ 
        firstName, 
        lastName, 
        email, 
        role: selectedRole 
      });
      
      if (result?.temporaryPassword) {
        setTemporaryPassword(result.temporaryPassword);
        setShowPassword(true);
        setFirstName('');
        setLastName('');
        setEmail('');
        toast({
          title: 'Benutzer erstellt',
          description: 'Bitte notieren Sie sich das temporäre Passwort.',
        });
      }
    } catch (error) {
      // Error handling is done in the mutation
    }
  };

  const handleEdit = (user: any) => {
    setEditingUser({
      ...user,
      firstName: user.profile?.first_name || '',
      lastName: user.profile?.last_name || '',
    });
  };

  const handleUpdate = () => {
    if (!editingUser) return;
    
    updateUser({
      userId: editingUser.user_id,
      firstName: editingUser.firstName,
      lastName: editingUser.lastName,
      role: editingUser.role
    });
    
    setEditingUser(null);
  };

  const handleDelete = (userId: string) => {
    if (confirm('Benutzer wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.')) {
      deleteUser(userId);
    }
  };

  const handleCopyPassword = () => {
    navigator.clipboard.writeText(temporaryPassword);
    toast({ 
      title: 'Kopiert',
      description: 'Passwort in Zwischenablage kopiert'
    });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Benutzerverwaltung</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          <div className="border rounded-lg p-4 bg-card">
            <h3 className="font-semibold mb-4">Neuen Benutzer erstellen</h3>
            
            {showPassword && temporaryPassword && (
              <div className="bg-primary/10 border border-primary/20 rounded-lg p-4 mb-4">
                <h4 className="font-semibold mb-2 flex items-center gap-2">
                  ✅ Benutzer erfolgreich erstellt!
                </h4>
                <Label className="text-sm mb-1 block">Temporäres Passwort:</Label>
                <div className="flex gap-2">
                  <code className="flex-1 bg-background px-3 py-2 rounded border font-mono text-sm">
                    {temporaryPassword}
                  </code>
                  <Button
                    size="sm"
                    onClick={handleCopyPassword}
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  ⚠️ Der Benutzer muss dieses Passwort beim ersten Login ändern.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowPassword(false)}
                  className="mt-2"
                >
                  Schließen
                </Button>
              </div>
            )}

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label htmlFor="firstName">Vorname</Label>
                  <Input
                    id="firstName"
                    placeholder="Vorname"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="lastName">Nachname</Label>
                  <Input
                    id="lastName"
                    placeholder="Nachname"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="email">E-Mail</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="E-Mail-Adresse"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="flex gap-2">
                <div className="flex-1">
                  <Label>Rolle</Label>
                  <Select value={selectedRole} onValueChange={setSelectedRole}>
                    <SelectTrigger>
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
                </div>
                <div className="flex items-end">
                  <Button onClick={handleCreate} disabled={isCreating}>
                    <UserPlus className="w-4 h-4 mr-2" />
                    Erstellen
                  </Button>
                </div>
              </div>
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
                    {editingUser?.user_id === user.user_id ? (
                      <div className="flex-1 space-y-2">
                        <div className="grid grid-cols-2 gap-2">
                          <Input
                            placeholder="Vorname"
                            value={editingUser.firstName}
                            onChange={(e) => setEditingUser({...editingUser, firstName: e.target.value})}
                          />
                          <Input
                            placeholder="Nachname"
                            value={editingUser.lastName}
                            onChange={(e) => setEditingUser({...editingUser, lastName: e.target.value})}
                          />
                        </div>
                        <Select 
                          value={editingUser.role} 
                          onValueChange={(role) => setEditingUser({...editingUser, role})}
                        >
                          <SelectTrigger>
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
                        <div className="flex gap-2">
                          <Button size="sm" onClick={handleUpdate} disabled={isUpdating}>
                            Speichern
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setEditingUser(null)}>
                            Abbrechen
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div>
                          <p className="font-medium">
                            {user.profile?.first_name} {user.profile?.last_name}
                          </p>
                          <p className="text-sm text-muted-foreground">{user.profile?.email}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {roleLabels[user.role as keyof typeof roleLabels]}
                          </p>
                        </div>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(user)}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(user.user_id)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </>
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
