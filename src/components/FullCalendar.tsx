import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  getUpcomingProjects, 
  getActiveProjects, 
  getOverdueProjects,
  formatDate 
} from '@/lib/dateUtils';
import { STATUS_COLORS } from '@/lib/constants';
import { CalendarDays, Rocket, AlertTriangle } from 'lucide-react';

interface FullCalendarProps {
  allProjects: {
    folderId: string;
    folder: { id: string; name: string; archived: boolean };
    project: {
      id: string;
      title: string;
      archived: boolean;
      projektstatus?: string;
      auftragsnummer?: string;
      details?: {
        projektname?: string;
        projektstatus?: string;
        ansprechpartner?: string;
        startdatum?: string;
        enddatum?: string;
        auftragsnummer?: string;
      };
    };
  }[];
  onProjectClick?: (projectId: string) => void;
}

export function FullCalendar({ allProjects, onProjectClick }: FullCalendarProps) {
  // Nur aktive Projekte
  const activeProjects = useMemo(() => 
    allProjects.filter(({ project }) => !project.archived),
    [allProjects]
  );

  // Kategorien berechnen
  const upcomingProjects = useMemo(() => 
    getUpcomingProjects(activeProjects, 14).sort((a, b) => {
      const dateA = new Date(a.project.details?.startdatum || 0);
      const dateB = new Date(b.project.details?.startdatum || 0);
      return dateA.getTime() - dateB.getTime();
    }),
    [activeProjects]
  );

  const runningProjects = useMemo(() => 
    getActiveProjects(activeProjects).sort((a, b) => {
      const dateA = new Date(a.project.details?.enddatum || 0);
      const dateB = new Date(b.project.details?.enddatum || 0);
      return dateA.getTime() - dateB.getTime();
    }),
    [activeProjects]
  );

  const overdueProjects = useMemo(() => 
    getOverdueProjects(activeProjects).sort((a, b) => {
      const dateA = new Date(a.project.details?.enddatum || 0);
      const dateB = new Date(b.project.details?.enddatum || 0);
      return dateA.getTime() - dateB.getTime();
    }),
    [activeProjects]
  );

  // Projekt-Card Component
  const ProjectCard = ({ project, folder, showEndDate = false }: any) => {
    const details = project.details || {};
    const status = details.projektstatus || project.projektstatus;
    
    return (
      <div 
        onClick={() => onProjectClick?.(project.id)}
        className="p-4 border border-border rounded-lg hover:bg-accent transition-colors cursor-pointer"
      >
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-base mb-1">
              {details.projektname || project.title}
            </div>
            <div className="text-sm text-muted-foreground">
              {details.auftragsnummer || project.auftragsnummer || 'Keine Auftragsnummer'}
            </div>
          </div>
          <Badge 
            style={{ 
              backgroundColor: STATUS_COLORS[status || ''] || '#888',
              color: 'white',
            }}
          >
            {status || 'Kein Status'}
          </Badge>
        </div>
        
        <div className="space-y-1 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <span>📁</span>
            <span className="truncate">{folder.name}</span>
          </div>
          {details.ansprechpartner && (
            <div className="flex items-center gap-2">
              <span>👤</span>
              <span>{details.ansprechpartner}</span>
            </div>
          )}
          <div className="flex items-center gap-2">
            <span>📅</span>
            <span>
              {details.startdatum ? formatDate(details.startdatum) : '—'}
              {showEndDate && details.enddatum && (
                <> → {formatDate(details.enddatum)}</>
              )}
            </span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="w-full space-y-6">
      {/* Statistik-Header */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-blue-500" />
              Anstehend
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-500">
              {upcomingProjects.length}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              In den nächsten 14 Tagen
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Rocket className="w-4 h-4 text-green-500" />
              Laufend
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-500">
              {runningProjects.length}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Aktive Projekte
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-500" />
              Überfällig
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-500">
              {overdueProjects.length}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Deadline überschritten
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Projekt-Listen */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Anstehende Projekte */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarDays className="w-5 h-5 text-blue-500" />
              Anstehende Projekte
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Starten in den nächsten 14 Tagen
            </p>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[600px]">
              {upcomingProjects.length === 0 ? (
                <div className="p-6 text-center text-sm text-muted-foreground">
                  Keine anstehenden Projekte
                </div>
              ) : (
                <div className="p-4 space-y-3">
                  {upcomingProjects.map(({ project, folder }) => (
                    <ProjectCard 
                      key={project.id} 
                      project={project} 
                      folder={folder}
                      showEndDate={true}
                    />
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Laufende Projekte */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Rocket className="w-5 h-5 text-green-500" />
              Laufende Projekte
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Bereits gestartet, noch nicht beendet
            </p>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[600px]">
              {runningProjects.length === 0 ? (
                <div className="p-6 text-center text-sm text-muted-foreground">
                  Keine laufenden Projekte
                </div>
              ) : (
                <div className="p-4 space-y-3">
                  {runningProjects.map(({ project, folder }) => (
                    <ProjectCard 
                      key={project.id} 
                      project={project} 
                      folder={folder}
                      showEndDate={true}
                    />
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Überfällige Projekte */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              Überfällige Projekte
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Deadline überschritten
            </p>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[600px]">
              {overdueProjects.length === 0 ? (
                <div className="p-6 text-center text-sm text-muted-foreground">
                  ✅ Keine überfälligen Projekte
                </div>
              ) : (
                <div className="p-4 space-y-3">
                  {overdueProjects.map(({ project, folder }) => (
                    <ProjectCard 
                      key={project.id} 
                      project={project} 
                      folder={folder}
                      showEndDate={true}
                    />
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
