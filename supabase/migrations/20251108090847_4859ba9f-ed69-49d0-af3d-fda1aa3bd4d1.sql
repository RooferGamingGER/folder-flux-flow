-- GPS-Koordinaten zu project_files hinzufügen
ALTER TABLE project_files 
  ADD COLUMN latitude double precision,
  ADD COLUMN longitude double precision,
  ADD COLUMN gps_altitude double precision,
  ADD COLUMN gps_accuracy double precision;

-- Index für räumliche Suchen
CREATE INDEX idx_project_files_gps ON project_files(project_id, latitude, longitude) 
  WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

-- Kommentare für Dokumentation
COMMENT ON COLUMN project_files.latitude IS 'GPS-Breitengrad aus EXIF-Daten (WGS84)';
COMMENT ON COLUMN project_files.longitude IS 'GPS-Längengrad aus EXIF-Daten (WGS84)';
COMMENT ON COLUMN project_files.gps_altitude IS 'Höhe über Meeresspiegel in Metern';
COMMENT ON COLUMN project_files.gps_accuracy IS 'GPS-Genauigkeit in Metern (optional)';