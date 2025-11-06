import { LayoutDashboard, Calendar } from "lucide-react";
import { Sidebar, SidebarContent, SidebarMenu, SidebarMenuItem, SidebarMenuButton } from "@/components/ui/sidebar";

interface AppSidebarProps {
  onDashboardClick: () => void;
  onCalendarClick: () => void;
}

export function AppSidebar({ onDashboardClick, onCalendarClick }: AppSidebarProps) {
  return (
    <Sidebar className="border-r border-border bg-sidebar w-24">
      <SidebarContent className="py-4">
        <SidebarMenu className="space-y-2">
          <SidebarMenuItem>
            <SidebarMenuButton 
              onClick={onDashboardClick} 
              tooltip="Dashboard"
              className="flex flex-col items-center justify-center h-20 gap-2 px-2 hover:bg-accent transition-colors"
            >
              <LayoutDashboard className="w-8 h-8" />
              <span className="text-xs text-center">Dashboard</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton 
              onClick={onCalendarClick} 
              tooltip="Kalender"
              className="flex flex-col items-center justify-center h-20 gap-2 px-2 hover:bg-accent transition-colors"
            >
              <Calendar className="w-8 h-8" />
              <span className="text-xs text-center">Kalender</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarContent>
    </Sidebar>
  );
}
