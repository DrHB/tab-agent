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
  console.log('Tab Agent Status\n');

  // Check native host
  const home = os.homedir();
  const platform = os.platform();
  let manifestPath;

  if (platform === 'darwin') {
    manifestPath = path.join(home, 'Library/Application Support/Google/Chrome/NativeMessagingHosts/com.tabagent.relay.json');
  } else if (platform === 'linux') {
    manifestPath = path.join(home, '.config/google-chrome/NativeMessagingHosts/com.tabagent.relay.json');
  } else if (platform === 'win32') {
    manifestPath = path.join(home, 'AppData/Local/Google/Chrome/User Data/NativeMessagingHosts/com.tabagent.relay.json');
  }

  if (fs.existsSync(manifestPath)) {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    console.log('Native Host: Installed');
    console.log(`  Extension: ${manifest.allowed_origins[0]}`);
  } else {
    console.log('Native Host: Not installed (run: npx tab-agent setup)');
  }

  // Check skills
  const claudeSkill = path.join(home, '.claude', 'skills', 'tab-agent', 'SKILL.md');
  const codexSkill = path.join(home, '.codex', 'skills', 'tab-agent', 'SKILL.md');
  const legacyClaudeSkill = path.join(home, '.claude', 'skills', 'tab-agent.md');
  const legacyCodexSkill = path.join(home, '.codex', 'skills', 'tab-agent.md');

  const claudeSkillStatus = fs.existsSync(claudeSkill)
    ? 'Installed'
    : fs.existsSync(legacyClaudeSkill)
      ? 'Installed (legacy path)'
      : 'Not installed';
  const codexSkillStatus = fs.existsSync(codexSkill)
    ? 'Installed'
    : fs.existsSync(legacyCodexSkill)
      ? 'Installed (legacy path)'
      : 'Not installed (optional)';

  console.log(`\nClaude Skill: ${claudeSkillStatus}`);
  console.log(`Codex Skill:  ${codexSkillStatus}`);

  // Check relay server
  console.log('\nRelay Server:');
  const relayStatus = await checkRelayServer();
  if (relayStatus.running) {
    console.log(`  Status: Running (${relayStatus.clients} client${relayStatus.clients !== 1 ? 's' : ''})`);
  } else {
    console.log('  Status: Not running (start with: npx tab-agent start)');
  }
}

status().catch(console.error);
