"use client";

import { useEffect } from "react";

import { sceneStore } from "../scene-store";
import { useScene } from "./use-scene";

/**
 * Decorative needle dial that reacts to puzzle results (spins when the server says "solved", wobbles when
 * it says "not yet"). Pure CSS/SVG; hidden from assistive tech because the live message says the same.
 */
export function FeedbackDial({ className }: { className?: string }) {
  const needle = useScene((s) => s.needle);
  const nonce = useScene((s) => s.signalNonce);

  useEffect(() => {
    if (needle === "idle") return;
    // Reduced-motion users get no animationend, so settle on a timer instead.
    const timer = setTimeout(() => sceneStore.getState().settle(), 1400);
    return () => clearTimeout(timer);
  }, [needle, nonce]);

  return (
    <svg
      viewBox="0 0 64 64"
      className={className}
      aria-hidden="true"
      focusable="false"
      data-testid="feedback-dial"
      data-needle={needle}
    >
      <circle
        cx="32"
        cy="32"
        r="29"
        fill="var(--pirate-parchment)"
        stroke="var(--pirate-wood)"
        strokeWidth="4"
      />
      <g key={nonce} className="cq-needle" data-needle={needle}>
        <polygon
          points="32,8 38,32 26,32"
          fill="var(--pirate-gold)"
          stroke="var(--pirate-ink)"
          strokeWidth="1.5"
        />
        <polygon
          points="32,56 38,32 26,32"
          fill="var(--pirate-wood)"
          stroke="var(--pirate-ink)"
          strokeWidth="1.5"
        />
      </g>
      <circle cx="32" cy="32" r="3" fill="var(--pirate-ink)" />
    </svg>
  );
}
