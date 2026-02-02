/**
 * Export d'un plan FromFeed vers le calendrier natif (Apple / Google Calendar).
 * Crée un événement par lieu (activité) dans le plan.
 * L'app = cerveau, le calendrier = bras (voir docs/PLANS_VISION.md).
 */

import * as Calendar from 'expo-calendar';
import type { Plan, PlanActivity } from '@/types/api';

/** Normalise la date du plan en YYYY-MM-DD (l'API peut renvoyer une ISO complète). */
function toDateOnly(dateStr: string): string {
  const part = dateStr.split('T')[0];
  return part && /^\d{4}-\d{2}-\d{2}$/.test(part) ? part : dateStr;
}

function parseTimeToDate(dateOnly: string, timeStr: string | null | undefined): Date {
  const d = new Date(dateOnly + 'T12:00:00');
  if (isNaN(d.getTime())) {
    return new Date(dateOnly + 'T09:00:00');
  }
  if (!timeStr || typeof timeStr !== 'string') return d;
  const parts = timeStr.trim().split(':');
  const h = parseInt(parts[0], 10);
  const m = parts[1] != null ? parseInt(parts[1], 10) : 0;
  d.setHours(Number.isNaN(h) ? 9 : Math.min(23, Math.max(0, h)), Number.isNaN(m) ? 0 : Math.min(59, Math.max(0, m)), 0, 0);
  return d;
}

function buildActivityNotes(activity: PlanActivity): string {
  const addr = activity.place?.googleFormattedAddress || activity.place?.address;
  const lines: string[] = [];
  if (addr) lines.push(addr);
  if (activity.notes) lines.push(activity.notes);
  return lines.join('\n');
}

export type ExportToCalendarResult =
  | { success: true; added: number; skipped: number }
  | { success: false; error: string };

/** Vérifie si un événement avec le même titre existe déjà le même jour (à la même heure ou proche). */
function findMatchingEvent(
  existingEvents: Calendar.Event[],
  title: string,
  startDate: Date,
  toleranceMinutes: number = 30
): Calendar.Event | undefined {
  const startMs = startDate.getTime();
  const tolMs = toleranceMinutes * 60 * 1000;
  const titleNorm = title.trim().toLowerCase();
  return existingEvents.find((ev) => {
    const evTitle = (ev.title || '').trim().toLowerCase();
    if (evTitle !== titleNorm) return false;
    const evStart = ev.startDate instanceof Date ? ev.startDate.getTime() : new Date(ev.startDate).getTime();
    return Math.abs(evStart - startMs) <= tolMs;
  });
}

export async function exportPlanToCalendar(plan: Plan): Promise<ExportToCalendarResult> {
  try {
    const { status } = await Calendar.requestCalendarPermissionsAsync();
    if (status !== 'granted') {
      return { success: false, error: 'Accès au calendrier refusé.' };
    }

    const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
    const writable = calendars.filter((c) => c.allowsModifications);
    const defaultCal = writable.find((c) => c.isPrimary) || writable[0];
    if (!defaultCal) {
      return { success: false, error: 'Aucun calendrier disponible pour ajouter l\'événement.' };
    }

    const dateOnly = toDateOnly(plan.date);
    const activities = plan.activities || [];
    if (activities.length === 0) {
      return { success: false, error: 'Aucune activité dans ce plan.' };
    }

    const dayStart = new Date(dateOnly + 'T00:00:00');
    const dayEnd = new Date(dateOnly + 'T23:59:59');
    const existingEvents = await Calendar.getEventsAsync(
      [defaultCal.id],
      dayStart,
      dayEnd
    );

    let added = 0;
    let skipped = 0;

    for (let i = 0; i < activities.length; i++) {
      const activity = activities[i];
      const title = activity.place?.placeName || activity.place?.rawTitle || 'Lieu';

      let startDate = parseTimeToDate(dateOnly, activity.startTime);
      if (isNaN(startDate.getTime())) startDate = new Date(dateOnly + 'T12:00:00');

      if (findMatchingEvent(existingEvents, title, startDate)) {
        skipped += 1;
        continue;
      }

      let endDate = parseTimeToDate(dateOnly, activity.endTime || activity.startTime);
      if (isNaN(endDate.getTime())) endDate = new Date(startDate.getTime() + 60 * 60 * 1000);
      if (endDate.getTime() <= startDate.getTime()) {
        endDate = new Date(startDate.getTime() + 60 * 60 * 1000);
      }

      const notes = buildActivityNotes(activity);

      await Calendar.createEventAsync(defaultCal.id, {
        title,
        startDate,
        endDate,
        notes: notes || undefined,
      });
      added += 1;
    }

    return { success: true, added, skipped };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Erreur inconnue';
    return { success: false, error: message };
  }
}
