
"use client";

import { Input } from "@/components/ui/input";
import { useState, useEffect, type ComponentProps } from "react";

/**
 * NumberInput — fixes the "018" problem permanently.
 *
 * The issue: when a number input's value is 0 and the user types a digit,
 * the 0 stays and you get "018" instead of "18".
 *
 * The fix: use type="text" with a draft state.
 * - On focus: if value is 0, clear to empty string so the first digit
 *   replaces nothing (typing "5" → shows "5", not "05")
 * - While typing: update the draft and call onValueChange with parsed number
 * - On blur: if draft is empty, set value back to 0
 * - When not focused: show formatted value with thousand separators (optional)
 */
interface NumberInputProps extends Omit<ComponentProps<typeof Input>, "onChange" | "value" | "type"> {
  value: number;
  onValueChange: (value: number) => void;
  /** When true, shows thousand separators (e.g. 25,000) while not focused */
  format?: boolean;
  /** Allow decimal input */
  allowDecimal?: boolean;
}

export function NumberInput({
  value,
  onValueChange,
  format = false,
  allowDecimal = false,
  onFocus,
  onBlur,
  ...props
}: NumberInputProps) {
  const [focused, setFocused] = useState(false);
  const [draft, setDraft] = useState<string>("");

  // When the input gains focus, set the draft:
  // - If value is 0, start with empty string (so typing "5" → "5", not "05")
  // - Otherwise, start with the raw number string
  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    setFocused(true);
    setDraft(value === 0 ? "" : String(value));
    onFocus?.(e);
  };

  // When the input loses focus:
  // - If draft is empty, call onValueChange(0) to reset
  // - Otherwise, the last onValueChange during typing already set the value
  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    setFocused(false);
    if (draft.trim() === "" || draft === "0") {
      onValueChange(0);
    }
    onBlur?.(e);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let raw = e.target.value;
    // Strip non-numeric characters (keep decimal point if allowed)
    if (allowDecimal) {
      raw = raw.replace(/[^0-9.]/g, "");
      // Keep only the first decimal point
      const parts = raw.split(".");
      if (parts.length > 2) {
        raw = parts[0] + "." + parts.slice(1).join("");
      }
    } else {
      raw = raw.replace(/[^0-9]/g, "");
    }
    setDraft(raw);
    const parsed = raw === "" ? 0 : (allowDecimal ? parseFloat(raw) : parseInt(raw, 10));
    onValueChange(parsed || 0);
  };

  // Display logic:
  // - While focused: show the raw draft (what the user is typing)
  // - When not focused: show formatted value (with separators if format=true)
  let displayValue: string;
  if (focused) {
    displayValue = draft;
  } else if (format && value > 0) {
    displayValue = value.toLocaleString("en-IN");
  } else {
    displayValue = String(value);
  }

  return (
    <Input
      type="text"
      inputMode={allowDecimal ? "decimal" : "numeric"}
      value={displayValue}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      {...props}
    />
  );
}


