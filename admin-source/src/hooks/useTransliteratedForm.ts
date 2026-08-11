
import { useState, useEffect } from "react";
import { FormData } from "@/components/pages/GenerateAgreementPage";
import { transliterateWithGoogle } from "@/utils/googleTransliterate";
import { transliterateToTelugu } from "@/utils/transliterate";

export function useTransliteratedForm(form: FormData) {
  const [teluguForm, setTeluguForm] = useState<Record<string, string>>({});

  useEffect(() => {
    const transliterateFields = async () => {
      const fields = [
        "customerName", "customerFatherName", "customerAddress",
        "sellerName", "sellerFatherName", "sellerAddress",
        "projectName", "district", "mandal", "village",
        "eastBoundary", "westBoundary", "northBoundary", "southBoundary"
      ];
      
      const results: Record<string, string> = {};
      for (const field of fields) {
        const val = form[field as keyof FormData];
        if (val) {
          // 1. Get instant high-quality heuristic result
          const instantResult = transliterateToTelugu(val);
          
          // 2. Try to upgrade to Google API result
          const googleResult = await transliterateWithGoogle(val);
          
          // Use Google if it successfully returned Telugu (doesn't match original English)
          results[field] = (googleResult !== val) ? googleResult : instantResult;
        } else {
          results[field] = "";
        }
      }
      setTeluguForm(results);
    };

    const timeoutId = setTimeout(() => transliterateFields(), 400);
    return () => clearTimeout(timeoutId);
  }, [form]);

  return teluguForm;
}

