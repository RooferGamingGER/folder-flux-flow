-- Nutzer können ihre eigene Rolle sehen (zusätzlich zu der bestehenden Admin-Policy)
CREATE POLICY "Users can view their own role"
ON user_roles FOR SELECT
TO authenticated
USING (user_id = auth.uid() OR is_admin(auth.uid()));