"use client";

/**
 * Who is signed in on this device. Stage 1: name + PIN checked by the demo server.
 * Stage 2: checked by the real server (PINs stored scrambled, lock-out after wrong guesses).
 * Staying signed in on the phone means the app still opens offshore with no signal.
 */
import { createLocalStore } from "./local-store";
import { forgetSentTrips } from "./device";
import type { Person } from "./types";

export type Me = Omit<Person, "pin">;

export const sessionStore = createLocalStore<Me | null>("offshore:session", () => null);

export function useMe(): Me | null | undefined {
  return sessionStore.useValue();
}

export function signOut() {
  forgetSentTrips();
  sessionStore.set(null);
}
