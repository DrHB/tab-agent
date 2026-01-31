// cli/status.js
const fs = require('fs');
const path = require('path');
const os = require('os');
const http = require('http');

function checkRelayServer() {
  return new Promise((resolve) => {
    const req = http.get('http://localhost:9876/health', (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve({ running: true, clients: json.clients });
        } catch {
          resolve({ running: false });
        }
      });
    });
    req.on('error', () => resolve({ running: false }));
    req.setTimeout(2000, () => {
      req.destroy();
      resolve({ running: false });
    });
  });
}

async function status() {
  console.log('TabPilot Status\n');

  // Check native host
  const home = os.homedir();
  const platform = os.platform();
  let manifestPath;

  if (platform === 'darwin') {
    manifestPath = path.join(home, 'Library/Application Support/Google/Chrome/NativeMessagingHosts/com.tabpilot.relay.json');
  } else if (platform === 'linux') {
    manifestPath = path.join(home, '.config/google-chrome/NativeMessagingHosts/com.tabpilot.relay.json');
  } else if (platform === 'win32') {
    manifestPath = path.join(home, 'AppData/Local/Google/Chrome/User Data/NativeMessagingHosts/com.tabpilot.relay.json');
  }

  if (fs.existsSync(manifestPath)) {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    console.log('Native Host: Installed');
    console.log(`  Extension: ${manifest.allowed_origins[0]}`);
  } else {
    console.log('Native Host: Not installed (run: npx tabpilot setup)');
  }

  // Check skills
  const claudeSkill = path.join(home, '.claude', 'skills', 'tabpilot.md');
  const codexSkill = path.join(home, '.codex', 'skills', 'tabpilot.md');

  console.log(`\nClaude Skill: ${fs.existsSync(claudeSkill) ? 'Installed' : 'Not installed'}`);
  console.log(`Codex Skill:  ${fs.existsSync(codexSkill) ? 'Installed' : 'Not installed (optional)'}`);

  // Check relay server
  console.log('\nRelay Server:');
  const relayStatus = await checkRelayServer();
  if (relayStatus.running) {
    console.log(`  Status: Running (${relayStatus.clients} client${relayStatus.clients !== 1 ? 's' : ''})`);
  } else {
    console.log('  Status: Not running (starts automatically when needed)');
  }
}

status().catch(console.error);
