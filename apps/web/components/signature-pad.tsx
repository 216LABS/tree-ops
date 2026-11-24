'use client';

import { useEffect, useRef, useState } from 'react';

/** Finger or mouse signature on a canvas. Reports a PNG data URL, or null when cleared. */
export function SignaturePad({ onChange, label = 'Sign here', clearLabel = 'Clear', dark = false }: { onChange: (png: string | null) => void; label?: string; clearLabel?: string; dark?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [empty, setEmpty] = useState(true);
  const strokes = useRef(0);

  useEffect(() => {
    const c = ref.current!;
    const ratio = window.devicePixelRatio || 1;
    c.width = c.offsetWidth * ratio;
    c.height = c.offsetHeight * ratio;
    const g = c.getContext('2d')!;
    g.scale(ratio, ratio);
    g.lineWidth = 2.4;
    g.lineCap = 'round';
    g.lineJoin = 'round';
    g.strokeStyle = dark ? '#ffffff' : '#111827';
  }, [dark]);

  const pos = (e: React.PointerEvent) => {
    const r = ref.current!.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top] as const;
  };
  const done = () => {
    if (!drawing.current) return;
    drawing.current = false;
    if (strokes.current > 4) {
      // Export on a white background so the image reads anywhere.
      const c = ref.current!;
      const out = document.createElement('canvas');
      out.width = c.width;
      out.height = c.height;
      const g = out.getContext('2d')!;
      g.fillStyle = '#ffffff';
      g.fillRect(0, 0, out.width, out.height);
      if (dark) g.filter = 'invert(1)';
      g.drawImage(c, 0, 0);
      setEmpty(false);
      onChange(out.toDataURL('image/png'));
    }
  };

  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-sm font-semibold">
        <span>{label}</span>
        <button
          type="button"
          className="min-h-10 px-3 text-sm underline"
          onClick={() => {
            const c = ref.current!;
            c.getContext('2d')!.clearRect(0, 0, c.width, c.height);
            strokes.current = 0;
            setEmpty(true);
            onChange(null);
          }}
        >
          {clearLabel}
        </button>
      </div>
      <canvas
        ref={ref}
        data-testid="signature-pad"
        aria-label={label}
        className={`h-40 w-full touch-none rounded-control border-2 ${dark ? 'border-slate-500 bg-slate-900' : 'border-line-strong bg-white'} ${empty ? 'border-dashed' : ''}`}
        onPointerDown={(e) => {
          drawing.current = true;
          (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
          const g = ref.current!.getContext('2d')!;
          const [x, y] = pos(e);
          g.beginPath();
          g.moveTo(x, y);
        }}
        onPointerMove={(e) => {
          if (!drawing.current) return;
          const g = ref.current!.getContext('2d')!;
          const [x, y] = pos(e);
          g.lineTo(x, y);
          g.stroke();
          strokes.current++;
        }}
        onPointerUp={done}
        onPointerLeave={done}
      />
    </div>
  );
}
