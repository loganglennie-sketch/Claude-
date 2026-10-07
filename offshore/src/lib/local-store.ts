"use client";

import { useSyncExternalStore } from "react";

/**
 * A value kept in the browser's storage that screens can watch.
 * Changes show straight away in this tab and in other tabs on the same device.
 */
export function createLocalStore<T>(key: string, initial: () => T) {
  const listeners = new Set<() => void>();
  let cachedRaw: string | null | undefined;
  let cached: T | undefined;
  let memoryOnly: T | undefined; // storage blocked (private mode): keep it in memory

  function get(): T {
    if (memoryOnly !== undefined) return memoryOnly;
    let raw: string | null;
    try {
      raw = localStorage.getItem(key);
    } catch {
      memoryOnly = initial();
      return memoryOnly;
    }
    if (raw !== cachedRaw || cached === undefined) {
      cachedRaw = raw;
      try {
        cached = raw ? (JSON.parse(raw) as T) : initial();
      } catch {
        cached = initial();
      }
    }
    return cached;
  }

  function set(next: T | ((current: T) => T)) {
    const value = typeof next === "function" ? (next as (c: T) => T)(get()) : next;
    if (memoryOnly !== undefined) memoryOnly = value;
    else {
      try {
        const raw = JSON.stringify(value);
        localStorage.setItem(key, raw);
        cachedRaw = raw;
        cached = value;
      } catch {
        memoryOnly = value;
      }
    }
    listeners.forEach((l) => l());
  }

  function subscribe(listener: () => void) {
    listeners.add(listener);
    const onStorage = (e: StorageEvent) => {
      if (e.key === key || e.key === null) listener();
    };
    window.addEventListener("storage", onStorage);
    return () => {
      listeners.delete(listener);
      window.removeEventListener("storage", onStorage);
    };
  }

  function useValue<S = T>(select?: (v: T) => S, serverValue?: S): S | undefined {
    return useSyncExternalStore(
      subscribe,
      () => (select ? select(get()) : (get() as unknown as S)),
      () => serverValue,
    );
  }

  return { get, set, subscribe, useValue };
}

/** True once the page is running in the browser (stored data can be read). */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}
