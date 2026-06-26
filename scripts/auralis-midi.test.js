import { describe, it, expect, beforeEach } from 'vitest';
import { AuralisCompiler } from './auralis-compiler.js';

class MockAudioContext {
  constructor() {
    this.currentTime = 0;
    this.sampleRate = 44100;
  }
  createOscillator() { return new MockOscillator(); }
  createGain() { return new MockGainNode(); }
  createBiquadFilter() { return new MockBiquadFilter(); }
}

class MockOscillator {
  constructor() {
    this.frequency = { value: 0 };
    this.type = 'sine';
  }
  connect() {}
  start() {}
  stop() {}
}

class MockGainNode {
  constructor() {
    this.gain = { value: 1, setValueAtTime: () => {}, exponentialRampToValueAtTime: () => {} };
  }
  connect() {}
}

class MockBiquadFilter {
  constructor() {
    this.frequency = { value: 0 };
    this.Q = { value: 1 };
    this.type = 'lowpass';
  }
  connect() {}
}

describe('AuralisCompiler - MIDI Note Support', () => {
  let compiler;

  beforeEach(() => {
    const audioContext = new MockAudioContext();
    compiler = new AuralisCompiler(audioContext);
  });

  describe('midiToFrequency', () => {
    it('should convert MIDI note 69 (A4) to 440 Hz', () => {
      const freq = compiler.midiToFrequency(69);
      expect(freq).toBeCloseTo(440, 2);
    });

    it('should convert MIDI note 60 (C4) to ~261.63 Hz', () => {
      const freq = compiler.midiToFrequency(60);
      expect(freq).toBeCloseTo(261.63, 2);
    });

    it('should convert MIDI note 72 (C5) to ~523.25 Hz', () => {
      const freq = compiler.midiToFrequency(72);
      expect(freq).toBeCloseTo(523.25, 2);
    });

    it('should convert MIDI note 48 (C3) to ~130.81 Hz', () => {
      const freq = compiler.midiToFrequency(48);
      expect(freq).toBeCloseTo(130.81, 2);
    });

    it('should convert MIDI note 36 (C2) to ~65.41 Hz', () => {
      const freq = compiler.midiToFrequency(36);
      expect(freq).toBeCloseTo(65.41, 2);
    });

    it('should convert MIDI note 81 (A5) to 880 Hz', () => {
      const freq = compiler.midiToFrequency(81);
      expect(freq).toBeCloseTo(880, 2);
    });
  });

  describe('parseFrequency', () => {
    it('should parse Hz units', () => {
      const freq = compiler.parseFrequency({ type: 'literal', value: 440, unit: 'Hz' });
      expect(freq).toBe(440);
    });

    it('should parse kHz units', () => {
      const freq = compiler.parseFrequency({ type: 'literal', value: 1, unit: 'kHz' });
      expect(freq).toBe(1000);
    });

    it('should interpret unitless numbers 0-127 as MIDI notes', () => {
      const freq = compiler.parseFrequency({ type: 'literal', value: 60, unit: null });
      expect(freq).toBeCloseTo(261.63, 2);
    });

    it('should handle MIDI note 0', () => {
      const freq = compiler.parseFrequency({ type: 'literal', value: 0, unit: null });
      expect(freq).toBeCloseTo(8.18, 2);
    });

    it('should handle MIDI note 127', () => {
      const freq = compiler.parseFrequency({ type: 'literal', value: 127, unit: null });
      expect(freq).toBeCloseTo(12543.85, 2);
    });

    it('should return default frequency for invalid values', () => {
      const freq = compiler.parseFrequency({ type: 'literal', value: 200, unit: null });
      expect(freq).toBe(440);
    });
  });

  describe('resolveParams', () => {
    it('should wrap numeric arguments in literal objects', () => {
      const paramDefs = [{ name: 'note', defaultValue: { type: 'literal', value: 60, unit: null } }];
      const args = { note: 72 };
      const result = compiler.resolveParams(paramDefs, args);

      expect(result.note).toEqual({ type: 'literal', value: 72, unit: null });
    });

    it('should use default values when args not provided', () => {
      const paramDefs = [{ name: 'note', defaultValue: { type: 'literal', value: 60, unit: null } }];
      const args = {};
      const result = compiler.resolveParams(paramDefs, args);

      expect(result.note).toEqual({ type: 'literal', value: 60, unit: null });
    });

    it('should handle multiple parameters', () => {
      const paramDefs = [
        { name: 'n1', defaultValue: { type: 'literal', value: 60, unit: null } },
        { name: 'n2', defaultValue: { type: 'literal', value: 64, unit: null } },
        { name: 'n3', defaultValue: { type: 'literal', value: 67, unit: null } }
      ];
      const args = { n1: 48, n2: 52, n3: 55 };
      const result = compiler.resolveParams(paramDefs, args);

      expect(result.n1).toEqual({ type: 'literal', value: 48, unit: null });
      expect(result.n2).toEqual({ type: 'literal', value: 52, unit: null });
      expect(result.n3).toEqual({ type: 'literal', value: 55, unit: null });
    });
  });

  describe('createOscillator with MIDI notes', () => {
    it('should create oscillator with MIDI note frequency', () => {
      const desc = {
        positionalArgs: [{ type: 'literal', value: 60, unit: null }],
        args: {}
      };

      const result = compiler.createOscillator('sine', desc, 0, 1);

      expect(result.source.frequency.value).toBeCloseTo(261.63, 2);
    });

    it('should handle MIDI note from named argument', () => {
      const desc = {
        positionalArgs: [],
        args: { freq: { type: 'literal', value: 72, unit: null } }
      };

      const result = compiler.createOscillator('sine', desc, 0, 1);

      expect(result.source.frequency.value).toBeCloseTo(523.25, 2);
    });

    it('should handle Hz frequencies normally', () => {
      const desc = {
        positionalArgs: [{ type: 'literal', value: 440, unit: 'Hz' }],
        args: {}
      };

      const result = compiler.createOscillator('sine', desc, 0, 1);

      expect(result.source.frequency.value).toBe(440);
    });
  });
});
