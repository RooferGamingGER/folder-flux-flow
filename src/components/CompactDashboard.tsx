import { useMemo } from 'react';
import { PROJECT_STATUS_OPTIONS, STATUS_COLORS } from '@/lib/constants';

type Project = {
  id: string;
  title: string;
  archived: boolean;
  projektstatus?: string;
};

type Folder = {
  id: string;
  name: string;
  archived: boolean;
};

export function CompactDashboard({ 
  allProjects 
}: { 
  allProjects: { folderId: string; folder: Folder; project: Project }[] 
}) {
  const stats = useMemo(() => {
    const activeProjects = allProjects.filter(({ project }) => !project.archived);
    
    const byStatus = PROJECT_STATUS_OPTIONS.reduce((acc, status) => {
      acc[status] = activeProjects.filter(({ project }) => project.projektstatus === status).length;
      return acc;
    }, {} as Record<string, number>);
    
    return {
      total: activeProjects.length,
      byStatus,
    };
  }, [allProjects]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">📊 Dashboard</h3>
        <span className="text-xs text-muted-foreground">{stats.total} Projekte</span>
      </div>
      
      <div className="space-y-2">
        {PROJECT_STATUS_OPTIONS.map((status) => {
          const count = stats.byStatus[status] || 0;
          if (count === 0) return null;
          
          return (
            <div key={status} className="flex items-center gap-2 text-sm">
              <div 
                className="w-2 h-2 rounded-full flex-shrink-0" 
                style={{ backgroundColor: STATUS_COLORS[status] || '#888' }}
              />
              <span className="text-xs flex-1 truncate">{status}</span>
              <span className="text-xs font-medium text-muted-foreground">{count}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
