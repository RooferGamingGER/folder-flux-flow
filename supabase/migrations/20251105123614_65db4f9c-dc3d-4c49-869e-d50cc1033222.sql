-- Drop existing policies for folders
DROP POLICY IF EXISTS "Users can view accessible folders" ON public.folders;
DROP POLICY IF EXISTS "Authorized users can create folders" ON public.folders;
DROP POLICY IF EXISTS "Authorized users can update folders" ON public.folders;
DROP POLICY IF EXISTS "Authorized users can delete folders" ON public.folders;

-- Recreate policies with explicit public. prefix
CREATE POLICY "Users can view accessible folders" 
ON public.folders 
FOR SELECT 
USING (
  (auth.uid() = user_id) 
  OR public.has_full_access(auth.uid()) 
  OR public.can_access_folder(auth.uid(), id)
);

CREATE POLICY "Authorized users can create folders" 
ON public.folders 
FOR INSERT 
WITH CHECK (
  public.can_manage_projects(auth.uid()) 
  AND (auth.uid() = user_id)
);

CREATE POLICY "Authorized users can update folders" 
ON public.folders 
FOR UPDATE 
USING (
  (auth.uid() = user_id) 
  OR public.has_full_access(auth.uid())
);

CREATE POLICY "Authorized users can delete folders" 
ON public.folders 
FOR DELETE 
USING (
  public.has_full_access(auth.uid()) 
  OR (auth.uid() = user_id)
);