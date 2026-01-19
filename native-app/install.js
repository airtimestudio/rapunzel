#!/usr/bin/env node

/**
 * Rapunzel Native Helper - Installation Script
 *
 * This script:
 * 1. Installs the native messaging manifest for Firefox
 * 2. Creates a batch file wrapper for the native host
 * 3. Optionally sets up auto-start
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

const APP_NAME = 'com.rapunzel.helper';
const EXTENSION_ID = 'rapunzel@airtimestudio.com';
const CONFIG_DIR = path.join(os.homedir(), '.rapunzel');

/**
 * Get the directory where this script is located
 */
function getScriptDir() {
  return __dirname;
}

/**
 * Get native messaging manifest directory for Firefox
 */
function getNativeManifestDir() {
  const platform = os.platform();

  if (platform === 'win32') {
    return path.join(os.homedir(), 'AppData', 'Roaming', 'Mozilla', 'NativeMessagingHosts');
  } else if (platform === 'darwin') {
    return path.join(os.homedir(), 'Library', 'Application Support', 'Mozilla', 'NativeMessagingHosts');
  } else {
    return path.join(os.homedir(), '.mozilla', 'native-messaging-hosts');
  }
}

/**
 * Create batch wrapper for Windows
 */
function createBatchWrapper() {
  const scriptDir = getScriptDir();
  const nativeHostPath = path.join(scriptDir, 'native-host.js');
  const batchPath = path.join(CONFIG_DIR, 'native-host.bat');

  // Ensure config dir exists
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }

  // Create batch file that runs the native host
  const batchContent = `@echo off
node "${nativeHostPath}"
`;

  fs.writeFileSync(batchPath, batchContent);
  console.log(`Created batch wrapper: ${batchPath}`);

  return batchPath;
}

/**
 * Create the native messaging manifest
 */
function createManifest(executablePath) {
  return {
    name: APP_NAME,
    description: 'Rapunzel Native Helper - Manages temporary Firefox extensions',
    path: executablePath,
    type: 'stdio',
    allowed_extensions: [EXTENSION_ID]
  };
}

/**
 * Install the native messaging manifest
 */
function install() {
  console.log('');
  console.log('========================================');
  console.log('  Rapunzel Native Helper Installer');
  console.log('========================================');
  console.log('');

  const platform = os.platform();
  let executablePath;

  if (platform === 'win32') {
    // On Windows, create a batch wrapper
    executablePath = createBatchWrapper();
  } else {
    // On Unix, use the JS file directly with proper shebang
    executablePath = path.join(getScriptDir(), 'native-host.js');
    fs.chmodSync(executablePath, '755');
  }

  const manifestDir = getNativeManifestDir();
  const manifestPath = path.join(manifestDir, `${APP_NAME}.json`);

  console.log(`Platform: ${platform}`);
  console.log(`Native host: ${executablePath}`);
  console.log(`Manifest directory: ${manifestDir}`);
  console.log(`Manifest path: ${manifestPath}`);
  console.log('');

  // Create manifest directory
  if (!fs.existsSync(manifestDir)) {
    console.log('Creating manifest directory...');
    fs.mkdirSync(manifestDir, { recursive: true });
  }

  // Create and write manifest
  const manifest = createManifest(executablePath);
  console.log('Writing native messaging manifest...');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

  // On Windows, add registry entry
  if (platform === 'win32') {
    console.log('Adding Windows registry entry...');
    addWindowsRegistry(manifestPath);
  }

  // Create config directory
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }

  // Create default config if not exists
  const configPath = path.join(CONFIG_DIR, 'config.json');
  if (!fs.existsSync(configPath)) {
    fs.writeFileSync(configPath, JSON.stringify({
      extensionFolder: '',
      autoStart: false
    }, null, 2));
  }

  console.log('');
  console.log('========================================');
  console.log('  Installation Complete!');
  console.log('========================================');
  console.log('');
  console.log('The native messaging host is now registered with Firefox.');
  console.log('');
  console.log('Next steps:');
  console.log('1. Install the Rapunzel Firefox extension');
  console.log('2. Click the extension icon and configure your extensions folder');
  console.log('');
}

/**
 * Add Windows registry entry for native messaging
 */
function addWindowsRegistry(manifestPath) {
  const regKey = `HKCU\\Software\\Mozilla\\NativeMessagingHosts\\${APP_NAME}`;

  try {
    execSync(`reg add "${regKey}" /ve /t REG_SZ /d "${manifestPath}" /f`, {
      stdio: 'pipe'
    });
    console.log('  Registry entry added successfully');
  } catch (error) {
    console.error('  Warning: Could not add registry entry automatically.');
    console.error('  You may need to run as administrator or add manually:');
    console.error(`    Key: ${regKey}`);
    console.error(`    Value: ${manifestPath}`);
  }
}

/**
 * Uninstall
 */
function uninstall() {
  console.log('');
  console.log('Uninstalling Rapunzel Native Helper...');
  console.log('');

  const manifestDir = getNativeManifestDir();
  const manifestPath = path.join(manifestDir, `${APP_NAME}.json`);

  // Remove manifest file
  if (fs.existsSync(manifestPath)) {
    fs.unlinkSync(manifestPath);
    console.log('Removed manifest file');
  }

  // Remove batch wrapper
  const batchPath = path.join(CONFIG_DIR, 'native-host.bat');
  if (fs.existsSync(batchPath)) {
    fs.unlinkSync(batchPath);
    console.log('Removed batch wrapper');
  }

  // On Windows, remove registry entry
  if (os.platform() === 'win32') {
    const regKey = `HKCU\\Software\\Mozilla\\NativeMessagingHosts\\${APP_NAME}`;
    try {
      execSync(`reg delete "${regKey}" /f`, { stdio: 'pipe' });
      console.log('Removed registry entry');
    } catch (error) {
      // Key may not exist
    }
  }

  console.log('');
  console.log('Uninstallation complete!');
  console.log('Note: Configuration files in ~/.rapunzel were preserved.');
  console.log('');
}

/**
 * Show status
 */
function status() {
  console.log('');
  console.log('Rapunzel Native Helper Status');
  console.log('=============================');
  console.log('');

  const manifestDir = getNativeManifestDir();
  const manifestPath = path.join(manifestDir, `${APP_NAME}.json`);

  console.log(`Platform: ${os.platform()}`);
  console.log(`Config directory: ${CONFIG_DIR}`);
  console.log(`Manifest path: ${manifestPath}`);
  console.log('');

  // Check manifest
  if (fs.existsSync(manifestPath)) {
    console.log('[OK] Native messaging manifest is installed');

    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    console.log(`     Path: ${manifest.path}`);

    if (fs.existsSync(manifest.path)) {
      console.log('[OK] Native host executable exists');
    } else {
      console.log('[!!] Native host executable NOT found');
    }
  } else {
    console.log('[!!] Native messaging manifest NOT installed');
  }

  // Check config
  const configPath = path.join(CONFIG_DIR, 'config.json');
  if (fs.existsSync(configPath)) {
    console.log('[OK] Configuration file exists');
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    if (config.extensionFolder) {
      console.log(`     Extensions folder: ${config.extensionFolder}`);
      if (fs.existsSync(config.extensionFolder)) {
        console.log('[OK] Extensions folder exists');
      } else {
        console.log('[!!] Extensions folder NOT found');
      }
    } else {
      console.log('     Extensions folder: (not configured)');
    }
  } else {
    console.log('[--] No configuration file');
  }

  console.log('');
}

// Main
const args = process.argv.slice(2);
const command = args[0] || 'install';

switch (command) {
  case 'install':
    install();
    break;
  case 'uninstall':
    uninstall();
    break;
  case 'status':
    status();
    break;
  default:
    console.log('Rapunzel Native Helper Installer');
    console.log('');
    console.log('Usage: node install.js [command]');
    console.log('');
    console.log('Commands:');
    console.log('  install     Install native messaging manifest (default)');
    console.log('  uninstall   Remove native messaging manifest');
    console.log('  status      Show installation status');
}
