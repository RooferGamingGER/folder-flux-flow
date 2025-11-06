import { LayoutDashboard, Calendar } from "lucide-react";
import { Sidebar, SidebarContent, SidebarMenu, SidebarMenuItem, SidebarMenuButton } from "@/components/ui/sidebar";

interface AppSidebarProps {
  onDashboardClick: () => void;
  onCalendarClick: () => void;
}

export function AppSidebar({ onDashboardClick, onCalendarClick }: AppSidebarProps) {
  return (
    <Sidebar collapsible="icon" className="border-r border-border">
      <SidebarContent>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={onDashboardClick} tooltip="Dashboard">
              <LayoutDashboard className="w-5 h-5" />
              <span>Dashboard</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={onCalendarClick} tooltip="Kalender">
              <Calendar className="w-5 h-5" />
              <span>Kalender</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarContent>
    </Sidebar>
  );
}
