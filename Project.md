# BardBot - Discord Audio Playback Bot

**Version:** 0.22 | **Build:** 42

A Discord bot for playing media files (MP3s, WAVs, and other audio formats) in voice channels, supporting both individual file playback and directory-based playlists.

## Current Status - Build 42

### Current Audio Quality Settings
- **Sample Rate:** 48 kHz (CD quality)
- **Channels:** Stereo (2 channels)
- **Bit Depth:** 16-bit
- **Format:** Raw PCM (s16le)
- **Bitrate:** ~1536 kbps uncompressed
- **Discord Encoding:** Opus 128kbps (done by Discord.js after PCM input)
- **Buffer Size:** 64MB (doubled from 32MB)
- **Pre-caching:** 8MB of data before playback starts
- **Discord Latency:** 237ms (user reported - high, consider Linux)

### Build 42 Improvements
1. **Fixed volume control** - Now works on current track (inline volume enabled)
2. **Doubled buffer to 64MB** - Better handling of high latency
3. **Implemented pre-caching** - Buffers 8MB before starting playback
4. **Removed 500ms delay** - Pre-caching replaces the need for artificial delay
5. **Better volume handling** - Uses both FFmpeg filter and inline volume

### Platform Considerations
**Windows vs Linux for Audio Streaming:**
- **Windows** (current): Higher system overhead, less efficient networking
- **Linux** (recommended): Better networking stack, lower latency, less overhead
- With 237ms Discord latency, Linux would likely help significantly

### Known Issues
**LIGHT STUTTERING (IMPROVED):**
- User reports "much better" but still light stuttering
- 237ms Discord latency is contributing factor
- Consider running on Linux for better performance

### Recommendations for Next Attempts
1. **Try using @discordjs/opus encoder directly** instead of raw PCM
2. **Pre-download/cache files** before playback to eliminate streaming issues
3. **Investigate Discord voice connection settings** - try different voice server regions
4. **Check system resources** during playback (CPU, memory, network)
5. **Try alternative audio libraries** like discord-player or play-dl
6. **Add artificial delay before starting playback** to pre-buffer more data
7. **Simplify further** - remove volume filter, test with minimal FFmpeg args
8. **Test with different file formats** to isolate if it's format-specific
9. **Monitor FFmpeg output** for warnings/errors during playback
10. **Check Discord.js voice connection NetworkingStatus** for network issues

### Technical Observations
- User noted that lowering sample rate helped most (Build 37 → 38 attempt)
- Suggests the issue is **throughput/bandwidth related**
- Buffer underruns indicate data isn't arriving fast enough
- May be network quality, Discord voice server, or local system resource issue
- Current 48kHz stereo @ 16-bit = ~1.536 Mbps raw PCM throughput

## Features

### Audio Playback
- Play audio files directly from Discord uploads
- Queue and play entire directories of audio files as playlists
- Support for multiple audio formats: MP3, WAV, OGG, Opus, FLAC, M4A, AAC, WebM
- **Known Issue:** Occasional stuttering with catch-up speed variations (under investigation)

### Volume Control
- Adjustable volume (0-10 scale)
- Per-track volume override for individual files
- Default volume setting that persists across tracks (volume applied via FFmpeg filter)

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

### Build 42 (Version 0.22) - 2025-11-08
**Major buffering improvements and volume fix:**
- **Fixed volume control** - Now affects current track (enabled inline volume)
- **64MB buffer** - Doubled from 32MB to handle 237ms latency
- **Pre-caching system** - Buffers 8MB of data before starting playback
- **Removed artificial delays** - Pre-caching provides natural buffering
- **Platform note** - Linux recommended for high-latency scenarios
- User reports "much better" with only light stuttering remaining

### Build 41 (Version 0.22) - 2025-11-08
**Hotfix: StreamType mismatch and PCM revert:**
- **Fixed critical bug** - Build 40 used StreamType.Opus with Ogg container (should be OggOpus)
- **Reverted to Raw PCM** - More reliable than Opus encoding attempts
- **Fixed /playmp3** - Now accepts all audio formats (MP3, WAV, FLAC, etc.)
- **Quality settings**: 48kHz stereo 16-bit PCM (~1536 kbps raw)
- **Discord handles Opus encoding** at 128kbps after receiving PCM
- Kept all buffering improvements from Build 40

### Build 40 (Version 0.22) - 2025-11-08
**Complete Stream Management Overhaul (HAD BUG - see Build 41):**
- **REMOVED** `-readrate 1.0` throttling (was causing buffer starvation)
- **Switched to libopus encoder** at 128kbps CBR for boosted servers
- **32MB buffer** (doubled from 16MB) for massive headroom
- **Added stream health monitoring** - logs actual bitrate every 5 seconds
- **500ms pre-buffer delay** - lets stream build up before playback
- **Increased player tolerance** - maxMissedFrames set to 100
- **Enhanced diagnostics** - better error logging and buffering detection
- **Multi-threaded FFmpeg** - removed thread limitations
- **Larger analysis buffers** - 10M analyzeduration, 50M probesize
- Focus on **removing bottlenecks** rather than limiting flow

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

These improvements were attempts to ensure smooth playback, but stuttering issue persists.

## Development Journey Summary (Builds 34-39)

### The Problem
User reported stuttering during playback with "catch-up" speed variations - a classic buffer underrun issue where audio playback pauses, then speeds up to resync with where it should be.

### Attempted Solutions & Results

**Build 34 - Opus Encoding:**
- Tried switching from raw PCM to Opus encoding (Discord's native format)
- Added SoXR resampling and volume filters
- Result: Improved somewhat but still had issues

**Build 35 - Advanced Opus Settings:**
- Added FEC (Forward Error Correction), frame duration, packet loss tolerance
- Result: Caused fast-forward playback (incompatible parameters)

**Build 36 - Conservative Opus:**
- Removed problematic parameters, kept VBR and 96k bitrate
- Result: More frequent stuttering than before

**Build 37 - Back to Raw PCM:**
- Abandoned Opus encoding, returned to raw PCM
- 16MB buffer, simplified pipeline
- Result: Better, but still occasional stuttering

**Build 38 - Data Reduction:**
- User observation: lowering sample rate helped most
- Tried 24kHz mono (75% data reduction)
- Result: 10x playback speed (Discord.js requires 48kHz stereo for raw PCM)

**Build 39 - Paced Reading:**
- Reverted to 48kHz stereo
- Added `-readrate 1.0` to pace FFmpeg
- Doubled thread queue to 1024
- Result: Currently being tested

### Key Learnings
1. **Discord.js has strict format requirements** - Raw PCM must be 48kHz stereo s16le
2. **Opus encoding added overhead** - Made stuttering worse, not better
3. **Buffer underruns are throughput-related** - User noted sample rate reduction helped
4. **Simple is better** - Complex audio filters and encoding created more problems
5. **The issue is persistent** - Suggests underlying network, system, or Discord voice server issue

### What We Know
- Local files from D:\songs1 (eliminates network download issues)
- Stuttering happens 1-2 times per song
- Speed-up after stutter = classic buffer underrun
- Large buffers (16MB) and pacing haven't fully solved it
- May need to investigate non-FFmpeg solutions or pre-caching
