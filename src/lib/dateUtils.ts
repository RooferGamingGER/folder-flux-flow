import { format, isToday, isYesterday, isThisWeek, isAfter, isBefore, addDays, isSameDay } from 'date-fns';
import { de } from 'date-fns/locale';

/**
 * Formatiert Zeitstempel WhatsApp-ähnlich für deutsche Benutzer
 * - Heute: "14:30"
 * - Gestern: "Gestern"
 * - Diese Woche: "Montag"
 * - Älter: "15.03.2024"
 */
export function formatMessageTime(timestamp: string | Date): string {
  const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
  
  if (isToday(date)) {
    return format(date, 'HH:mm', { locale: de });
  }
  
  if (isYesterday(date)) {
    return 'Gestern';
  }
  
  if (isThisWeek(date)) {
    return format(date, 'EEEE', { locale: de });
  }
  
  return format(date, 'dd.MM.yyyy', { locale: de });
}

/**
 * Vollständige Datums- und Zeitanzeige
 * Format: "15.03.2024 um 14:30 Uhr"
 */
export function formatMessageDateTime(timestamp: string | Date): string {
  const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
  return format(date, "dd.MM.yyyy 'um' HH:mm 'Uhr'", { locale: de });
}

/**
 * Formatiert nur die Uhrzeit
 * Format: "14:30 Uhr"
 */
export function formatTime(timestamp: string | Date): string {
  const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
  return format(date, "HH:mm 'Uhr'", { locale: de });
}

/**
 * Formatiert nur das Datum
 * Format: "15.03.2024"
 */
export function formatDate(timestamp: string | Date): string {
  const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
  return format(date, 'dd.MM.yyyy', { locale: de });
}

/**
 * Prüft ob ein Zeitstempel innerhalb der letzten 48 Stunden liegt
 */
export function isWithin48Hours(timestamp: string): boolean {
  const date = new Date(timestamp);
  const now = new Date();
  const hoursDiff = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
  return hoursDiff < 48;
}

/**
 * Prüft ob ein Projekt überfällig ist (Enddatum in der Vergangenheit)
 */
export function isProjectOverdue(enddatum?: string): boolean {
  if (!enddatum) return false;
  const endDate = new Date(enddatum);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  endDate.setHours(0, 0, 0, 0);
  return endDate < today;
}

/**
 * Prüft ob ein Projekt bald startet (innerhalb der nächsten X Tage)
 */
export function isProjectUpcoming(startdatum?: string, daysAhead: number = 7): boolean {
  if (!startdatum) return false;
  const startDate = new Date(startdatum);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const futureDate = addDays(today, daysAhead);
  
  return isAfter(startDate, today) && isBefore(startDate, futureDate);
}

/**
 * Gibt alle Projekte zurück, die an einem bestimmten Datum aktiv sind
 */
export function getProjectsForDate(
  projects: any[],
  targetDate: Date
): any[] {
  return projects.filter(({ project }) => {
    const details = project.details || {};
    if (!details.startdatum || !details.enddatum) return false;
    
    const start = new Date(details.startdatum);
    const end = new Date(details.enddatum);
    const target = new Date(targetDate);
    target.setHours(0, 0, 0, 0);
    start.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);
    
    return (
      (isBefore(start, target) || isSameDay(start, target)) &&
      (isAfter(end, target) || isSameDay(end, target))
    );
  });
}
