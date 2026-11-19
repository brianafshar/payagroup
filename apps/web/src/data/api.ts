/**
 * Data API used by the screens: everything comes from the Django backend (`backend/`), reached at
 * `VITE_API_URL` (`/api` in development, proxied by Vite). Calls return the domain types in `./types`.
 */
export { remoteApi as api, remote, remoteApi } from './remote';

export { ApiError, faError } from './errors';
export { getVersion, subscribe } from './store';
export type { NewAthlete, NewCoach } from './types';
