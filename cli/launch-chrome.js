// cli/launch-chrome.js
const fs = require('fs');
const path = require('path');
const os = require('os');
const readline = require('readline');
const { execSync, spawn } = require('child_process');

function getChromeUserDataDir() {
  const home = os.homedir();
  const platform = os.platform();

  if (platform === 'darwin') {
    return path.join(home, 'Library/Application Support/Google/Chrome');
  } else if (platform === 'linux') {
    return path.join(home, '.config/google-chrome');
  } else if (platform === 'win32') {
    return path.join(process.env.LOCALAPPDATA, 'Google/Chrome/User Data');
  }
  return null;
}

function detectProfiles() {
  const userDataDir = getChromeUserDataDir();
  if (!userDataDir || !fs.existsSync(userDataDir)) return [];

  const candidates = ['Default'];
  try {
    const entries = fs.readdirSync(userDataDir);
    for (const entry of entries) {
      if (entry.startsWith('Profile ')) candidates.push(entry);
    }
  } catch (e) {}

  const profiles = [];
  for (const dir of candidates) {
    const prefsPath = path.join(userDataDir, dir, 'Preferences');
    if (!fs.existsSync(prefsPath)) continue;
    try {
      const prefs = JSON.parse(fs.readFileSync(prefsPath, 'utf8'));
      const name = prefs.profile?.name || dir;
      profiles.push({ dir, name });
    } catch (e) {
      profiles.push({ dir, name: dir });
    }
  }
  return profiles;
}

async function promptForProfile(profiles) {
  if (profiles.length === 0) {
    console.log('No Chrome profiles found.');
    return null;
  }

  if (profiles.length === 1) {
    console.log(`Using profile: ${profiles[0].name}`);
    return profiles[0];
  }

  console.log('\nChrome Profiles:');
  profiles.forEach((p, i) => {
    console.log(`  ${i + 1}. ${p.name} (${p.dir})`);
  });

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question(`\nSelect profile [1-${profiles.length}]: `, (answer) => {
      rl.close();
      const idx = parseInt(answer, 10) - 1;
      if (idx >= 0 && idx < profiles.length) {
        resolve(profiles[idx]);
      } else {
        console.log('Invalid selection, using first profile.');
        resolve(profiles[0]);
      }
    });
  });
}

function isChromeRunning() {
  const platform = os.platform();
  try {
    if (platform === 'darwin') {
      execSync('pgrep -x "Google Chrome"', { stdio: 'ignore' });
      return true;
    } else if (platform === 'linux') {
      execSync('pgrep -x chrome', { stdio: 'ignore' });
      return true;
    } else if (platform === 'win32') {
      const result = execSync('tasklist /FI "IMAGENAME eq chrome.exe" /NH', { encoding: 'utf8' });
      return result.includes('chrome.exe');
    }
  } catch (e) {}
  return false;
}

function launchChrome(profileDir) {
  const platform = os.platform();
  const args = profileDir ? [`--profile-directory=${profileDir}`] : [];

  if (platform === 'darwin') {
    spawn('open', ['-a', 'Google Chrome', '--args', ...args], {
      detached: true,
      stdio: 'ignore'
    }).unref();
  } else if (platform === 'linux') {
    spawn('google-chrome', args, {
      detached: true,
      stdio: 'ignore'
    }).unref();
  } else if (platform === 'win32') {
    const chromePath = path.join(
      process.env.PROGRAMFILES || 'C:\\Program Files',
      'Google\\Chrome\\Application\\chrome.exe'
    );
    spawn(chromePath, args, {
      detached: true,
      stdio: 'ignore'
    }).unref();
  }
}

function getConfigPath() {
  return path.join(os.homedir(), '.tab-agent.json');
}

function loadConfig() {
  try {
    return JSON.parse(fs.readFileSync(getConfigPath(), 'utf8'));
  } catch (e) {
    return {};
  }
}

function saveConfig(config) {
  const existing = loadConfig();
  const merged = { ...existing, ...config };
  fs.writeFileSync(getConfigPath(), JSON.stringify(merged, null, 2));
}

function getSavedProfile() {
  const config = loadConfig();
  return config.profile || null;
}

module.exports = { detectProfiles, getChromeUserDataDir, promptForProfile, isChromeRunning, launchChrome, loadConfig, saveConfig, getSavedProfile };
