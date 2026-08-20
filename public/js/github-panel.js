class GitHubPanel {
  constructor(container) {
    this.container = container;
    this.connected = false;
    this.url = '';
    this.token = '';
    this.onStatusChange = null;
    this.refreshInterval = null;
    this.expandedRuns = new Set();
    this.jobsCache = {};
    this.showForm();
  }

  showForm() {
    const savedUrl = localStorage.getItem('github_url') || '';
    const savedToken = localStorage.getItem('github_token') || '';

    this.container.innerHTML = `
      <div class="config-form">
        <div class="config-form-inner">
          <label class="config-label">GitHub Actions URL</label>
          <input type="text" class="config-input" id="gh-url" placeholder="https://github.com/org/repo/actions" value="${this.escAttr(savedUrl)}">
          <label class="config-label">GitHub PAT</label>
          <input type="password" class="config-input" id="gh-token" placeholder="ghp_... (optional for demo data)">
          <div class="config-hint">Leave PAT empty to use demo data</div>
        </div>
      </div>`;

    const tokenInput = this.container.querySelector('#gh-token');
    if (savedToken) tokenInput.value = savedToken;
  }

  connect() {
    const urlInput = this.container.querySelector('#gh-url');
    const tokenInput = this.container.querySelector('#gh-token');
    if (!urlInput) return;

    this.url = urlInput.value.trim();
    this.token = tokenInput.value.trim();

    localStorage.setItem('github_url', this.url);
    localStorage.setItem('github_token', this.token);

    this.connected = true;
    this.expandedRuns.clear();
    this.jobsCache = {};
    this.showLoading();
    this.fetchData();
    this.refreshInterval = setInterval(() => this.fetchData(), 5000);
  }

  disconnect() {
    this.connected = false;
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
    this.expandedRuns.clear();
    this.jobsCache = {};
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
      if (!this.connected) return;

      // Auto-expand in-progress runs and the latest run
      if (data.runs.length > 0) {
        this.expandedRuns.add(data.runs[0].id);
      }
      data.runs.forEach(r => {
        if (r.status === 'in_progress' || r.status === 'queued') {
          this.expandedRuns.add(r.id);
        }
      });

      // Fetch jobs for expanded runs
      const expandedIds = [...this.expandedRuns].filter(id => data.runs.some(r => r.id === id));
      await Promise.all(expandedIds.map(id => this.fetchJobs(id)));

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

  async fetchJobs(runId) {
    try {
      const res = await fetch('/api/github/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: this.url, token: this.token, runId }),
      });
      if (!res.ok) return;
      const data = await res.json();
      this.jobsCache[runId] = data.jobs || [];
    } catch {}
  }

  renderRuns(runs, isMock) {
    const items = runs.map((run, i) => {
      const statusClass = this.runStatusClass(run);
      const statusIcon = this.runStatusIcon(run);
      const isExpanded = this.expandedRuns.has(run.id);
      const jobs = this.jobsCache[run.id];

      let jobsHtml = '';
      if (isExpanded && jobs && jobs.length > 0) {
        const jobItems = jobs.map(job => {
          const jClass = this.runStatusClass(job);
          const jIcon = this.runStatusIcon(job);
          const stepsHtml = (job.steps || []).map(step => {
            const sClass = this.runStatusClass(step);
            const sIcon = this.runStatusIcon(step);
            return `<div class="step-item">
              <span class="step-icon ${sClass}">${sIcon}</span>
              <span class="step-name">${this.esc(step.name)}</span>
            </div>`;
          }).join('');
          return `<div class="job-item">
            <div class="job-header">
              <span class="job-icon ${jClass}">${jIcon}</span>
              <span class="job-name">${this.esc(job.name)}</span>
            </div>
            ${stepsHtml ? `<div class="job-steps">${stepsHtml}</div>` : ''}
          </div>`;
        }).join('');
        jobsHtml = `<div class="run-jobs">${jobItems}</div>`;
      }

      const expandToggle = `<span class="run-expand" data-run-id="${run.id}">${isExpanded ? '▾' : '▸'}</span>`;

      return `
        <div class="api-item ${i === 0 ? 'api-item-latest' : ''}">
          <div class="api-item-icon ${statusClass}">${statusIcon}</div>
          <div class="api-item-details">
            <div class="api-item-name">${expandToggle} ${this.esc(run.name)}</div>
            <div class="api-item-meta">
              <span class="branch-badge">${this.esc(run.branch)}</span>
              <span class="api-item-time">${this.timeAgo(run.createdAt)}</span>
            </div>
            <div class="api-item-commit">${this.esc(run.commitMessage)}</div>
            ${jobsHtml}
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

    this.container.querySelectorAll('.run-expand').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const runId = parseInt(el.dataset.runId, 10);
        if (this.expandedRuns.has(runId)) {
          this.expandedRuns.delete(runId);
        } else {
          this.expandedRuns.add(runId);
          if (!this.jobsCache[runId]) {
            this.fetchJobs(runId).then(() => this.fetchData());
            return;
          }
        }
        this.fetchData();
      });
    });
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
      <a href="#" class="api-panel-link" onclick="window.open('${this.escAttr(this.url)}', 'github_actions'); return false;">
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

  runStatusClass(item) {
    if (item.status === 'in_progress' || item.status === 'queued') return 'status-running';
    if (item.conclusion === 'success') return 'status-success';
    if (item.conclusion === 'failure') return 'status-failure';
    if (item.conclusion === 'skipped') return 'status-neutral';
    return 'status-neutral';
  }

  runStatusIcon(item) {
    if (item.status === 'in_progress' || item.status === 'queued') return '●';
    if (item.conclusion === 'success') return '✓';
    if (item.conclusion === 'failure') return '✗';
    if (item.conclusion === 'skipped') return '−';
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
