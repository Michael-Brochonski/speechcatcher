#!/bin/bash

# Run the speechcatcher server with German model and Vosk output format
docker build -t speechcatcher-server -f docker/Dockerfile .
docker run -p 2700:2700 speechcatcher-server server --vosk-output-format --host 0.0.0.0 --model de_streaming_transformer_xl 