import { Check, Clock, RefreshCw, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SyncIndicatorProps {
  status: 'synced' | 'pending' | 'syncing' | 'error';
  className?: string;
}

export function SyncIndicator({ status, className }: SyncIndicatorProps) {
  const icons = {
    synced: <Check className="h-3 w-3 text-green-600" />,
    pending: <Clock className="h-3 w-3 text-amber-600" />,
    syncing: <RefreshCw className="h-3 w-3 text-blue-600 animate-spin" />,
    error: <AlertCircle className="h-3 w-3 text-red-600" />,
  };

  return (
    <div className={cn('inline-flex items-center justify-center', className)}>
      {icons[status]}
    </div>
  );
}
