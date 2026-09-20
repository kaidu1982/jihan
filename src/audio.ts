let audio: AudioContext | undefined;
export function playTone(kind: 'step' | 'turn' | 'end' | 'record', enabled: boolean, score = 0): void {
  if (!enabled) return;
  try {
    audio ||= new AudioContext();
    if (audio.state === 'suspended') void audio.resume();
    const now = audio.currentTime;
    const notes = kind === 'record' ? [523, 659, 784, 1046] : [kind === 'end' ? 180 : (kind === 'turn' ? 440 : 523) + (score % 5) * 35];
    notes.forEach((frequency, i) => {
      const oscillator = audio!.createOscillator();
      const gain = audio!.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(frequency, now + i * .11);
      if (kind === 'end') oscillator.frequency.exponentialRampToValueAtTime(80, now + .25);
      gain.gain.setValueAtTime(.0001, now + i * .11);
      gain.gain.exponentialRampToValueAtTime(.065, now + i * .11 + .008);
      gain.gain.exponentialRampToValueAtTime(.0001, now + i * .11 + .2);
      oscillator.connect(gain); gain.connect(audio!.destination);
      oscillator.start(now + i * .11); oscillator.stop(now + i * .11 + .25);
    });
  } catch { /* Audio is optional when a browser cannot create an audio context. */ }
}
