"use client";

import { useState } from "react";
import type { Preset } from "@/lib/presets";
import type { SavedScenario } from "@/lib/storage";

interface Props {
  presets: Preset[];
  /** Show the built-in example preset chips — only true in example mode. */
  exampleMode: boolean;
  activePresetId: string | null;
  onApplyPreset: (preset: Preset) => void;
  onCopyLink: () => void;
  copied: boolean;
  onSave: (name: string, notes: string) => void;
  onSaveAsBaseline: () => void;
  saved: SavedScenario[];
  onLoad: (entry: SavedScenario) => void;
  onDelete: (key: string) => void;
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
  onLoad,
  onDelete,
  onSeeExample,
  onStartFresh,
}: Props) {
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [showSaved, setShowSaved] = useState(false);

  const commitSave = () => {
    const trimmed = name.trim();
    if (trimmed) onSave(trimmed, notes.trim());
    setName("");
    setNotes("");
    setSaving(false);
  };

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

        <button
          onClick={onSaveAsBaseline}
          title="Lock the current inputs as the reference the dashed line and Δ compare against"
          className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:border-zinc-400"
        >
          Save as baseline
        </button>

        {saved.length > 0 ? (
          <div className="relative">
            <button
              onClick={() => setShowSaved((s) => !s)}
              className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:border-zinc-400"
            >
              Saved ({saved.length}) ▾
            </button>
            {showSaved ? (
              <div className="absolute z-10 mt-1 w-64 rounded-lg border border-zinc-200 bg-white py-1 shadow-lg">
                {saved.map((s) => (
                  <div key={s.key} className="flex items-center justify-between px-2 py-1 hover:bg-zinc-50">
                    <button
                      onClick={() => {
                        onLoad(s);
                        setShowSaved(false);
                      }}
                      className="min-w-0 flex-1 text-left text-xs text-zinc-700"
                      title={s.notes || s.name}
                    >
                      <span className="truncate">
                        {s.name}
                        <span className="ml-1 text-[10px] text-zinc-400">{s.savedAt}</span>
                      </span>
                      {s.notes ? <span className="block truncate text-[10px] text-zinc-400">{s.notes}</span> : null}
                    </button>
                    <button
                      onClick={() => onDelete(s.key)}
                      className="ml-2 rounded px-1 text-xs text-zinc-400 hover:bg-red-50 hover:text-red-500"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}

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
    </div>
  );
}
