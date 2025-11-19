# Lavalink Integration - Build 54

**Branch:** `lavalink-experiment`
**Version:** 0.32
**Build:** 54

---

## What Changed

### Architecture Shift

**Before (Build 53 - FFmpeg):**
```
Bot Process → FFmpeg (in-process) → Discord Voice Gateway
```

**After (Build 54 - Lavalink):**
```
Bot Process → Lavalink Server (external) → Discord Voice Gateway
```

### Key Differences

1. **Audio Processing**: Now handled by Lavalink server (Java) instead of in-process FFmpeg (Node.js)
2. **Resource Usage**: Bot process is lighter, audio processing offloaded to Lavalink
3. **Scalability**: One Lavalink server can serve multiple bots
4. **Stability**: Audio crashes don't crash the bot
5. **Volume Scale**: Changed from 0-10 to 0-100 (more granular control)

---

## Files Created/Modified

### New Files
- `index-lavalink.js` - Lavalink-based bot implementation (Build 54)
- `lavalink.service` - systemd service file for auto-start
- `start-lavalink.sh` - Manual server startup script
- `test-lavalink.js` - Connection test script
- `LAVALINK-INTEGRATION.md` - This file

### Configuration Files
- `application.yml` - Lavalink server configuration
- `.gitignore` - Updated to exclude Lavalink files

### Preserved
- `index.js` - Original FFmpeg version (Build 53) - **UNCHANGED**

---

## Lavalink Server Setup

### Systemd Service (Recommended)

**Start:**
```bash
sudo systemctl start lavalink.service
```

**Stop:**
```bash
sudo systemctl stop lavalink.service
```

**Status:**
```bash
sudo systemctl status lavalink.service
```

**Logs:**
```bash
sudo journalctl -u lavalink.service -f
```

**Auto-start:** Already enabled - Lavalink will start on boot

### Manual Start (Alternative)

```bash
./start-lavalink.sh
```

### Test Connection

```bash
node test-lavalink.js
```

Expected output:
```
✅ Connected to Lavalink!
📡 HTTP Status: 200
📋 Version info: 4.1.1
```

---

## Running the Bot

### Option 1: Test Lavalink Version (New)

```bash
# Make sure Lavalink is running
sudo systemctl status lavalink.service

# Run the Lavalink version
node index-lavalink.js
```

### Option 2: Keep Using FFmpeg Version (Original)

```bash
# Original version still works
sudo nice -n -10 node index.js
```

---

## Command Changes

### Volume Scale Updated

**Before (FFmpeg):** 0-10 scale
**After (Lavalink):** 0-100 scale

**Examples:**
- `/volume level:30` - Set to 30% volume
- `/playmp3 file:song.mp3 volume:50` - Play at 50% volume

All other commands work exactly the same:
- `/playmp3 file:<attachment>` - Upload and play
- `/playdir dir:<path>` - Play directory/playlist
- `/skip` - Skip current track
- `/stop` - Stop and clear queue

---

## Key Implementation Details

### Lavalink Configuration

**Server:** localhost:2333
**Password:** `bardbot-secure-password-2025`
**Protocol:** HTTP (WebSocket for audio)

### Track Loading

**Local Files:** Converted to `file://` URLs
```javascript
const fileUrl = `file://${absolutePath}`;
const result = await player.search({ query: fileUrl }, user);
```

**Discord Attachments:** Used directly as HTTP URLs
```javascript
const result = await player.search({ query: attachment.url }, user);
```

### Player Management

- **Auto-connect:** Player connects to voice when created
- **Auto-disconnect:** Destroys after 30s of empty queue
- **Auto-reconnect:** Reconnects if voice connection drops
- **Previous tracks:** Keeps last 10 tracks in history

### Event Handling

The bot listens for these Lavalink events:
- `nodeConnect` - Lavalink server connected
- `nodeDisconnect` - Lavalink server disconnected
- `nodeError` - Lavalink server error
- `trackStart` - Track playback started
- `trackEnd` - Track playback ended
- `trackError` - Track playback error
- `queueEnd` - Queue is empty

---

## Testing Checklist

### 1. Lavalink Server
- [ ] Service is running: `sudo systemctl status lavalink.service`
- [ ] Connection test passes: `node test-lavalink.js`
- [ ] No errors in logs: `sudo journalctl -u lavalink.service`

### 2. Bot Connection
- [ ] Bot starts without errors
- [ ] Console shows: "Lavalink node connected: local-node"
- [ ] Slash commands register correctly

### 3. Audio Playback
- [ ] `/playmp3` with Discord attachment works
- [ ] Volume control works (0-100 scale)
- [ ] `/playdir` with local directory works
- [ ] M3U playlist parsing works
- [ ] Shuffle mode works
- [ ] `/skip` skips tracks correctly
- [ ] `/stop` stops and clears queue
- [ ] Auto-disconnect after queue ends (30s)

### 4. Comparison with FFmpeg Version
- [ ] Audio quality is comparable
- [ ] Latency is acceptable
- [ ] No stuttering or glitches
- [ ] CPU usage is lower (check with `htop`)

---

## Troubleshooting

### "Failed to connect to Lavalink"

1. Check Lavalink is running:
   ```bash
   sudo systemctl status lavalink.service
   ```

2. Check connectivity:
   ```bash
   node test-lavalink.js
   ```

3. Check password in both files matches:
   - `application.yml`: Line 13
   - `index-lavalink.js`: Line 77

### "Failed to load audio file"

**Local files:**
- Ensure file exists and path is absolute
- Check file format is supported (MP3, WAV, FLAC, etc.)
- Verify Lavalink has `local: true` in `application.yml`

**Discord attachments:**
- Check attachment URL is accessible
- Verify Lavalink has `http: true` in `application.yml`

### Bot crashes or errors

**Check Node.js version:**
```bash
node --version
```
Should be 18.x or higher (22.12.0 recommended for @discordjs/voice)

**Check dependencies:**
```bash
npm list lavalink-client discord.js
```

### Lavalink server won't start

**Check Java version:**
```bash
java -version
```
Should be Java 17 or higher

**Check port 2333 is free:**
```bash
sudo lsof -i :2333
```

**View detailed logs:**
```bash
sudo journalctl -u lavalink.service -xe
```

---

## Performance Comparison

### Expected Improvements with Lavalink

1. **Lower CPU usage in bot process** - Audio encoding offloaded
2. **Better memory management** - No large FFmpeg buffers in Node.js
3. **More stable** - Audio processing isolated from bot logic
4. **Easier to scale** - Multiple bots can share one Lavalink server

### Expected Trade-offs

1. **Additional complexity** - Two processes instead of one
2. **Extra memory** - Lavalink server (512MB allocated)
3. **Network overhead** - Minimal (localhost communication)

---

## Next Steps

1. **Test thoroughly** - Run through the testing checklist
2. **Compare performance** - Run both versions side-by-side
3. **Decide** - Keep Lavalink or revert to FFmpeg
4. **If keeping Lavalink:**
   - Replace `index.js` with `index-lavalink.js`
   - Update README.md
   - Commit to lavalink-experiment branch
5. **If reverting:**
   - Keep using `index.js` (Build 53)
   - Optionally stop Lavalink service: `sudo systemctl disable lavalink.service`

---

## Rollback Instructions

### Switch back to FFmpeg version

```bash
# Stop Lavalink version if running
pkill -f "node index-lavalink.js"

# Run original FFmpeg version
sudo nice -n -10 node index.js
```

### Disable Lavalink service (optional)

```bash
sudo systemctl stop lavalink.service
sudo systemctl disable lavalink.service
```

Lavalink files remain in the project directory but won't auto-start on boot.

---

## Support

- **Lavalink Documentation:** https://lavalink.dev/
- **lavalink-client npm:** https://www.npmjs.com/package/lavalink-client
- **Discord.js Guide:** https://discordjs.guide/

---

**Status:** Ready for testing
**Created:** 2025-11-18
**Last Updated:** 2025-11-18
