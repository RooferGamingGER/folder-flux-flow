import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Moon, Sun, LogOut, User, Database } from "lucide-react";
import { useThemePreference } from "@/hooks/useThemePreference";
import { useUserRole } from "@/hooks/useUserRole";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

interface MobileSettingsSheetProps {
  open: boolean;
  onClose: () => void;
  onSignOut: () => void;
  userEmail?: string;
  onCraftnoteigrationClick?: () => void;
}

export function MobileSettingsSheet({ open, onClose, onSignOut, userEmail, onCraftnoteigrationClick }: MobileSettingsSheetProps) {
  const { theme, setTheme, isLoading } = useThemePreference();
  const { isAdmin } = useUserRole();

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent side="right">
        <SheetHeader>
          <SheetTitle>Einstellungen</SheetTitle>
        </SheetHeader>
        
        <div className="mt-6 space-y-6">
          {/* User Info */}
          {userEmail && (
            <>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{userEmail}</div>
                  <div className="text-xs text-muted-foreground">Angemeldet</div>
                </div>
              </div>
              <Separator />
            </>
          )}
          
          {/* Theme Toggle */}
          <div>
            <div className="text-sm font-medium mb-3">Darstellung</div>
            <div className="flex gap-2">
              <Button
                variant={theme === "light" ? "default" : "outline"}
                className="flex-1"
                onClick={() => setTheme("light")}
                disabled={isLoading}
              >
                <Sun className="w-4 h-4 mr-2" />
                Hell
              </Button>
              <Button
                variant={theme === "dark" ? "default" : "outline"}
                className="flex-1"
                onClick={() => setTheme("dark")}
                disabled={isLoading}
              >
                <Moon className="w-4 h-4 mr-2" />
                Dunkel
              </Button>
            </div>
          </div>
          
          <Separator />
          
          {/* Craftnote Migration (nur für Admins) */}
          {isAdmin && onCraftnoteigrationClick && (
            <>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  onCraftnoteigrationClick();
                  onClose();
                }}
              >
                <Database className="w-4 h-4 mr-2" />
                Craftnote Migration
              </Button>
              
              <Separator />
            </>
          )}
          
          {/* Sign Out */}
          <Button
            variant="destructive"
            className="w-full"
            onClick={() => {
              onSignOut();
              onClose();
            }}
          >
            <LogOut className="w-4 h-4 mr-2" />
            Abmelden
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
