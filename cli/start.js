// cli/start.js
const path = require('path');
const { spawn } = require('child_process');
const { detectProfiles, promptForProfile, isChromeRunning, launchChrome } = require('./launch-chrome');

async function start() {
  // Launch Chrome if not running
  if (!isChromeRunning()) {
    console.log('Chrome is not running.\n');
    const profiles = detectProfiles();

    if (profiles.length > 0) {
      const selected = await promptForProfile(profiles);
      if (selected) {
        console.log(`\nLaunching Chrome with profile "${selected.name}"...`);
        launchChrome(selected.dir);
        // Give Chrome time to start and load extension
        await new Promise(r => setTimeout(r, 3000));
      }
    } else {
      console.log('Launching Chrome...');
      launchChrome(null);
      await new Promise(r => setTimeout(r, 3000));
    }
  } else {
    console.log('Chrome is already running.');
  }

  // Start relay server
  const serverPath = path.join(__dirname, '..', 'relay', 'server.js');
  const server = spawn('node', [serverPath], {
    stdio: 'inherit',
    detached: false
  });

  server.on('error', (err) => {
    console.error('Failed to start server:', err.message);
    process.exit(1);
  });

  process.on('SIGINT', () => {
    server.kill();
    process.exit(0);
  });
}

start().catch(console.error);
