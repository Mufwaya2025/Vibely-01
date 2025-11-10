type FeedbackPattern = 'light' | 'medium' | 'heavy';

const hapticPatterns: Record<FeedbackPattern, number | number[]> = {
  light: 20,
  medium: [30, 40, 30],
  heavy: [40, 60, 40, 60],
};

let audioContext: AudioContext | null = null;

const getAudioContext = (): AudioContext | null => {
  if (typeof window === 'undefined' || typeof window.AudioContext === 'undefined') {
    return null;
  }
  if (!audioContext) {
    audioContext = new AudioContext();
  }
  return audioContext;
};

const buildTone = (frequency: number, durationMs: number, volume = 0.2) => {
  const ctx = getAudioContext();
  if (!ctx) return;

  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();

  oscillator.type = 'sine';
  oscillator.frequency.value = frequency;

  gain.gain.value = volume;
  oscillator.connect(gain);
  gain.connect(ctx.destination);

  const now = ctx.currentTime;
  const durationSeconds = durationMs / 1000;

  oscillator.start(now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + durationSeconds);
  oscillator.stop(now + durationSeconds);
};

export const triggerHapticFeedback = (pattern: FeedbackPattern = 'light'): void => {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return;
  const supportVibrate = 'vibrate' in navigator;
  if (!supportVibrate) return;
  navigator.vibrate(hapticPatterns[pattern]);
};

export const playNotificationSound = (tone: 'message' | 'success' = 'message'): void => {
  if (typeof window === 'undefined') return;

  const ctx = getAudioContext();
  if (!ctx) return;

  if (ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
  }

  if (tone === 'success') {
    buildTone(880, 120, 0.18);
    setTimeout(() => buildTone(1320, 120, 0.15), 130);
  } else {
    buildTone(640, 90, 0.2);
    setTimeout(() => buildTone(540, 90, 0.15), 110);
  }
};

export const playMessageFeedback = (direction: 'incoming' | 'outgoing'): void => {
  if (direction === 'incoming') {
    triggerHapticFeedback('medium');
    playNotificationSound('message');
  } else {
    triggerHapticFeedback('light');
    playNotificationSound('success');
  }
};
