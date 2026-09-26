/**
 * VITE_TASKS_MOCK=true makes the Tasks UI use mock data and a fake signed-in user, with no
 * network calls. Ignored in production builds so it can never ship by accident.
 */
export const TASKS_MOCK = !import.meta.env.PROD && import.meta.env.VITE_TASKS_MOCK === 'true'
