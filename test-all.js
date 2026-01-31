const WebSocket = require('ws');
const ws = new WebSocket('ws://localhost:9876');

let tabId = null;
let testNum = 0;
const results = [];

function log(test, status, detail = '') {
  const icon = status === 'PASS' ? '✓' : status === 'FAIL' ? '✗' : '○';
  console.log(`${icon} ${test}${detail ? ': ' + detail : ''}`);
  results.push({ test, status, detail });
}

function send(msg) {
  ws.send(JSON.stringify({ id: ++testNum, ...msg }));
}

ws.on('open', () => {
  console.log('=== Tab Agent Feature Test ===\n');
  send({ action: 'tabs' });
});

ws.on('message', async (data) => {
  const msg = JSON.parse(data);

  switch (msg.id) {
    case 1: // tabs
      if (msg.ok && msg.tabs?.length > 0) {
        tabId = msg.tabs[0].tabId;
        log('tabs', 'PASS', `Found tab: ${msg.tabs[0].url.substring(0, 50)}...`);
        send({ action: 'snapshot', tabId });
      } else {
        log('tabs', 'FAIL', 'No active tabs');
        ws.close();
      }
      break;

    case 2: // snapshot
      if (msg.ok && msg.snapshot) {
        log('snapshot', 'PASS', `${msg.snapshot.length} chars`);
        send({ action: 'screenshot', tabId });
      } else {
        log('snapshot', 'FAIL', msg.error);
        send({ action: 'screenshot', tabId });
      }
      break;

    case 3: // screenshot
      if (msg.ok && msg.screenshot) {
        log('screenshot', 'PASS', `${Math.round(msg.screenshot.length / 1024)}KB`);
        send({ action: 'screenshot', tabId, fullPage: true });
      } else {
        log('screenshot', 'FAIL', msg.error);
        send({ action: 'screenshot', tabId, fullPage: true });
      }
      break;

    case 4: // screenshot fullPage
      if (msg.ok && msg.screenshot) {
        log('screenshot fullPage', 'PASS', `${Math.round(msg.screenshot.length / 1024)}KB`);
      } else {
        log('screenshot fullPage', 'FAIL', msg.error);
      }
      send({ action: 'scroll', tabId, direction: 'down', amount: 300 });
      break;

    case 5: // scroll
      if (msg.ok) {
        log('scroll', 'PASS', 'Scrolled down 300px');
      } else {
        log('scroll', 'FAIL', msg.error);
      }
      send({ action: 'scroll', tabId, direction: 'up', amount: 300 });
      break;

    case 6: // scroll up
      if (msg.ok) {
        log('scroll up', 'PASS', 'Scrolled back up');
      } else {
        log('scroll up', 'FAIL', msg.error);
      }
      send({ action: 'evaluate', tabId, script: 'document.title' });
      break;

    case 7: // evaluate
      if (msg.ok) {
        log('evaluate', 'PASS', `Title: "${msg.result}"`);
      } else {
        log('evaluate', 'FAIL', msg.error);
      }
      send({ action: 'evaluate', tabId, script: 'window.location.href' });
      break;

    case 8: // evaluate 2
      if (msg.ok) {
        log('evaluate (URL)', 'PASS', msg.result?.substring(0, 50));
      } else {
        log('evaluate (URL)', 'FAIL', msg.error);
      }
      send({ action: 'wait', tabId, selector: 'body', timeout: 2000 });
      break;

    case 9: // wait selector
      if (msg.ok) {
        log('wait (selector)', 'PASS', `Found: ${msg.found}`);
      } else {
        log('wait (selector)', 'FAIL', msg.error);
      }
      send({ action: 'press', tabId, key: 'Escape' });
      break;

    case 10: // press
      if (msg.ok) {
        log('press', 'PASS', 'Pressed Escape');
      } else {
        log('press', 'FAIL', msg.error);
      }
      // Done with safe tests
      console.log('\n=== Summary ===');
      const passed = results.filter(r => r.status === 'PASS').length;
      const failed = results.filter(r => r.status === 'FAIL').length;
      console.log(`Passed: ${passed}, Failed: ${failed}`);
      console.log('\nSkipped (require specific elements):');
      console.log('  - click (needs ref)');
      console.log('  - type (needs input ref)');
      console.log('  - fill (needs input ref)');
      console.log('  - batchfill (needs input refs)');
      console.log('  - scrollintoview (needs ref)');
      console.log('  - navigate (would leave page)');
      console.log('  - dialog (needs active dialog)');
      ws.close();
      break;
  }
});

ws.on('error', (e) => {
  console.error('WebSocket error:', e.message);
});

ws.on('close', () => {
  process.exit(results.some(r => r.status === 'FAIL') ? 1 : 0);
});

setTimeout(() => {
  console.log('\nTimeout - closing');
  ws.close();
}, 30000);
