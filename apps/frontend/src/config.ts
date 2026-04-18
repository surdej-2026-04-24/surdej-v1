/**
 * Application configuration — reads from Vite environment variables.
 */
export const config = {
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '',
    stadiaMapsApiKey: import.meta.env.VITE_STADIA_MAPS_API_KEY || '',
} as const;
