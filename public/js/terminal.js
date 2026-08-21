const PRESET_COMMANDS = [
  { label: 'None', command: '' },
  { label: 'MLAG Status', command: 'watch 1 show mlag' },
  { label: 'MLAG Intf', command: 'watch 1 show mlag interfaces' },
  { label: 'Trunk Intf', command: 'watch 1 show interfaces trunk' },
  { label: 'IP Intf Br', command: 'watch 1 show ip int brief' },
  { label: 'BGP IP', command: 'watch 1 show ip bgp summary' },
  { label: 'BGP EVPN', command: 'watch 1 show bgp evpn summary' },
];

class TerminalManager {
  constructor(containerEl, envKey) {
    this.container = containerEl;
    this.envKey = envKey;
    this.term = null;
    this.ws = null;
    this.fitAddon = null;
    this.connected = false;
    this.devices = [];
    this.selectedDevice = null;
    this.pendingCommand = '';
    this.onStatusChange = null;
    this.onDeviceChange = null;
    this.showWaiting();
  }

  showWaiting() {
    this.container.innerHTML = `
      <div class="terminal-placeholder">
        <div class="terminal-placeholder-icon">⬡</div>
        <div class="terminal-placeholder-text">Connect CloudVision to load device inventory</div>
      </div>`;
  }

  async loadDevices() {
    this.container.innerHTML = `
      <div class="terminal-placeholder">
        <div class="terminal-placeholder-icon">⟳</div>
        <div class="terminal-placeholder-text">Loading device inventory…</div>
      </div>`;

    const cvUrl = localStorage.getItem(`cv_url_${this.envKey}`) || '';
    const cvToken = localStorage.getItem(`cv_token_${this.envKey}`) || '';

    try {
      const res = await fetch('/api/cloudvision/devices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: cvUrl, token: cvToken }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      this.devices = data.devices || [];

      // If ACT is configured for this env, fetch ACT IPs and match by hostname
      const actEnabled = localStorage.getItem(`act_enabled_${this.envKey}`);
      const actUrl = localStorage.getItem(`act_url_${this.envKey}`);
      const actToken = localStorage.getItem(`act_token_${this.envKey}`);
      const actLab = localStorage.getItem(`act_lab_${this.envKey}`);
      if (actEnabled === 'true' && actToken && actLab) {
        try {
          const actRes = await fetch('/api/act/devices', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ actUrl, apiKey: actToken, labName: actLab, username: localStorage.getItem(`act_user_${this.envKey}`) || '' }),
          });
          if (actRes.ok) {
            const actData = await actRes.json();
            const actDevices = actData.devices || [];
            const actMap = {};
            actDevices.forEach(d => { actMap[d.hostname.toLowerCase()] = d.ipAddress; });
            this.devices.forEach(d => {
              const actIp = actMap[d.hostname.toLowerCase()];
              if (actIp) d.ipAddress = actIp;
            });
          }
        } catch {}
      }

      this.showSelector();
    } catch (err) {
      this.container.innerHTML = `
        <div class="terminal-placeholder">
          <div class="terminal-placeholder-icon">⚠</div>
          <div class="terminal-placeholder-text">Failed to load devices</div>
          <div style="font-size:10px;color:var(--text-muted);margin-top:4px">${this.esc(err.message)}</div>
        </div>`;
    }
  }

  refreshDevices() {
    if (!this.connected) {
      this.loadDevices();
    }
  }

  resetDevices() {
    if (!this.connected) {
      this.devices = [];
      this.selectedDevice = null;
      if (this.onDeviceChange) this.onDeviceChange('Select Device');
      this.showWaiting();
    }
  }

  showSelector() {
    const deviceOptions = this.devices.map((d, i) =>
      `<option value="${i}">${this.esc(d.hostname)}</option>`
    ).join('');

    const cmdOptions = PRESET_COMMANDS.map((c, i) =>
      `<option value="${i}">${this.esc(c.label)}</option>`
    ).join('');

    this.container.innerHTML = `
      <div class="terminal-selector">
        <div class="terminal-selector-inner">
          <div class="terminal-placeholder-icon">⬡</div>
          <select class="device-select">${deviceOptions}</select>
          <select class="command-select">${cmdOptions}</select>
          <div class="terminal-placeholder-text">Select a device and click Connect</div>
        </div>
      </div>`;

    const deviceSelect = this.container.querySelector('.device-select');
    const cmdSelect = this.container.querySelector('.command-select');

    if (this.selectedDevice !== null && this.selectedDevice < this.devices.length) {
      deviceSelect.value = this.selectedDevice;
    }
    deviceSelect.addEventListener('change', () => {
      this.selectedDevice = parseInt(deviceSelect.value, 10);
      if (this.onDeviceChange) {
        this.onDeviceChange(this.devices[this.selectedDevice]?.hostname || 'Select Device');
      }
    });
    this.selectedDevice = parseInt(deviceSelect.value, 10);
    if (this.onDeviceChange && this.devices.length) {
      this.onDeviceChange(this.devices[this.selectedDevice]?.hostname || 'Select Device');
    }

    cmdSelect.addEventListener('change', () => {
      const idx = parseInt(cmdSelect.value, 10);
      this.pendingCommand = PRESET_COMMANDS[idx]?.command || '';
    });
    this.pendingCommand = PRESET_COMMANDS[0]?.command || '';
  }

  getSelectedDevice() {
    if (this.selectedDevice === null || !this.devices[this.selectedDevice]) return null;
    return this.devices[this.selectedDevice];
  }

  connect() {
    if (this.connected) return;
    const device = this.getSelectedDevice();
    if (!device) return;

    const username = localStorage.getItem(`ssh_username_${this.envKey}`) || '';
    const password = localStorage.getItem(`ssh_password_${this.envKey}`) || '';
    if (!username || !password) {
      this.container.innerHTML = `
        <div class="terminal-placeholder">
          <div class="terminal-placeholder-icon">⚠</div>
          <div class="terminal-placeholder-text">SSH credentials not configured for this environment</div>
        </div>`;
      setTimeout(() => this.showSelector(), 3000);
      return;
    }

    this.container.innerHTML = '';
    const termDiv = document.createElement('div');
    termDiv.className = 'terminal-container';
    this.container.appendChild(termDiv);

    const isLight = document.body.classList.contains('light-theme');
    const termTheme = isLight ? {
      background: '#F0F2F5',
      foreground: '#1A1A2E',
      cursor: '#086FA1',
      cursorAccent: '#F0F2F5',
      selectionBackground: 'rgba(8, 111, 161, 0.2)',
      black: '#1A1A2E',
      red: '#C0392B',
      green: '#00856A',
      yellow: '#D68910',
      blue: '#065A82',
      magenta: '#7D3C98',
      cyan: '#086FA1',
      white: '#F0F2F5',
      brightBlack: '#5A6577',
      brightRed: '#E74C3C',
      brightGreen: '#00B894',
      brightYellow: '#F39C12',
      brightBlue: '#0A8AC7',
      brightMagenta: '#9B59B6',
      brightCyan: '#0A8AC7',
      brightWhite: '#1A1A2E',
    } : {
      background: '#0D1B2A',
      foreground: '#E0E6ED',
      cursor: '#086FA1',
      cursorAccent: '#0D1B2A',
      selectionBackground: 'rgba(8, 111, 161, 0.3)',
      black: '#1B2838',
      red: '#E74C3C',
      green: '#00B894',
      yellow: '#F39C12',
      blue: '#086FA1',
      magenta: '#9B59B6',
      cyan: '#0A8AC7',
      white: '#E0E6ED',
      brightBlack: '#556677',
      brightRed: '#FF6B6B',
      brightGreen: '#55EFC4',
      brightYellow: '#FFEAA7',
      brightBlue: '#74B9FF',
      brightMagenta: '#A29BFE',
      brightCyan: '#81ECEC',
      brightWhite: '#FFFFFF',
    };

    this.term = new Terminal({
      cursorBlink: true,
      fontSize: 13,
      fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', Menlo, Monaco, monospace",
      theme: termTheme,
    });

    this.fitAddon = new FitAddon.FitAddon();
    this.term.loadAddon(this.fitAddon);
    this.term.open(termDiv);

    requestAnimationFrame(() => {
      this.fitAddon.fit();
    });

    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    this.ws = new WebSocket(`${protocol}//${location.host}/ws/ssh`);
    this.ws.binaryType = 'arraybuffer';

    this.ws.addEventListener('open', () => {
      this.ws.send(JSON.stringify({
        type: 'connect',
        host: device.ipAddress,
        username,
        password,
        port: 22,
        cols: this.term.cols,
        rows: this.term.rows,
      }));
    });

    this.ws.addEventListener('message', (event) => {
      if (event.data instanceof ArrayBuffer) {
        this.term.write(new Uint8Array(event.data));
        return;
      }

      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'status') {
          this.connected = msg.status === 'connected';
          if (this.onStatusChange) this.onStatusChange(msg.status);
          if (msg.status === 'connected' && this.pendingCommand) {
            setTimeout(() => {
              this.ws.send(JSON.stringify({ type: 'data', data: this.pendingCommand + '\n' }));
            }, 500);
          }
          if (msg.status === 'disconnected') {
            this.term.write('\r\n\x1b[90m--- Session ended ---\x1b[0m\r\n');
          }
        }
        if (msg.type === 'error') {
          this.term.write(`\r\n\x1b[31mError: ${msg.message}\x1b[0m\r\n`);
          this.connected = false;
          if (this.onStatusChange) this.onStatusChange('error');
        }
      } catch {
        this.term.write(event.data);
      }
    });

    this.ws.addEventListener('close', () => {
      this.connected = false;
      if (this.onStatusChange) this.onStatusChange('disconnected');
    });

    this.term.onData((data) => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'data', data }));
      }
    });

    this.term.onResize(({ cols, rows }) => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'resize', cols, rows }));
      }
    });

    this._resizeObserver = new ResizeObserver(() => {
      if (this.fitAddon) {
        try { this.fitAddon.fit(); } catch {}
      }
    });
    this._resizeObserver.observe(termDiv);
  }

  disconnect() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'disconnect' }));
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    if (this._resizeObserver) {
      this._resizeObserver.disconnect();
      this._resizeObserver = null;
    }
    if (this.term) {
      this.term.dispose();
      this.term = null;
    }
    this.fitAddon = null;
    this.connected = false;
    if (this.onStatusChange) this.onStatusChange('disconnected');
    this.showSelector();
  }

  esc(str) {
    const d = document.createElement('div');
    d.textContent = str || '';
    return d.innerHTML;
  }
}
