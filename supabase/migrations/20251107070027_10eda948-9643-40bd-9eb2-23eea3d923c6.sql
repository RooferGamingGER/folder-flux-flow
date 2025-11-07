-- Theme-Präferenz zu profiles hinzufügen
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS theme_preference text DEFAULT 'system' CHECK (theme_preference IN ('light', 'dark', 'system'));

-- Index für bessere Performance
CREATE INDEX IF NOT EXISTS idx_profiles_theme ON profiles(theme_preference);