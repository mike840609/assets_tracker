import { useCallback, useRef } from "react";

/**
 * A view toggle rendered inside the view it swaps unmounts on every switch,
 * dropping keyboard focus to <body>. Call `markSwitch` when the view changes and
 * put `ref` on an element wrapping the toggle: when the new view's toggle mounts
 * (immediately, or after its lazy chunk loads), focus moves to the pressed button.
 */
export function useRefocusPressed() {
  const pending = useRef(false);

  const ref = useCallback((node: HTMLElement | null) => {
    if (!node || !pending.current) return;
    pending.current = false;
    node.querySelector<HTMLButtonElement>('[aria-pressed="true"]')?.focus();
  }, []);

  const markSwitch = useCallback(() => {
    pending.current = true;
  }, []);

  return { ref, markSwitch };
}
