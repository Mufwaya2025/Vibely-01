#!/bin/bash
# Deploy script for Vibely app to henzter server

# Build the frontend
echo "Building frontend..."
npm run build

# Set production environment variables
export NODE_ENV=production

# Start the server
echo "Starting server..."
npm run server:start