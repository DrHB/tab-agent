// relay/auth.js
// Shared secret used to authenticate local clients of the relay.
//
// The relay listens on loopback, which every local account can reach, and a
// WebSocket handshake is not covered by the same-origin policy: without a
// secret, anything able to open a socket on the machine can drive the browser.
// The token is what separates a client the user installed from everything else
// that happens to be running.
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

// Lowercase on purpose: Node normalises incoming header names.
const TOKEN_HEADER = 'x-tab-agent-token';

/**
 * Absolute path of the config file holding the relay token.
 *
 * TAB_AGENT_CONFIG overrides the default location, which is what the test
 * suite uses to avoid touching the real user config.
 *
 * @returns {string} Path to the JSON config file.
 */
function getConfigPath() {
  return process.env.TAB_AGENT_CONFIG || path.join(os.homedir(), '.tab-agent.json');
}

/**
 * Read the token the relay wrote at startup.
 *
 * @returns {string|null} The token, or null when the relay has never run.
 */
function readToken() {
  try {
    const config = JSON.parse(fs.readFileSync(getConfigPath(), 'utf8'));
    return typeof config.token === 'string' && config.token.length > 0 ? config.token : null;
  } catch (error) {
    // Missing or malformed config: the caller decides whether that is fatal.
    return null;
  }
}

/**
 * Return the current token, generating and persisting one on first run.
 *
 * The config file is rewritten with mode 0600 every time: any local account
 * able to read it can control the user's browser.
 *
 * @returns {string} The token every relay client must present.
 */
function ensureToken() {
  const configPath = getConfigPath();

  let config = {};
  try {
    config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } catch (error) {
    // No config yet, or an unreadable one. Starting from an empty object keeps
    // the relay bootable instead of failing on a corrupted file.
  }

  if (typeof config.token !== 'string' || config.token.length === 0) {
    config.token = crypto.randomBytes(32).toString('hex');
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), { mode: 0o600 });
  }

  // writeFileSync only applies `mode` when it creates the file, so tighten the
  // permissions of a pre-existing config as well.
  fs.chmodSync(configPath, 0o600);

  return config.token;
}

/**
 * Constant-time comparison of a presented token against the expected one.
 *
 * @param {unknown} presented - Header value received from a client.
 * @param {string} expected - Token loaded from the config file.
 * @returns {boolean} True when both are identical.
 */
function tokenMatches(presented, expected) {
  if (typeof presented !== 'string' || presented.length !== expected.length) {
    return false;
  }
  return crypto.timingSafeEqual(Buffer.from(presented), Buffer.from(expected));
}

module.exports = { TOKEN_HEADER, getConfigPath, readToken, ensureToken, tokenMatches };
