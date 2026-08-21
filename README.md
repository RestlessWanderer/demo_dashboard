# Arista Demo Dashboard

A single-pane-of-glass dashboard for presenting Arista AVD automation demos. Pre-configure multiple demo environments, then launch into a live view that consolidates GitHub Actions CI status, CloudVision change controls, and SSH terminal sessions in one browser tab.

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Demo Dashboard                                                         │
│  ┌───────────┐ ┌───────────┐ ┌───────────┐                             │
│  │  ACME     │ │  Lab 2    │ │    +      │                             │
│  │  Demo     │ │           │ │  Add Demo │                             │
│  │ [Launch]  │ │ [Launch]  │ │           │                             │
│  └───────────┘ └───────────┘ └───────────┘                             │
└─────────────────────────────────────────────────────────────────────────┘
                              ↓ Launch
┌──────────┬──────────────────────────────────────────────────────────────┐
│          │  D E V / T E S T                                            │
│  GitHub  │  ┌──────────────┐ ┌─────────────────────────────────────┐   │
│  Actions │  │  CloudVision │ │  Terminal (SSH)                     │   │
│          │  │  Change Ctrl │ ├─────────────────────────────────────┤   │
│  (shared │  │              │ │  Terminal (SSH)                     │   │
│  sidebar)│  └──────────────┘ └─────────────────────────────────────┘   │
│          ├──────────────────────────────────────────────────────────────┤
│          │  P R O D U C T I O N                                        │
│          │  ┌──────────────┐ ┌─────────────────────────────────────┐   │
│          │  │  CloudVision │ │  Terminal (SSH)                     │   │
│          │  │  Change Ctrl │ ├─────────────────────────────────────┤   │
│          │  │              │ │  Terminal (SSH)                     │   │
│          │  └──────────────┘ └─────────────────────────────────────┘   │
└──────────┴──────────────────────────────────────────────────────────────┘
```

## Features

- **Demo launcher** — Pre-configure multiple demos with all credentials; one-click launch into a fully connected dashboard
- **GitHub Actions sidebar** — Shared across environments; shows workflow runs with expandable job/step details; 5-second auto-refresh
- **CloudVision change controls** — Per-environment panels showing change control status with 10-second auto-refresh
- **Dynamic device inventory** — Devices pulled from CloudVision's inventory API; select any device from a dropdown
- **ACT integration** — Optional Arista Cloud Test support for dev environments; automatically maps ACT VPN IPs to CloudVision hostnames
- **Embedded SSH terminals** — Full interactive terminals via xterm.js with preset commands (MLAG, BGP, interfaces)
- **Light / dark mode** — Toggle in the header; preference persists across sessions
- **Zero config files** — All URLs, tokens, and credentials entered in the browser UI and saved to localStorage
- **Mock data mode** — Realistic demo data when no tokens are configured

## Prerequisites

- [Docker](https://www.docker.com/products/docker-desktop/) and [VS Code](https://code.visualstudio.com/) with the [Dev Containers extension](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers) (recommended)
- **Or** [Node.js](https://nodejs.org/) v18 or later
- Network access to target devices (SSH), GitHub, and CloudVision

## Quick Start (Dev Container)

1. **Clone and open in VS Code:**
   ```bash
   git clone <repo-url>
   cd demo_dashboard
   code .
   ```

2. **Reopen in container** — click "Reopen in Container" when prompted, or use the command palette.

3. **Dependencies install automatically** via `postCreateCommand`.

4. **Start the server:**
   ```bash
   npm start
   ```

5. VS Code auto-forwards port 3000. Open [http://localhost:3000](http://localhost:3000).

## Quick Start (Local)

```bash
git clone <repo-url>
cd demo_dashboard
npm install
npm start
# Open http://localhost:3000
```

## Setting Up a Demo

### 1. Create a demo tile

Open the dashboard at `http://localhost:3000`. Click **Add Demo** and fill in:

| Field | Description |
|-------|-------------|
| **Demo Name** | A label for this demo (e.g., "Customer ACME") |
| **GitHub Actions URL** | e.g., `https://github.com/your-org/your-repo/actions` |
| **GitHub PAT** | Personal access token (see below); leave empty for mock data |
| **Dev CloudVision URL** | URL to your dev/test CloudVision instance |
| **Dev CV API Key** | Service account token; leave empty for mock data |
| **Dev environment uses ACT** | Check if using Arista Cloud Test for dev (see ACT section) |
| **Prod CloudVision URL** | URL to your production CloudVision instance |
| **Prod CV API Key** | Service account token |
| **SSH Username / Password** | Shared credentials for all network devices |

Click **Save**. The demo tile appears with **Launch**, **Edit**, and **Delete** buttons.

### 2. Launch

Click **Launch** on the tile. The live dashboard opens with GitHub Actions, CloudVision, and device inventory all auto-connected. Use the **←** back arrow in the header to return to the launcher.

## Setting Up API Tokens

### GitHub Personal Access Token (PAT)

1. Go to [github.com/settings/tokens](https://github.com/settings/tokens) → **Generate new token (classic)**
2. Name it (e.g., "Arista Demo Dashboard")
3. Set an expiration
4. Select scopes:
   - `repo` (for private repos)
   - Or `public_repo` (for public repos)
5. Copy the `ghp_...` token into the demo config

**Fine-grained tokens** also work — set **Repository access** to your repo and enable **Actions: Read-only**.

### CloudVision API Key

**CVaaS:** Settings → Access Control → Service Accounts → generate token

**CVP (on-prem):** Settings → Service Accounts → generate token

Both work with the dashboard. For on-prem CVP with self-signed certificates, the dashboard automatically accepts them.

## ACT Integration

For dev environments running on Arista Cloud Test, the SSH-reachable IPs differ from CloudVision's management IPs. The dashboard can pull the correct VPN IPs from the ACT API.

When creating a demo, check **"Dev environment uses ACT"** and fill in:

| Field | Description |
|-------|-------------|
| **ACT URL** | e.g., `ce.act.arista.com` (your ACT tenant) |
| **ACT Username** | Your ACT username |
| **ACT API Token** | Your ACT API key |
| **ACT Lab Name** | The name of your lab in ACT |

The dashboard matches devices by hostname between CloudVision and ACT, and uses the ACT `internal_ip` for SSH connections.

## Usage

### During a Demo

1. Click **Launch** on your demo tile — everything auto-connects
2. The **GitHub Actions** sidebar shows workflow runs with live job/step progress (5s refresh)
3. **CloudVision** panels show change controls per environment (10s refresh)
4. Select a device and optional preset command from the terminal dropdowns, click **Connect**
5. Walk through DEV/TEST first, then PRODUCTION

### Preset SSH Commands

The terminal dropdown includes common validation commands:

| Label | Command |
|-------|---------|
| None | (no auto-command) |
| MLAG Status | `watch 1 show mlag` |
| MLAG Intf | `watch 1 show mlag interfaces` |
| Trunk Intf | `watch 1 show interfaces trunk` |
| IP Intf Br | `watch 1 show ip int brief` |
| BGP IP | `watch 1 show ip bgp summary` |
| BGP EVPN | `watch 1 show bgp evpn summary` |

### Status Indicators

- **Gray** — Idle / not connected
- **Blue (pulsing)** — Active / in progress
- **Green** — Connected / succeeded
- **Red** — Error / failed

## Configuration

### config.yaml

Minimal — just the server port and environment labels:

```yaml
server:
  port: 3000

environments:
  dev:
    label: "DEV / TEST"
  prod:
    label: "PRODUCTION"
```

All credentials are entered in the browser UI and persisted in `localStorage`.

## Development

```bash
npm run dev    # Auto-reload on server.js changes
```

Client-side files (JS/CSS) update on browser refresh — no build step.

## Project Structure

```
demo_dashboard/
├── .devcontainer/
│   └── devcontainer.json         # Dev Container config (Node.js 22)
├── config.yaml                   # Server port + environment labels
├── server.js                     # Express + API proxies + WebSocket SSH
├── package.json
└── public/
    ├── index.html                # Demo launcher page
    ├── demo.html                 # Live dashboard page
    ├── css/
    │   └── styles.css            # Dark/light theme, launcher, modal styles
    ├── js/
    │   ├── launcher.js           # Demo CRUD, tile grid, add/edit modal
    │   ├── app.js                # Live dashboard orchestrator + auto-connect
    │   ├── github-panel.js       # GitHub Actions panel with job/step expansion
    │   ├── cloudvision-panel.js  # CloudVision change control panel
    │   └── terminal.js           # Device selector + SSH terminal + ACT IP matching
    └── assets/
        ├── arista-com-logo.png
        ├── avd-logo.png
        └── ci_pipeline.png
```

## Troubleshooting

### SSH connection fails
- Verify the device is reachable (`ping <host>`)
- Check SSH credentials in the demo config
- Arista EOS uses keyboard-interactive auth — this is supported automatically

### API panels show "Demo Data" with tokens configured
- Check that the URL is correct and reachable from the server
- For CVP with self-signed certs, this is handled automatically
- Check browser console (`F12`) for errors

### Terminal panes say "Connect CloudVision to load device inventory"
- CloudVision must be connected first — the device list comes from CV's inventory API

### Devices load but SSH connects to wrong IP (ACT)
- Enable **"Dev environment uses ACT"** in the demo config
- Verify ACT URL, username, API token, and lab name are correct
- The dashboard matches by hostname — ensure hostnames match between CV and ACT

### Server crashes after SSH disconnect
- Fixed in current version — null checks on SSH stream close events
- If it recurs, restart with `npm run dev`
