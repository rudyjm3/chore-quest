import { createStore } from "zustand/vanilla";

/**
 * Client-only scene state (ADR 0016). Everything here is presentation: it is never sent to a server
 * action and never written to the database or `child_adventure_progress.state`. The single remembered
 * value is the sound preference, kept in localStorage on this device only, off by default.
 * No React import: the module is unit tested in the Node environment.
 */
export const SOUND_STORAGE_KEY = "cq.scene.sound";

export type NeedleState = "idle" | "wobble" | "spin";
export type CelebrationKind = "puzzle-solved";

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface SceneState {
  soundOn: boolean;
  /** True once the stored preference has been read (after mount, never during render). */
  soundHydrated: boolean;
  needle: NeedleState;
  /** Bumps on every signal so the same animation can replay. */
  signalNonce: number;
  celebration: CelebrationKind | null;
  hydrateSound(): void;
  setSound(on: boolean): void;
  signalWrong(): void;
  signalSolved(): void;
  settle(): void;
}

function defaultStorage(): StorageLike | null {
  try {
    return typeof globalThis.localStorage === "undefined" ? null : globalThis.localStorage;
  } catch {
    return null; // accessing localStorage can throw (blocked site data)
  }
}

export function createSceneStore(getStorage: () => StorageLike | null = defaultStorage) {
  return createStore<SceneState>()((set, get) => ({
    soundOn: false,
    soundHydrated: false,
    needle: "idle",
    signalNonce: 0,
    celebration: null,
    hydrateSound() {
      let on = false;
      try {
        on = getStorage()?.getItem(SOUND_STORAGE_KEY) === "1";
      } catch {
        on = false;
      }
      set({ soundOn: on, soundHydrated: true });
    },
    setSound(on) {
      set({ soundOn: on });
      try {
        getStorage()?.setItem(SOUND_STORAGE_KEY, on ? "1" : "0");
      } catch {
        // Preference stays for this page view only.
      }
    },
    signalWrong() {
      set({ needle: "wobble", celebration: null, signalNonce: get().signalNonce + 1 });
    },
    signalSolved() {
      set({
        needle: "spin",
        celebration: "puzzle-solved",
        signalNonce: get().signalNonce + 1,
      });
    },
    settle() {
      set({ needle: "idle" });
    },
  }));
}

/** The one store the scene components share (only ever mutated in the browser). */
export const sceneStore = createSceneStore();
