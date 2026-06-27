"use client";

import { useState } from "react";
import type { Preset } from "@/lib/presets";
import { buildSavedPills } from "@/lib/savedPills";
import type { SavedBaseline, SavedScenario } from "@/lib/storage";

interface Props {
  presets: Preset[];
  /** Show the built-in example preset chips — only true in example mode. */
  exampleMode: boolean;
  activePresetId: string | null;
  onApplyPreset: (preset: Preset) => void;
  onCopyLink: () => void;
  copied: boolean;
  onSave: (name: string, notes: string) => void;
  onSaveAsBaseline: (notes: string) => void;
  saved: SavedScenario[];
  savedBaseline: SavedBaseline | null;
  onLoad: (entry: SavedScenario) => void;
  onDelete: (key: string) => void;
  onLoadBaseline: () => void;
  onDeleteBaseline: () => void;
  onSeeExample: () => void;
  onStartFresh: () => void;
}

export function Toolbar({
  presets,
  exampleMode,
  activePresetId,
  onApplyPreset,
  onCopyLink,
  copied,
  onSave,
  onSaveAsBaseline,
  saved,
  savedBaseline,
  onLoad,
  onDelete,
  onLoadBaseline,
  onDeleteBaseline,
  onSeeExample,
  onStartFresh,
}: Props) {
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [savingBaseline, setSavingBaseline] = useState(false);
  const [baselineNotes, setBaselineNotes] = useState("");

  const commitSave = () => {
    const trimmed = name.trim();
    if (trimmed) onSave(trimmed, notes.trim());
    setName("");
    setNotes("");
    setSaving(false);
  };

  const commitSaveBaseline = () => {
    onSaveAsBaseline(baselineNotes.trim());
    setBaselineNotes("");
    setSavingBaseline(false);
  };

  const baselineLabel = savedBaseline ? "Save as new baseline" : "Save as baseline";

  const pills = buildSavedPills(savedBaseline, saved);

  return (
    <div className="mb-6 space-y-3">
      {/* example preset chips — only in example mode ("See an Example") */}
      {exampleMode ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium uppercase tracking-wide text-zinc-400">Examples</span>
          {presets.map((p) => (
            <button
              key={p.id}
              onClick={() => onApplyPreset(p)}
              title={p.description}
              className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                activePresetId === p.id
                  ? "border-zinc-900 bg-zinc-900 text-white"
                  : "border-zinc-300 bg-white text-zinc-700 hover:border-zinc-400"
              }`}
            >
              {p.name}
            </button>
          ))}
        </div>
      ) : null}

      {/* actions */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={onCopyLink}
          className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:border-zinc-400"
        >
          {copied ? "✓ Link copied" : "Copy shareable link"}
        </button>

        {saving ? (
          <span className="flex items-center gap-1">
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitSave();
                if (e.key === "Escape") setSaving(false);
              }}
              placeholder="Scenario name"
              className="w-36 rounded-lg border border-zinc-300 px-2 py-1.5 text-xs text-zinc-900 placeholder:text-zinc-400 outline-none focus:border-zinc-500"
            />
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitSave();
                if (e.key === "Escape") setSaving(false);
              }}
              placeholder="Notes (optional)"
              className="w-48 rounded-lg border border-zinc-300 px-2 py-1.5 text-xs text-zinc-900 placeholder:text-zinc-400 outline-none focus:border-zinc-500"
            />
            <button onClick={commitSave} className="rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white">
              Save
            </button>
            <button onClick={() => setSaving(false)} className="px-1 text-xs text-zinc-400">
              ✕
            </button>
          </span>
        ) : (
          <button
            onClick={() => setSaving(true)}
            className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:border-zinc-400"
          >
            Save scenario
          </button>
        )}

        {savingBaseline ? (
          <span className="flex items-center gap-1">
            <input
              data-testid="baseline-notes-input"
              autoFocus
              value={baselineNotes}
              onChange={(e) => setBaselineNotes(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitSaveBaseline();
                if (e.key === "Escape") setSavingBaseline(false);
              }}
              placeholder="Notes (optional)"
              className="w-48 rounded-lg border border-zinc-300 px-2 py-1.5 text-xs text-zinc-900 placeholder:text-zinc-400 outline-none focus:border-zinc-500"
            />
            <button
              onClick={commitSaveBaseline}
              className="rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white"
            >
              Save
            </button>
            <button onClick={() => setSavingBaseline(false)} className="px-1 text-xs text-zinc-400">
              ✕
            </button>
          </span>
        ) : (
          <button
            onClick={() => setSavingBaseline(true)}
            title="Lock the current inputs as the reference the dashed line and Δ compare against"
            className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:border-zinc-400"
          >
            {baselineLabel}
          </button>
        )}

        <div className="ml-auto flex items-center gap-3">
          <button onClick={onStartFresh} className="text-xs text-zinc-400 hover:text-zinc-600">
            Start fresh
          </button>
          <span className="text-zinc-300">·</span>
          <button onClick={onSeeExample} className="text-xs text-zinc-400 hover:text-zinc-600">
            See an Example
          </button>
        </div>
      </div>

      {/* saved pills — the user's own baseline + scenarios, one-click, in every
          state whenever saved items exist (the Baseline pill is pinned first and
          styled distinctly). */}
      {pills.length > 0 ? (
        <div data-testid="saved-pills" className="flex flex-wrap items-start gap-3">
          <span className="mt-1 text-xs font-medium uppercase tracking-wide text-zinc-400">Saved</span>
          {pills.map((pill) => {
            const isBaseline = pill.kind === "baseline";
            const load = () =>
              isBaseline ? onLoadBaseline() : onLoad(saved.find((s) => s.key === pill.key)!);
            const del = () => (isBaseline ? onDeleteBaseline() : onDelete(pill.key));
            return (
              <div key={pill.key} data-testid="saved-pill" className="flex max-w-[12rem] flex-col gap-0.5">
                <div className="flex items-center gap-1">
                  <button
                    data-testid="saved-pill-load"
                    onClick={load}
                    title={pill.notes || pill.label}
                    className={`min-w-0 truncate rounded-full border px-3 py-1 text-xs transition-colors ${
                      isBaseline
                        ? "border-zinc-900 bg-zinc-900 font-medium text-white hover:bg-zinc-800"
                        : "border-zinc-300 bg-white text-zinc-700 hover:border-zinc-400"
                    }`}
                  >
                    {pill.label}
                  </button>
                  <button
                    data-testid="saved-pill-delete"
                    onClick={del}
                    aria-label={`Delete ${pill.label}`}
                    className="rounded px-1 text-xs text-zinc-400 hover:bg-red-50 hover:text-red-500"
                  >
                    ✕
                  </button>
                </div>
                <span className="px-1 text-[10px] text-zinc-400">
                  <span data-testid="saved-pill-date">{pill.date}</span>
                  {pill.notes ? (
                    <span data-testid="saved-pill-notes" title={pill.notes} className="block truncate">
                      {pill.notes}
                    </span>
                  ) : null}
                </span>
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
