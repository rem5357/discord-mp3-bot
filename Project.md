# BardBot - Discord Audio Playback Bot

**Version:** 0.21 | **Build:** 39

A Discord bot for playing media files (MP3s, WAVs, and other audio formats) in voice channels, supporting both individual file playback and directory-based playlists.

## Features

### Audio Playback
- Play audio files directly from Discord uploads
- Queue and play entire directories of audio files as playlists
- Support for multiple audio formats: MP3, WAV, OGG, Opus, FLAC, M4A, AAC, WebM
- High-quality audio resampling using SoXR (Sample Rate Converter)
- Smooth playback without stuttering or speed variations

### Volume Control
- Adjustable volume (0-10 scale)
- Per-track volume override for individual files
- Default volume setting that persists across tracks

### Queue Management
- Automatic queue progression (plays next track when current finishes)
- Skip current track
- Stop playback and clear queue
- Automatic directory sorting (natural/numeric sorting)

## Commands

### /playmp3
Play an uploaded audio file in your current voice channel.
- **Parameters:**
  - `file` (required): The audio file attachment to play
  - `volume` (optional): Volume level 0-10 for this track only
- **Usage:** Join a voice channel, then upload an MP3 file using this command

### /playdir
Queue all supported audio files from a local directory (non-recursive).
- **Parameters:**
  - `dir` (required): Local directory path (e.g., "D:\songs1")
  - `start` (optional): Start immediately if idle (default: true)
- **Usage:** `/playdir dir:D:\songs1`
- Files are automatically sorted alphanumerically

### /volume
Set playback volume for current and future tracks.
- **Parameters:**
  - `level` (required): Volume level 0-10
- **Usage:** `/volume level:5`
- Affects currently playing track and all future tracks

### /skip
Skip the current track and play the next one in queue.
- No parameters
- Only works when audio is currently playing

### /stop
Stop playback, clear the queue, and leave the voice channel.
- No parameters
- Cleans up all resources and disconnects from voice

## Technical Details

### Dependencies
- `discord.js` (v14.24.2): Discord API interaction
- `@discordjs/voice` (v0.19.0): Voice channel connection and audio playback
- `@discordjs/opus` (v0.10.0): Opus audio codec for Discord
- `prism-media` (v1.3.5): FFmpeg integration for audio processing
- `dotenv` (v17.2.3): Environment variable management

### Audio Processing
- Uses FFmpeg for decoding various audio formats
- Resamples all audio to 48kHz stereo (Discord's required format)
- Outputs raw PCM (s16le) for optimal Discord compatibility
- SoXR resampler for high-quality sample rate conversion
- 1MB buffer size to prevent backpressure issues
- Proper resource cleanup to prevent memory leaks

### Architecture
- Per-guild state management (supports multiple Discord servers)
- Single audio player per guild
- Queue system with automatic progression
- Automatic voice channel disconnect when queue is empty
- Error handling for missing files, playback failures, and FFmpeg errors

## Setup

### Prerequisites
- Node.js installed
- FFmpeg installed and available in system PATH
- Discord bot created in Discord Developer Portal
- Bot added to your Discord server

### Configuration
Create a `.env` file with:
```
DISCORD_TOKEN=your_bot_token_here
DEV_GUILD_ID=your_server_id_here
```

### Installation
```bash
npm install
node index.js
```

## Supported Audio Formats
- MP3 (MPEG Audio)
- WAV (Waveform Audio)
- OGG (Ogg Vorbis)
- Opus
- FLAC (Free Lossless Audio Codec)
- M4A (MPEG-4 Audio)
- AAC (Advanced Audio Coding)
- WebM

## Usage Notes

### Playing Playlists
- Playlist directory: `D:\songs1` (or your custom path)
- Files are sorted naturally (e.g., track1, track2, track10)
- Only files in the specified directory are queued (non-recursive)
- Automatically starts playing if bot is idle

### Volume Settings
- Volume scale: 0 (mute) to 10 (maximum)
- Default volume: 3
- Logarithmic volume scaling for natural perception
- Per-track volume override available for /playmp3 command

### Voice Channel Behavior
- Bot must be invited to a voice channel by user running commands
- Automatically leaves when queue is empty
- Stays connected while processing queue
- Self-deafens to save bandwidth

## Version History

### Build 39 (Version 0.21) - 2025-11-08
**Hotfix: Revert to Discord's required format + pacing:**
- Reverted to 48kHz stereo (Discord.js requirement for raw PCM)
- Build 38's 24kHz mono caused 10x playback speed
- Added `-readrate 1.0` to prevent FFmpeg from bursting
- Doubled thread queue: 512 → 1024 entries
- Focus on **pacing** instead of format changes
- Read at native speed to prevent buffer underruns

### Build 38 (Version 0.21) - 2025-11-08
**Aggressive Data Reduction (REVERTED - caused fast playback):**
- Attempted 24kHz mono but Discord.js requires 48kHz stereo
- Caused 10x speed playback issue

### Build 37 (Version 0.21) - 2025-11-08
**Back to Basics: Raw PCM for Maximum Reliability:**
- Switched from Opus encoding back to raw PCM (s16le)
- Opus encoding overhead was causing more frequent stuttering
- Massive 16MB stream buffer (doubled from 8MB)
- Simplified audio pipeline: decode → volume → PCM output
- Added thread queue size parameter for read-ahead buffering
- Let Discord.js handle the Opus encoding internally (more reliable)
- Simpler = more stable
- Still had occasional stuttering due to high data throughput

### Build 36 (Version 0.21) - 2025-11-08
**Hotfix: Removed problematic Opus settings:**
- Removed `-frame_duration`, `-fec`, and `-packet_loss` parameters that caused fast-forward playback
- Still experienced more frequent stuttering

### Build 35 (Version 0.21) - 2025-11-08
**Anti-Stutter Optimization (REVERTED):**
- Attempted advanced Opus settings but caused playback speed issues

### Build 34 (Version 0.21) - 2025-11-08
**Major Audio Engine Overhaul:**
- Switched from raw PCM to Opus encoding (Discord's native format) for better streaming performance
- Implemented FFmpeg volume filter for consistent volume control
- Increased buffer sizes: 4MB stream buffer, 32MB probe size
- Added high-precision SoXR resampling (28-bit precision with triangular dithering)
- Optimized FFmpeg settings for low-latency audio streaming
- Added version and build number display on startup
- Volume command now affects future tracks only (more reliable)

**Audio Quality Fixes:**
- Removed time-stretching audio filter that caused speed variations
- Eliminated stuttering through larger buffers and Opus encoding
- Improved FFmpeg error handling and logging
- Proper FFmpeg process cleanup when switching tracks
- Resource cleanup on stop/skip commands

These improvements ensure smooth, consistent playback without stuttering or pitch/speed variations.
