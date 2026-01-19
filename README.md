# Rapunzel

**Let down your hair extensions!** Automatically load and manage temporary Firefox extensions from a specified folder.

## The Problem

Firefox requires developers to manually load temporary extensions through `about:debugging` every single time the browser restarts. This is tedious when working with multiple in-development extensions.

## Why Can't a Simple Extension Solve This?

Due to Firefox security restrictions, WebExtensions **cannot**:
- Programmatically install or load other extensions
- Access Firefox's internal APIs used by `about:debugging`
- Bypass the requirement for explicit user action

This is by design to protect users from malicious extensions.

## The Solution

Rapunzel uses a **hybrid approach**:

| Component | Purpose |
|-----------|---------|
| **Firefox Extension** | User interface for managing extensions |
| **Native Helper** | Handles actual extension loading via `web-ext` |

## How It Works

```
┌─────────────────────┐                    ┌──────────────────────┐
│  Firefox Extension  │◄── Native Msg ───►│  Native Host (Node)  │
│    (Dashboard UI)   │                    │  (Auto-spawned)      │
└─────────────────────┘                    └──────────────────────┘
         │                                          │
         │ User clicks                              │ Runs web-ext
         │ "Let Down Your Hair!"                    │ for each extension
         ▼                                          ▼
    Shows status                           Extensions loaded!
```

**Key Point:** The native helper runs **automatically** when needed - Firefox spawns it whenever the extension sends a message. You don't need to manually start anything!

---

## Installation (Windows)

### Prerequisites
- [Node.js](https://nodejs.org/) (v18 or later)
- [web-ext](https://github.com/mozilla/web-ext) CLI tool (recommended)

```bash
npm install -g web-ext
```

### Step 1: Run the Installer

Double-click `install-windows.bat` or run:

```bash
cd rapunzel/native-app
node install.js
```

This registers the native messaging host with Firefox.

### Step 2: Load the Extension

1. Open Firefox
2. Go to `about:debugging#/runtime/this-firefox`
3. Click **"Load Temporary Add-on"**
4. Navigate to `rapunzel/extension/` and select `manifest.json`

### Step 3: Configure

1. Click the **Rapunzel icon** in the Firefox toolbar
2. Click the **settings gear** to open options
3. Enter the path to your extensions folder (e.g., `C:\Users\YourName\MyExtensions`)
4. Click **Save**

---

## Usage

### Load Extensions

1. Click the Rapunzel toolbar icon
2. Click **"Let Down Your Hair!"** to load all extensions at once
3. Or click **"Load"** on individual extensions

### Your Extensions Folder Structure

```
C:\Users\YourName\MyExtensions\
├── my-extension-1\
│   ├── manifest.json
│   ├── background.js
│   └── ...
├── my-extension-2\
│   ├── manifest.json
│   └── ...
└── another-extension\
    └── manifest.json
```

Each subfolder must contain a valid `manifest.json` file.

---

## Troubleshooting

### "Could not connect to native helper app"

1. **Check installation:** Run `node native-app/install.js status`
2. **Restart Firefox** after installing
3. **Verify Node.js is in PATH:** Open cmd and run `node --version`

### Extensions not loading

1. Ensure `web-ext` is installed globally: `npm install -g web-ext`
2. Verify each extension has a valid `manifest.json`
3. Try loading manually via `about:debugging` to see error messages

### Check Installation Status

```bash
cd rapunzel/native-app
node install.js status
```

---

## Project Structure

```
rapunzel/
├── extension/                 # Firefox Extension
│   ├── manifest.json
│   ├── background/
│   ├── popup/
│   ├── options/
│   └── icons/
├── native-app/               # Native Helper (Node.js)
│   ├── native-host.js        # Main native messaging handler
│   ├── install.js            # Installation script
│   └── package.json
├── install-windows.bat       # Windows installer
├── install-unix.sh           # macOS/Linux installer
└── README.md
```

---

## Commands Reference

### Installation

```bash
# Install native messaging host
node install.js install

# Check status
node install.js status

# Uninstall
node install.js uninstall
```

---

## How Extension Loading Works

When you click "Let Down Your Hair!" in Rapunzel:

1. Extension sends message to native host
2. Firefox spawns `native-host.js` automatically
3. Native host runs `web-ext run --source-dir <path>`
4. `web-ext` loads your extension into Firefox
5. Extension stays loaded until browser closes

**Note:** Extensions loaded this way are still "temporary" - they will be removed when Firefox closes. But Rapunzel makes reloading them trivial!

---

## Security

- Native host only accesses the extensions folder you configure
- All actions require explicit user clicks
- No data sent to external servers
- Uses Firefox's official native messaging protocol

---

## License

MIT License

---

## Author

[Airtime Studio](https://github.com/airtimestudio)
