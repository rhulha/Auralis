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
  tone = sine(880Hz) + sine(1320Hz, amp=0.3)
  tone → decay(3s) → reverb(hall)`,

  synth: `sound SynthLead:
  osc = saw(440Hz)
  osc → lowpass(1200Hz) → decay(1s)`,

  hihat: `sound HiHat:
  noise = white → highpass(7000Hz)
  noise → decay(100ms)`
};
