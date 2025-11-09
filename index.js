// index.js — BardBot: Discord Audio Playback Bot
// Version: 0.22 | Build: 40
require('dotenv').config();
const fs = require('node:fs');
const path = require('node:path');
const { PassThrough } = require('node:stream');

const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } = require('discord.js');
const {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  NoSubscriberBehavior,
  AudioPlayerStatus,
  getVoiceConnection,
  StreamType
} = require('@discordjs/voice');
const prism = require('prism-media');

const VERSION = '0.22';
const BUILD = 40;

const TOKEN = process.env.DISCORD_TOKEN;
const DEV_GUILD_ID = process.env.DEV_GUILD_ID;

// Supported local formats (FFmpeg will decode most things)
const SUPPORTED = new Set(['mp3','wav','ogg','opus','flac','m4a','aac','webm']);

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

// Build a resource with proper Opus encoding for 128kbps boosted server
function makeFfmpegResource(localOrUrl, volume01) {
  const isRemote = /^https?:\/\//i.test(localOrUrl);
  const inputArg = isRemote ? localOrUrl : path.resolve(localOrUrl);

  console.log(`🎵 Source: ${inputArg}`);
  console.log(`📊 Build ${BUILD}: Opus 128kbps for boosted server`);

  // Use libopus encoder directly for maximum quality and compatibility
  const args = [
    '-hide_banner',
    '-loglevel', 'warning',
    '-nostdin',
    // NO readrate throttling - let FFmpeg read as fast as it can
    // Large analysis buffers
    '-analyzeduration', '10M',
    '-probesize', '50M',
    // Allow FFmpeg to use more threads
    '-threads', '0',
    ...(isRemote ? ['-reconnect','1','-reconnect_streamed','1','-reconnect_delay_max','5'] : []),
    '-i', inputArg,
    // No video
    '-vn',
    // Map first audio stream
    '-map', '0:a:0',
    // Apply volume in the filter chain
    '-af', `volume=${volume01}`,
    // Use libopus encoder (not the container format)
    '-c:a', 'libopus',
    // 128kbps for boosted server quality
    '-b:a', '128k',
    // 48kHz stereo as required by Discord
    '-ar', '48000',
    '-ac', '2',
    // Music application type for better quality
    '-application', 'audio',
    // Maximum packet size for lower latency
    '-packet_loss', '0',
    '-vbr', 'off',  // Constant bitrate for consistent streaming
    '-compression_level', '10',
    // Output format
    '-f', 'opus'
  ];

  const ff = new prism.FFmpeg({ args });

  // Track stream health
  let bytesRead = 0;
  let lastReport = Date.now();

  ff.on('error', (err) => {
    console.error('🔥 FFmpeg error:', err?.message ?? err);
  });

  // Use a larger buffer and track data flow
  const stream = new PassThrough({
    highWaterMark: 1 << 25  // 32MB buffer
  });

  // Monitor data flow for debugging
  ff.on('data', (chunk) => {
    bytesRead += chunk.length;
    const now = Date.now();
    if (now - lastReport > 5000) {  // Report every 5 seconds
      const kbps = (bytesRead * 8) / (now - lastReport);
      console.log(`📈 Stream health: ${Math.round(kbps)} kbps`);
      bytesRead = 0;
      lastReport = now;
    }
  });

  ff.pipe(stream);

  // Clean up FFmpeg process when stream ends
  stream.on('close', () => {
    if (!ff.destroyed) ff.destroy();
  });

  // Use Opus stream type with the libopus output
  const resource = createAudioResource(stream, {
    inputType: StreamType.Opus,
    inlineVolume: false  // Volume handled by FFmpeg filter
  });

  // Store FFmpeg reference for cleanup
  resource._ffmpeg = ff;

  return resource;
}

function playNext(guildId) {
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
    const resource = makeFfmpegResource(next.input, state.defaultVolume / 10);
    state.resource = resource;

    // Add a small delay to let the buffer fill before starting playback
    console.log('⏳ Pre-buffering for 500ms...');
    setTimeout(() => {
      state.player.play(resource);
      console.log('🎵 Playback started');
    }, 500);
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
  .setDescription('Play an uploaded MP3 in your current voice channel.')
  .addAttachmentOption(opt =>
    opt.setName('file').setDescription('An MP3 file to play').setRequired(true)
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

// /playdir dir:"D:\Music\Album" [start:true]
const playdirCmd = new SlashCommandBuilder()
  .setName('playdir')
  .setDescription('Queue all supported audio files from a local directory (non-recursive).')
  .addStringOption(opt => opt.setName('dir').setDescription('Local directory path').setRequired(true))
  .addBooleanOption(opt => opt.setName('start').setDescription('Start immediately if idle (default: true)'));

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

    const isMp3 = (attachment.contentType?.includes('audio/mpeg')) || attachment.name.toLowerCase().endsWith('.mp3');
    if (!isMp3) return interaction.reply({ content: 'Please upload a valid **.mp3** file.', flags: 64 });

    await interaction.deferReply({ flags: 64 });
    ensureConnection(interaction.guild, vc);

    // Clean up previous resource
    if (state.resource?._ffmpeg && !state.resource._ffmpeg.destroyed) {
      state.resource._ffmpeg.destroy();
    }

    try {
      const perTrackVol = (interaction.options.getInteger('volume', false) ?? state.defaultVolume) / 10;
      const res = makeFfmpegResource(attachment.url, perTrackVol);
      state.resource = res;

      // Pre-buffer before playing
      console.log('⏳ Pre-buffering uploaded file...');
      setTimeout(() => {
        state.player.play(res);
        console.log('🎵 Upload playback started');
      }, 500);

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
    return interaction.reply({ content: `Default volume set to **${level}/10** (applies to next track).`, flags: 64 });
  }

  // ----- /playdir -----
  if (interaction.commandName === 'playdir') {
    const dirRaw = interaction.options.getString('dir', true);
    const startNow = interaction.options.getBoolean('start') ?? true;
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

    let files = fs.readdirSync(dir)
      .filter(f => SUPPORTED.has(path.extname(f).slice(1).toLowerCase()))
      .map(f => ({ kind:'file', input: path.join(dir, f), name: f }))
      .sort((a,b) => a.name.localeCompare(b.name, undefined, { numeric:true }));

    if (files.length === 0) {
      return interaction.reply({ content: `No supported files in \`${dir}\`.\nSupported: ${[...SUPPORTED].join(', ')}`, flags: 64 });
    }

    for (const file of files) state.queue.push(file);

    ensureConnection(interaction.guild, vc);
    await interaction.reply({ content: `Queued **${files.length}** tracks from \`${dir}\`. ${startNow ? 'Starting…' : 'Added to queue.'}`, flags: 64 });

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
