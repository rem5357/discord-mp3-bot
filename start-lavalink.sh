#!/bin/bash
# start-lavalink.sh - Start Lavalink server with Discord voice optimizations

echo "🚀 Starting Lavalink Server v4.1.1 (Discord-Optimized)"
echo "=========================================================="
echo ""
echo "Configuration:"
echo "  Host: 127.0.0.1 (localhost only)"
echo "  Port: 2333"
echo "  Password: bardbot-secure-password-2025"
echo ""
echo "Discord Voice Optimizations:"
echo "  • Opus Bitrate: 128 kbps (matches Discord Level 1 boost)"
echo "  • Frame Duration: 20ms (Discord standard)"
echo "  • Buffer: 400ms (prevents stuttering)"
echo "  • JVM GC: G1GC (low-latency garbage collection)"
echo ""
echo "Press Ctrl+C to stop the server"
echo "=========================================================="
echo ""

# Set high process priority (requires sudo or appropriate permissions)
# Uncomment if running with sudo:
# renice -n -10 -p $$ 2>/dev/null && echo "✅ Process priority set to high (-10)"

# Start Lavalink with optimized JVM settings for Discord voice
java \
  -Xms256M \
  -Xmx512M \
  -XX:+UseG1GC \
  -XX:MaxGCPauseMillis=50 \
  -XX:+ParallelRefProcEnabled \
  -XX:G1HeapRegionSize=2M \
  -XX:+UnlockExperimentalVMOptions \
  -XX:G1NewSizePercent=30 \
  -XX:G1MaxNewSizePercent=40 \
  -XX:InitiatingHeapOccupancyPercent=40 \
  -XX:G1ReservePercent=15 \
  -Djdk.nio.maxCachedBufferSize=262144 \
  -Dcom.sedmelluq.discord.lavaplayer.player.AudioPlayerManager.frameBufferDuration=1000 \
  -jar Lavalink.jar
