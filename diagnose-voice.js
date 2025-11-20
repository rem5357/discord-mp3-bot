#!/usr/bin/env node
// diagnose-voice.js - Diagnose Discord voice gateway connection issues
// This script helps identify stuttering causes related to Discord voice

const { Client, GatewayIntentBits } = require('discord.js');
const { LavalinkManager } = require('lavalink-client');
require('dotenv').config();

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates],
});

let diagnostics = {
  connectionEstablished: false,
  lavalinkConnected: false,
  voiceServerRegion: null,
  pingMs: null,
  voiceGatewayLatency: null,
  udpPingMs: null,
  issues: []
};

// Initialize Lavalink
const lavalink = new LavalinkManager({
  nodes: [
    {
      host: '127.0.0.1',
      port: 2333,
      authorization: 'bardbot-secure-password-2025',
      id: 'local-node',
      retryAmount: 3,
      retryDelay: 2000,
      secure: false
    }
  ],
  sendToShard: (guildId, payload) => {
    const guild = client.guilds.cache.get(guildId);
    if (guild) guild.shard.send(payload);
  },
  playerOptions: {
    onDisconnect: {
      destroyPlayer: false,
      autoReconnect: true
    }
  }
});

// Lavalink diagnostics
lavalink.on('nodeConnect', (node) => {
  diagnostics.lavalinkConnected = true;
  console.log('✅ Lavalink connection: HEALTHY');
  console.log(`   Node ID: ${node.options.id}`);
  console.log(`   Host: ${node.options.host}:${node.options.port}`);
});

lavalink.on('nodeDisconnect', (node, reason) => {
  diagnostics.issues.push(`Lavalink disconnected: ${reason.reason}`);
  console.log('❌ Lavalink connection: FAILED');
  console.log(`   Reason: ${reason.reason}`);
});

lavalink.on('nodeError', (node, error) => {
  diagnostics.issues.push(`Lavalink error: ${error.message}`);
  console.log('⚠️  Lavalink error:', error.message);
});

// Voice state tracking
let voiceStateChanges = 0;
let lastVoiceServerUpdate = null;

client.on('raw', (packet) => {
  lavalink.sendRawData(packet);

  // Track voice server updates
  if (packet.t === 'VOICE_SERVER_UPDATE') {
    voiceStateChanges++;
    lastVoiceServerUpdate = Date.now();

    console.log('\n📡 Voice Server Update Detected:');
    console.log(`   Endpoint: ${packet.d.endpoint}`);
    console.log(`   Token: ${packet.d.token.substring(0, 20)}...`);

    if (packet.d.endpoint) {
      // Extract region from endpoint (e.g., "russia123.discord.gg")
      const region = packet.d.endpoint.split('.')[0].replace(/[0-9]/g, '');
      diagnostics.voiceServerRegion = region;
      console.log(`   Region: ${region.toUpperCase()}`);
    }
  }

  if (packet.t === 'VOICE_STATE_UPDATE') {
    console.log('🔊 Voice State Update');
  }
});

client.once('ready', async () => {
  diagnostics.connectionEstablished = true;
  console.log('\n╔════════════════════════════════════════════════════════╗');
  console.log('║  Discord Voice Gateway Diagnostics - Build 67         ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');

  console.log(`✅ Discord Bot: CONNECTED`);
  console.log(`   Username: ${client.user.tag}`);
  console.log(`   Guilds: ${client.guilds.cache.size}`);

  // Test WebSocket ping
  diagnostics.pingMs = client.ws.ping;
  console.log(`   WebSocket Ping: ${client.ws.ping}ms`);

  if (client.ws.ping > 100) {
    diagnostics.issues.push(`High WebSocket latency: ${client.ws.ping}ms (should be <100ms)`);
    console.log('   ⚠️  WARNING: High latency detected!');
  }

  console.log('\n───────────────────────────────────────────────────────');
  console.log('Waiting for Lavalink connection...\n');

  // Wait for Lavalink
  await new Promise(resolve => setTimeout(resolve, 3000));

  if (!diagnostics.lavalinkConnected) {
    diagnostics.issues.push('Lavalink failed to connect - check if server is running');
    console.log('\n❌ CRITICAL: Lavalink is not running!');
    console.log('   Run: ./start-lavalink.sh');
    printSummary();
    process.exit(1);
  }

  console.log('\n───────────────────────────────────────────────────────');
  console.log('📊 Network Performance Test\n');

  // Ping test to Discord API
  const pingStart = Date.now();
  try {
    await client.guilds.fetch();
    const apiLatency = Date.now() - pingStart;
    console.log(`✅ Discord API Latency: ${apiLatency}ms`);

    if (apiLatency > 200) {
      diagnostics.issues.push(`High API latency: ${apiLatency}ms`);
      console.log('   ⚠️  High API latency - network issues possible');
    }
  } catch (error) {
    diagnostics.issues.push(`API request failed: ${error.message}`);
    console.log(`❌ Discord API: FAILED - ${error.message}`);
  }

  console.log('\n───────────────────────────────────────────────────────');
  console.log('🎵 Voice Connection Analysis\n');

  console.log('To complete diagnostics:');
  console.log('1. Join a voice channel in your Discord server');
  console.log('2. Use /playmp3 to start playing audio');
  console.log('3. Watch for voice gateway updates above');
  console.log('\nMonitoring for 30 seconds...\n');

  // Monitor for 30 seconds
  await new Promise(resolve => setTimeout(resolve, 30000));

  console.log('\n───────────────────────────────────────────────────────');
  printSummary();
  process.exit(0);
});

function printSummary() {
  console.log('\n╔════════════════════════════════════════════════════════╗');
  console.log('║  Diagnostic Summary                                    ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');

  console.log('Connection Status:');
  console.log(`  Discord Bot:     ${diagnostics.connectionEstablished ? '✅ Connected' : '❌ Failed'}`);
  console.log(`  Lavalink:        ${diagnostics.lavalinkConnected ? '✅ Connected' : '❌ Failed'}`);
  console.log(`  WebSocket Ping:  ${diagnostics.pingMs !== null ? diagnostics.pingMs + 'ms' : 'N/A'}`);

  if (diagnostics.voiceServerRegion) {
    console.log(`  Voice Region:    ${diagnostics.voiceServerRegion.toUpperCase()}`);
  }

  console.log(`\nVoice Updates: ${voiceStateChanges}`);

  if (diagnostics.issues.length > 0) {
    console.log('\n⚠️  Issues Detected:\n');
    diagnostics.issues.forEach((issue, index) => {
      console.log(`   ${index + 1}. ${issue}`);
    });
  } else {
    console.log('\n✅ No issues detected during basic diagnostics');
  }

  console.log('\n───────────────────────────────────────────────────────');
  console.log('Common Stuttering Causes:\n');
  console.log('1. High latency to Discord voice servers (>150ms)');
  console.log('2. CPU spikes causing packet send delays');
  console.log('3. Network jitter/packet loss (test with ping -c 100 discord.com)');
  console.log('4. Bitrate mismatch between encoder and Discord channel');
  console.log('5. Lavalink buffer underruns (check Lavalink logs)');
  console.log('6. Discord voice server region far from bot location');
  console.log('\n───────────────────────────────────────────────────────');
  console.log('Next Steps:\n');
  console.log('• Check Lavalink logs: sudo journalctl -u lavalink.service -f');
  console.log('• Test network stability: ping -c 100 discord.com');
  console.log('• Monitor CPU during playback: htop');
  console.log('• Check Discord voice region matches your location');
  console.log('• Ensure bot has high process priority (nice -10)');
  console.log('\n');
}

// Error handling
process.on('unhandledRejection', (error) => {
  console.error('❌ Unhandled error:', error);
  diagnostics.issues.push(`Unhandled error: ${error.message}`);
});

// Start
lavalink.init({ client, userId: undefined });
client.login(process.env.DISCORD_BOT_TOKEN);
