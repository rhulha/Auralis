import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AuralisCompiler } from './auralis-compiler.js';

class MockAudioContext {
  constructor() {
    this.currentTime = 0;
    this.sampleRate = 44100;
    this.destination = { connect: vi.fn() };
  }

  createOscillator() {
    return {
      type: 'sine',
      frequency: { value: 440 },
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
}

describe('AuralisCompiler', () => {
  let compiler;
  let mockContext;

  beforeEach(() => {
    mockContext = new MockAudioContext();
    compiler = new AuralisCompiler(mockContext);
  });

  describe('compile', () => {
    it('should compile AST and store sound definitions', () => {
      const ast = {
        type: 'Program',
        sounds: [
          {
            type: 'SoundDef',
            name: 'Kick',
            params: [],
            body: []
          }
        ]
      };

      compiler.compile(ast);
      expect(compiler.soundDefs.has('Kick')).toBe(true);
    });

    it('should compile multiple sound definitions', () => {
      const ast = {
        type: 'Program',
        sounds: [
          { type: 'SoundDef', name: 'Kick', params: [], body: [] },
          { type: 'SoundDef', name: 'Snare', params: [], body: [] }
        ]
      };

      compiler.compile(ast);
      expect(compiler.soundDefs.has('Kick')).toBe(true);
      expect(compiler.soundDefs.has('Snare')).toBe(true);
    });
  });

  describe('createSound', () => {
    beforeEach(() => {
      const ast = {
        type: 'Program',
        sounds: [
          {
            type: 'SoundDef',
            name: 'TestSound',
            params: [
              { name: 'freq', defaultValue: { type: 'Literal', value: 440, unit: 'Hz' } }
            ],
            body: [
              {
                type: 'Expression',
                value: {
                  type: 'FunctionCall',
                  name: 'sine',
                  args: [{ value: { type: 'Identifier', name: 'freq' } }]
                }
              }
            ]
          }
        ]
      };
      compiler.compile(ast);
    });

    it('should create sound with default parameters', () => {
      const sound = compiler.createSound('TestSound');
      expect(sound).toBeDefined();
      expect(sound.type).toBe('function');
    });

    it('should create sound with custom parameters', () => {
      const sound = compiler.createSound('TestSound', {
        freq: { type: 'literal', value: 880, unit: 'Hz' }
      });
      expect(sound).toBeDefined();
    });

    it('should throw error for undefined sound', () => {
      expect(() => compiler.createSound('NonExistent')).toThrow(/Sound 'NonExistent' not defined/);
    });
  });

  describe('evaluateExpression', () => {
    it('should evaluate literal expression', () => {
      const result = compiler.evaluateExpression(
        { type: 'Literal', value: 440, unit: 'Hz' },
        {}
      );
      expect(result).toMatchObject({
        type: 'literal',
        value: 440,
        unit: 'Hz'
      });
    });

    it('should evaluate identifier from context', () => {
      const result = compiler.evaluateExpression(
        { type: 'Identifier', name: 'freq' },
        { freq: { type: 'literal', value: 880, unit: 'Hz' } }
      );
      expect(result).toMatchObject({
        type: 'literal',
        value: 880,
        unit: 'Hz'
      });
    });

    it('should evaluate function call', () => {
      const result = compiler.evaluateExpression(
        {
          type: 'FunctionCall',
          name: 'sine',
          args: [{ value: { type: 'Literal', value: 440, unit: 'Hz' } }]
        },
        {}
      );
      expect(result.type).toBe('function');
      expect(result.name).toBe('sine');
    });

    it('should evaluate pipeline expression', () => {
      const result = compiler.evaluateExpression(
        {
          type: 'Pipeline',
          left: { type: 'FunctionCall', name: 'sine', args: [] },
          right: { type: 'FunctionCall', name: 'decay', args: [] }
        },
        {}
      );
      expect(result.type).toBe('pipeline');
      expect(result.stages).toHaveLength(2);
    });

    it('should evaluate mix expression', () => {
      const result = compiler.evaluateExpression(
        {
          type: 'Mix',
          left: { type: 'FunctionCall', name: 'sine', args: [] },
          right: { type: 'FunctionCall', name: 'sine', args: [] }
        },
        {}
      );
      expect(result.type).toBe('mix');
      expect(result.sources).toHaveLength(2);
    });
  });

  describe('parseFrequency', () => {
    it('should parse Hz unit', () => {
      const result = compiler.parseFrequency({ type: 'literal', value: 440, unit: 'Hz' });
      expect(result).toBe(440);
    });

    it('should parse kHz unit', () => {
      const result = compiler.parseFrequency({ type: 'literal', value: 1, unit: 'kHz' });
      expect(result).toBe(1000);
    });

    it('should handle plain number', () => {
      const result = compiler.parseFrequency(880);
      expect(result).toBe(880);
    });

    it('should return default for invalid input', () => {
      const result = compiler.parseFrequency({ type: 'literal', value: 100, unit: 'invalid' });
      expect(result).toBe(440);
    });
  });

  describe('parseTime', () => {
    it('should parse seconds', () => {
      const result = compiler.parseTime({ type: 'literal', value: 2, unit: 's' });
      expect(result).toBe(2);
    });

    it('should parse milliseconds', () => {
      const result = compiler.parseTime({ type: 'literal', value: 500, unit: 'ms' });
      expect(result).toBe(0.5);
    });

    it('should handle plain number', () => {
      const result = compiler.parseTime(3);
      expect(result).toBe(3);
    });

    it('should return default for invalid input', () => {
      const result = compiler.parseTime({ type: 'literal', value: 100, unit: 'invalid' });
      expect(result).toBe(1);
    });
  });

  describe('parseAmplitude', () => {
    it('should parse dB unit', () => {
      const result = compiler.parseAmplitude({ type: 'literal', value: -6, unit: 'dB' });
      expect(result).toBeCloseTo(0.501, 2);
    });

    it('should parse plain value', () => {
      const result = compiler.parseAmplitude({ type: 'literal', value: 0.5 });
      expect(result).toBe(0.5);
    });

    it('should handle plain number', () => {
      const result = compiler.parseAmplitude(0.8);
      expect(result).toBe(0.8);
    });
  });

  describe('buildFunction', () => {
    it('should build oscillator', () => {
      const desc = {
        type: 'function',
        name: 'sine',
        args: {},
        positionalArgs: [{ type: 'literal', value: 440, unit: 'Hz' }]
      };
      const result = compiler.buildFunction(desc, 0, 2);

      expect(result).toBeDefined();
      expect(result.node).toBeDefined();
      expect(result.input).toBeDefined();
      expect(result.output).toBeDefined();
      expect(result.source).toBeDefined();
    });

    it('should build decay envelope', () => {
      const desc = {
        type: 'function',
        name: 'decay',
        args: {},
        positionalArgs: [{ type: 'literal', value: 200, unit: 'ms' }]
      };
      const result = compiler.buildFunction(desc, 0, 2);

      expect(result).toBeDefined();
      expect(result.node).toBeDefined();
      expect(result.node.gain).toBeDefined();
    });

    it('should build filter', () => {
      const desc = {
        type: 'function',
        name: 'lowpass',
        args: {},
        positionalArgs: [{ type: 'literal', value: 1000, unit: 'Hz' }]
      };
      const result = compiler.buildFunction(desc, 0, 2);

      expect(result).toBeDefined();
      expect(result.node.type).toBe('lowpass');
    });

    it('should build reverb effect', () => {
      const desc = {
        type: 'function',
        name: 'reverb',
        args: {},
        positionalArgs: []
      };
      const result = compiler.buildFunction(desc, 0, 2);

      expect(result).toBeDefined();
      expect(result.input).toBeDefined();
      expect(result.output).toBeDefined();
    });

    it('should handle unknown function', () => {
      const desc = {
        type: 'function',
        name: 'unknown',
        args: {},
        positionalArgs: []
      };
      const result = compiler.buildFunction(desc, 0, 2);

      expect(result).toBeNull();
    });
  });

  describe('buildMix', () => {
    it('should mix multiple sources', () => {
      const sources = [
        { type: 'function', name: 'sine', args: {}, positionalArgs: [{ type: 'literal', value: 440, unit: 'Hz' }] },
        { type: 'function', name: 'sine', args: {}, positionalArgs: [{ type: 'literal', value: 880, unit: 'Hz' }] }
      ];
      const result = compiler.buildMix(sources, 0, 2);

      expect(result).toBeDefined();
      expect(result.node).toBeDefined();
      expect(result.node.gain).toBeDefined();
    });
  });

  describe('audio node creation', () => {
    it('should create white noise', () => {
      const result = compiler.createWhiteNoise(0, 2);
      expect(result).toBeDefined();
      expect(result.source).toBeDefined();
      expect(result.source.buffer).toBeDefined();
    });

    it('should create pink noise', () => {
      const result = compiler.createPinkNoise(0, 2);
      expect(result).toBeDefined();
      expect(result.source).toBeDefined();
      expect(result.source.buffer).toBeDefined();
    });

    it('should create LFO', () => {
      const desc = {
        args: {},
        positionalArgs: [
          { type: 'literal', value: 2, unit: 'Hz' },
          { type: 'literal', value: 200, unit: 'Hz' },
          { type: 'literal', value: 2000, unit: 'Hz' }
        ]
      };
      const result = compiler.createLFO(desc, 0, 2);

      expect(result).toBeDefined();
      expect(result.lfo).toBeDefined();
      expect(result.offset).toBeDefined();
      expect(result.isModulator).toBe(true);
    });

    it('should create ADSR envelope', () => {
      const desc = {
        args: {
          attack: { type: 'literal', value: 10, unit: 'ms' },
          decay: { type: 'literal', value: 100, unit: 'ms' },
          sustain: { type: 'literal', value: 0.7 },
          release: { type: 'literal', value: 200, unit: 'ms' }
        },
        positionalArgs: []
      };
      const result = compiler.createADSR(desc, 0, 2);

      expect(result).toBeDefined();
      expect(result.node.gain).toBeDefined();
    });

    it('should create delay effect', () => {
      const desc = {
        args: {
          time: { type: 'literal', value: 500, unit: 'ms' },
          feedback: { type: 'literal', value: 0.3 },
          mix: { type: 'literal', value: 0.5 }
        },
        positionalArgs: []
      };
      const result = compiler.createDelay(desc, 0, 2);

      expect(result).toBeDefined();
      expect(result.input).toBeDefined();
      expect(result.output).toBeDefined();
    });

    it('should create pan effect', () => {
      const desc = {
        args: {},
        positionalArgs: [{ type: 'literal', value: 0.5 }]
      };
      const result = compiler.createPan(desc, 0, 2);

      expect(result).toBeDefined();
      expect(result.node.pan).toBeDefined();
    });

    it('should create distortion effect', () => {
      const desc = {
        args: {},
        positionalArgs: [{ type: 'literal', value: 50 }]
      };
      const result = compiler.createDistortion(desc);

      expect(result).toBeDefined();
      expect(result.node.curve).toBeDefined();
    });
  });
});
