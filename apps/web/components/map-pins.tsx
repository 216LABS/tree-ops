'use client';

import type { Map as MlMap, Marker } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useEffect, useRef, useState } from 'react';

export interface Pin { id: string; lat: number; lon: number; n: number; selected?: boolean }

/**
 * Satellite map with numbered tree pins (adapted from Flake's map view). Tap the map to place the selected tree's pin.
 * With no WebGL (or offline with no cached tiles) it says so; pins can still be placed from the phone's location.
 */
export function MapPins({ tiles, center, pins, onPlace, onPinClick, className }: { tiles: { url: string; attribution: string }; center: { lat: number; lon: number }; pins: Pin[]; onPlace?: (lat: number, lon: number) => void; onPinClick?: (id: string) => void; className?: string }) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<MlMap | null>(null);
  const lib = useRef<typeof import('maplibre-gl') | null>(null);
  const markers = useRef<Marker[]>([]);
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);
  const cb = useRef({ onPlace, onPinClick });
  cb.current = { onPlace, onPinClick };

  useEffect(() => {
    let dead = false;
    import('maplibre-gl')
      .then((ml) => {
        if (dead || !box.current) return;
        lib.current = ml;
        try {
          const m = new ml.Map({
            container: box.current,
            style: { version: 8, sources: { sat: { type: 'raster', tiles: [tiles.url], tileSize: 256, attribution: tiles.attribution, maxzoom: 19 } }, layers: [{ id: 'sat', type: 'raster', source: 'sat' }] },
            center: [center.lon, center.lat],
            zoom: 19,
            attributionControl: { compact: true },
          });
          m.on('click', (e) => cb.current.onPlace?.(e.lngLat.lat, e.lngLat.lng));
          m.on('load', () => setReady(true));
          map.current = m;
        } catch {
          setFailed(true);
        }
      })
      .catch(() => setFailed(true));
    return () => {
      dead = true;
      map.current?.remove();
      map.current = null;
    };
    // The map is made once; pins update below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const ml = lib.current;
    const m = map.current;
    if (!ml || !m) return;
    for (const mk of markers.current) mk.remove();
    markers.current = pins.map((p) => {
      const el = document.createElement('button');
      el.type = 'button';
      el.textContent = String(p.n);
      el.setAttribute('aria-label', `Tree ${p.n}`);
      el.className = `font-display flex h-9 w-9 items-center justify-center rounded-full border-2 border-white text-base font-bold text-white shadow-lg ${p.selected ? 'bg-orange-500 ring-4 ring-orange-300' : 'bg-orange-600'}`;
      el.onclick = (ev) => {
        ev.stopPropagation();
        cb.current.onPinClick?.(p.id);
      };
      return new ml.Marker({ element: el }).setLngLat([p.lon, p.lat]).addTo(m);
    });
  }, [pins, ready]);

  if (failed) return <div className={`flex items-center justify-center rounded-control bg-tint-2 p-4 text-sm text-muted ${className ?? ''}`}>The map can’t load here. Use “Pin where I’m standing” instead.</div>;
  return <div ref={box} className={`overflow-hidden rounded-control ${className ?? ''}`} data-testid="map" />;
}
