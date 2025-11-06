-- RLS Policies für gelöschte Inhalte (Admins können gelöschte Items sehen)

-- Policy für gelöschte Nachrichten
CREATE POLICY "Admins can view deleted messages"
ON messages FOR SELECT
USING (
  has_full_access(auth.uid()) 
  AND deleted_at IS NOT NULL
);

-- Policy für gelöschte Dateien
CREATE POLICY "Admins can view deleted files"
ON project_files FOR SELECT
USING (
  has_full_access(auth.uid()) 
  AND deleted_at IS NOT NULL
);