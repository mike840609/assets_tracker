"use client";

import { useCallback, useMemo, useState } from "react";

type FormattedNumberInputOptions = {
  initialValue?: string | number | (() => string | number);
  maximumFractionDigits?: number;
  integer?: boolean;
  min?: number;
  emptyValueOnBlur?: string;
  onValid?: () => void;
  onInvalid?: (message?: string) => void;
  invalidMessage?: string;
};

function toInitialString(value: string | number | (() => string | number) | undefined) {
  const resolved = typeof value === "function" ? value() : value;
  return resolved === undefined ? "" : String(resolved);
}

export function stripNumberFormatting(value: string) {
  return value.replace(/,/g, "");
}

export function parseFormattedNumber(value: string) {
  const raw = stripNumberFormatting(value);
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isNaN(parsed) ? null : parsed;
}

export function formatNumberInputValue(
  value: number,
  options?: { maximumFractionDigits?: number; integer?: boolean },
) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: options?.integer ? 0 : options?.maximumFractionDigits,
  }).format(value);
}

export function useFormattedNumberInput({
  initialValue,
  maximumFractionDigits = 6,
  integer = false,
  min,
  emptyValueOnBlur,
  onValid,
  onInvalid,
  invalidMessage,
}: FormattedNumberInputOptions = {}) {
  const [value, setValue] = useState(() => toInitialString(initialValue));

  const numberValue = useMemo(() => parseFormattedNumber(value), [value]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = stripNumberFormatting(e.target.value);
      const validShape = integer ? /^\d*$/.test(raw) : /^\d*\.?\d*$/.test(raw);
      if (raw !== "" && !validShape) return;

      onValid?.();
      if (!raw) {
        setValue("");
        return;
      }

      const [intPart, decPart] = raw.split(".");
      const formatted = (intPart || "").replace(/\B(?=(\d{3})+(?!\d))/g, ",");
      setValue(decPart !== undefined && !integer ? `${formatted}.${decPart}` : formatted);
    },
    [integer, onValid],
  );

  const handleBlur = useCallback(() => {
    const raw = stripNumberFormatting(value);
    if (!raw) {
      onValid?.();
      if (emptyValueOnBlur !== undefined) setValue(emptyValueOnBlur);
      return;
    }

    const parsed = integer ? parseInt(raw, 10) : parseFloat(raw);
    if (Number.isNaN(parsed) || (min !== undefined && parsed < min)) {
      onInvalid?.(invalidMessage);
      return;
    }

    onValid?.();
    setValue(formatNumberInputValue(parsed, { maximumFractionDigits, integer }));
  }, [
    emptyValueOnBlur,
    integer,
    invalidMessage,
    maximumFractionDigits,
    min,
    onInvalid,
    onValid,
    value,
  ]);

  return {
    value,
    setValue,
    numberValue,
    rawValue: stripNumberFormatting(value),
    handleChange,
    handleBlur,
  };
}
