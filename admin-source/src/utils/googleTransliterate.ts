
const API_URL = "https://inputtools.google.com/request";
const LANGUAGE_CODE = "te-t-i0-undi";

const cache: Record<string, string> = {};

export async function transliterateWithGoogle(text: string): Promise<string> {
  if (!text) return "";
  
  const words = text.split(/\s+/);
  const transliteratedWords = await Promise.all(
    words.map(async (word) => {
      if (!/[a-zA-Z]/.test(word)) return word;
      if (cache[word.toLowerCase()]) return cache[word.toLowerCase()];

      try {
        const response = await fetch(
          `${API_URL}?text=${encodeURIComponent(word)}&itc=${LANGUAGE_CODE}&num=1&cp=0&cs=1&ie=utf-8&oe=utf-8`,
          { mode: 'cors' }
        );
        if (!response.ok) return word;
        const data = await response.json();
        
        if (data[0] === "SUCCESS" && data[1] && data[1][0] && data[1][0][1] && data[1][0][1][0]) {
          const result = data[1][0][1][0];
          cache[word.toLowerCase()] = result;
          return result;
        }
        return word;
      } catch (error) {
        return word; // Fallback silently on network error
      }
    })
  );
  
  return transliteratedWords.join(" ");
}

