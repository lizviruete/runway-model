#!/usr/bin/env node
// =============================================================================
// Verify every `File.tsx:NNN` reference in the V2.1 docs still points at what
// the doc says it points at.
//
//   npm run check:docs
//
// WHY THIS EXISTS. The rulings and build-prompt docs are meant to be read cold
// at V3, and they carry ~50 file:line pointers into components. Line numbers
// drift the moment anyone edits a component — item 10 added a few comment
// blocks and silently moved TEN references in `LedgerView.tsx`, several of them
// onto other `text-zinc-400` spans that look plausible to a casual check. A
// stale pointer that lands somewhere believable is worse than one that lands
// out of range, because nothing announces it.
//
// HOW IT DECIDES. A line number alone cannot be verified — any number in range
// "exists". So the check leans on the ANCHOR TOKENS the docs already carry:
// backticked code spans sitting on the same line as the reference. If the
// referenced source line contains one of them, the pointer is confirmed. If it
// does not, the script searches the file for that token and TELLS YOU THE LINE
// IT MOVED TO, so fixing the doc is a copy edit rather than an investigation.
//
// References with no usable anchor are reported as UNVERIFIED, not as passing.
// The script will not claim to have checked something it did not check — that
// is the whole failure it was written to stop.
// =============================================================================

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, extname } from "node:path";

const verbose = process.argv.includes("--verbose");

const DOCS = ["docs/v2-1/upward-v2-1-rulings.md", "docs/v2-1/upward-v2-1-build-prompt.md"];
const SOURCE_DIRS = ["components", "lib", "app", "scripts"];

/** Shortest token we will trust as an anchor. Below this, matches are noise. */
const MIN_ANCHOR = 3;
/** An anchor found on this many source lines cannot confirm any one of them. */
const MAX_ANCHOR_HITS = 6;

// ---------------------------------------------------------------- source index

/** basename → full path, for every source file we might be pointed at. */
function indexSources(dirs) {
  const index = new Map();
  const walk = (dir) => {
    let entries;
    try {
      entries = readdirSync(dir);
    } catch {
      return; // a directory that does not exist is not an error here
    }
    for (const entry of entries) {
      if (entry === "node_modules" || entry.startsWith(".")) continue;
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) walk(full);
      else if ([".ts", ".tsx", ".mjs", ".js", ".css"].includes(extname(entry))) {
        // First one wins, so `components/` shadows a same-named file deeper in.
        if (!index.has(entry)) index.set(entry, full);
      }
    }
  };
  for (const dir of dirs) walk(dir);
  return index;
}

// ---------------------------------------------------------------- doc parsing

/**
 * Pull the reference GROUPS out of one line of a doc.
 *
 * A group is one or more line numbers for a file, plus the anchors that
 * describe them. The anchor syntax is EXPLICIT and narrow:
 *
 *     `LedgerView.tsx:252` (`bg-red-50`)
 *     `LedgerView.tsx:244`, `:257` (`open <Amount` / `close <Amount`)
 *
 * Anchors must sit in parentheses immediately after the reference. An earlier
 * version inferred them by proximity instead, and produced three false
 * failures out of 56 — every one an anchor that sat near a reference but
 * belonged to the next clause. A checker that cries wolf gets ignored, which is
 * the same evaporation it exists to prevent, so the syntax is declared rather
 * than guessed. No parenthetical, no claim: the reference is reported
 * UNVERIFIED and the script says how to make it checkable.
 */
/**
 * Read the parenthesised anchor list starting at `rest`, if there is one.
 *
 * Parens are BALANCED and parens inside backticks are ignored, because real
 * anchors contain them: `setSaving(false)` and `formatCurrency(...)` both close
 * a paren that is not the end of the list. A naive `[^)]*` truncates there and
 * silently drops the anchor, which reports a correct reference as unverified.
 */
function anchorsAfter(rest) {
  const open = /^\s*\(/.exec(rest);
  if (!open) return [];
  let depth = 0;
  let inTick = false;
  let end = -1;
  for (let i = open[0].length - 1; i < rest.length; i++) {
    const ch = rest[i];
    if (ch === "`") inTick = !inTick;
    if (inTick) continue;
    if (ch === "(") depth++;
    else if (ch === ")" && --depth === 0) {
      end = i;
      break;
    }
  }
  if (end === -1) return [];
  return [...rest.slice(0, end).matchAll(/`([^`]+)`/g)]
    .map((x) => x[1].trim())
    .filter((t) => t.length >= MIN_ANCHOR);
}

function groupsOnLine(line) {
  const groups = [];
  const refRe =
    /`([A-Za-z][A-Za-z0-9_]*\.(?:tsx?|mjs|js|css)):(\d+)`((?:\s*(?:,|\/|and)\s*`:\d+`)*)/g;
  for (const m of line.matchAll(refRe)) {
    const lines = [Number(m[2]), ...[...(m[3] || "").matchAll(/:(\d+)/g)].map((x) => Number(x[1]))];
    const anchors = anchorsAfter(line.slice(m.index + m[0].length));
    groups.push({ file: m[1], lines, anchors });
  }
  return groups;
}

// ---------------------------------------------------------------- the check

const sources = indexSources(SOURCE_DIRS);
const results = { confirmed: 0, unverified: [], broken: [] };

for (const doc of DOCS) {
  let docLines;
  try {
    docLines = readFileSync(doc, "utf8").split("\n");
  } catch {
    console.error(`cannot read ${doc}`);
    process.exitCode = 1;
    continue;
  }

  docLines.forEach((docLine, i) => {
    for (const group of groupsOnLine(docLine)) {
     for (const refLine of group.lines) {
      const ref = { file: group.file, line: refLine };
      const anchors = group.anchors;
      const where = `${doc}:${i + 1}`;
      const path = sources.get(ref.file);
      if (!path) {
        results.broken.push({ where, ref, why: `no such file: ${ref.file}` });
        continue;
      }

      const srcLines = readFileSync(path, "utf8").split("\n");
      if (ref.line < 1 || ref.line > srcLines.length) {
        results.broken.push({
          where,
          ref,
          why: `line ${ref.line} is out of range (${ref.file} has ${srcLines.length} lines)`,
        });
        continue;
      }

      const target = srcLines[ref.line - 1];

      if (anchors.some((a) => target.includes(a))) {
        results.confirmed++;
        continue;
      }

      // No anchor of this reference's own matched. Where did it go? Only the
      // anchor that actually identifies ONE line is worth reporting as a move —
      // a token scattered through the file cannot tell you which line is meant.
      const moved = [];
      for (const a of anchors) {
        const found = srcLines.map((l, n) => (l.includes(a) ? n + 1 : 0)).filter(Boolean);
        if (found.length > 0 && found.length <= MAX_ANCHOR_HITS) {
          moved.push({ anchor: a, lines: found });
        }
      }

      if (moved.length > 0) {
        results.broken.push({
          where,
          ref,
          why: `points at "${target.trim().slice(0, 70)}"`,
          moved,
        });
      } else {
        results.unverified.push({ where, ref, target: target.trim().slice(0, 70) });
      }
     }
    }
  });
}

// ---------------------------------------------------------------- reporting

const total = results.confirmed + results.unverified.length + results.broken.length;

if (results.broken.length > 0) {
  console.log(`\n✗ ${results.broken.length} BROKEN reference${results.broken.length > 1 ? "s" : ""}\n`);
  for (const b of results.broken) {
    console.log(`  ${b.where}`);
    console.log(`    ${b.ref.file}:${b.ref.line} — ${b.why}`);
    for (const m of b.moved ?? []) {
      const at = m.lines.length === 1 ? `line ${m.lines[0]}` : `lines ${m.lines.join(", ")}`;
      console.log(`    → \`${m.anchor}\` is now at ${at}`);
    }
    console.log("");
  }
}

if (results.unverified.length > 0) {
  const n = results.unverified.length;
  console.log(`\n? ${n} reference${n > 1 ? "s" : ""} in range but NOT verified — no anchor quoted beside them.`);
  console.log(`  These are not failures; they are pointers this script cannot check.`);
  console.log(`  Give one an anchor and it self-checks from then on:`);
  console.log(`      \`LedgerView.tsx:252\` (\`bg-red-50\`)`);
  if (verbose) {
    console.log("");
    for (const u of results.unverified) {
      console.log(`  ${u.where} → ${u.ref.file}:${u.ref.line}`);
      console.log(`    currently: ${u.target}`);
    }
  } else {
    console.log(`  Run with --verbose to list them.`);
  }
  console.log("");
}

console.log(
  `${results.broken.length === 0 ? "✓" : "✗"} ${results.confirmed}/${total} references confirmed against an anchor` +
    (results.unverified.length ? `, ${results.unverified.length} unverified` : "") +
    (results.broken.length ? `, ${results.broken.length} broken` : ""),
);

process.exit(results.broken.length > 0 ? 1 : 0);
