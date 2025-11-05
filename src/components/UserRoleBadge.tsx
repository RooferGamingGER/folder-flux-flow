import { useUserRole } from '@/hooks/useUserRole';
import { Badge } from './ui/badge';

const roleLabels = {
  geschaeftsfuehrer: '👔 Geschäftsführer',
  buerokraft: '📋 Bürokraft',
  team_projektleiter: '👨‍💼 Projektleiter',
  vorarbeiter: '🔧 Vorarbeiter',
  mitarbeiter: '👷 Mitarbeiter',
  azubi: '🎓 Azubi',
};

export function UserRoleBadge() {
  const { role } = useUserRole();

  if (!role) return null;

  return (
    <Badge variant="secondary" className="text-xs">
      {roleLabels[role]}
    </Badge>
  );
}
