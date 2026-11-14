/** Voice answer (accessibility: low-vision users). Uses the browser's speech engine, offline on most phones. */
export const canSpeak = () => typeof window !== 'undefined' && 'speechSynthesis' in window;

export function speak(text: string) {
  if (!canSpeak()) return;
  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'en-CA';
    u.rate = 1;
    window.speechSynthesis.speak(u);
  } catch {
    /* no voice available: the text is on screen anyway */
  }
}
