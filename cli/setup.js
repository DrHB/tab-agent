// cli/setup.js
const fs = require('fs');
const path = require('path');
const os = require('os');
const { findTabAgentExtension, checkExistingManifest, promptForExtensionId } = require('./detect-extension');

async function setup() {
  console.log('BrowserAgent Setup\n');

  // 1. Detect extension ID
  console.log('Detecting extension...');
  let extensionId = null;

  const found = findTabAgentExtension();
  if (found) {
    extensionId = found.extId;
    console.log(`✓ Found extension: ${extensionId}`);
  } else {
    extensionId = checkExistingManifest();
    if (extensionId) {
      console.log(`✓ Found existing config: ${extensionId}`);
    } else {
      console.log('✗ Could not auto-detect extension');
      console.log('  Make sure BrowserAgent is loaded in chrome://extensions\n');
      extensionId = await promptForExtensionId();
    }
  }

  if (!extensionId || extensionId.length !== 32) {
    console.error('Invalid extension ID');
    process.exit(1);
  }

  // 2. Install native messaging host
  console.log('\nInstalling native messaging host...');
  installNativeHost(extensionId);
  console.log('✓ Native messaging host installed');

  // 3. Install skills
  console.log('\nInstalling skills...');
  installSkills();

  console.log('\n✓ Setup complete!\n');
  console.log('Usage:');
  console.log('  1. Click BrowserAgent icon on any tab (turns green)');
  console.log('  2. Ask Claude/Codex: "Use browseragent to search Google"');
  console.log('\nThe relay server starts automatically when needed.');
}

function installNativeHost(extensionId) {
  const platform = os.platform();
  const home = os.homedir();
  const packageDir = path.dirname(__dirname);

  let manifestDir;
  let wrapperName;

  if (platform === 'darwin') {
    manifestDir = path.join(home, 'Library/Application Support/Google/Chrome/NativeMessagingHosts');
    wrapperName = 'native-host-wrapper.sh';
  } else if (platform === 'linux') {
    manifestDir = path.join(home, '.config/google-chrome/NativeMessagingHosts');
    wrapperName = 'native-host-wrapper.sh';
  } else if (platform === 'win32') {
    manifestDir = path.join(home, 'AppData/Local/Google/Chrome/User Data/NativeMessagingHosts');
    wrapperName = 'native-host-wrapper.cmd';
  }

  fs.mkdirSync(manifestDir, { recursive: true });

  const wrapperPath = path.join(packageDir, 'relay', wrapperName);
  const manifest = {
    name: 'com.browseragent.relay',
    description: 'BrowserAgent Native Messaging Host',
    path: wrapperPath,
    type: 'stdio',
    allowed_origins: [`chrome-extension://${extensionId}/`]
  };

  const manifestPath = path.join(manifestDir, 'com.browseragent.relay.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

  // Make wrapper executable (Unix only)
  if (platform !== 'win32') {
    fs.chmodSync(wrapperPath, '755');
  }

  // Windows: also set registry key
  if (platform === 'win32') {
    const { execSync } = require('child_process');
    const regPath = 'HKCU\\Software\\Google\\Chrome\\NativeMessagingHosts\\com.browseragent.relay';
    execSync(`reg add "${regPath}" /ve /t REG_SZ /d "${manifestPath}" /f`);
  }
}

function installSkills() {
  const home = os.homedir();
  const packageDir = path.dirname(__dirname);
  const skillSource = path.join(packageDir, 'skills');

  // Claude Code - always install
  const claudeSkillDir = path.join(home, '.claude', 'skills');
  const claudeSkillPath = path.join(claudeSkillDir, 'browseragent.md');
  fs.mkdirSync(claudeSkillDir, { recursive: true });

  if (fs.existsSync(claudeSkillPath)) {
    console.log(`  Updating existing skill at ${claudeSkillPath}`);
  }
  fs.copyFileSync(
    path.join(skillSource, 'claude-code', 'browseragent.md'),
    claudeSkillPath
  );
  console.log('✓ Installed Claude Code skill');

  // Codex (only if .codex exists)
  const codexDir = path.join(home, '.codex');
  if (fs.existsSync(codexDir)) {
    const codexSkillDir = path.join(codexDir, 'skills');
    const codexSkillPath = path.join(codexSkillDir, 'browseragent.md');
    fs.mkdirSync(codexSkillDir, { recursive: true });

    if (fs.existsSync(codexSkillPath)) {
      console.log(`  Updating existing skill at ${codexSkillPath}`);
    }
    fs.copyFileSync(
      path.join(skillSource, 'codex', 'browseragent.md'),
      codexSkillPath
    );
    console.log('✓ Installed Codex skill');
  }
}

setup().catch(console.error);
