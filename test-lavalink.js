// test-lavalink.js - Simple Lavalink connection test
// Run Lavalink server first: java -jar Lavalink.jar

const http = require('http');

const LAVALINK_HOST = '127.0.0.1';
const LAVALINK_PORT = 2333;
const LAVALINK_PASSWORD = 'bardbot-secure-password-2025';

console.log('🔍 Testing Lavalink connection...\n');

// Test HTTP connection to Lavalink's /version endpoint
const options = {
  hostname: LAVALINK_HOST,
  port: LAVALINK_PORT,
  path: '/version',
  method: 'GET',
  headers: {
    'Authorization': LAVALINK_PASSWORD
  }
};

const req = http.request(options, (res) => {
  let data = '';

  console.log(`✅ Connected to Lavalink!`);
  console.log(`📡 HTTP Status: ${res.statusCode}`);
  console.log(`📊 Headers:`, res.headers);

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    console.log(`\n📋 Version info:\n${data}`);
    console.log('\n✅ Lavalink server is running correctly!');
    console.log('\nNext steps:');
    console.log('1. Check that you can see Lavalink logs in the server terminal');
    console.log('2. Verify no errors in the Lavalink console');
    console.log('3. You\'re ready to integrate with the Discord bot!');
  });
});

req.on('error', (error) => {
  console.error('❌ Failed to connect to Lavalink:');
  console.error(error.message);
  console.error('\nTroubleshooting:');
  console.error('1. Make sure Lavalink is running: java -jar Lavalink.jar');
  console.error('2. Check that port 2333 is not blocked');
  console.error('3. Verify application.yml has correct password');
  console.error(`4. Lavalink should be accessible at http://${LAVALINK_HOST}:${LAVALINK_PORT}`);
  process.exit(1);
});

req.end();
