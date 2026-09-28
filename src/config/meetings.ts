/*
 * Meetings come only from the shared "DAWN Team" Google Calendar. An event's kind is decided
 * from its title (case-insensitive): the official keyword first, then the retro keyword,
 * else ad hoc. Shared by the browser and the server (/api), so keep it free of browser code.
 */

/**
 * Official meetings: the Tuesday sponsor meetings, the only ones with agendas and 4Ups. The
 * agenda Apps Script (outside this repo) creates agendas for these same meetings. Team
 * meetings have no agenda, so they're ad hoc here (tagged "Recurring" in the UI).
 */
export const OFFICIAL_MEETING_KEYWORD = 'Sponsor Meeting'

/** Sprint retros (Mon 20:00). No agenda. */
export const RETRO_KEYWORD = 'Retro'

/**
 * Where "Subscribe" / "Open calendar" goes: the team calendar's public or shared link
 * (Google Calendar → Settings → the DAWN Team calendar → "Public URL" or "Integrate
 * calendar"). Empty until someone fills it in; the UI hides the link while it's empty.
 */
export const CALENDAR_URL = ''

/**
 * "Add a meeting": Google Calendar's new-event page. The site never creates events itself;
 * the page tells people to pick the DAWN Team calendar there.
 */
export const ADD_MEETING_URL = 'https://calendar.google.com/calendar/render?action=TEMPLATE'
