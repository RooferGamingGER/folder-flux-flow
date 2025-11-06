-- Update RLS policies for project_directories to restrict creation to management roles only

-- Drop existing INSERT policy
DROP POLICY IF EXISTS "Authenticated users can create directories" ON public.project_directories;

-- Create new INSERT policy requiring management permissions
CREATE POLICY "Authorized users can create directories"
ON public.project_directories
FOR INSERT
TO authenticated
WITH CHECK (
  can_manage_projects(auth.uid()) 
  AND can_access_project(auth.uid(), project_id)
);

-- Update existing UPDATE policy to also require management permissions for creation
DROP POLICY IF EXISTS "Users can update directories" ON public.project_directories;

CREATE POLICY "Authorized users can update directories"
ON public.project_directories
FOR UPDATE
TO authenticated
USING (
  can_access_project(auth.uid(), project_id) 
  AND (
    (created_by = auth.uid() AND can_manage_projects(auth.uid())) 
    OR has_full_access(auth.uid())
  )
);