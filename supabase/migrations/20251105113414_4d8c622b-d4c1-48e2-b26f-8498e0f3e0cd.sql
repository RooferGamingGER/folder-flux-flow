-- ============================================
-- Phase 1: Datenbank-Struktur
-- ============================================

-- 1.1 Enum für Benutzerrollen erstellen
CREATE TYPE public.user_role AS ENUM (
  'geschaeftsfuehrer',
  'buerokraft',
  'team_projektleiter',
  'vorarbeiter',
  'mitarbeiter',
  'azubi'
);

-- 1.2 Organisations-Tabelle erstellen
CREATE TABLE public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- 1.3 User Roles Tabelle erstellen
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  role user_role NOT NULL,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID,
  UNIQUE(user_id, organization_id)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 1.4 Projekt-Mitglieder Tabelle erstellen
CREATE TABLE public.project_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  user_id UUID NOT NULL,
  added_by UUID,
  added_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(project_id, user_id)
);

ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;

-- 1.5 Organization-Referenz zu profiles hinzufügen
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id);

-- 1.6 created_by Spalten zu bestehenden Tabellen hinzufügen
ALTER TABLE public.messages 
ADD COLUMN IF NOT EXISTS created_by UUID;

ALTER TABLE public.project_files 
ADD COLUMN IF NOT EXISTS created_by UUID;

ALTER TABLE public.project_directories 
ADD COLUMN IF NOT EXISTS created_by UUID;

-- ============================================
-- Phase 2: Security Definer Funktionen
-- ============================================

-- 2.1 Rollen-Prüfungsfunktionen
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role user_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  );
$$;

CREATE OR REPLACE FUNCTION public.is_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'geschaeftsfuehrer');
$$;

CREATE OR REPLACE FUNCTION public.is_office_staff(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'buerokraft');
$$;

CREATE OR REPLACE FUNCTION public.is_team_leader(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'team_projektleiter');
$$;

CREATE OR REPLACE FUNCTION public.has_full_access(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('geschaeftsfuehrer', 'buerokraft')
  );
$$;

CREATE OR REPLACE FUNCTION public.can_manage_projects(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('geschaeftsfuehrer', 'buerokraft', 'team_projektleiter')
  );
$$;

-- 2.2 Projekt-Zugriffs-Prüfungen
CREATE OR REPLACE FUNCTION public.can_access_project(_user_id UUID, _project_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (
    public.has_full_access(_user_id)
    OR
    EXISTS (
      SELECT 1 FROM public.projects 
      WHERE id = _project_id AND user_id = _user_id
    )
    OR
    EXISTS (
      SELECT 1 FROM public.project_members 
      WHERE project_id = _project_id AND user_id = _user_id
    )
  );
$$;

CREATE OR REPLACE FUNCTION public.can_manage_project_members(_user_id UUID, _project_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (
    public.can_manage_projects(_user_id)
    AND
    public.can_access_project(_user_id, _project_id)
  );
$$;

-- 2.3 Lösch-Berechtigungs-Prüfungen
CREATE OR REPLACE FUNCTION public.can_delete_message(_user_id UUID, _message_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (
    public.has_full_access(_user_id)
    OR
    EXISTS (
      SELECT 1 FROM public.messages m
      JOIN public.user_roles ur ON ur.user_id = _user_id
      WHERE m.id = _message_id 
        AND m.user_id = _user_id
        AND ur.role IN ('team_projektleiter', 'vorarbeiter')
    )
    OR
    EXISTS (
      SELECT 1 FROM public.messages m
      JOIN public.user_roles ur ON ur.user_id = _user_id
      WHERE m.id = _message_id 
        AND m.user_id = _user_id
        AND ur.role = 'mitarbeiter'
        AND m.timestamp > (now() - interval '48 hours')
    )
  );
$$;

CREATE OR REPLACE FUNCTION public.can_delete_file(_user_id UUID, _file_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (
    public.has_full_access(_user_id)
    OR
    EXISTS (
      SELECT 1 FROM public.project_files f
      JOIN public.user_roles ur ON ur.user_id = _user_id
      WHERE f.id = _file_id 
        AND f.created_by = _user_id
        AND ur.role IN ('team_projektleiter', 'vorarbeiter')
    )
    OR
    EXISTS (
      SELECT 1 FROM public.project_files f
      JOIN public.user_roles ur ON ur.user_id = _user_id
      WHERE f.id = _file_id 
        AND f.created_by = _user_id
        AND ur.role = 'mitarbeiter'
        AND f.modified > (now() - interval '48 hours')
    )
  );
$$;

CREATE OR REPLACE FUNCTION public.can_delete_directory(_user_id UUID, _directory_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (
    public.has_full_access(_user_id)
    OR
    EXISTS (
      SELECT 1 FROM public.project_directories d
      JOIN public.user_roles ur ON ur.user_id = _user_id
      WHERE d.id = _directory_id 
        AND d.created_by = _user_id
        AND ur.role IN ('team_projektleiter', 'vorarbeiter')
    )
    OR
    EXISTS (
      SELECT 1 FROM public.project_directories d
      JOIN public.user_roles ur ON ur.user_id = _user_id
      WHERE d.id = _directory_id 
        AND d.created_by = _user_id
        AND d.created_at > (now() - interval '48 hours')
        AND ur.role = 'mitarbeiter'
    )
  );
$$;

-- ============================================
-- Phase 3: Row Level Security Policies
-- ============================================

-- 3.1 user_roles Policies
CREATE POLICY "Admins can view all roles"
ON public.user_roles FOR SELECT
USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can insert roles"
ON public.user_roles FOR INSERT
WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can update roles"
ON public.user_roles FOR UPDATE
USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can delete roles"
ON public.user_roles FOR DELETE
USING (public.is_admin(auth.uid()));

-- 3.2 project_members Policies
CREATE POLICY "Users can view project members if they have access"
ON public.project_members FOR SELECT
USING (public.can_access_project(auth.uid(), project_id));

CREATE POLICY "Authorized users can add project members"
ON public.project_members FOR INSERT
WITH CHECK (public.can_manage_project_members(auth.uid(), project_id));

CREATE POLICY "Authorized users can remove project members"
ON public.project_members FOR DELETE
USING (public.can_manage_project_members(auth.uid(), project_id));

-- 3.3 projects Policies aktualisieren
DROP POLICY IF EXISTS "Users can view their own projects" ON public.projects;
DROP POLICY IF EXISTS "Users can create their own projects" ON public.projects;
DROP POLICY IF EXISTS "Users can update their own projects" ON public.projects;
DROP POLICY IF EXISTS "Users can delete their own projects" ON public.projects;

CREATE POLICY "Users can view accessible projects"
ON public.projects FOR SELECT
USING (
  public.can_access_project(auth.uid(), id)
);

CREATE POLICY "Authorized users can create projects"
ON public.projects FOR INSERT
WITH CHECK (
  public.can_manage_projects(auth.uid())
  AND auth.uid() = user_id
);

CREATE POLICY "Authorized users can update projects"
ON public.projects FOR UPDATE
USING (
  public.can_access_project(auth.uid(), id)
  AND (
    public.can_manage_projects(auth.uid())
    OR auth.uid() = user_id
  )
);

CREATE POLICY "Authorized users can delete projects"
ON public.projects FOR DELETE
USING (
  public.has_full_access(auth.uid())
  OR auth.uid() = user_id
);

-- 3.4 folders Policies aktualisieren
DROP POLICY IF EXISTS "Users can view their own folders" ON public.folders;
DROP POLICY IF EXISTS "Users can create their own folders" ON public.folders;
DROP POLICY IF EXISTS "Users can update their own folders" ON public.folders;
DROP POLICY IF EXISTS "Users can delete their own folders" ON public.folders;

CREATE POLICY "Users can view accessible folders"
ON public.folders FOR SELECT
USING (
  auth.uid() = user_id
  OR public.has_full_access(auth.uid())
);

CREATE POLICY "Authorized users can create folders"
ON public.folders FOR INSERT
WITH CHECK (
  public.can_manage_projects(auth.uid())
  AND auth.uid() = user_id
);

CREATE POLICY "Authorized users can update folders"
ON public.folders FOR UPDATE
USING (
  auth.uid() = user_id
  OR public.has_full_access(auth.uid())
);

CREATE POLICY "Authorized users can delete folders"
ON public.folders FOR DELETE
USING (
  public.has_full_access(auth.uid())
  OR auth.uid() = user_id
);

-- 3.5 messages Policies aktualisieren
DROP POLICY IF EXISTS "Users can view project messages" ON public.messages;
DROP POLICY IF EXISTS "Users can create project messages" ON public.messages;
DROP POLICY IF EXISTS "Users can update project messages" ON public.messages;
DROP POLICY IF EXISTS "Users can delete project messages" ON public.messages;

CREATE POLICY "Users can view messages in accessible projects"
ON public.messages FOR SELECT
USING (public.can_access_project(auth.uid(), project_id));

CREATE POLICY "Authenticated users can create messages"
ON public.messages FOR INSERT
WITH CHECK (
  public.can_access_project(auth.uid(), project_id)
  AND auth.uid() = user_id
);

CREATE POLICY "Users can update their own messages"
ON public.messages FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Authorized users can delete messages"
ON public.messages FOR DELETE
USING (public.can_delete_message(auth.uid(), id));

-- 3.6 project_files Policies aktualisieren
DROP POLICY IF EXISTS "Users can view project files" ON public.project_files;
DROP POLICY IF EXISTS "Users can create project files" ON public.project_files;
DROP POLICY IF EXISTS "Users can update project files" ON public.project_files;
DROP POLICY IF EXISTS "Users can delete project files" ON public.project_files;

CREATE POLICY "Users can view files in accessible projects"
ON public.project_files FOR SELECT
USING (public.can_access_project(auth.uid(), project_id));

CREATE POLICY "Authenticated users can upload files"
ON public.project_files FOR INSERT
WITH CHECK (
  public.can_access_project(auth.uid(), project_id)
);

CREATE POLICY "Users can update files they created"
ON public.project_files FOR UPDATE
USING (
  created_by = auth.uid()
  OR public.has_full_access(auth.uid())
);

CREATE POLICY "Authorized users can delete files"
ON public.project_files FOR DELETE
USING (public.can_delete_file(auth.uid(), id));

-- 3.7 project_directories Policies aktualisieren
DROP POLICY IF EXISTS "Users can view project directories" ON public.project_directories;
DROP POLICY IF EXISTS "Users can create project directories" ON public.project_directories;
DROP POLICY IF EXISTS "Users can update project directories" ON public.project_directories;
DROP POLICY IF EXISTS "Users can delete project directories" ON public.project_directories;

CREATE POLICY "Users can view directories in accessible projects"
ON public.project_directories FOR SELECT
USING (public.can_access_project(auth.uid(), project_id));

CREATE POLICY "Authenticated users can create directories"
ON public.project_directories FOR INSERT
WITH CHECK (
  public.can_access_project(auth.uid(), project_id)
);

CREATE POLICY "Users can update directories"
ON public.project_directories FOR UPDATE
USING (
  public.can_access_project(auth.uid(), project_id)
  AND (
    created_by = auth.uid()
    OR public.has_full_access(auth.uid())
  )
);

CREATE POLICY "Authorized users can delete directories"
ON public.project_directories FOR DELETE
USING (public.can_delete_directory(auth.uid(), id));

-- 3.8 contacts Policies aktualisieren
DROP POLICY IF EXISTS "Users can view project contacts" ON public.contacts;
DROP POLICY IF EXISTS "Users can create project contacts" ON public.contacts;
DROP POLICY IF EXISTS "Users can update project contacts" ON public.contacts;
DROP POLICY IF EXISTS "Users can delete project contacts" ON public.contacts;

CREATE POLICY "Users can view contacts in accessible projects"
ON public.contacts FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.projects
    WHERE id = contacts.project_id
      AND public.can_access_project(auth.uid(), id)
  )
);

CREATE POLICY "Authorized users can create contacts"
ON public.contacts FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.projects
    WHERE id = contacts.project_id
      AND public.can_access_project(auth.uid(), id)
  )
);

CREATE POLICY "Authorized users can update contacts"
ON public.contacts FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.projects
    WHERE id = contacts.project_id
      AND public.can_access_project(auth.uid(), id)
  )
);

CREATE POLICY "Authorized users can delete contacts"
ON public.contacts FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.projects
    WHERE id = contacts.project_id
      AND public.can_access_project(auth.uid(), id)
      AND public.has_full_access(auth.uid())
  )
);

-- 3.9 notes Policies aktualisieren
DROP POLICY IF EXISTS "Users can view project notes" ON public.notes;
DROP POLICY IF EXISTS "Users can create project notes" ON public.notes;
DROP POLICY IF EXISTS "Users can update project notes" ON public.notes;
DROP POLICY IF EXISTS "Users can delete project notes" ON public.notes;

CREATE POLICY "Users can view notes in accessible projects"
ON public.notes FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.projects
    WHERE id = notes.project_id
      AND public.can_access_project(auth.uid(), id)
  )
);

CREATE POLICY "Authorized users can create notes"
ON public.notes FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.projects
    WHERE id = notes.project_id
      AND public.can_access_project(auth.uid(), id)
  )
);

CREATE POLICY "Authorized users can update notes"
ON public.notes FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.projects
    WHERE id = notes.project_id
      AND public.can_access_project(auth.uid(), id)
  )
);

CREATE POLICY "Authorized users can delete notes"
ON public.notes FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.projects
    WHERE id = notes.project_id
      AND public.can_access_project(auth.uid(), id)
      AND public.has_full_access(auth.uid())
  )
);

-- 3.10 project_details Policies aktualisieren
DROP POLICY IF EXISTS "Users can view project details" ON public.project_details;
DROP POLICY IF EXISTS "Users can create project details" ON public.project_details;
DROP POLICY IF EXISTS "Users can update project details" ON public.project_details;
DROP POLICY IF EXISTS "Users can delete project details" ON public.project_details;

CREATE POLICY "Users can view details in accessible projects"
ON public.project_details FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.projects
    WHERE id = project_details.project_id
      AND public.can_access_project(auth.uid(), id)
  )
);

CREATE POLICY "Authorized users can create details"
ON public.project_details FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.projects
    WHERE id = project_details.project_id
      AND public.can_access_project(auth.uid(), id)
  )
);

CREATE POLICY "Authorized users can update details"
ON public.project_details FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.projects
    WHERE id = project_details.project_id
      AND public.can_access_project(auth.uid(), id)
  )
);

CREATE POLICY "Authorized users can delete details"
ON public.project_details FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.projects
    WHERE id = project_details.project_id
      AND public.can_access_project(auth.uid(), id)
      AND public.has_full_access(auth.uid())
  )
);

-- ============================================
-- Phase 4: Migrationsstrategie
-- ============================================

-- 4.1 Trigger: Erster User wird automatisch Admin
CREATE OR REPLACE FUNCTION public.assign_first_admin()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.user_roles LIMIT 1) THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'geschaeftsfuehrer');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_first_user_created
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_first_admin();

-- 4.2 Bestehende Projekte dem Creator als Mitglied zuweisen
INSERT INTO public.project_members (project_id, user_id, added_by)
SELECT id, user_id, user_id
FROM public.projects
ON CONFLICT (project_id, user_id) DO NOTHING;