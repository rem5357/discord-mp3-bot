// index.js — BardBot: Discord Audio Playback Bot
// Version: 0.31 | Build: 53 - Added FFmpeg encoder buffer settings (-bufsize, -maxrate)
require('dotenv').config();
const fs = require('node:fs');
const path = require('node:path');
const { PassThrough } = require('node:stream');
const { execSync, spawn } = require('node:child_process');

// Try to set this process to higher priority
try {
  if (process.platform === 'linux') {
    execSync(`renice -n -10 -p ${process.pid}`, { stdio: 'ignore' });
    console.log('⚡ Process priority set to -10 (higher priority)');
  }
} catch (e) {
  console.log('⚠️ Could not set process priority. Run with sudo for better performance.');
  console.log('   Try: sudo nice -n -10 node index.js');
}

const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } = require('discord.js');
const {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  NoSubscriberBehavior,
  AudioPlayerStatus,
  getVoiceConnection,
  StreamType,
  demuxProbe
} = require('@discordjs/voice');
const prism = require('prism-media');

const VERSION = '0.31';
const BUILD = 53;

const TOKEN = process.env.DISCORD_TOKEN;
const DEV_GUILD_ID = process.env.DEV_GUILD_ID;

// Supported local formats (FFmpeg will decode most things)
const SUPPORTED = new Set(['mp3','wav','ogg','opus','flac','m4a','aac','webm']);

// Parse M3U playlist file and return ordered list of file paths
function parseM3U(m3uPath, baseDir) {
  const content = fs.readFileSync(m3uPath, 'utf8');
  const lines = content.split(/\r?\n/);
  const tracks = [];

  for (const line of lines) {
    const trimmed = line.trim();
    // Skip empty lines and comments
    if (!trimmed || trimmed.startsWith('#')) continue;

    // Handle both absolute and relative paths
    let trackPath;
    if (path.isAbsolute(trimmed)) {
      trackPath = trimmed;
    } else {
      // Relative path - resolve from M3U file's directory
      trackPath = path.join(baseDir, trimmed);
    }

    // Check if file exists and is supported
    if (fs.existsSync(trackPath)) {
      const ext = path.extname(trackPath).slice(1).toLowerCase();
      if (SUPPORTED.has(ext)) {
        tracks.push(trackPath);
      }
    }
  }

  return tracks;
}

// Shuffle array in place using Fisher-Yates algorithm
function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

const guildStates = new Map();
function getState(guildId) {
  if (!guildStates.has(guildId)) {
    // Configure player with better buffering behavior
    const player = createAudioPlayer({
      behaviors: {
        noSubscriber: NoSubscriberBehavior.Stop,
        maxMissedFrames: 100  // More tolerance for missed frames
      }
    });

    // Enhanced state logging
    let last = player.state.status;
    player.on('stateChange', (oldS, newS) => {
      if (newS.status !== last) {
        console.log(`🎚️ Player: ${oldS.status} -> ${newS.status}`);
        last = newS.status;
        // Log if we're buffering
        if (newS.status === AudioPlayerStatus.Buffering) {
          console.log('⏸️ Buffering detected - potential underrun');
        }
      }
    });

    const state = {
      player,
      connection: null,
      resource: null,
      defaultVolume: 3,   // 0–10 default
      queue: []           // items: { kind:'file'|'url', input:string, name:string }
    };

    player.on(AudioPlayerStatus.Idle, () => { state.resource = null; playNext(guildId); });
    player.on('error', (err) => {
      console.error('🎧 Player error:', err?.message ?? err);
      console.error('Error details:', err);
      state.resource = null;
      playNext(guildId);
    });

    guildStates.set(guildId, state);
  }
  return guildStates.get(guildId);
}

function ensureConnection(guild, voiceChannel) {
  const state = getState(guild.id);
  if (!state.connection) {
    console.log(`🔗 Joining VC: ${voiceChannel.name}`);
    state.connection = joinVoiceChannel({
      channelId: voiceChannel.id,
      guildId: guild.id,
      adapterCreator: guild.voiceAdapterCreator,
      selfDeaf: true,
    });
    state.connection.subscribe(state.player);
  }
  return state.connection;
}

// Build a resource with PROPER async pre-buffering and optimized Opus streaming
function makeFfmpegResource(localOrUrl, volume01) {
  const isRemote = /^https?:\/\//i.test(localOrUrl);
  const inputArg = isRemote ? localOrUrl : path.resolve(localOrUrl);

  console.log(`🎵 Source: ${inputArg}`);
  console.log(`📊 Build ${BUILD}: FFmpeg encoder buffer fix (-bufsize 512k, -maxrate 128k)`)
  console.log(`🎚️ Volume: ${Math.round(volume01 * 10)}/10`);
  console.log(`🎯 Quality: 48kHz stereo Opus @ 64kbps (Discord default)`);
  console.log(`⚡ Optimization: Encoder buffer 512KB prevents rate fluctuations`);

  return new Promise((resolve, reject) => {
    const args = [
      '-hide_banner',
      '-loglevel', 'warning',
      '-nostdin',
      // Reduced analysis buffers for faster start
      '-analyzeduration', '5M',
      '-probesize', '10M',
      // Multi-threading for faster decoding
      '-threads', '0',
      ...(isRemote ? ['-reconnect','1','-reconnect_streamed','1','-reconnect_delay_max','5'] : []),
      '-i', inputArg,
      // No video
      '-vn',
      // Map first audio stream
      '-map', '0:a:0',
      // Volume filter with proper scaling
      '-af', `volume=${volume01}:precision=fixed`,
      // Output Ogg Opus - native Discord format
      '-c:a', 'libopus',
      '-bufsize', '512k',   // Encoder buffer size (prevents rate fluctuations)
      '-maxrate', '128k',   // Maximum bitrate ceiling (maintains consistent encoding)
      '-b:a', '64k',        // Reduced to Discord's default 64kbps
      '-vbr', 'on',         // Variable bitrate for better quality/size ratio
      '-frame_duration', '20', // 20ms frames (Discord standard)
      '-packet_loss', '1',  // 1% expected packet loss tolerance
      '-f', 'ogg',
      // 48kHz stereo (Discord requirement)
      '-ar', '48000',
      '-ac', '2'
    ];

    // Create FFmpeg process (prism-media will handle the spawning)
    const ff = new prism.FFmpeg({ args });

    // Try to increase FFmpeg process priority on Linux (improved timing with polling)
    if (process.platform === 'linux') {
      let attempts = 0;
      const maxAttempts = 10; // Check for 100ms total
      const priorityInterval = setInterval(() => {
        attempts++;
        if (ff.process?.pid) {
          clearInterval(priorityInterval);
          try {
            execSync(`renice -n -15 -p ${ff.process.pid}`, { stdio: 'ignore' });
            console.log(`🚀 FFmpeg PID ${ff.process.pid} priority set to -15 (high priority)`);
          } catch (e) {
            console.warn(`⚠️ Failed to set FFmpeg priority: ${e.message}`);
          }
        } else if (attempts >= maxAttempts) {
          clearInterval(priorityInterval);
          console.warn(`⚠️ FFmpeg process did not spawn within 100ms, priority not set`);
        }
      }, 10); // Check every 10ms
    }

    // Track stream health
    let bytesRead = 0;
    let lastReport = Date.now();

    ff.on('error', (err) => {
      console.error('🔥 FFmpeg error:', err?.message ?? err);
      reject(err);
    });

    // Optimized 512KB buffer (reduced from 128MB to prevent over-buffering)
    const stream = new PassThrough({
      highWaterMark: 512 * 1024  // 512KB buffer
    });

    // Pre-buffer data before resolving
    let cachedChunks = [];
    let cacheSize = 0;
    // CRITICAL FIX: Reduced to 16KB (~2 seconds at 64kbps) to prevent Discord jitter buffer overflow
    // Old value: 8MB = 17 minutes of audio, causing Discord to speed up playback
    const CACHE_TARGET = 16 * 1024; // Pre-buffer 16KB (~250ms at 64kbps)
    let caching = true;
    let resourceCreated = false;

    console.log('🗄️ Pre-buffering 16KB of Opus data (~250ms at 64kbps)...');

    // Monitor data flow for debugging
    ff.on('data', (chunk) => {
      if (caching) {
        cachedChunks.push(chunk);
        cacheSize += chunk.length;

        if (cacheSize >= CACHE_TARGET && !resourceCreated) {
          console.log(`✅ Pre-buffered ${(cacheSize / 1024).toFixed(1)}KB - ready for playback`);
          caching = false;
          resourceCreated = true;

          // Write all cached chunks at once
          cachedChunks.forEach(c => stream.write(c));
          const initialSize = cachedChunks.length;
          cachedChunks = [];

          // Use Ogg Opus stream type - native Discord format for best performance
          // NOTE: Inline volume disabled to eliminate performance overhead
          const resource = createAudioResource(stream, {
            inputType: StreamType.OggOpus,
            inlineVolume: false,  // Disabled for performance
            highWaterMark: 8      // Reduced from 24 to 8 (160ms) - prevents Discord jitter compensation
          });

          // Store FFmpeg reference for cleanup
          resource._ffmpeg = ff;

          console.log(`🎵 Stream has ${initialSize} Opus chunks ready, playback will start smoothly`);

          // Resolve with the resource NOW that buffer is full
          resolve(resource);
        }
      } else {
        // After pre-buffer, write directly to stream
        stream.write(chunk);
      }

      bytesRead += chunk.length;
      const now = Date.now();
      if (now - lastReport > 5000) {  // Report every 5 seconds
        // FIXED: Divide by seconds, not milliseconds
        const kbps = (bytesRead * 8) / ((now - lastReport) / 1000);
        console.log(`📈 Stream health: ${Math.round(kbps)} kbps (target: ~64 kbps for Opus)`);
        bytesRead = 0;
        lastReport = now;
      }
    });

    ff.on('end', () => {
      // Flush any remaining cached data if we never hit the cache target
      if (caching && cachedChunks.length > 0 && !resourceCreated) {
        console.log(`⚠️ File smaller than cache target, using ${(cacheSize / 1024).toFixed(1)}KB`);
        cachedChunks.forEach(c => stream.write(c));

        const resource = createAudioResource(stream, {
          inputType: StreamType.OggOpus,
          inlineVolume: false,
          highWaterMark: 8      // Reduced from 24 to 8 (160ms) - prevents Discord jitter compensation
        });

        resource._ffmpeg = ff;
        resourceCreated = true;
        resolve(resource);
      }
      stream.end();
    });
  });
}

async function playNext(guildId) {
  const state = getState(guildId);

  // Clean up previous resource
  if (state.resource?._ffmpeg && !state.resource._ffmpeg.destroyed) {
    state.resource._ffmpeg.destroy();
  }

  const next = state.queue.shift();

  if (!next) {
    console.log('⏹️ Queue empty — leaving VC');
    getVoiceConnection(guildId)?.destroy();
    state.connection = null;
    state.resource = null;
    return;
  }

  console.log(`▶️ Now playing: ${next.name ?? next.input}`);

  if (next.kind === 'file' && !fs.existsSync(next.input)) {
    console.error(`❌ Missing file, skipping: ${next.input}`);
    return playNext(guildId);
  }

  try {
    // WAIT for pre-buffering to complete before starting playback
    const resource = await makeFfmpegResource(next.input, state.defaultVolume / 10);
    state.resource = resource;

    // NOW start playback with full buffer
    state.player.play(resource);
    console.log('🎵 Playback started with full pre-buffer!');
  } catch (e) {
    console.error('💥 Failed to start track:', e?.message ?? e);
    playNext(guildId);
  }
}

// -------------------- Discord setup & commands --------------------
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates],
});

// /playmp3 file:<attachment> [volume]
const playCmd = new SlashCommandBuilder()
  .setName('playmp3')
  .setDescription('Play an uploaded audio file in your current voice channel.')
  .addAttachmentOption(opt =>
    opt.setName('file').setDescription('An audio file to play (MP3, WAV, FLAC, etc.)').setRequired(true)
  )
  .addIntegerOption(opt =>
    opt.setName('volume').setDescription('Volume 0–10 (this track only)').setMinValue(0).setMaxValue(10)
  );

// /volume level:<0-10>  (future tracks)
const volumeCmd = new SlashCommandBuilder()
  .setName('volume')
  .setDescription('Set default playback volume for future tracks (0–10).')
  .addIntegerOption(opt =>
    opt.setName('level').setDescription('Volume 0–10').setRequired(true).setMinValue(0).setMaxValue(10)
  );

// /playdir dir:"D:\Music\Album" [start:true] [shuffle:false]
const playdirCmd = new SlashCommandBuilder()
  .setName('playdir')
  .setDescription('Queue all supported audio files from a local directory (supports M3U playlists).')
  .addStringOption(opt => opt.setName('dir').setDescription('Local directory path').setRequired(true))
  .addBooleanOption(opt => opt.setName('start').setDescription('Start immediately if idle (default: true)'))
  .addBooleanOption(opt => opt.setName('shuffle').setDescription('Shuffle the playlist (default: false)'));

// /skip, /stop
const skipCmd = new SlashCommandBuilder().setName('skip').setDescription('Skip the current track.');
const stopCmd = new SlashCommandBuilder().setName('stop').setDescription('Stop playback and clear the queue.');

client.once('ready', async () => {
  console.log('='.repeat(60));
  console.log(`🎵 BardBot v${VERSION} (Build ${BUILD})`);
  console.log(`✅ Logged in as ${client.user.tag}`);
  console.log('='.repeat(60));
  const rest = new REST({ version: '10' }).setToken(TOKEN);
  await rest.put(
    Routes.applicationGuildCommands(client.user.id, DEV_GUILD_ID),
    { body: [playCmd.toJSON(), volumeCmd.toJSON(), playdirCmd.toJSON(), skipCmd.toJSON(), stopCmd.toJSON()] }
  );
  console.log('Slash commands: /playmp3, /volume, /playdir, /skip, /stop');
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const guildId = interaction.guildId;
  const state = getState(guildId);

  // ----- /playmp3 -----
  if (interaction.commandName === 'playmp3') {
    const attachment = interaction.options.getAttachment('file', true);
    const member = interaction.member;
    const vc = member?.voice?.channel;
    if (!vc) return interaction.reply({ content: 'Join a voice channel first.', flags: 64 });

    // More flexible audio file checking
    const fileName = attachment.name.toLowerCase();
    const isAudio = attachment.contentType?.includes('audio/') ||
                    SUPPORTED.has(fileName.split('.').pop());

    if (!isAudio) return interaction.reply({ content: 'Please upload a valid audio file (MP3, WAV, FLAC, etc.)', flags: 64 });

    await interaction.deferReply({ flags: 64 });
    ensureConnection(interaction.guild, vc);

    // Clean up previous resource
    if (state.resource?._ffmpeg && !state.resource._ffmpeg.destroyed) {
      state.resource._ffmpeg.destroy();
    }

    try {
      const perTrackVol = (interaction.options.getInteger('volume', false) ?? state.defaultVolume) / 10;

      // WAIT for pre-buffering to complete before starting playback
      const res = await makeFfmpegResource(attachment.url, perTrackVol);
      state.resource = res;

      // NOW start playback with full buffer
      state.player.play(res);
      console.log('🎵 Upload playback started with full pre-buffer!');

      await interaction.editReply(`Playing **${attachment.name}** in **${vc.name}** at **${Math.round(perTrackVol*10)}/10** volume.`);
    } catch (e) {
      console.error(e);
      await interaction.editReply('Audio playback failed.');
    }
    return;
  }

  // ----- /volume -----
  if (interaction.commandName === 'volume') {
    const level = interaction.options.getInteger('level', true); // 0–10
    state.defaultVolume = level;

    // Volume is applied via FFmpeg filter (affects future tracks only)
    return interaction.reply({ content: `Default volume set to **${level}/10** (applies to next track).`, flags: 64 });
  }

  // ----- /playdir -----
  if (interaction.commandName === 'playdir') {
    const dirRaw = interaction.options.getString('dir', true);
    const startNow = interaction.options.getBoolean('start') ?? true;
    const shouldShuffle = interaction.options.getBoolean('shuffle') ?? false;
    const member = interaction.member;
    const vc = member?.voice?.channel;

    if (!vc) return interaction.reply({ content: 'Join a voice channel first.', flags: 64 });

    const dir = path.resolve(dirRaw);
    console.log(`📁 Playlist dir: ${dir}`);

    let stat;
    try { stat = fs.statSync(dir); } catch {
      return interaction.reply({ content: `Directory not found: \`${dir}\``, flags: 64 });
    }
    if (!stat.isDirectory()) {
      return interaction.reply({ content: `Not a directory: \`${dir}\``, flags: 64 });
    }

    // Check for M3U playlist files in the directory
    const dirContents = fs.readdirSync(dir);
    const m3uFiles = dirContents.filter(f => f.toLowerCase().endsWith('.m3u'));

    let trackPaths = [];
    let playlistType = 'directory';

    // If M3U file(s) found, use the first one
    if (m3uFiles.length > 0) {
      const m3uPath = path.join(dir, m3uFiles[0]);
      console.log(`🎵 Found M3U playlist: ${m3uFiles[0]}`);
      trackPaths = parseM3U(m3uPath, dir);
      playlistType = 'M3U';
    } else {
      // No M3U - get all supported audio files and sort alphabetically
      trackPaths = dirContents
        .filter(f => SUPPORTED.has(path.extname(f).slice(1).toLowerCase()))
        .map(f => path.join(dir, f))
        .sort((a, b) => path.basename(a).localeCompare(path.basename(b), undefined, { numeric: true }));
    }

    if (trackPaths.length === 0) {
      return interaction.reply({ content: `No supported files in \`${dir}\`.\nSupported: ${[...SUPPORTED].join(', ')}`, flags: 64 });
    }

    // Apply shuffle if requested
    if (shouldShuffle) {
      shuffleArray(trackPaths);
      playlistType += ' (shuffled)';
      console.log('🔀 Playlist shuffled');
    }

    // Convert to queue format
    const files = trackPaths.map(trackPath => ({
      kind: 'file',
      input: trackPath,
      name: path.basename(trackPath)
    }));

    for (const file of files) state.queue.push(file);

    ensureConnection(interaction.guild, vc);
    await interaction.reply({ content: `Queued **${files.length}** tracks from ${playlistType} \`${dir}\`. ${startNow ? 'Starting…' : 'Added to queue.'}`, flags: 64 });

    if (startNow && state.player.state.status !== AudioPlayerStatus.Playing) {
      playNext(guildId);
    }
    return;
  }

  // ----- /skip -----
  if (interaction.commandName === 'skip') {
    if (state.player.state.status === AudioPlayerStatus.Playing) {
      state.player.stop(true); // triggers Idle -> next
      return interaction.reply({ content: 'Skipped current track.', flags: 64 });
    }
    return interaction.reply({ content: 'Nothing is playing.', flags: 64 });
  }

  // ----- /stop -----
  if (interaction.commandName === 'stop') {
    state.queue.length = 0;
    // Clean up current resource
    if (state.resource?._ffmpeg && !state.resource._ffmpeg.destroyed) {
      state.resource._ffmpeg.destroy();
    }
    state.player.stop(true);
    getVoiceConnection(guildId)?.destroy();
    state.connection = null;
    state.resource = null;
    return interaction.reply({ content: 'Stopped playback and cleared the queue.', flags: 64 });
  }
});

client.login(TOKEN);
