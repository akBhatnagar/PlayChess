import {
  defaultGuestSettings,
  GUEST_SETTINGS_STORAGE_KEY,
  readGuestSettings,
  serializeGuestSettings,
  type GuestSettings,
} from "@playchess/theme-config";
import { create } from "zustand";

type GuestSettingsState = {
  settings: GuestSettings;
  update: (patch: Partial<GuestSettings>) => void;
  reload: () => void;
};

function readStoredSettings(): GuestSettings {
  if (typeof window === "undefined") {
    return defaultGuestSettings;
  }

  try {
    return readGuestSettings(window.localStorage.getItem(GUEST_SETTINGS_STORAGE_KEY));
  } catch {
    return defaultGuestSettings;
  }
}

function writeStoredSettings(settings: GuestSettings) {
  window.localStorage.setItem(GUEST_SETTINGS_STORAGE_KEY, serializeGuestSettings(settings));
}

export const useGuestSettings = create<GuestSettingsState>((set, get) => ({
  settings: readStoredSettings(),
  update: (patch) => {
    const next = { ...get().settings, ...patch };
    set({ settings: next });
    writeStoredSettings(next);
  },
  reload: () => {
    set({ settings: readStoredSettings() });
  },
}));
