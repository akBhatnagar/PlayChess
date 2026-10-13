import { BoardPreview } from "@/components/board/board-preview.tsx";
import { cn } from "@/lib/utils.ts";
import { useGuestSettings } from "@/state/guest-settings.ts";
import { boardThemeDefinitions, colorSchemes, type BoardThemeId, type ColorScheme } from "@playchess/theme-config";

const schemeLabels: Record<ColorScheme, string> = {
  system: "System",
  light: "Light",
  dark: "Dark",
};

export function SettingsPage() {
  const settings = useGuestSettings((state) => state.settings);
  const update = useGuestSettings((state) => state.update);

  return (
    <div className="grid gap-8">
      <header className="max-w-2xl">
        <p className="text-sm font-semibold tracking-[0.18em] text-primary uppercase">Appearance</p>
        <h1 className="mt-2 text-4xl sm:text-5xl">The board in front of you</h1>
        <p className="mt-3 text-lg leading-relaxed text-muted-foreground">
          Colour, coordinates, and orientation change the preview here and the board on the home
          page. They stay in this browser until an account can keep them.
        </p>
      </header>
      <div className="grid items-start gap-8 lg:grid-cols-[minmax(16rem,24rem)_minmax(0,1fr)]">
        <figure className="lg:sticky lg:top-24">
          <BoardPreview
            theme={settings.boardTheme}
            showCoordinates={settings.showCoordinates}
            flipBoard={settings.flipBoard}
            highlightSquare={settings.showHighlights ? "e4" : undefined}
          />
          <figcaption className="mt-3 text-sm text-muted-foreground">
            Starting position. Flip turns the board around. The highlight sits on empty e4.
          </figcaption>
        </figure>
        <div className="grid gap-8">
          <fieldset className="grid gap-3">
            <legend className="font-heading text-2xl">Room</legend>
            <div className="grid grid-cols-3 gap-2">
              {colorSchemes.map((scheme) => (
                <button
                  key={scheme}
                  type="button"
                  aria-pressed={settings.colorScheme === scheme}
                  onClick={() => {
                    update({ colorScheme: scheme });
                  }}
                  className={cn(
                    "min-h-11 rounded-xl border px-3 py-2 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                    settings.colorScheme === scheme
                      ? "border-primary bg-primary text-primary-foreground"
                      : "bg-card hover:bg-accent",
                  )}
                >
                  {schemeLabels[scheme]}
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset className="grid gap-3">
            <legend className="font-heading text-2xl">Board</legend>
            <div className="grid gap-3">
              {boardThemeDefinitions.map((theme) => (
                <ThemeChoice
                  key={theme.id}
                  id={theme.id}
                  label={theme.label}
                  description={theme.description}
                  pressed={settings.boardTheme === theme.id}
                  onSelect={() => {
                    update({ boardTheme: theme.id });
                  }}
                />
              ))}
            </div>
          </fieldset>
          <fieldset className="grid gap-3">
            <legend className="font-heading text-2xl">Board details</legend>
            <ToggleRow
              label="Coordinates"
              description="Files and ranks along the near edge."
              checked={settings.showCoordinates}
              onChange={(showCoordinates) => {
                update({ showCoordinates });
              }}
            />
            <ToggleRow
              label="Black at the bottom"
              description="Turn the preview around."
              checked={settings.flipBoard}
              onChange={(flipBoard) => {
                update({ flipBoard });
              }}
            />
            <ToggleRow
              label="Highlight colour"
              description="Show the last-move ring on e4."
              checked={settings.showHighlights}
              onChange={(showHighlights) => {
                update({ showHighlights });
              }}
            />
          </fieldset>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Piece drawings on this board are original geometric shapes. Other piece sets wait
            until their licences are checked. Sound and notation preferences arrive with move lists.
          </p>
        </div>
      </div>
    </div>
  );
}

function ThemeChoice({
  id,
  label,
  description,
  pressed,
  onSelect,
}: {
  id: BoardThemeId;
  label: string;
  description: string;
  pressed: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={pressed}
      onClick={onSelect}
      className={cn(
        "flex min-h-16 items-center gap-4 rounded-xl border px-3 py-3 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        pressed ? "border-primary bg-card ring-2 ring-primary" : "bg-card hover:bg-accent",
      )}
    >
      <span
        className="grid size-12 shrink-0 grid-cols-2 overflow-hidden rounded-md ring-1 ring-foreground/20"
        data-board-theme={id}
      >
        <span style={{ background: "var(--square-light)" }} />
        <span style={{ background: "var(--square-dark)" }} />
        <span style={{ background: "var(--square-dark)" }} />
        <span style={{ background: "var(--square-light)" }} />
      </span>
      <span>
        <span className="block font-semibold">{label}</span>
        <span className="block text-sm text-muted-foreground">{description}</span>
      </span>
    </button>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex min-h-16 cursor-pointer items-center justify-between gap-4 rounded-xl border bg-card px-4 py-3">
      <span>
        <span className="block font-semibold">{label}</span>
        <span className="block text-sm text-muted-foreground">{description}</span>
      </span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => {
          onChange(event.target.checked);
        }}
        className="size-5 accent-primary"
      />
    </label>
  );
}
