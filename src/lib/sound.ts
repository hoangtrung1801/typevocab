/**
 * Typewriter-style sound effects, synthesized with the Web Audio API so the app
 * ships no audio files. The AudioContext is created lazily on the first sound,
 * which always follows a keystroke (browsers require a user gesture).
 */

export type Sound = 'key' | 'space' | 'backspace' | 'error' | 'bell'

let ctx: AudioContext | null = null
let noise: AudioBuffer | null = null

function audio(): AudioContext | null {
  if (typeof window === 'undefined' || !('AudioContext' in window)) return null
  ctx ??= new AudioContext()
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

function noiseBuffer(ac: AudioContext): AudioBuffer {
  if (noise) return noise
  const length = Math.floor(ac.sampleRate * 0.2)
  noise = ac.createBuffer(1, length, ac.sampleRate)
  const data = noise.getChannelData(0)
  for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1
  return noise
}

/** A short filtered noise burst: the strike of a key. */
function click(ac: AudioContext, freq: number, gain: number, decay: number) {
  const t = ac.currentTime
  const src = ac.createBufferSource()
  src.buffer = noiseBuffer(ac)
  const filter = ac.createBiquadFilter()
  filter.type = 'bandpass'
  filter.frequency.value = freq
  filter.Q.value = 1.2
  const env = ac.createGain()
  env.gain.setValueAtTime(gain, t)
  env.gain.exponentialRampToValueAtTime(0.001, t + decay)
  src.connect(filter).connect(env).connect(ac.destination)
  src.start(t)
  src.stop(t + decay + 0.02)
}

/** A pitched tone with an exponential fade. */
function tone(ac: AudioContext, type: OscillatorType, from: number, to: number, gain: number, decay: number, delay = 0) {
  const t = ac.currentTime + delay
  const osc = ac.createOscillator()
  osc.type = type
  osc.frequency.setValueAtTime(from, t)
  osc.frequency.exponentialRampToValueAtTime(to, t + decay)
  const env = ac.createGain()
  env.gain.setValueAtTime(0.0001, t)
  env.gain.exponentialRampToValueAtTime(gain, t + 0.005)
  env.gain.exponentialRampToValueAtTime(0.0001, t + decay)
  osc.connect(env).connect(ac.destination)
  osc.start(t)
  osc.stop(t + decay + 0.02)
}

export function play(sound: Sound) {
  const ac = audio()
  if (!ac) return
  // Slight random pitch so fast typing does not sound mechanical.
  const jitter = 0.9 + Math.random() * 0.2
  switch (sound) {
    case 'key':
      click(ac, 2600 * jitter, 0.35, 0.035)
      tone(ac, 'sine', 180 * jitter, 90, 0.12, 0.04)
      break
    case 'space':
      click(ac, 1300 * jitter, 0.4, 0.06)
      tone(ac, 'sine', 120, 70, 0.14, 0.06)
      break
    case 'backspace':
      click(ac, 1900 * jitter, 0.22, 0.03)
      break
    case 'error':
      tone(ac, 'triangle', 150, 90, 0.22, 0.12)
      click(ac, 700, 0.18, 0.05)
      break
    case 'bell':
      tone(ac, 'sine', 2093, 2080, 0.18, 1.4, 0.05)
      tone(ac, 'sine', 3136, 3120, 0.07, 0.9, 0.05)
      break
  }
}
