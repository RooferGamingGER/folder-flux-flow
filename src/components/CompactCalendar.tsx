import { useState, useMemo } from 'react';
import { Calendar } from '@/components/ui/calendar';
import { isSameDay } from 'date-fns';

type Project = {
  id: string;
  title: string;
  archived: boolean;
  details: {
    enddatum?: string;
    startdatum?: string;
  };
};

type Folder = {
  id: string;
  name: string;
  archived: boolean;
};

export function CompactCalendar({ 
  allProjects,
  onDateSelect 
}: { 
  allProjects: { folderId: string; folder: Folder; project: Project }[];
  onDateSelect?: (date: Date) => void;
}) {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  
  const projectDates = useMemo(() => {
    const dates = new Set<string>();
    allProjects.forEach(({ project }) => {
      if (project.archived) return;
      if (project.details.enddatum) {
        dates.add(new Date(project.details.enddatum).toISOString().split('T')[0]);
      }
      if (project.details.startdatum) {
        dates.add(new Date(project.details.startdatum).toISOString().split('T')[0]);
      }
    });
    return dates;
  }, [allProjects]);

  const handleSelect = (date: Date | undefined) => {
    setSelectedDate(date);
    if (date && onDateSelect) {
      onDateSelect(date);
    }
  };

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold">📅 Kalender</h3>
      <Calendar
        mode="single"
        selected={selectedDate}
        onSelect={handleSelect}
        className="rounded-md border"
        modifiers={{
          hasProject: (date) => {
            const dateStr = date.toISOString().split('T')[0];
            return projectDates.has(dateStr);
          }
        }}
        modifiersStyles={{
          hasProject: {
            fontWeight: 'bold',
            color: 'hsl(var(--primary))',
          }
        }}
      />
    </div>
  );
}
