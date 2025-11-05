-- Enable RLS for Storage Buckets
-- RLS Policies für project-images Bucket

-- Users können ihre eigenen Projekt-Bilder sehen
CREATE POLICY "Users can view their project images"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'project-images' AND
  EXISTS (
    SELECT 1 FROM projects
    WHERE projects.id::text = (storage.foldername(name))[1]
    AND projects.user_id = auth.uid()
  )
);

-- Users können Bilder zu ihren Projekten hochladen
CREATE POLICY "Users can upload to their projects (images)"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'project-images' AND
  EXISTS (
    SELECT 1 FROM projects
    WHERE projects.id::text = (storage.foldername(name))[1]
    AND projects.user_id = auth.uid()
  )
);

-- Users können ihre Projekt-Bilder löschen
CREATE POLICY "Users can delete their project images"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'project-images' AND
  EXISTS (
    SELECT 1 FROM projects
    WHERE projects.id::text = (storage.foldername(name))[1]
    AND projects.user_id = auth.uid()
  )
);

-- RLS Policies für project-files Bucket

-- Users können ihre eigenen Projekt-Dateien sehen
CREATE POLICY "Users can view their project files"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'project-files' AND
  EXISTS (
    SELECT 1 FROM projects
    WHERE projects.id::text = (storage.foldername(name))[1]
    AND projects.user_id = auth.uid()
  )
);

-- Users können Dateien zu ihren Projekten hochladen
CREATE POLICY "Users can upload to their projects (files)"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'project-files' AND
  EXISTS (
    SELECT 1 FROM projects
    WHERE projects.id::text = (storage.foldername(name))[1]
    AND projects.user_id = auth.uid()
  )
);

-- Users können ihre Projekt-Dateien löschen
CREATE POLICY "Users can delete their project files"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'project-files' AND
  EXISTS (
    SELECT 1 FROM projects
    WHERE projects.id::text = (storage.foldername(name))[1]
    AND projects.user_id = auth.uid()
  )
);