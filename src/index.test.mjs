import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { stripVTControlCharacters as stripAnsi } from "node:util";
import { CustomEditor } from "@earendil-works/pi-coding-agent";
import { getKeybindings, matchesKey, visibleWidth } from "@earendil-works/pi-tui";

// Keep the real editor/width utilities; intercept only the clipboard export.
const hostURL = import.meta.resolve("@earendil-works/pi-coding-agent");
const clipboardKey = "__piCopyPromptTestClipboard";
let clipboardCalls = [];
globalThis[clipboardKey] = async (text) => { clipboardCalls.push(text); };
const hooks = registerHooks({
  resolve(specifier, context, next) {
    if (specifier === "@earendil-works/pi-coding-agent") {
      return { url: "copy-prompt:mock-host", shortCircuit: true };
    }
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url === "copy-prompt:mock-host") {
      return {
        format: "module", shortCircuit: true,
        source: `export * from ${JSON.stringify(hostURL)}; export const copyToClipboard = (text) => globalThis[${JSON.stringify(clipboardKey)}](text);`,
      };
    }
    return next(url, context);
  },
});
const { fitBorder, default: extensionFactory } = await import("./index.ts");
hooks.deregister();

const instances = [];
afterEach(() => {
  for (const pi of instances.splice(0)) pi.handlers.session_shutdown({}, pi.ctx);
  clipboardCalls = [];
  globalThis[clipboardKey] = async (text) => { clipboardCalls.push(text); };
});

function makeHarness(mode = "tui") {
  const handlers = {};
  const shortcuts = [];
  const tui = { terminal: { rows: 24, columns: 80 }, renders: 0, requestRender() { this.renders++; } };
  const identity = (s) => s;
  const editorTheme = {
    borderColor: identity,
    selectList: Object.fromEntries(["selectedPrefix", "selectedText", "description", "scrollInfo", "noMatch"].map((key) => [key, identity])),
  };
  const keybindings = {
    matches(data, action) {
      const app = { "app.interrupt": "escape", "app.exit": "ctrl+d", "app.clear": "ctrl+c" };
      return app[action] ? matchesKey(data, app[action]) : getKeybindings().matches(data, action);
    },
  };
  const ctx = {
    mode,
    ui: {
      theme: { fg: (_color, text) => text },
      notifications: [],
      factories: [],
      notify(text, level) { this.notifications.push({ text, level }); },
      setEditorComponent(factory) {
        this.factories.push(factory);
        this.editor = factory(tui, editorTheme, keybindings);
      },
    },
  };
  const pi = {
    ctx, tui, handlers, shortcuts,
    on(event, handler) { handlers[event] = handler; },
    registerShortcut(key, shortcut) { shortcuts.push({ key, ...shortcut }); },
    start(newCtx = ctx) { handlers.session_start({}, newCtx); },
    copy(copyCtx = ctx) { return shortcuts[0].handler(copyCtx); },
    get editor() { return ctx.ui.editor; },
    replace() { ctx.ui.setEditorComponent(ctx.ui.factories.at(-1)); },
  };
  extensionFactory(pi);
  instances.push(pi);
  pi.start();
  return pi;
}

function copied(editor) { return stripAnsi(editor.render(80).at(-1)).includes("prompt copied"); }
function deferredClipboard() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  globalThis[clipboardKey] = async (text) => { clipboardCalls.push(text); await promise; };
  return { resolve, reject };
}

test("only super+y and session lifecycle are registered; no commands", () => {
  const pi = makeHarness();
  assert.deepEqual(Object.keys(pi.handlers), ["session_start", "session_shutdown"]);
  assert.equal(pi.shortcuts.length, 1);
  assert.equal(pi.shortcuts[0].key, "super+y");
  assert.ok(pi.editor instanceof CustomEditor);
  assert.match(stripAnsi(pi.editor.render(80).at(-1)), /⌘Y \(copy prompt\)/);
});

test("borders fit ANSI, combining, emoji and wide text at every narrow width", () => {
  const color = (text) => `\x1b[31m${text}\x1b[0m`;
  for (const [left, right] of [["", " ⌘Y (copy prompt) "], [color("界👩‍💻é"), color("✓ 界👨‍👩‍👧‍👦")]]) {
    for (let width = -1; width <= 90; width++) {
      const result = fitBorder(left, right, width, color);
      assert.equal(visibleWidth(result), Math.max(0, width), `width=${width}`);
    }
  }
});

test("editor rendering and resize preserve base lines and fit the replaced border", () => {
  const pi = makeHarness();
  pi.editor.focused = true;
  for (const text of ["synthetic ascii\nsecond line", "synthetic 界👩‍💻é\nsecond line\nthird line"]) {
    pi.editor.setText(text);
    for (const rows of [4, 24, 50]) {
      pi.tui.terminal.rows = rows;
      for (const width of (text.includes("界") ? [3, 4, 8, 16, 40, 80] : [1, 2, 3, 4, 8, 16, 40, 80])) {
        const actual = pi.editor.render(width);
        const base = CustomEditor.prototype.render.call(pi.editor, width);
        assert.deepEqual(actual.slice(0, -1), base.slice(0, -1));
        assert.equal(visibleWidth(actual.at(-1)), width);
      }
    }
  }
});

test("autocomplete suggestions remain below the hint and can be accepted", async () => {
  const pi = makeHarness();
  pi.editor.setAutocompleteProvider({
    async getSuggestions() { return { prefix: "/", items: [{ value: "/synthetic", label: "synthetic completion" }] }; },
    applyCompletion(_lines, _line, _col, item) {
      return { lines: [item.value], cursorLine: 0, cursorCol: item.value.length };
    },
  });
  pi.editor.handleInput("/");
  await new Promise((resolve) => setImmediate(resolve));
  assert.ok(pi.editor.isShowingAutocomplete());
  const lines = pi.editor.render(80).map(stripAnsi);
  const hint = lines.findIndex((line) => line.includes("⌘Y (copy prompt)"));
  const suggestion = lines.findIndex((line) => line.includes("synthetic completion"));
  assert.ok(hint >= 0 && suggestion > hint);
  pi.editor.handleInput("\t");
  assert.equal(pi.editor.getText(), "/synthetic");
});

test("documents inherited host failure for wide graphemes at one-column layout", () => {
  const pi = makeHarness();
  pi.editor.setText("界");
  for (const width of [1, 2]) {
    assert.throws(() => CustomEditor.prototype.render.call(pi.editor, width), RangeError);
    assert.throws(() => pi.editor.render(width), RangeError);
  }
});

test("copies exact non-empty draft including surrounding whitespace without submitting", async () => {
  const pi = makeHarness();
  let submits = 0;
  pi.editor.onSubmit = () => { submits++; };
  pi.editor.setText("  synthetic draft 界\nlast line  ");
  await pi.copy();
  assert.deepEqual(clipboardCalls, ["  synthetic draft 界\nlast line  "]);
  assert.equal(pi.editor.getText(), clipboardCalls[0]);
  assert.equal(submits, 0);
  assert.ok(copied(pi.editor));
});

test("large bracketed paste copies full expansion, not collapsed markers", async () => {
  const pi = makeHarness();
  const paste = Array.from({ length: 24 }, (_, i) => `synthetic line ${i} 界`).join("\n");
  pi.editor.handleInput(`\x1b[200~${paste}\x1b[201~`);
  assert.match(pi.editor.getText(), /\[paste #1/);
  await pi.copy();
  assert.deepEqual(clipboardCalls, [paste]);
  assert.equal(pi.editor.getExpandedText(), paste);
});

test("empty and whitespace-only drafts do not call clipboard", async () => {
  const pi = makeHarness();
  for (const text of ["", "  \n  "]) {
    pi.editor.setText(text);
    await pi.copy();
    assert.equal(copied(pi.editor), false);
  }
  assert.deepEqual(clipboardCalls, []);
  assert.deepEqual(pi.ctx.ui.notifications.map((n) => n.level), ["info", "info"]);
});

test("clipboard rejection is handled with no success, including a previous confirmation", async () => {
  const pi = makeHarness();
  pi.editor.setText("synthetic");
  await pi.copy();
  assert.ok(copied(pi.editor));
  globalThis[clipboardKey] = async () => { throw new Error("synthetic private failure detail"); };
  await assert.doesNotReject(pi.copy());
  assert.equal(copied(pi.editor), false);
  assert.deepEqual(pi.ctx.ui.notifications, [{ text: "Could not copy prompt to clipboard", level: "error" }]);
});

test("confirmation lasts two seconds and repeated copying restarts its timer", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const pi = makeHarness();
  pi.editor.setText("synthetic");
  await pi.copy();
  t.mock.timers.tick(1999);
  assert.ok(copied(pi.editor));
  await pi.copy();
  t.mock.timers.tick(1);
  assert.ok(copied(pi.editor));
  t.mock.timers.tick(1999);
  assert.equal(copied(pi.editor), false);
});

test("input, cursor movement, setText and insertion clear confirmation and cancel reset", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const pi = makeHarness();
  for (const change of [
    () => pi.editor.handleInput("x"),
    () => pi.editor.handleInput("\x1b[D"),
    () => pi.editor.setText("new synthetic"),
    () => pi.editor.insertTextAtCursor(" addition"),
  ]) {
    pi.editor.setText("synthetic");
    await pi.copy();
    change();
    assert.equal(copied(pi.editor), false);
    const renders = pi.tui.renders;
    t.mock.timers.tick(2000);
    assert.equal(pi.tui.renders, renders);
  }
});

test("theme changes are read at render time, including success feedback", async () => {
  const pi = makeHarness();
  pi.ctx.ui.theme = { fg: (_color, text) => `\x1b[31m${text}\x1b[0m` };
  assert.ok(pi.editor.render(80).at(-1).includes("\x1b[31m"));
  pi.ctx.ui.theme = { fg: (_color, text) => `\x1b[32m${text}\x1b[0m` };
  pi.editor.setText("synthetic");
  await pi.copy();
  assert.ok(pi.editor.render(80).at(-1).includes("\x1b[32m"));
  assert.ok(!pi.editor.render(80).at(-1).includes("\x1b[31m"));
});

test("inherited editing, yank, interrupt, clear and exit controls remain callable", () => {
  const pi = makeHarness();
  let interrupts = 0, exits = 0, clears = 0;
  pi.editor.onEscape = () => { interrupts++; };
  pi.editor.onCtrlD = () => { exits++; };
  pi.editor.onAction("app.clear", () => { clears++; pi.editor.setText(""); });
  pi.editor.setText("synthetic");
  pi.editor.handleInput("\x01"); // Ctrl+A
  pi.editor.handleInput("X");
  assert.equal(pi.editor.getText(), "Xsynthetic");
  pi.editor.handleInput("\x05"); // Ctrl+E
  pi.editor.handleInput("\x15"); // Ctrl+U
  assert.equal(pi.editor.getText(), "");
  pi.editor.handleInput("\x19"); // Ctrl+Y remains yank
  assert.equal(pi.editor.getText(), "Xsynthetic");
  pi.editor.handleInput("\x1b");
  assert.equal(interrupts, 1);
  pi.editor.handleInput("\x03");
  pi.editor.handleInput("\x04");
  assert.equal(clears, 1);
  assert.equal(exits, 1);
  assert.deepEqual(clipboardCalls, []);
});

test("idempotent disposal/shutdown cancels timer and all late rendering", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const pi = makeHarness();
  pi.editor.setText("synthetic");
  await pi.copy();
  pi.editor.dispose();
  pi.editor.dispose();
  const renders = pi.tui.renders;
  t.mock.timers.tick(5000);
  pi.editor.showCopied();
  await pi.copy();
  pi.handlers.session_shutdown({}, pi.ctx);
  pi.handlers.session_shutdown({}, pi.ctx);
  assert.equal(pi.tui.renders, renders);
  assert.equal(clipboardCalls.length, 1);
});

for (const replacement of ["factory replacement", "session switching", "shutdown"]) {
  test(`late clipboard success cannot confirm after ${replacement}`, async () => {
    const pi = makeHarness();
    const old = pi.editor;
    old.setText("synthetic pending");
    const pending = deferredClipboard();
    const copying = pi.copy();
    if (replacement === "factory replacement") pi.replace();
    else if (replacement === "session switching") { pi.handlers.session_shutdown({}, pi.ctx); pi.start(); }
    else pi.handlers.session_shutdown({}, pi.ctx);
    const renders = pi.tui.renders;
    pending.resolve();
    await copying;
    assert.ok(old.disposed);
    assert.equal(copied(old), false);
    assert.equal(copied(pi.editor), false);
    assert.equal(pi.tui.renders, renders);
  });
}

test("late rejection after a session switch does not notify the replacement", async () => {
  const pi = makeHarness();
  pi.editor.setText("synthetic pending");
  const pending = deferredClipboard();
  const copying = pi.copy();
  pi.handlers.session_shutdown({}, pi.ctx);
  pi.start();
  pending.reject(new Error("synthetic"));
  await copying;
  assert.deepEqual(pi.ctx.ui.notifications, []);
  pi.editor.setText("new synthetic");
  globalThis[clipboardKey] = async (text) => { clipboardCalls.push(text); };
  await pi.copy();
  assert.ok(copied(pi.editor));
});

test("a repeated session_start disposes the prior editor and confirmation timer", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const pi = makeHarness();
  pi.editor.setText("synthetic");
  await pi.copy();
  const old = pi.editor;
  pi.start();
  const renders = pi.tui.renders;
  t.mock.timers.tick(5000);
  assert.ok(old.disposed);
  assert.equal(pi.tui.renders, renders);
  assert.equal(copied(pi.editor), false);
});

for (const mode of ["rpc", "json", "print"]) {
  test(`${mode} mode never installs an editor, calls clipboard or notifies`, async () => {
    const pi = makeHarness(mode);
    await pi.copy();
    assert.deepEqual(pi.ctx.ui.factories, []);
    assert.deepEqual(pi.ctx.ui.notifications, []);
    assert.deepEqual(clipboardCalls, []);
  });
}

test("a TUI to non-TUI transition invalidates the editor and shortcut", async () => {
  const pi = makeHarness();
  pi.editor.setText("synthetic");
  const old = pi.editor;
  pi.start({ ...pi.ctx, mode: "rpc" });
  await pi.copy();
  assert.ok(old.disposed);
  assert.deepEqual(clipboardCalls, []);
});
