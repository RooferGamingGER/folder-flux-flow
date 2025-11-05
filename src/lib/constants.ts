export const PROJECT_STATUS_OPTIONS = [
  "In Planung",
  "In Bearbeitung",
  "Abgeschlossen",
  "Pausiert",
  "Storniert"
] as const;

export type ProjectStatus = typeof PROJECT_STATUS_OPTIONS[number];

export const STATUS_COLORS: Record<string, string> = {
  "In Planung": "bg-blue-500",
  "In Bearbeitung": "bg-yellow-500",
  "Abgeschlossen": "bg-green-500",
  "Pausiert": "bg-gray-500",
  "Storniert": "bg-red-500",
  "Kein Status": "bg-muted"
};
