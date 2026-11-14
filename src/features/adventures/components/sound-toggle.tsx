"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui/button";

import { sceneStore } from "../scene-store";
import { playFeedbackSound } from "../sound";
import { useScene } from "./use-scene";

/** Sound is off until the child turns it on; the choice is remembered on this device only. */
export function SoundToggle() {
  const soundOn = useScene((s) => s.soundOn);
  const hydrated = useScene((s) => s.soundHydrated);

  useEffect(() => {
    sceneStore.getState().hydrateSound(); // after mount, so server and client markup match
  }, []);

  return (
    <Button
      type="button"
      variant="outline"
      aria-pressed={soundOn}
      disabled={!hydrated}
      className="min-h-11 min-w-11 rounded-2xl px-3 font-bold"
      data-testid="sound-toggle"
      onClick={() => {
        const next = !soundOn;
        sceneStore.getState().setSound(next);
        if (next) playFeedbackSound("solved", true); // a short preview, from the child's own tap
      }}
    >
      <span aria-hidden="true">{soundOn ? "🔊" : "🔈"}</span>
      <span>{soundOn ? "Sound on" : "Sound off"}</span>
    </Button>
  );
}
