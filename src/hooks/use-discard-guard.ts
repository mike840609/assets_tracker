"use client";

import { useCallback, useState } from "react";

/**
 * Guards an unsaved form against accidental dismissal (swipe-down, backdrop tap,
 * Escape, or Cancel). When the form is dirty, a close request opens a
 * confirmation instead of closing; when it's clean, it closes immediately.
 *
 * `onClose` is the "real" close (parent close + any reset). Wire `requestClose`
 * to every dismiss affordance, drive an AlertDialog with `confirmOpen` /
 * `setConfirmOpen`, and call `confirmDiscard` from its destructive action.
 */
export function useDiscardGuard(isDirty: boolean, onClose: () => void) {
  const [confirmOpen, setConfirmOpen] = useState(false);

  const requestClose = useCallback(() => {
    if (isDirty) {
      setConfirmOpen(true);
    } else {
      onClose();
    }
  }, [isDirty, onClose]);

  const confirmDiscard = useCallback(() => {
    setConfirmOpen(false);
    onClose();
  }, [onClose]);

  return { confirmOpen, setConfirmOpen, requestClose, confirmDiscard };
}
