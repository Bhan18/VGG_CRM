
"use client";

import { useState, useEffect } from "react";
import { transliterateWithGoogle } from "@/utils/googleTransliterate";
import { transliterateToTelugu } from "@/utils/transliterate";

interface TextAreaProps {
  label: string; value: string; onChange: (value: string) => void; placeholder?: string;
  disabled?: boolean; required?: boolean; error?: string; showTransliteration?: boolean;
}

export default function TextArea({ label, value, onChange, placeholder, disabled = false, required = false, error, showTransliteration = true }: TextAreaProps) {
  const [teluguPreview, setTeluguPreview] = useState("");

  useEffect(() => {
    if (!showTransliteration || !value) { setTeluguPreview(""); return; }
    
    // 1. Instant high-quality Telugu
    setTeluguPreview(transliterateToTelugu(value));

    // 2. Upgrade to Google API
    const timeoutId = setTimeout(async () => {
      const result = await transliterateWithGoogle(value);
      if (result !== value) setTeluguPreview(result);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [value, showTransliteration]);

  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-gray-700">
        {label}{required && <span className="text-red-500 ml-1">*</span>}
      </span>
      <textarea value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} disabled={disabled} rows={3}
        className={`w-full resize-none rounded-xl border bg-white px-3 py-2.5 text-sm outline-none transition focus:ring-2 focus:ring-red-100 ${
          disabled ? "border-gray-200 text-gray-500 cursor-not-allowed bg-gray-50" : error ? "border-red-500" : "border-gray-300 focus:border-red-600"
        }`}
      />
      {teluguPreview && <p className="mt-1 text-xs text-gray-500 italic min-h-[1.25rem]">{teluguPreview}</p>}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </label>
  );
}

