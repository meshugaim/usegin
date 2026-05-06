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

const components: Record<string, () => React.ReactElement> = {
  reorder: () => <Reorder {...spec} />,
  choose: () => <Choose {...spec} />,
  multi: () => <Multi {...spec} />,
  confirm: () => <Confirm {...spec} />,
  input: () => <Input {...spec} />,
};

const Comp = components[subcmd];
if (!Comp) {
  console.error(`unknown subcmd: ${subcmd}. one of: ${Object.keys(components).join(", ")}`);
  process.exit(2);
}
render(Comp());
