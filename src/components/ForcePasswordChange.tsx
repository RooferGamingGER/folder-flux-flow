import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { toast } from '@/hooks/use-toast';

export function ForcePasswordChange({ open }: { open: boolean }) {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handlePasswordChange = async () => {
    if (newPassword !== confirmPassword) {
      toast({
        title: 'Fehler',
        description: 'Passwörter stimmen nicht überein',
        variant: 'destructive'
      });
      return;
    }

    if (newPassword.length < 8) {
      toast({
        title: 'Fehler',
        description: 'Passwort muss mindestens 8 Zeichen lang sein',
        variant: 'destructive'
      });
      return;
    }

    setLoading(true);

    try {
      // Update password
      const { error: pwError } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (pwError) throw pwError;

      // Reset flag
      const user = (await supabase.auth.getUser()).data.user;
      if (user) {
        const { error: profileError } = await supabase
          .from('profiles')
          .update({ must_change_password: false })
          .eq('id', user.id);

        if (profileError) throw profileError;
      }

      toast({
        title: 'Passwort geändert',
        description: 'Ihr Passwort wurde erfolgreich geändert'
      });

      window.location.reload();

    } catch (error: any) {
      toast({
        title: 'Fehler',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Passwort ändern erforderlich</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Bitte ändern Sie Ihr temporäres Passwort, um fortzufahren.
          </p>
          <div>
            <Label htmlFor="newPassword">Neues Passwort</Label>
            <Input
              id="newPassword"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Mindestens 8 Zeichen"
            />
          </div>
          <div>
            <Label htmlFor="confirmPassword">Passwort bestätigen</Label>
            <Input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Passwort wiederholen"
            />
          </div>
          <Button onClick={handlePasswordChange} disabled={loading} className="w-full">
            {loading ? 'Lädt...' : 'Passwort ändern'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
