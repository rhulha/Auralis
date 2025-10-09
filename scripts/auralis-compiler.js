export class AuralisCompiler {
  constructor(audioContext) {
    this.audioContext = audioContext;
    this.soundDefs = new Map();
  }

  compile(ast) {
    for (const sound of ast.sounds) {
      this.soundDefs.set(sound.name, sound);
    }
    return this;
  }

  createSound(name, args = {}) {
    const soundDef = this.soundDefs.get(name);
    if (!soundDef) {
      throw new Error(`Sound '${name}' not defined`);
    }

    const params = this.resolveParams(soundDef.params, args);
    const context = { ...params };

    for (const stmt of soundDef.body) {
      if (stmt.type === 'Assignment') {
        context[stmt.name] = this.evaluateExpression(stmt.value, context);
      } else if (stmt.type === 'Expression') {
        context._output = this.evaluateExpression(stmt.value, context);
      }
    }

    return context._output || context;
  }

  resolveParams(paramDefs, args) {
    const result = {};
    for (const param of paramDefs) {
      result[param.name] = args[param.name] !== undefined
        ? args[param.name]
        : this.evaluateLiteral(param.defaultValue);
    }
    return result;
  }

  evaluateExpression(expr, context) {
    switch (expr.type) {
      case 'Pipeline':
        return {
          type: 'pipeline',
          stages: this.flattenPipeline(expr, context)
        };

      case 'Mix':
        return {
          type: 'mix',
          sources: this.flattenMix(expr, context)
        };

      case 'FunctionCall':
        return this.evaluateFunctionCall(expr, context);

      case 'Identifier':
        if (context[expr.name] !== undefined) {
          return context[expr.name];
        }
        return { type: 'identifier', name: expr.name };

      case 'Literal':
        return this.evaluateLiteral(expr);

      default:
        throw new Error(`Unknown expression type: ${expr.type}`);
    }
  }

  flattenPipeline(expr, context) {
    const stages = [];

    const collect = (node) => {
      if (node.type === 'Pipeline') {
        collect(node.left);
        stages.push(this.evaluateExpression(node.right, context));
      } else {
        stages.push(this.evaluateExpression(node, context));
      }
    };

    collect(expr);
    return stages;
  }

  flattenMix(expr, context) {
    const sources = [];

    const collect = (node) => {
      if (node.type === 'Mix') {
        collect(node.left);
        collect(node.right);
      } else {
        sources.push(this.evaluateExpression(node, context));
      }
    };

    collect(expr);
    return sources;
  }

  evaluateFunctionCall(expr, context) {
    const args = {};
    const positionalArgs = [];

    for (const arg of expr.args) {
      if (arg.name) {
        args[arg.name] = this.evaluateExpression(arg.value, context);
      } else {
        positionalArgs.push(this.evaluateExpression(arg.value, context));
      }
    }

    return {
      type: 'function',
      name: expr.name,
      args,
      positionalArgs
    };
  }

  evaluateLiteral(expr) {
    if (!expr) return null;
    if (expr.type === 'Literal') {
      return { type: 'literal', value: expr.value, unit: expr.unit };
    }
    return this.evaluateExpression(expr, {});
  }

  parseFrequency(value) {
    if (typeof value === 'number') return value;
    if (value.type === 'literal') {
      if (value.unit === 'Hz') return value.value;
      if (value.unit === 'kHz') return value.value * 1000;
    }
    return 440;
  }

  parseTime(value) {
    if (typeof value === 'number') return value;
    if (value.type === 'literal') {
      if (value.unit === 's') return value.value;
      if (value.unit === 'ms') return value.value / 1000;
    }
    return 1;
  }

  parseAmplitude(value) {
    if (typeof value === 'number') return value;
    if (value.type === 'literal') {
      if (value.unit === 'dB') {
        return Math.pow(10, value.value / 20);
      }
      return value.value;
    }
    return 1;
  }

  buildAudioGraph(soundDesc, duration = 2) {
    const now = this.audioContext.currentTime;
    const endTime = now + duration;

    console.log('buildAudioGraph received:', soundDesc);

    if (soundDesc.type === 'pipeline') {
      return this.buildPipeline(soundDesc.stages, now, endTime);
    }

    if (soundDesc.type === 'mix') {
      return this.buildMix(soundDesc.sources, now, endTime);
    }

    if (soundDesc.type === 'function') {
      return this.buildFunction(soundDesc, now, endTime);
    }

    console.warn('buildAudioGraph: Unknown sound desc type', soundDesc);
    return null;
  }

  buildPipeline(stages, startTime, endTime) {
    let firstNode = null;
    let lastNode = null;

    for (const stage of stages) {
      const nodeInfo = this.buildNode(stage, startTime, endTime);

      if (nodeInfo) {
        if (!firstNode) {
          firstNode = nodeInfo;
          lastNode = nodeInfo;
        } else {
          const prevOutput = lastNode.output || lastNode.node || lastNode;
          const currInput = nodeInfo.input || nodeInfo.node || nodeInfo;

          if (nodeInfo.connect) {
            nodeInfo.connect(prevOutput);
          } else {
            prevOutput.connect(currInput);
          }

          lastNode = nodeInfo;
        }
      }
    }

    if (!firstNode) return null;

    return {
      input: firstNode.input || firstNode.node || firstNode,
      output: lastNode.output || lastNode.node || lastNode,
      nodes: [firstNode, lastNode]
    };
  }

  buildMix(sources, startTime, endTime) {
    const gainNode = this.audioContext.createGain();
    gainNode.gain.value = 1;

    console.log('buildMix sources:', sources);

    for (const source of sources) {
      console.log('buildMix processing source:', source);
      const nodeInfo = this.buildNode(source, startTime, endTime);
      console.log('buildMix nodeInfo:', nodeInfo);
      if (nodeInfo) {
        const output = nodeInfo.output || nodeInfo.node || nodeInfo;
        output.connect(gainNode);
      }
    }

    return { node: gainNode, input: gainNode, output: gainNode };
  }

  buildNode(desc, startTime, endTime) {
    if (desc.type === 'pipeline') {
      return this.buildPipeline(desc.stages, startTime, endTime);
    }

    if (desc.type === 'mix') {
      return this.buildMix(desc.sources, startTime, endTime);
    }

    if (desc.type === 'function') {
      return this.buildFunction(desc, startTime, endTime);
    }

    if (desc.type === 'identifier') {
      if (desc.name === 'white' || desc.name === 'noise') {
        return this.createWhiteNoise(startTime, endTime);
      }
      if (desc.name === 'pink') {
        return this.createPinkNoise(startTime, endTime);
      }
    }

    const gain = this.audioContext.createGain();
    gain.gain.value = 1;
    return { node: gain, input: gain, output: gain };
  }

  buildFunction(desc, startTime, endTime) {
    const funcName = desc.name;
    const duration = endTime - startTime;

    switch (funcName) {
      case 'sine':
        return this.createOscillator('sine', desc, startTime, endTime);
      case 'triangle':
        return this.createOscillator('triangle', desc, startTime, endTime);
      case 'square':
        return this.createOscillator('square', desc, startTime, endTime);
      case 'saw':
      case 'sawtooth':
        return this.createOscillator('sawtooth', desc, startTime, endTime);

      case 'lfo':
        return this.createLFO(desc, startTime, endTime);

      case 'decay':
        return this.createDecay(desc, startTime, endTime);
      case 'adsr':
        return this.createADSR(desc, startTime, endTime);
      case 'pitch_down':
        return this.createPitchDown(desc, startTime, endTime);
      case 'fade_in':
        return this.createFadeIn(desc, startTime, endTime);

      case 'reverb':
        return this.createReverb(desc);
      case 'lowpass':
        return this.createFilter('lowpass', desc);
      case 'highpass':
        return this.createFilter('highpass', desc);
      case 'bandpass':
        return this.createFilter('bandpass', desc);

      case 'distort':
        return this.createDistortion(desc);

      case 'envelope':
        return this.createEnvelope(desc, startTime, endTime);

      case 'short':
        return this.createShort(desc, startTime, endTime);

      default:
        console.warn(`Unknown function: ${funcName}`);
        return null;
    }
  }

  createOscillator(type, desc, startTime, endTime) {
    const osc = this.audioContext.createOscillator();
    osc.type = type;

    const freq = desc.positionalArgs[0] || desc.args.freq || desc.args.f;
    osc.frequency.value = this.parseFrequency(freq);

    const gain = this.audioContext.createGain();
    const amp = desc.args.amp || desc.args.amplitude;
    gain.gain.value = amp ? this.parseAmplitude(amp) : 0.5;

    osc.connect(gain);
    osc.start(startTime);
    osc.stop(endTime);

    return { node: gain, input: gain, output: gain, source: osc };
  }

  createWhiteNoise(startTime, endTime) {
    const bufferSize = this.audioContext.sampleRate * (endTime - startTime);
    const buffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const source = this.audioContext.createBufferSource();
    source.buffer = buffer;

    const gain = this.audioContext.createGain();
    gain.gain.value = 0.5;

    source.connect(gain);
    source.start(startTime);

    return { node: gain, input: gain, output: gain, source };
  }

  createPinkNoise(startTime, endTime) {
    const bufferSize = this.audioContext.sampleRate * (endTime - startTime);
    const buffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
    const data = buffer.getChannelData(0);

    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;

    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
      b6 = white * 0.115926;
    }

    const source = this.audioContext.createBufferSource();
    source.buffer = buffer;

    const gain = this.audioContext.createGain();
    gain.gain.value = 0.5;

    source.connect(gain);
    source.start(startTime);

    return { node: gain, input: gain, output: gain, source };
  }

  createDecay(desc, startTime, endTime) {
    const gain = this.audioContext.createGain();
    const duration = this.parseTime(desc.positionalArgs[0] || desc.args.time);

    gain.gain.setValueAtTime(1, startTime);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

    return { node: gain, input: gain, output: gain };
  }

  createPitchDown(desc, startTime, endTime) {
    return { type: 'pitch_down', desc, startTime, endTime };
  }

  createFadeIn(desc, startTime, endTime) {
    const gain = this.audioContext.createGain();
    const duration = this.parseTime(desc.positionalArgs[0] || desc.args.time);

    gain.gain.setValueAtTime(0.001, startTime);
    gain.gain.exponentialRampToValueAtTime(1, startTime + duration);

    return { node: gain, input: gain, output: gain };
  }

  createReverb(desc) {
    const convolver = this.audioContext.createConvolver();
    const rate = this.audioContext.sampleRate;
    const length = rate * 2;
    const impulse = this.audioContext.createBuffer(2, length, rate);

    for (let channel = 0; channel < 2; channel++) {
      const data = impulse.getChannelData(channel);
      for (let i = 0; i < length; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 2);
      }
    }

    convolver.buffer = impulse;

    const dry = this.audioContext.createGain();
    const wet = this.audioContext.createGain();
    const input = this.audioContext.createGain();
    const output = this.audioContext.createGain();

    dry.gain.value = 0.7;
    wet.gain.value = 0.3;

    input.connect(dry);
    input.connect(convolver);
    convolver.connect(wet);
    dry.connect(output);
    wet.connect(output);

    return { node: output, input, output };
  }

  createFilter(type, desc) {
    const filter = this.audioContext.createBiquadFilter();
    filter.type = type;

    const freq = desc.positionalArgs[0] || desc.args.freq || desc.args.f;
    filter.frequency.value = this.parseFrequency(freq);

    const q = desc.positionalArgs[1] || desc.args.q || desc.args.resonance;
    if (q) {
      if (type === 'bandpass') {
        filter.Q.value = this.parseFrequency(q) / filter.frequency.value;
      } else {
        filter.Q.value = this.parseAmplitude(q);
      }
    }

    return { node: filter, input: filter, output: filter };
  }

  createDistortion(desc) {
    const distortion = this.audioContext.createWaveShaper();
    const amount = desc.positionalArgs[0] || desc.args.amount || { type: 'literal', value: 50 };
    const k = this.parseAmplitude(amount);

    const samples = 44100;
    const curve = new Float32Array(samples);
    const deg = Math.PI / 180;

    for (let i = 0; i < samples; i++) {
      const x = (i * 2) / samples - 1;
      curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
    }

    distortion.curve = curve;
    distortion.oversample = '4x';

    return { node: distortion, input: distortion, output: distortion };
  }

  createEnvelope(desc, startTime, endTime) {
    const gain = this.audioContext.createGain();

    gain.gain.setValueAtTime(0.001, startTime);
    gain.gain.linearRampToValueAtTime(1, startTime + 0.01);
    gain.gain.linearRampToValueAtTime(0.001, endTime - 0.1);

    return { node: gain, input: gain, output: gain };
  }

  createShort(desc, startTime, endTime) {
    const gain = this.audioContext.createGain();
    const duration = this.parseTime(desc.positionalArgs[0] || desc.args.time);

    gain.gain.setValueAtTime(1, startTime);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

    return { node: gain, input: gain, output: gain };
  }

  createLFO(desc, startTime, endTime) {
    const rate = this.parseFrequency(desc.positionalArgs[0] || desc.args.rate || { type: 'literal', value: 2, unit: 'Hz' });
    const min = this.parseFrequency(desc.positionalArgs[1] || desc.args.min || { type: 'literal', value: 200, unit: 'Hz' });
    const max = this.parseFrequency(desc.positionalArgs[2] || desc.args.max || { type: 'literal', value: 2000, unit: 'Hz' });

    const lfo = this.audioContext.createOscillator();
    lfo.frequency.value = rate;
    lfo.type = 'sine';

    const lfoGain = this.audioContext.createGain();
    lfoGain.gain.value = (max - min) / 2;

    const offset = this.audioContext.createConstantSource();
    offset.offset.value = min + (max - min) / 2;

    lfo.connect(lfoGain);

    lfo.start(startTime);
    lfo.stop(endTime);
    offset.start(startTime);
    offset.stop(endTime);

    return {
      node: lfoGain,
      input: null,
      output: lfoGain,
      lfo: lfo,
      offset: offset,
      isModulator: true
    };
  }

  createADSR(desc, startTime, endTime) {
    const gain = this.audioContext.createGain();

    const attackTime = this.parseTime(desc.args.attack || desc.positionalArgs[0] || { type: 'literal', value: 10, unit: 'ms' });
    const decayTime = this.parseTime(desc.args.decay || desc.positionalArgs[1] || { type: 'literal', value: 100, unit: 'ms' });
    const sustainLevel = this.parseAmplitude(desc.args.sustain || desc.positionalArgs[2] || { type: 'literal', value: 0.7 });
    const releaseTime = this.parseTime(desc.args.release || desc.positionalArgs[3] || { type: 'literal', value: 200, unit: 'ms' });

    const attackEnd = startTime + attackTime;
    const decayEnd = attackEnd + decayTime;
    const releaseStart = Math.max(decayEnd, endTime - releaseTime);

    gain.gain.setValueAtTime(0.001, startTime);
    gain.gain.exponentialRampToValueAtTime(1, attackEnd);
    gain.gain.exponentialRampToValueAtTime(Math.max(sustainLevel, 0.001), decayEnd);

    if (releaseStart < endTime) {
      gain.gain.setValueAtTime(Math.max(sustainLevel, 0.001), releaseStart);
      gain.gain.exponentialRampToValueAtTime(0.001, endTime);
    }

    return { node: gain, input: gain, output: gain };
  }
}
