import { toast } from "sonner";

export function showUndoDeleteToast({
  message,
  undoLabel,
  onCommit,
  onUndo,
  duration = 5000,
}: {
  message: string;
  undoLabel: string;
  onCommit: () => void | Promise<void>;
  onUndo: () => void;
  duration?: number;
}): void {
  let undone = false;
  toast(message, {
    duration,
    action: {
      label: undoLabel,
      onClick: () => {
        undone = true;
        onUndo();
      },
    },
    // Both callbacks fire on close; the undone flag prevents double-commit
    // when Sonner auto-closes after the action button is clicked.
    onAutoClose: () => { if (!undone) onCommit(); },
    onDismiss:   () => { if (!undone) onCommit(); },
  });
}
