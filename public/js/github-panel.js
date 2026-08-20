class GitHubPanel {
  constructor(container, envKey) {
    this.container = container;
    this.envKey = envKey;
    this.connected = false;
    this.url = '';
    this.token = '';
    this.onStatusChange = null;
    this.refreshInterval = null;
    this.showForm();
  }

  showForm() {
    const savedUrl = localStorage.getItem(`github_url_${this.envKey}`) || '';
    const savedToken = localStorage.getItem(`github_token_${this.envKey}`) || '';

    this.container.innerHTML = `
      <div class="config-form">
        <div class="config-form-inner">
          <label class="config-label">GitHub Actions URL</label>
          <input type="text" class="config-input" id="gh-url-${this.envKey}" placeholder="https://github.com/org/repo/actions" value="${this.escAttr(savedUrl)}">
          <label class="config-label">GitHub PAT</label>
          <input type="password" class="config-input" id="gh-token-${this.envKey}" placeholder="ghp_... (optional for demo data)">
          <div class="config-hint">Leave PAT empty to use demo data</div>
        </div>
      </div>`;

    const tokenInput = this.container.querySelector(`#gh-token-${this.envKey}`);
    if (savedToken) tokenInput.value = savedToken;
  }

  connect() {
    const urlInput = this.container.querySelector(`#gh-url-${this.envKey}`);
    const tokenInput = this.container.querySelector(`#gh-token-${this.envKey}`);
    if (!urlInput) return;

    this.url = urlInput.value.trim();
    this.token = tokenInput.value.trim();

    localStorage.setItem(`github_url_${this.envKey}`, this.url);
    localStorage.setItem(`github_token_${this.envKey}`, this.token);

    this.connected = true;
    this.showLoading();
    this.fetchData();
    this.refreshInterval = setInterval(() => this.fetchData(), 30000);
  }

  disconnect() {
    this.connected = false;
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
    if (this.onStatusChange) this.onStatusChange('idle');
    this.showForm();
  }

  showLoading() {
    this.container.innerHTML = `
      <div class="api-panel">
        <div class="api-panel-list">
          <div class="api-panel-placeholder">
            <div class="api-panel-placeholder-icon">⟳</div>
            <div class="api-panel-placeholder-text">Loading workflow runs…</div>
          </div>
        </div>
        ${this.footerHtml()}
      </div>`;
  }

  async fetchData() {
    try {
      const res = await fetch('/api/github/runs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: this.url, token: this.token }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (this.connected) {
        this.renderRuns(data.runs, data.mock);
        this.updateStatus(data.runs);
      }
    } catch (err) {
      if (this.connected) {
        this.renderError(err.message);
        if (this.onStatusChange) this.onStatusChange('error');
      }
    }
  }

  renderRuns(runs, isMock) {
    const items = runs.map((run, i) => {
      const statusClass = this.runStatusClass(run);
      const statusIcon = this.runStatusIcon(run);
      return `
        <div class="api-item ${i === 0 ? 'api-item-latest' : ''}">
          <div class="api-item-icon ${statusClass}">${statusIcon}</div>
          <div class="api-item-details">
            <div class="api-item-name">${this.esc(run.name)}</div>
            <div class="api-item-meta">
              <span class="branch-badge">${this.esc(run.branch)}</span>
              <span class="api-item-time">${this.timeAgo(run.createdAt)}</span>
            </div>
            <div class="api-item-commit">${this.esc(run.commitMessage)}</div>
          </div>
        </div>`;
    }).join('');

    const mockBadge = isMock ? '<span class="demo-badge">Demo Data</span>' : '';

    this.container.innerHTML = `
      <div class="api-panel">
        <div class="api-panel-list">
          ${mockBadge}
          ${items || '<div class="api-panel-placeholder"><div class="api-panel-placeholder-text">No workflow runs found</div></div>'}
        </div>
        ${this.footerHtml()}
      </div>`;
  }

  renderError(message) {
    this.container.innerHTML = `
      <div class="api-panel">
        <div class="api-panel-list">
          <div class="api-panel-placeholder">
            <div class="api-panel-placeholder-icon api-panel-error-icon">⚠</div>
            <div class="api-panel-placeholder-text">Failed to load workflow runs</div>
            <div class="api-panel-error-detail">${this.esc(message)}</div>
          </div>
        </div>
        ${this.footerHtml()}
      </div>`;
  }

  footerHtml() {
    if (!this.url) return '';
    return `<div class="api-panel-footer">
      <a href="#" class="api-panel-link" onclick="window.open('${this.escAttr(this.url)}', 'gh_${this.envKey}'); return false;">
        Open GitHub Actions <span class="link-arrow">↗</span>
      </a>
    </div>`;
  }

  updateStatus(runs) {
    if (!this.onStatusChange || !runs.length) return;
    const latest = runs[0];
    if (latest.status === 'in_progress' || latest.status === 'queued') {
      this.onStatusChange('active');
    } else if (latest.conclusion === 'success') {
      this.onStatusChange('connected');
    } else if (latest.conclusion === 'failure') {
      this.onStatusChange('error');
    } else {
      this.onStatusChange('idle');
    }
  }

  runStatusClass(run) {
    if (run.status === 'in_progress' || run.status === 'queued') return 'status-running';
    if (run.conclusion === 'success') return 'status-success';
    if (run.conclusion === 'failure') return 'status-failure';
    return 'status-neutral';
  }

  runStatusIcon(run) {
    if (run.status === 'in_progress' || run.status === 'queued') return '●';
    if (run.conclusion === 'success') return '✓';
    if (run.conclusion === 'failure') return '✗';
    return '○';
  }

  timeAgo(dateStr) {
    const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }

  esc(str) {
    const d = document.createElement('div');
    d.textContent = str || '';
    return d.innerHTML;
  }

  escAttr(str) {
    return (str || '').replace(/'/g, "\\'").replace(/"/g, '&quot;');
  }
}
