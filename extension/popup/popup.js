/**
 * Rapunzel - Popup Script
 * "Let down your hair extensions!"
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
 * Set button loading state (avoids innerHTML)
 */
function setButtonLoading(btn, isLoading) {
  // Clear existing content
  while (btn.firstChild) {
    btn.removeChild(btn.firstChild);
  }

  if (isLoading) {
    const spinner = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    spinner.setAttribute('class', 'spinner');
    spinner.setAttribute('width', '16');
    spinner.setAttribute('height', '16');
    spinner.setAttribute('viewBox', '0 0 16 16');
    spinner.setAttribute('fill', 'currentColor');

    const path1 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path1.setAttribute('d', 'M8 0a8 8 0 1 0 8 8A8 8 0 0 0 8 0zm0 14a6 6 0 1 1 6-6 6 6 0 0 1-6 6z');
    path1.setAttribute('opacity', '0.3');

    const path2 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path2.setAttribute('d', 'M14 8a6 6 0 0 1-6 6v-2a4 4 0 0 0 4-4h2z');

    spinner.appendChild(path1);
    spinner.appendChild(path2);
    btn.appendChild(spinner);
    btn.appendChild(document.createTextNode(' Loading...'));
  } else {
    const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    icon.setAttribute('width', '16');
    icon.setAttribute('height', '16');
    icon.setAttribute('viewBox', '0 0 16 16');
    icon.setAttribute('fill', 'currentColor');

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', 'M8 4a.5.5 0 0 1 .5.5v3h3a.5.5 0 0 1 0 1h-3v3a.5.5 0 0 1-1 0v-3h-3a.5.5 0 0 1 0-1h3v-3A.5.5 0 0 1 8 4z');

    icon.appendChild(path);
    btn.appendChild(icon);
    btn.appendChild(document.createTextNode(' Let Down Your Hair!'));
  }
}

/**
 * Create an element with attributes and children
 */
function createElement(tag, attrs = {}, children = []) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (key === 'className') {
      el.className = value;
    } else if (key === 'textContent') {
      el.textContent = value;
    } else if (key.startsWith('data-')) {
      el.setAttribute(key, value);
    } else {
      el.setAttribute(key, value);
    }
  }
  for (const child of children) {
    if (typeof child === 'string') {
      el.appendChild(document.createTextNode(child));
    } else if (child) {
      el.appendChild(child);
    }
  }
  return el;
}

/**
 * Create SVG element
 */
function createSvg(viewBox, paths) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', viewBox);
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2');
  for (const d of paths) {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', d);
    svg.appendChild(path);
  }
  return svg;
}

/**
 * Render extensions list
 */
function renderExtensions() {
  extCount.textContent = `(${extensions.length})`;

  // Clear existing content
  while (extensionsList.firstChild) {
    extensionsList.removeChild(extensionsList.firstChild);
  }

  if (extensions.length === 0) {
    const emptyState = createElement('div', { className: 'empty-state' }, [
      createSvg('0 0 24 24', ['M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z']),
      createElement('p', { textContent: 'No extensions found in folder' }),
      createElement('button', { className: 'btn btn-small', textContent: 'Configure Folder' })
    ]);
    emptyState.querySelector('button').addEventListener('click', () => browser.runtime.openOptionsPage());
    extensionsList.appendChild(emptyState);
    return;
  }

  for (const ext of extensions) {
    const isLoaded = loadedExtensions.some(le => le.path === ext.path);

    const actionBtn = createElement('button', {
      className: isLoaded ? 'unload-btn' : 'load-btn',
      'data-action': isLoaded ? 'unload' : 'load',
      'data-path': ext.path,
      textContent: isLoaded ? 'Unload' : 'Load'
    });
    actionBtn.addEventListener('click', handleExtensionAction);

    const item = createElement('div', {
      className: `extension-item ${isLoaded ? 'loaded' : ''}`,
      'data-path': ext.path
    }, [
      createElement('div', { className: 'ext-icon', textContent: getExtensionIcon(ext) }),
      createElement('div', { className: 'ext-info' }, [
        createElement('div', { className: 'ext-name', textContent: ext.name }),
        createElement('div', { className: 'ext-path', title: ext.path, textContent: ext.folder })
      ]),
      createElement('span', {
        className: `ext-status ${isLoaded ? 'loaded' : 'available'}`,
        textContent: isLoaded ? 'Loaded' : 'Available'
      }),
      createElement('div', { className: 'ext-actions' }, [actionBtn])
    ]);

    extensionsList.appendChild(item);
  }
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
    setButtonLoading(loadAllBtn, true);
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
        setButtonLoading(loadAllBtn, false);
        break;
    }
  });
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', init);
