import { z } from "zod";

export const GUEST_SETTINGS_STORAGE_KEY = "playchess.guest-settings";

export const colorSchemes = ["system", "light", "dark"] as const;
export const colorSchemeSchema = z.enum(colorSchemes);
export type ColorScheme = z.infer<typeof colorSchemeSchema>;

export const boardThemes = ["club", "walnut", "ocean"] as const;
export const boardThemeSchema = z.enum(boardThemes);
export type BoardThemeId = z.infer<typeof boardThemeSchema>;

export const boardThemeDefinitions = [
  {
    id: "club",
    label: "Club green",
    description: "Cream squares and a park-green dark square.",
  },
  {
    id: "walnut",
    label: "Walnut",
    description: "Two woods, lighter on the white squares.",
  },
  {
    id: "ocean",
    label: "Ocean",
    description: "Pale water and a deep teal.",
  },
] as const satisfies readonly {
  id: BoardThemeId;
  label: string;
  description: string;
}[];

export const guestSettingsSchema = z.object({
  colorScheme: colorSchemeSchema,
  boardTheme: boardThemeSchema,
  showCoordinates: z.boolean(),
  flipBoard: z.boolean(),
  showHighlights: z.boolean(),
});

export type GuestSettings = z.infer<typeof guestSettingsSchema>;

export const defaultGuestSettings: GuestSettings = {
  colorScheme: "system",
  boardTheme: "club",
  showCoordinates: true,
  flipBoard: false,
  showHighlights: true,
};

export function readGuestSettings(raw: string | null | undefined): GuestSettings {
  if (raw === null || raw === undefined || raw.trim() === "") {
    return defaultGuestSettings;
  }

  try {
    const parsed = guestSettingsSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : defaultGuestSettings;
  } catch {
    return defaultGuestSettings;
  }
}

export function serializeGuestSettings(settings: GuestSettings): string {
  return JSON.stringify(guestSettingsSchema.parse(settings));
}
