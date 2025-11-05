-- Erweitere can_access_folder() um Projekt-Mitglieder zu berücksichtigen
-- Dies ermöglicht es Benutzern, Ordner zu sehen, wenn sie Mitglied in mindestens einem Projekt des Ordners sind

CREATE OR REPLACE FUNCTION public.can_access_folder(_user_id UUID, _folder_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (
    -- Admins und Bürokräfte sehen alle Ordner
    public.has_full_access(_user_id)
    OR
    -- Ordner-Eigentümer
    EXISTS (
      SELECT 1 FROM public.folders 
      WHERE id = _folder_id AND user_id = _user_id
    )
    OR
    -- Zugewiesenes Ordner-Mitglied
    EXISTS (
      SELECT 1 FROM public.folder_members 
      WHERE folder_id = _folder_id AND user_id = _user_id
    )
    OR
    -- Projekt-Mitglied in mindestens einem Projekt des Ordners
    EXISTS (
      SELECT 1 FROM public.projects p
      INNER JOIN public.project_members pm ON pm.project_id = p.id
      WHERE p.folder_id = _folder_id 
        AND pm.user_id = _user_id
        AND p.deleted_at IS NULL
    )
  );
$$;