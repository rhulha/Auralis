# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Auralis is a domain-specific language (DSL) for describing and generating sounds with readable, musical syntax. It prioritizes aesthetic clarity over technical implementation details, allowing users to describe what a sound is rather than how to generate it algorithmically.

## Architecture

The codebase follows a three-layer architecture:

1. **Parser** (`auralis-parser.js`) - Lexical analysis and AST generation
   - Tokenizes Auralis source code (handles operators: `→`, `+`, keywords, units like Hz/ms/dB)
   - Builds Abstract Syntax Tree with nodes: `SoundDef`, `Pipeline`, `Mix`, `FunctionCall`, `Assignment`
   - Preserves indentation-based scoping (2 spaces per level)

2. **Compiler** (`auralis-compiler.js`) - AST to Web Audio DSP graph
   - Evaluates AST expressions into intermediate representations
   - Flattens pipelines and mixes into linear chains
   - Creates Web Audio nodes (oscillators, filters, gain nodes, convolution)
   - All audio node creation functions return `{ node, input, output }` structure for consistent chaining
   - Handles unit parsing: `parseFrequency()`, `parseTime()`, `parseAmplitude()`

3. **Engine** (`auralis-engine.js`) - Runtime interface
   - Initializes AudioContext
   - Exposes `compile()` and `play()` methods
   - Manages audio context lifecycle (init, suspend, resume)

## Key Design Patterns

### Node Structure
All audio graph builders return objects with this structure:
```js
{
  node: AudioNode,      // The primary node
  input: AudioNode,     // Where to connect incoming signals
  output: AudioNode,    // Where to read outgoing signals
  source?: AudioNode    // Optional: for schedulable sources (oscillators, buffers)
}
```

### Pipeline Chaining
Pipelines use the `→` operator and connect left-to-right:
- Extract `output` from previous stage
- Connect to `input` of next stage
- Special handling for reverb which pre-wires dry/wet mixing

### Signal Mixing
The `+` operator flattens all sources into a single gain node that sums them.

## Language Syntax

See `design_spec.md` for complete language specification. Key operators:
- `→` - Signal flow (pipeline)
- `+` - Mix signals
- `sound Name:` - Define reusable sound
- Indentation defines scope (2 spaces)

Units are explicit: `440Hz`, `200ms`, `3s`, `-3dB`

## Running the Demo

Open `index.html` in a web browser. The app uses ES6 modules, so must be served via HTTP(S) or file:// with a browser that supports module imports.

The demo provides:
- Code editor with live compilation
- Pre-loaded examples (bass drum, snare, bell, synth lead, hi-hat)
- AST visualization
- Duration control

## Adding New Audio Functions

To add a new DSL function (e.g., `chorus()`):

1. Add case in `auralis-compiler.js` → `buildFunction()`
2. Implement `createChorus(desc, startTime, endTime)` method
3. Return `{ node, input, output }` structure
4. Parse arguments from `desc.positionalArgs` and `desc.args`
5. Use helper methods: `parseFrequency()`, `parseTime()`, `parseAmplitude()`

## Important Notes

- Audio nodes must be scheduled before playback (oscillators need `.start()`)
- Exponential ramps require non-zero values (use 0.001 instead of 0)
- The compiler evaluates sound definitions lazily - assignments build context, final expression is output
- Browser autoplay policies require user interaction before AudioContext can play audio
