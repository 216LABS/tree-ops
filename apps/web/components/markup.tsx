'use client';

import { useRef, useState } from 'react';

/** Shapes are stored relative to the photo (0..1), so they line up at any size. */
export interface MarkShape { circle?: { cx: number; cy: number; r: number } | null; arrow?: [[number, number], [number, number]] | null; label: [number, number] }
export interface Mark { shape: MarkShape; number: number; color: string }

/** A photo with its tree numbers drawn on: the picture the customer signs and the crew works from. */
export function MarkedPhoto({ src, marks, alt, className }: { src: string | null; marks: Mark[]; alt: string; className?: string }) {
  return (
    <div className={`relative overflow-hidden rounded-control bg-slate-800 ${className ?? ''}`}>
      {src ? <img src={src} alt={alt} className="block h-auto w-full" /> : <div className="flex aspect-[4/3] items-center justify-center text-sm text-slate-300">Photo not loaded yet</div>}
      <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        {marks.map((m, i) => (
          <g key={i}>
            {m.shape.circle ? <ellipse cx={m.shape.circle.cx * 100} cy={m.shape.circle.cy * 100} rx={m.shape.circle.r * 100 * 0.75} ry={m.shape.circle.r * 100} fill="none" stroke={m.color} strokeWidth="1.2" vectorEffect="non-scaling-stroke" style={{ strokeWidth: 4 }} /> : null}
            {m.shape.arrow ? <line x1={m.shape.arrow[0][0] * 100} y1={m.shape.arrow[0][1] * 100} x2={m.shape.arrow[1][0] * 100} y2={m.shape.arrow[1][1] * 100} stroke={m.color} vectorEffect="non-scaling-stroke" style={{ strokeWidth: 4 }} /> : null}
          </g>
        ))}
      </svg>
      {marks.map((m, i) => (
        <span key={i} className="font-display absolute flex h-9 min-w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white px-1 text-lg font-bold text-white shadow-lg" style={{ left: `${m.shape.label[0] * 100}%`, top: `${m.shape.label[1] * 100}%`, background: m.color }} data-testid="tree-number">
          {m.number}
        </span>
      ))}
    </div>
  );
}

/**
 * Draw a tree's number on a photo: tap the tree to circle it, drag to size the circle. The number goes beside it.
 */
export function MarkupEditor({ src, number, color = '#f97316', initial, onChange }: { src: string; number: number; color?: string; initial?: MarkShape | null; onChange: (s: MarkShape) => void }) {
  const box = useRef<HTMLDivElement>(null);
  const [shape, setShape] = useState<MarkShape | null>(initial ?? null);
  const start = useRef<[number, number] | null>(null);
  const rel = (e: React.PointerEvent): [number, number] => {
    const r = box.current!.getBoundingClientRect();
    return [Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), Math.min(1, Math.max(0, (e.clientY - r.top) / r.height))];
  };
  const make = (c: [number, number], radius: number): MarkShape => {
    const r = Math.max(0.05, Math.min(0.5, radius));
    return { circle: { cx: c[0], cy: c[1], r }, arrow: null, label: [Math.min(0.94, Math.max(0.06, c[0] + r * 0.75)), Math.min(0.94, Math.max(0.06, c[1] - r * 0.8))] };
  };
  return (
    <div>
      <div
        ref={box}
        className="relative touch-none select-none"
        data-testid="markup-editor"
        onPointerDown={(e) => {
          (e.target as HTMLElement).setPointerCapture(e.pointerId);
          start.current = rel(e);
          const s = make(start.current, 0.15);
          setShape(s);
        }}
        onPointerMove={(e) => {
          if (!start.current) return;
          const p = rel(e);
          const d = Math.hypot(p[0] - start.current[0], p[1] - start.current[1]);
          if (d > 0.03) setShape(make(start.current, d));
        }}
        onPointerUp={() => {
          start.current = null;
          if (shape) onChange(shape);
        }}
      >
        <MarkedPhoto src={src} marks={shape ? [{ shape, number, color }] : []} alt={`Tree ${number}`} />
      </div>
      <p className="mt-1 text-xs text-muted">Tap the tree to circle it. Drag out to make the circle bigger.</p>
    </div>
  );
}
