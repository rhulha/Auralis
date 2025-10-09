export const examples = {
  bassdrum: `sound BassDrum:
  body = sine(50Hz) → decay(400ms)
  click = white → highpass(2000Hz) → decay(30ms)
  mix body + click`,

  snare: `sound SnareDrum:
  body = triangle(180Hz) → decay(200ms)
  noise = white → bandpass(3000Hz, 1500Hz) → decay(300ms)
  mix body + noise`,

  bell: `sound BellTone:
  mix sine(880Hz) + sine(1320Hz, amp=0.3) → decay(3s)`,

  synth: `sound SynthLead:
  mix saw(440Hz) → lowpass(1200Hz) → decay(1s)`,

  hihat: `sound HiHat:
  mix white → highpass(7000Hz) → decay(100ms)`,

  acidbass: `sound AcidBass:
  mix saw(55Hz) → lowpass(800Hz, q=10) → adsr(attack=5ms, decay=200ms, sustain=0.3, release=100ms)`,

  pad: `sound Pad:
  mix sine(220Hz) + sine(330Hz, amp=0.7) + sine(440Hz, amp=0.5) → adsr(attack=500ms, decay=300ms, sustain=0.8, release=1s)`,

  lead: `sound SynthLead:
  mix saw(440Hz) → lowpass(1500Hz, q=5) → adsr(attack=10ms, decay=150ms, sustain=0.6, release=300ms)`,

  delaybass: `sound DelayBass:
  mix saw(55Hz) → lowpass(400Hz, q=3) → delay(375ms, feedback=0.4, mix=0.3) → adsr(attack=5ms, decay=200ms, sustain=0.5, release=150ms)`,

  choruslead: `sound ChorusLead:
  mix saw(440Hz) + saw(441Hz, amp=0.5) → lowpass(2000Hz) → chorus(rate=1.5Hz, depth=20ms, mix=0.5) → adsr(attack=10ms, decay=100ms, sustain=0.7, release=200ms)`,

  flangerbass: `sound FlangerBass:
  mix square(110Hz) → flanger(rate=0.5Hz, depth=5ms, feedback=0.6, mix=0.5) → adsr(attack=5ms, decay=150ms, sustain=0.6, release=200ms)`,

  stereobell: `sound StereoBell:
  left = sine(880Hz) → pan(-0.7) → decay(3s)
  right = sine(1320Hz, amp=0.8) → pan(0.7) → decay(3s)
  mix left + right`,

  spacelead: `sound SpaceLead:
  mix saw(220Hz) → lowpass(1000Hz, q=8) → delay(500ms, feedback=0.5, mix=0.4) → chorus(rate=2Hz, depth=15ms, mix=0.3) → adsr(attack=50ms, decay=200ms, sustain=0.6, release=400ms)`,

  widehihat: `sound WideHiHat:
  left = white → highpass(8000Hz) → pan(-0.8) → decay(120ms)
  right = white → highpass(7500Hz) → pan(0.8) → decay(100ms)
  mix left + right`
};
