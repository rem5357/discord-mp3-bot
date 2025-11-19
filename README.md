# BardBot - Discord Audio Playback Bot

**Version:** 1.0 | **Build:** 57 - STABLE RELEASE ✅

A high-quality Discord bot for playing audio files in voice channels, supporting both individual file playback and directory-based playlists. **100% feature complete with zero stuttering!**

## ✨ Features

- **✅ ZERO STUTTERING** - Flawless audio playback using Lavalink
- **✅ EXCELLENT AUDIO QUALITY** - HIGH resampling quality with optimized buffers
- **✅ FULL VOLUME CONTROL** - Adjustable volume (0-100 scale) working perfectly
- **✅ M3U PLAYLIST SUPPORT** - Automatic detection and parsing of M3U playlists
- **✅ SHUFFLE MODE** - Randomize track order for any playlist or directory
- **✅ HTTP MUSIC STREAMING** - Optimized Nginx server for local file delivery
- Play audio files (MP3, WAV, OGG, Opus, FLAC, M4A, AAC, WebM) in Discord voice channels
- Upload and play files directly through Discord
- Queue entire directories as playlists
- Automatic queue progression

## Architecture

**Lavalink-based (Build 57 - Current):**
```
Bot → Lavalink Server (Java) → Discord Voice Gateway
       ↑
   HTTP Music Server (Nginx)
```

**Key Components:**
- **BardBot** (Node.js) - Discord interaction and queue management
- **Lavalink** (Java) - Professional audio processing and streaming
- **Nginx** (HTTP Server) - Optimized local music file delivery

## Quick Start

### Prerequisites

- **Node.js** (v18 or higher recommended)
- **Java 17+** (for Lavalink server)
- **Nginx** (for local music file serving)
- A Discord bot token
- lavalink-client and discord.js packages

### Installation

1. **Clone the repository:**
```bash
git clone https://github.com/yourusername/discord-mp3-bot.git
cd discord-mp3-bot
```

2. **Install dependencies:**
```bash
npm install
```

3. **Create a `.env` file:**
```
DISCORD_TOKEN=your_bot_token_here
DEV_GUILD_ID=your_server_id_here
```

4. **Configure Lavalink:**
The `application.yml` file is already optimized with:
- HIGH resampling quality
- 600ms buffer duration
- Optimized player update interval

5. **Configure Nginx music server:**
See `nginx-music.conf` for the optimized configuration serving on port 8080.

6. **Start Lavalink:**
```bash
sudo systemctl start lavalink.service
# or manually:
# java -Xmx512M -jar Lavalink.jar
```

7. **Run the bot:**
```bash
node index-lavalink.js
```

You should see:
```
🎵 BardBot v1.0 (Build 57) - Lavalink Edition
✅ Logged in as BardBot#...
✅ Lavalink node connected: local-node
```

## Commands

- `/playfile file:<attachment> [volume]` - Play an uploaded audio file (0-100 volume)
- `/playdir dir:<path> [start] [shuffle]` - Queue audio files from a directory
  - Automatically detects and uses M3U playlists if present
  - Falls back to alphabetical order if no M3U found
  - Use `shuffle:true` to randomize track order
- `/volume level:<0-100>` - Set default volume for current and future tracks
- `/skip` - Skip the current track
- `/stop` - Stop playback and clear the queue

## Configuration

### Lavalink Settings (application.yml)

**Optimized for quality (Build 57):**
- `resamplingQuality: HIGH` - Maximum audio fidelity
- `bufferDurationMs: 600` - Smooth playback with GC protection
- `opusEncodingQuality: 10` - Highest Opus encoding quality
- `playerUpdateInterval: 1` - Responsive playback tracking

### Music HTTP Server (Nginx)

**Optimized for streaming (port 8080):**
- Sendfile enabled for efficient file transfer
- TCP optimizations (nopush, nodelay)
- Large buffers for smooth streaming
- Range request support for seeking
- Aggressive caching for performance

### Bot Configuration (index-lavalink.js)

Edit these constants if needed:
- `VERSION` - Bot version (currently 1.0)
- `BUILD` - Build number (currently 57)
- `MUSIC_HTTP_BASE` - HTTP music server URL
- `MUSIC_LOCAL_BASE` - Local music directory path

## Technical Details

**Audio Processing:**
- **Server**: Lavalink 4.1.1 running on localhost:2333
- **Audio Quality**: Professional-grade with HIGH resampling
- **Buffer Size**: 600ms for stable playback
- **Frame Buffer**: 5000ms of audio buffered
- **Opus Quality**: 10/10 (maximum)
- **Volume Range**: 0-100 (granular control)

**HTTP Streaming:**
- **Server**: Nginx on port 8080
- **Optimizations**: sendfile, tcp_nopush, tcp_nodelay
- **Buffers**: 8x256KB output buffers
- **Read-ahead**: 512KB for sequential access
- **Caching**: Aggressive with immutable directive

**Platform:**
- **Recommended**: Linux (Ubuntu/Debian/Arch)
- **Tested**: Linux with excellent performance
- **Alternative**: Windows (works but less optimized)

## Why Lavalink?

After extensive testing through 57 builds, Lavalink proved superior to FFmpeg:

**Build 57 (Lavalink) vs Build 53 (FFmpeg):**
- ✅ Zero stuttering vs occasional stuttering
- ✅ Professional audio processing vs in-process encoding
- ✅ Better resource isolation vs potential bot crashes
- ✅ Scalable architecture vs monolithic design
- ✅ 100% feature complete vs ongoing optimization

## Documentation

- **[Project.md](Project.md)** - Complete development history and technical details
- **[LAVALINK-INTEGRATION.md](LAVALINK-INTEGRATION.md)** - Lavalink setup guide
- **[nginx-music.conf](nginx-music.conf)** - Nginx configuration reference

## Version History

- **1.0 (Build 57)** - STABLE RELEASE - Optimized Lavalink with HIGH quality settings
- **0.40A (Build 56)** - Lavalink + Nginx HTTP streaming
- **0.40A (Build 55)** - Initial Lavalink integration
- **0.31 (Build 53)** - FFmpeg encoder buffer optimizations (legacy)
- **0.30 (Build 47-52)** - FFmpeg priority and buffer testing (legacy)

## Support & Troubleshooting

**Lavalink not connecting:**
```bash
sudo systemctl status lavalink.service
node test-lavalink.js
```

**No audio playback:**
- Verify Lavalink is running on port 2333
- Check Nginx is serving on port 8080
- Ensure music files are in `/home/mithroll/Shared`

**Poor audio quality:**
- Verify `application.yml` has `resamplingQuality: HIGH`
- Check `opusEncodingQuality: 10`
- Ensure `bufferDurationMs: 600`

## License

ISC

---

**Status**: Production ready - All features working perfectly!
