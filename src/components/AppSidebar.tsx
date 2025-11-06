import { LayoutDashboard, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

interface AppSidebarProps {
  onDashboardClick: () => void;
  onCalendarClick: () => void;
  canAccessDashboard: boolean;
}

export function AppSidebar({ onDashboardClick, onCalendarClick, canAccessDashboard }: AppSidebarProps) {
  const { collapsed } = useSidebar();

  if (!canAccessDashboard) {
    return null;
  }

  const navItems = [
    {
      title: "Dashboard",
      icon: LayoutDashboard,
      onClick: onDashboardClick,
    },
    {
      title: "Kalender",
      icon: Calendar,
      onClick: onCalendarClick,
    },
  ];

  return (
    <Sidebar className={cn(collapsed ? "w-14" : "w-[200px]")} collapsible>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton onClick={item.onClick} tooltip={item.title}>
                    <item.icon className="h-4 w-4" />
                    {!collapsed && <span>{item.title}</span>}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
