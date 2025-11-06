import { LayoutDashboard, Calendar } from "lucide-react";
import { Sidebar, SidebarContent, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarTrigger } from "@/components/ui/sidebar";

interface AppSidebarProps {
  onDashboardClick: () => void;
  onCalendarClick: () => void;
}

export function AppSidebar({ onDashboardClick, onCalendarClick }: AppSidebarProps) {
  return (
    <Sidebar collapsible="offcanvas" className="border-r border-border bg-sidebar w-14 data-[state=expanded]:w-48">
      <div className="p-2 border-b border-border">
        <SidebarTrigger />
      </div>
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
