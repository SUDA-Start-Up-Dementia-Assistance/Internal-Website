/*
 * Meetings come only from the shared "DAWN Team" Google Calendar. An event's kind is decided
 * from its title (case-insensitive): the official keyword first, then the retro keyword,
 * else ad hoc. Shared by the browser and the server (/api), so keep it free of browser code.
 */

/** Official meetings (Tue & Thu 17:00–18:15), the only ones with agendas. */
export const OFFICIAL_MEETING_KEYWORD = 'Team Meeting'

/** Sprint retros (Mon 20:00). No agenda. */
export const RETRO_KEYWORD = 'Retro'

/**
 * Where "Subscribe" / "Open calendar" goes: the team calendar's public or shared link
 * (Google Calendar → Settings → the DAWN Team calendar → "Public URL" or "Integrate
 * calendar"). Empty until someone fills it in; the UI hides the link while it's empty.
 */
export const CALENDAR_URL = ''
