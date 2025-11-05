-- ========================================
-- Storage Policies für project-files korrigieren
-- ========================================

-- 1. Alte restriktive Policies löschen
DROP POLICY IF EXISTS "Users can upload their own project files" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload to their projects (files)" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own project files" ON storage.objects;
DROP POLICY IF EXISTS "Users can view their own project files" ON storage.objects;
DROP POLICY IF EXISTS "Users can view their project files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own project files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their project files" ON storage.objects;

-- 2. Neue Policy: Jeder mit Projektzugriff kann hochladen
CREATE POLICY "Users can upload to accessible projects (files)"
ON storage.objects
FOR INSERT
TO public
WITH CHECK (
  bucket_id = 'project-files' 
  AND can_access_project(auth.uid(), (storage.foldername(name))[1]::uuid)
);

-- 3. UPDATE Policy
CREATE POLICY "Users can update files in accessible projects"
ON storage.objects
FOR UPDATE
TO public
USING (
  bucket_id = 'project-files' 
  AND can_access_project(auth.uid(), (storage.foldername(name))[1]::uuid)
);

-- 4. SELECT Policy
CREATE POLICY "Users can view files in accessible projects"
ON storage.objects
FOR SELECT
TO public
USING (
  bucket_id = 'project-files' 
  AND can_access_project(auth.uid(), (storage.foldername(name))[1]::uuid)
);

-- 5. DELETE Policy (nur Admins + Ersteller)
CREATE POLICY "Authorized users can delete project files"
ON storage.objects
FOR DELETE
TO public
USING (
  bucket_id = 'project-files' 
  AND (
    has_full_access(auth.uid())
    OR EXISTS (
      SELECT 1 FROM project_files 
      WHERE storage_path = objects.name 
      AND created_by = auth.uid()
    )
  )
);

-- ========================================
-- Storage Policies für project-images korrigieren
-- ========================================

DROP POLICY IF EXISTS "Users can upload their own project images" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload to their projects (images)" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own project images" ON storage.objects;
DROP POLICY IF EXISTS "Users can view their own project images" ON storage.objects;
DROP POLICY IF EXISTS "Users can view their project images" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own project images" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their project images" ON storage.objects;

CREATE POLICY "Users can upload to accessible projects (images)"
ON storage.objects
FOR INSERT
TO public
WITH CHECK (
  bucket_id = 'project-images' 
  AND can_access_project(auth.uid(), (storage.foldername(name))[1]::uuid)
);

CREATE POLICY "Users can update images in accessible projects"
ON storage.objects
FOR UPDATE
TO public
USING (
  bucket_id = 'project-images' 
  AND can_access_project(auth.uid(), (storage.foldername(name))[1]::uuid)
);

CREATE POLICY "Users can view images in accessible projects"
ON storage.objects
FOR SELECT
TO public
USING (
  bucket_id = 'project-images' 
  AND can_access_project(auth.uid(), (storage.foldername(name))[1]::uuid)
);

CREATE POLICY "Authorized users can delete project images"
ON storage.objects
FOR DELETE
TO public
USING (
  bucket_id = 'project-images' 
  AND (
    has_full_access(auth.uid())
    OR EXISTS (
      SELECT 1 FROM project_files 
      WHERE storage_path = objects.name 
      AND created_by = auth.uid()
    )
  )
);

-- ========================================
-- created_by Spalte für project_files (falls nicht vorhanden)
-- ========================================

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'project_files' 
    AND column_name = 'created_by'
  ) THEN
    ALTER TABLE public.project_files ADD COLUMN created_by UUID REFERENCES auth.users(id);
    
    -- Bestehende Dateien dem Projekt-Eigentümer zuordnen
    UPDATE public.project_files pf
    SET created_by = p.user_id
    FROM public.projects p
    WHERE pf.project_id = p.id AND pf.created_by IS NULL;
  END IF;
END $$;

-- Trigger: created_by automatisch setzen
CREATE OR REPLACE FUNCTION public.set_project_file_creator()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.created_by IS NULL THEN
    NEW.created_by := auth.uid();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS set_creator_on_insert ON public.project_files;
CREATE TRIGGER set_creator_on_insert
  BEFORE INSERT ON public.project_files
  FOR EACH ROW
  EXECUTE FUNCTION public.set_project_file_creator();