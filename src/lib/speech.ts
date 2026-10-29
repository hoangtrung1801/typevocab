/** Pronounces English words with the browser's speech synthesis, if available. */

export function canSpeak(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window
}

/** Prefers an American, then a British, then any English voice. */
function englishVoice(): SpeechSynthesisVoice | undefined {
  const voices = window.speechSynthesis.getVoices()
  return (
    voices.find((v) => v.lang === 'en-US') ??
    voices.find((v) => v.lang === 'en-GB') ??
    voices.find((v) => v.lang.toLowerCase().startsWith('en'))
  )
}

export function speak(text: string) {
  if (!canSpeak() || !text) return
  const synth = window.speechSynthesis
  synth.cancel()
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = 'en-US'
  utterance.rate = 0.9
  const voice = englishVoice()
  if (voice) utterance.voice = voice
  synth.speak(utterance)
}
