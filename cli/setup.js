// cli/setup.js
const fs = require('fs');
const path = require('path');
const os = require('os');
const { findTabAgentExtension, checkExistingManifest, promptForExtensionId } = require('./detect-extension');
const { detectProfiles, promptForProfile, saveConfig } = require('./launch-chrome');

async function setup() {
  console.log('Tab Agent Setup\n');

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
      console.log('  Make sure Tab Agent is loaded in chrome://extensions\n');
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

  // 3. Select Chrome profile
  console.log('\nDetecting Chrome profiles...');
  const profiles = detectProfiles();
  if (profiles.length > 0) {
    const selected = await promptForProfile(profiles);
    if (selected) {
      saveConfig({ profile: selected.dir });
      console.log(`✓ Saved default profile: ${selected.name} (${selected.dir})`);
    }
  } else {
    console.log('  No Chrome profiles found, skipping.');
  }

  // 4. Install skills
  console.log('\nInstalling skills...');
  installSkills();

  console.log('\n✓ Setup complete!\n');
  console.log('Usage:');
  console.log('  1. Start relay server: npx tab-agent start');
  console.log('  2. Click Tab Agent icon on any tab (turns green)');
  console.log('  3. Ask Claude/Codex: "Use tab-agent to search Google"');
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
    name: 'com.tabagent.relay',
    description: 'Tab Agent Native Messaging Host',
    path: wrapperPath,
    type: 'stdio',
    allowed_origins: [`chrome-extension://${extensionId}/`]
  };

  const manifestPath = path.join(manifestDir, 'com.tabagent.relay.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

  // Make wrapper executable (Unix only)
  if (platform !== 'win32') {
    fs.chmodSync(wrapperPath, '755');
  }

  // Windows: also set registry key
  if (platform === 'win32') {
    const { execSync } = require('child_process');
    const regPath = 'HKCU\\Software\\Google\\Chrome\\NativeMessagingHosts\\com.tabagent.relay';
    execSync(`reg add "${regPath}" /ve /t REG_SZ /d "${manifestPath}" /f`);
  }
}

function installSkills() {
  const home = os.homedir();
  const packageDir = path.dirname(__dirname);
  const skillSource = path.join(packageDir, 'skills');

  // Claude Code - always install
  // Expected structure: ~/.claude/skills/tab-agent/SKILL.md
  const claudeSkillDir = path.join(home, '.claude', 'skills', 'tab-agent');
  const claudeSkillPath = path.join(claudeSkillDir, 'SKILL.md');

  // Remove old flat file if it exists (from previous versions)
  const oldClaudeSkillPath = path.join(home, '.claude', 'skills', 'tab-agent.md');
  if (fs.existsSync(oldClaudeSkillPath)) {
    fs.unlinkSync(oldClaudeSkillPath);
    console.log('  Removed old skill file format');
  }

  fs.mkdirSync(claudeSkillDir, { recursive: true });

  if (fs.existsSync(claudeSkillPath)) {
    console.log(`  Updating existing skill at ${claudeSkillDir}`);
  }
  fs.copyFileSync(
    path.join(skillSource, 'claude-code', 'tab-agent', 'SKILL.md'),
    claudeSkillPath
  );
  console.log('✓ Installed Claude Code skill');

  // Codex - always install (create .codex if needed)
  // Expected structure: ~/.codex/skills/tab-agent/SKILL.md
  const codexSkillDir = path.join(home, '.codex', 'skills', 'tab-agent');
  const codexSkillPath = path.join(codexSkillDir, 'SKILL.md');

  // Remove old flat file if it exists (from previous versions)
  const oldCodexSkillPath = path.join(home, '.codex', 'skills', 'tab-agent.md');
  if (fs.existsSync(oldCodexSkillPath)) {
    fs.unlinkSync(oldCodexSkillPath);
    console.log('  Removed old Codex skill file format');
  }

  fs.mkdirSync(codexSkillDir, { recursive: true });

  if (fs.existsSync(codexSkillPath)) {
    console.log(`  Updating existing skill at ${codexSkillDir}`);
  }
  fs.copyFileSync(
    path.join(skillSource, 'codex', 'tab-agent', 'SKILL.md'),
    codexSkillPath
  );
  console.log('✓ Installed Codex skill');
}

setup().catch(console.error);
