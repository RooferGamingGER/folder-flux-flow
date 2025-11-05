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
  isForeman: boolean;
  isWorker: boolean;
  isApprentice: boolean;
  hasFullAccess: boolean;
  canManageProjects: boolean;
  canViewProjectContent: boolean;
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
      console.log('🔍 [useUserRole] Fetching role for user:', user.id);
      
      const { data, error } = await supabase
        .from('user_roles')
        .select('role, organization_id')
        .eq('user_id', user.id)
        .maybeSingle();

      console.log('📊 [useUserRole] Result:', { data, error });

      if (data && !error) {
        setRole(data.role as UserRole);
        setOrganizationId(data.organization_id);
        console.log('✅ [useUserRole] Role set:', data.role);
      } else {
        setRole(null);
        setOrganizationId(null);
        console.log('❌ [useUserRole] No role found or error');
      }
      setLoading(false);
    };

    fetchRole();
  }, [user]);

  const isAdmin = role === 'geschaeftsfuehrer';
  const isOfficeStaff = role === 'buerokraft';
  const isTeamLeader = role === 'team_projektleiter';
  const isForeman = role === 'vorarbeiter';
  const isWorker = role === 'mitarbeiter';
  const isApprentice = role === 'azubi';
  const hasFullAccess = isAdmin || isOfficeStaff;
  const canManageProjects = hasFullAccess || isTeamLeader;
  const canViewProjectContent = isAdmin || isOfficeStaff || isTeamLeader || isForeman || isWorker || isApprentice;
  const canAccessDashboard = isAdmin || isOfficeStaff || isTeamLeader;

  return {
    role,
    organizationId,
    isAdmin,
    isOfficeStaff,
    isTeamLeader,
    isForeman,
    isWorker,
    isApprentice,
    hasFullAccess,
    canManageProjects,
    canViewProjectContent,
    canAccessDashboard,
    loading,
  };
}
