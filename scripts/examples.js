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
  mix saw(440Hz) → lowpass(1500Hz, q=5) → adsr(attack=10ms, decay=150ms, sustain=0.6, release=300ms)`
};
