
export function amountInTeluguWords(amount: number): string {
  if (amount === 0) return "సున్నా రూపాయలు మాత్రమే";
  if (amount < 0) return "ఋణ రూపాయలు";

  const ones = ["", "ఒకటి", "రెండు", "మూడు", "నాలుగు", "ఐదు", "ఆరు", "ఏడు", "ఎనిమిది", "తొమ్మిది"];
  const tens = ["", "పది", "ఇరవై", "ముప్పై", "నలభై", "యాభై", "అరవై", "డెబ్బై", "ఎనభై", "తొంబై"];
  const specials = {10: "పది", 11: "పదకొండు", 12: "పన్నెండు", 13: "పదమూడు", 14: "పద్నాలుగు", 15: "పధినైదు", 16: "పదహారు", 17: "పద్దేడు", 18: "పద్దెనిమిది", 19: "పద్దొమ్మిది"};

  function convertBelowThousand(n: number): string {
    if (n === 0) return "";
    if (n < 10) return ones[n];
    if (n < 20) return specials[n] || "";
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ` ${ones[n % 10]}` : "");
    const h = Math.floor(n / 100);
    const hWord = h === 1 ? "వంద" : `${ones[h]} వందల`;
    return hWord + (n % 100 ? ` ${convertBelowThousand(n % 100)}` : "");
  }

  function convert(n: number): string {
    if (n === 0) return "";
    if (n < 1000) return convertBelowThousand(n);
    if (n < 100000) {
      const th = Math.floor(n / 1000);
      const thWord = th === 1 ? "వెయి" : `${convertBelowThousand(th)} వేల`;
      return thWord + (n % 1000 ? ` ${convertBelowThousand(n % 1000)}` : "");
    }
    if (n < 10000000) {
      const la = Math.floor(n / 100000);
      const laWord = la === 1 ? "లక్ష" : `${convertBelowThousand(la)} లక్షల`;
      return laWord + (n % 100000 ? ` ${convert(n % 100000)}` : "");
    }
    const cr = Math.floor(n / 10000000);
    const crWord = cr === 1 ? "కోటి" : `${convertBelowThousand(cr)} కోట్ల`;
    return crWord + (n % 10000000 ? ` ${convert(n % 10000000)}` : "");
  }

  return `${convert(amount)} రూపాయలు మాత్రమే`;
}

export function formatIndianCurrency(value: number): string {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(value || 0);
}

