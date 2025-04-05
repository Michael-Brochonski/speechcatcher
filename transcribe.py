import asyncio
import websockets
import json
import wave
import sys
import os

async def send_audio_file(websocket_uri, audio_file_path):
    async with websockets.connect(websocket_uri) as websocket:
        print(f"Connected to {websocket_uri}")
        
        # Send configuration
        config = {"config": {"sample_rate": 16000}}
        await websocket.send(json.dumps(config))
        print(f"Sent config: {config}")
        
        # Read and send audio file in chunks
        with wave.open(audio_file_path, 'rb') as wf:
            if wf.getnchannels() != 1 or wf.getsampwidth() != 2 or wf.getframerate() != 16000:
                print(f"Warning: Audio file should be 16kHz mono PCM WAV. Your file is: channels={wf.getnchannels()}, sampwidth={wf.getsampwidth()}, framerate={wf.getframerate()}")
            
            # Process in small chunks (20ms of audio)
            chunk_size = int(wf.getframerate() * 0.02)
            print(f"Sending audio in chunks of {chunk_size} frames...")
            
            while True:
                data = wf.readframes(chunk_size)
                if len(data) == 0:
                    break
                await websocket.send(data)
                
                # Get interim results
                try:
                    result = await asyncio.wait_for(websocket.recv(), timeout=0.01)
                    print(f"Interim result: {result}")
                except asyncio.TimeoutError:
                    pass
            
            # Send EOS (end of stream)
            await websocket.send(json.dumps({"eof": 1}))
            print("Sent EOF signal")
            
            # Get final result
            try:
                final_result = await websocket.recv()
                print("\nFinal transcription result:")
                print(final_result)
            except Exception as e:
                print(f"Error receiving final result: {e}")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(f"Usage: {sys.argv[0]} path_to_audio_file.wav")
        sys.exit(1)
    
    audio_file = sys.argv[1]
    if not os.path.exists(audio_file):
        print(f"Error: File {audio_file} does not exist")
        sys.exit(1)
        
    uri = "ws://localhost:2700"
    print(f"Sending {audio_file} to {uri}")
    
    asyncio.run(send_audio_file(uri, audio_file)) 