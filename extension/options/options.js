/**
 * PermExtension - Options Page Script
 */

// DOM Elements
const folderPathInput = document.getElementById('folderPath');
const saveFolderBtn = document.getElementById('saveFolder');
const testConnectionBtn = document.getElementById('testConnection');
const testResult = document.getElementById('testResult');

const nativeAppStatusEl = document.getElementById('nativeAppStatus');
const folderStatusEl = document.getElementById('folderStatus');

const autoLoadCheckbox = document.getElementById('autoLoadOnStartup');
const notificationsCheckbox = document.getElementById('showNotifications');
const watchFolderCheckbox = document.getElementById('watchFolder');

const openAboutDebuggingBtn = document.getElementById('openAboutDebugging');

/**
 * Initialize options page
 */
async function init() {
  // Load saved settings
  const settings = await browser.storage.local.get([
    'extensionFolder',
    'autoLoadOnStartup',
    'showNotifications',
    'watchFolder',
    'nativeAppStatus',
    'nativeAppVersion'
  ]);

  // Populate folder path
  if (settings.extensionFolder) {
    folderPathInput.value = settings.extensionFolder;
    updateFolderStatus(true, settings.extensionFolder);
  }

  // Populate checkboxes
  autoLoadCheckbox.checked = settings.autoLoadOnStartup || false;
  notificationsCheckbox.checked = settings.showNotifications !== false; // default true
  watchFolderCheckbox.checked = settings.watchFolder || false;

  // Check native app status
  if (settings.nativeAppStatus === 'connected') {
    updateNativeAppStatus(true, settings.nativeAppVersion);
  } else {
    updateNativeAppStatus(false);
  }

  // Setup event listeners
  setupEventListeners();

  // Initial connection test
  testNativeConnection();
}

/**
 * Update native app status display
 */
function updateNativeAppStatus(connected, version = null) {
  const icon = nativeAppStatusEl.querySelector('.status-icon');
  const value = nativeAppStatusEl.querySelector('.status-value');

  if (connected) {
    icon.textContent = '●';
    icon.className = 'status-icon success';
    value.textContent = version ? `Connected (v${version})` : 'Connected';
  } else {
    icon.textContent = '○';
    icon.className = 'status-icon pending';
    value.textContent = 'Not installed';
  }
}

/**
 * Update folder status display
 */
function updateFolderStatus(configured, path = null) {
  const icon = folderStatusEl.querySelector('.status-icon');
  const value = folderStatusEl.querySelector('.status-value');

  if (configured) {
    icon.textContent = '●';
    icon.className = 'status-icon success';
    value.textContent = path ? truncatePath(path, 40) : 'Configured';
  } else {
    icon.textContent = '○';
    icon.className = 'status-icon pending';
    value.textContent = 'Not configured';
  }
}

/**
 * Truncate long paths for display
 */
function truncatePath(path, maxLength) {
  if (path.length <= maxLength) return path;

  const parts = path.split(/[/\\]/);
  if (parts.length <= 2) {
    return '...' + path.slice(-maxLength + 3);
  }

  return parts[0] + '/.../' + parts.slice(-2).join('/');
}

/**
 * Test native app connection
 */
async function testNativeConnection() {
  try {
    const response = await browser.runtime.sendMessage({ action: 'get_status' });

    if (response.isConnected) {
      updateNativeAppStatus(true);
      return true;
    } else {
      updateNativeAppStatus(false);
      return false;
    }
  } catch (error) {
    console.error('Failed to test connection:', error);
    updateNativeAppStatus(false);
    return false;
  }
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
  // Save folder path
  saveFolderBtn.addEventListener('click', async () => {
    const folderPath = folderPathInput.value.trim();

    if (!folderPath) {
      showTestResult(false, 'Please enter a folder path');
      return;
    }

    // Save to storage
    await browser.storage.local.set({ extensionFolder: folderPath });

    // Notify background script
    browser.runtime.sendMessage({
      action: 'set_folder',
      path: folderPath
    });

    updateFolderStatus(true, folderPath);
    showTestResult(true, 'Folder path saved successfully');
  });

  // Test connection button
  testConnectionBtn.addEventListener('click', async () => {
    testConnectionBtn.disabled = true;
    testConnectionBtn.textContent = 'Testing...';

    // Try to connect
    await browser.runtime.sendMessage({ action: 'connect' });

    // Wait a moment for connection
    await new Promise(resolve => setTimeout(resolve, 1500));

    const connected = await testNativeConnection();

    testConnectionBtn.disabled = false;
    testConnectionBtn.textContent = 'Test Native App Connection';

    if (connected) {
      showTestResult(true, 'Successfully connected to native helper app!');
    } else {
      showTestResult(false, 'Could not connect to native helper app. Please ensure it is installed correctly.');
    }
  });

  // Settings checkboxes
  autoLoadCheckbox.addEventListener('change', () => {
    browser.storage.local.set({ autoLoadOnStartup: autoLoadCheckbox.checked });
  });

  notificationsCheckbox.addEventListener('change', () => {
    browser.storage.local.set({ showNotifications: notificationsCheckbox.checked });
  });

  watchFolderCheckbox.addEventListener('change', () => {
    browser.storage.local.set({ watchFolder: watchFolderCheckbox.checked });

    // Notify background to start/stop watching
    browser.runtime.sendMessage({
      action: 'watch_folder',
      enabled: watchFolderCheckbox.checked
    });
  });

  // Open about:debugging
  openAboutDebuggingBtn.addEventListener('click', () => {
    browser.tabs.create({ url: 'about:debugging#/runtime/this-firefox' });
  });

  // Listen for storage changes
  browser.storage.onChanged.addListener((changes, area) => {
    if (area === 'local') {
      if (changes.nativeAppStatus) {
        updateNativeAppStatus(changes.nativeAppStatus.newValue === 'connected');
      }
    }
  });

  // Handle hash navigation for setup section
  if (window.location.hash === '#setup') {
    document.getElementById('setup').scrollIntoView({ behavior: 'smooth' });
  }
}

/**
 * Show test result message
 */
function showTestResult(success, message) {
  testResult.style.display = 'block';
  testResult.className = 'test-result ' + (success ? 'success' : 'error');
  testResult.textContent = message;

  // Hide after 5 seconds
  setTimeout(() => {
    testResult.style.display = 'none';
  }, 5000);
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', init);
