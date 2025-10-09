import { AuralisParser } from './auralis-parser.js';
import { AuralisCompiler } from './auralis-compiler.js';

export class AuralisEngine {
  constructor() {
    this.audioContext = null;
    this.parser = null;
    this.compiler = null;
    this.initialized = false;
  }

  async init() {
    if (this.initialized) return;

    this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    this.parser = new AuralisParser();
    this.compiler = new AuralisCompiler(this.audioContext);
    this.initialized = true;

    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }
  }

  compile(source) {
    if (!this.initialized) {
      throw new Error('Engine not initialized. Call init() first.');
    }

    const ast = this.parser.parse(source);
    this.compiler.compile(ast);
    return this;
  }

  play(soundName, args = {}, duration = 2) {
    if (!this.initialized) {
      throw new Error('Engine not initialized. Call init() first.');
    }

    const soundDesc = this.compiler.createSound(soundName, args);
    const audioGraph = this.compiler.buildAudioGraph(soundDesc, duration);

    if (audioGraph) {
      const finalNode = audioGraph.output || audioGraph.node || audioGraph;

      if (finalNode && finalNode.connect) {
        finalNode.connect(this.audioContext.destination);
      }
    }

    return audioGraph;
  }

  stop() {
    if (this.audioContext) {
      this.audioContext.suspend();
    }
  }

  resume() {
    if (this.audioContext) {
      this.audioContext.resume();
    }
  }

  getContext() {
    return this.audioContext;
  }
}
