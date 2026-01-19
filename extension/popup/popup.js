/**
 * PermExtension - Popup Script
 */

// DOM Elements
const statusDot = document.querySelector('.status-dot');
const statusText = document.querySelector('.status-text');
const errorBanner = document.getElementById('errorBanner');
const folderPathEl = document.getElementById('folderPath');
const extensionsList = document.getElementById('extensionsList');
const extCount = document.getElementById('extCount');

// Buttons
const loadAllBtn = document.getElementById('loadAll');
const unloadAllBtn = document.getElementById('unloadAll');
const scanFolderBtn = document.getElementById('scanFolder');
const retryConnectBtn = document.getElementById('retryConnect');
const openSetupLink = document.getElementById('openSetup');
const openOptionsBtn = document.getElementById('openOptions');
const openAboutDebuggingLink = document.getElementById('openAboutDebugging');
const openOptionsPageLink = document.getElementById('openOptionsPage');

// State
let isConnected = false;
let extensions = [];
let loadedExtensions = [];

/**
 * Initialize popup
 */
async function init() {
  // Load saved data
  const data = await browser.storage.local.get([
    'extensionFolder',
    'availableExtensions',
    'loadedExtensions',
    'nativeAppStatus'
  ]);

  // Update folder display
  if (data.extensionFolder) {
    folderPathEl.textContent = data.extensionFolder;
    folderPathEl.classList.remove('not-set');
  } else {
    folderPathEl.textContent = 'Not configured';
    folderPathEl.classList.add('not-set');
  }

  // Update extensions list
  if (data.availableExtensions) {
    extensions = data.availableExtensions;
    loadedExtensions = data.loadedExtensions || [];
    renderExtensions();
  }

  // Check connection status
  checkStatus();

  // Setup event listeners
  setupEventListeners();
}

/**
 * Check connection status with background script
 */
async function checkStatus() {
  try {
    const response = await browser.runtime.sendMessage({ action: 'get_status' });

    isConnected = response.isConnected;
    loadedExtensions = response.loadedExtensions || [];

    updateStatusUI();

    if (isConnected) {
      // Request fresh scan
      browser.runtime.sendMessage({ action: 'scan' });
    }
  } catch (error) {
    console.error('Failed to get status:', error);
    isConnected = false;
    updateStatusUI();
  }
}

/**
 * Update status UI elements
 */
function updateStatusUI() {
  if (isConnected) {
    statusDot.className = 'status-dot connected';
    statusText.textContent = 'Connected';
    errorBanner.style.display = 'none';

    loadAllBtn.disabled = false;
    unloadAllBtn.disabled = false;
    scanFolderBtn.disabled = false;
  } else {
    statusDot.className = 'status-dot disconnected';
    statusText.textContent = 'Disconnected';
    errorBanner.style.display = 'flex';

    loadAllBtn.disabled = true;
    unloadAllBtn.disabled = true;
    scanFolderBtn.disabled = true;
  }
}

/**
 * Render extensions list
 */
function renderExtensions() {
  extCount.textContent = `(${extensions.length})`;

  if (extensions.length === 0) {
    extensionsList.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/>
        </svg>
        <p>No extensions found in folder</p>
        <button class="btn btn-small" onclick="browser.runtime.openOptionsPage()">
          Configure Folder
        </button>
      </div>
    `;
    return;
  }

  extensionsList.innerHTML = extensions.map(ext => {
    const isLoaded = loadedExtensions.some(le => le.path === ext.path);

    return `
      <div class="extension-item ${isLoaded ? 'loaded' : ''}" data-path="${escapeHtml(ext.path)}">
        <div class="ext-icon">${getExtensionIcon(ext)}</div>
        <div class="ext-info">
          <div class="ext-name">${escapeHtml(ext.name)}</div>
          <div class="ext-path" title="${escapeHtml(ext.path)}">${escapeHtml(ext.folder)}</div>
        </div>
        <span class="ext-status ${isLoaded ? 'loaded' : 'available'}">
          ${isLoaded ? 'Loaded' : 'Available'}
        </span>
        <div class="ext-actions">
          ${isLoaded
            ? `<button class="unload-btn" data-action="unload" data-path="${escapeHtml(ext.path)}">Unload</button>`
            : `<button class="load-btn" data-action="load" data-path="${escapeHtml(ext.path)}">Load</button>`
          }
        </div>
      </div>
    `;
  }).join('');

  // Add click handlers for extension buttons
  extensionsList.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', handleExtensionAction);
  });
}

/**
 * Get icon for extension
 */
function getExtensionIcon(ext) {
  // Default puzzle piece icon
  return '🧩';
}

/**
 * Handle extension load/unload action
 */
function handleExtensionAction(event) {
  const action = event.target.dataset.action;
  const path = event.target.dataset.path;

  browser.runtime.sendMessage({ action, path });

  // Show loading state
  event.target.disabled = true;
  event.target.textContent = action === 'load' ? 'Loading...' : 'Unloading...';
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
  // Load all button
  loadAllBtn.addEventListener('click', () => {
    browser.runtime.sendMessage({ action: 'load_all' });
    loadAllBtn.disabled = true;
    loadAllBtn.innerHTML = `
      <svg class="spinner" width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
        <path d="M8 0a8 8 0 1 0 8 8A8 8 0 0 0 8 0zm0 14a6 6 0 1 1 6-6 6 6 0 0 1-6 6z" opacity="0.3"/>
        <path d="M14 8a6 6 0 0 1-6 6v-2a4 4 0 0 0 4-4h2z"/>
      </svg>
      Loading...
    `;
  });

  // Unload all button
  unloadAllBtn.addEventListener('click', () => {
    browser.runtime.sendMessage({ action: 'unload_all' });
  });

  // Scan folder button
  scanFolderBtn.addEventListener('click', () => {
    statusDot.className = 'status-dot loading';
    statusText.textContent = 'Scanning...';
    browser.runtime.sendMessage({ action: 'scan' });
  });

  // Retry connect button
  retryConnectBtn.addEventListener('click', () => {
    statusDot.className = 'status-dot loading';
    statusText.textContent = 'Connecting...';
    browser.runtime.sendMessage({ action: 'connect' });

    setTimeout(checkStatus, 1000);
  });

  // Open setup link
  openSetupLink.addEventListener('click', (e) => {
    e.preventDefault();
    browser.tabs.create({ url: browser.runtime.getURL('options/options.html#setup') });
  });

  // Open options button
  openOptionsBtn.addEventListener('click', () => {
    browser.runtime.openOptionsPage();
  });

  // Open about:debugging
  openAboutDebuggingLink.addEventListener('click', (e) => {
    e.preventDefault();
    browser.tabs.create({ url: 'about:debugging#/runtime/this-firefox' });
  });

  // Open options page link
  openOptionsPageLink.addEventListener('click', (e) => {
    e.preventDefault();
    browser.runtime.openOptionsPage();
  });

  // Listen for updates from background
  browser.runtime.onMessage.addListener((message) => {
    switch (message.type) {
      case 'extensions_updated':
        extensions = message.extensions || [];
        renderExtensions();
        statusDot.className = 'status-dot connected';
        statusText.textContent = 'Connected';
        break;

      case 'load_result':
      case 'unload_result':
        checkStatus();
        loadAllBtn.disabled = false;
        loadAllBtn.innerHTML = `
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 4a.5.5 0 0 1 .5.5v3h3a.5.5 0 0 1 0 1h-3v3a.5.5 0 0 1-1 0v-3h-3a.5.5 0 0 1 0-1h3v-3A.5.5 0 0 1 8 4z"/>
          </svg>
          Load All Extensions
        `;
        break;
    }
  });
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', init);
