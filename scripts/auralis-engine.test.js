import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AuralisEngine } from './auralis-engine.js';

global.window = {
  AudioContext: class MockAudioContext {
    constructor() {
      this.currentTime = 0;
      this.sampleRate = 44100;
      this.state = 'running';
      this.destination = { connect: vi.fn() };
    }

    createOscillator() {
      return {
        type: 'sine',
        frequency: {
          value: 440,
          setValueAtTime: vi.fn(),
          exponentialRampToValueAtTime: vi.fn(),
          cancelScheduledValues: vi.fn(),
          connect: vi.fn()
        },
        connect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn()
      };
    }

    createGain() {
      return {
        gain: {
          value: 1,
          setValueAtTime: vi.fn(),
          linearRampToValueAtTime: vi.fn(),
          exponentialRampToValueAtTime: vi.fn()
        },
        connect: vi.fn()
      };
    }

    createBiquadFilter() {
      return {
        type: 'lowpass',
        frequency: { value: 1000 },
        Q: { value: 1 },
        connect: vi.fn()
      };
    }

    createConvolver() {
      return {
        buffer: null,
        connect: vi.fn()
      };
    }

    createBuffer(channels, length, sampleRate) {
      const buffers = [];
      for (let i = 0; i < channels; i++) {
        buffers.push(new Float32Array(length));
      }
      return {
        getChannelData: (channel) => buffers[channel]
      };
    }

    createBufferSource() {
      return {
        buffer: null,
        connect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn()
      };
    }

    createDelay(maxTime) {
      return {
        delayTime: { value: 0 },
        connect: vi.fn()
      };
    }

    createWaveShaper() {
      return {
        curve: null,
        oversample: '4x',
        connect: vi.fn()
      };
    }

    createStereoPanner() {
      return {
        pan: { value: 0 },
        connect: vi.fn()
      };
    }

    createConstantSource() {
      return {
        offset: { value: 0 },
        connect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn()
      };
    }

    suspend() {
      this.state = 'suspended';
      return Promise.resolve();
    }

    resume() {
      this.state = 'running';
      return Promise.resolve();
    }

    close() {
      return Promise.resolve();
    }
  }
};

global.OfflineAudioContext = class MockOfflineAudioContext extends global.window.AudioContext {
  constructor(channels, length, sampleRate) {
    super();
    this.numberOfChannels = channels;
    this.length = length;
    this.sampleRate = sampleRate;
    this.destination = { connect: vi.fn() };
  }

  startRendering() {
    const buffers = [];
    for (let i = 0; i < this.numberOfChannels; i++) {
      buffers.push(new Float32Array(this.length));
    }
    return Promise.resolve({
      numberOfChannels: this.numberOfChannels,
      length: this.length,
      sampleRate: this.sampleRate,
      getChannelData: (channel) => buffers[channel]
    });
  }
};

describe('AuralisEngine', () => {
  let engine;

  beforeEach(() => {
    engine = new AuralisEngine();
  });

  describe('init', () => {
    it('should initialize engine', async () => {
      await engine.init();

      expect(engine.initialized).toBe(true);
      expect(engine.audioContext).toBeDefined();
      expect(engine.parser).toBeDefined();
      expect(engine.compiler).toBeDefined();
    });

    it('should not reinitialize if already initialized', async () => {
      await engine.init();
      const firstContext = engine.audioContext;

      await engine.init();
      const secondContext = engine.audioContext;

      expect(firstContext).toBe(secondContext);
    });

    it('should resume suspended audio context', async () => {
      engine.audioContext = new window.AudioContext();
      engine.audioContext.state = 'suspended';
      engine.initialized = false;

      await engine.init();

      expect(engine.audioContext.state).toBe('running');
    });
  });

  describe('compile', () => {
    beforeEach(async () => {
      await engine.init();
    });

    it('should compile valid Auralis source', () => {
      const source = `sound Kick:
  sine(60Hz)`;

      const result = engine.compile(source);

      expect(result).toBe(engine);
      expect(engine.compiler.soundDefs.has('Kick')).toBe(true);
    });

    it('should compile multiple sound definitions', () => {
      const source = `sound Kick:
  sine(60Hz)

sound Snare:
  noise()`;

      engine.compile(source);

      expect(engine.compiler.soundDefs.has('Kick')).toBe(true);
      expect(engine.compiler.soundDefs.has('Snare')).toBe(true);
    });

    it('should throw error if not initialized', () => {
      const uninitEngine = new AuralisEngine();
      const source = 'sound Test:\n  sine(440Hz)';

      expect(() => uninitEngine.compile(source)).toThrow(/Engine not initialized/);
    });

    it('should compile sound with pipeline', () => {
      const source = `sound Bell:
  sine(440Hz) → decay(300ms)`;

      engine.compile(source);

      expect(engine.compiler.soundDefs.has('Bell')).toBe(true);
    });

    it('should compile sound with mix', () => {
      const source = `sound Chord:
  sine(440Hz) + sine(550Hz) + sine(660Hz)`;

      engine.compile(source);

      expect(engine.compiler.soundDefs.has('Chord')).toBe(true);
    });
  });

  describe('play', () => {
    beforeEach(async () => {
      await engine.init();
      const source = `sound Kick:
  sine(60Hz) → decay(200ms)`;
      engine.compile(source);
    });

    it('should play compiled sound', () => {
      const result = engine.play('Kick');

      expect(result).toBeDefined();
    });

    it('should play sound with custom duration', () => {
      const result = engine.play('Kick', {}, 3);

      expect(result).toBeDefined();
    });

    it('should play sound with custom arguments', async () => {
      const source = `sound Tone(freq = 440Hz):
  sine(freq)`;
      engine.compile(source);

      const result = engine.play('Tone', {
        freq: { type: 'literal', value: 880, unit: 'Hz' }
      });

      expect(result).toBeDefined();
    });

    it('should throw error if not initialized', () => {
      const uninitEngine = new AuralisEngine();

      expect(() => uninitEngine.play('Kick')).toThrow(/Engine not initialized/);
    });

    it('should not throw error when playing sound', () => {
      expect(() => engine.play('Kick')).not.toThrow();
    });
  });

  describe('stop', () => {
    it('should suspend audio context', async () => {
      await engine.init();
      engine.stop();

      expect(engine.audioContext.state).toBe('suspended');
    });

    it('should handle stop when not initialized', () => {
      expect(() => engine.stop()).not.toThrow();
    });
  });

  describe('resume', () => {
    it('should resume audio context', async () => {
      await engine.init();
      engine.audioContext.state = 'suspended';

      engine.resume();

      expect(engine.audioContext.state).toBe('running');
    });

    it('should handle resume when not initialized', () => {
      expect(() => engine.resume()).not.toThrow();
    });
  });

  describe('getContext', () => {
    it('should return audio context', async () => {
      await engine.init();
      const context = engine.getContext();

      expect(context).toBe(engine.audioContext);
    });

    it('should return null if not initialized', () => {
      const context = engine.getContext();

      expect(context).toBeNull();
    });
  });

  describe('integration tests', () => {
    beforeEach(async () => {
      await engine.init();
    });

    it('should compile and play bass drum', () => {
      const source = `sound BassDrum:
  sine(60Hz) → decay(200ms) → distort(10)`;

      engine.compile(source);
      const result = engine.play('BassDrum', {}, 1);

      expect(result).toBeDefined();
    });

    it('should compile and play bell with reverb', () => {
      const source = `sound Bell:
  sine(440Hz) → decay(300ms) → reverb()`;

      engine.compile(source);
      const result = engine.play('Bell', {}, 2);

      expect(result).toBeDefined();
    });

    it('should compile and play mixed sounds', () => {
      const source = `sound Chord:
  sine(440Hz) + sine(550Hz) + sine(660Hz)`;

      engine.compile(source);
      const result = engine.play('Chord', {}, 2);

      expect(result).toBeDefined();
    });

    it('should compile and play sound with LFO', () => {
      const source = `sound WobbleBass:
  sine(100Hz) → lowpass(lfo(2Hz, 200Hz, 2000Hz))`;

      engine.compile(source);
      const result = engine.play('WobbleBass', {}, 3);

      expect(result).toBeDefined();
    });

    it('should compile and play sound with ADSR', () => {
      const source = `sound Lead:
  saw(440Hz) → adsr(attack=10ms, decay=100ms, sustain=0.7, release=200ms)`;

      engine.compile(source);
      const result = engine.play('Lead', {}, 2);

      expect(result).toBeDefined();
    });

    it('should compile and play sound with delay', () => {
      const source = `sound Echo:
  sine(440Hz) → decay(100ms) → delay(time=500ms, feedback=0.3, mix=0.5)`;

      engine.compile(source);
      const result = engine.play('Echo', {}, 3);

      expect(result).toBeDefined();
    });

    it('should compile and play sound with chorus', () => {
      const source = `sound ChorusLead:
  sine(440Hz) → chorus(rate=1.5Hz, depth=20ms, mix=0.5)`;

      engine.compile(source);
      const result = engine.play('ChorusLead', {}, 2);

      expect(result).toBeDefined();
    });

    it('should compile and play panned sound', () => {
      const source = `sound PannedTone:
  sine(440Hz) → pan(0.5)`;

      engine.compile(source);
      const result = engine.play('PannedTone', {}, 2);

      expect(result).toBeDefined();
    });

    it('should compile sound with noise', () => {
      const source = `sound Snare:
  (sine(200Hz) + noise()) → decay(150ms)`;

      engine.compile(source);
      const result = engine.play('Snare', {}, 1);

      expect(result).toBeDefined();
    });

    it('should compile parametric sound', () => {
      const source = `sound Tone(freq = 440Hz, amp = 0.5):
  sine(freq, amp=amp) → decay(200ms)`;

      engine.compile(source);
      const result1 = engine.play('Tone');
      const result2 = engine.play('Tone', {
        freq: { type: 'literal', value: 880, unit: 'Hz' }
      });

      expect(result1).toBeDefined();
      expect(result2).toBeDefined();
    });

    it('should handle complex sound definition', () => {
      const source = `sound ComplexDrum:
  base = sine(60Hz) → decay(100ms)
  noise = white() → highpass(2000Hz) → decay(50ms)
  (base + noise) → distort(5) → reverb()`;

      engine.compile(source);
      const result = engine.play('ComplexDrum', {}, 2);

      expect(result).toBeDefined();
    });
  });

  describe('output validation', () => {
    it('should throw when a sound has no output expression', async () => {
      await engine.init();
      engine.compile(`sound Empty:
  body = sine(440Hz)`);

      expect(() => engine.play('Empty')).toThrow(/has no output/);
    });
  });

  describe('pitch_down', () => {
    it('should schedule a falling frequency ramp on the preceding oscillator', async () => {
      await engine.init();
      engine.compile(`sound Kick:
  sine(120Hz) → pitch_down(200ms) → decay(400ms)`);

      const graph = engine.play('Kick', {}, 1);

      expect(graph).toBeDefined();
    });

    it('should drop to a quarter of the start frequency by default', async () => {
      await engine.init();
      const ctx = engine.audioContext;
      const osc = ctx.createOscillator();
      osc.frequency.value = 200;

      engine.compiler.applyPitchMod(
        { source: osc },
        { duration: 0.2, targetFreq: null, startTime: 0 }
      );

      expect(osc.frequency.exponentialRampToValueAtTime).toHaveBeenCalledWith(50, 0.2);
    });
  });

  describe('render / export', () => {
    it('should render a sound to an AudioBuffer offline', async () => {
      await engine.init();
      engine.compile(`sound Tone:
  sine(440Hz) → decay(200ms)`);

      const buffer = await engine.render('Tone', {}, 1, 44100);

      expect(buffer.length).toBe(44100);
      expect(buffer.numberOfChannels).toBe(2);
    });

    it('should encode a rendered sound as a WAV blob', async () => {
      await engine.init();
      engine.compile(`sound Tone:
  sine(440Hz) → decay(200ms)`);

      const blob = await engine.renderToWav('Tone', {}, 1, 44100);

      expect(blob.type).toBe('audio/wav');
      expect(blob.size).toBe(44 + 44100 * 2 * 2);
    });
  });
});
