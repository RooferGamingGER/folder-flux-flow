import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, CheckCircle, XCircle, AlertCircle, Database, Download } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface MigrationEstimates {
  projects: number;
  newProjects?: number;
  skippedProjects?: number;
  estimatedFiles: number;
  estimatedMessages: number;
  estimatedStorageMB: number;
  estimatedDurationMinutes: number;
}

interface MigrationRun {
  id: string;
  status: 'pending' | 'analyzing' | 'migrating' | 'completed' | 'failed' | 'cancelled';
  phase?: string;
  progress?: any;
  total_items?: any;
  error_message?: string;
}

export function CraftnoteigrationDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [step, setStep] = useState<'credentials' | 'analyze' | 'confirm' | 'migrating' | 'completed'>('credentials');
  const [apiKey, setApiKey] = useState('411226f5-a615-44d9-8047-59135e62ed3c');
  const [testing, setTesting] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [estimates, setEstimates] = useState<MigrationEstimates | null>(null);
  const [migrationRun, setMigrationRun] = useState<MigrationRun | null>(null);
  const [errors, setErrors] = useState<any[]>([]);

  const testConnection = async () => {
    setTesting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Nicht angemeldet');

      const response = await supabase.functions.invoke('craftnote-migration', {
        body: { action: 'test-connection', apiKey: apiKey.trim() }
      });

      if (response.error) throw response.error;
      
      if (!response.data?.success) {
        throw new Error(response.data?.error || 'Unbekannter Fehler');
      }

      toast({
        title: 'Verbindung erfolgreich',
        description: `${response.data.projectCount} Projekte gefunden`,
      });

      setStep('analyze');
    } catch (error: any) {
      toast({
        title: 'Verbindung fehlgeschlagen',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setTesting(false);
    }
  };

  const analyzeScope = async () => {
    setAnalyzing(true);
    try {
      const response = await supabase.functions.invoke('craftnote-migration', {
        body: { action: 'analyze', apiKey: apiKey.trim() }
      });

      if (response.error) throw response.error;

      setEstimates(response.data.estimates);
      setStep('confirm');
    } catch (error: any) {
      toast({
        title: 'Analyse fehlgeschlagen',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setAnalyzing(false);
    }
  };

  const startMigration = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Nicht angemeldet');

      const response = await supabase.functions.invoke('craftnote-migration', {
        body: { action: 'start-migration', apiKey: apiKey.trim(), userId: user.id }
      });

      if (response.error) throw response.error;

      setMigrationRun({ id: response.data.runId, status: 'pending' });
      setStep('migrating');
    } catch (error: any) {
      toast({
        title: 'Fehler beim Start',
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  useEffect(() => {
    if (!migrationRun || step !== 'migrating') return;

    const interval = setInterval(async () => {
      try {
        const response = await supabase.functions.invoke('craftnote-migration', {
          body: { action: 'get-status', runId: migrationRun.id }
        });

        if (response.error) throw response.error;

        setMigrationRun(response.data.run);
        setErrors(response.data.errors);

        if (response.data.run.status === 'completed') {
          setStep('completed');
          clearInterval(interval);
        } else if (response.data.run.status === 'failed') {
          clearInterval(interval);
        }
      } catch (error) {
        console.error('Status-Update failed:', error);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [migrationRun, step]);

  const calculateProgress = () => {
    if (!migrationRun?.progress || !migrationRun?.total_items) return 0;
    
    const progress = migrationRun.progress;
    const total = migrationRun.total_items;
    
    const keys = Object.keys(total);
    if (keys.length === 0) return 0;
    
    const totalItems = keys.reduce((sum, key) => sum + (total[key] || 0), 0);
    const processedItems = keys.reduce((sum, key) => sum + (progress[key] || 0), 0);
    
    return Math.floor((processedItems / totalItems) * 100);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Database className="w-5 h-5" />
            Craftnote Migration
          </DialogTitle>
          <DialogDescription>
            Importieren Sie alle Projekte, Dateien und Daten von Craftnote
          </DialogDescription>
        </DialogHeader>

        {step === 'credentials' && (
          <div className="space-y-4">
            <div>
              <Label htmlFor="apiKey">Craftnote API-Key</Label>
              <Input
                id="apiKey"
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="411226f5-..."
              />
            </div>

            <Alert>
              <AlertCircle className="w-4 h-4" />
              <AlertDescription>
                Der API-Key wird verschlüsselt gespeichert und nur für die Migration verwendet.
              </AlertDescription>
            </Alert>

            <div className="flex gap-2">
              <Button onClick={testConnection} disabled={testing || !apiKey}>
                {testing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Verbindung testen
              </Button>
              <Button variant="outline" onClick={onClose}>
                Abbrechen
              </Button>
            </div>
          </div>
        )}

        {step === 'analyze' && (
          <div className="space-y-4">
            <Alert>
              <CheckCircle className="w-4 h-4" />
              <AlertDescription>
                Verbindung erfolgreich! Jetzt Umfang analysieren...
              </AlertDescription>
            </Alert>

            <Button onClick={analyzeScope} disabled={analyzing}>
              {analyzing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Umfang analysieren
            </Button>
          </div>
        )}

        {step === 'confirm' && estimates && (
          <div className="space-y-4">
            <div className="bg-muted p-4 rounded-lg space-y-2">
              <h3 className="font-semibold">Geschätzter Umfang:</h3>
              <ul className="space-y-1 text-sm">
                <li>📊 {estimates.projects} Projekte gesamt</li>
                {estimates.newProjects !== undefined && (
                  <>
                    <li className="text-green-600">✅ {estimates.newProjects} neue Projekte (werden migriert)</li>
                    {estimates.skippedProjects !== undefined && estimates.skippedProjects > 0 && (
                      <li className="text-muted-foreground">⏭️ {estimates.skippedProjects} bereits migriert (werden übersprungen)</li>
                    )}
                  </>
                )}
                <li>📁 ~{estimates.estimatedFiles} Dateien</li>
                <li>💬 ~{estimates.estimatedMessages} Nachrichten</li>
                <li>💾 ~{estimates.estimatedStorageMB} MB Speicher</li>
                <li>⏱️ Geschätzte Dauer: ~{estimates.estimatedDurationMinutes} Minuten</li>
              </ul>
            </div>

            <Alert variant="destructive">
              <AlertCircle className="w-4 h-4" />
              <AlertDescription>
                <strong>Wichtig:</strong> Die Migration kann nicht rückgängig gemacht werden. 
                Stellen Sie sicher, dass genügend Speicherplatz vorhanden ist.
                {estimates.skippedProjects !== undefined && estimates.skippedProjects > 0 && (
                  <><br/><br/>
                  <strong>Hinweis:</strong> {estimates.skippedProjects} bereits migrierte Projekte werden automatisch übersprungen.
                  </>
                )}
              </AlertDescription>
            </Alert>

            <div className="flex gap-2">
              <Button onClick={startMigration} variant="default">
                <Download className="w-4 h-4 mr-2" />
                Migration starten
              </Button>
              <Button variant="outline" onClick={() => setStep('credentials')}>
                Zurück
              </Button>
            </div>
          </div>
        )}

        {step === 'migrating' && migrationRun && (
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Phase: {migrationRun.phase || 'Initialisierung...'}</span>
                <span>{calculateProgress()}%</span>
              </div>
              <Progress value={calculateProgress()} />
            </div>

            {migrationRun.progress && migrationRun.total_items && (
              <div className="bg-muted p-4 rounded-lg space-y-1 text-sm">
                {Object.keys(migrationRun.total_items).map(key => (
                  <div key={key} className="flex justify-between">
                    <span className="capitalize">{key}:</span>
                    <span>
                      {migrationRun.progress[key] || 0} / {migrationRun.total_items[key]}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {errors.length > 0 && (
              <Alert variant="destructive">
                <AlertCircle className="w-4 h-4" />
                <AlertDescription>
                  {errors.length} Fehler aufgetreten. Migration wird fortgesetzt.
                </AlertDescription>
              </Alert>
            )}

            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              Migration läuft... Bitte lassen Sie das Fenster geöffnet.
            </div>
          </div>
        )}

        {step === 'completed' && migrationRun && (
          <div className="space-y-4">
            <Alert>
              <CheckCircle className="w-4 h-4" />
              <AlertDescription>
                Migration erfolgreich abgeschlossen!
              </AlertDescription>
            </Alert>

            {migrationRun.progress && (
              <div className="bg-muted p-4 rounded-lg space-y-1 text-sm">
                <h3 className="font-semibold mb-2">Migrierte Daten:</h3>
                {Object.keys(migrationRun.progress).map(key => (
                  <div key={key} className="flex justify-between">
                    <span className="capitalize">{key}:</span>
                    <span className="font-semibold">{migrationRun.progress[key]}</span>
                  </div>
                ))}
              </div>
            )}

            {errors.length > 0 && (
              <Alert variant="destructive">
                <XCircle className="w-4 h-4" />
                <AlertDescription>
                  {errors.length} Fehler während der Migration. 
                  Details in den Logs verfügbar.
                </AlertDescription>
              </Alert>
            )}

            <Button onClick={onClose}>
              Schließen
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
