#!/bin/bash
# start-lavalink.sh - Start Lavalink server

echo "🚀 Starting Lavalink Server v4.1.1"
echo "=================================="
echo ""
echo "Configuration:"
echo "  Host: 127.0.0.1 (localhost only)"
echo "  Port: 2333"
echo "  Password: bardbot-secure-password-2025"
echo ""
echo "Press Ctrl+C to stop the server"
echo "=================================="
echo ""

# Start Lavalink with reasonable memory settings
java -Xmx512M -jar Lavalink.jar
