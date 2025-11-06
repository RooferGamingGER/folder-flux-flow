import { useState, useMemo } from 'react';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { isProjectOverdue, isProjectUpcoming, getProjectsForDate } from '@/lib/dateUtils';
import { STATUS_COLORS } from '@/lib/constants';

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
      };
    };
  }[];
  onProjectClick?: (projectId: string) => void;
}

export function FullCalendar({ allProjects, onProjectClick }: FullCalendarProps) {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  
  // Nur aktive Projekte
  const activeProjects = useMemo(() => 
    allProjects.filter(({ project }) => !project.archived),
    [allProjects]
  );
  
  // Projekte für ausgewähltes Datum
  const projectsOnDate = useMemo(() => {
    if (!selectedDate) return [];
    return getProjectsForDate(activeProjects, selectedDate);
  }, [activeProjects, selectedDate]);
  
  // Datum-Modifiers für Kalender
  const modifiers = useMemo(() => {
    return {
      projectStart: (date: Date) => {
        const dateStr = date.toISOString().split('T')[0];
        return activeProjects.some(({ project }) => 
          project.details?.startdatum?.split('T')[0] === dateStr
        );
      },
      projectEnd: (date: Date) => {
        const dateStr = date.toISOString().split('T')[0];
        return activeProjects.some(({ project }) => 
          project.details?.enddatum?.split('T')[0] === dateStr
        );
      },
      overdue: (date: Date) => {
        const dateStr = date.toISOString().split('T')[0];
        return activeProjects.some(({ project }) => {
          const endDateStr = project.details?.enddatum?.split('T')[0];
          return endDateStr === dateStr && 
                 isProjectOverdue(project.details?.enddatum) &&
                 (project.details?.projektstatus || project.projektstatus) !== 'Abgeschlossen';
        });
      },
      upcoming: (date: Date) => {
        const dateStr = date.toISOString().split('T')[0];
        return activeProjects.some(({ project }) => {
          const startDateStr = project.details?.startdatum?.split('T')[0];
          return startDateStr === dateStr && 
                 isProjectUpcoming(project.details?.startdatum, 7);
        });
      },
    };
  }, [activeProjects]);
  
  return (
    <Tabs defaultValue="projects" className="w-full">
      <TabsList className="grid w-full grid-cols-2 mb-4">
        <TabsTrigger value="projects">📅 Projekt-Kalender</TabsTrigger>
        <TabsTrigger value="baustellen">🏗️ Baustellenkalender</TabsTrigger>
      </TabsList>
      
      {/* Tab 1: Projekt-Kalender */}
      <TabsContent value="projects" className="space-y-4">
        <div className="grid grid-cols-1 lg:grid-cols-[2fr,1fr] gap-6">
          {/* Kalender */}
          <Card>
            <CardHeader>
              <CardTitle>Projekttermine</CardTitle>
            </CardHeader>
            <CardContent>
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={setSelectedDate}
                className="rounded-md border w-full pointer-events-auto"
                modifiers={modifiers}
                modifiersStyles={{
                  projectStart: {
                    backgroundColor: 'hsl(var(--primary) / 0.2)',
                    fontWeight: 'bold',
                    borderLeft: '3px solid hsl(var(--primary))',
                  },
                  projectEnd: {
                    backgroundColor: 'hsl(var(--primary) / 0.2)',
                    fontWeight: 'bold',
                    borderRight: '3px solid hsl(var(--primary))',
                  },
                  overdue: {
                    backgroundColor: 'hsl(var(--destructive) / 0.3)',
                    fontWeight: 'bold',
                    color: 'white',
                    border: '2px solid hsl(var(--destructive))',
                  },
                  upcoming: {
                    backgroundColor: 'hsl(var(--warning) / 0.8)',
                    fontWeight: 'bold',
                    color: 'white',
                  },
                }}
              />
              
              {/* Legende */}
              <div className="mt-4 space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded border-l-4 border-primary bg-primary/20" />
                  <span>Projektstart</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded border-r-4 border-primary bg-primary/20" />
                  <span>Projektende</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded border-2 border-destructive bg-destructive/30" />
                  <span>Überfällig</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-warning/80" />
                  <span>Startet in 7 Tagen</span>
                </div>
              </div>
            </CardContent>
          </Card>
          
          {/* Projekt-Liste für ausgewähltes Datum */}
          <Card>
            <CardHeader>
              <CardTitle>
                {selectedDate 
                  ? `Projekte am ${selectedDate.toLocaleDateString('de-DE')}`
                  : 'Wähle ein Datum'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {projectsOnDate.length === 0 ? (
                <div className="text-sm text-muted-foreground text-center py-8">
                  Keine Projekte an diesem Datum
                </div>
              ) : (
                <div className="space-y-3">
                  {projectsOnDate.map(({ project, folder }) => {
                    const details = project.details || {};
                    const isOverdue = isProjectOverdue(details.enddatum) && 
                                     (details.projektstatus || project.projektstatus) !== 'Abgeschlossen';
                    
                    return (
                      <div 
                        key={project.id}
                        onClick={() => onProjectClick?.(project.id)}
                        className="p-3 border border-border rounded-lg hover:bg-accent transition-colors cursor-pointer"
                      >
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-sm truncate">
                              {details.projektname || project.title}
                            </div>
                            <div className="text-xs text-muted-foreground truncate">
                              {details.auftragsnummer || project.auftragsnummer || '—'}
                            </div>
                          </div>
                          <div className="flex flex-col gap-1 items-end">
                            <Badge 
                              style={{ 
                                backgroundColor: STATUS_COLORS[details.projektstatus || project.projektstatus || ''] || '#888',
                                color: 'white',
                                fontSize: '10px',
                              }}
                            >
                              {details.projektstatus || project.projektstatus || 'Kein Status'}
                            </Badge>
                            {isOverdue && (
                              <Badge variant="destructive" className="text-xs">
                                Verzug
                              </Badge>
                            )}
                          </div>
                        </div>
                        
                        <div className="text-xs text-muted-foreground space-y-1">
                          <div>📁 {folder.name}</div>
                          {details.ansprechpartner && (
                            <div>👤 {details.ansprechpartner}</div>
                          )}
                          <div>
                            📅 {details.startdatum 
                              ? new Date(details.startdatum).toLocaleDateString('de-DE')
                              : '—'} 
                            {' → '}
                            {details.enddatum
                              ? new Date(details.enddatum).toLocaleDateString('de-DE')
                              : '—'}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </TabsContent>
      
      {/* Tab 2: Baustellenkalender (Google Calendar) */}
      <TabsContent value="baustellen">
        <Card>
          <CardHeader>
            <CardTitle>🏗️ Baustellenkalender</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <iframe
              src="https://calendar.google.com/calendar/embed?src=baustellen.nobis%40gmail.com&ctz=Europe%2FBerlin&mode=DAY&showTitle=0&showNav=1&showDate=1&showPrint=0&showTabs=0&showCalendars=0"
              className="w-full h-[600px] border-0 rounded-b-lg"
              frameBorder="0"
              title="Baustellenkalender"
            />
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
