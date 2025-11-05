-- Make storage buckets public for file access
UPDATE storage.buckets 
SET public = true 
WHERE name IN ('project-images', 'project-files');