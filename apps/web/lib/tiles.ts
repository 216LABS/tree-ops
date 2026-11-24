import { isMock } from './env';

/** Satellite tiles for tree pins: a gray placeholder in mock mode; Esri World Imagery live (terms to confirm, [T]). */
export const satelliteTiles = () =>
  isMock()
    ? { url: '/api/tiles/mock/{z}/{x}/{y}', attribution: 'Mock tiles (no imagery in mock mode)' }
    : { url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', attribution: 'Imagery © Esri' };
