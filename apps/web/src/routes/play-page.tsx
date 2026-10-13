import {
  TIME_CONTROL_PRESETS,
  ratingPoolLabel,
  type TimeControlPreset,
} from "@playchess/chess-core";
import { cn } from "@/lib/utils.ts";
import { useState } from "react";

function presetOrFirst(id: string): TimeControlPreset {
  const preset = TIME_CONTROL_PRESETS.find((item) => item.id === id) ?? TIME_CONTROL_PRESETS[0];
  if (!preset) {
    throw new Error("PlayChess has no time-control presets.");
  }
  return preset;
}

function formatClock(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function SideLine({ label, initialMs, incrementMs }: { label: string; initialMs: number; incrementMs: number }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-border py-3 last:border-b-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium">
        {formatClock(initialMs)}
        <span className="mt-0.5 block text-sm font-normal text-muted-foreground">
          {initialMs.toLocaleString("en-GB")} ms, plus {incrementMs.toLocaleString("en-GB")} ms
        </span>
      </dd>
    </div>
  );
}

export function PlayPage() {
  const [selectedId, setSelectedId] = useState<string>("blitz-5-3");
  const selected = presetOrFirst(selectedId);

  return (
    <div className="grid gap-8">
      <header className="max-w-2xl">
        <p className="text-sm font-semibold tracking-[0.18em] text-primary uppercase">Lobby</p>
        <h1 className="mt-2 text-4xl sm:text-5xl">Choose a clock</h1>
        <p className="mt-3 text-lg leading-relaxed text-muted-foreground">
          These are the PlayChess presets. The one you select is the clock a later game will
          store. Local play is the next milestone, so this page stops at the choice.
        </p>
      </header>
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1.2fr)_minmax(16rem,22rem)]">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3" role="group" aria-label="Time control presets">
          {TIME_CONTROL_PRESETS.map((preset) => {
            const selectedPreset = preset.id === selected.id;
            return (
              <button
                key={preset.id}
                type="button"
                aria-pressed={selectedPreset}
                onClick={() => {
                  setSelectedId(preset.id);
                }}
                className={cn(
                  "min-h-16 rounded-xl border px-3 py-3 text-left transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                  selectedPreset
                    ? "border-primary bg-primary text-primary-foreground"
                    : "bg-card text-foreground",
                )}
              >
                <span className="block font-heading text-2xl leading-none">{preset.label}</span>
                <span
                  className={cn(
                    "mt-1 block text-sm",
                    selectedPreset ? "text-primary-foreground" : "text-muted-foreground",
                  )}
                >
                  {ratingPoolLabel(preset.category)}
                </span>
              </button>
            );
          })}
        </div>
        <section aria-live="polite" className="rounded-2xl border bg-card p-5">
          <h2 className="text-3xl">{selected.label}</h2>
          <p className="mt-1 text-muted-foreground">{ratingPoolLabel(selected.category)} pool</p>
          <dl className="mt-4">
            <SideLine
              label="White"
              initialMs={selected.initialTimeWhiteMs}
              incrementMs={selected.incrementWhiteMs}
            />
            <SideLine
              label="Black"
              initialMs={selected.initialTimeBlackMs}
              incrementMs={selected.incrementBlackMs}
            />
            <div className="flex items-baseline justify-between gap-4 py-3">
              <dt className="text-muted-foreground">Delay</dt>
              <dd className="font-medium">None</dd>
            </div>
          </dl>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Rated or casual is chosen when a game is created. Asymmetric time odds use the same
            fields, with each side stored separately.
          </p>
        </section>
      </div>
    </div>
  );
}
