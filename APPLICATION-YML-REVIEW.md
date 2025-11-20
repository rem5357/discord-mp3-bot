# application.yml Configuration Review

## ❌ CRITICAL: Missing Discord Voice Gateway Setting

### **Missing: `opusSendInterval`**

This is **THE MOST IMPORTANT** setting for preventing Discord voice stuttering!

**Current:** Not set (defaults to unknown value)
**Required:** `20` (Discord's standard 20ms Opus frame interval)

Discord expects audio packets every **exactly 20ms**. Without this setting explicitly configured, Lavalink may use a different interval, causing the Discord voice gateway's jitter buffer to fail at smoothing playback = **stuttering**.

**Impact:** HIGH - Directly causes timing-based stuttering

---

## ⚠️ Configuration Issues That May Cause Problems

### 1. **frameBufferDurationMs: 5000** (Too High)

**Current:** 5000ms (5 seconds)
**Recommended:** 1000-2000ms (1-2 seconds)
**Original recommendation:** 1000ms

**Problem:**
- 5 seconds of buffering adds **5 seconds of latency** to your audio start time
- When you skip tracks, there's a 5-second delay before the next track plays
- Commands like `/skip` feel unresponsive
- Doesn't significantly improve stuttering beyond 1-2 seconds

**Why 1000ms is better:**
- Prevents CPU spike underruns (main goal)
- Minimal latency impact (~1 second)
- Still protects against brief system hiccups
- Discord's jitter buffer can handle 1-2 second gaps

**Impact:** MEDIUM - Causes poor user experience, not stuttering

---

### 2. **playerUpdateInterval: 1** (Too Aggressive)

**Current:** 1 second
**Recommended:** 5 seconds (Lavalink default)
**Your reasoning:** "More responsive playback tracking"

**Problem:**
- Updates Discord with player state every 1 second instead of every 5 seconds
- Creates 5x more network traffic and processing overhead
- Unnecessary for music playback (users don't need sub-second position updates)
- Can contribute to CPU load during peak times

**When you might need 1 second:**
- Live streaming with precise timing needs
- Karaoke applications
- **Not needed for music bots**

**Impact:** LOW - Creates overhead but unlikely to cause stuttering

---

### 3. **Unnecessary Streaming Sources Enabled**

**Currently enabled:**
```yaml
youtube: true
bandcamp: true
soundcloud: true
twitch: true
vimeo: true
http: true      # ✅ NEEDED
local: true     # ✅ NEEDED
```

**Problem:**
- Your bot only plays **local MP3 files** and **Discord attachment URLs**
- YouTube, Bandcamp, SoundCloud, Twitch, Vimeo add:
  - Extra memory overhead (unused codecs/parsers loaded)
  - Initialization time
  - Potential security surface area

**Recommended:**
```yaml
youtube: false
bandcamp: false
soundcloud: false
twitch: false
vimeo: false
http: true      # For Discord URLs
local: true     # For local files
```

**Impact:** LOW - Minimal but reduces overhead

---

### 4. **Unnecessary Audio Filters Enabled**

**Currently enabled:**
```yaml
volume: true       # ✅ NEEDED
equalizer: true    # ❌ Not used
karaoke: true      # ❌ Not used
timescale: true    # ❌ Not used
tremolo: true      # ❌ Not used
vibrato: true      # ❌ Not used
distortion: true   # ❌ Not used
rotation: true     # ❌ Not used
channelMix: true   # ❌ Not used
lowPass: true      # ❌ Not used
```

**Problem:**
- Your bot doesn't use any of these filters (no commands for them)
- Each enabled filter adds memory and initialization overhead
- Volume is the only one you need

**Recommended:**
```yaml
volume: true  # Only this one
```

**Impact:** LOW - Minimal overhead, but cleaner config

---

## ✅ Good Configuration Choices

These are correctly set:

1. **bufferDurationMs: 600** ✅
   - Good increase from my 400ms recommendation
   - Handles network jitter well
   - No significant latency impact

2. **opusEncodingQuality: 10** ✅
   - Maximum quality (matches Discord Level 1 boost at 128 kbps)
   - Perfect for your use case

3. **resamplingQuality: HIGH** ✅
   - Best quality for HTTP sources (Discord attachment URLs)
   - Prevents quality degradation during sample rate conversion

4. **gc-warnings: true** ✅
   - Essential for debugging GC pause issues
   - Helps identify if Java garbage collection causes stuttering

5. **trackStuckThresholdMs: 10000** ✅
   - 10 second timeout before declaring track stuck
   - Reasonable default

6. **useSeekGhosting: true** ✅
   - Smoother seeking behavior
   - Good for playlist navigation

---

## 📝 Recommended application.yml

Here's the optimized configuration with all issues fixed:

```yaml
server:
  port: 2333
  address: 127.0.0.1

lavalink:
  plugins:
    # No plugins needed for local MP3 playback

  server:
    password: "bardbot-secure-password-2025"

    sources:
      youtube: false
      bandcamp: false
      soundcloud: false
      twitch: false
      vimeo: false
      http: true      # Required for Discord attachment URLs
      local: true     # Required for local files

    filters:
      volume: true    # Only filter you use

    # Critical Discord voice gateway settings
    bufferDurationMs: 600              # Network jitter buffer (your setting - good!)
    frameBufferDurationMs: 1000        # 1s frame buffer (prevents CPU spike underruns)
    opusSendInterval: 20               # ⭐ CRITICAL: 20ms Discord standard
    opusEncodingQuality: 10            # Maximum quality (0-10)
    resamplingQuality: HIGH            # Best quality for HTTP sources

    # Playback settings
    trackStuckThresholdMs: 10000       # 10s timeout
    useSeekGhosting: true              # Smooth seeking
    playerUpdateInterval: 5            # 5s update interval (Lavalink default)

    # Search (not used by your bot, but harmless)
    youtubeSearchEnabled: false
    soundcloudSearchEnabled: false

    # Monitoring
    gc-warnings: true

metrics:
  prometheus:
    enabled: false
    endpoint: /metrics

sentry:
  dsn: ""
  environment: "production"

logging:
  file:
    path: ./logs/

  level:
    root: INFO
    lavalink: INFO

  logback:
    rollingpolicy:
      max-file-size: 10MB
      max-history: 30
```

---

## 🎯 Priority Changes Summary

### ❌ **MUST FIX (Critical for stuttering):**

1. **Add `opusSendInterval: 20`**
   - This is the #1 most important setting
   - Without it, Discord's jitter buffer fails = stuttering

### ⚠️ **SHOULD FIX (Improves experience):**

2. **Change `frameBufferDurationMs: 5000` → `1000`**
   - Reduces 5-second delay to 1-second delay
   - Still prevents underruns
   - Much better user experience

3. **Change `playerUpdateInterval: 1` → `5`**
   - Reduces overhead
   - No user-facing benefit from 1-second updates

### 💡 **OPTIONAL (Cleanup):**

4. **Disable unused sources** (youtube, bandcamp, etc.)
5. **Disable unused filters** (everything except volume)

---

## 🧪 Testing After Changes

1. **Apply the critical fix:**
   ```bash
   # Edit application.yml to add opusSendInterval: 20
   # Restart Lavalink
   ```

2. **Test stuttering:**
   - Play the same file that stuttered before
   - Play for 2-3 minutes minimum
   - Test with different sources (local, Discord URL)

3. **Test latency:**
   - Use `/skip` command
   - Measure time from command to new track starting
   - Should be <2 seconds

4. **Monitor logs:**
   ```bash
   sudo journalctl -u lavalink.service -f | grep -i "buffer\|underrun\|stuck"
   ```

---

## 📊 Expected Impact

| Issue | Current Impact | After Fix | Priority |
|-------|---------------|-----------|----------|
| Missing opusSendInterval | HIGH (stuttering) | ELIMINATED | ❌ CRITICAL |
| 5s frameBuffer | MEDIUM (slow skip) | Responsive | ⚠️ SHOULD FIX |
| 1s playerUpdate | LOW (overhead) | Reduced load | 💡 NICE TO HAVE |
| Unused sources | VERY LOW | Cleaner | 💡 NICE TO HAVE |

---

## 🔍 How to Verify Discord Timing

After adding `opusSendInterval: 20`, you can verify it's working by:

1. **Check Lavalink startup logs:**
   ```bash
   sudo journalctl -u lavalink.service | grep -i "opus"
   ```
   Look for: "Opus send interval: 20ms"

2. **Monitor packet timing in diagnose-voice.js:**
   - Packets should arrive every 20ms ±2ms
   - No gaps >50ms (would cause stutter)

3. **Listen for timing artifacts:**
   - **Before fix:** Occasional "hiccups" or brief pauses
   - **After fix:** Smooth, continuous playback

---

## 💡 Why opusSendInterval Matters Most

Discord's voice gateway expects:
```
Packet 1: 0ms
Packet 2: 20ms
Packet 3: 40ms
Packet 4: 60ms
...
```

If your bot sends at a different interval (e.g., 25ms, 30ms):
- Discord's jitter buffer tries to compensate
- Small timing errors accumulate
- After ~1-2 seconds: buffer overflow or underrun
- Result: **Audio stutter/skip/repeat**

Setting `opusSendInterval: 20` ensures your bot matches Discord's expectations exactly.

---

**Status:** Ready to apply fixes
**Priority:** HIGH - opusSendInterval is critical
**Estimated time to fix:** 2 minutes (edit YAML, restart service)
