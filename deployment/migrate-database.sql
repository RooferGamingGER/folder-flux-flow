-- =============================================
-- Supabase Database Migration Script
-- Project: Nobis Construction Management
-- =============================================

-- 1. Enums erstellen
-- =============================================

CREATE TYPE IF NOT EXISTS public.user_role AS ENUM (
  'geschaeftsfuehrer',
  'buerokraft',
  'team_projektleiter',
  'vorarbeiter',
  'mitarbeiter',
  'azubi'
);

CREATE TYPE IF NOT EXISTS public.sync_status AS ENUM (
  'synced',
  'pending',
  'failed'
);

-- 2. Tabellen erstellen
-- =============================================

-- Organizations
CREATE TABLE IF NOT EXISTS public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Profiles
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL,
  organization_id UUID REFERENCES public.organizations(id),
  theme_preference TEXT DEFAULT 'system',
  must_change_password BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- User Roles
CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role public.user_role NOT NULL,
  organization_id UUID REFERENCES public.organizations(id),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, role)
);

-- Folders
CREATE TABLE IF NOT EXISTS public.folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  archived BOOLEAN DEFAULT false,
  sync_status public.sync_status DEFAULT 'synced',
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Folder Members
CREATE TABLE IF NOT EXISTS public.folder_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  folder_id UUID NOT NULL REFERENCES public.folders(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  added_by UUID REFERENCES auth.users(id),
  added_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(folder_id, user_id)
);

-- Projects
CREATE TABLE IF NOT EXISTS public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  folder_id UUID REFERENCES public.folders(id) ON DELETE SET NULL,
  archived BOOLEAN DEFAULT false,
  sync_status public.sync_status DEFAULT 'synced',
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Project Members
CREATE TABLE IF NOT EXISTS public.project_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  added_by UUID REFERENCES auth.users(id),
  added_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(project_id, user_id)
);

-- Project Exclusions
CREATE TABLE IF NOT EXISTS public.project_exclusions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  excluded_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, project_id)
);

-- Project Details
CREATE TABLE IF NOT EXISTS public.project_details (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  projektname TEXT,
  auftragsnummer TEXT,
  projektstatus TEXT,
  startdatum DATE,
  enddatum DATE,
  strasse TEXT,
  plz TEXT,
  stadt TEXT,
  land TEXT,
  ansprechpartner TEXT,
  notiz TEXT,
  sync_status public.sync_status DEFAULT 'synced',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(project_id)
);

-- Project Directories
CREATE TABLE IF NOT EXISTS public.project_directories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  order_index INTEGER DEFAULT 0,
  created_by UUID REFERENCES auth.users(id),
  sync_status public.sync_status DEFAULT 'synced',
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Project Files
CREATE TABLE IF NOT EXISTS public.project_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  folder TEXT,
  storage_path TEXT,
  local_blob_url TEXT,
  size TEXT,
  ext TEXT,
  mime TEXT,
  is_image BOOLEAN DEFAULT false,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  gps_altitude DOUBLE PRECISION,
  gps_accuracy DOUBLE PRECISION,
  taken_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),
  sync_status public.sync_status DEFAULT 'synced',
  deleted_at TIMESTAMPTZ,
  modified TIMESTAMPTZ DEFAULT now()
);

-- Messages
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  sender TEXT NOT NULL,
  type TEXT NOT NULL,
  content JSONB,
  created_by UUID REFERENCES auth.users(id),
  sync_status public.sync_status DEFAULT 'synced',
  deleted_at TIMESTAMPTZ,
  timestamp TIMESTAMPTZ DEFAULT now()
);

-- Notes
CREATE TABLE IF NOT EXISTS public.notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  text TEXT,
  sync_status public.sync_status DEFAULT 'synced',
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Contacts
CREATE TABLE IF NOT EXISTS public.contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name TEXT,
  email TEXT,
  phone TEXT,
  sync_status public.sync_status DEFAULT 'synced',
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Sync Queue
CREATE TABLE IF NOT EXISTS public.sync_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  table_name TEXT NOT NULL,
  record_id UUID NOT NULL,
  operation TEXT NOT NULL,
  data JSONB,
  retry_count INTEGER DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Indizes erstellen
-- =============================================

CREATE INDEX IF NOT EXISTS idx_profiles_organization ON public.profiles(organization_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_folders_user_id ON public.folders(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON public.projects(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_folder_id ON public.projects(folder_id);
CREATE INDEX IF NOT EXISTS idx_project_files_project_id ON public.project_files(project_id);
CREATE INDEX IF NOT EXISTS idx_project_files_gps ON public.project_files(latitude, longitude) WHERE latitude IS NOT NULL AND longitude IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_messages_project_id ON public.messages(project_id);

-- 4. Funktionen erstellen
-- =============================================

-- Has Role Function
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role user_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  );
$$;

-- Is Admin
CREATE OR REPLACE FUNCTION public.is_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'geschaeftsfuehrer');
$$;

-- Is Office Staff
CREATE OR REPLACE FUNCTION public.is_office_staff(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'buerokraft');
$$;

-- Has Full Access
CREATE OR REPLACE FUNCTION public.has_full_access(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('geschaeftsfuehrer', 'buerokraft')
  );
$$;

-- Can Manage Projects
CREATE OR REPLACE FUNCTION public.can_manage_projects(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('geschaeftsfuehrer', 'buerokraft', 'team_projektleiter')
  );
$$;

-- Can Access Folder
CREATE OR REPLACE FUNCTION public.can_access_folder(_user_id UUID, _folder_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (
    public.has_full_access(_user_id)
    OR
    EXISTS (
      SELECT 1 FROM public.folders 
      WHERE id = _folder_id AND user_id = _user_id
    )
    OR
    EXISTS (
      SELECT 1 FROM public.folder_members 
      WHERE folder_id = _folder_id AND user_id = _user_id
    )
    OR
    EXISTS (
      SELECT 1 FROM public.projects p
      INNER JOIN public.project_members pm ON pm.project_id = p.id
      WHERE p.folder_id = _folder_id 
        AND pm.user_id = _user_id
        AND p.deleted_at IS NULL
    )
  );
$$;

-- Can Access Project
CREATE OR REPLACE FUNCTION public.can_access_project(_user_id UUID, _project_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (
    NOT EXISTS (
      SELECT 1 FROM public.project_exclusions
      WHERE user_id = _user_id AND project_id = _project_id
    )
    AND
    (
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
      OR
      EXISTS (
        SELECT 1 FROM public.projects p
        INNER JOIN public.folder_members fm ON fm.folder_id = p.folder_id
        WHERE p.id = _project_id AND fm.user_id = _user_id
      )
    )
  );
$$;

-- Can Manage Folder Members
CREATE OR REPLACE FUNCTION public.can_manage_folder_members(_user_id UUID, _folder_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (
    public.can_manage_projects(_user_id)
    AND
    public.can_access_folder(_user_id, _folder_id)
  );
$$;

-- Can Manage Project Members
CREATE OR REPLACE FUNCTION public.can_manage_project_members(_user_id UUID, _project_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (
    public.can_manage_projects(_user_id)
    AND
    public.can_access_project(_user_id, _project_id)
  );
$$;

-- Can Delete File
CREATE OR REPLACE FUNCTION public.can_delete_file(_user_id UUID, _file_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE SECURITY DEFINER
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
        AND ur.role IN ('mitarbeiter', 'azubi')
        AND f.modified > (now() - interval '48 hours')
    )
  );
$$;

-- Can Delete Directory
CREATE OR REPLACE FUNCTION public.can_delete_directory(_user_id UUID, _directory_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE SECURITY DEFINER
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

-- Can Delete Message
CREATE OR REPLACE FUNCTION public.can_delete_message(_user_id UUID, _message_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE SECURITY DEFINER
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
        AND ur.role IN ('mitarbeiter', 'azubi')
        AND m.timestamp > (now() - interval '48 hours')
    )
  );
$$;

-- Can Access Dashboard
CREATE OR REPLACE FUNCTION public.can_access_dashboard(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('geschaeftsfuehrer', 'buerokraft', 'team_projektleiter')
  );
$$;

-- Update Updated At Column
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Handle New User
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, first_name, last_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
    NEW.email
  );
  RETURN NEW;
END;
$$;

-- Assign First Admin
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

-- Set Project File Creator
CREATE OR REPLACE FUNCTION public.set_project_file_creator()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.created_by IS NULL THEN
    NEW.created_by := auth.uid();
  END IF;
  RETURN NEW;
END;
$$;

-- 5. Trigger erstellen
-- =============================================

-- Trigger für updated_at
DROP TRIGGER IF EXISTS update_folders_updated_at ON public.folders;
CREATE TRIGGER update_folders_updated_at
  BEFORE UPDATE ON public.folders
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_projects_updated_at ON public.projects;
CREATE TRIGGER update_projects_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_project_details_updated_at ON public.project_details;
CREATE TRIGGER update_project_details_updated_at
  BEFORE UPDATE ON public.project_details
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger für neue User
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

DROP TRIGGER IF EXISTS on_auth_user_created_assign_admin ON auth.users;
CREATE TRIGGER on_auth_user_created_assign_admin
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_first_admin();

-- Trigger für File Creator
DROP TRIGGER IF EXISTS set_project_file_creator_trigger ON public.project_files;
CREATE TRIGGER set_project_file_creator_trigger
  BEFORE INSERT ON public.project_files
  FOR EACH ROW
  EXECUTE FUNCTION public.set_project_file_creator();

-- 6. Row Level Security (RLS) aktivieren
-- =============================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.folder_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_exclusions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_directories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_queue ENABLE ROW LEVEL SECURITY;

-- 7. RLS Policies erstellen
-- =============================================

-- Profiles
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;
CREATE POLICY "Users can view all profiles" ON public.profiles FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

-- User Roles
DROP POLICY IF EXISTS "Users can view their own role" ON public.user_roles;
CREATE POLICY "Users can view their own role" ON public.user_roles FOR SELECT TO authenticated USING ((user_id = auth.uid()) OR is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;
CREATE POLICY "Admins can view all roles" ON public.user_roles FOR SELECT TO authenticated USING (is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can insert roles" ON public.user_roles;
CREATE POLICY "Admins can insert roles" ON public.user_roles FOR INSERT TO authenticated WITH CHECK (is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can update roles" ON public.user_roles;
CREATE POLICY "Admins can update roles" ON public.user_roles FOR UPDATE TO authenticated USING (is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can delete roles" ON public.user_roles;
CREATE POLICY "Admins can delete roles" ON public.user_roles FOR DELETE TO authenticated USING (is_admin(auth.uid()));

-- Folders
DROP POLICY IF EXISTS "Users can view accessible folders" ON public.folders;
CREATE POLICY "Users can view accessible folders" ON public.folders FOR SELECT TO authenticated USING ((auth.uid() = user_id) OR has_full_access(auth.uid()) OR can_access_folder(auth.uid(), id));

DROP POLICY IF EXISTS "Authorized users can create folders" ON public.folders;
CREATE POLICY "Authorized users can create folders" ON public.folders FOR INSERT TO authenticated WITH CHECK (can_manage_projects(auth.uid()) AND (auth.uid() = user_id));

DROP POLICY IF EXISTS "Authorized users can update folders" ON public.folders;
CREATE POLICY "Authorized users can update folders" ON public.folders FOR UPDATE TO authenticated USING ((auth.uid() = user_id) OR has_full_access(auth.uid()));

DROP POLICY IF EXISTS "Authorized users can delete folders" ON public.folders;
CREATE POLICY "Authorized users can delete folders" ON public.folders FOR DELETE TO authenticated USING (has_full_access(auth.uid()) OR (auth.uid() = user_id));

-- Folder Members
DROP POLICY IF EXISTS "Users can view folder members if they have access" ON public.folder_members;
CREATE POLICY "Users can view folder members if they have access" ON public.folder_members FOR SELECT TO authenticated USING (can_access_folder(auth.uid(), folder_id));

DROP POLICY IF EXISTS "Authorized users can add folder members" ON public.folder_members;
CREATE POLICY "Authorized users can add folder members" ON public.folder_members FOR INSERT TO authenticated WITH CHECK (can_manage_folder_members(auth.uid(), folder_id));

DROP POLICY IF EXISTS "Users can leave folders or authorized users can remove" ON public.folder_members;
CREATE POLICY "Users can leave folders or authorized users can remove" ON public.folder_members FOR DELETE TO authenticated USING ((auth.uid() = user_id) OR can_manage_folder_members(auth.uid(), folder_id));

-- Projects
DROP POLICY IF EXISTS "Users can view accessible projects" ON public.projects;
CREATE POLICY "Users can view accessible projects" ON public.projects FOR SELECT TO authenticated USING (can_access_project(auth.uid(), id));

DROP POLICY IF EXISTS "Authorized users can create projects" ON public.projects;
CREATE POLICY "Authorized users can create projects" ON public.projects FOR INSERT TO authenticated WITH CHECK (can_manage_projects(auth.uid()) AND (auth.uid() = user_id));

DROP POLICY IF EXISTS "Authorized users can update projects" ON public.projects;
CREATE POLICY "Authorized users can update projects" ON public.projects FOR UPDATE TO authenticated USING (can_access_project(auth.uid(), id) AND (can_manage_projects(auth.uid()) OR (auth.uid() = user_id)));

DROP POLICY IF EXISTS "Authorized users can delete projects" ON public.projects;
CREATE POLICY "Authorized users can delete projects" ON public.projects FOR DELETE TO authenticated USING (has_full_access(auth.uid()) OR (auth.uid() = user_id));

-- Project Members
DROP POLICY IF EXISTS "Users can view project members if they have access" ON public.project_members;
CREATE POLICY "Users can view project members if they have access" ON public.project_members FOR SELECT TO authenticated USING (can_access_project(auth.uid(), project_id));

DROP POLICY IF EXISTS "Authorized users can add project members" ON public.project_members;
CREATE POLICY "Authorized users can add project members" ON public.project_members FOR INSERT TO authenticated WITH CHECK (can_manage_project_members(auth.uid(), project_id));

DROP POLICY IF EXISTS "Users can leave projects or authorized users can remove" ON public.project_members;
CREATE POLICY "Users can leave projects or authorized users can remove" ON public.project_members FOR DELETE TO authenticated USING ((auth.uid() = user_id) OR can_manage_project_members(auth.uid(), project_id));

-- Project Exclusions
DROP POLICY IF EXISTS "Users can view their own exclusions" ON public.project_exclusions;
CREATE POLICY "Users can view their own exclusions" ON public.project_exclusions FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can exclude projects" ON public.project_exclusions;
CREATE POLICY "Users can exclude projects" ON public.project_exclusions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can remove exclusions" ON public.project_exclusions;
CREATE POLICY "Users can remove exclusions" ON public.project_exclusions FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Project Details
DROP POLICY IF EXISTS "Users can view details in accessible projects" ON public.project_details;
CREATE POLICY "Users can view details in accessible projects" ON public.project_details FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = project_details.project_id AND can_access_project(auth.uid(), projects.id)));

DROP POLICY IF EXISTS "Authorized users can create details" ON public.project_details;
CREATE POLICY "Authorized users can create details" ON public.project_details FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM projects WHERE projects.id = project_details.project_id AND can_access_project(auth.uid(), projects.id)));

DROP POLICY IF EXISTS "Authorized users can update details" ON public.project_details;
CREATE POLICY "Authorized users can update details" ON public.project_details FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = project_details.project_id AND can_access_project(auth.uid(), projects.id)));

DROP POLICY IF EXISTS "Authorized users can delete details" ON public.project_details;
CREATE POLICY "Authorized users can delete details" ON public.project_details FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = project_details.project_id AND can_access_project(auth.uid(), projects.id) AND has_full_access(auth.uid())));

-- Project Directories
DROP POLICY IF EXISTS "Users can view directories in accessible projects" ON public.project_directories;
CREATE POLICY "Users can view directories in accessible projects" ON public.project_directories FOR SELECT TO authenticated USING (can_access_project(auth.uid(), project_id));

DROP POLICY IF EXISTS "Authorized users can create directories" ON public.project_directories;
CREATE POLICY "Authorized users can create directories" ON public.project_directories FOR INSERT TO authenticated WITH CHECK (can_manage_projects(auth.uid()) AND can_access_project(auth.uid(), project_id));

DROP POLICY IF EXISTS "Authorized users can update directories" ON public.project_directories;
CREATE POLICY "Authorized users can update directories" ON public.project_directories FOR UPDATE TO authenticated USING (can_access_project(auth.uid(), project_id) AND (((created_by = auth.uid()) AND can_manage_projects(auth.uid())) OR has_full_access(auth.uid())));

DROP POLICY IF EXISTS "Authorized users can delete directories" ON public.project_directories;
CREATE POLICY "Authorized users can delete directories" ON public.project_directories FOR DELETE TO authenticated USING (can_delete_directory(auth.uid(), id));

-- Project Files
DROP POLICY IF EXISTS "Users can view files in accessible projects" ON public.project_files;
CREATE POLICY "Users can view files in accessible projects" ON public.project_files FOR SELECT TO authenticated USING (can_access_project(auth.uid(), project_id));

DROP POLICY IF EXISTS "Admins can view deleted files" ON public.project_files;
CREATE POLICY "Admins can view deleted files" ON public.project_files FOR SELECT TO authenticated USING (has_full_access(auth.uid()) AND (deleted_at IS NOT NULL));

DROP POLICY IF EXISTS "Authenticated users can upload files" ON public.project_files;
CREATE POLICY "Authenticated users can upload files" ON public.project_files FOR INSERT TO authenticated WITH CHECK (can_access_project(auth.uid(), project_id));

DROP POLICY IF EXISTS "Users can update files they created" ON public.project_files;
CREATE POLICY "Users can update files they created" ON public.project_files FOR UPDATE TO authenticated USING ((created_by = auth.uid()) OR has_full_access(auth.uid()));

DROP POLICY IF EXISTS "Authorized users can delete files" ON public.project_files;
CREATE POLICY "Authorized users can delete files" ON public.project_files FOR DELETE TO authenticated USING (can_delete_file(auth.uid(), id));

-- Messages
DROP POLICY IF EXISTS "Users can view messages in accessible projects" ON public.messages;
CREATE POLICY "Users can view messages in accessible projects" ON public.messages FOR SELECT TO authenticated USING (can_access_project(auth.uid(), project_id));

DROP POLICY IF EXISTS "Admins can view deleted messages" ON public.messages;
CREATE POLICY "Admins can view deleted messages" ON public.messages FOR SELECT TO authenticated USING (has_full_access(auth.uid()) AND (deleted_at IS NOT NULL));

DROP POLICY IF EXISTS "Authenticated users can create messages" ON public.messages;
CREATE POLICY "Authenticated users can create messages" ON public.messages FOR INSERT TO authenticated WITH CHECK (can_access_project(auth.uid(), project_id) AND (auth.uid() = user_id));

DROP POLICY IF EXISTS "Authorized users can update/delete messages" ON public.messages;
CREATE POLICY "Authorized users can update/delete messages" ON public.messages FOR UPDATE TO authenticated USING (can_delete_message(auth.uid(), id));

DROP POLICY IF EXISTS "Authorized users can delete messages" ON public.messages;
CREATE POLICY "Authorized users can delete messages" ON public.messages FOR DELETE TO authenticated USING (can_delete_message(auth.uid(), id));

-- Notes
DROP POLICY IF EXISTS "Users can view notes in accessible projects" ON public.notes;
CREATE POLICY "Users can view notes in accessible projects" ON public.notes FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = notes.project_id AND can_access_project(auth.uid(), projects.id)));

DROP POLICY IF EXISTS "Authorized users can create notes" ON public.notes;
CREATE POLICY "Authorized users can create notes" ON public.notes FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM projects WHERE projects.id = notes.project_id AND can_access_project(auth.uid(), projects.id)));

DROP POLICY IF EXISTS "Authorized users can update notes" ON public.notes;
CREATE POLICY "Authorized users can update notes" ON public.notes FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = notes.project_id AND can_access_project(auth.uid(), projects.id)));

DROP POLICY IF EXISTS "Authorized users can delete notes" ON public.notes;
CREATE POLICY "Authorized users can delete notes" ON public.notes FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = notes.project_id AND can_access_project(auth.uid(), projects.id) AND has_full_access(auth.uid())));

-- Contacts
DROP POLICY IF EXISTS "Users can view contacts in accessible projects" ON public.contacts;
CREATE POLICY "Users can view contacts in accessible projects" ON public.contacts FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = contacts.project_id AND can_access_project(auth.uid(), projects.id)));

DROP POLICY IF EXISTS "Authorized users can create contacts" ON public.contacts;
CREATE POLICY "Authorized users can create contacts" ON public.contacts FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM projects WHERE projects.id = contacts.project_id AND can_access_project(auth.uid(), projects.id)));

DROP POLICY IF EXISTS "Authorized users can update contacts" ON public.contacts;
CREATE POLICY "Authorized users can update contacts" ON public.contacts FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = contacts.project_id AND can_access_project(auth.uid(), projects.id)));

DROP POLICY IF EXISTS "Authorized users can delete contacts" ON public.contacts;
CREATE POLICY "Authorized users can delete contacts" ON public.contacts FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = contacts.project_id AND can_access_project(auth.uid(), projects.id) AND has_full_access(auth.uid())));

-- Sync Queue
DROP POLICY IF EXISTS "Users can view their own sync queue" ON public.sync_queue;
CREATE POLICY "Users can view their own sync queue" ON public.sync_queue FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create their own sync queue entries" ON public.sync_queue;
CREATE POLICY "Users can create their own sync queue entries" ON public.sync_queue FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own sync queue entries" ON public.sync_queue;
CREATE POLICY "Users can update their own sync queue entries" ON public.sync_queue FOR UPDATE TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own sync queue entries" ON public.sync_queue;
CREATE POLICY "Users can delete their own sync queue entries" ON public.sync_queue FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- 8. Storage Buckets erstellen
-- =============================================

INSERT INTO storage.buckets (id, name, public) 
VALUES ('project-files', 'project-files', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public) 
VALUES ('project-images', 'project-images', true)
ON CONFLICT (id) DO NOTHING;

-- Storage Policies für project-files
DROP POLICY IF EXISTS "Users can view files in accessible projects" ON storage.objects;
CREATE POLICY "Users can view files in accessible projects" ON storage.objects 
FOR SELECT TO authenticated 
USING (bucket_id = 'project-files');

DROP POLICY IF EXISTS "Users can upload files" ON storage.objects;
CREATE POLICY "Users can upload files" ON storage.objects 
FOR INSERT TO authenticated 
WITH CHECK (bucket_id = 'project-files');

DROP POLICY IF EXISTS "Users can update their own files" ON storage.objects;
CREATE POLICY "Users can update their own files" ON storage.objects 
FOR UPDATE TO authenticated 
USING (bucket_id = 'project-files');

DROP POLICY IF EXISTS "Users can delete their own files" ON storage.objects;
CREATE POLICY "Users can delete their own files" ON storage.objects 
FOR DELETE TO authenticated 
USING (bucket_id = 'project-files');

-- Storage Policies für project-images
DROP POLICY IF EXISTS "Users can view images" ON storage.objects;
CREATE POLICY "Users can view images" ON storage.objects 
FOR SELECT TO authenticated 
USING (bucket_id = 'project-images');

DROP POLICY IF EXISTS "Users can upload images" ON storage.objects;
CREATE POLICY "Users can upload images" ON storage.objects 
FOR INSERT TO authenticated 
WITH CHECK (bucket_id = 'project-images');

DROP POLICY IF EXISTS "Users can update their own images" ON storage.objects;
CREATE POLICY "Users can update their own images" ON storage.objects 
FOR UPDATE TO authenticated 
USING (bucket_id = 'project-images');

DROP POLICY IF EXISTS "Users can delete their own images" ON storage.objects;
CREATE POLICY "Users can delete their own images" ON storage.objects 
FOR DELETE TO authenticated 
USING (bucket_id = 'project-images');

-- =============================================
-- Migration abgeschlossen!
-- =============================================
