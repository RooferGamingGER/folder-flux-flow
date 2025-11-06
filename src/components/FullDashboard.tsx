import { useMemo } from 'react';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PROJECT_STATUS_OPTIONS, STATUS_COLORS } from '@/lib/constants';
import { isProjectOverdue } from '@/lib/dateUtils';
import { useStorageStats } from '@/hooks/useStorageStats';
import { HardDrive, Image, FileText } from 'lucide-react';

interface Project {
  id: string;
  title: string;
  archived: boolean;
  projektstatus?: string;
  auftragsnummer?: string;
  details?: {
    projektname?: string;
    auftragsnummer?: string;
    projektstatus?: string;
    ansprechpartner?: string;
    strasse?: string;
    plz?: string;
    stadt?: string;
    startdatum?: string;
    enddatum?: string;
  };
}

interface Folder {
  id: string;
  name: string;
  archived: boolean;
}

interface FullDashboardProps {
  allProjects: {
    folderId: string;
    folder: Folder;
    project: Project;
  }[];
}

export function FullDashboard({ allProjects }: FullDashboardProps) {
  const activeProjects = allProjects.filter(({ project }) => !project.archived);
  const { data: storageStats, isLoading: storageLoading } = useStorageStats();
  
  const stats = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    let overdue = 0;
    let inProgress = 0;
    let planned = 0;
    
    activeProjects.forEach(({ project }) => {
      const status = project.details?.projektstatus || project.projektstatus;
      
      if (isProjectOverdue(project.details?.enddatum) && status !== 'Abgeschlossen') {
        overdue++;
      }
      
      if (status === 'In Bearbeitung') inProgress++;
      if (status === 'In Planung') planned++;
    });
    
    return {
      total: activeProjects.length,
      overdue,
      inProgress,
      planned,
    };
  }, [activeProjects]);
  
  return (
    <div className="space-y-6">
      {/* Speicherverbrauchs-Übersicht */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HardDrive className="w-5 h-5" />
            Speicherverbrauch
            <Badge variant="secondary" className="ml-auto">
              ✨ Pro Account
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {storageLoading ? (
            <div className="text-sm text-muted-foreground">Lade Statistiken...</div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <HardDrive className="w-4 h-4" />
                    Gesamt
                  </div>
                  <div className="text-2xl font-bold">
                    {storageStats?.totalMB || 0} MB
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {storageStats?.totalFiles || 0} Dateien in {storageStats?.projectsWithFiles || 0} Projekten
                  </div>
                </div>
                
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Image className="w-4 h-4" />
                    Bilder
                  </div>
                  <div className="text-2xl font-bold">
                    {storageStats?.imageMB || 0} MB
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {storageStats?.totalImages || 0} Bilder ({storageStats?.totalBytes ? Math.round((storageStats?.imageBytes || 0) / storageStats.totalBytes * 100) : 0}%)
                  </div>
                </div>
                
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <FileText className="w-4 h-4" />
                    Dokumente
                  </div>
                  <div className="text-2xl font-bold">
                    {storageStats?.documentMB || 0} MB
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {storageStats?.totalDocuments || 0} Dateien
                  </div>
                </div>
              </div>
              
              {/* Speicher-Fortschrittsbalken */}
              <div className="mt-4 space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Verwendeter Speicher</span>
                  <span className="font-medium">
                    {storageStats?.totalGB || '0.00'} GB / {storageStats?.maxStorageGB || 100} GB (Pro Tier)
                  </span>
                </div>
                <div className="w-full bg-secondary rounded-full h-3">
                  <div 
                    className={`h-3 rounded-full transition-all ${
                      (parseFloat(storageStats?.totalMB || '0') / (storageStats?.maxStorageMB || 102400)) > 0.85 
                        ? 'bg-red-500'
                        : (parseFloat(storageStats?.totalMB || '0') / (storageStats?.maxStorageMB || 102400)) > 0.70 
                        ? 'bg-yellow-500' 
                        : 'bg-green-500'
                    }`}
                    style={{ 
                      width: `${Math.min(
                        (parseFloat(storageStats?.totalMB || '0') / (storageStats?.maxStorageMB || 102400)) * 100, 
                        100
                      )}%` 
                    }}
                  />
                </div>
                <div className="text-xs text-muted-foreground space-y-1">
                  <div>ℹ️ Bildkompression spart durchschnittlich 70-90% Speicherplatz</div>
                  <div>✨ Du nutzt das Pro Tier mit 100 GB included Storage</div>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Statistik-Karten */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard title="Aktive Projekte" value={stats.total} />
        <StatCard title="Überfällig" value={stats.overdue} variant="destructive" />
        <StatCard title="In Bearbeitung" value={stats.inProgress} variant="warning" />
        <StatCard title="In Planung" value={stats.planned} variant="info" />
      </div>
      
      {/* Status-Übersicht als Balken */}
      <Card>
        <CardHeader>
          <CardTitle>Status-Übersicht</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {PROJECT_STATUS_OPTIONS.map((status) => {
            const count = activeProjects.filter(({ project }) => 
              (project.details?.projektstatus || project.projektstatus) === status
            ).length;
            
            if (count === 0) return null;
            
            const percentage = (count / stats.total) * 100;
            const color = STATUS_COLORS[status]?.replace('bg-', '') || 'gray-500';
            
            return (
              <div key={status} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <div 
                      className={`w-3 h-3 rounded-full ${STATUS_COLORS[status] || 'bg-muted'}`}
                    />
                    {status}
                  </span>
                  <span className="font-medium">{count}</span>
                </div>
                <div className="w-full bg-secondary rounded-full h-2">
                  <div 
                    className={`h-2 rounded-full transition-all ${STATUS_COLORS[status] || 'bg-muted'}`}
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
      
      {/* Offene Aufträge Tabelle */}
      <Card>
        <CardHeader>
          <CardTitle>Offene Aufträge ({activeProjects.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Auftragsnr.</TableHead>
                  <TableHead>Projektname</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Ansprechpartner</TableHead>
                  <TableHead>Adresse</TableHead>
                  <TableHead>Start</TableHead>
                  <TableHead>Ende</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activeProjects.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      Keine aktiven Projekte vorhanden
                    </TableCell>
                  </TableRow>
                ) : (
                  activeProjects.map(({ project, folder }) => {
                    const details = project.details || {};
                    const isOverdue = isProjectOverdue(details.enddatum) && 
                                     (details.projektstatus || project.projektstatus) !== 'Abgeschlossen';
                    
                    return (
                      <TableRow key={project.id} className={isOverdue ? 'bg-destructive/5' : ''}>
                        <TableCell className="font-mono text-sm">
                          {details.auftragsnummer || project.auftragsnummer || '—'}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">
                              {details.projektname || project.title}
                            </span>
                            {isOverdue && (
                              <Badge variant="destructive" className="text-xs">
                                Verzug
                              </Badge>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            📁 {folder.name}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge 
                            className={`${STATUS_COLORS[details.projektstatus || project.projektstatus || ''] || 'bg-muted'} text-white border-0`}
                          >
                            {details.projektstatus || project.projektstatus || 'Kein Status'}
                          </Badge>
                        </TableCell>
                        <TableCell>{details.ansprechpartner || '—'}</TableCell>
                        <TableCell className="text-sm">
                          {details.strasse && details.plz && details.stadt
                            ? `${details.strasse}, ${details.plz} ${details.stadt}`
                            : '—'}
                        </TableCell>
                        <TableCell className="text-sm">
                          {details.startdatum 
                            ? new Date(details.startdatum).toLocaleDateString('de-DE')
                            : '—'}
                        </TableCell>
                        <TableCell className="text-sm">
                          {details.enddatum
                            ? new Date(details.enddatum).toLocaleDateString('de-DE')
                            : '—'}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ 
  title, 
  value, 
  variant = 'default' 
}: { 
  title: string; 
  value: number; 
  variant?: 'default' | 'destructive' | 'warning' | 'info';
}) {
  const colors = {
    default: 'bg-card text-foreground border-border',
    destructive: 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800 text-foreground',
    warning: 'bg-yellow-50 dark:bg-yellow-950/20 border-yellow-200 dark:border-yellow-800 text-foreground',
    info: 'bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800 text-foreground',
  };
  
  return (
    <Card className={colors[variant]}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold">{value}</div>
      </CardContent>
    </Card>
  );
}
