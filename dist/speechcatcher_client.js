#!/usr/bin/env node
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const ws_1 = __importDefault(require("ws"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const child_process_1 = require("child_process");
const argparse_1 = require("argparse");
const mic_1 = __importDefault(require("mic"));
const wav = __importStar(require("wav"));
// For audio processing
// Note: TypeScript doesn't have direct equivalents for scipy/numpy
// You may need to use a specialized audio processing library
// or implement the filters using Web Audio API if in browser context
class SpeechcatcherClient {
    constructor(serverUrl = "ws://localhost:2700", sampleRate = 16000) {
        this.websocket = null;
        this.results = [];
        this.isFinal = false;
        this.serverUrl = serverUrl;
        this.sampleRate = sampleRate;
    }
    async connect() {
        return new Promise((resolve, reject) => {
            this.websocket = new ws_1.default(this.serverUrl);
            this.websocket.on('open', () => {
                this.websocket?.send(JSON.stringify({
                    config: { sample_rate: this.sampleRate }
                }));
                resolve();
            });
            this.websocket.on('error', (error) => {
                reject(error);
            });
        });
    }
    async close() {
        return new Promise((resolve, reject) => {
            if (!this.websocket) {
                resolve(null);
                return;
            }
            this.websocket.on('message', (message) => {
                const finalResponse = message.toString();
                this.websocket?.close();
                resolve(finalResponse);
            });
            this.websocket.on('error', (error) => {
                reject(error);
            });
            this.websocket.send(JSON.stringify({ eof: 1 }));
        });
    }
    async processAudioChunk(audioChunk) {
        return new Promise(async (resolve, reject) => {
            if (!this.websocket) {
                await this.connect();
            }
            this.websocket?.on('message', (message) => {
                resolve(message.toString());
            });
            this.websocket?.on('error', (error) => {
                reject(error);
            });
            this.websocket?.send(audioChunk);
        });
    }
    // Note: Audio enhancement would require a specialized audio processing library
    // This is a simplified placeholder that doesn't actually apply filters
    enhanceAudioChunk(audioChunk, applyFilter = true) {
        if (audioChunk.length === 0) {
            return audioChunk;
        }
        if (applyFilter) {
            // In a real implementation, we would:
            // 1. Convert Buffer to Float32Array
            // 2. Apply bandpass filter (250Hz-4000Hz)
            // 3. Normalize audio level
            // 4. Apply pre-emphasis
            // 5. Convert back to Buffer
            // This would require specialized DSP libraries like node-fft
            // or implementing the algorithms directly
            console.log("Audio enhancement applied (placeholder)");
        }
        return audioChunk;
    }
}
// File transcription function
async function transcribeFile(filePath, serverUrl, enhance = true, chunkSize = 4000) {
    const client = new SpeechcatcherClient(serverUrl);
    await client.connect();
    const tempPath = `temp_${path.basename(filePath)}.wav`;
    try {
        // Convert input file to a format we can stream easily using ffmpeg
        await new Promise((resolve, reject) => {
            const ffmpeg = (0, child_process_1.spawn)('ffmpeg', [
                '-i', filePath,
                '-ar', client.sampleRate.toString(),
                '-ac', '1',
                '-f', 'wav',
                '-acodec', 'pcm_s16le',
                '-af', 'highpass=f=50,lowpass=f=8000,volume=1.5',
                tempPath
            ]);
            ffmpeg.on('close', (code) => {
                if (code === 0)
                    resolve();
                else
                    reject(new Error(`ffmpeg process exited with code ${code}`));
            });
        });
        // Read and process the file in chunks
        const allResponses = [];
        const fileBuffer = fs.readFileSync(tempPath);
        const wavReader = new wav.Reader();
        // Setup wav reader
        wavReader.on('format', async ({ audioFormat, sampleRate, channels }) => {
            // Skip WAV header (44 bytes) and read in chunks
            let offset = 44;
            while (offset < fileBuffer.length) {
                const audioChunk = fileBuffer.slice(offset, offset + chunkSize * 2); // *2 because 16-bit = 2 bytes per sample
                offset += audioChunk.length;
                if (audioChunk.length === 0)
                    break;
                // Enhance audio if requested
                const processedChunk = enhance ? client.enhanceAudioChunk(audioChunk) : audioChunk;
                // Process chunk
                const response = await client.processAudioChunk(processedChunk);
                allResponses.push(response);
                console.log(response);
                if (offset >= fileBuffer.length)
                    break;
            }
            // Get final result
            const finalResponse = await client.close();
            if (finalResponse)
                allResponses.push(finalResponse);
            console.log(finalResponse);
            // Compile results
            const results = allResponses
                .map(response => {
                try {
                    return JSON.parse(response);
                }
                catch (e) {
                    return null;
                }
            })
                .filter(r => r !== null);
            const finalText = results
                .filter(r => r && r.text)
                .map(r => r.text.trim())
                .join(" ");
            return { text: finalText, responses: results };
        });
        // Feed the file buffer to the wav reader
        wavReader.write(fileBuffer);
        wavReader.end();
    }
    finally {
        // Clean up temp file
        if (fs.existsSync(tempPath)) {
            fs.unlinkSync(tempPath);
        }
    }
}
// Microphone streaming function
async function transcribeMicrophone(serverUrl, enhance = true, chunkSize = 1600) {
    const client = new SpeechcatcherClient(serverUrl);
    await client.connect();
    // Setup microphone
    const micInstance = (0, mic_1.default)({
        rate: client.sampleRate.toString(),
        channels: '1',
        debug: false,
        fileType: 'wav'
    });
    const micInputStream = micInstance.getAudioStream();
    console.log("Listening... Press Ctrl+C to stop.");
    // Handle Ctrl+C to stop gracefully
    process.on('SIGINT', async () => {
        console.log("\nStopping...");
        micInstance.stop();
        const finalResponse = await client.close();
        console.log(finalResponse);
        process.exit(0);
    });
    // Process the audio stream
    micInputStream.on('data', async (data) => {
        try {
            // Enhance audio if requested
            const processedChunk = enhance ? client.enhanceAudioChunk(data) : data;
            // Process chunk
            const response = await client.processAudioChunk(processedChunk);
            console.log(response);
        }
        catch (error) {
            console.error("Error processing audio chunk:", error);
        }
    });
    // Start the microphone
    micInstance.start();
}
async function main() {
    const parser = new argparse_1.ArgumentParser({
        description: "Speechcatcher WebSocket Client for Real-time Transcription"
    });
    parser.add_argument('--input', {
        help: 'Input audio file (if not specified, uses microphone)'
    });
    parser.add_argument('--port', {
        default: 2700,
        type: 'int',
        help: 'WebSocket server port (default: 2700)'
    });
    parser.add_argument('--host', {
        default: 'localhost',
        help: 'WebSocket server host (default: localhost)'
    });
    parser.add_argument('--no-enhance', {
        action: 'store_true',
        help: 'Disable audio enhancement'
    });
    parser.add_argument('--output', {
        help: 'Save transcript to file'
    });
    parser.add_argument('--chunk-size', {
        default: 4000,
        type: 'int',
        help: 'Audio chunk size in samples'
    });
    const args = parser.parse_args();
    const serverUrl = `ws://${args.host}:${args.port}`;
    // Determine whether to use file or microphone input
    if (args.input) {
        try {
            const result = await transcribeFile(args.input, serverUrl, !args.no_enhance, args.chunk_size);
            // Save output if requested
            if (args.output && result) {
                fs.writeFileSync(args.output, JSON.stringify(result, null, 2));
                console.log(`Transcript saved to ${args.output}`);
            }
        }
        catch (error) {
            console.error("Error transcribing file:", error);
        }
    }
    else {
        try {
            await transcribeMicrophone(serverUrl, !args.no_enhance, args.chunk_size);
        }
        catch (error) {
            if (error.code === 'MODULE_NOT_FOUND') {
                console.error("Error: Required modules for microphone input are missing.");
                console.error("Install with: npm install mic");
            }
            else {
                console.error("Error:", error);
            }
        }
    }
}
// Run the main function
try {
    main().catch((error) => {
        console.error("Error:", error);
        // Suggestion for missing packages
        if (error.code === 'MODULE_NOT_FOUND') {
            const errorMessage = error.toString();
            if (errorMessage.includes('mic')) {
                console.error("Install mic with: npm install mic");
            }
            else if (errorMessage.includes('ws')) {
                console.error("Install websockets with: npm install ws");
            }
            else if (errorMessage.includes('wav')) {
                console.error("Install wav with: npm install wav");
            }
        }
    });
}
catch (error) {
    console.error("Error:", error);
}
