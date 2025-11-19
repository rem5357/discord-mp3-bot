# BardBot - Discord Audio Playback Bot

**Version:** 1.0 | **Build:** 57 - STABLE RELEASE ✅

A Discord bot for playing media files (MP3s, WAVs, and other audio formats) in voice channels, supporting both individual file playback and directory-based playlists.

**Primary Version:**
- **Build 57 (1.0)** - Lavalink-based with optimized quality settings (this branch: `lavalink-experiment`)
- **Build 53 (0.31)** - FFmpeg-based (legacy - master branch)

---

## ✅ CURRENT STATUS: Build 57 - STABLE RELEASE - 100% Feature Complete!

**Achievement:** After 57 builds and extensive optimization efforts, BardBot has reached 100% feature completion with zero stuttering and excellent audio quality.

### Build 57 - Final Optimizations (2025-11-19)

**Status:** ✅ PRODUCTION READY - All requirements met!

**Major Breakthrough:**
Replacing FFmpeg with Lavalink resolved all stuttering issues that persisted through 20+ builds of FFmpeg optimization attempts (Builds 34-53).

**Critical Quality Optimizations Applied:**
1. **Lavalink Resampling Quality: HIGH** (was LOW)
   - Dramatically improved audio fidelity for HTTP sources
   - Cleaner sample rate conversion
   - Eliminated audio artifacts

2. **Buffer Duration: 600ms** (was 400ms)
   - 50% larger buffer for better GC pause protection
   - More stable playback during CPU/network variations

3. **Player Update Interval: 1** (was 5)
   - More responsive playback tracking
   - Faster track change detection

4. **Nginx HTTP Streaming Optimizations:**
   - `sendfile on` - Direct kernel-to-socket transfer
   - `tcp_nopush on` - Optimized packet sending
   - `tcp_nodelay on` - Reduced streaming latency
   - `output_buffers 8 256k` - Better buffer management
   - `sendfile_max_chunk 512k` - Prevents blocking on large files
   - `read_ahead 512k` - Optimized sequential disk reads
   - Range request support for seeking
   - Aggressive caching with immutable directive

**Results:**
- ✅ Zero stuttering
- ✅ Excellent audio quality
- ✅ Smooth playback across all track types
- ✅ All features working perfectly
- ✅ User confirmed: "100% requirements met"

---

## Build 56 - Lavalink + Nginx HTTP Streaming (2025-11-19)

**Issue Addressed (2025-11-19):**
Build 55 introduced Lavalink integration which worked great for `/playfile` (Discord uploads), but `/playdir` (local files) failed because Lavalink doesn't support `file://` protocol URLs. Solution: Serve local music files via HTTP using Nginx.

### Build 56 Implementation - HTTP Music Server

**Architecture:**
- **Lavalink Server:** Java-based audio processor running on localhost:2333
  - Password: `bardbot-secure-password-2025`
  - Managed by systemd service for auto-start
  - Handles all audio encoding and streaming to Discord

- **Nginx Music Server:** Port 8080 serving local music files
  - Configuration: `/etc/nginx/sites-available/music`
  - Serves: `/home/mithroll/Shared` as `/music`
  - Symlink: `/var/www/music` → `/home/mithroll/Shared`
  - Features: Directory browsing (autoindex), CORS headers, caching
  - Bot accesses: `http://localhost:8080/music/`

**Key Changes:**
1. ✅ Created separate Nginx server block on port 8080
2. ✅ Updated bot MUSIC_HTTP_BASE to `http://localhost:8080/music`
3. ✅ Fixed URL encoding for filenames with spaces
4. ✅ Fixed variable scope issue with `basename`
5. ✅ M3U playlist support working with HTTP URLs

**Commands:**
- `/playfile` - Upload and play audio files (tested, working!)
- `/playdir` - Play local directories via HTTP (tested, working!)
- `/volume` - Set default volume 0-100
- `/skip` - Skip current track
- `/stop` - Stop and clear queue

**Quick Start:**
```bash
# Lavalink is managed by systemd (auto-starts on boot)
sudo systemctl status lavalink

# Start the bot
cd /home/mithroll/Projects/discord-mp3-bot
node index-lavalink.js

# Test in Discord
/playdir dir:/home/mithroll/Shared/Songs1
```

### Build 56 Lessons Learned

**Critical Discovery: Lavalink HTTP-Only Architecture**
- Lavalink **DOES NOT** support `file://` URLs for local files
- When given file:// URLs, Lavalink falls back to YouTube search (returns 400 errors)
- Solution: Must serve local files via HTTP/HTTPS

**Nginx Configuration Challenges:**
- **Problem:** Nginx `alias` + `autoindex` + server-level `index` directive = redirect loop
- **Root Cause:** The global `index` directive conflicts with `autoindex` when using `alias`
- **Failed Attempts:**
  - Adding `try_files` (doesn't work with `alias`)
  - Overriding `index` directive (still caused loops)
  - Using `location /music/` with `alias /home/mithroll/Shared/`
- **Solution:** Create separate server block on port 8080 with simple `root /var/www` and symlink
- **Why It Works:** Clean server block without conflicting directives from default server

**URL Encoding is Critical:**
- Filenames with spaces must be properly URL-encoded
- Example: `Last Ship Out.mp3` → `Last%20Ship%20Out.mp3`
- **Implementation:** Split path by `/`, encode each component, rejoin
  ```javascript
  const encodedPath = relativePath.split('/').map(encodeURIComponent).join('/');
  ```

**JavaScript Scope Gotchas:**
- Variables defined inside `if/else` blocks aren't accessible outside
- **Bug:** `basename` defined in `else` block but used after the block
- **Fix:** Move variable declaration before the conditional

**Discord Interaction Timeouts:**
- Discord interactions expire after 3 seconds
- Must call `interaction.deferReply()` IMMEDIATELY before any processing
- Multiple bot instances cause "Unknown interaction" errors
- Solution: Always kill old instances before starting new ones

**Nginx Permissions:**
- www-data needs execute (`x`) permission on `/home/mithroll` to traverse to `/home/mithroll/Shared`
- Command: `chmod o+x /home/mithroll`
- Symlinks work fine once permissions are correct

### Build 56 File Changes

**Modified Files:**
- `index-lavalink.js` (lines 17, 345-357)
  - Changed MUSIC_HTTP_BASE to `http://localhost:8080/music`
  - Added proper URL encoding for path components
  - Fixed basename variable scope

**New Files:**
- `/etc/nginx/sites-available/music` - Nginx server block for port 8080
- `/var/www/music` → `/home/mithroll/Shared` (symlink)

**Configuration Files:**
- `nginx-music.conf` - Documentation of Nginx setup
- `application.yml` - Lavalink configuration (existing)
- `lavalink.service` - systemd service (existing)

---

## Build 55 - Initial Lavalink Integration (2025-11-18)

**Issue Addressed (2025-11-18):**
After extensive optimization attempts (Builds 34-52), stuttering issues persisted with FFmpeg. Analysis revealed that while all downstream buffers (Node.js streams, Discord.js buffering, pre-caching) were optimized, the **FFmpeg encoder itself** had no explicit buffer size setting.

**Root Cause Analysis:**
Previous builds focused on stream-level and application-level buffering, but the FFmpeg Opus encoder was using default variable buffer sizes. This could cause encoding rate fluctuations that lead to stuttering, regardless of how well buffered the downstream pipeline was.

**Build 53 Fix:**
- Added `-bufsize 512k` to give FFmpeg's Opus encoder a dedicated 512KB buffer
- Added `-maxrate 128k` to set a bitrate ceiling for consistent encoding behavior
- These parameters work at the encoder level, a different layer than all previous optimizations
- Prevents encoding rate fluctuations that cause buffer underruns

### Quick Start for Testing:
```bash
cd /home/mithroll/Projects/discord-mp3-bot
sudo nice -n -10 node index.js  # MUST use sudo for process priority!
```

Watch console output for:
- `🚀 FFmpeg PID xxxxx priority set to -15 (high priority)` ← Good!
- `⚠️ Failed to set FFmpeg priority: ...` ← Shows actual error
- `⚠️ FFmpeg process not available...` ← Process didn't spawn in time

---

## Build 53 Audio Quality Settings

### Current Configuration
- **Sample Rate:** 48 kHz
- **Channels:** Stereo (2 channels)
- **Format:** Ogg Opus (native Discord format)
- **Bitrate:** 64 kbps (Discord's default, optimized for performance)
- **Encoding:** VBR Opus with 20ms frames (Discord standard)
- **FFmpeg Encoder Buffer:** 512 KB (NEW - prevents rate fluctuations)
- **FFmpeg Max Rate:** 128 kbps (NEW - maintains consistent encoding)
- **Stream Buffer Size:** 512 KB
- **Pre-buffering:** 16 KB (~250ms at 64kbps)
- **highWaterMark:** 8 frames (160ms of audio ready)
- **Process Priority:** Nice -10 (Node.js) and -15 (FFmpeg) for real-time performance
- **Volume Control:** ✅ ENABLED - FFmpeg filter (0-10 scale, affects future tracks)
- **Platform:** Optimized for Linux with excellent performance

### Build 47 Status - SOLUTION CONFIRMED! (2025-11-09)

## 🎉 **STUTTERING ELIMINATED!** 🎉

**The Critical Missing Piece: Process Priority**

After extensive optimization attempts (Builds 34-46), the final solution was **process priority optimization**. Real-time audio applications REQUIRE high CPU scheduling priority to maintain consistent performance.

**Build 47 Final Solution:**
1. ✅ **Main Node.js process: nice -10**
   - Ensures consistent event loop execution
   - Prevents CPU starvation during high system load

2. ✅ **FFmpeg processes: nice -15**
   - Highest priority for audio encoding
   - CRITICAL - ensures FFmpeg never waits for CPU time
   - This was the key to eliminating encode slowdowns

3. ✅ **Combined with Build 46 optimizations:**
   - 64kbps bitrate (50% reduction from 128k)
   - No volume filter (eliminated processing overhead)
   - VBR mode with 20ms frames (Discord standard)
   - highWaterMark: 24 (480ms buffer)
   - 8MB async pre-buffering

**Test Results:**
- ✅ **NO STUTTERING** - Completely smooth playback
- ✅ Tested on Linux with 13ms Discord latency
- ✅ Works with both `/playmp3` and `/playdir`
- ✅ Consistent performance across entire songs

**Required Setup:**
```bash
# MUST run with sudo for process priority:
sudo nice -n -10 node index.js

# Or:
sudo node index.js  # Bot sets priority automatically
```

**Why It Worked:**
1. **64kbps reduced encoding workload by 50%**
2. **Process priority guaranteed CPU time**
3. **FFmpeg never starved for resources**
4. **Combination eliminated all bottlenecks**

**Lesson Learned:**
Process priority is ESSENTIAL for real-time audio applications on Linux. Without it, even the best optimizations can fail due to CPU scheduling issues.

### Build 46 Status - Discord Default Bitrate & Maximum Performance (2025-11-09)

**Research Findings:**
After deep research into Discord.js voice issues and Discord's actual bitrate settings:
1. **Discord defaults to 64kbps**, not 128kbps - we were encoding at double the necessary rate!
2. 64kbps is considered optimal for Discord voice channels (balances quality/bandwidth)
3. Volume filters add significant processing overhead even when not actively changing volume
4. The `highWaterMark` parameter in createAudioResource can improve buffering stability

**Build 46 Optimizations:**
1. ✅ **Reduced bitrate to 64k** (Discord's default)
   - 50% reduction in encoding workload from Build 45
   - Matches what Discord actually uses for voice channels
   - Still provides excellent audio quality

2. ✅ **REMOVED volume filter entirely** (for testing)
   - Eliminates all FFmpeg audio filter processing overhead
   - Volume commands temporarily disabled
   - Tests if volume filter was causing encode slowdowns

3. ✅ **Added VBR (Variable Bitrate) mode**
   - More efficient encoding with better quality/size ratio
   - Allows encoder to use less bitrate when possible

4. ✅ **Set frame_duration to 20ms**
   - Discord standard packet timing
   - More consistent packet delivery

5. ✅ **Added packet_loss tolerance of 1%**
   - Helps encoder handle minor network issues

6. ✅ **Increased highWaterMark to 24**
   - Doubled from default 12 (240ms → 480ms of audio ready)
   - More buffered packets available for playback

7. ✅ **Reduced pre-buffer to 8MB**
   - Since bitrate is halved, buffer fills faster
   - Reduces startup delay while maintaining safety margin

**Expected Results:**
- 50% reduction in encoding workload (64k vs 128k)
- Elimination of volume filter overhead
- More consistent packet timing with VBR and frame_duration
- Better buffer stability with increased highWaterMark

### Build 45 Status - Combined Optimization (2025-11-09)

**Approach:**
Build 44's Ogg Opus streaming showed improvement but still had stuttering. Build 45 combines both optimizations:

1. **Ogg Opus streaming** (from Build 44) - 91% throughput reduction
2. **Proper async pre-buffering** (new) - Guaranteed full buffer before playback starts

**Changes from Build 44:**
1. ✅ **Converted `makeFfmpegResource()` to async/Promise**
   - Now returns a Promise that resolves only after buffer is full
   - Playback doesn't start until 16MB of Opus data is loaded

2. ✅ **Doubled buffer to 128MB** (from 64MB)
   - More headroom for stream variations

3. ✅ **Updated `playNext()` to async**
   - Waits for pre-buffering to complete with `await`
   - Both `/playmp3` and `/playdir` benefit from proper pre-buffering

4. ✅ **Increased pre-buffer target to 16MB** (from 8MB)
   - More data ready before playback starts
   - Since Opus is 128 kbps, 16MB = ~2 minutes of audio cached

**Test Results (Linux, 13ms latency):**
- ✅ **Significant improvement** - Much better than Build 44
- ⚠️ **Minor stuttering persists** - Occasional light stuttering still occurs
- ✅ Pre-buffering works correctly (16MB loads before playback)
- ✅ Stream throughput reduced to ~128 kbps (from 1536 kbps)

**Remaining Issue:**
Despite 91% throughput reduction and guaranteed full buffer at start, minor stuttering still occurs during continuous playback. This suggests:
- FFmpeg Opus encoding may still have brief slowdowns
- Discord.js voice connection may have consumption rate variations
- Possible GC pauses or other Node.js runtime issues
- May need to investigate alternatives to FFmpeg streaming

### Build 44 - Critical Performance Fix (2025-11-09)

**Root Cause Analysis:**
After deep research into Discord.js voice optimization, three critical performance bottlenecks were identified:

1. **Double-encoding overhead** - Using Raw PCM forced real-time transcoding:
   - FFmpeg decoded audio → Raw PCM (1536 kbps)
   - Discord.js encoded PCM → Opus (128 kbps)
   - This created massive CPU overhead and throughput demands

2. **Inline volume performance cost** - `inlineVolume: true` adds significant overhead
   - Discord.js docs: "comes at a performance cost, even if you aren't modifying volume"
   - Active even when volume unchanged

3. **Missing stream optimization** - Not utilizing Discord's native Opus format

**Build 44 Changes:**
1. ✅ **Switched to Ogg Opus streaming** (`StreamType.OggOpus`)
   - FFmpeg outputs native Ogg Opus directly
   - Eliminates PCM intermediate step
   - Reduces bitrate from ~1536 kbps to 128 kbps (91% reduction)
   - Single-pass encoding instead of decode→PCM→encode pipeline

2. ✅ **Disabled inline volume** (`inlineVolume: false`)
   - Removes real-time volume processing overhead
   - Volume handled via FFmpeg filter only
   - Volume changes apply to next track (acceptable tradeoff)

3. ✅ **Added demuxProbe import** for future stream auto-detection
   - Imported but not yet utilized (prepared for future optimization)
   - Can detect pre-encoded Opus files to skip FFmpeg entirely

**Expected Results:**
- Elimination of stuttering caused by transcoding bottleneck
- 91% reduction in stream throughput requirements
- Significant CPU usage reduction
- Better performance on high-latency connections

**Breaking Changes:**
- Volume command (`/volume`) now only affects future tracks, not current track
- This is an acceptable tradeoff for the massive performance improvement

### Platform Considerations
**Windows vs Linux for Audio Streaming:**
- **Windows** (current): Higher system overhead, less efficient networking
- **Linux** (recommended): Better networking stack, lower latency, less overhead
- With previous 237ms Discord latency, Linux would still help

### Known Issues
**✅ ALL ISSUES RESOLVED - STABLE RELEASE (BUILD 48)**
- Stuttering completely eliminated in Build 47
- Volume control restored and tested in Build 48
- All features working perfectly
- No known issues remaining

**Production Ready:** Bot is fully functional and ready for deployment with perfect playback quality.

### Next Steps (Optional Enhancements)
Since stuttering is now RESOLVED, these are optional improvements:

1. ✅ **SOLVED: Main stuttering issue** - Fixed with process priority (Build 47)
2. **Re-enable volume control** - Can add back FFmpeg volume filter if needed
3. **Implement demuxProbe** - Auto-detect pre-encoded Opus files to skip FFmpeg
4. **Test even lower bitrates** - 48kbps or 32kbps for bandwidth-limited scenarios
5. **Add real-time scheduling** - SCHED_FIFO/SCHED_RR for even better performance
6. **Pre-encode music library** - Convert popular tracks to Opus offline
7. **Monitor resource usage** - Track CPU/memory during playback for optimization

### Technical Observations
- User noted that lowering sample rate helped most (Build 37 → 38 attempt)
- This observation led to the key insight: **throughput/bandwidth bottleneck**
- Buffer underruns were caused by excessive data requirements (1536 kbps PCM)
- Root cause: **Double-encoding overhead** from PCM intermediate format
- Build 44 solution: Direct Opus encoding reduces throughput by 91% (128 kbps)
- Previous attempts focused on buffering; real issue was the encoding pipeline

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

### /playfile (Lavalink version) / /playmp3 (FFmpeg version)
Play an uploaded audio file in your current voice channel.
- **Parameters:**
  - `file` (required): The audio file attachment to play
  - `volume` (optional): Volume level 0-100 (Lavalink) or 0-10 (FFmpeg) for this track only
- **Usage:** Join a voice channel, then upload an audio file using this command

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
- Node.js (v16 or higher)
- FFmpeg installed and available in system PATH
- Discord bot created in Discord Developer Portal
- Bot added to your Discord server

### Linux Setup (Recommended for Performance)

#### 1. Install System Dependencies

**Ubuntu/Debian:**
```bash
# Update package list
sudo apt update

# Install Node.js 18.x (recommended)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Install FFmpeg
sudo apt install -y ffmpeg

# Install build tools for native modules
sudo apt install -y build-essential python3
```

**Fedora/RHEL/CentOS:**
```bash
# Install Node.js
sudo dnf install -y nodejs npm

# Install FFmpeg
sudo dnf install -y ffmpeg

# Install build tools
sudo dnf install -y gcc-c++ make python3
```

**Arch Linux:**
```bash
# Install Node.js and npm
sudo pacman -S nodejs npm

# Install FFmpeg
sudo pacman -S ffmpeg

# Install build tools
sudo pacman -S base-devel python
```

#### 2. Clone and Setup the Bot

```bash
# Clone the repository
git clone https://github.com/rem5357/discord-mp3-bot.git
cd discord-mp3-bot

# Install npm dependencies
npm install

# Create .env file
nano .env
# Add your Discord token and guild ID:
# DISCORD_TOKEN=your_bot_token_here
# DEV_GUILD_ID=your_server_id_here
```

#### 3. Run the Bot

```bash
# Run directly
node index.js

# Or use a process manager like PM2 for production
npm install -g pm2
pm2 start index.js --name "BardBot"
pm2 save
pm2 startup  # Follow the instructions to enable auto-start
```

### Windows Setup

#### 1. Install Prerequisites

- Download and install [Node.js](https://nodejs.org/) (LTS version)
- Download and install [FFmpeg](https://www.ffmpeg.org/download.html)
- Add FFmpeg to system PATH

#### 2. Setup the Bot

```cmd
# Clone the repository
git clone https://github.com/rem5357/discord-mp3-bot.git
cd discord-mp3-bot

# Install dependencies
npm install

# Create .env file with your Discord credentials
# DISCORD_TOKEN=your_bot_token_here
# DEV_GUILD_ID=your_server_id_here

# Run the bot
node index.js
```

## Dependencies Explained

### Core Discord Libraries

**discord.js** (`^14.24.2`)
- The core Discord API wrapper
- Handles slash commands, bot login, voice state events, and text replies
- Think of it as the "operating system" of your bot

**@discordjs/voice** (`^0.19.0`)
- The voice subsystem that lets bots join voice channels
- Sends Opus audio packets to Discord's gateway
- Turns decoded PCM into something Discord can play

**@discordjs/opus** (`^0.10.0`)
- Native Node binding for the Opus codec
- Used for voice transmission
- Without it, you'd get "Cannot find module '@discordjs/opus'" error
- Requires build tools (gcc/python) on Linux

### Audio Processing

**prism-media** (`^1.3.5`)
- Small audio toolkit used by @discordjs/voice
- Spawns and pipes FFmpeg processes
- Converts PCM to Opus and streams it
- Bridge between raw audio data and Discord's voice layer

**FFmpeg** (external binary)
- The real workhorse decoder
- Converts MP3/WAV/FLAC/etc. into raw PCM audio
- Not an npm package - must be installed separately
- prism-media simply calls this executable

### Voice Protocol Support

**@snazzah/davey** (`^0.1.7`)
- Implements the "DAVE" protocol
- Used in newest @discordjs/voice versions
- Replaced older UDP voice transports
- Required for voice to actually connect

### Configuration

**dotenv** (`^17.2.3`)
- Loads your .env file
- Keeps secrets like Discord token and guild ID out of code
- Essential for security

### Optional Dependencies

**node-opus / opusscript** (not directly installed)
- Fallback options if @discordjs/opus isn't available
- prism-media tries: @discordjs/opus → node-opus → opusscript
- Usually not needed if @discordjs/opus installs correctly

## Why Linux is Recommended

### Performance Benefits
1. **Better Networking Stack**
   - Lower latency TCP/IP implementation
   - More efficient packet handling
   - Better buffer management

2. **Real-time Scheduling**
   - Better priority handling for audio threads
   - Less interrupt latency
   - More predictable timing

3. **Lower System Overhead**
   - No Windows audio subsystem delays
   - Lighter background services
   - Direct hardware access

4. **FFmpeg Performance**
   - Native compilation optimizations
   - Better multi-threading
   - Lower memory usage

### Expected Improvements on Linux
- Reduced Discord latency (from 237ms on Windows)
- Elimination of stuttering issues
- More stable stream buffering
- Better CPU utilization
- Lower memory footprint

## Linux Troubleshooting

### Common Issues

**1. @discordjs/opus fails to build**
```bash
# Ensure build tools are installed
sudo apt install build-essential python3  # Ubuntu/Debian
sudo dnf install gcc-c++ make python3     # Fedora
sudo pacman -S base-devel python          # Arch

# Clear npm cache and rebuild
npm cache clean --force
npm rebuild @discordjs/opus
```

**2. FFmpeg not found**
```bash
# Verify FFmpeg installation
ffmpeg -version

# If not found, ensure it's in PATH
which ffmpeg
export PATH=$PATH:/usr/bin  # Add to ~/.bashrc for persistence
```

**3. Permission denied errors**
```bash
# Fix npm permissions
mkdir ~/.npm-global
npm config set prefix '~/.npm-global'
echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.bashrc
source ~/.bashrc
```

**4. Bot crashes on Linux**
```bash
# Check for missing libraries
ldd node_modules/@discordjs/opus/build/Release/opus.node

# Install missing libraries if needed
sudo apt install libc6  # Usually already installed
```

**5. High CPU usage on Linux**
```bash
# Set nice priority for better performance
nice -n -10 node index.js

# Or use PM2 with CPU limit
pm2 start index.js --name "BardBot" --max-memory-restart 1G
```

### Optimizing for Your Setup

**For your specific case (237ms Discord latency on Windows):**

1. **Test latency on Linux:**
```bash
ping -c 10 discord.com
```

2. **Monitor the bot performance:**
```bash
# Watch CPU and memory usage
htop  # or top

# Monitor network latency
mtr discord.com
```

3. **If stuttering persists on Linux:**
```bash
# Increase system audio buffer
sudo sysctl -w net.core.rmem_max=134217728
sudo sysctl -w net.core.wmem_max=134217728
echo "net.core.rmem_max=134217728" | sudo tee -a /etc/sysctl.conf
echo "net.core.wmem_max=134217728" | sudo tee -a /etc/sysctl.conf
```

4. **Set your music directory path on Linux:**
```bash
# Update your playlist path in commands
/playdir dir:/home/username/music  # Linux path format
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

### Build 55 (Version 0.40A) - 2025-11-18
**Lavalink Integration - "A" Designation for Alternate Architecture:**

**Major Achievement:**
User testing confirms: "It worked very well. More testing to come, but it was the best so far."

**Changes Implemented:**
1. ✅ **Renamed /playmp3 → /playfile** for better clarity
2. ✅ **Version numbering:** 0.40A (A = Alternate/Lavalink architecture)
3. ✅ **Confirmed working:** Audio playback via Discord file attachments
4. ✅ **Performance:** Best playback quality achieved so far

**Architecture:**
- Bot → Lavalink Server (Java) → Discord Voice Gateway
- External audio processing (reduces bot CPU load)
- Volume scale: 0-100 (more granular than FFmpeg's 0-10)

**Status:**
✅ `/playfile` confirmed working excellently
⚠️ `/playdir` investigating issue (playlist loads but no audio output)

**Commands:**
- `/playfile` - Upload and play audio files (NEW NAME)
- `/volume` - Set volume 0-100
- `/playdir` - Play directory/M3U playlists (investigating)
- `/skip` - Skip current track
- `/stop` - Stop and clear queue

**Technical Notes:**
- Lavalink server running as systemd service
- Auto-start on boot enabled
- Connection via localhost:2333
- Full documentation in LAVALINK-INTEGRATION.md

**Testing Status:**
✅ Ready for production use (with /playfile)
⚠️ /playdir needs debugging

---

### Build 54 (Version 0.32) - 2025-11-18
**Initial Lavalink Integration (Had Initialization Bug):**

Fixed initialization error with lavalink-client API.
Superseded by Build 55.

---

### Build 53 (Version 0.31) - 2025-11-18
**FFmpeg Encoder Buffer Fix - Addressing Missing Encoder-Level Buffering:**

**Issue Analysis:**
After 52 builds of optimization attempts, stuttering persisted. Comprehensive code review revealed that while all downstream buffers were heavily optimized (Node.js streams, Discord.js buffering, pre-caching), the **FFmpeg encoder itself** had no explicit buffer size configuration. This meant the encoder was using default variable buffer sizes that could cause encoding rate fluctuations.

**Changes Implemented:**
1. ✅ **Added `-bufsize 512k` parameter** (index.js:174)
   - Gives FFmpeg's Opus encoder a dedicated 512KB buffer
   - Prevents encoding rate fluctuations that cause buffer underruns
   - Works at the encoder level, not stream level

2. ✅ **Added `-maxrate 128k` parameter** (index.js:175)
   - Sets a maximum bitrate ceiling for the encoder
   - Helps maintain consistent encoding behavior even with VBR enabled
   - Prevents bitrate spikes that could cause stuttering

3. ✅ **Updated console logging**
   - Shows new optimization in build message
   - Clear indication of encoder buffer implementation

**Why This Is Different:**
All previous builds (34-52) optimized:
- Stream buffers (Node.js PassThrough)
- Pre-buffering (cache before playback)
- Discord.js buffering (highWaterMark)
- Process priority
- Bitrate reduction

Build 53 is the first to address **FFmpeg's internal encoder buffer**, which is a completely different layer of the buffering pipeline.

**Expected Results:**
- Elimination of stuttering caused by encoder rate variations
- More consistent encoding performance
- Better handling of momentary CPU scheduling delays
- Synergy with existing process priority optimizations (nice -10/-15)

**Testing Status:**
⏳ Ready for user testing

---

### Build 52 (Version 0.31) - 2025-11-18
**QA Fix: Removed -re flag that caused playback hang:**

**Issue:**
Build 51 introduced jitter buffer optimizations but testing revealed playback would hang/freeze.

**Root Cause:**
The `-re` flag (read at native framerate) was throttling FFmpeg input artificially, causing conflicts with the Discord.js voice pipeline which has its own rate limiting.

**Fix:**
- ✅ Removed `-re` flag completely
- Discord's natural rate limiting is sufficient
- Playback no longer hangs

**Result:**
Playback works correctly but stuttering issues persisted, leading to Build 53 investigation.

---

### Build 51 (Version 0.31) - 2025-11-18
**QA-Recommended Jitter Buffer Optimization Fixes:**

**Changes:**
- Attempted jitter buffer optimizations based on QA recommendations
- Adjusted buffering parameters for better performance

**Status:**
Build introduced playback hang issue, resolved in Build 52.

---

### Build 50 (Version 0.30) - 2025-11-09
**FFmpeg Priority Fix - Debugging Stuttering Regression:**

**Problem Identified:**
User reported stuttering and static-distortion returning during playback at volumes 1-2. Issue started in first file ~30 seconds in, worse in second file.

**Investigation Findings:**
1. Node.js process running correctly with nice -10 priority ✅
2. All audio settings correct (64kbps Opus, VBR, buffers) ✅
3. Files are local (not network/Samba) - on NVMe drive ✅
4. FFmpeg priority setting code had timing issue ⚠️

**Root Cause:**
Build 48's code attempted to set FFmpeg process priority (nice -15) immediately after creating the FFmpeg object. However, the process may not be fully spawned yet. Errors were silently caught and ignored, so we had no visibility into whether priority was actually being set.

**Changes Implemented:**
1. ✅ **Added 50ms setTimeout delay** before attempting to set FFmpeg priority
   - Gives the process time to spawn before we try to renice it
   - Previous code may have been trying to renice before PID existed

2. ✅ **Removed silent error handling**
   - Changed from silent catch to `console.warn()` with error message
   - Now logs actual error if priority setting fails

3. ✅ **Added diagnostic logging**
   - Logs warning if FFmpeg process or PID not available
   - Shows exactly why priority might not be set
   - Helps identify if problem is timing, permissions, or something else

**Testing Status:**
⏳ Pending user testing with detailed console output monitoring

**Expected Outcome:**
If FFmpeg was running at normal priority (nice 0), this fix should restore the smooth playback from Build 47/48 by ensuring FFmpeg gets priority -15.

---

### Build 49 (Version 0.30) - 2025-11-09
**M3U Playlist Support with Shuffle:**

After successful Build 48 stable release, added M3U playlist functionality for enhanced playlist management.

**Features Added:**
1. ✅ **M3U Playlist Parser** (parseM3U function)
   - Automatically detects .m3u files in directory
   - Parses M3U format with comment/metadata support
   - Handles both absolute and relative file paths
   - Validates file existence and format support

2. ✅ **Shuffle Functionality** (shuffleArray function)
   - Fisher-Yates shuffle algorithm
   - Works with both M3U playlists and directory listings
   - New shuffle parameter for /playdir command

3. ✅ **Enhanced /playdir Command**
   - Auto-detects M3U files in target directory
   - Uses M3U track order if found, alphabetical if not
   - `shuffle:true` parameter to randomize any playlist
   - Shows playlist type in response (directory/M3U/shuffled)

**User Workflow:**
- Place optional .m3u file in music directory
- Run `/playdir dir:/path/to/music`
- Bot uses M3U order if present, alphabetical otherwise
- Add `shuffle:true` to randomize

**Technical Note:**
No audio configuration changes - only added playlist management features. All Build 48 optimizations retained.

**Status:**
✅ Implemented and tested. User reported stuttering after this build, leading to Build 50 investigation.

---

### Build 48 (Version 0.30) - 2025-11-09
**Stable Release - Volume Control and All Features Restored:**

After Build 47 successfully eliminated stuttering, Build 48 restores all features for a complete, production-ready release.

**Changes Implemented:**
1. ✅ **Volume control re-enabled**
   - FFmpeg volume filter restored (was disabled in Builds 46-47 for testing)
   - Volume control confirmed working without performance impact
   - Adjustable via `/volume` command (0-10 scale)
   - Affects future tracks only (applied via FFmpeg filter)

2. ✅ **All optimizations retained from Build 47:**
   - Process priority: Nice -10 (Node.js) and -15 (FFmpeg)
   - 64kbps Opus bitrate (Discord default)
   - VBR mode with 20ms frames
   - 8MB async pre-buffering
   - highWaterMark: 24

**Testing Confirmed:**
- ✅ **NO STUTTERING** - Perfect playback maintained
- ✅ **VOLUME CONTROL WORKING** - No performance degradation
- ✅ **ALL FEATURES FUNCTIONAL** - Ready for production use

**This is the stable release** - All stuttering issues resolved, all features working, fully tested and ready for deployment.

### Build 47 (Version 0.26) - 2025-11-09
## 🎉 **FINAL SOLUTION - STUTTERING ELIMINATED!** 🎉

**The Missing Piece: Process Priority**
After 13 builds of optimization attempts, the critical missing component was **process priority**. Real-time audio applications MUST have high CPU scheduling priority.

**Changes Implemented:**
1. ✅ **Node.js process set to nice -10**
   - Ensures consistent event loop execution
   - Prevents CPU starvation during system load

2. ✅ **FFmpeg processes set to nice -15**
   - Highest priority for audio encoding
   - **THIS WAS THE KEY** - FFmpeg never waits for CPU
   - Eliminated all encode slowdowns

3. ✅ **Combined with Build 46 optimizations:**
   - 64kbps bitrate (50% reduction from 128k)
   - No volume filter (removed overhead)
   - VBR mode, 20ms frames
   - highWaterMark: 24
   - 8MB async pre-buffering

**Required Usage:**
```bash
# MUST run with sudo for process priority:
sudo nice -n -10 node index.js
# or
sudo node index.js  # Bot sets priority automatically
```

**CONFIRMED RESULTS:**
- ✅ **COMPLETELY SMOOTH PLAYBACK**
- ✅ **NO STUTTERING**
- ✅ **NO SPEED VARIATIONS**
- ✅ **TESTED ON LINUX WITH 13ms LATENCY**

**Solution Summary:**
The stuttering was caused by CPU scheduling issues. Even with all optimizations, FFmpeg would occasionally not get CPU time when needed, causing buffer underruns. Setting high process priority ensures both Node.js and FFmpeg always get CPU time when they need it, eliminating stuttering completely.

### Build 46 (Version 0.25) - 2025-11-09
**Discord Default Bitrate & Maximum Performance Optimization:**

**Research Breakthrough:**
Deep research revealed that Discord actually defaults to 64kbps for voice channels, not 128kbps. We were encoding at double the necessary bitrate, causing unnecessary encoding pressure.

**Changes Implemented:**
1. ✅ **Reduced bitrate to 64kbps** (Discord's actual default)
   - 50% reduction in encoding workload
   - Matches Discord's standard voice quality
   - Significantly reduces FFmpeg encode pressure

2. ✅ **REMOVED volume filter entirely**
   - Eliminates all audio filter processing overhead
   - Tests if volume filter was causing encode bottlenecks
   - Volume control temporarily disabled for testing

3. ✅ **Switched to VBR (Variable Bitrate) mode**
   - More efficient Opus encoding
   - Better quality/bitrate ratio
   - Allows encoder to reduce bitrate when possible

4. ✅ **Added Discord-standard packet timing**
   - Set frame_duration to 20ms (Discord standard)
   - Added 1% packet_loss tolerance
   - More consistent packet delivery

5. ✅ **Increased highWaterMark to 24**
   - Doubled from default 12 (240ms → 480ms)
   - More audio packets ready for playback
   - Improves buffer stability

6. ✅ **Optimized pre-buffer for 64k bitrate**
   - Reduced from 16MB to 8MB
   - Faster startup with adequate safety margin
   - Proportional to the halved bitrate

**Expected Impact:**
- 50% reduction in encoding workload should significantly reduce stuttering
- Removal of volume filter eliminates processing overhead
- VBR mode provides more efficient encoding
- Better packet timing and buffering for smoother playback

### Build 45 (Version 0.24) - 2025-11-09
**Combined Optimization - Opus Streaming + Async Pre-buffering:**

**Problem:**
Build 44's Ogg Opus streaming showed improvement but still had noticeable stuttering during playback.

**Solution:**
Combined two optimization approaches:
1. Keep Ogg Opus streaming (91% throughput reduction)
2. Add proper async pre-buffering (guarantee full buffer before playback)

**Changes Implemented:**
1. ✅ **Converted `makeFfmpegResource()` to async/Promise-based**
   - Function now returns a Promise instead of immediate resource
   - Promise resolves only after pre-buffer target is reached
   - Ensures playback never starts with empty buffer

2. ✅ **Increased pre-buffer target to 16MB** (from 8MB)
   - Since Opus is 128 kbps, 16MB = ~2 minutes of audio pre-cached
   - Significantly more headroom than before

3. ✅ **Doubled stream buffer to 128MB** (from 64MB)
   - Massive headroom for any stream variations
   - Can handle extreme latency spikes

4. ✅ **Updated `playNext()` and `/playmp3` handler to async**
   - Both functions now properly await the pre-buffering Promise
   - Playback starts only after `await makeFfmpegResource()` completes
   - Fixed critical bug where Build 44 started playback before buffer filled

**Test Results (Linux, 13ms latency):**
- ✅ **Significant improvement** - Much better than Build 44
- ⚠️ **Minor stuttering persists** - Occasional light stuttering still occurs
- ✅ Pre-buffering confirmed working (16MB loads before playback)
- ✅ Stream throughput at target ~128 kbps

**Analysis:**
Despite combining both optimizations (Opus streaming + async pre-buffering), minor stuttering persists. This indicates:
- Issue is NOT initial buffering (16MB pre-loaded)
- Issue is NOT throughput (128 kbps is very low)
- Issue is NOT platform or latency (tested on Linux with 13ms)
- **Likely causes:** FFmpeg encode rate variations, Discord.js voice consumption patterns, or Node.js GC pauses

**Next Steps:**
May need to investigate alternatives to real-time FFmpeg streaming:
- Full file pre-caching (load entire file to memory)
- Pre-encoded Opus files (bypass FFmpeg entirely)
- Alternative audio libraries (discord-player, play-dl)
- Monitoring FFmpeg CPU usage during playback

### Build 44 (Version 0.23) - 2025-11-09
**Critical Performance Fix - Ogg Opus Streaming:**

**Root Cause Identified:**
After extensive online research into Discord.js voice optimization best practices, identified the stuttering was caused by a **double-encoding bottleneck**:
- Build 42 used Raw PCM → FFmpeg decoded to PCM (1536 kbps) → Discord.js encoded to Opus (128 kbps)
- This created 91% unnecessary throughput and massive CPU overhead
- Inline volume processing added additional performance cost even when unused

**Changes Implemented:**
1. ✅ **Switched to Ogg Opus streaming** (`StreamType.OggOpus`)
   - FFmpeg now outputs Ogg Opus directly (128 kbps)
   - Eliminates PCM intermediate format entirely
   - Single-pass encoding: decode → Opus (no PCM step)
   - 91% reduction in stream throughput requirements

2. ✅ **Disabled inline volume** (`inlineVolume: false`)
   - Removed real-time volume processing overhead
   - Volume handled exclusively via FFmpeg filter
   - Discord.js docs confirm this improves performance significantly

3. ✅ **Added demuxProbe import** for future optimization
   - Prepared for automatic stream type detection
   - Can skip FFmpeg entirely for pre-encoded Opus files

**Breaking Changes:**
- `/volume` command now only affects future tracks (not current track)
- Acceptable tradeoff for massive performance improvement

**Expected Results:**
- Complete elimination of stuttering caused by encoding bottleneck
- Significant CPU usage reduction
- Better performance on high-latency connections
- Validates Discord.js official optimization recommendations

**Technical Note:**
Build 40 attempted Opus encoding but had StreamType mismatch bug. Build 44 implements it correctly with proper `StreamType.OggOpus` designation.

### Build 42 (Version 0.22) - 2025-11-08
**Major buffering improvements and volume fix:**
- **Fixed volume control** - Now affects current track (enabled inline volume)
- **64MB buffer** - Doubled from 32MB to handle 237ms latency
- **Pre-caching system** - Buffers 8MB of data before starting playback
- **Removed artificial delays** - Pre-caching provides natural buffering
- **Platform note** - Linux recommended for high-latency scenarios
- User reports "much better" with only light stuttering remaining
- **Issue:** Still used Raw PCM with inline volume (performance overhead)

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
