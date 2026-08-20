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

## API Tokens

API tokens are stored in environment variables to keep them out of the codebase. Without tokens, the dashboard displays realistic demo data.

1. **Copy the example file:**

   ```bash
   cp .env.example .env
   ```

2. **Fill in your tokens:**

   ```bash
   # GitHub personal access token (needs actions:read scope)
   GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

   # CloudVision service account tokens (one per environment, uppercase key)
   CLOUDVISION_TOKEN_DEV=your-dev-cv-token
   CLOUDVISION_TOKEN_PROD=your-prod-cv-token
   ```

3. **Restart the server** — tokens are read at startup.

The `.env` file is git-ignored and will never be committed. The server also accepts tokens in `config.yaml` as a fallback (under `github.token` and per-environment `cloudvision_token`), but environment variables are the recommended approach.

## Usage

### During a Demo

1. Open the dashboard in a full-screen browser window before starting the demo
2. Trigger your GitHub Actions workflow (push, PR, etc.)
3. The **GitHub Actions** panel shows workflow runs with live status updates (success, failure, in-progress)
4. The **CloudVision** panel shows change controls with approval and execution status
5. Select devices from the dropdowns in each SSH terminal pane and click **Connect**
6. Run your watch commands (e.g., `watch diff show running-config`) to show configs being applied
7. Walk through the same flow for the PRODUCTION row once DEV/TEST is complete
8. Use the footer links ("Open GitHub Actions", "Open CloudVision") to show the full UI when needed

### Pane Controls

| Control | Action |
|---------|--------|
| **Connect** | Establishes an SSH session to the configured device |
| **Disconnect** | Closes the active SSH session |
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

#### Server

```yaml
server:
  port: 3000    # Port the dashboard runs on (default: 3000)
```

#### Environments

Each environment (e.g., `dev`, `prod`) supports:

| Field | Description |
|-------|-------------|
| `label` | Display name shown in the dashboard row header |
| `github_actions_url` | URL to the GitHub Actions page for this environment's workflow |
| `cloudvision_url` | URL to the CloudVision instance managing this environment |
| `ssh_username` | SSH username for all devices in this environment |
| `ssh_password` | SSH password for all devices in this environment |
| `ssh_port` | SSH port (default: 22) |

### Environment Variables

| Variable | Description |
|----------|-------------|
| `GITHUB_TOKEN` | GitHub PAT with `actions:read` scope |
| `CLOUDVISION_TOKEN_<ENV>` | CloudVision service account token per environment (e.g., `CLOUDVISION_TOKEN_DEV`, `CLOUDVISION_TOKEN_PROD`) |

CloudVision tokens work with both CVP (on-prem) and CVaaS deployments.

## Development

Run the server with auto-reload on file changes:

```bash
npm run dev
```

## Project Structure

```
demo_dashboard/
├── .devcontainer/
│   └── devcontainer.json      # Dev Container configuration (Node.js 22)
├── .env.example               # Template for API token environment variables
├── .gitignore
├── config.yaml                # Environment and device configuration
├── server.js                  # Express server + API proxy + WebSocket SSH proxy
├── package.json
└── public/
    ├── index.html             # Dashboard shell
    ├── css/
    │   └── styles.css         # Dark/light theme with CSS custom properties
    ├── js/
    │   ├── app.js             # Main app — loads config, builds panes, theme toggle
    │   ├── github-panel.js    # GitHub Actions workflow run panel
    │   ├── cloudvision-panel.js  # CloudVision change control panel
    │   └── terminal.js        # xterm.js SSH terminal manager
    └── assets/
        ├── arista-com-logo.png
        ├── avd-logo.png
        └── ci_pipeline.png
```

## Troubleshooting

### SSH connection fails
- Verify the device is reachable from your machine (`ping <host>`)
- Check that the username/password in `config.yaml` are correct
- Ensure port 22 is not blocked by a firewall

### API panels show "Demo Data" when tokens are set
- Ensure you restarted the server after creating/editing `.env`
- Verify the token variable names match your environment keys (e.g., `CLOUDVISION_TOKEN_DEV` for the `dev` environment)
- Check the server console for API error messages

### Terminal text is too small or misaligned
- The terminal auto-fits to the pane size; resize the browser window or zoom level to adjust
- For best results, use the dashboard in full-screen mode on an external display

## Customization

### Change the port
Edit the `server.port` value in `config.yaml`.

### Add more environments
Add additional entries under `environments` in `config.yaml`. The dashboard dynamically creates a row for each environment defined. For CloudVision tokens, add a matching `CLOUDVISION_TOKEN_<ENV>` environment variable (uppercase).
