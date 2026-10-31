/** Copy the expanded editor draft with super+y and show brief border feedback. */
import {
  CustomEditor,
  copyToClipboard,
  type ExtensionAPI,
  type KeybindingsManager,
  type Theme,
} from "@earendil-works/pi-coding-agent";
import {
  Key,
  truncateToWidth,
  visibleWidth,
  type EditorTheme,
  type TUI,
} from "@earendil-works/pi-tui";

export function fitBorder(
  left: string,
  right: string,
  width: number,
  border: (text: string) => string,
  fill: (text: string) => string = border,
): string {
  if (width <= 0) return "";
  if (width === 1) return border("─");

  let leftText = left;
  let rightText = right;
  const fixedWidth = 2;
  const minimumGap = 3;

  while (
    fixedWidth + visibleWidth(leftText) + visibleWidth(rightText) + minimumGap > width &&
    visibleWidth(rightText) > 0
  ) {
    rightText = truncateToWidth(rightText, Math.max(0, visibleWidth(rightText) - 1), "");
  }
  while (
    fixedWidth + visibleWidth(leftText) + visibleWidth(rightText) + minimumGap > width &&
    visibleWidth(leftText) > 0
  ) {
    leftText = truncateToWidth(leftText, Math.max(0, visibleWidth(leftText) - 1), "");
  }

  const gapWidth = Math.max(0, width - fixedWidth - visibleWidth(leftText) - visibleWidth(rightText));
  return `${border("─")}${leftText}${fill("─".repeat(gapWidth))}${rightText}${border("─")}`;
}

class CopyPromptEditor extends CustomEditor {
  private readonly _tui: TUI;
  private readonly _getTheme: () => Theme;
  private _copied = false;
  private _resetTimer: ReturnType<typeof setTimeout> | undefined;
  disposed = false;

  constructor(tui: TUI, theme: EditorTheme, keybindings: KeybindingsManager, getTheme: () => Theme) {
    super(tui, theme, keybindings);
    this._tui = tui;
    this._getTheme = getTheme;
  }

  showCopied(): void {
    if (this.disposed) return;
    this._copied = true;
    if (this._resetTimer !== undefined) clearTimeout(this._resetTimer);
    this._resetTimer = setTimeout(() => {
      this._resetTimer = undefined;
      this._copied = false;
      this._tui.requestRender();
    }, 2000);
    this._tui.requestRender();
  }

  clearCopied(): void {
    if (this._resetTimer !== undefined) {
      clearTimeout(this._resetTimer);
      this._resetTimer = undefined;
    }
    if (!this._copied) return;
    this._copied = false;
    if (!this.disposed) this._tui.requestRender();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.clearCopied();
  }

  protected renderBottomBorder(width: number): string {
    const theme = this._getTheme();
    const label = this._copied
      ? theme.fg("accent", " prompt copied ")
      : theme.fg("muted", " ⌘Y (copy prompt) ");
    return fitBorder("", label, width, (text) => this.borderColor(text));
  }

  handleInput(data: string): void { super.handleInput(data); this.clearCopied(); }
  setText(text: string): void { super.setText(text); this.clearCopied(); }
  insertTextAtCursor(text: string): void { super.insertTextAtCursor(text); this.clearCopied(); }
}

export default function (pi: ExtensionAPI) {
  let editorRef: CopyPromptEditor | undefined;

  pi.on("session_start", (_event, ctx) => {
    editorRef?.dispose();
    editorRef = undefined;
    if (ctx.mode !== "tui") return;

    ctx.ui.setEditorComponent((tui, theme, keybindings) => {
      editorRef?.dispose();
      const editor = new CopyPromptEditor(tui, theme, keybindings, () => ctx.ui.theme);
      editorRef = editor;
      return editor;
    });
  });

  pi.on("session_shutdown", () => {
    editorRef?.dispose();
    editorRef = undefined;
  });

  pi.registerShortcut(Key.super("y"), {
    description: "Copy current prompt to clipboard",
    handler: async (ctx) => {
      if (ctx.mode !== "tui") return;
      const editor = editorRef;
      if (!editor || editor.disposed) return;
      const text = editor.getExpandedText();
      editor.clearCopied();
      if (!text.trim()) {
        ctx.ui.notify("Nothing to copy — editor is empty", "info");
        return;
      }
      try {
        await copyToClipboard(text);
      } catch {
        if (editorRef === editor && !editor.disposed) {
          ctx.ui.notify("Could not copy prompt to clipboard", "error");
        }
        return;
      }
      // A clipboard operation can finish after shutdown or editor/session replacement.
      if (editorRef === editor && !editor.disposed) editor.showCopied();
    },
  });
}
