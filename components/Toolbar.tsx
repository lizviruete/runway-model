"use client";

import { useState } from "react";
import type { Preset } from "@/lib/presets";
import type { SavedScenario } from "@/lib/storage";

interface Props {
  presets: Preset[];
  activePresetId: string | null;
  onApplyPreset: (preset: Preset) => void;
  onCopyLink: () => void;
  copied: boolean;
  onSave: (name: string) => void;
  saved: SavedScenario[];
  onLoad: (entry: SavedScenario) => void;
  onDelete: (key: string) => void;
  onReset: () => void;
}

export function Toolbar({
  presets,
  activePresetId,
  onApplyPreset,
  onCopyLink,
  copied,
  onSave,
  saved,
  onLoad,
  onDelete,
  onReset,
}: Props) {
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [showSaved, setShowSaved] = useState(false);

  const commitSave = () => {
    const trimmed = name.trim();
    if (trimmed) onSave(trimmed);
    setName("");
    setSaving(false);
  };

  return (
    <div className="mb-6 space-y-3">
      {/* preset chips */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-zinc-400">Presets</span>
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
              className="rounded-lg border border-zinc-300 px-2 py-1.5 text-xs outline-none focus:border-zinc-500"
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
                      className="min-w-0 flex-1 truncate text-left text-xs text-zinc-700"
                      title={s.name}
                    >
                      {s.name}
                      <span className="ml-1 text-[10px] text-zinc-400">{s.savedAt}</span>
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

        <button onClick={onReset} className="ml-auto text-xs text-zinc-400 hover:text-zinc-600">
          Reset to sample
        </button>
      </div>
    </div>
  );
}
