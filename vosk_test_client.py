#!/usr/bin/env python3

import asyncio
import websockets
import argparse
import wave
import subprocess
import sys
import io
import numpy as np
import os
import json
import queue
import pyaudio
import time
from scipy import signal

class SpeechcatcherClient:
    def __init__(self, server_url="ws://localhost:2700", sample_rate=16000):
        self.server_url = server_url
        self.sample_rate = sample_rate
        self.websocket = None
        self.buffer = queue.Queue()
        self.results = []
        self.is_final = False
        
    async def connect(self):
        self.websocket = await websockets.connect(self.server_url)
        await self.websocket.send(f'{{ "config" : {{ "sample_rate" : {self.sample_rate} }} }}')
        
    async def close(self):
        if self.websocket:
            await self.websocket.send('{"eof" : 1}')
            final_response = await self.websocket.recv()
            await self.websocket.close()
            return final_response
        return None
    
    async def process_audio_chunk(self, audio_chunk):
        """Process a single audio chunk in real-time"""
        if not self.websocket:
            await self.connect()
            
        # Send the audio chunk
        await self.websocket.send(audio_chunk)
        
        # Get the response
        response = await self.websocket.recv()
        return response
    
    def enhance_audio_chunk(self, audio_chunk, apply_filter=True):
        """Apply real-time audio enhancements to a chunk of audio data"""
        # Convert bytes to numpy array (assuming 16-bit PCM)
        data = np.frombuffer(audio_chunk, dtype=np.int16)
        
        if len(data) == 0:
            return audio_chunk
            
        if apply_filter:
            # Apply bandpass filter for speech (250Hz-4000Hz)
            nyquist = 0.5 * self.sample_rate
            low = 250 / nyquist
            high = 4000 / nyquist
            b, a = signal.butter(5, [low, high], btype='band')
            data = signal.lfilter(b, a, data.astype(np.float32))
            
            # Normalize audio level
            rms = np.sqrt(np.mean(data**2)) if len(data) > 0 else 0
            if rms > 0:
                gain = (0.2 * 32768) / rms  # Target level of -14dB
                data = np.clip(data * gain, -32768, 32767)
            
            # Apply pre-emphasis to improve consonant recognition
            data = np.append(data[0], data[1:] - 0.97 * data[:-1])
        
        # Convert back to bytes
        return data.astype(np.int16).tobytes()

# File transcription mode
async def transcribe_file(file_path, server_url, enhance=True, chunk_size=4000):
    """Transcribe an audio file sending chunks to simulate streaming"""
    client = SpeechcatcherClient(server_url)
    await client.connect()
    
    # Convert file to 16kHz mono WAV for processing
    temp_path = f"temp_{os.path.basename(file_path)}.wav"
    
    try:
        # Convert input file to a format we can stream easily
        subprocess.run([
            'ffmpeg', '-i', file_path, 
            '-ar', str(client.sample_rate), '-ac', '1', 
            '-f', 'wav', '-acodec', 'pcm_s16le',
            '-af', 'highpass=f=50,lowpass=f=8000,volume=1.5',
            temp_path
        ], stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=True)
        
        # Open the converted file
        with wave.open(temp_path, 'rb') as wf:
            all_responses = []
            
            # Process in chunks to simulate streaming
            while True:
                audio_chunk = wf.readframes(chunk_size)
                if len(audio_chunk) == 0:
                    break
                    
                # Enhance audio if requested
                if enhance:
                    audio_chunk = client.enhance_audio_chunk(audio_chunk)
                    
                # Process chunk
                response = await client.process_audio_chunk(audio_chunk)
                all_responses.append(response)
                print(response)
        
        # Get final result
        final_response = await client.close()
        all_responses.append(final_response)
        print(final_response)
        
        # Compile results
        results = [json.loads(response) for response in all_responses if response]
        final_text = " ".join([r.get("text", "").strip() for r in results if "text" in r and r.get("text")])
        
        return {"text": final_text, "responses": results}
    
    finally:
        # Clean up temp file
        if os.path.exists(temp_path):
            os.remove(temp_path)

# Microphone streaming mode
async def transcribe_microphone(server_url, enhance=True, chunk_size=1600):
    """Transcribe from microphone in real-time"""
    client = SpeechcatcherClient(server_url)
    await client.connect()
    
    p = pyaudio.PyAudio()
    
    # Open microphone stream
    stream = p.open(
        format=pyaudio.paInt16,
        channels=1,
        rate=client.sample_rate,
        input=True,
        frames_per_buffer=chunk_size
    )
    
    print("Listening... Press Ctrl+C to stop.")
    
    try:
        stream.start_stream()
        
        while True:
            # Read audio chunk from microphone
            audio_chunk = stream.read(chunk_size)
            
            # Enhance audio if requested
            if enhance:
                audio_chunk = client.enhance_audio_chunk(audio_chunk)
                
            # Process chunk
            response = await client.process_audio_chunk(audio_chunk)
            print(response)
            
    except KeyboardInterrupt:
        print("\nStopping...")
    finally:
        # Clean up
        stream.stop_stream()
        stream.close()
        p.terminate()
        
        # Get final result
        final_response = await client.close()
        print(final_response)

async def main_async():
    parser = argparse.ArgumentParser(description="Speechcatcher WebSocket Client for Real-time Transcription")
    parser.add_argument('--input', help='Input audio file (if not specified, uses microphone)')
    parser.add_argument('--port', type=int, default=2700, help='WebSocket server port (default: 2700)')
    parser.add_argument('--host', default='localhost', help='WebSocket server host (default: localhost)')
    parser.add_argument('--no-enhance', action='store_true', help='Disable audio enhancement')
    parser.add_argument('--output', help='Save transcript to file')
    parser.add_argument('--chunk-size', type=int, default=4000, help='Audio chunk size in samples')
    
    args = parser.parse_args()
    
    server_url = f"ws://{args.host}:{args.port}"
    
    # Determine whether to use file or microphone input
    if args.input:
        result = await transcribe_file(
            args.input,
            server_url,
            enhance=not args.no_enhance,
            chunk_size=args.chunk_size
        )
        
        # Save output if requested
        if args.output and result:
            with open(args.output, 'w') as f:
                json.dump(result, f, indent=2)
                print(f"Transcript saved to {args.output}")
                
    else:
        try:
            # Check if PyAudio is available
            import pyaudio
            await transcribe_microphone(
                server_url,
                enhance=not args.no_enhance,
                chunk_size=args.chunk_size
            )
        except ImportError:
            print("Error: PyAudio is required for microphone input.")
            print("Install with: pip install pyaudio")
            sys.exit(1)

def main():
    try:
        asyncio.run(main_async())
    except KeyboardInterrupt:
        print("\nExiting...")
    except Exception as e:
        print(f"Error: {e}")
        
        # Suggestion for missing packages
        if isinstance(e, ModuleNotFoundError):
            missing_module = str(e).split("'")[1]
            if missing_module == 'pyaudio':
                print("Install PyAudio with: pip install pyaudio")
            elif missing_module == 'websockets':
                print("Install websockets with: pip install websockets")
            elif missing_module == 'numpy':
                print("Install numpy with: pip install numpy")

if __name__ == "__main__":
    main()

