# Arista Demo Dashboard

A single-pane-of-glass dashboard for presenting Arista AVD automation demos. Consolidates GitHub Actions CI status, CloudVision change controls, and SSH terminal sessions into one browser tab, organized by pipeline stage.

```
┌─────────────────────────────────────────────────────────────────────┐
│  [Arista]  |  [AVD]  [CI Pipeline]                  [Light Mode]   │
├─────────────────────────────────────────────────────────────────────┤
│  DEV / TEST                                                         │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌────────────┐ │
│  │   GitHub     │ │  CloudVision │ │    Spine     │ │    Leaf    │ │
│  │   Actions    │ │  Change Ctrl │ │    (SSH)     │ │    (SSH)   │ │
│  └──────────────┘ └──────────────┘ └──────────────┘ └────────────┘ │
├─────────────────────────────────────────────────────────────────────┤
│  PRODUCTION                                                         │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌────────────┐ │
│  │   GitHub     │ │  CloudVision │ │    Spine     │ │    Leaf    │ │
│  │   Actions    │ │  Change Ctrl │ │    (SSH)     │ │    (SSH)   │ │
│  └──────────────┘ └──────────────┘ └──────────────┘ └────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

## Features

- **Native API panels** — GitHub Actions workflow runs and CloudVision change controls rendered directly in the dashboard (no iframes)
- **Live or demo data** — Displays realistic mock data when no API tokens are configured; switches to live data automatically when tokens are set
- **Two environments** — DEV/TEST and PRODUCTION rows, each with 4 panes matching the pipeline stages
- **Dynamic device inventory** — SSH terminal panes pull the device list from CloudVision's inventory API; select any device from a dropdown
- **Embedded SSH terminals** — Full interactive terminals via xterm.js with shared per-environment SSH credentials
- **Light / dark mode** — Toggle between themes with the button in the header; preference persists across sessions
- **Open in browser links** — Each API panel has a footer link to open the full GitHub Actions or CloudVision UI in a new window
- **Simple configuration** — One YAML file for URLs and devices; API tokens via environment variables
- **Auto-refresh** — API panels refresh every 30 seconds

## Prerequisites

- [Docker](https://www.docker.com/products/docker-desktop/) and [VS Code](https://code.visualstudio.com/) with the [Dev Containers extension](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers) (recommended)
- **Or** [Node.js](https://nodejs.org/) v18 or later (if running without a container)
- Network access to the target devices (SSH) and web UIs (GitHub, CloudVision)

## Quick Start (Dev Container)

The easiest way to run the dashboard — no local Node.js installation required.

1. **Clone the repo and open in VS Code:**

   ```bash
   git clone <repo-url>
   cd demo_dashboard
   code .
   ```

2. **Reopen in container** — when VS Code prompts "Reopen in Container", click it. Or use the command palette: `Dev Containers: Reopen in Container`.

3. **Dependencies install automatically** via `postCreateCommand`.

4. **Configure and run:**

   ```bash
   # Edit config.yaml with your environment details
   # Optionally set up API tokens (see API Tokens section below)
   npm start
   ```

5. VS Code automatically forwards port 3000 and opens the dashboard in your browser.

## Quick Start (Local)

1. **Clone and install:**

   ```bash
   git clone <repo-url>
   cd demo_dashboard
   npm install
   ```

2. **Configure your environment:**

   Edit `config.yaml` with your actual URLs and SSH credentials:

   ```yaml
   environments:
     dev:
       label: "DEV / TEST"
       github_actions_url: "https://github.com/your-org/your-repo/actions"
       cloudvision_url: "https://your-cv-dev-instance.example.com"
       ssh_username: "admin"
       ssh_password: "admin"
       ssh_port: 22
     prod:
       label: "PRODUCTION"
       # ... same structure ...
   ```

   Devices are discovered automatically from CloudVision's inventory API (or shown as mock data when no token is configured).

3. **Start the dashboard:**

   ```bash
   npm start
   ```

4. **Open your browser:**

   Navigate to [http://localhost:3000](http://localhost:3000)

## Setting Up API Tokens

All credentials are entered directly in the dashboard UI and saved to your browser's `localStorage` — no config files needed. Without tokens, the dashboard displays realistic demo data.

### GitHub Personal Access Token (PAT)

You need a GitHub PAT with the `actions:read` scope to view workflow runs.

1. Go to [github.com/settings/tokens](https://github.com/settings/tokens) (or **Settings → Developer settings → Personal access tokens → Tokens (classic)**)
2. Click **Generate new token (classic)**
3. Give it a descriptive name (e.g., "Arista Demo Dashboard")
4. Set an expiration (e.g., 90 days)
5. Under **Select scopes**, check only:
   - `repo` (needed to read Actions on private repos)
   - Or if the repo is public, just `public_repo`
6. Click **Generate token** and copy the `ghp_...` value
7. Paste the token into the **GitHub PAT** field in the dashboard and click **Connect**

**Fine-grained tokens** also work — create one at [github.com/settings/personal-access-tokens/new](https://github.com/settings/personal-access-tokens/new) with **Repository access** set to your target repo and **Actions: Read-only** permission.

### CloudVision API Key

For **CVaaS** (CloudVision as-a-Service):
1. Log in to your CVaaS portal
2. Go to **Settings → Access Control → Service Accounts**
3. Create a service account and generate a token
4. Paste the token into the **CloudVision API Key** field in the dashboard

For **CVP** (on-prem):
1. Log in to CVP
2. Go to **Settings → Service Accounts** (or use the API to generate a token)
3. Create a service account token
4. Paste it into the dashboard

Both token types work — the dashboard uses the CloudVision Resource API which is supported by both CVP and CVaaS.

## Usage

### First-Time Setup

1. Open the dashboard in your browser
2. Enter SSH credentials (username/password) in the **header bar** — these are shared across all devices
3. For each environment (DEV / PROD):
   - Enter your **GitHub Actions URL** and **PAT**, click **Connect**
   - Enter your **CloudVision URL** and **API Key**, click **Connect**
4. Once CloudVision is connected, the terminal panes auto-populate with the device inventory
5. All values are saved to `localStorage` — they'll be there when you reload

### During a Demo

1. Open the dashboard in a full-screen browser window (all fields auto-filled from last session)
2. Click **Connect** on the GitHub Actions and CloudVision panes
3. The **GitHub Actions** panel shows workflow runs with live status updates (auto-refreshes every 30s)
4. The **CloudVision** panel shows change controls with approval and execution status
5. Select a device and optional command from the SSH terminal dropdowns, click **Connect**
6. Walk through the same flow for the PRODUCTION row once DEV/TEST is complete
7. Use the footer links ("Open GitHub Actions", "Open CloudVision") to show the full UI when needed

### Pane Controls

| Control | Action |
|---------|--------|
| **Connect** | Connects to the API or SSH session (depending on pane type) |
| **Disconnect** | Disconnects and returns to the config form or device selector |
| **Open GitHub Actions / CloudVision** | Footer link that opens the full web UI in a new browser window |
| **Light/Dark Mode** | Toggle in the top-right corner; preference saved to localStorage |

### Status Indicators

Each pane has a status dot in the header:

- **Gray** — Idle / not connected
- **Blue (pulsing)** — Active / in progress
- **Green** — Connected / latest run succeeded
- **Red** — Error / connection or run failed

### Demo Data

When no API tokens are configured, the dashboard displays mock data that looks realistic for an AVD demo:

- **GitHub Actions** — Sample workflow runs ("Deploy AVD Config", "Validate Network State") with mixed statuses
- **CloudVision** — Sample change controls ("Spine BGP Peer Update", "MLAG Domain Configuration") with varied approval states

A **"Demo Data"** badge appears in each panel to indicate mock data is being shown.

## Configuration Reference

### config.yaml

The config file is minimal — just the server port and environment labels. All URLs, tokens, and SSH credentials are entered in the browser UI.

```yaml
server:
  port: 3000    # Port the dashboard runs on (default: 3000)

environments:
  dev:
    label: "DEV / TEST"
  prod:
    label: "PRODUCTION"
```

To add more environments, add entries here. The dashboard creates a row for each one.

### Browser UI Fields

All entered via the dashboard and persisted in `localStorage`:

| Field | Where | Description |
|-------|-------|-------------|
| SSH Username / Password | Header bar | Shared SSH credentials for all devices |
| GitHub Actions URL | Per environment | e.g., `https://github.com/your-org/your-repo/actions` |
| GitHub PAT | Per environment | Personal access token with `actions:read` scope |
| CloudVision URL | Per environment | e.g., `https://your-cv-instance.arista.io` |
| CloudVision API Key | Per environment | Service account token (CVP or CVaaS) |

## Development

Run the server with auto-reload on file changes:

```bash
npm run dev
```

## Project Structure

```
demo_dashboard/
├── .devcontainer/
│   └── devcontainer.json         # Dev Container configuration (Node.js 22)
├── .gitignore
├── config.yaml                   # Server port and environment labels
├── server.js                     # Express server + API proxy + WebSocket SSH proxy
├── package.json
└── public/
    ├── index.html                # Dashboard shell
    ├── css/
    │   └── styles.css            # Dark/light theme with CSS custom properties
    ├── js/
    │   ├── app.js                # Main app — loads config, builds panes, theme toggle
    │   ├── github-panel.js       # GitHub Actions config form + workflow run panel
    │   ├── cloudvision-panel.js  # CloudVision config form + change control panel
    │   └── terminal.js           # Device selector + xterm.js SSH terminal manager
    └── assets/
        ├── arista-com-logo.png
        ├── avd-logo.png
        └── ci_pipeline.png
```

## Troubleshooting

### SSH connection fails
- Verify the device is reachable from your machine (`ping <host>`)
- Check that the SSH username/password in the header bar are correct
- Ensure port 22 is not blocked by a firewall

### API panels show "Demo Data" when tokens are set
- Verify you clicked **Connect** after entering the token
- Check that the URL is correct and reachable from the server
- Check the browser console and server console for error messages

### Terminal panes say "Connect CloudVision to load device inventory"
- Click **Connect** on the CloudVision pane first — the device list comes from the CV inventory API

### Terminal text is too small or misaligned
- The terminal auto-fits to the pane size; resize the browser window or zoom level to adjust
- For best results, use the dashboard in full-screen mode on an external display

## Customization

### Change the port
Edit the `server.port` value in `config.yaml`.

### Add more environments
Add additional entries under `environments` in `config.yaml`. The dashboard dynamically creates a row for each environment defined, with its own set of URL/token fields in the UI.
