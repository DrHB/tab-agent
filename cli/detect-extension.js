// cli/detect-extension.js
const fs = require('fs');
const path = require('path');
const os = require('os');

// Support multiple browsers: Chrome, Brave, Edge, Chromium
function getAllBrowserExtensionPaths() {
  const platform = os.platform();
  const home = os.homedir();
  const paths = [];

  if (platform === 'darwin') {
    const base = path.join(home, 'Library/Application Support');
    paths.push(
      path.join(base, 'Google/Chrome'),
      path.join(base, 'Google/Chrome Canary'),
      path.join(base, 'Chromium'),
      path.join(base, 'BraveSoftware/Brave-Browser'),
      path.join(base, 'Microsoft Edge'),
    );
  } else if (platform === 'linux') {
    paths.push(
      path.join(home, '.config/google-chrome'),
      path.join(home, '.config/chromium'),
      path.join(home, '.config/BraveSoftware/Brave-Browser'),
      path.join(home, '.config/microsoft-edge'),
    );
  } else if (platform === 'win32') {
    const localAppData = process.env.LOCALAPPDATA;
    paths.push(
      path.join(localAppData, 'Google/Chrome/User Data'),
      path.join(localAppData, 'Chromium/User Data'),
      path.join(localAppData, 'BraveSoftware/Brave-Browser/User Data'),
      path.join(localAppData, 'Microsoft/Edge/User Data'),
    );
  }

  // Expand to include Default and Profile N directories
  const expandedPaths = [];
  for (const browserPath of paths) {
    if (!fs.existsSync(browserPath)) continue;

    const profiles = ['Default', ...fs.readdirSync(browserPath).filter(f => f.startsWith('Profile '))];
    for (const profile of profiles) {
      const extPath = path.join(browserPath, profile, 'Extensions');
      if (fs.existsSync(extPath)) {
        expandedPaths.push(extPath);
      }
    }
  }

  return expandedPaths;
}

function findTabAgentExtension() {
  const extensionPaths = getAllBrowserExtensionPaths();

  for (const extPath of extensionPaths) {
    try {
      const extIds = fs.readdirSync(extPath);

      for (const extId of extIds) {
        const extDir = path.join(extPath, extId);
        if (!fs.statSync(extDir).isDirectory()) continue;

        const versions = fs.readdirSync(extDir).filter(v => !v.startsWith('.'));

        for (const version of versions) {
          const manifestPath = path.join(extDir, version, 'manifest.json');
          if (fs.existsSync(manifestPath)) {
            try {
              const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
              if (manifest.name === 'Tab Agent') {
                return { extId, browser: extPath };
              }
            } catch (e) {}
          }
        }
      }
    } catch (e) {}
  }
  return null;
}

function checkExistingManifest() {
  const platform = os.platform();
  const home = os.homedir();
  let manifestPath;

  if (platform === 'darwin') {
    manifestPath = path.join(home, 'Library/Application Support/Google/Chrome/NativeMessagingHosts/com.tabagent.relay.json');
  } else if (platform === 'linux') {
    manifestPath = path.join(home, '.config/google-chrome/NativeMessagingHosts/com.tabagent.relay.json');
  } else if (platform === 'win32') {
    manifestPath = path.join(home, 'AppData/Local/Google/Chrome/User Data/NativeMessagingHosts/com.tabagent.relay.json');
  }

  if (manifestPath && fs.existsSync(manifestPath)) {
    try {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      const origin = manifest.allowed_origins?.[0];
      if (origin) {
        const match = origin.match(/chrome-extension:\/\/([^/]+)/);
        if (match) return match[1];
      }
    } catch (e) {}
  }
  return null;
}

async function promptForExtensionId() {
  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question('Enter extension ID from chrome://extensions: ', (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

module.exports = {
  findTabAgentExtension,
  checkExistingManifest,
  promptForExtensionId,
  getAllBrowserExtensionPaths
};
