# Arista Demo Dashboard

A single-pane-of-glass dashboard for presenting Arista AVD automation demos. Consolidates GitHub Actions, CloudVision, and SSH terminal sessions into one browser tab, organized by pipeline stage.

```
┌─────────────────────────────────────────────────────────────────────┐
│                      ARISTA · Demo Dashboard                        │
├─────────────────────────────────────────────────────────────────────┤
│  DEV / TEST                                                         │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌────────────┐ │
│  │   GitHub     │ │  CloudVision │ │    Spine     │ │    Leaf    │ │
│  │   Actions    │ │     UI       │ │    (SSH)     │ │    (SSH)   │ │
│  └──────────────┘ └──────────────┘ └──────────────┘ └────────────┘ │
├─────────────────────────────────────────────────────────────────────┤
│  PRODUCTION                                                         │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌────────────┐ │
│  │   GitHub     │ │  CloudVision │ │    Spine     │ │    Leaf    │ │
│  │   Actions    │ │     UI       │ │    (SSH)     │ │    (SSH)   │ │
│  └──────────────┘ └──────────────┘ └──────────────┘ └────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

## Features

- **Unified view** — GitHub Actions, CloudVision UI, and SSH terminals side by side in a single browser tab
- **Two environments** — DEV/TEST and PRODUCTION rows, each with 4 panes matching the pipeline stages
- **Embedded SSH terminals** — Full interactive terminals via xterm.js with username/password authentication
- **Web pane fallback** — Attempts iframe embedding; if the site blocks it, provides a one-click popup window
- **Arista branding** — Dark theme with Arista blue accents, designed for projector/screen-share presentations
- **Simple configuration** — One YAML file to define URLs, devices, and credentials

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
   # Edit config.yaml with your environment details, then:
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

   Edit `config.yaml` with your actual URLs, device IPs, and credentials:

   ```yaml
   environments:
     dev:
       label: "DEV / TEST"
       github_actions_url: "https://github.com/your-org/your-repo/actions"
       cloudvision_url: "https://your-cv-dev-instance.example.com"
       devices:
         - name: "Spine-1"
           host: "10.0.0.1"
           port: 22
           username: "admin"
           password: "admin"
         - name: "Leaf-1"
           host: "10.0.0.2"
           port: 22
           username: "admin"
           password: "admin"
     prod:
       label: "PRODUCTION"
       # ... same structure ...
   ```

3. **Start the dashboard:**

   ```bash
   npm start
   ```

4. **Open your browser:**

   Navigate to [http://localhost:3000](http://localhost:3000)

## Usage

### During a Demo

1. Open the dashboard in a full-screen browser window before starting the demo
2. Trigger your GitHub Actions workflow (push, PR, etc.)
3. The **GitHub Actions** pane shows the CI pipeline status — if iframe embedding is blocked, click **Open** to launch it in a popup window
4. The **CloudVision** pane shows change controls being created and executed — same iframe/popup behavior
5. Click **Connect** on each SSH terminal pane to open sessions to the spine and leaf devices
6. Run your watch commands (e.g., `watch diff show running-config`) to show configs being applied
7. Walk through the same flow for the PRODUCTION row once DEV/TEST is complete

### Pane Controls

| Button | Action |
|--------|--------|
| **Open** | Opens the web URL (GitHub Actions or CloudVision) in a new browser window |
| **Connect** | Establishes an SSH session to the configured device |
| **Disconnect** | Closes the active SSH session |

### Status Indicators

Each pane has a status dot in the header:

- **Gray** — Idle / not connected
- **Blue (pulsing)** — Active / loading
- **Green** — Connected / healthy
- **Red** — Error / connection failed

## Configuration Reference

The `config.yaml` file has two sections:

### Server

```yaml
server:
  port: 3000    # Port the dashboard runs on (default: 3000)
```

### Environments

Each environment (e.g., `dev`, `prod`) supports:

| Field | Description |
|-------|-------------|
| `label` | Display name shown in the dashboard row header |
| `github_actions_url` | URL to the GitHub Actions page for this environment's workflow |
| `cloudvision_url` | URL to the CloudVision instance managing this environment |
| `devices` | Array of SSH targets (2 per environment) |
| `devices[].name` | Display name for the device (e.g., "Spine-1") |
| `devices[].host` | IP address or hostname |
| `devices[].port` | SSH port (default: 22) |
| `devices[].username` | SSH username |
| `devices[].password` | SSH password |

## Development

Run the server with auto-reload on file changes:

```bash
npm run dev
```

## Project Structure

```
demo_dashboard/
├── .devcontainer/
│   └── devcontainer.json    # Dev Container configuration (Node.js 22)
├── config.yaml              # Environment and device configuration
├── server.js                # Express server + WebSocket SSH proxy
├── package.json
└── public/
    ├── index.html           # Dashboard layout
    ├── css/
    │   └── styles.css       # Arista dark theme
    ├── js/
    │   ├── app.js           # Main app — loads config, builds panes
    │   ├── terminal.js      # xterm.js SSH terminal manager
    │   └── iframe.js        # Iframe loader with popup fallback
    └── assets/
        └── arista-logo.svg  # Logo placeholder (replace with official logo)
```

## Troubleshooting

### SSH connection fails
- Verify the device is reachable from your laptop (`ping <host>`)
- Check that the username/password in `config.yaml` are correct
- Ensure port 22 is not blocked by a firewall

### GitHub Actions / CloudVision won't embed
- This is expected — many sites block iframe embedding via security headers
- Use the **Open** button to launch the page in a popup window instead
- The dashboard detects this automatically and shows a fallback card

### Terminal text is too small or misaligned
- The terminal auto-fits to the pane size; resize the browser window or zoom level to adjust
- For best results, use the dashboard in full-screen mode on an external display

## Customization

### Replace the logo
Swap `public/assets/arista-logo.svg` with your own SVG file. Keep the filename the same, or update the reference in `public/index.html`.

### Change the port
Edit the `server.port` value in `config.yaml`.

### Add more environments
Add additional entries under `environments` in `config.yaml`. The dashboard dynamically creates a row for each environment defined.
