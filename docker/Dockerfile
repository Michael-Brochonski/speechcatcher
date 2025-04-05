FROM debian:bullseye-slim

# Set non-interactive mode for apt
ENV DEBIAN_FRONTEND=noninteractive

# Install necessary dependencies
RUN apt-get update && apt-get install -y \
    portaudio19-dev \
    python3-dev \
    python3-pip \
    ffmpeg \
    libhdf5-dev \
    git \
    git-lfs \
    build-essential \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Initialize git-lfs
RUN git lfs install

# Create an app directory
WORKDIR /app

# Copy the cloned speechcatcher repository
COPY git/speechcatcher /app/speechcatcher

# Install Speechcatcher from local repository
WORKDIR /app/speechcatcher
RUN pip3 install --no-cache-dir -e .

# Set cache directory to persist model downloads
ENV SPEECHCATCHER_CACHE_DIR=/app/models

# Expose WebSocket server port
EXPOSE 2700

# Create entrypoint script
RUN echo '#!/bin/bash\n\
if [ "$1" = "server" ]; then\n\
    shift\n\
    speechcatcher_server --host 0.0.0.0 --cache-dir $SPEECHCATCHER_CACHE_DIR "$@"\n\
else\n\
    speechcatcher "$@"\n\
fi' > /app/entrypoint.sh && chmod +x /app/entrypoint.sh

WORKDIR /app
ENTRYPOINT ["/app/entrypoint.sh"]

# Default to help output
CMD ["--help"] 