import { useMemo } from 'react';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PROJECT_STATUS_OPTIONS, STATUS_COLORS } from '@/lib/constants';
import { isProjectOverdue } from '@/lib/dateUtils';

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
