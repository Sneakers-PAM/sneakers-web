import { useCallback, useEffect, useId, useRef, useState } from "react";

import { MARK_BODY } from "#ui/brand/Mark";
import { prefersReducedMotion } from "#ui/lib/motion";

export interface SneakerLoaderProps {
  className?: string;
  delay?: number;
  duration?: number;
  /** Colour the keyhole and laces show through to. */
  hole?: string;
  size?: number;
}

const LACES: [number, number, number, number][] = [
  [30, 23, 35, 21],
  [34, 27, 39, 25],
  [39, 30, 44, 28],
];

const clamp = (x: number) => Math.max(0, Math.min(1, x));
const ease = (x: number) => 1 - Math.pow(1 - x, 3);

/**
 * The sneaker loader: once the page has loaded, the sole fills, ink rises through the
 * shoe with a settling wave, the keyhole appears and the laces draw in. Click to replay.
 * With reduced motion it renders filled at once.
 */
export const SneakerLoader = ({
  className,
  delay = 250,
  duration = 1800,
  hole = "var(--color-bg)",
  size = 64,
}: SneakerLoaderProps) => {
  const clipId = useId().replaceAll(":", "");
  const [frame, setFrame] = useState({ p: 0, t: 0 });
  const raf = useRef(0);
  const wait = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const play = useCallback(() => {
    cancelAnimationFrame(raf.current);
    clearTimeout(wait.current);
    if (prefersReducedMotion()) {
      raf.current = requestAnimationFrame(() => setFrame({ p: 1, t: 0 }));
      return;
    }
    const run = () => {
      const t0 = performance.now();
      const tick = (now: number) => {
        const k = Math.min(1, (now - t0) / duration);
        setFrame({ p: k, t: now / 1000 });
        if (k < 1) raf.current = requestAnimationFrame(tick);
      };
      raf.current = requestAnimationFrame(tick);
    };
    const go = () => {
      wait.current = setTimeout(() => {
        setFrame({ p: 0, t: 0 });
        run();
      }, delay);
    };
    if (document.readyState === "complete") go();
    else window.addEventListener("load", go, { once: true });
  }, [delay, duration]);

  useEffect(() => {
    play();
    return () => {
      cancelAnimationFrame(raf.current);
      clearTimeout(wait.current);
    };
  }, [play]);

  const { p, t } = frame;
  const seg = (a: number, b: number) => clamp((p - a) / (b - a));
  const sole = ease(seg(0, 0.22));
  const body = ease(seg(0.15, 0.82));
  const lace = seg(0.78, 1);
  const keyhole = seg(0.7, 0.85);
  const y = 48 - 36 * body;
  const amp = body > 0 ? 2.4 * (1 - body) : 0;
  const phase = (t * 28) % 16;
  let wave = `M${-32 + phase} ${y}`;
  for (let x = -32; x < 80; x += 16) wave += ` q4 ${-amp} 8 0 t8 0`;
  wave += ` V64 H${-32 + phase} Z`;

  return (
    <button
      className={className}
      onClick={play}
      style={{ background: "none", border: 0, display: "inline-flex", lineHeight: 0, padding: 0 }}
      title="Replay"
      type="button"
    >
      <svg
        aria-label={p < 1 ? "Loading Sneakers-PAM" : "Sneakers-PAM"}
        height={size}
        role="img"
        viewBox="0 0 64 64"
        width={size}
      >
        <defs>
          <clipPath id={clipId}>
            <path d={MARK_BODY} />
          </clipPath>
        </defs>
        <path
          d={MARK_BODY}
          style={{
            fill: "none",
            opacity: 1 - body * 0.9,
            stroke: "var(--color-ink)",
            strokeLinejoin: "round",
            strokeWidth: 2.2,
          }}
        />
        <g clipPath={`url(#${clipId})`}>
          <path d={wave} style={{ fill: "var(--color-ink)" }} />
        </g>
        <rect
          height={10}
          rx={5}
          style={{ fill: "none", opacity: 1 - sole, stroke: "var(--color-sole)", strokeWidth: 1.6 }}
          width={58}
          x={4}
          y={44}
        />
        <rect
          height={10}
          rx={5}
          style={{ fill: "var(--color-sole)" }}
          width={Math.max(0.01, 58 * sole)}
          x={4}
          y={44}
        />
        <g
          style={{
            opacity: keyhole,
            transform: `scale(${0.6 + 0.4 * keyhole})`,
            transformOrigin: "19px 32px",
          }}
        >
          <circle cx={19} cy={29} r={4.2} style={{ fill: hole }} />
          <rect height={8} rx={1.2} style={{ fill: hole }} width={3.2} x={17.4} y={30} />
        </g>
        {LACES.map(([x1, y1, x2, y2], index) => {
          const k = clamp(lace * 3 - index);
          return (
            <path
              d={`M${x1} ${y1}L${x1 + (x2 - x1) * k} ${y1 + (y2 - y1) * k}`}
              key={index}
              style={{
                fill: "none",
                opacity: k > 0 ? 1 : 0,
                stroke: hole,
                strokeLinecap: "round",
                strokeWidth: 2.6,
              }}
            />
          );
        })}
      </svg>
    </button>
  );
};
