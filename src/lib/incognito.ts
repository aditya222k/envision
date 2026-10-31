"use client";

import { useSyncExternalStore } from "react";

const STORAGE_KEY = "envision-incognito";
const CHANGE_EVENT = "envision-incognito-change";

function read() {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "on";
  } catch {
    return false;
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function setIncognito(isOn: boolean) {
  try {
    window.localStorage.setItem(STORAGE_KEY, isOn ? "on" : "off");
  } catch {
    // Without storage the switch can't stay on, and the app stays in normal mode.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function useIncognito() {
  return useSyncExternalStore(subscribe, read, () => false);
}
