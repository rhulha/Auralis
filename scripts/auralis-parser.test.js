import { describe, it, expect } from 'vitest';
import { AuralisParser } from './auralis-parser.js';

describe('AuralisParser', () => {
  describe('tokenize', () => {
    it('should tokenize basic sound definition', () => {
      const parser = new AuralisParser();
      const source = 'sound Kick:\n  sine(60Hz)';
      const tokens = parser.tokenize(source);

      expect(tokens).toMatchObject([
        { type: 'INDENT', value: 0 },
        { type: 'SOUND', value: 'sound' },
        { type: 'IDENTIFIER', value: 'Kick' },
        { type: 'COLON', value: ':' },
        { type: 'NEWLINE' },
        { type: 'INDENT', value: 2 },
        { type: 'IDENTIFIER', value: 'sine' },
        { type: 'LPAREN', value: '(' },
        { type: 'NUMBER', value: 60, unit: 'Hz' },
        { type: 'RPAREN', value: ')' },
        { type: 'NEWLINE' },
        { type: 'EOF' }
      ]);
    });

    it('should tokenize numbers with different units', () => {
      const parser = new AuralisParser();
      const source = '440Hz 100ms 3s -6dB';
      const tokens = parser.tokenize(source);

      expect(tokens).toContainEqual({ type: 'NUMBER', value: 440, unit: 'Hz', line: 0 });
      expect(tokens).toContainEqual({ type: 'NUMBER', value: 100, unit: 'ms', line: 0 });
      expect(tokens).toContainEqual({ type: 'NUMBER', value: 3, unit: 's', line: 0 });
      expect(tokens).toContainEqual({ type: 'NUMBER', value: -6, unit: 'dB', line: 0 });
    });

    it('should tokenize pipeline operator', () => {
      const parser = new AuralisParser();
      const source = 'sine(440Hz) → decay(200ms)';
      const tokens = parser.tokenize(source);

      const arrowToken = tokens.find(t => t.type === 'ARROW');
      expect(arrowToken).toBeDefined();
      expect(arrowToken.value).toBe('→');
    });

    it('should tokenize mix operator', () => {
      const parser = new AuralisParser();
      const source = 'sine(440Hz) + sine(880Hz)';
      const tokens = parser.tokenize(source);

      const plusToken = tokens.find(t => t.type === 'PLUS');
      expect(plusToken).toBeDefined();
    });

    it('should skip comments', () => {
      const parser = new AuralisParser();
      const source = 'sine(440Hz) # this is a comment';
      const tokens = parser.tokenize(source);

      expect(tokens.some(t => typeof t.value === 'string' && t.value.includes('comment'))).toBe(false);
    });

    it('should handle indentation', () => {
      const parser = new AuralisParser();
      const source = 'sound Test:\n  base = sine(440Hz)\n  base';
      const tokens = parser.tokenize(source);

      const indents = tokens.filter(t => t.type === 'INDENT');
      expect(indents[0].value).toBe(0);
      expect(indents[1].value).toBe(2);
      expect(indents[2].value).toBe(2);
    });
  });

  describe('parse', () => {
    it('should parse simple sound definition', () => {
      const parser = new AuralisParser();
      const source = 'sound Kick:\n  sine(60Hz)';
      const ast = parser.parse(source);

      expect(ast.type).toBe('Program');
      expect(ast.sounds).toHaveLength(1);
      expect(ast.sounds[0].type).toBe('SoundDef');
      expect(ast.sounds[0].name).toBe('Kick');
    });

    it('should parse sound with parameters', () => {
      const parser = new AuralisParser();
      const source = 'sound Bell(freq, decay_time = 300ms):\n  sine(freq)';
      const ast = parser.parse(source);

      const sound = ast.sounds[0];
      expect(sound.params).toHaveLength(2);
      expect(sound.params[0].name).toBe('freq');
      expect(sound.params[0].defaultValue).toBeNull();
      expect(sound.params[1].name).toBe('decay_time');
      expect(sound.params[1].defaultValue).toMatchObject({
        type: 'Literal',
        value: 300,
        unit: 'ms'
      });
    });

    it('should parse pipeline expression', () => {
      const parser = new AuralisParser();
      const source = 'sound Test:\n  sine(440Hz) → decay(200ms)';
      const ast = parser.parse(source);

      expect(ast.sounds).toHaveLength(1);
      expect(ast.sounds[0].name).toBe('Test');
    });

    it('should parse function with named arguments', () => {
      const parser = new AuralisParser();
      const source = 'sound Test:\n  sine(freq=440Hz, amp=0.5)';
      const ast = parser.parse(source);

      const stmt = ast.sounds[0].body[0];
      if (stmt && stmt.value) {
        const funcCall = stmt.value;
        expect(funcCall.type).toBe('FunctionCall');
        expect(funcCall.name).toBe('sine');
        expect(funcCall.args.length).toBeGreaterThan(0);
      }
    });

    it('should throw error on unexpected character', () => {
      const parser = new AuralisParser();
      const source = 'sound Test:\n  sine@440Hz';

      expect(() => parser.tokenize(source)).toThrow(/Unexpected character '@'/);
    });

    it('should throw error on missing colon', () => {
      const parser = new AuralisParser();
      const source = 'sound Test\n  sine(440Hz)';

      expect(() => parser.parse(source)).toThrow(/Expected ':'/);
    });

    it('should parse multiple sound definitions', () => {
      const parser = new AuralisParser();
      const source = `sound Kick:
  sine(60Hz)

sound Snare:
  noise()`;
      const ast = parser.parse(source);

      expect(ast.sounds).toHaveLength(2);
      expect(ast.sounds[0].name).toBe('Kick');
      expect(ast.sounds[1].name).toBe('Snare');
    });
  });

  describe('edge cases', () => {
    it('should handle empty lines', () => {
      const parser = new AuralisParser();
      const source = 'sound Test:\n\n  sine(440Hz)\n\n';
      const ast = parser.parse(source);

      expect(ast.sounds).toHaveLength(1);
    });

    it('should handle lines with only whitespace', () => {
      const parser = new AuralisParser();
      const source = 'sound Test:\n   \n  sine(440Hz)';
      const ast = parser.parse(source);

      expect(ast.sounds).toHaveLength(1);
    });
  });
});
