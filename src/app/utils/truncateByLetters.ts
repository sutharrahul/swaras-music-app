export function truncateByLetters(text: string, maxLetters: number) {
  if (text.length <= maxLetters) return text;
  let truncated = text.slice(0, maxLetters);
  if (text[maxLetters] !== ' ' && truncated.includes(' ')) {
    truncated = truncated.slice(0, truncated.lastIndexOf(' '));
  }

  return truncated + '...';
}
