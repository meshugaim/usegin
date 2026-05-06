import React, { useEffect, useState } from "react";
import { render, Box, Text, useInput, useApp } from "ink";
import { readFileSync, writeFileSync } from "fs";

const [, , subcmd, inPath, outPath] = process.argv;
if (!subcmd || !inPath || !outPath) {
  console.error("usage: tui.tsx <subcmd> <in.json> <out.json>");
  process.exit(2);
}
const spec = JSON.parse(readFileSync(inPath, "utf8"));

function done(result: unknown) {
  writeFileSync(outPath, JSON.stringify(result));
}

function isWordChar(c: string) {
  return /\S/.test(c);
}
function wordLeft(s: string, c: number): number {
  let i = c;
  while (i > 0 && !isWordChar(s[i - 1])) i--;
  while (i > 0 && isWordChar(s[i - 1])) i--;
  return i;
}
function wordRight(s: string, c: number): number {
  let i = c;
  while (i < s.length && isWordChar(s[i])) i++;
  while (i < s.length && !isWordChar(s[i])) i++;
  return i;
}

function TextInput({
  value,
  onChange,
  onSubmit,
  focus = true,
  placeholder,
  mask,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit?: (v: string) => void;
  focus?: boolean;
  placeholder?: string;
  mask?: string;
}) {
  const [cursor, setCursor] = useState(value.length);
  useEffect(() => {
    if (cursor > value.length) setCursor(value.length);
  }, [value, cursor]);

  useInput(
    (input, key) => {
      if (key.upArrow || key.downArrow || key.tab || key.escape) return;
      if (key.return) {
        onSubmit?.(value);
        return;
      }
      // Word jump (Ctrl+arrow or Alt/Meta+b/f)
      if (key.ctrl && key.leftArrow) return setCursor(wordLeft(value, cursor));
      if (key.ctrl && key.rightArrow) return setCursor(wordRight(value, cursor));
      if (key.meta && input === "b") return setCursor(wordLeft(value, cursor));
      if (key.meta && input === "f") return setCursor(wordRight(value, cursor));
      // Start / end (Ctrl+A / Ctrl+E)
      if (key.ctrl && input === "a") return setCursor(0);
      if (key.ctrl && input === "e") return setCursor(value.length);
      // Char movement
      if (key.leftArrow) return setCursor((c) => Math.max(0, c - 1));
      if (key.rightArrow) return setCursor((c) => Math.min(value.length, c + 1));
      // Kill operations
      if (key.ctrl && input === "u") {
        onChange(value.slice(cursor));
        setCursor(0);
        return;
      }
      if (key.ctrl && input === "k") {
        onChange(value.slice(0, cursor));
        return;
      }
      if (key.ctrl && input === "w") {
        const start = wordLeft(value, cursor);
        onChange(value.slice(0, start) + value.slice(cursor));
        setCursor(start);
        return;
      }
      if (key.backspace) {
        if (cursor > 0) {
          onChange(value.slice(0, cursor - 1) + value.slice(cursor));
          setCursor((c) => c - 1);
        }
        return;
      }
      if (key.delete) {
        if (cursor < value.length) onChange(value.slice(0, cursor) + value.slice(cursor + 1));
        return;
      }
      if (key.ctrl || key.meta) return;
      if (input) {
        onChange(value.slice(0, cursor) + input + value.slice(cursor));
        setCursor((c) => c + input.length);
      }
    },
    { isActive: focus }
  );

  const display = mask ? mask.repeat(value.length) : value;
  if (!focus) {
    if (display.length > 0) return <Text>{display}</Text>;
    return placeholder ? <Text dimColor>{placeholder}</Text> : <Text> </Text>;
  }
  if (display.length === 0) {
    if (placeholder) {
      return (
        <Text>
          <Text inverse>{placeholder[0] ?? " "}</Text>
          <Text dimColor>{placeholder.slice(1)}</Text>
        </Text>
      );
    }
    return <Text inverse> </Text>;
  }
  if (cursor >= display.length) {
    return (
      <Text>
        {display}
        <Text inverse> </Text>
      </Text>
    );
  }
  return (
    <Text>
      {display.slice(0, cursor)}
      <Text inverse>{display[cursor]}</Text>
      {display.slice(cursor + 1)}
    </Text>
  );
}

function Header({ title, hint }: { title: string; hint: string }) {
  return (
    <Box flexDirection="column" marginBottom={1}>
      <Text bold>{title}</Text>
      <Text dimColor>{hint}</Text>
    </Box>
  );
}

function Reorder({ items: initial, prompt }: { items: string[]; prompt?: string }) {
  const { exit } = useApp();
  const [items, setItems] = useState(initial);
  const [cursor, setCursor] = useState(0);
  const [grabbed, setGrabbed] = useState(false);

  useInput((input, key) => {
    if (key.escape || input === "q") {
      done({ cancelled: true });
      exit();
      return;
    }
    if (key.return) {
      done({ ordered: items });
      exit();
      return;
    }
    if (input === " ") return setGrabbed((g) => !g);
    const move = (dir: -1 | 1) => {
      const next = cursor + dir;
      if (next < 0 || next >= items.length) return;
      if (grabbed) {
        const copy = [...items];
        [copy[cursor], copy[next]] = [copy[next], copy[cursor]];
        setItems(copy);
      }
      setCursor(next);
    };
    if (key.upArrow || input === "k") move(-1);
    else if (key.downArrow || input === "j") move(1);
  });

  return (
    <Box flexDirection="column" padding={1}>
      <Header
        title={prompt ?? "Reorder"}
        hint="↑/↓ or j/k move · space grab/drop · enter confirm · esc/q cancel"
      />
      {items.map((item, i) => {
        const isCursor = i === cursor;
        const marker = isCursor ? (grabbed ? "▶▶" : "▶ ") : "  ";
        const color = isCursor ? (grabbed ? "yellow" : "cyan") : undefined;
        return (
          <Text key={i} color={color}>
            {marker}
            {String(i + 1).padStart(2)}. {item}
          </Text>
        );
      })}
    </Box>
  );
}

function Choose({ items, prompt }: { items: string[]; prompt?: string }) {
  const { exit } = useApp();
  const [cursor, setCursor] = useState(0);
  useInput((input, key) => {
    if (key.escape || input === "q") {
      done({ cancelled: true });
      exit();
      return;
    }
    if (key.return) {
      done({ index: cursor, value: items[cursor] });
      exit();
      return;
    }
    if (key.upArrow || input === "k") setCursor((c) => Math.max(0, c - 1));
    else if (key.downArrow || input === "j") setCursor((c) => Math.min(items.length - 1, c + 1));
  });
  return (
    <Box flexDirection="column" padding={1}>
      <Header title={prompt ?? "Pick one"} hint="↑/↓ or j/k · enter confirm · esc/q cancel" />
      {items.map((item, i) => (
        <Text key={i} color={i === cursor ? "cyan" : undefined}>
          {i === cursor ? "▶ " : "  "}
          {item}
        </Text>
      ))}
    </Box>
  );
}

function Multi({
  items,
  prompt,
  preselected,
}: {
  items: string[];
  prompt?: string;
  preselected?: number[];
}) {
  const { exit } = useApp();
  const [cursor, setCursor] = useState(0);
  const [picked, setPicked] = useState<Set<number>>(new Set(preselected ?? []));
  useInput((input, key) => {
    if (key.escape || input === "q") {
      done({ cancelled: true });
      exit();
      return;
    }
    if (key.return) {
      const indices = [...picked].sort((a, b) => a - b);
      done({ indices, values: indices.map((i) => items[i]) });
      exit();
      return;
    }
    if (input === " ") {
      const copy = new Set(picked);
      copy.has(cursor) ? copy.delete(cursor) : copy.add(cursor);
      setPicked(copy);
      return;
    }
    if (input === "a") {
      setPicked(new Set(items.map((_, i) => i)));
      return;
    }
    if (input === "n") {
      setPicked(new Set());
      return;
    }
    if (key.upArrow || input === "k") setCursor((c) => Math.max(0, c - 1));
    else if (key.downArrow || input === "j") setCursor((c) => Math.min(items.length - 1, c + 1));
  });
  return (
    <Box flexDirection="column" padding={1}>
      <Header
        title={prompt ?? "Pick any"}
        hint="↑/↓ or j/k · space toggle · a all · n none · enter confirm · esc/q cancel"
      />
      {items.map((item, i) => (
        <Text key={i} color={i === cursor ? "cyan" : undefined}>
          {i === cursor ? "▶ " : "  "}
          {picked.has(i) ? "[x] " : "[ ] "}
          {item}
        </Text>
      ))}
    </Box>
  );
}

function Confirm({ prompt, default: dflt }: { prompt?: string; default?: boolean }) {
  const { exit } = useApp();
  const [val, setVal] = useState<boolean>(dflt ?? false);
  useInput((input, key) => {
    if (key.escape || input === "q") {
      done({ cancelled: true });
      exit();
      return;
    }
    if (key.return) {
      done({ value: val });
      exit();
      return;
    }
    if (input === "y" || input === "Y") {
      done({ value: true });
      exit();
      return;
    }
    if (input === "n" || input === "N") {
      done({ value: false });
      exit();
      return;
    }
    if (key.leftArrow || key.rightArrow || input === "h" || input === "l") setVal((v) => !v);
  });
  return (
    <Box flexDirection="column" padding={1}>
      <Header title={prompt ?? "Confirm?"} hint="y/n · ←/→ toggle · enter confirm · esc/q cancel" />
      <Text>
        <Text color={val ? "green" : undefined} bold={val}>
          {val ? "▶ Yes" : "  Yes"}
        </Text>
        {"   "}
        <Text color={!val ? "red" : undefined} bold={!val}>
          {!val ? "▶ No" : "  No"}
        </Text>
      </Text>
    </Box>
  );
}

function Input({
  prompt,
  default: dflt,
  placeholder,
  mask,
}: {
  prompt?: string;
  default?: string;
  placeholder?: string;
  mask?: string;
}) {
  const { exit } = useApp();
  const [val, setVal] = useState(dflt ?? "");
  useInput((input, key) => {
    if (key.escape) {
      done({ cancelled: true });
      exit();
    }
  });
  return (
    <Box flexDirection="column" padding={1}>
      <Header
        title={prompt ?? "Enter text"}
        hint="enter confirm · ←/→ char · ctrl/alt-b/f word · ctrl-a/e start/end · ctrl-w/u/k kill · esc cancel"
      />
      <Box>
        <Text color="cyan">› </Text>
        <TextInput
          value={val}
          onChange={setVal}
          onSubmit={(v) => {
            done({ value: v });
            exit();
          }}
          focus
          placeholder={placeholder}
          mask={mask}
        />
      </Box>
    </Box>
  );
}

type Action = string;
function PreviewAction({
  title,
  content,
  actions,
  default: dflt,
  pageSize = 18,
}: {
  title?: string;
  content: string;
  actions?: Action[];
  default?: number;
  pageSize?: number;
}) {
  const { exit } = useApp();
  const acts = actions && actions.length > 0 ? actions : ["approve", "reject"];
  const lines = content.split("\n");
  const [offset, setOffset] = useState(0);
  const [focus, setFocus] = useState(Math.min(Math.max(0, dflt ?? 0), acts.length - 1));
  const maxOffset = Math.max(0, lines.length - pageSize);

  useInput((input, key) => {
    if (key.escape || input === "q") {
      done({ cancelled: true });
      exit();
      return;
    }
    if (key.return) {
      done({ action: acts[focus], index: focus });
      exit();
      return;
    }
    const firstLetters = acts.map((a) => a[0].toLowerCase());
    const allUnique = new Set(firstLetters).size === acts.length;
    if (allUnique && input) {
      const idx = firstLetters.indexOf(input.toLowerCase());
      if (idx >= 0) {
        done({ action: acts[idx], index: idx });
        exit();
        return;
      }
    }
    if (key.tab || key.rightArrow || input === "l")
      setFocus((f) => Math.min(acts.length - 1, f + 1));
    else if (key.leftArrow || input === "h") setFocus((f) => Math.max(0, f - 1));
    else if (input === "j" || key.downArrow) setOffset((o) => Math.min(maxOffset, o + 1));
    else if (input === "k" || key.upArrow) setOffset((o) => Math.max(0, o - 1));
    else if (key.pageDown || input === "f") setOffset((o) => Math.min(maxOffset, o + pageSize));
    else if (key.pageUp || input === "b") setOffset((o) => Math.max(0, o - pageSize));
    else if (input === "g") setOffset(0);
    else if (input === "G") setOffset(maxOffset);
  });

  const visible = lines.slice(offset, offset + pageSize);
  const lineColor = (l: string): string | undefined => {
    if (l.startsWith("+") && !l.startsWith("+++")) return "green";
    if (l.startsWith("-") && !l.startsWith("---")) return "red";
    if (l.startsWith("@@")) return "cyan";
    return undefined;
  };

  return (
    <Box flexDirection="column" padding={1}>
      <Header
        title={title ?? "Review"}
        hint="↑/↓ scroll · pgup/pgdn page · g/G top/bot · ←/→ or tab focus action · enter confirm · esc cancel"
      />
      <Box
        flexDirection="column"
        borderStyle="round"
        borderColor="gray"
        paddingX={1}
        height={pageSize + 2}
      >
        {visible.map((line, i) => (
          <Text key={i} color={lineColor(line)}>
            {line || " "}
          </Text>
        ))}
        {visible.length < pageSize &&
          Array.from({ length: pageSize - visible.length }, (_, i) => <Text key={`pad${i}`}> </Text>)}
      </Box>
      <Text dimColor>
        line {offset + 1}–{Math.min(lines.length, offset + pageSize)} of {lines.length}
      </Text>
      <Box marginTop={1}>
        {acts.map((a, i) => (
          <Text key={i} color={i === focus ? "cyan" : undefined} bold={i === focus}>
            {i === focus ? "▶ " : "  "}
            {a}
            {i < acts.length - 1 ? "   " : ""}
          </Text>
        ))}
      </Box>
    </Box>
  );
}

function Score({
  items,
  prompt,
  min = 1,
  max = 5,
  default: dflt,
}: {
  items: string[];
  prompt?: string;
  min?: number;
  max?: number;
  default?: number;
}) {
  const { exit } = useApp();
  const start = dflt ?? Math.round((min + max) / 2);
  const [scores, setScores] = useState<number[]>(items.map(() => start));
  const [cursor, setCursor] = useState(0);
  const clamp = (n: number) => Math.max(min, Math.min(max, n));
  const big = Math.max(1, Math.round((max - min) / 10));

  useInput((input, key) => {
    if (key.escape || input === "q") {
      done({ cancelled: true });
      exit();
      return;
    }
    if (key.return) {
      done({ scores: items.map((value, i) => ({ value, score: scores[i] })) });
      exit();
      return;
    }
    if (key.upArrow || input === "k") setCursor((c) => Math.max(0, c - 1));
    else if (key.downArrow || input === "j") setCursor((c) => Math.min(items.length - 1, c + 1));
    else if (key.leftArrow || input === "h" || input === "-")
      setScores((s) => s.map((v, i) => (i === cursor ? clamp(v - 1) : v)));
    else if (key.rightArrow || input === "l" || input === "+" || input === "=")
      setScores((s) => s.map((v, i) => (i === cursor ? clamp(v + 1) : v)));
    else if (input === "[")
      setScores((s) => s.map((v, i) => (i === cursor ? clamp(v - big) : v)));
    else if (input === "]")
      setScores((s) => s.map((v, i) => (i === cursor ? clamp(v + big) : v)));
    else if (input && /^[0-9]$/.test(input)) {
      const n = parseInt(input, 10);
      if (n >= min && n <= max)
        setScores((s) => s.map((v, i) => (i === cursor ? n : v)));
    }
  });

  const range = max - min;
  const renderBar = (v: number) => {
    if (range <= 9) return "★".repeat(v - min + 1) + "☆".repeat(max - v);
    const width = 20;
    const filled = Math.round(((v - min) / range) * width);
    return "█".repeat(filled) + "░".repeat(width - filled);
  };

  return (
    <Box flexDirection="column" padding={1}>
      <Header
        title={prompt ?? `Rate (${min}–${max})`}
        hint="↑/↓ select · ←/→ or h/l adjust · [/] big jump · digit set · enter confirm · esc cancel"
      />
      {items.map((item, i) => {
        const isCursor = i === cursor;
        return (
          <Text key={i} color={isCursor ? "cyan" : undefined}>
            {isCursor ? "▶ " : "  "}
            <Text color="yellow">{String(scores[i]).padStart(String(max).length)}</Text>{" "}
            <Text dimColor>{renderBar(scores[i])}</Text> {item}
          </Text>
        );
      })}
    </Box>
  );
}

type FieldSpec =
  | { name: string; type: "text"; label?: string; default?: string }
  | { name: string; type: "confirm"; label?: string; default?: boolean }
  | { name: string; type: "choose"; label?: string; items: string[]; default?: number }
  | { name: string; type: "multi"; label?: string; items: string[]; preselected?: number[] }
  | { name: string; type: "reorder"; label?: string; items: string[] }
  | {
      name: string;
      type: "score";
      label?: string;
      items: string[];
      min?: number;
      max?: number;
      default?: number;
    };

const LIST_FIELD_TYPES = new Set(["multi", "reorder", "score"]);

function MultiField({
  spec,
  value,
  onChange,
  onExit,
  isActive,
}: {
  spec: { items: string[] };
  value: string[];
  onChange: (v: string[]) => void;
  onExit: () => void;
  isActive: boolean;
}) {
  const [cursor, setCursor] = useState(0);
  useInput(
    (input, key) => {
      if (key.return || key.escape || key.tab) {
        onExit();
        return;
      }
      if (input === " ") {
        const sel = new Set(value);
        const item = spec.items[cursor];
        sel.has(item) ? sel.delete(item) : sel.add(item);
        onChange(spec.items.filter((it) => sel.has(it)));
        return;
      }
      if (input === "a") return onChange([...spec.items]);
      if (input === "n") return onChange([]);
      if (key.upArrow || input === "k") setCursor((c) => Math.max(0, c - 1));
      else if (key.downArrow || input === "j")
        setCursor((c) => Math.min(spec.items.length - 1, c + 1));
    },
    { isActive }
  );
  const sel = new Set(value);
  return (
    <Box flexDirection="column">
      {spec.items.map((item, i) => (
        <Text key={i} color={isActive && i === cursor ? "cyan" : undefined}>
          {isActive && i === cursor ? "▶ " : "  "}
          {sel.has(item) ? "[x] " : "[ ] "}
          {item}
        </Text>
      ))}
    </Box>
  );
}

function ReorderField({
  spec,
  value,
  onChange,
  onExit,
  isActive,
}: {
  spec: { items: string[] };
  value: string[];
  onChange: (v: string[]) => void;
  onExit: () => void;
  isActive: boolean;
}) {
  const [cursor, setCursor] = useState(0);
  const [grabbed, setGrabbed] = useState(false);
  useInput(
    (input, key) => {
      if (key.return || key.escape || key.tab) {
        setGrabbed(false);
        onExit();
        return;
      }
      if (input === " ") return setGrabbed((g) => !g);
      const move = (dir: -1 | 1) => {
        const next = cursor + dir;
        if (next < 0 || next >= value.length) return;
        if (grabbed) {
          const copy = [...value];
          [copy[cursor], copy[next]] = [copy[next], copy[cursor]];
          onChange(copy);
        }
        setCursor(next);
      };
      if (key.upArrow || input === "k") move(-1);
      else if (key.downArrow || input === "j") move(1);
    },
    { isActive }
  );
  return (
    <Box flexDirection="column">
      {value.map((item, i) => {
        const isCur = isActive && i === cursor;
        const color = isCur ? (grabbed ? "yellow" : "cyan") : undefined;
        const marker = isCur ? (grabbed ? "▶▶" : "▶ ") : "  ";
        return (
          <Text key={i} color={color}>
            {marker}
            {String(i + 1).padStart(2)}. {item}
          </Text>
        );
      })}
    </Box>
  );
}

function ScoreField({
  spec,
  value,
  onChange,
  onExit,
  isActive,
}: {
  spec: { items: string[]; min?: number; max?: number };
  value: number[];
  onChange: (v: number[]) => void;
  onExit: () => void;
  isActive: boolean;
}) {
  const min = spec.min ?? 1;
  const max = spec.max ?? 5;
  const [cursor, setCursor] = useState(0);
  const clamp = (n: number) => Math.max(min, Math.min(max, n));
  const big = Math.max(1, Math.round((max - min) / 10));
  useInput(
    (input, key) => {
      if (key.return || key.escape || key.tab) {
        onExit();
        return;
      }
      if (key.upArrow || input === "k") setCursor((c) => Math.max(0, c - 1));
      else if (key.downArrow || input === "j")
        setCursor((c) => Math.min(spec.items.length - 1, c + 1));
      else if (key.leftArrow || input === "h" || input === "-")
        onChange(value.map((v, i) => (i === cursor ? clamp(v - 1) : v)));
      else if (key.rightArrow || input === "l" || input === "+" || input === "=")
        onChange(value.map((v, i) => (i === cursor ? clamp(v + 1) : v)));
      else if (input === "[") onChange(value.map((v, i) => (i === cursor ? clamp(v - big) : v)));
      else if (input === "]") onChange(value.map((v, i) => (i === cursor ? clamp(v + big) : v)));
      else if (input && /^[0-9]$/.test(input)) {
        const n = parseInt(input, 10);
        if (n >= min && n <= max) onChange(value.map((v, i) => (i === cursor ? n : v)));
      }
    },
    { isActive }
  );
  const range = max - min;
  const renderBar = (v: number) => {
    if (range <= 9) return "★".repeat(v - min + 1) + "☆".repeat(max - v);
    const width = 16;
    const filled = Math.round(((v - min) / range) * width);
    return "█".repeat(filled) + "░".repeat(width - filled);
  };
  return (
    <Box flexDirection="column">
      {spec.items.map((item, i) => (
        <Text key={i} color={isActive && i === cursor ? "cyan" : undefined}>
          {isActive && i === cursor ? "▶ " : "  "}
          <Text color="yellow">{String(value[i]).padStart(String(max).length)}</Text>{" "}
          <Text dimColor>{renderBar(value[i])}</Text> {item}
        </Text>
      ))}
    </Box>
  );
}

function truncate(s: string, n: number): string {
  return s.length <= n ? s : s.slice(0, Math.max(0, n - 1)) + "…";
}

function compactSummary(f: FieldSpec, v: unknown, width: number): React.ReactElement {
  if (f.type === "text") {
    // Text rendering uses <TextInput> directly in renderSlot; this branch is
    // unused but kept for type completeness.
    const s = String(v ?? "");
    return (
      <Text>
        <Text color="cyan">› </Text>
        {s ? truncate(s, width) : <Text dimColor>(empty)</Text>}
      </Text>
    );
  }
  if (f.type === "confirm") {
    return (
      <Text color={v ? "green" : "red"} bold>
        {v ? "yes" : "no"}
      </Text>
    );
  }
  if (f.type === "choose") {
    const idx = f.items.indexOf(String(v));
    return (
      <Text>
        <Text color="yellow">{String(v)}</Text>{" "}
        <Text dimColor>
          ({idx + 1}/{f.items.length})
        </Text>
      </Text>
    );
  }
  if (f.type === "multi") {
    const sel = v as string[];
    const summary = sel.length === 0 ? "(none)" : truncate(sel.join(", "), width - 10);
    return (
      <Text>
        <Text color="yellow">{summary}</Text>{" "}
        <Text dimColor>
          ({sel.length}/{f.items.length})
        </Text>
      </Text>
    );
  }
  if (f.type === "reorder") {
    const ord = v as string[];
    return <Text color="yellow">{truncate(ord.join(" → "), width)}</Text>;
  }
  if (f.type === "score") {
    const arr = v as number[];
    const avg = arr.reduce((a, b) => a + b, 0) / arr.length;
    const min = f.min ?? 1;
    const max = f.max ?? 5;
    const range = max - min;
    let bars: string;
    if (range <= 9) {
      bars = arr.map((n) => "★".repeat(n - min + 1) + "☆".repeat(max - n)).join(" ");
    } else {
      bars = arr.map((n) => String(n)).join(" ");
    }
    return (
      <Text>
        <Text color="yellow">{truncate(bars, width - 10)}</Text>{" "}
        <Text dimColor>(avg {avg.toFixed(1)})</Text>
      </Text>
    );
  }
  return <Text>?</Text>;
}

function Form({ title, fields }: { title?: string; fields: FieldSpec[] }) {
  const { exit } = useApp();
  const [values, setValues] = useState<Record<string, unknown>>(() => {
    const v: Record<string, unknown> = {};
    for (const f of fields) {
      if (f.type === "text") v[f.name] = f.default ?? "";
      else if (f.type === "confirm") v[f.name] = f.default ?? false;
      else if (f.type === "choose")
        v[f.name] = f.items[Math.min(Math.max(0, f.default ?? 0), f.items.length - 1)];
      else if (f.type === "multi") {
        const sel = new Set(f.preselected ?? []);
        v[f.name] = f.items.filter((_, i) => sel.has(i));
      } else if (f.type === "reorder") v[f.name] = [...f.items];
      else if (f.type === "score") {
        const min = f.min ?? 1;
        const max = f.max ?? 5;
        const dflt = f.default ?? Math.round((min + max) / 2);
        v[f.name] = f.items.map(() => dflt);
      }
    }
    return v;
  });

  const SUBMIT = fields.length;
  const totalSlots = fields.length + 1;

  const [focus, setFocus] = useState(0);
  const [mode, setMode] = useState<"nav" | "edit">("nav");
  const [scrollOffset, setScrollOffset] = useState(0);

  const termRows = process.stdout.rows ?? 30;
  const termCols = process.stdout.columns ?? 80;
  // Outer padding 2 + header 3 + footer 2 = 7
  const bodyHeight = Math.max(6, termRows - 8);
  // Each field row uses 1 line + 1 marginTop (except first) → 2 lines per slot, last slot needs 1.
  // visible slots ≈ floor((bodyHeight + 1) / 2), capped at totalSlots
  const visibleSlots = Math.min(totalSlots, Math.max(1, Math.floor((bodyHeight + 1) / 2)));
  const summaryWidth = Math.max(20, termCols - 30);

  useEffect(() => {
    if (focus < scrollOffset) setScrollOffset(focus);
    else if (focus >= scrollOffset + visibleSlots)
      setScrollOffset(focus - visibleSlots + 1);
  }, [focus, visibleSlots, scrollOffset]);

  const cur = focus < fields.length ? fields[focus] : null;
  const curIsList = !!cur && LIST_FIELD_TYPES.has(cur.type);
  const navActive = mode === "nav";
  const setVal = (name: string, v: unknown) => setValues((s) => ({ ...s, [name]: v }));

  useInput(
    (input, key) => {
      if (key.escape) {
        done({ cancelled: true });
        exit();
        return;
      }
      if (key.tab && key.shift) {
        setFocus((f) => (f - 1 + totalSlots) % totalSlots);
        return;
      }
      if (key.tab) {
        setFocus((f) => (f + 1) % totalSlots);
        return;
      }
      if (key.upArrow) {
        setFocus((f) => Math.max(0, f - 1));
        return;
      }
      if (key.downArrow) {
        setFocus((f) => Math.min(totalSlots - 1, f + 1));
        return;
      }

      // Submit slot — enter submits, nothing else.
      if (focus === SUBMIT) {
        if (key.return) {
          done({ values });
          exit();
        }
        return;
      }

      const f = cur!;
      if (f.type === "text") {
        // TextInput owns char/cursor/enter handling for the focused text field;
        // parent only routes the keys it doesn't handle (tab/up/down/esc above).
        return;
      }
      if (f.type === "confirm") {
        if (key.return) {
          setFocus((x) => Math.min(totalSlots - 1, x + 1));
          return;
        }
        if (input === "y" || input === "Y") return setVal(f.name, true);
        if (input === "n" || input === "N") return setVal(f.name, false);
        if (input === " " || input === "h" || input === "l" || key.leftArrow || key.rightArrow)
          return setVal(f.name, !values[f.name]);
        return;
      }
      if (f.type === "choose") {
        if (key.return) {
          setFocus((x) => Math.min(totalSlots - 1, x + 1));
          return;
        }
        const idx = f.items.indexOf(String(values[f.name]));
        if (input === "h" || key.leftArrow) {
          const next = (idx - 1 + f.items.length) % f.items.length;
          return setVal(f.name, f.items[next]);
        }
        if (input === "l" || key.rightArrow || input === " ") {
          const next = (idx + 1) % f.items.length;
          return setVal(f.name, f.items[next]);
        }
        return;
      }
      if (curIsList && key.return) {
        setMode("edit");
        return;
      }
    },
    { isActive: navActive }
  );

  // ------------- render --------------
  const navHint =
    "tab/↑↓ move · enter advance or edit list · type to edit · tab to Submit to confirm · esc cancel";
  function editHintFor(f: FieldSpec | null): string {
    const back = "enter/esc/tab leave field";
    if (!f) return back;
    if (f.type === "multi")
      return `space toggle · a all · n none · ↑/↓ or j/k move · ${back}`;
    if (f.type === "reorder")
      return `space grab/drop · ↑/↓ or j/k move · ${back}`;
    if (f.type === "score")
      return `↑/↓ or j/k select · ←/→ or h/l adjust · digit set · [/] big jump · ${back}`;
    return back;
  }

  function renderSlot(i: number): React.ReactElement {
    const isFocus = i === focus;
    const margin = i > scrollOffset ? 1 : 0;
    if (i === SUBMIT) {
      return (
        <Box key="submit" marginTop={margin} flexDirection="row">
          <Text color={isFocus ? "green" : "gray"} bold={isFocus}>
            {isFocus ? "▶ " : "  "}[ Submit ]
          </Text>
          {isFocus && <Text dimColor>  press enter to confirm</Text>}
        </Box>
      );
    }
    const f = fields[i];
    const label = (f.label ?? f.name).padEnd(14);
    const v = values[f.name];
    if (f.type === "text") {
      return (
        <Box key={f.name} marginTop={margin} flexDirection="row">
          <Text color={isFocus ? "cyan" : undefined} bold={isFocus}>
            {isFocus ? "▶ " : "  "}
            {label}
          </Text>
          <Text color="cyan">› </Text>
          <TextInput
            value={String(v ?? "")}
            onChange={(nv) => setVal(f.name, nv)}
            onSubmit={() => setFocus((x) => Math.min(totalSlots - 1, x + 1))}
            focus={isFocus && navActive}
          />
        </Box>
      );
    }
    return (
      <Box key={f.name} marginTop={margin} flexDirection="row">
        <Text color={isFocus ? "cyan" : undefined} bold={isFocus}>
          {isFocus ? "▶ " : "  "}
          {label}
        </Text>
        {compactSummary(f, v, summaryWidth)}
      </Box>
    );
  }

  const visibleStart = scrollOffset;
  const visibleEnd = Math.min(totalSlots, scrollOffset + visibleSlots);

  return (
    <Box flexDirection="column" padding={1}>
      <Box flexDirection="column">
        <Text bold>{title ?? "Form"}</Text>
        <Text dimColor>{mode === "edit" ? editHintFor(cur) : navHint}</Text>
      </Box>
      <Box marginTop={1} flexDirection="column" height={bodyHeight}>
        {mode === "nav" ? (
          <Box flexDirection="column">
            {visibleStart > 0 && (
              <Text dimColor>
                ↑ {visibleStart} more above
              </Text>
            )}
            {Array.from({ length: visibleEnd - visibleStart }, (_, k) =>
              renderSlot(visibleStart + k)
            )}
            {visibleEnd < totalSlots && (
              <Text dimColor>
                ↓ {totalSlots - visibleEnd} more below
              </Text>
            )}
          </Box>
        ) : (
          <Box flexDirection="column">
            <Text bold color="cyan">
              ▣ Editing: {cur?.label ?? cur?.name}
            </Text>
            <Box marginTop={1} flexDirection="column">
              {cur?.type === "multi" && (
                <MultiField
                  spec={cur}
                  value={values[cur.name] as string[]}
                  onChange={(nv) => setVal(cur.name, nv)}
                  onExit={() => setMode("nav")}
                  isActive={true}
                />
              )}
              {cur?.type === "reorder" && (
                <ReorderField
                  spec={cur}
                  value={values[cur.name] as string[]}
                  onChange={(nv) => setVal(cur.name, nv)}
                  onExit={() => setMode("nav")}
                  isActive={true}
                />
              )}
              {cur?.type === "score" && (
                <ScoreField
                  spec={cur}
                  value={values[cur.name] as number[]}
                  onChange={(nv) => setVal(cur.name, nv)}
                  onExit={() => setMode("nav")}
                  isActive={true}
                />
              )}
            </Box>
          </Box>
        )}
      </Box>
      <Box marginTop={1} flexDirection="column">
        <Text dimColor>
          {mode === "nav"
            ? `${focus + 1}/${totalSlots}${focus === SUBMIT ? " · Submit" : ""}`
            : "in field"}
        </Text>
      </Box>
    </Box>
  );
}

const components: Record<string, () => React.ReactElement> = {
  reorder: () => <Reorder {...spec} />,
  choose: () => <Choose {...spec} />,
  multi: () => <Multi {...spec} />,
  confirm: () => <Confirm {...spec} />,
  input: () => <Input {...spec} />,
  preview: () => <PreviewAction {...spec} />,
  score: () => <Score {...spec} />,
  form: () => <Form {...spec} />,
};

const Comp = components[subcmd];
if (!Comp) {
  console.error(`unknown subcmd: ${subcmd}. one of: ${Object.keys(components).join(", ")}`);
  process.exit(2);
}
render(Comp());
