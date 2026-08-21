class CloudVisionPanel {
  constructor(container, envKey) {
    this.container = container;
    this.envKey = envKey;
    this.connected = false;
    this.url = '';
    this.token = '';
    this.onStatusChange = null;
    this.onConnect = null;
    this.onDisconnect = null;
    this.refreshInterval = null;
    this.expandedCCs = new Set();
    this.manuallyCollapsed = new Set();
    this.showForm();
  }

  showForm() {
    const savedUrl = localStorage.getItem(`cv_url_${this.envKey}`) || '';
    const savedToken = localStorage.getItem(`cv_token_${this.envKey}`) || '';

    this.container.innerHTML = `
      <div class="config-form">
        <div class="config-form-inner">
          <label class="config-label">CloudVision URL</label>
          <input type="text" class="config-input" id="cv-url-${this.envKey}" placeholder="https://your-cv-instance.example.com" value="${this.escAttr(savedUrl)}">
          <label class="config-label">CloudVision API Key</label>
          <input type="password" class="config-input" id="cv-token-${this.envKey}" placeholder="Service account token (optional for demo data)">
          <div class="config-hint">Leave API Key empty to use demo data</div>
        </div>
      </div>`;

    const tokenInput = this.container.querySelector(`#cv-token-${this.envKey}`);
    if (savedToken) tokenInput.value = savedToken;
  }

  connect() {
    const urlInput = this.container.querySelector(`#cv-url-${this.envKey}`);
    const tokenInput = this.container.querySelector(`#cv-token-${this.envKey}`);
    if (!urlInput) return;

    this.url = urlInput.value.trim();
    this.token = tokenInput.value.trim();

    localStorage.setItem(`cv_url_${this.envKey}`, this.url);
    localStorage.setItem(`cv_token_${this.envKey}`, this.token);

    this.connected = true;
    this.expandedCCs.clear();
    this.showLoading();
    this.fetchData();
    this.refreshInterval = setInterval(() => this.fetchData(), 10000);

    if (this.onConnect) this.onConnect();
  }

  disconnect() {
    this.connected = false;
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
    this.expandedCCs.clear();
    if (this.onStatusChange) this.onStatusChange('idle');
    if (this.onDisconnect) this.onDisconnect();
    this.showForm();
  }

  showLoading() {
    this.container.innerHTML = `
      <div class="api-panel">
        <div class="api-panel-list">
          <div class="api-panel-placeholder">
            <div class="api-panel-placeholder-icon">⟳</div>
            <div class="api-panel-placeholder-text">Loading change controls…</div>
          </div>
        </div>
        ${this.footerHtml()}
      </div>`;
  }

  async fetchData() {
    try {
      const res = await fetch('/api/cloudvision/changecontrols', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: this.url, token: this.token }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (this.connected) {
        // Auto-expand running/in-progress CCs and the latest
        if (data.changeControls.length > 0 && !this.manuallyCollapsed.has(data.changeControls[0].id)) {
          this.expandedCCs.add(data.changeControls[0].id);
        }
        data.changeControls.forEach(cc => {
          if (cc.status === 'RUNNING' && !this.manuallyCollapsed.has(cc.id)) {
            this.expandedCCs.add(cc.id);
          }
        });

        this.renderChangeControls(data.changeControls, data.mock);
        this.updateStatus(data.changeControls);
      }
    } catch (err) {
      if (this.connected) {
        this.renderError(err.message);
        if (this.onStatusChange) this.onStatusChange('error');
      }
    }
  }

  renderChangeControls(ccs, isMock) {
    const items = ccs.map((cc, i) => {
      const statusClass = this.ccStatusClass(cc);
      const statusLabel = this.ccStatusLabel(cc);
      const approvalClass = this.approvalClass(cc);
      const approvalLabel = this.approvalLabel(cc);
      const isExpanded = this.expandedCCs.has(cc.id);
      const hasStages = cc.stages && cc.stages.length > 0;

      let stagesHtml = '';
      if (isExpanded && hasStages) {
        const nonRootStages = cc.stages.filter(s => s.id !== 'root' && s.name !== 'Root');
        if (nonRootStages.length > 0) {
          const stageItems = nonRootStages.map(stage => {
            const sClass = this.stageStatusClass(stage);
            const sIcon = this.stageStatusIcon(stage);
            const stepsHtml = (stage.steps || []).map(step => {
              const stepClass = this.stepStatusClass(step);
              const stepIcon = this.stepStatusIcon(step);
              return `<div class="step-item">
                <span class="step-icon ${stepClass}">${stepIcon}</span>
                <span class="step-name">${this.esc(step.name)}</span>
              </div>`;
            }).join('');
            return `<div class="job-item">
              <div class="job-header">
                <span class="job-icon ${sClass}">${sIcon}</span>
                <span class="job-name">${this.esc(stage.name)}</span>
              </div>
              ${stepsHtml ? `<div class="job-steps">${stepsHtml}</div>` : ''}
            </div>`;
          }).join('');
          stagesHtml = `<div class="run-jobs">${stageItems}</div>`;
        }
      }

      const expandToggle = hasStages
        ? `<span class="run-expand" data-cc-id="${this.escAttr(cc.id)}">${isExpanded ? '⊖' : '⊕'}</span> `
        : '';

      return `
        <div class="api-item ${i === 0 ? 'api-item-latest' : ''}">
          <div class="api-item-icon ${statusClass}">${this.ccStatusIcon(cc)}</div>
          <div class="api-item-details">
            <div class="api-item-name">${expandToggle}${this.esc(cc.name)}</div>
            <div class="api-item-meta">
              <span class="cc-status-badge ${statusClass}">${statusLabel}</span>
              <span class="cc-approval-badge ${approvalClass}">${approvalLabel}</span>
            </div>
            <div class="api-item-commit">
              ${this.esc(cc.createdBy)} · ${this.timeAgo(cc.createdAt)}
            </div>
            ${stagesHtml}
          </div>
        </div>`;
    }).join('');

    const mockBadge = isMock ? '<span class="demo-badge">Demo Data</span>' : '';

    this.container.innerHTML = `
      <div class="api-panel">
        <div class="api-panel-list">
          ${mockBadge}
          ${items || '<div class="api-panel-placeholder"><div class="api-panel-placeholder-text">No change controls found</div></div>'}
        </div>
        ${this.footerHtml()}
      </div>`;

    this.container.querySelectorAll('.run-expand').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const ccId = el.dataset.ccId;
        if (this.expandedCCs.has(ccId)) {
          this.expandedCCs.delete(ccId);
          this.manuallyCollapsed.add(ccId);
        } else {
          this.expandedCCs.add(ccId);
          this.manuallyCollapsed.delete(ccId);
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
            <div class="api-panel-placeholder-text">Failed to load change controls</div>
            <div class="api-panel-error-detail">${this.esc(message)}</div>
          </div>
        </div>
        ${this.footerHtml()}
      </div>`;
  }

  footerHtml() {
    if (!this.url) return '';
    return `<div class="api-panel-footer">
      <a href="#" class="api-panel-link" onclick="window.open('${this.escAttr(this.url)}', 'cv_${this.envKey}'); return false;">
        Open CloudVision <span class="link-arrow">↗</span>
      </a>
    </div>`;
  }

  updateStatus(ccs) {
    if (!this.onStatusChange || !ccs.length) return;
    const hasRunning = ccs.some(cc => cc.status === 'RUNNING');
    const hasPending = ccs.some(cc => cc.status === 'NOT_STARTED' && cc.approvalStatus === 'PENDING');
    if (hasRunning) {
      this.onStatusChange('active');
    } else if (hasPending) {
      this.onStatusChange('warning');
    } else {
      this.onStatusChange('connected');
    }
  }

  ccStatusClass(cc) {
    switch (cc.status) {
      case 'COMPLETED': return 'status-success';
      case 'RUNNING': return 'status-running';
      case 'NOT_STARTED': return cc.approvalStatus === 'PENDING' ? 'status-warning' : 'status-neutral';
      case 'SCHEDULED': return 'status-neutral';
      default: return 'status-neutral';
    }
  }

  ccStatusIcon(cc) {
    switch (cc.status) {
      case 'COMPLETED': return '✓';
      case 'RUNNING': return '●';
      case 'NOT_STARTED': return '○';
      case 'SCHEDULED': return '◷';
      default: return '○';
    }
  }

  ccStatusLabel(cc) {
    switch (cc.status) {
      case 'COMPLETED': return 'Completed';
      case 'RUNNING': return 'Running';
      case 'NOT_STARTED': return 'Not Started';
      case 'SCHEDULED': return 'Scheduled';
      default: return cc.status || 'Unknown';
    }
  }

  approvalClass(cc) {
    return cc.approvalStatus === 'APPROVED' ? 'approval-approved' : 'approval-pending';
  }

  approvalLabel(cc) {
    return cc.approvalStatus === 'APPROVED' ? 'Approved' : 'Awaiting';
  }

  stageStatusClass(stage) {
    switch (stage.status) {
      case 'COMPLETED': return 'status-success';
      case 'RUNNING': return 'status-running';
      case 'NOT_STARTED': return 'status-neutral';
      default: return 'status-neutral';
    }
  }

  stageStatusIcon(stage) {
    switch (stage.status) {
      case 'COMPLETED': return stage.error ? '✗' : '✓';
      case 'RUNNING': return '●';
      case 'NOT_STARTED': return '○';
      default: return '○';
    }
  }

  stepStatusClass(step) {
    switch (step.status) {
      case 'FINISHED': return step.error ? 'status-failure' : 'status-success';
      case 'RUNNING': return 'status-running';
      case 'FAILED': return 'status-failure';
      case 'SKIPPED': return 'status-neutral';
      case 'NOT_STARTED': return 'status-neutral';
      default: return 'status-neutral';
    }
  }

  stepStatusIcon(step) {
    switch (step.status) {
      case 'FINISHED': return step.error ? '✗' : '✓';
      case 'RUNNING': return '●';
      case 'FAILED': return '✗';
      case 'SKIPPED': return '−';
      case 'NOT_STARTED': return '○';
      default: return '○';
    }
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
