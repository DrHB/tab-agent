// cli/launch-chrome.js
const fs = require('fs');
const path = require('path');
const os = require('os');
const readline = require('readline');

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

module.exports = { detectProfiles, getChromeUserDataDir, promptForProfile };
