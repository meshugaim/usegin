import React, { useState } from "react";
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

function Input({ prompt, default: dflt }: { prompt?: string; default?: string }) {
  const { exit } = useApp();
  const [val, setVal] = useState(dflt ?? "");
  useInput((input, key) => {
    if (key.escape) {
      done({ cancelled: true });
      exit();
      return;
    }
    if (key.return) {
      done({ value: val });
      exit();
      return;
    }
    if (key.backspace || key.delete) {
      setVal((v) => v.slice(0, -1));
      return;
    }
    if (key.ctrl && input === "u") {
      setVal("");
      return;
    }
    if (input && !key.ctrl && !key.meta) setVal((v) => v + input);
  });
  return (
    <Box flexDirection="column" padding={1}>
      <Header title={prompt ?? "Enter text"} hint="enter confirm · ctrl-u clear · esc cancel" />
      <Text>
        <Text color="cyan">› </Text>
        {val}
        <Text color="cyan">▌</Text>
      </Text>
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
  | { name: string; type: "choose"; label?: string; items: string[]; default?: number };

function Form({ title, fields }: { title?: string; fields: FieldSpec[] }) {
  const { exit } = useApp();
  const [values, setValues] = useState<Record<string, unknown>>(() => {
    const v: Record<string, unknown> = {};
    for (const f of fields) {
      if (f.type === "text") v[f.name] = f.default ?? "";
      else if (f.type === "confirm") v[f.name] = f.default ?? false;
      else if (f.type === "choose")
        v[f.name] = f.items[Math.min(Math.max(0, f.default ?? 0), f.items.length - 1)];
    }
    return v;
  });
  const [focus, setFocus] = useState(0);
  const cur = fields[focus];

  useInput((input, key) => {
    if (key.escape) {
      done({ cancelled: true });
      exit();
      return;
    }
    if (key.return) {
      done({ values });
      exit();
      return;
    }
    if (key.tab && key.shift) {
      setFocus((f) => (f - 1 + fields.length) % fields.length);
      return;
    }
    if (key.tab) {
      setFocus((f) => (f + 1) % fields.length);
      return;
    }
    if (cur.type === "text") {
      if (key.backspace || key.delete) {
        setValues((v) => ({ ...v, [cur.name]: String(v[cur.name] ?? "").slice(0, -1) }));
        return;
      }
      if (key.ctrl && input === "u") {
        setValues((v) => ({ ...v, [cur.name]: "" }));
        return;
      }
      if (key.upArrow) {
        setFocus((f) => (f - 1 + fields.length) % fields.length);
        return;
      }
      if (key.downArrow) {
        setFocus((f) => (f + 1) % fields.length);
        return;
      }
      if (input && !key.ctrl && !key.meta)
        setValues((v) => ({ ...v, [cur.name]: String(v[cur.name] ?? "") + input }));
      return;
    }
    if (cur.type === "confirm") {
      if (input === "y" || input === "Y") {
        setValues((v) => ({ ...v, [cur.name]: true }));
        return;
      }
      if (input === "n" || input === "N") {
        setValues((v) => ({ ...v, [cur.name]: false }));
        return;
      }
      if (input === " " || input === "h" || input === "l" || key.leftArrow || key.rightArrow) {
        setValues((v) => ({ ...v, [cur.name]: !v[cur.name] }));
        return;
      }
      if (key.upArrow) setFocus((f) => (f - 1 + fields.length) % fields.length);
      if (key.downArrow) setFocus((f) => (f + 1) % fields.length);
      return;
    }
    if (cur.type === "choose") {
      const idx = cur.items.indexOf(String(values[cur.name]));
      if (input === "h" || key.leftArrow) {
        const next = (idx - 1 + cur.items.length) % cur.items.length;
        setValues((v) => ({ ...v, [cur.name]: cur.items[next] }));
        return;
      }
      if (input === "l" || key.rightArrow || input === " ") {
        const next = (idx + 1) % cur.items.length;
        setValues((v) => ({ ...v, [cur.name]: cur.items[next] }));
        return;
      }
      if (key.upArrow) setFocus((f) => (f - 1 + fields.length) % fields.length);
      if (key.downArrow) setFocus((f) => (f + 1) % fields.length);
      return;
    }
  });

  return (
    <Box flexDirection="column" padding={1}>
      <Header
        title={title ?? "Form"}
        hint="tab/↑↓ next field · enter submit · esc cancel · field-specific keys below"
      />
      {fields.map((f, i) => {
        const isFocus = i === focus;
        const label = f.label ?? f.name;
        const v = values[f.name];
        let display: React.ReactElement;
        if (f.type === "text") {
          display = (
            <Text>
              <Text color="cyan">› </Text>
              {String(v ?? "")}
              {isFocus ? <Text color="cyan">▌</Text> : null}
            </Text>
          );
        } else if (f.type === "confirm") {
          display = (
            <Text>
              <Text color={v ? "green" : undefined} bold={!!v}>
                {v ? "[x] yes" : "[ ] yes"}
              </Text>{" "}
              <Text color={!v ? "red" : undefined} bold={!v}>
                {!v ? "[x] no" : "[ ] no"}
              </Text>
            </Text>
          );
        } else {
          const idx = f.items.indexOf(String(v));
          display = (
            <Text>
              <Text dimColor>{idx > 0 ? "‹ " : "  "}</Text>
              <Text color="yellow">{String(v)}</Text>
              <Text dimColor>{idx < f.items.length - 1 ? " ›" : "  "}</Text>{" "}
              <Text dimColor>
                ({idx + 1}/{f.items.length})
              </Text>
            </Text>
          );
        }
        return (
          <Box key={f.name} flexDirection="row">
            <Text color={isFocus ? "cyan" : undefined} bold={isFocus}>
              {isFocus ? "▶ " : "  "}
              {label.padEnd(14)}
            </Text>
            {display}
          </Box>
        );
      })}
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
