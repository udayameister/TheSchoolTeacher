'use client';
import { useEffect, useRef, useState } from 'react';

/** Counts from 0 to `value` when it scrolls into view. Screen readers get the final number. */
export default function CountUp({ value, ms = 1400 }: { value: number; ms?: number }) {
  const [n, setN] = useState(value);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || value <= 0 || window.matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) return;
    setN(0);
    let raf = 0;
    const io = new IntersectionObserver(es => {
      if (!es.some(e => e.isIntersecting)) return;
      io.disconnect();
      const start = performance.now();
      const step = (now: number) => { const p = Math.min(1, (now - start) / ms); setN(Math.round(value * (1 - Math.pow(1 - p, 3)))); if (p < 1) raf = requestAnimationFrame(step); };
      raf = requestAnimationFrame(step);
    });
    io.observe(el);
    return () => { io.disconnect(); cancelAnimationFrame(raf); };
  }, [value, ms]);
  return <span ref={ref}><span aria-hidden="true">{n.toLocaleString('en-IN')}</span><span className="sr-only">{value.toLocaleString('en-IN')}</span></span>;
}
