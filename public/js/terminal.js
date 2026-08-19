class TerminalManager {
  constructor(containerEl, envKey, deviceIndex, deviceName) {
    this.container = containerEl;
    this.envKey = envKey;
    this.deviceIndex = deviceIndex;
    this.deviceName = deviceName;
    this.term = null;
    this.ws = null;
    this.fitAddon = null;
    this.connected = false;
    this.onStatusChange = null;
    this.showPlaceholder();
  }

  showPlaceholder() {
    this.container.innerHTML = `
      <div class="terminal-placeholder">
        <div class="terminal-placeholder-icon">⬡</div>
        <div class="terminal-placeholder-text">Click Connect to open SSH session to ${this.deviceName}</div>
      </div>
    `;
  }

  connect() {
    if (this.connected) return;

    this.container.innerHTML = '';
    const termDiv = document.createElement('div');
    termDiv.className = 'terminal-container';
    this.container.appendChild(termDiv);

    this.term = new Terminal({
      cursorBlink: true,
      fontSize: 13,
      fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', Menlo, Monaco, monospace",
      theme: {
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
      },
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
        envKey: this.envKey,
        deviceIndex: this.deviceIndex,
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
    this.showPlaceholder();
  }
}
