# Speechcatcher Docker Container

This directory contains Docker configuration to run Speechcatcher in both CLI and WebSocket server modes.

## Building the Docker Image

```bash
# From the docker directory
docker-compose build
```

## Running the Container

### WebSocket Server Mode

```bash
# Run in WebSocket server mode with Vosk-compatible output
docker-compose run --rm speechcatcher server --vosk-output-format

# With additional parameters (recommended for proper network exposure)
docker-compose run --rm -p 2700:2700 speechcatcher server --vosk-output-format --model de_streaming_transformer_xl --port 2700 --host 0.0.0.0
```

### CLI Mode

To transcribe a media file (place your media files in the `media` directory at the project root):

```bash
docker-compose run --rm speechcatcher /app/media/your_file.mp4
```

With specific model:

```bash
docker-compose run --rm speechcatcher --model de_streaming_transformer_xl /app/media/your_file.mp4
```

Example with real file:

```bash
docker-compose run --rm speechcatcher /app/media/common_voice_de_40865860.wav --model de_streaming_transformer_xl
```

## Model Persistence

Models are automatically downloaded and stored in a Docker named volume called `speechcatcher_models`. This ensures that:

1. Models persist between container runs
2. Models persist even if the container is removed
3. No manual directory creation is needed

You can view the volume with:

```bash
docker volume ls | grep speechcatcher_models
```

Inspect the volume contents with:

```bash
docker volume inspect speechcatcher_models
```

## Using Docker Without docker-compose

If you prefer to use Docker directly, you'll need to create and use a volume for model persistence:

```bash
# Create a volume for models
docker volume create speechcatcher_models

# Build the image
docker build -f docker/Dockerfile -t speechcatcher .

# Run WebSocket server with volume for models (with proper network exposure)
docker run -p 2700:2700 -v speechcatcher_models:/app/models speechcatcher server --vosk-output-format --host 0.0.0.0

# Transcribe a file
docker run -v speechcatcher_models:/app/models -v $(pwd)/media:/app/media speechcatcher /app/media/your_file.mp4
```

## Note About Microphone Access

Live transcription with microphone access requires additional device mapping and may not work properly in Docker. For those use cases, it's recommended to install Speechcatcher directly on your host system. 