# Auralis

A domain-specific language for describing and generating sounds with readable, musical syntax.

## Usage

Open `index.html` in a web browser to launch the interactive demo.

## Example

```auralis
sound BassDrum:
  body = sine(50Hz) → decay(400ms)
  click = white → highpass(2000Hz) → decay(30ms)
  mix body + click
```

## Features

- Readable syntax with pipe operators (`→`) for signal flow
- Oscillators: sine, triangle, square, saw
- Effects: decay, reverb, filters, distortion
- Mix signals with `+` operator
- Web Audio API implementation
