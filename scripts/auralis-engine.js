import { AuralisParser } from './auralis-parser.js';
import { AuralisCompiler } from './auralis-compiler.js';
import { audioBufferToWav } from './wav-encoder.js';

export class AuralisEngine {
  constructor() {
    this.audioContext = null;
    this.parser = null;
    this.compiler = null;
    this.ast = null;
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

    this.ast = this.parser.parse(source);
    this.compiler.compile(this.ast);
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

  async render(soundName, args = {}, duration = 2, sampleRate = 44100) {
    if (!this.ast) {
      throw new Error('Nothing compiled. Call compile() first.');
    }

    const length = Math.ceil(sampleRate * duration);
    const offline = new OfflineAudioContext(2, length, sampleRate);

    const compiler = new AuralisCompiler(offline);
    compiler.compile(this.ast);

    const soundDesc = compiler.createSound(soundName, args);
    const audioGraph = compiler.buildAudioGraph(soundDesc, duration);

    if (audioGraph) {
      const finalNode = audioGraph.output || audioGraph.node || audioGraph;
      if (finalNode && finalNode.connect) {
        finalNode.connect(offline.destination);
      }
    }

    return await offline.startRendering();
  }

  async renderToWav(soundName, args = {}, duration = 2, sampleRate = 44100) {
    const buffer = await this.render(soundName, args, duration, sampleRate);
    return audioBufferToWav(buffer);
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
