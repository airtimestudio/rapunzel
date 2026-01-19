/**
 * Rapunzel - Background Script
 * Handles communication with native helper app and extension management
 */

const NATIVE_APP_ID = "com.rapunzel.helper";

// State
let nativePort = null;
let isConnected = false;
let loadedExtensions = [];

/**
 * Connect to native messaging host
 */
function connectToNativeApp() {
  try {
    nativePort = browser.runtime.connectNative(NATIVE_APP_ID);

    nativePort.onMessage.addListener(handleNativeMessage);
    nativePort.onDisconnect.addListener(handleDisconnect);

    // Request status on connect
    nativePort.postMessage({ action: "status" });

    isConnected = true;
    console.log("[Rapunzel] Connected to native app");

  } catch (error) {
    console.error("[Rapunzel] Failed to connect to native app:", error);
    isConnected = false;
    showNotification("Connection Failed", "Could not connect to Rapunzel helper app. Please ensure it's installed.");
  }
}

/**
 * Handle messages from native app
 */
function handleNativeMessage(message) {
  console.log("[Rapunzel] Received from native:", message);

  switch (message.type) {
    case "status":
      handleStatusResponse(message);
      break;

    case "extensions_list":
      handleExtensionsList(message);
      break;

    case "load_result":
      handleLoadResult(message);
      break;

    case "unload_result":
      handleUnloadResult(message);
      break;

    case "error":
      handleError(message);
      break;

    default:
      console.warn("[Rapunzel] Unknown message type:", message.type);
  }
}

/**
 * Handle disconnect from native app
 */
function handleDisconnect(port) {
  isConnected = false;
  nativePort = null;

  if (port.error) {
    console.error("[Rapunzel] Native app disconnected with error:", port.error.message);
  } else {
    console.log("[Rapunzel] Native app disconnected");
  }
}

/**
 * Handle status response
 */
function handleStatusResponse(message) {
  browser.storage.local.set({
    nativeAppVersion: message.version,
    nativeAppStatus: "connected",
    lastStatusCheck: Date.now()
  });
}

/**
 * Handle extensions list from native app
 */
function handleExtensionsList(message) {
  loadedExtensions = message.extensions || [];

  browser.storage.local.set({
    availableExtensions: message.extensions,
    extensionFolder: message.folder,
    lastScan: Date.now()
  });

  // Notify popup if open
  browser.runtime.sendMessage({
    type: "extensions_updated",
    extensions: message.extensions
  }).catch(() => {
    // Popup not open, ignore
  });
}

/**
 * Handle load result
 */
function handleLoadResult(message) {
  if (message.success) {
    showNotification("Extension Loaded", `Successfully loaded: ${message.extensionName}`);

    // Update loaded list
    if (!loadedExtensions.find(e => e.path === message.path)) {
      loadedExtensions.push({
        name: message.extensionName,
        path: message.path,
        loadedAt: Date.now()
      });
    }

    browser.storage.local.set({ loadedExtensions });

  } else {
    showNotification("Load Failed", `Failed to load ${message.extensionName}: ${message.error}`);
  }

  // Notify popup
  browser.runtime.sendMessage({
    type: "load_result",
    ...message
  }).catch(() => {});
}

/**
 * Handle unload result
 */
function handleUnloadResult(message) {
  if (message.success) {
    showNotification("Extension Unloaded", `Successfully unloaded: ${message.extensionName}`);

    // Remove from loaded list
    loadedExtensions = loadedExtensions.filter(e => e.path !== message.path);
    browser.storage.local.set({ loadedExtensions });

  } else {
    showNotification("Unload Failed", `Failed to unload: ${message.error}`);
  }

  browser.runtime.sendMessage({
    type: "unload_result",
    ...message
  }).catch(() => {});
}

/**
 * Handle error from native app
 */
function handleError(message) {
  console.error("[Rapunzel] Native app error:", message.error);
  showNotification("Error", message.error);
}

/**
 * Show browser notification
 */
function showNotification(title, message) {
  browser.notifications.create({
    type: "basic",
    iconUrl: browser.runtime.getURL("icons/icon-96.png"),
    title: `Rapunzel: ${title}`,
    message: message
  });
}

/**
 * Send message to native app
 */
function sendToNative(message) {
  if (!isConnected || !nativePort) {
    connectToNativeApp();

    // Retry after short delay
    setTimeout(() => {
      if (isConnected && nativePort) {
        nativePort.postMessage(message);
      }
    }, 500);
    return;
  }

  nativePort.postMessage(message);
}

/**
 * API: Scan extensions folder
 */
function scanExtensionsFolder() {
  sendToNative({ action: "scan" });
}

/**
 * API: Load specific extension
 */
function loadExtension(extensionPath) {
  sendToNative({
    action: "load",
    path: extensionPath
  });
}

/**
 * API: Load all extensions in folder
 */
function loadAllExtensions() {
  sendToNative({ action: "load_all" });
}

/**
 * API: Unload specific extension
 */
function unloadExtension(extensionPath) {
  sendToNative({
    action: "unload",
    path: extensionPath
  });
}

/**
 * API: Unload all loaded extensions
 */
function unloadAllExtensions() {
  sendToNative({ action: "unload_all" });
}

/**
 * API: Set extensions folder path
 */
function setExtensionsFolder(folderPath) {
  sendToNative({
    action: "set_folder",
    path: folderPath
  });

  browser.storage.local.set({ extensionFolder: folderPath });
}

/**
 * Handle messages from popup/options
 */
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("[Rapunzel] Internal message:", message);

  switch (message.action) {
    case "get_status":
      sendResponse({
        isConnected,
        loadedExtensions,
        nativeAppId: NATIVE_APP_ID
      });
      break;

    case "connect":
      connectToNativeApp();
      sendResponse({ success: true });
      break;

    case "scan":
      scanExtensionsFolder();
      sendResponse({ success: true });
      break;

    case "load":
      loadExtension(message.path);
      sendResponse({ success: true });
      break;

    case "load_all":
      loadAllExtensions();
      sendResponse({ success: true });
      break;

    case "unload":
      unloadExtension(message.path);
      sendResponse({ success: true });
      break;

    case "unload_all":
      unloadAllExtensions();
      sendResponse({ success: true });
      break;

    case "set_folder":
      setExtensionsFolder(message.path);
      sendResponse({ success: true });
      break;

    default:
      sendResponse({ error: "Unknown action" });
  }

  return true; // Keep channel open for async response
});

/**
 * Initialize on startup
 */
browser.runtime.onStartup.addListener(() => {
  console.log("[Rapunzel] Browser startup - connecting to native app");

  // Load settings and auto-connect
  browser.storage.local.get(["autoLoadOnStartup", "extensionFolder"]).then(settings => {
    if (settings.extensionFolder) {
      connectToNativeApp();

      if (settings.autoLoadOnStartup) {
        // Wait for connection then load all
        setTimeout(() => {
          if (isConnected) {
            loadAllExtensions();
          }
        }, 1000);
      }
    }
  });
});

/**
 * Initialize on install
 */
browser.runtime.onInstalled.addListener((details) => {
  console.log("[Rapunzel] Installed/Updated:", details.reason);

  if (details.reason === "install") {
    // Open options page on first install
    browser.runtime.openOptionsPage();
  }
});

// Initial connection attempt
connectToNativeApp();
