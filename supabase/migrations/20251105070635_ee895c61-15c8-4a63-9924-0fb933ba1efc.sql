-- 1. Enum für Sync-Status erstellen
CREATE TYPE sync_status AS ENUM ('synced', 'pending', 'error');

-- 2. Folders-Tabelle
CREATE TABLE folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  archived BOOLEAN DEFAULT false,
  deleted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  sync_status sync_status DEFAULT 'synced'
);

-- 3. Projects-Tabelle
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  folder_id UUID REFERENCES folders(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  archived BOOLEAN DEFAULT false,
  deleted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  sync_status sync_status DEFAULT 'synced'
);

-- 4. Project Details
CREATE TABLE project_details (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE UNIQUE NOT NULL,
  projektname TEXT,
  startdatum DATE,
  enddatum DATE,
  auftragsnummer TEXT,
  projektstatus TEXT,
  notiz TEXT,
  strasse TEXT,
  plz TEXT,
  stadt TEXT,
  land TEXT,
  ansprechpartner TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  sync_status sync_status DEFAULT 'synced'
);

-- 5. Project Directories
CREATE TABLE project_directories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  order_index INTEGER DEFAULT 0,
  deleted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  sync_status sync_status DEFAULT 'synced'
);

-- 6. Project Files
CREATE TABLE project_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  size TEXT,
  ext TEXT,
  mime TEXT,
  folder TEXT,
  storage_path TEXT,
  is_image BOOLEAN DEFAULT false,
  taken_at TIMESTAMP WITH TIME ZONE,
  modified TIMESTAMP WITH TIME ZONE DEFAULT now(),
  deleted_at TIMESTAMP WITH TIME ZONE,
  sync_status sync_status DEFAULT 'synced',
  local_blob_url TEXT
);

-- 7. Messages
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  sender TEXT NOT NULL,
  type TEXT NOT NULL,
  content JSONB,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT now(),
  deleted_at TIMESTAMP WITH TIME ZONE,
  sync_status sync_status DEFAULT 'synced'
);

-- 8. Notes
CREATE TABLE notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  text TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  deleted_at TIMESTAMP WITH TIME ZONE,
  sync_status sync_status DEFAULT 'synced'
);

-- 9. Contacts
CREATE TABLE contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  name TEXT,
  email TEXT,
  phone TEXT,
  deleted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  sync_status sync_status DEFAULT 'synced'
);

-- 10. Sync Queue
CREATE TABLE sync_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  operation TEXT NOT NULL,
  table_name TEXT NOT NULL,
  record_id UUID NOT NULL,
  data JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  retry_count INTEGER DEFAULT 0,
  error_message TEXT
);

-- Enable RLS
ALTER TABLE folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_directories ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_queue ENABLE ROW LEVEL SECURITY;

-- RLS Policies für folders
CREATE POLICY "Users can view their own folders"
  ON folders FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own folders"
  ON folders FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own folders"
  ON folders FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own folders"
  ON folders FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies für projects
CREATE POLICY "Users can view their own projects"
  ON projects FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own projects"
  ON projects FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own projects"
  ON projects FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own projects"
  ON projects FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies für project_details
CREATE POLICY "Users can view project details"
  ON project_details FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM projects WHERE projects.id = project_details.project_id AND projects.user_id = auth.uid()
  ));

CREATE POLICY "Users can create project details"
  ON project_details FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM projects WHERE projects.id = project_details.project_id AND projects.user_id = auth.uid()
  ));

CREATE POLICY "Users can update project details"
  ON project_details FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM projects WHERE projects.id = project_details.project_id AND projects.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete project details"
  ON project_details FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM projects WHERE projects.id = project_details.project_id AND projects.user_id = auth.uid()
  ));

-- RLS Policies für project_directories
CREATE POLICY "Users can view project directories"
  ON project_directories FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM projects WHERE projects.id = project_directories.project_id AND projects.user_id = auth.uid()
  ));

CREATE POLICY "Users can create project directories"
  ON project_directories FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM projects WHERE projects.id = project_directories.project_id AND projects.user_id = auth.uid()
  ));

CREATE POLICY "Users can update project directories"
  ON project_directories FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM projects WHERE projects.id = project_directories.project_id AND projects.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete project directories"
  ON project_directories FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM projects WHERE projects.id = project_directories.project_id AND projects.user_id = auth.uid()
  ));

-- RLS Policies für project_files
CREATE POLICY "Users can view project files"
  ON project_files FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM projects WHERE projects.id = project_files.project_id AND projects.user_id = auth.uid()
  ));

CREATE POLICY "Users can create project files"
  ON project_files FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM projects WHERE projects.id = project_files.project_id AND projects.user_id = auth.uid()
  ));

CREATE POLICY "Users can update project files"
  ON project_files FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM projects WHERE projects.id = project_files.project_id AND projects.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete project files"
  ON project_files FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM projects WHERE projects.id = project_files.project_id AND projects.user_id = auth.uid()
  ));

-- RLS Policies für messages
CREATE POLICY "Users can view project messages"
  ON messages FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM projects WHERE projects.id = messages.project_id AND projects.user_id = auth.uid()
  ));

CREATE POLICY "Users can create project messages"
  ON messages FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM projects WHERE projects.id = messages.project_id AND projects.user_id = auth.uid()
  ));

CREATE POLICY "Users can update project messages"
  ON messages FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM projects WHERE projects.id = messages.project_id AND projects.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete project messages"
  ON messages FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM projects WHERE projects.id = messages.project_id AND projects.user_id = auth.uid()
  ));

-- RLS Policies für notes
CREATE POLICY "Users can view project notes"
  ON notes FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM projects WHERE projects.id = notes.project_id AND projects.user_id = auth.uid()
  ));

CREATE POLICY "Users can create project notes"
  ON notes FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM projects WHERE projects.id = notes.project_id AND projects.user_id = auth.uid()
  ));

CREATE POLICY "Users can update project notes"
  ON notes FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM projects WHERE projects.id = notes.project_id AND projects.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete project notes"
  ON notes FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM projects WHERE projects.id = notes.project_id AND projects.user_id = auth.uid()
  ));

-- RLS Policies für contacts
CREATE POLICY "Users can view project contacts"
  ON contacts FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM projects WHERE projects.id = contacts.project_id AND projects.user_id = auth.uid()
  ));

CREATE POLICY "Users can create project contacts"
  ON contacts FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM projects WHERE projects.id = contacts.project_id AND projects.user_id = auth.uid()
  ));

CREATE POLICY "Users can update project contacts"
  ON contacts FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM projects WHERE projects.id = contacts.project_id AND projects.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete project contacts"
  ON contacts FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM projects WHERE projects.id = contacts.project_id AND projects.user_id = auth.uid()
  ));

-- RLS Policies für sync_queue
CREATE POLICY "Users can view their own sync queue"
  ON sync_queue FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own sync queue entries"
  ON sync_queue FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own sync queue entries"
  ON sync_queue FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own sync queue entries"
  ON sync_queue FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger für updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_folders_updated_at BEFORE UPDATE ON folders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_project_details_updated_at BEFORE UPDATE ON project_details
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Storage Buckets
INSERT INTO storage.buckets (id, name, public) VALUES ('project-files', 'project-files', false);
INSERT INTO storage.buckets (id, name, public) VALUES ('project-images', 'project-images', false);

-- Storage Policies für project-files
CREATE POLICY "Users can view their own project files"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'project-files' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can upload their own project files"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'project-files' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update their own project files"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'project-files' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own project files"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'project-files' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Storage Policies für project-images
CREATE POLICY "Users can view their own project images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'project-images' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can upload their own project images"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'project-images' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update their own project images"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'project-images' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own project images"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'project-images' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Indizes für Performance
CREATE INDEX idx_folders_user_id ON folders(user_id);
CREATE INDEX idx_folders_deleted_at ON folders(deleted_at);
CREATE INDEX idx_projects_user_id ON projects(user_id);
CREATE INDEX idx_projects_folder_id ON projects(folder_id);
CREATE INDEX idx_projects_deleted_at ON projects(deleted_at);
CREATE INDEX idx_project_files_project_id ON project_files(project_id);
CREATE INDEX idx_messages_project_id ON messages(project_id);
CREATE INDEX idx_sync_queue_user_id ON sync_queue(user_id);