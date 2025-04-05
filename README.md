# Speechcatcher TypeScript Client

A TypeScript WebSocket client for the Speechcatcher speech recognition service.

## Installation

1. Clone this repository
2. Install dependencies:

```bash
npm install
```

3. Build the TypeScript code:

```bash
npm run build
```

## Usage

### Command Line Options

- `--input`: Input audio file (if not specified, uses microphone)
- `--port`: WebSocket server port (default: 2700)
- `--host`: WebSocket server host (default: localhost)
- `--no-enhance`: Disable audio enhancement
- `--output`: Save transcript to file
- `--chunk-size`: Audio chunk size in samples (default: 4000)

### Transcribing a File

```bash
npm start -- --input /path/to/audio/file.mp3 --output transcript.json
```

### Using Microphone Input

```bash
npm start
```

Press Ctrl+C to stop recording and get the final transcript.

## Requirements

- Node.js 14+
- FFmpeg (for file transcription)
- Compatible audio hardware (for microphone input)

## Notes on Audio Processing

The current implementation includes placeholder functions for audio enhancement. To implement full audio processing with bandpass filtering, normalization, and pre-emphasis, you would need specialized DSP libraries.

## Differences from Python Version

The TypeScript version has the same functionality as the Python version but with these differences:

1. Uses Node.js WebSocket implementation instead of Python's websockets
2. Uses the Node.js 'mic' library for microphone input
3. Audio enhancement is simplified (placeholder only)
4. Uses Promise-based async/await pattern for asynchronous operations 