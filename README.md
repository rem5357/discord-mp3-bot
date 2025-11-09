# BardBot - Discord Audio Playback Bot

**Version:** 0.22 | **Build:** 41

A high-quality Discord bot for playing audio files in voice channels, supporting both individual file playback and directory-based playlists.

## Features

- Play audio files (MP3, WAV, OGG, Opus, FLAC, M4A, AAC, WebM) in Discord voice channels
- Upload and play files directly through Discord
- Queue entire directories as playlists
- Adjustable volume control (0-10 scale)
- Automatic queue progression
- High-quality audio with no stuttering or speed variations

## Quick Start

### Prerequisites

- Node.js (v16 or higher)
- FFmpeg installed and in system PATH
- A Discord bot token

### Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/discord-mp3-bot.git
cd discord-mp3-bot
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file:
```
DISCORD_TOKEN=your_bot_token_here
DEV_GUILD_ID=your_server_id_here
```

4. Run the bot:
```bash
node index.js
```

## Commands

- `/playmp3 file:<attachment> [volume]` - Play an uploaded audio file
- `/playdir dir:<path> [start]` - Queue all audio files from a directory
- `/volume level:<0-10>` - Set default volume for future tracks
- `/skip` - Skip the current track
- `/stop` - Stop playback and clear the queue

## Configuration

Edit the following constants in `index.js`:
- `VERSION` - Bot version number
- `BUILD` - Build number (increments with each edit)

## Technical Details

- **Audio Quality**: 48kHz stereo, 16-bit PCM (CD quality)
- **Raw Bitrate**: ~1536 kbps uncompressed PCM
- **Discord Output**: Opus 128kbps (encoded by Discord.js)
- **Buffer Size**: 32MB for massive headroom
- **Pre-buffering**: 500ms delay before playback starts
- **Stream Monitoring**: Logs actual bitrate every 5 seconds
- **Multi-threading**: FFmpeg uses all available cores
- **Player Tolerance**: 100 missed frames allowed
- **Automatic Cleanup**: FFmpeg processes cleaned up properly

## Documentation

See [Project.md](Project.md) for detailed documentation including architecture, setup instructions, and version history.

## License

ISC
