#!/usr/bin/env node

/**
 * Rapunzel Native Helper Application
 *
 * This application handles native messaging from the Rapunzel Firefox addon
 * and manages temporary extension loading via Firefox's remote debugging protocol.
 */

const fs = require('fs');
const path = require('path');
const { spawn, exec } = require('child_process');
const os = require('os');
const http = require('http');

// Configuration
const CONFIG_FILE = path.join(os.homedir(), '.rapunzel', 'config.json');
const VERSION = '1.0.0';

// Firefox remote debugging settings
const REMOTE_DEBUG_PORT = 9222;

// State
let config = {
  extensionFolder: '',
  firefoxPath: '',
  watchEnabled: false
};
let loadedExtensions = new Map();
let firefoxProcess = null;

/**
 * Read native messaging input (length-prefixed JSON)
 */
function readMessage() {
  return new Promise((resolve, reject) => {
    let lengthBuffer = Buffer.alloc(4);
    let bytesRead = 0;

    process.stdin.on('readable', function onReadable() {
      // Read 4-byte length prefix
      if (bytesRead < 4) {
        const chunk = process.stdin.read(4 - bytesRead);
        if (chunk) {
          chunk.copy(lengthBuffer, bytesRead);
          bytesRead += chunk.length;
        }
      }

      if (bytesRead === 4) {
        const messageLength = lengthBuffer.readUInt32LE(0);

        if (messageLength > 0 && messageLength < 1024 * 1024) { // Max 1MB
          const messageBuffer = process.stdin.read(messageLength);

          if (messageBuffer && messageBuffer.length === messageLength) {
            try {
              const message = JSON.parse(messageBuffer.toString('utf8'));
              process.stdin.removeListener('readable', onReadable);
              resolve(message);
            } catch (e) {
              reject(new Error('Invalid JSON: ' + e.message));
            }
          }
        }
      }
    });

    process.stdin.on('end', () => {
      resolve(null);
    });
  });
}

/**
 * Send native messaging output (length-prefixed JSON)
 */
function sendMessage(message) {
  const messageStr = JSON.stringify(message);
  const messageBuffer = Buffer.from(messageStr, 'utf8');
  const lengthBuffer = Buffer.alloc(4);
  lengthBuffer.writeUInt32LE(messageBuffer.length, 0);

  process.stdout.write(lengthBuffer);
  process.stdout.write(messageBuffer);
}

/**
 * Load configuration
 */
function loadConfig() {
  try {
    const configDir = path.dirname(CONFIG_FILE);
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }

    if (fs.existsSync(CONFIG_FILE)) {
      const data = fs.readFileSync(CONFIG_FILE, 'utf8');
      config = { ...config, ...JSON.parse(data) };
    }
  } catch (error) {
    logError('Failed to load config:', error);
  }
}

/**
 * Save configuration
 */
function saveConfig() {
  try {
    const configDir = path.dirname(CONFIG_FILE);
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
  } catch (error) {
    logError('Failed to save config:', error);
  }
}

/**
 * Log error to stderr (doesn't interfere with native messaging)
 */
function logError(...args) {
  console.error('[Rapunzel Helper]', ...args);
}

/**
 * Get Firefox executable path
 */
function getFirefoxPath() {
  if (config.firefoxPath && fs.existsSync(config.firefoxPath)) {
    return config.firefoxPath;
  }

  const platform = os.platform();
  const possiblePaths = [];

  if (platform === 'win32') {
    possiblePaths.push(
      'C:\\Program Files\\Mozilla Firefox\\firefox.exe',
      'C:\\Program Files (x86)\\Mozilla Firefox\\firefox.exe',
      path.join(os.homedir(), 'AppData', 'Local', 'Mozilla Firefox', 'firefox.exe')
    );
  } else if (platform === 'darwin') {
    possiblePaths.push(
      '/Applications/Firefox.app/Contents/MacOS/firefox',
      '/Applications/Firefox Developer Edition.app/Contents/MacOS/firefox',
      '/Applications/Firefox Nightly.app/Contents/MacOS/firefox'
    );
  } else {
    possiblePaths.push(
      '/usr/bin/firefox',
      '/usr/local/bin/firefox',
      '/snap/bin/firefox',
      '/usr/bin/firefox-developer-edition'
    );
  }

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      return p;
    }
  }

  return null;
}

/**
 * Scan extensions folder for valid extensions
 */
function scanExtensionsFolder() {
  const folder = config.extensionFolder;

  if (!folder || !fs.existsSync(folder)) {
    return [];
  }

  const extensions = [];

  try {
    const items = fs.readdirSync(folder, { withFileTypes: true });

    for (const item of items) {
      if (item.isDirectory()) {
        const extPath = path.join(folder, item.name);
        const manifestPath = path.join(extPath, 'manifest.json');

        if (fs.existsSync(manifestPath)) {
          try {
            const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
            extensions.push({
              name: manifest.name || item.name,
              version: manifest.version || '0.0.0',
              description: manifest.description || '',
              path: extPath,
              folder: item.name,
              manifestVersion: manifest.manifest_version || 2
            });
          } catch (e) {
            // Invalid manifest, skip
            logError(`Invalid manifest in ${extPath}:`, e.message);
          }
        }
      }
    }
  } catch (error) {
    logError('Failed to scan folder:', error);
  }

  return extensions;
}

/**
 * Load extension via Firefox Remote Debugging Protocol
 * This requires Firefox to be started with --remote-debugging-port
 */
async function loadExtensionViaRDP(extensionPath) {
  return new Promise((resolve, reject) => {
    // Use web-ext or Firefox RDP to load the extension
    // This is a simplified version - in production, would use proper RDP client

    const webExtPath = findWebExt();

    if (webExtPath) {
      // Use web-ext if available
      const proc = spawn(webExtPath, [
        'run',
        '--source-dir', extensionPath,
        '--no-reload',
        '--keep-profile-changes'
      ], {
        stdio: 'pipe',
        detached: true
      });

      proc.unref();
      loadedExtensions.set(extensionPath, { process: proc, method: 'web-ext' });

      resolve({ success: true, method: 'web-ext' });
    } else {
      // Fallback: Use Firefox command line with temporary profile
      const firefoxPath = getFirefoxPath();

      if (!firefoxPath) {
        reject(new Error('Firefox not found'));
        return;
      }

      // Create a temporary profile and load the extension
      const tempProfile = path.join(os.tmpdir(), `rapunzel-profile-${Date.now()}`);
      fs.mkdirSync(tempProfile, { recursive: true });

      // Write user.js to enable extension loading
      const userPrefs = `
user_pref("extensions.autoDisableScopes", 0);
user_pref("extensions.enabledScopes", 15);
user_pref("xpinstall.signatures.required", false);
user_pref("devtools.chrome.enabled", true);
user_pref("devtools.debugger.remote-enabled", true);
`;
      fs.writeFileSync(path.join(tempProfile, 'user.js'), userPrefs);

      // Copy extension to extensions folder in profile
      const extDest = path.join(tempProfile, 'extensions', 'temp-extension');
      copyDirSync(extensionPath, extDest);

      resolve({
        success: true,
        method: 'profile',
        profilePath: tempProfile,
        note: 'Extension prepared in temporary profile'
      });
    }
  });
}

/**
 * Find web-ext CLI tool
 */
function findWebExt() {
  const platform = os.platform();
  const cmd = platform === 'win32' ? 'where' : 'which';

  try {
    const result = require('child_process').execSync(`${cmd} web-ext`, {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe']
    });
    return result.trim().split('\n')[0];
  } catch (e) {
    // Try npm global path
    const npmGlobal = platform === 'win32'
      ? path.join(process.env.APPDATA || '', 'npm', 'web-ext.cmd')
      : '/usr/local/bin/web-ext';

    if (fs.existsSync(npmGlobal)) {
      return npmGlobal;
    }

    return null;
  }
}

/**
 * Copy directory recursively
 */
function copyDirSync(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDirSync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

/**
 * Unload extension
 */
async function unloadExtension(extensionPath) {
  const loaded = loadedExtensions.get(extensionPath);

  if (loaded) {
    if (loaded.process) {
      try {
        loaded.process.kill();
      } catch (e) {
        // Process may already be dead
      }
    }
    loadedExtensions.delete(extensionPath);
    return { success: true };
  }

  return { success: false, error: 'Extension not found in loaded list' };
}

/**
 * Handle incoming message
 */
async function handleMessage(message) {
  const action = message.action;

  switch (action) {
    case 'status':
      sendMessage({
        type: 'status',
        version: VERSION,
        firefoxPath: getFirefoxPath(),
        extensionFolder: config.extensionFolder,
        loadedCount: loadedExtensions.size
      });
      break;

    case 'scan':
      const extensions = scanExtensionsFolder();
      sendMessage({
        type: 'extensions_list',
        extensions: extensions,
        folder: config.extensionFolder
      });
      break;

    case 'set_folder':
      config.extensionFolder = message.path;
      saveConfig();
      sendMessage({
        type: 'folder_set',
        success: true,
        path: message.path
      });
      // Auto-scan after setting folder
      const newExtensions = scanExtensionsFolder();
      sendMessage({
        type: 'extensions_list',
        extensions: newExtensions,
        folder: config.extensionFolder
      });
      break;

    case 'load':
      try {
        const result = await loadExtensionViaRDP(message.path);
        const manifest = JSON.parse(
          fs.readFileSync(path.join(message.path, 'manifest.json'), 'utf8')
        );
        sendMessage({
          type: 'load_result',
          success: true,
          extensionName: manifest.name || path.basename(message.path),
          path: message.path,
          ...result
        });
      } catch (error) {
        sendMessage({
          type: 'load_result',
          success: false,
          error: error.message,
          path: message.path
        });
      }
      break;

    case 'load_all':
      const allExtensions = scanExtensionsFolder();
      const results = [];

      for (const ext of allExtensions) {
        try {
          await loadExtensionViaRDP(ext.path);
          results.push({ name: ext.name, success: true });
        } catch (error) {
          results.push({ name: ext.name, success: false, error: error.message });
        }
      }

      sendMessage({
        type: 'load_all_result',
        results: results,
        totalLoaded: results.filter(r => r.success).length,
        totalFailed: results.filter(r => !r.success).length
      });
      break;

    case 'unload':
      const unloadResult = await unloadExtension(message.path);
      sendMessage({
        type: 'unload_result',
        ...unloadResult,
        path: message.path
      });
      break;

    case 'unload_all':
      const unloadResults = [];
      for (const [extPath] of loadedExtensions) {
        const result = await unloadExtension(extPath);
        unloadResults.push({ path: extPath, ...result });
      }
      sendMessage({
        type: 'unload_all_result',
        results: unloadResults
      });
      break;

    default:
      sendMessage({
        type: 'error',
        error: `Unknown action: ${action}`
      });
  }
}

/**
 * Main message loop
 */
async function main() {
  loadConfig();

  // Handle messages in a loop
  while (true) {
    try {
      const message = await readMessage();

      if (message === null) {
        // End of input
        break;
      }

      await handleMessage(message);
    } catch (error) {
      logError('Error processing message:', error);
      sendMessage({
        type: 'error',
        error: error.message
      });
    }
  }
}

// Start the application
main().catch(error => {
  logError('Fatal error:', error);
  process.exit(1);
});
