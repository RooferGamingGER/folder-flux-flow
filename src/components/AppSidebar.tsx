import { LayoutDashboard, Calendar, Briefcase, ExternalLink } from "lucide-react";
import { Sidebar, SidebarContent, SidebarMenu, SidebarMenuItem, SidebarMenuButton } from "@/components/ui/sidebar";

interface AppSidebarProps {
  onDashboardClick: () => void;
  onProjectCalendarClick: () => void;
  onConstructionCalendarClick: () => void;
  canAccessDashboard: boolean;
}

export function AppSidebar({ onDashboardClick, onProjectCalendarClick, onConstructionCalendarClick, canAccessDashboard }: AppSidebarProps) {
  return (
    <Sidebar className="border-r border-border bg-sidebar w-24">
      <SidebarContent className="py-4">
        <SidebarMenu className="space-y-2">
          {canAccessDashboard && (
            <SidebarMenuItem>
              <SidebarMenuButton 
                onClick={onDashboardClick} 
                tooltip="Dashboard"
                className="flex flex-col items-center justify-center h-20 gap-2 px-2 hover:bg-accent active:bg-accent/70 transition-colors touch-manipulation"
              >
                <LayoutDashboard className="w-8 h-8" />
                <span className="text-xs text-center">Dashboard</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}
          {canAccessDashboard && (
            <SidebarMenuItem>
              <SidebarMenuButton 
                onClick={onProjectCalendarClick} 
                tooltip="Projekt-Kalender"
                className="flex flex-col items-center justify-center h-20 gap-2 px-2 hover:bg-accent active:bg-accent/70 transition-colors touch-manipulation"
              >
                <Calendar className="w-8 h-8" />
                <span className="text-xs text-center">Projekt-Kalender</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}
          {canAccessDashboard && (
            <SidebarMenuItem>
      <SidebarMenuButton 
        onClick={onConstructionCalendarClick} 
        tooltip="Baustellenkalender"
        className="flex flex-col items-center justify-center h-20 gap-2 px-2 hover:bg-accent active:bg-accent/70 transition-colors touch-manipulation"
      >
        <Briefcase className="w-8 h-8" />
        <span className="text-[10px] text-center leading-tight">Baustellen-Kalender</span>
      </SidebarMenuButton>
            </SidebarMenuItem>
          )}
          <SidebarMenuItem>
            <SidebarMenuButton 
              asChild
              tooltip="App"
              className="flex flex-col items-center justify-center h-20 gap-2 px-2 hover:bg-accent active:bg-accent/70 transition-colors touch-manipulation"
            >
              <a 
                href="https://eu.jotform.com/app/240792512672357" 
                target="_blank" 
                rel="noopener noreferrer"
              >
                <ExternalLink className="w-8 h-8" />
                <span className="text-xs text-center">App</span>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarContent>
    </Sidebar>
  );
}
