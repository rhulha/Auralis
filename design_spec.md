Auralis — Sound Language Design Document
1. Overview

Auralis is a domain-specific language (DSL) for describing and generating individual sounds — single notes, percussive hits, or small sonic gestures — with a focus on readability, musicality, and expressiveness.

Unlike general-purpose DSP languages (like SuperCollider or Csound), Auralis prioritizes aesthetic clarity and semantic meaning.
Each program is a sound description, not an algorithm.

2. Design Goals
Goal	Description
Readable	The language should read like structured English or musical notation.
Expressive	Focus on what the sound is, not how it’s technically generated.
Composable	Build complex sounds by layering or chaining simple components.
Deterministic	A given definition should always generate the same sound (no hidden randomness).
Translatable	Can be parsed and executed via engines like Web Audio, SuperCollider, or JUCE.
3. Core Concepts
3.1 Sound Definition

Auralis programs define sound blueprints:

sound PianoNote:
  key = C4
  tone = sine + gentle harmonics
  envelope = soft attack, long decay
  reverb = light room
  velocity = 0.8


sound defines a named reusable sound object.

Indented lines describe attributes (key, tone, envelope, etc.).

Each sound can be instantiated or played by an engine.

3.2 Signal Flow

Auralis uses a pipe operator (→) to show how a signal flows through stages.

sine(440Hz) → decay(1s) → reverb(hall)


Each stage transforms the signal.
This makes signal flow readable and sequential, rather than nested or mathematical.

3.3 Mixing and Layers

Multiple signals can be combined with mix or +.

mix sine(50Hz) + noise → highpass(2kHz)


or equivalently:

sine(50Hz) + noise → highpass(2kHz)


The meaning is the same: both signals are mixed, then filtered.

3.4 Sound Modifiers

Modifiers describe temporal or dynamic changes to signals:

Modifier	Meaning
decay(500ms)	amplitude decay over time
adsr(attack, decay, sustain, release)	full ADSR envelope control
pitch_down(200ms)	pitch falls over time
distort(amount)	nonlinear distortion
fade_in(100ms)	gradual amplitude rise
lfo(rate, min, max)	low frequency oscillator for modulation
reverb(room/hall)	reverb effect
lowpass(freq, q)	low-pass filter with resonance
highpass(freq, q)	high-pass filter with resonance
bandpass(freq, bandwidth)	band-pass filter

Modifiers can be chained with →.

3.5 Envelopes

You can specify envelopes declaratively:

envelope = soft attack, long decay


Equivalent explicit form:

envelope = attack(30ms), decay(600ms), sustain(0.8), release(200ms)

3.6 Oscillators

Oscillators are defined as functions with frequency parameters.

Oscillator	Example	Description
sine(f)	sine(440Hz)	Pure tone
triangle(f)	triangle(180Hz)	Hollow tone
square(f)	square(100Hz)	Bright, hollow tone
saw(f)	saw(200Hz)	Rich harmonic tone
fm(f, mod, index)	fm(440Hz, 5Hz, 2)	FM synthesis oscillator
3.7 Noise Generators
Generator	Example	Description
white	white	Uniform random noise
pink	pink	Lower-frequency emphasis
metallic	metallic(1.2kHz)	Ringy percussive noise
3.8 Constants and Units

Units are written explicitly for clarity:

Type	Example
Frequency	440Hz, 1kHz
Time	200ms, 3s
Amplitude	0.8, -3dB
Pitch	C4, A#3
3.9 Parameters and Reuse

Auralis supports parameterized definitions:

sound Drum(kick_freq=60Hz):
  body = sine(kick_freq) → pitch_down(200ms)
  click = noise → highpass(2kHz) → decay(30ms)
  mix body + click → envelope(instant attack, decay 400ms)

4. Example Sounds
4.1 Bass Drum
sound BassDrum:
  body = sine(50Hz) → decay(400ms)
  click = white → highpass(2kHz) → decay(30ms)
  mix body + click

4.2 Snare Drum
sound SnareDrum:
  body = triangle(180Hz) → decay(200ms)
  noise = white → bandpass(3kHz, 1.5kHz) → decay(300ms)
  mix body + noise

4.3 Acid Bass (Modern)
sound AcidBass:
  mix saw(55Hz) → lowpass(800Hz, q=10) → adsr(attack=5ms, decay=200ms, sustain=0.3, release=100ms)

4.4 Synth Pad (Modern)
sound Pad:
  mix sine(220Hz) + sine(330Hz, amp=0.7) + sine(440Hz, amp=0.5) → adsr(attack=500ms, decay=300ms, sustain=0.8, release=1s)

5. Syntax Summary
Category	Syntax	Example
Definition	sound Name:	sound Snare:
Assignment	name = value	tone = sine(440Hz)
Pipeline	→	sine(440Hz) → reverb(room)
Mixing	+ or mix	mix a + b
Comments	# comment	# percussive tone
Indentation	defines scope	2 spaces per level
6. Grammar (EBNF Sketch)
program     = { sounddef } ;
sounddef    = "sound" identifier ":" newline { indent statement newline } ;
statement   = assignment | mix | pipeline ;
assignment  = identifier "=" expression ;
expression  = function | mix | pipeline | literal ;
mix         = expression "+" expression ;
pipeline    = expression "→" expression ;
function    = identifier "(" [ arglist ] ")" ;
arglist     = argument { "," argument } ;
argument    = identifier "=" literal | literal ;
literal     = number | string | identifier ;

7. Engine Interface

The engine (in JavaScript, Python, or C++) would:

Parse Auralis text → AST (Abstract Syntax Tree)

Compile AST into a DSP graph (WebAudio nodes, SuperCollider UGens, etc.)

Render or play the resulting waveform

Example pseudo-interface:

const sound = Auralis.compile(`
sound BellTone:
  tone = sine(880Hz) + sine(1320Hz, amp=0.3)
  tone → decay(3s) → reverb(hall)
`)
sound.play()

8. Visual Identity

Auralis code should look calm and musical:

Use indentation instead of braces.

Prefer named parameters over positional ones.

Use Unicode symbols where meaningful (→, °, ♯, ♭ optional extensions).

9. Future Extensions

Randomness & Variation: pitch ±5Hz, velocity ~0.1

Pattern blocks: small rhythmic patterns for playback

Sound inheritance: sound BrightBell extends BellTone: tone = add_harmonics(3kHz)

Human-readable rendering: describe(BassDrum) → natural-language explanation