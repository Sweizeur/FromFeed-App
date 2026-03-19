/**
 * Export d'un plan FromFeed vers le calendrier natif (Apple / Google Calendar).
 * Crée un événement par lieu (activité) dans le plan.
 * L'app = cerveau, le calendrier = bras (voir docs/PLANS_VISION.md).
 */

import * as Calendar from 'expo-calendar';
import type { Plan, PlanActivity } from '@/features/ai/types';

export function getLocalTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return 'Europe/Paris';
  }
}

/** Normalise la date du plan en YYYY-MM-DD (l'API peut renvoyer une ISO complète). */
export function toDateOnly(dateStr: string): string {
  const part = dateStr.split('T')[0];
  return part && /^\d{4}-\d{2}-\d{2}$/.test(part) ? part : dateStr;
}

export function parseTimeToDate(dateOnly: string, timeStr: string | null | undefined): Date {
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

/** Localisation / adresse pour le champ "location" de l'événement (→ preview plan dans le calendrier). */
export function getActivityLocation(activity: PlanActivity): string | undefined {
  const addr = activity.place?.googleFormattedAddress || activity.place?.address;
  if (addr) return addr;
  const name = activity.place?.placeName || activity.place?.rawTitle;
  const city = activity.place?.city;
  if (name && city) return `${name}, ${city}`;
  if (city) return city;
  return name || undefined;
}

/** Numéro de téléphone du lieu (si renvoyé par l’API). */
function getActivityPhone(activity: PlanActivity): string | undefined {
  const phone = activity.place?.googlePhone;
  return phone && typeof phone === 'string' ? phone.trim() : undefined;
}

/** URL du site du lieu. */
function getActivityUrl(activity: PlanActivity): string | undefined {
  const url = activity.place?.websiteUrl;
  return url && typeof url === 'string' ? url.trim() : undefined;
}

/** Vérifie que lat/lon sont des coordonnées valides (pas 0,0 ni hors plage). */
export function areValidCoords(lat: unknown, lon: unknown): lat is number {
  if (typeof lat !== 'number' || typeof lon !== 'number') return false;
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return false;
  if (lat === 0 && lon === 0) return false;
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return false;
  return true;
}

/** Lien Apple Maps vers le lieu quand lat/lon sont disponibles et valides. */
function getMapsLink(activity: PlanActivity): string | undefined {
  const lat = activity.place?.lat;
  const lon = activity.place?.lon;
  if (!areValidCoords(lat, lon)) return undefined;
  return `https://maps.apple.com/?ll=${lat},${lon}&q=${encodeURIComponent(
    activity.place?.placeName || activity.place?.rawTitle || 'Lieu'
  )}`;
}

/** Notes de l’événement : adresse, tél, URL, notes perso (pour tout avoir sous la main). */
export function buildActivityNotes(activity: PlanActivity): string {
  const addr = activity.place?.googleFormattedAddress || activity.place?.address;
  const phone = getActivityPhone(activity);
  const url = getActivityUrl(activity);
  const mapsLink = getMapsLink(activity);
  const lines: string[] = [];
  if (addr) lines.push(addr);
  if (phone) lines.push(`Tél: ${phone}`);
  if (url) lines.push(url);
  if (mapsLink) lines.push(`Carte: ${mapsLink}`);
  if (activity.notes) lines.push(activity.notes);
  return lines.join('\n');
}

/** Notes pour le formulaire natif : adresse, tél, notes perso uniquement (URL dans le champ dédié). */
function buildActivityNotesWithoutUrl(activity: PlanActivity): string {
  const addr = activity.place?.googleFormattedAddress || activity.place?.address;
  const phone = getActivityPhone(activity);
  const lines: string[] = [];
  if (addr) lines.push(addr);
  if (phone) lines.push(`Tél: ${phone}`);
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

/**
 * Ouvre l'UI native d'ajout d'événement (EKEventEditViewController sur iOS).
 * L'utilisateur peut modifier titre, date, calendrier, etc. avant d'enregistrer.
 * Utilise le premier lieu du plan pour pré-remplir le formulaire.
 * Aucune permission requise sur iOS pour cette méthode.
 */
export async function openAddEventToCalendarAsync(plan: Plan): Promise<{ action: string; id: string | null }> {
  const activities = plan.activities || [];
  const first = activities[0];
  if (!first) {
    throw new Error('Aucune activité dans ce plan.');
  }

  const dateOnly = toDateOnly(plan.date);
  const title = first.place?.placeName || first.place?.rawTitle || plan.title || 'Sortie';
  let startDate = parseTimeToDate(dateOnly, first.startTime);
  if (isNaN(startDate.getTime())) startDate = new Date(dateOnly + 'T12:00:00');
  let endDate = parseTimeToDate(dateOnly, first.endTime || first.startTime);
  if (isNaN(endDate.getTime()) || endDate.getTime() <= startDate.getTime()) {
    endDate = new Date(startDate.getTime() + 60 * 60 * 1000);
  }

  const location = getActivityLocation(first);
  const notes = buildActivityNotesWithoutUrl(first);
  const url = getActivityUrl(first) || getMapsLink(first);
  const timeZone = getLocalTimezone();

  const eventData = {
    title,
    startDate,
    endDate,
    location: location ?? undefined,
    notes: notes.trim() || undefined,
    url: url || undefined,
    timeZone,
  };

  return Calendar.createEventInCalendarAsync(eventData);
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
      const location = getActivityLocation(activity);
      const url = getActivityUrl(activity) || getMapsLink(activity);
      const timeZone = getLocalTimezone();

      const lat = activity.place?.lat;
      const lon = activity.place?.lon;
      const hasCoords = areValidCoords(lat, lon);

      const alarms: Calendar.Alarm[] = [
        { relativeOffset: -30 },
        ...(hasCoords && lat != null && lon != null
          ? [
              {
                structuredLocation: {
                  title: title,
                  coords: { latitude: lat, longitude: lon },
                  radius: 100,
                },
              } satisfies Calendar.Alarm,
            ]
          : []),
      ];

      await Calendar.createEventAsync(defaultCal.id, {
        title,
        startDate,
        endDate,
        timeZone,
        location: location || undefined,
        url: url || undefined,
        notes: notes || undefined,
        alarms,
      });
      added += 1;
    }

    return { success: true, added, skipped };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Erreur inconnue';
    return { success: false, error: message };
  }
}
