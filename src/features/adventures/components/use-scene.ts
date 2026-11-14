"use client";

import { useStore } from "zustand";

import { sceneStore, type SceneState } from "../scene-store";

/** Subscribe a client component to the shared, in-memory scene store (ADR 0016). */
export function useScene<T>(selector: (state: SceneState) => T): T {
  return useStore(sceneStore, selector);
}
