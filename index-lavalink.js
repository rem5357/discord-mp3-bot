// index-lavalink.js — BardBot: Discord Audio Playback Bot (Lavalink Edition)
// Version: 1.1 | Build: 67 - Fixed /stop and /shuffle crash
require('dotenv').config();
const fs = require('node:fs');
const path = require('node:path');
const fetch = require('node-fetch');

const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } = require('discord.js');
const { LavalinkManager } = require('lavalink-client');

const VERSION = '1.1';
const BUILD = 67;

const TOKEN = process.env.DISCORD_TOKEN;
const DEV_GUILD_ID = process.env.DEV_GUILD_ID;

// Music HTTP server configuration
const MUSIC_HTTP_BASE = 'http://localhost:8080/music';
const MUSIC_LOCAL_BASE = '/home/mithroll/Shared';

// Supported local formats
const SUPPORTED = new Set(['mp3','wav','ogg','opus','flac','m4a','aac','webm']);

// Parse M3U playlist file
function parseM3U(m3uPath, baseDir) {
  const content = fs.readFileSync(m3uPath, 'utf8');
  const lines = content.split(/\r?\n/);
  const tracks = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    let trackPath;
    if (path.isAbsolute(trimmed)) {
      trackPath = trimmed;
    } else {
      trackPath = path.join(baseDir, trimmed);
    }

    if (fs.existsSync(trackPath)) {
      const ext = path.extname(trackPath).slice(1).toLowerCase();
      if (SUPPORTED.has(ext)) {
        tracks.push(trackPath);
      }
    }
  }

  return tracks;
}

// Shuffle array using Fisher-Yates
function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

// Fetch and parse audio file URLs from a remote directory
async function fetchAudioUrlsFromRemote(baseUrl) {
  try {
    const response = await fetch(baseUrl);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const html = await response.text();
    const audioUrls = [];

    // Multiple regex patterns to handle different HTML formats
    const patterns = [
      // Match href with double quotes (allows apostrophes inside)
      /href="([^"]+\.(mp3|wav|ogg|opus|flac|m4a|aac|webm))"/gi,
      // Match href with single quotes (allows double quotes inside)
      /href='([^']+\.(mp3|wav|ogg|opus|flac|m4a|aac|webm))'/gi,
      // Apache directory listing format with spaces around =
      /href\s*=\s*"([^"]+\.(mp3|wav|ogg|opus|flac|m4a|aac|webm))"/gi,
      // Without quotes (some servers)
      /href=([^\s>]+\.(mp3|wav|ogg|opus|flac|m4a|aac|webm))[\s>]/gi
    ];

    // Try each pattern
    for (const pattern of patterns) {
      pattern.lastIndex = 0; // Reset regex
      let match;
      while ((match = pattern.exec(html)) !== null) {
        let audioUrl = match[1];

        // Skip parent directory links
        if (audioUrl === '..' || audioUrl === '../') continue;

        // Convert relative URLs to absolute
        if (audioUrl.startsWith('/')) {
          // Absolute path on same domain
          const urlObj = new URL(baseUrl);
          audioUrl = `${urlObj.protocol}//${urlObj.host}${audioUrl}`;
        } else if (!audioUrl.startsWith('http://') && !audioUrl.startsWith('https://')) {
          // Relative path - make sure baseUrl ends with /
          const base = baseUrl.endsWith('/') ? baseUrl : baseUrl + '/';
          audioUrl = new URL(audioUrl, base).href;
        }

        // Avoid duplicates
        if (!audioUrls.includes(audioUrl)) {
          audioUrls.push(audioUrl);
        }
      }

      // If we found files with this pattern, stop trying others
      if (audioUrls.length > 0) break;
    }

    console.log(`📊 Found ${audioUrls.length} audio file(s) at ${baseUrl}`);
    if (audioUrls.length > 0) {
      console.log(`First file: ${audioUrls[0]}`);
    }

    return audioUrls;
  } catch (error) {
    console.error('Error fetching audio URLs:', error);
    throw error;
  }
}

// Per-guild state
const guildStates = new Map();
function getState(guildId) {
  if (!guildStates.has(guildId)) {
    guildStates.set(guildId, {
      defaultVolume: 30,      // 0-100 scale for Lavalink
      queue: [],              // items: { kind:'file'|'url', input:string, name:string }
      currentTrack: null,
      player: null,
      shuffleMode: false,     // Persistent shuffle mode
      endAfterCurrent: false, // Flag for /end command
      lastPlayedDir: null,    // Remember last directory/playlist for shuffle
      lastTrackPaths: []      // Original track paths for reshuffling
    });
  }
  return guildStates.get(guildId);
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates],
});

// Initialize Lavalink Manager
const lavalink = new LavalinkManager({
  nodes: [
    {
      host: '127.0.0.1',
      port: 2333,
      authorization: 'bardbot-secure-password-2025',
      id: 'local-node',
      retryAmount: 5,
      retryDelay: 3000,
      secure: false
    }
  ],
  sendToShard: (guildId, payload) => {
    const guild = client.guilds.cache.get(guildId);
    if (guild) guild.shard.send(payload);
  },
  queueOptions: {
    maxPreviousTracks: 10
  },
  playerOptions: {
    onDisconnect: {
      destroyPlayer: false,
      autoReconnect: true
    },
    onEmptyQueue: {
      destroyAfterMs: 30_000
    },
    volumeDecrementer: 1, // 1 = 100% volume
    useUnresolvedData: true
  }
});

// Lavalink event handlers
lavalink.on('nodeConnect', (node) => {
  console.log(`✅ Lavalink node connected: ${node.options.id}`);
});

lavalink.on('nodeDisconnect', (node, reason) => {
  console.log(`❌ Lavalink node disconnected: ${node.options.id} - ${reason.reason}`);
});

lavalink.on('nodeError', (node, error) => {
  console.error(`🔥 Lavalink node error: ${node.options.id}`, error);
});

lavalink.on('trackStart', (player, track) => {
  console.log(`▶️ Now playing: ${track.info.title}`);
});

lavalink.on('trackEnd', (player, track, payload) => {
  console.log(`⏹️ Track ended: ${track.info.title}`);
});

lavalink.on('trackError', (player, track, payload) => {
  console.error(`💥 Track error: ${track.info.title}`, payload.exception);
});

lavalink.on('queueEnd', (player) => {
  console.log('⏸️ Queue empty - player will auto-destroy in 30s');
});

// Commands
const playCmd = new SlashCommandBuilder()
  .setName('playfile')
  .setDescription('Play an uploaded audio file in your current voice channel.')
  .addAttachmentOption(opt =>
    opt.setName('file').setDescription('An audio file to play (MP3, WAV, FLAC, etc.)').setRequired(true)
  )
  .addIntegerOption(opt =>
    opt.setName('volume').setDescription('Volume 0–100 (this track only)').setMinValue(0).setMaxValue(100)
  );

const volumeCmd = new SlashCommandBuilder()
  .setName('volume')
  .setDescription('Set default playback volume for future tracks (0–100).')
  .addIntegerOption(opt =>
    opt.setName('level').setDescription('Volume 0–100').setRequired(true).setMinValue(0).setMaxValue(100)
  );

const playdirCmd = new SlashCommandBuilder()
  .setName('playdir')
  .setDescription('Queue all supported audio files from a local directory (supports M3U playlists).')
  .addStringOption(opt => opt.setName('dir').setDescription('Local directory path').setRequired(true))
  .addBooleanOption(opt => opt.setName('start').setDescription('Start immediately if idle (default: true)'))
  .addBooleanOption(opt => opt.setName('shuffle').setDescription('Shuffle the playlist (default: false)'));

const playurlCmd = new SlashCommandBuilder()
  .setName('playurl')
  .setDescription('Queue all audio files from a remote URL directory listing.')
  .addStringOption(opt => opt.setName('url').setDescription('URL to directory with audio files (e.g., http://example.com/music)').setRequired(true))
  .addBooleanOption(opt => opt.setName('start').setDescription('Start immediately if idle (default: true)'))
  .addBooleanOption(opt => opt.setName('shuffle').setDescription('Shuffle the playlist (default: false)'));

const skipCmd = new SlashCommandBuilder().setName('skip').setDescription('Skip the current track.');
const stopCmd = new SlashCommandBuilder().setName('stop').setDescription('Stop playback and clear the queue.');
const shuffleCmd = new SlashCommandBuilder()
  .setName('shuffle')
  .setDescription('Toggle shuffle mode. Reshuffles current playlist or enables shuffle for next playdir.');
const endCmd = new SlashCommandBuilder()
  .setName('end')
  .setDescription('End playback after the current song finishes.');

client.once('ready', async () => {
  console.log('='.repeat(60));
  console.log(`🎵 BardBot v${VERSION} (Build ${BUILD}) - Lavalink Edition`);
  console.log(`✅ Logged in as ${client.user.tag}`);
  console.log('='.repeat(60));

  // Initialize Lavalink with client user info
  lavalink.init({
    id: client.user.id,
    username: client.user.username
  });

  const rest = new REST({ version: '10' }).setToken(TOKEN);
  await rest.put(
    Routes.applicationGuildCommands(client.user.id, DEV_GUILD_ID),
    { body: [playCmd.toJSON(), volumeCmd.toJSON(), playdirCmd.toJSON(), playurlCmd.toJSON(), skipCmd.toJSON(), stopCmd.toJSON(), shuffleCmd.toJSON(), endCmd.toJSON()] }
  );
  console.log('Slash commands: /playfile, /volume, /playdir, /playurl, /skip, /stop, /shuffle, /end');
  console.log('🎧 Lavalink integration active!');
});

// Voice state update handler for Lavalink
client.on('raw', (d) => {
  lavalink.sendRawData(d);
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const guildId = interaction.guildId;
  const state = getState(guildId);

  // ----- /playfile -----
  if (interaction.commandName === 'playfile') {
    const attachment = interaction.options.getAttachment('file', true);
    const member = interaction.member;
    const vc = member?.voice?.channel;

    if (!vc) return interaction.reply({ content: 'Join a voice channel first.', flags: 64 });

    const fileName = attachment.name.toLowerCase();
    const isAudio = attachment.contentType?.includes('audio/') ||
                    SUPPORTED.has(fileName.split('.').pop());

    if (!isAudio) return interaction.reply({ content: 'Please upload a valid audio file (MP3, WAV, FLAC, etc.)', flags: 64 });

    await interaction.deferReply({ flags: 64 });

    try {
      // Get or create player
      const player = lavalink.getPlayer(guildId) || lavalink.createPlayer({
        guildId: guildId,
        voiceChannelId: vc.id,
        textChannelId: interaction.channelId,
        selfDeaf: true,
        volume: state.defaultVolume
      });

      // Connect to voice if not already
      if (!player.connected) {
        await player.connect();
      }

      // Search/load track from URL
      const result = await player.search({ query: attachment.url }, interaction.user);

      if (!result || !result.tracks || result.tracks.length === 0) {
        return interaction.editReply('Failed to load audio file.');
      }

      const track = result.tracks[0];
      const perTrackVol = interaction.options.getInteger('volume', false) ?? state.defaultVolume;

      // Set volume and play
      await player.setVolume(perTrackVol);
      await player.queue.add(track);

      if (!player.playing && !player.paused) {
        await player.play();
      }

      await interaction.editReply(`Playing **${attachment.name}** in **${vc.name}** at **${perTrackVol}/100** volume.`);
    } catch (e) {
      console.error(e);
      await interaction.editReply('Audio playback failed.');
    }
    return;
  }

  // ----- /volume -----
  if (interaction.commandName === 'volume') {
    const level = interaction.options.getInteger('level', true);
    state.defaultVolume = level;

    const player = lavalink.getPlayer(guildId);
    if (player && player.connected) {
      await player.setVolume(level);
      return interaction.reply({ content: `Volume set to **${level}/100** (current and future tracks).`, flags: 64 });
    }

    return interaction.reply({ content: `Default volume set to **${level}/100** (applies to next track).`, flags: 64 });
  }

  // ----- /playdir -----
  if (interaction.commandName === 'playdir') {
    const dirRaw = interaction.options.getString('dir', true);
    const startNow = interaction.options.getBoolean('start') ?? true;
    const shouldShuffle = interaction.options.getBoolean('shuffle') ?? state.shuffleMode; // Use persistent shuffle mode if not explicitly set
    const member = interaction.member;
    const vc = member?.voice?.channel;

    if (!vc) return interaction.reply({ content: 'Join a voice channel first.', flags: 64 });

    // IMPORTANT: Defer reply IMMEDIATELY before any heavy processing
    await interaction.deferReply({ flags: 64 });

    const dir = path.resolve(dirRaw);
    console.log(`📁 Playlist dir: ${dir}`);

    let stat;
    try { stat = fs.statSync(dir); } catch {
      return interaction.editReply(`Directory not found: \`${dir}\``);
    }
    if (!stat.isDirectory()) {
      return interaction.editReply(`Not a directory: \`${dir}\``);
    }

    const dirContents = fs.readdirSync(dir);
    const m3uFiles = dirContents.filter(f => f.toLowerCase().endsWith('.m3u'));

    let trackPaths = [];
    let playlistType = 'directory';

    if (m3uFiles.length > 0) {
      const m3uPath = path.join(dir, m3uFiles[0]);
      console.log(`🎵 Found M3U playlist: ${m3uFiles[0]}`);
      trackPaths = parseM3U(m3uPath, dir);
      playlistType = 'M3U';
    } else {
      trackPaths = dirContents
        .filter(f => SUPPORTED.has(path.extname(f).slice(1).toLowerCase()))
        .map(f => path.join(dir, f))
        .sort((a, b) => path.basename(a).localeCompare(path.basename(b), undefined, { numeric: true }));
    }

    if (trackPaths.length === 0) {
      return interaction.editReply(`No supported files in \`${dir}\`.\nSupported: ${[...SUPPORTED].join(', ')}`);
    }

    // Store directory and original track paths for /shuffle command
    state.lastPlayedDir = dir;
    state.lastTrackPaths = [...trackPaths]; // Store copy before shuffling

    if (shouldShuffle) {
      shuffleArray(trackPaths);
      playlistType += ' (shuffled)';
      console.log('🔀 Playlist shuffled');
    }

    try {
      // Get or create player
      const player = lavalink.getPlayer(guildId) || lavalink.createPlayer({
        guildId: guildId,
        voiceChannelId: vc.id,
        textChannelId: interaction.channelId,
        selfDeaf: true,
        volume: state.defaultVolume
      });

      if (!player.connected) {
        await player.connect();
      }

      // Load all tracks - convert local paths to HTTP URLs
      let loadedCount = 0;
      for (const trackPath of trackPaths) {
        try {
          // Convert local file path to HTTP URL
          // Example: /home/mithroll/Shared/Songs1/song.mp3
          //       -> http://localhost:8080/music/Songs1/song.mp3

          const basename = path.basename(trackPath);
          let httpUrl;
          if (trackPath.startsWith(MUSIC_LOCAL_BASE)) {
            // Path is in /home/mithroll/Shared
            const relativePath = trackPath.substring(MUSIC_LOCAL_BASE.length);
            // URL-encode each path component
            const encodedPath = relativePath.split('/').map(encodeURIComponent).join('/');
            httpUrl = `${MUSIC_HTTP_BASE}${encodedPath}`;
          } else {
            // Try to find corresponding path in music directory
            const dirname = path.basename(path.dirname(trackPath));
            httpUrl = `${MUSIC_HTTP_BASE}/${dirname}/${encodeURIComponent(basename)}`;
          }

          console.log(`🔍 Loading: ${basename} → ${httpUrl}`);
          const result = await player.search({ query: httpUrl }, interaction.user);

          if (result && result.tracks && result.tracks.length > 0) {
            await player.queue.add(result.tracks[0]);
            loadedCount++;
            console.log(`✅ Loaded: ${path.basename(trackPath)}`);
          } else {
            console.warn(`⚠️ Failed to load: ${path.basename(trackPath)}`);
            if (result?.exception) {
              console.warn(`   Error: ${result.exception.message}`);
            }
          }
        } catch (err) {
          console.error(`❌ Failed to load ${path.basename(trackPath)}:`, err.message);
        }
      }

      if (loadedCount === 0) {
        return interaction.editReply('Failed to load any tracks from directory.');
      }

      if (startNow && !player.playing && !player.paused) {
        await player.play();
      }

      await interaction.editReply(`Queued **${loadedCount}** tracks from ${playlistType} \`${dir}\`. ${startNow ? 'Starting…' : 'Added to queue.'}`);
    } catch (e) {
      console.error(e);
      await interaction.editReply('Failed to queue directory.');
    }
    return;
  }

  // ----- /playurl -----
  if (interaction.commandName === 'playurl') {
    const urlRaw = interaction.options.getString('url', true);
    const startNow = interaction.options.getBoolean('start') ?? true;
    const shouldShuffle = interaction.options.getBoolean('shuffle') ?? state.shuffleMode;
    const member = interaction.member;
    const vc = member?.voice?.channel;

    if (!vc) return interaction.reply({ content: 'Join a voice channel first.', flags: 64 });

    // IMPORTANT: Defer reply IMMEDIATELY before any heavy processing
    await interaction.deferReply({ flags: 64 });

    console.log(`🌐 Fetching audio files from URL: ${urlRaw}`);

    try {
      // Fetch audio file URLs from the remote directory
      const audioUrls = await fetchAudioUrlsFromRemote(urlRaw);

      if (audioUrls.length === 0) {
        return interaction.editReply(`No audio files found at \`${urlRaw}\`.\nSupported formats: ${[...SUPPORTED].join(', ')}`);
      }

      console.log(`Found ${audioUrls.length} audio files`);

      // Store URL and track paths for /shuffle command
      state.lastPlayedDir = urlRaw;
      state.lastTrackPaths = [...audioUrls]; // Store URLs as paths

      let trackUrls = [...audioUrls];
      if (shouldShuffle) {
        shuffleArray(trackUrls);
        console.log('🔀 Playlist shuffled');
      }

      // Get or create player
      const player = lavalink.getPlayer(guildId) || lavalink.createPlayer({
        guildId: guildId,
        voiceChannelId: vc.id,
        textChannelId: interaction.channelId,
        selfDeaf: true,
        volume: state.defaultVolume
      });

      if (!player.connected) {
        await player.connect();
      }

      // Load all tracks
      let loadedCount = 0;
      for (const audioUrl of trackUrls) {
        try {
          console.log(`🔍 Loading: ${audioUrl}`);
          const result = await player.search({ query: audioUrl }, interaction.user);

          if (result && result.tracks && result.tracks.length > 0) {
            await player.queue.add(result.tracks[0]);
            loadedCount++;
            console.log(`✅ Loaded: ${audioUrl}`);
          } else {
            console.warn(`⚠️ Failed to load: ${audioUrl}`);
            if (result?.exception) {
              console.warn(`   Error: ${result.exception.message}`);
            }
          }
        } catch (err) {
          console.error(`❌ Failed to load ${audioUrl}:`, err.message);
        }
      }

      if (loadedCount === 0) {
        return interaction.editReply('Failed to load any tracks from URL.');
      }

      if (startNow && !player.playing && !player.paused) {
        await player.play();
      }

      const playlistType = shouldShuffle ? 'remote directory (shuffled)' : 'remote directory';
      await interaction.editReply(`Queued **${loadedCount}** tracks from ${playlistType} \`${urlRaw}\`. ${startNow ? 'Starting…' : 'Added to queue.'}`);
    } catch (e) {
      console.error(e);
      await interaction.editReply(`Failed to fetch audio files from URL: ${e.message}`);
    }
    return;
  }

  // ----- /skip -----
  if (interaction.commandName === 'skip') {
    const player = lavalink.getPlayer(guildId);
    if (player && player.playing) {
      await player.skip();
      return interaction.reply({ content: 'Skipped current track.', flags: 64 });
    }
    return interaction.reply({ content: 'Nothing is playing.', flags: 64 });
  }

  // ----- /stop -----
  if (interaction.commandName === 'stop') {
    const player = lavalink.getPlayer(guildId);
    if (player) {
      // Clear queue - lavalink-client uses tracks array
      player.queue.tracks = [];
      await player.destroy();
      state.endAfterCurrent = false; // Clear end flag
      return interaction.reply({ content: 'Stopped playback and cleared the queue.', flags: 64 });
    }
    return interaction.reply({ content: 'Nothing is playing.', flags: 64 });
  }

  // ----- /shuffle -----
  if (interaction.commandName === 'shuffle') {
    const player = lavalink.getPlayer(guildId);

    // Toggle shuffle mode
    state.shuffleMode = !state.shuffleMode;
    const shuffleModeText = state.shuffleMode ? 'ON' : 'OFF';

    // If currently playing and we have track paths, reshuffle and restart
    if (player && player.playing && state.lastTrackPaths.length > 0) {
      await interaction.deferReply({ flags: 64 });

      try {
        const vc = interaction.member?.voice?.channel;
        if (!vc) {
          return interaction.editReply('You must be in a voice channel to shuffle the current playlist.');
        }

        // Shuffle the track paths
        const shuffledPaths = [...state.lastTrackPaths];
        shuffleArray(shuffledPaths);

        console.log('🔀 Reshuffling current playlist...');

        // Clear current queue and stop current track - lavalink-client uses tracks array
        player.queue.tracks = [];
        if (player.playing) {
          player.queue.current = null;
        }

        // Reload all tracks in shuffled order
        let loadedCount = 0;
        for (const trackPath of shuffledPaths) {
          try {
            let httpUrl;

            // If it's already a remote URL (from /playurl), use it directly
            if (trackPath.startsWith('http://') || trackPath.startsWith('https://')) {
              httpUrl = trackPath;
            } else if (trackPath.startsWith(MUSIC_LOCAL_BASE)) {
              // Local file - convert to HTTP URL
              const relativePath = trackPath.substring(MUSIC_LOCAL_BASE.length);
              const encodedPath = relativePath.split('/').map(encodeURIComponent).join('/');
              httpUrl = `${MUSIC_HTTP_BASE}${encodedPath}`;
            } else {
              // Fallback for other local paths
              const basename = path.basename(trackPath);
              const dirname = path.basename(path.dirname(trackPath));
              httpUrl = `${MUSIC_HTTP_BASE}/${dirname}/${encodeURIComponent(basename)}`;
            }

            const result = await player.search({ query: httpUrl }, interaction.user);
            if (result && result.tracks && result.tracks.length > 0) {
              await player.queue.add(result.tracks[0]);
              loadedCount++;
            }
          } catch (err) {
            console.error(`❌ Failed to load ${path.basename(trackPath)}:`, err.message);
          }
        }

        if (loadedCount > 0) {
          await player.play();
          return interaction.editReply(`🔀 Shuffle **${shuffleModeText}** - Restarted playlist with **${loadedCount}** shuffled tracks!`);
        } else {
          return interaction.editReply('Failed to reshuffle playlist.');
        }
      } catch (e) {
        console.error(e);
        return interaction.editReply('Failed to reshuffle playlist.');
      }
    } else {
      // Not currently playing, just toggle the mode for next playdir
      return interaction.reply({
        content: `🔀 Shuffle mode **${shuffleModeText}** - Will apply to next /playdir command.`,
        flags: 64
      });
    }
  }

  // ----- /end -----
  if (interaction.commandName === 'end') {
    const player = lavalink.getPlayer(guildId);
    if (player && player.playing) {
      state.endAfterCurrent = true;

      // Clear the queue but keep current track playing - lavalink-client uses tracks array
      player.queue.tracks = [];

      return interaction.reply({ content: 'Playback will end after the current song finishes.', flags: 64 });
    }
    return interaction.reply({ content: 'Nothing is playing.', flags: 64 });
  }
});

client.login(TOKEN);
