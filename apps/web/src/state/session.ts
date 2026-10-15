import { fetchSession, type Account } from "@/lib/api.ts";
import { useGuestSettings } from "@/state/guest-settings.ts";
import { useQuery } from "@tanstack/react-query";

export const sessionQueryKey = ["session"] as const;

let appliedUserId: string | null = null;

/** Copy account appearance once per sign-in. Later edits stay local until they are patched. */
export function applyAccountSettings(account: Account | null) {
  if (!account) {
    appliedUserId = null;
    return;
  }
  if (appliedUserId === account.id) {
    return;
  }
  appliedUserId = account.id;
  useGuestSettings.getState().update(account.settings);
}

export function useSession() {
  return useQuery({
    queryKey: sessionQueryKey,
    queryFn: async () => {
      const account = await fetchSession();
      applyAccountSettings(account);
      return account;
    },
  });
}
