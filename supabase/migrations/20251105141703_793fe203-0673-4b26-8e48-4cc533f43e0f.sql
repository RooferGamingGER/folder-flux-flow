-- 1. Update UPDATE-Policy to use can_delete_message()
DROP POLICY IF EXISTS "Users can update their own messages" ON public.messages;

CREATE POLICY "Authorized users can update/delete messages"
ON public.messages
FOR UPDATE
TO authenticated
USING (can_delete_message(auth.uid(), id));

-- 2. Erweitere can_delete_message() um Azubis
CREATE OR REPLACE FUNCTION public.can_delete_message(_user_id uuid, _message_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
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