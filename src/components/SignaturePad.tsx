"use client";

import { useEffect, useRef } from "react";

type Props = {
  /** Called with a PNG image of the signature, or null when cleared. */
  onChange: (dataUrl: string | null) => void;
  hasSignature: boolean;
};

/** A box the worker signs in with a finger (or mouse). */
export function SignaturePad({ onChange, hasSignature }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current!;
    // Match the canvas to its on-screen size and the phone's pixel density for a crisp line.
    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * ratio;
    canvas.height = rect.height * ratio;
    const ctx = canvas.getContext("2d")!;
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#111";
  }, []);

  function point(e: React.PointerEvent) {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function start(e: React.PointerEvent) {
    e.preventDefault();
    canvasRef.current!.setPointerCapture(e.pointerId);
    drawing.current = true;
    last.current = point(e);
    const ctx = canvasRef.current!.getContext("2d")!;
    ctx.beginPath();
    ctx.arc(last.current.x, last.current.y, 1.2, 0, Math.PI * 2);
    ctx.fillStyle = "#111";
    ctx.fill();
  }

  function move(e: React.PointerEvent) {
    if (!drawing.current || !last.current) return;
    const ctx = canvasRef.current!.getContext("2d")!;
    const p = point(e);
    ctx.beginPath();
    ctx.moveTo(last.current.x, last.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    last.current = p;
  }

  function end() {
    if (!drawing.current) return;
    drawing.current = false;
    last.current = null;
    onChange(canvasRef.current!.toDataURL("image/png"));
  }

  function clear() {
    const canvas = canvasRef.current!;
    canvas.getContext("2d")!.clearRect(0, 0, canvas.width, canvas.height);
    onChange(null);
  }

  return (
    <div>
      <div className="relative rounded-2xl border-2 border-dashed border-line bg-white">
        <canvas
          ref={canvasRef}
          aria-label="Signature box. Draw your signature with your finger."
          className="block h-44 w-full touch-none rounded-2xl"
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={end}
          onPointerCancel={end}
          onPointerLeave={end}
        />
        {!hasSignature && (
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-muted/70">Sign here with your finger</span>
        )}
        <div className="pointer-events-none absolute inset-x-6 bottom-9 border-b border-line" />
      </div>
      <button type="button" onClick={clear} className="mt-2 min-h-11 text-sm font-semibold text-brand disabled:opacity-40" disabled={!hasSignature}>
        Clear signature
      </button>
    </div>
  );
}
