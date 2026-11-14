import { describe, expect, it } from "vitest";

import {
  createSceneStore,
  SOUND_STORAGE_KEY,
  type StorageLike,
} from "@/features/adventures/scene-store";

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  const storage: StorageLike = {
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
  };
  return { storage, data };
}

describe("scene store (client-only, ADR 0016)", () => {
  it("starts silent and idle, before anything is read from storage", () => {
    const { storage } = memoryStorage({ [SOUND_STORAGE_KEY]: "1" });
    const store = createSceneStore(() => storage);
    expect(store.getState()).toMatchObject({
      soundOn: false,
      soundHydrated: false,
      needle: "idle",
    });
  });

  it("hydrates the saved sound preference only on request", () => {
    const { storage } = memoryStorage({ [SOUND_STORAGE_KEY]: "1" });
    const store = createSceneStore(() => storage);
    store.getState().hydrateSound();
    expect(store.getState()).toMatchObject({ soundOn: true, soundHydrated: true });
  });

  it("treats anything but '1' as off", () => {
    const { storage } = memoryStorage({ [SOUND_STORAGE_KEY]: "yes" });
    const store = createSceneStore(() => storage);
    store.getState().hydrateSound();
    expect(store.getState().soundOn).toBe(false);
  });

  it("remembers only the sound preference: animation signals never reach storage", () => {
    const { storage, data } = memoryStorage();
    const store = createSceneStore(() => storage);
    store.getState().signalWrong();
    store.getState().signalSolved();
    expect(data.size).toBe(0);
    store.getState().setSound(true);
    expect([...data.entries()]).toEqual([[SOUND_STORAGE_KEY, "1"]]);
  });

  it("survives storage that throws or does not exist", () => {
    const throwing: StorageLike = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    };
    for (const getStorage of [() => throwing, () => null]) {
      const store = createSceneStore(getStorage);
      expect(() => store.getState().hydrateSound()).not.toThrow();
      expect(() => store.getState().setSound(true)).not.toThrow();
      expect(store.getState().soundOn).toBe(true); // for this page view
    }
    // With no localStorage global (Node) the default accessor falls back to "no storage".
    expect(createSceneStore().getState().soundOn).toBe(false);
    expect(() => createSceneStore().getState().setSound(true)).not.toThrow();
  });

  it("signals replay (nonce bumps) and settle back to idle", () => {
    const store = createSceneStore(() => null);
    store.getState().signalWrong();
    const first = store.getState();
    expect(first).toMatchObject({ needle: "wobble", celebration: null });
    store.getState().signalSolved();
    const second = store.getState();
    expect(second).toMatchObject({ needle: "spin", celebration: "puzzle-solved" });
    expect(second.signalNonce).toBeGreaterThan(first.signalNonce);
    store.getState().settle();
    expect(store.getState().needle).toBe("idle");
  });
});
