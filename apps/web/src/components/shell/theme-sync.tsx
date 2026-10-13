import { useGuestSettings } from "@/state/guest-settings.ts";
import { useEffect } from "react";

export function ThemeSync() {
  const { colorScheme, boardTheme } = useGuestSettings((state) => state.settings);

  useEffect(() => {
    const root = document.documentElement;
    const media = window.matchMedia("(prefers-color-scheme: dark)");

    const apply = () => {
      const dark =
        colorScheme === "dark" || (colorScheme === "system" && media.matches);
      root.classList.toggle("dark", dark);
      root.dataset.boardTheme = boardTheme;
      root.style.colorScheme = dark ? "dark" : "light";
    };

    apply();
    media.addEventListener("change", apply);
    return () => {
      media.removeEventListener("change", apply);
    };
  }, [boardTheme, colorScheme]);

  return null;
}
