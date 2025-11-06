import { useMemo } from 'react';
import { PROJECT_STATUS_OPTIONS, STATUS_COLORS } from '@/lib/constants';
import { useStorageStats } from '@/hooks/useStorageStats';

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
  const { data: storageStats } = useStorageStats();
  
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
      
      {/* Speicher-Anzeige */}
      <div className="p-2 bg-muted/50 rounded-lg space-y-1">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground flex items-center gap-1">
            💾 Speicher
            <span className="text-[10px] text-muted-foreground/60">Pro</span>
          </span>
          <span className="font-medium">
            {storageStats?.totalGB || '0.00'} GB / 100 GB
          </span>
        </div>
        <div className="w-full bg-secondary rounded-full h-1.5">
          <div 
            className={`h-1.5 rounded-full transition-all ${
              (parseFloat(storageStats?.usagePercentage || '0')) > 85 
                ? 'bg-red-500' 
                : (parseFloat(storageStats?.usagePercentage || '0')) > 70 
                ? 'bg-yellow-500' 
                : 'bg-green-500'
            }`}
            style={{ width: `${Math.min(parseFloat(storageStats?.usagePercentage || '0'), 100)}%` }}
          />
        </div>
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
