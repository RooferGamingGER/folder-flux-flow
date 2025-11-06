import { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Bell, FolderIcon, FileText, MessageSquare } from "lucide-react";
import { getRelativeTime } from "@/lib/dateUtils";

interface Notification {
  id: string;
  type: 'folder' | 'project' | 'message' | 'file';
  title: string;
  description: string;
  timestamp: string;
  read: boolean;
}

interface MobileNotificationsSheetProps {
  open: boolean;
  onClose: () => void;
}

export function MobileNotificationsSheet({ open, onClose }: MobileNotificationsSheetProps) {
  // TODO: Später Benachrichtigungen aus der Datenbank laden
  // und über Supabase Realtime auf neue Benachrichtigungen hören
  const [notifications, setNotifications] = useState<Notification[]>([
    {
      id: '1',
      type: 'project',
      title: 'Neues Projekt',
      description: 'AfaFAf wurde erstellt',
      timestamp: new Date(Date.now() - 3600000).toISOString(),
      read: false,
    },
    {
      id: '2',
      type: 'message',
      title: 'Neue Nachricht',
      description: 'Sie haben eine neue Nachricht in "Notfallaufträge"',
      timestamp: new Date(Date.now() - 7200000).toISOString(),
      read: true,
    },
  ]);

  // Alle als gelesen markieren beim Öffnen
  useEffect(() => {
    if (open && notifications.some(n => !n.read)) {
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    }
  }, [open, notifications]);

  const getIcon = (type: Notification['type']) => {
    switch (type) {
      case 'folder': return <FolderIcon className="w-5 h-5" />;
      case 'project': return <FileText className="w-5 h-5" />;
      case 'message': return <MessageSquare className="w-5 h-5" />;
      case 'file': return <FileText className="w-5 h-5" />;
    }
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent side="right">
        <SheetHeader>
          <SheetTitle>
            Benachrichtigungen
            {unreadCount > 0 && (
              <span className="ml-2 text-xs bg-destructive text-destructive-foreground px-2 py-0.5 rounded-full">
                {unreadCount}
              </span>
            )}
          </SheetTitle>
        </SheetHeader>
        
        <div className="mt-6 space-y-2">
          {notifications.length === 0 ? (
            <div className="text-center text-muted-foreground py-12">
              <Bell className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <div className="text-sm">Keine Benachrichtigungen</div>
            </div>
          ) : (
            notifications.map(notification => (
              <button
                key={notification.id}
                className={`w-full p-4 rounded-lg text-left hover:bg-accent transition-colors border ${
                  notification.read ? 'border-border bg-card' : 'border-primary/20 bg-primary/5'
                }`}
                onClick={onClose}
              >
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-lg ${
                    notification.read ? 'bg-muted' : 'bg-primary/10'
                  }`}>
                    {getIcon(notification.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm">{notification.title}</div>
                    <div className="text-xs text-muted-foreground mt-1 line-clamp-2">
                      {notification.description}
                    </div>
                    <div className="text-xs text-muted-foreground mt-2">
                      {getRelativeTime(notification.timestamp)}
                    </div>
                  </div>
                  {!notification.read && (
                    <div className="w-2 h-2 bg-primary rounded-full shrink-0 mt-2" />
                  )}
                </div>
              </button>
            ))
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
