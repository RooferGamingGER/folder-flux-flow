import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export type UserRole = 
  | 'geschaeftsfuehrer'
  | 'buerokraft'
  | 'team_projektleiter'
  | 'vorarbeiter'
  | 'mitarbeiter'
  | 'azubi'
  | null;

export interface UserRoleData {
  role: UserRole;
  organizationId: string | null;
  isAdmin: boolean;
  isOfficeStaff: boolean;
  isTeamLeader: boolean;
  hasFullAccess: boolean;
  canManageProjects: boolean;
  canAccessDashboard: boolean;
  loading: boolean;
}

export function useUserRole(): UserRoleData {
  const { user } = useAuth();
  const [role, setRole] = useState<UserRole>(null);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setRole(null);
      setOrganizationId(null);
      setLoading(false);
      return;
    }

    const fetchRole = async () => {
      const { data, error } = await supabase
        .from('user_roles')
        .select('role, organization_id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (data && !error) {
        setRole(data.role as UserRole);
        setOrganizationId(data.organization_id);
      } else {
        setRole(null);
        setOrganizationId(null);
      }
      setLoading(false);
    };

    fetchRole();
  }, [user]);

  const isAdmin = role === 'geschaeftsfuehrer';
  const isOfficeStaff = role === 'buerokraft';
  const isTeamLeader = role === 'team_projektleiter';
  const hasFullAccess = isAdmin || isOfficeStaff;
  const canManageProjects = hasFullAccess || isTeamLeader;
  const canAccessDashboard = isAdmin || isOfficeStaff || isTeamLeader;

  return {
    role,
    organizationId,
    isAdmin,
    isOfficeStaff,
    isTeamLeader,
    hasFullAccess,
    canManageProjects,
    canAccessDashboard,
    loading,
  };
}
