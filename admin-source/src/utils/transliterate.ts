
// High-Quality Phonetic Transliteration Engine (ITRANS Standard)
const teluguDictionary: Record<string, string> = {
  hyderabad: "హైదరాబాద్", neredmet: "నేరెడ్‌మెట్", malkajgiri: "మల్కాజ్గిరి",
  telangana: "తెలంగాణ", vijaya: "విజయ", sandalwood: "శాండల్‌వుడ్", farm: "ఫార్మ్",
  palnadu: "పల్నాడు", bollapalli: "బొల్లపల్లి", district: "జిల్లా", mandal: "మండలం",
  village: "గ్రామం", parise: "పరిశే", venu: "వేణు", gopal: "గోపాల్", venugopal: "వేణుగోపాల్",
  adiseshu: "ఆదిశేషు", colony: "కాలనీ", state: "రాష్ట్రం", road: "రోడ్", plot: "ప్లాట్",
};

const consonantsMap: Record<string, string> = {
  ksh: "క్ష", kh: "ఖ", gh: "ఘ", chh: "ఛ", ch: "చ", jh: "ఝ", Th: "థ", Dh: "ధ",
  th: "త", dh: "ద", ph: "ఫ", bh: "భ", sh: "ష", Sh: "శ", k: "క", g: "గ", j: "జ",
  T: "ట", D: "డ", N: "ణ", t: "త", d: "ద", n: "న", p: "ప", b: "బ", m: "మ", y: "య",
  r: "ర", l: "ల", v: "వ", w: "వ", s: "స", h: "హ", L: "ళ", f: "ఫ",
};

const vowelsMap: Record<string, string> = {
  aa: "ఆ", A: "ఆ", ai: "ఐ", au: "ఔ", ee: "ఈ", I: "ఈ", oo: "ఊ", U: "ఊ",
  a: "అ", i: "ఇ", u: "ఉ", e: "ఎ", E: "ఏ", o: "ఒ", O: "ఓ",
};

const vowelSignsMap: Record<string, string> = {
  aa: "ా", A: "ా", ai: "ై", au: "ౌ", ee: "ీ", I: "ీ", oo: "ూ", U: "ూ",
  a: "", i: "ి", u: "ు", e: "ె", E: "ే", o: "ొ", O: "ో",
};

const halant = "్";

function extractPhonemes(word: string): string[] {
  const phonemes: string[] = [];
  let i = 0;
  while (i < word.length) {
    let found = false;
    for (let len = 3; len >= 1; len--) {
      const sub = word.substring(i, i + len);
      if (consonantsMap[sub] || vowelsMap[sub]) {
        phonemes.push(sub);
        i += len;
        found = true;
        break;
      }
    }
    if (!found) {
      phonemes.push(word[i]);
      i += 1;
    }
  }
  return phonemes;
}

export function transliterateToTelugu(text: string): string {
  if (!text) return "";
  return text.split(/\s+/).map(word => {
    const cleanWord = word.replace(/[^a-zA-Z]/g, "");
    if (teluguDictionary[cleanWord.toLowerCase()]) {
      return teluguDictionary[cleanWord.toLowerCase()];
    }
    
    const phonemes = extractPhonemes(word.toLowerCase());
    let result = "";
    let i = 0;

    while (i < phonemes.length) {
      const current = phonemes[i];
      const next = phonemes[i + 1];

      if (consonantsMap[current]) {
        const consChar = consonantsMap[current];
        if (next && vowelsMap[next]) {
          result += consChar + (vowelSignsMap[next] || "");
          i += 2;
        } else if (next && consonantsMap[next]) {
          result += consChar + halant;
          i += 1;
        } else if (!next) {
          // Ending consonant usually gets halant in Telugu names (e.g., Gopal -> గోపాల్)
          result += consChar + halant;
          i += 1;
        } else {
          // Consonant followed by unknown/number, inherent 'a'
          result += consChar + "ా"; 
          i += 1;
        }
      } else if (vowelsMap[current]) {
        result += vowelsMap[current];
        i += 1;
      } else {
        result += current; // Numbers/Punctuation
        i += 1;
      }
    }
    return result;
  }).join(" ");
}

