// index-lavalink.js — BardBot: Discord Audio Playback Bot (Lavalink Edition)
// Version: 1.01 | Build: 58 - Added /shuffle and /end commands with queue bugfix
require('dotenv').config();
const fs = require('node:fs');
const path = require('node:path');

const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } = require('discord.js');
const { LavalinkManager } = require('lavalink-client');

const VERSION = '1.01';
const BUILD = 58;

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
    { body: [playCmd.toJSON(), volumeCmd.toJSON(), playdirCmd.toJSON(), skipCmd.toJSON(), stopCmd.toJSON(), shuffleCmd.toJSON(), endCmd.toJSON()] }
  );
  console.log('Slash commands: /playfile, /volume, /playdir, /skip, /stop, /shuffle, /end');
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
      await player.stop();
      await player.disconnect();
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

        // Clear current queue - lavalink-client uses tracks array
        player.queue.tracks = [];
        await player.stop();

        // Reload all tracks in shuffled order
        let loadedCount = 0;
        for (const trackPath of shuffledPaths) {
          try {
            const basename = path.basename(trackPath);
            let httpUrl;
            if (trackPath.startsWith(MUSIC_LOCAL_BASE)) {
              const relativePath = trackPath.substring(MUSIC_LOCAL_BASE.length);
              const encodedPath = relativePath.split('/').map(encodeURIComponent).join('/');
              httpUrl = `${MUSIC_HTTP_BASE}${encodedPath}`;
            } else {
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
