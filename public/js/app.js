document.addEventListener('DOMContentLoaded', async () => {
  const dashboard = document.getElementById('dashboard');

  const toggle = document.getElementById('theme-toggle');
  const iconSun = document.getElementById('theme-icon-sun');
  const iconMoon = document.getElementById('theme-icon-moon');
  const themeLabel = document.getElementById('theme-label');

  function applyTheme(theme) {
    const isLight = theme === 'light';
    document.body.classList.toggle('light-theme', isLight);
    iconSun.classList.toggle('hidden', isLight);
    iconMoon.classList.toggle('hidden', !isLight);
    themeLabel.textContent = isLight ? 'Dark Mode' : 'Light Mode';
    localStorage.setItem('theme', theme);
  }

  applyTheme(localStorage.getItem('theme') || 'dark');

  toggle.addEventListener('click', () => {
    applyTheme(document.body.classList.contains('light-theme') ? 'dark' : 'light');
  });

  let demoConfig = null;
  const params = new URLSearchParams(window.location.search);
  const demoId = params.get('id');
  if (demoId) {
    try {
      const demos = JSON.parse(localStorage.getItem('demos')) || [];
      demoConfig = demos.find(d => d.id === demoId) || null;
    } catch {}
  }

  let config;
  try {
    const res = await fetch('/api/config');
    config = await res.json();
  } catch (err) {
    dashboard.innerHTML = `<div style="padding:40px;text-align:center;color:var(--text-secondary)">
      Failed to load configuration. Is the server running?<br>
      <code style="color:var(--error)">${err.message}</code>
    </div>`;
    return;
  }

  const githubEnabled = demoConfig ? !!demoConfig.github_enabled : true;
  const enabledEnvs = {};
  for (const envKey of Object.keys(config.environments)) {
    enabledEnvs[envKey] = demoConfig ? !!demoConfig[`${envKey}_enabled`] : true;
  }

  if (demoConfig) {
    if (githubEnabled) {
      localStorage.setItem('github_url', demoConfig.github_url || '');
      localStorage.setItem('github_token', demoConfig.github_token || '');
    }
    for (const envKey of Object.keys(config.environments)) {
      if (!enabledEnvs[envKey]) continue;
      localStorage.setItem(`cv_url_${envKey}`, demoConfig[`${envKey}_cv_url`] || '');
      localStorage.setItem(`cv_token_${envKey}`, demoConfig[`${envKey}_cv_token`] || '');
      localStorage.setItem(`act_enabled_${envKey}`, demoConfig[`${envKey}_act_enabled`] ? 'true' : 'false');
      localStorage.setItem(`act_url_${envKey}`, demoConfig[`${envKey}_act_url`] || '');
      localStorage.setItem(`act_user_${envKey}`, demoConfig[`${envKey}_act_user`] || '');
      localStorage.setItem(`act_token_${envKey}`, demoConfig[`${envKey}_act_token`] || '');
      localStorage.setItem(`act_lab_${envKey}`, demoConfig[`${envKey}_act_lab`] || '');
      localStorage.setItem(`ssh_username_${envKey}`, demoConfig[`${envKey}_ssh_username`] || '');
      localStorage.setItem(`ssh_password_${envKey}`, demoConfig[`${envKey}_ssh_password`] || '');
    }
  }

  let ghPanel = null, ghConnectBtn = null, ghDisconnectBtn = null;

  if (githubEnabled) {
    const sidebar = document.createElement('div');
    sidebar.className = 'github-sidebar';

    const ghPane = document.createElement('div');
    ghPane.className = 'pane';
    ghPane.id = 'pane-github';

    const ghHeader = document.createElement('div');
    ghHeader.className = 'pane-header';

    const ghTitleArea = document.createElement('div');
    const ghTitleRow = document.createElement('div');
    ghTitleRow.className = 'pane-title';
    const ghDot = document.createElement('span');
    ghDot.className = 'status-dot';
    ghDot.id = 'status-github';
    ghTitleRow.appendChild(ghDot);
    const ghTitle = document.createElement('span');
    ghTitle.textContent = 'GitHub Actions';
    ghTitleRow.appendChild(ghTitle);
    ghTitleArea.appendChild(ghTitleRow);
    const ghStep = document.createElement('div');
    ghStep.className = 'pane-step';
    ghStep.textContent = 'CI Pipeline';
    ghTitleArea.appendChild(ghStep);
    ghHeader.appendChild(ghTitleArea);

    const ghActions = document.createElement('div');
    ghActions.className = 'pane-actions';
    ghConnectBtn = document.createElement('button');
    ghConnectBtn.className = 'btn btn-connect';
    ghConnectBtn.textContent = 'Connect';
    ghDisconnectBtn = document.createElement('button');
    ghDisconnectBtn.className = 'btn btn-disconnect';
    ghDisconnectBtn.textContent = 'Disconnect';
    ghDisconnectBtn.style.display = 'none';
    ghActions.appendChild(ghConnectBtn);
    ghActions.appendChild(ghDisconnectBtn);
    ghHeader.appendChild(ghActions);

    const ghContent = document.createElement('div');
    ghContent.className = 'pane-content';

    ghPanel = new GitHubPanel(ghContent);
    ghPanel.onStatusChange = (status) => {
      const dot = document.getElementById('status-github');
      const paneEl = document.getElementById('pane-github');
      dot.className = 'status-dot';
      paneEl.className = 'pane';
      if (status === 'connected') { dot.classList.add('connected'); paneEl.classList.add('connected'); }
      else if (status === 'active') { dot.classList.add('active'); }
      else if (status === 'error') { dot.classList.add('error'); paneEl.classList.add('error'); }
    };

    ghConnectBtn.addEventListener('click', () => {
      ghPanel.connect();
      ghConnectBtn.style.display = 'none';
      ghDisconnectBtn.style.display = '';
    });
    ghDisconnectBtn.addEventListener('click', () => {
      ghPanel.disconnect();
      ghConnectBtn.style.display = '';
      ghDisconnectBtn.style.display = 'none';
    });

    ghPane.appendChild(ghHeader);
    ghPane.appendChild(ghContent);
    sidebar.appendChild(ghPane);
    dashboard.appendChild(sidebar);
  }

  const envArea = document.createElement('div');
  envArea.className = 'env-area';

  const stepLabels = [
    { key: 'cloudvision', label: 'CloudVision', step: 'Change Control' },
    { key: 'device0', label: null, step: '' },
    { key: 'device1', label: null, step: '' },
  ];

  const cvPanels = {};

  for (const [envKey, env] of Object.entries(config.environments)) {
    if (!enabledEnvs[envKey]) continue;

    const row = document.createElement('div');
    row.className = 'env-row';

    const label = document.createElement('div');
    label.className = 'env-label';
    label.textContent = env.label;
    row.appendChild(label);

    const panes = document.createElement('div');
    panes.className = 'env-panes';

    const termManagers = [];

    for (let i = 0; i < stepLabels.length; i++) {
      const step = stepLabels[i];
      const pane = document.createElement('div');
      pane.className = 'pane';
      pane.id = `pane-${envKey}-${step.key}`;

      const header = document.createElement('div');
      header.className = 'pane-header';

      const titleArea = document.createElement('div');
      const titleRow = document.createElement('div');
      titleRow.className = 'pane-title';
      const statusDot = document.createElement('span');
      statusDot.className = 'status-dot';
      statusDot.id = `status-${envKey}-${step.key}`;
      titleRow.appendChild(statusDot);
      const titleText = document.createElement('span');
      titleRow.appendChild(titleText);
      titleArea.appendChild(titleRow);
      const stepLabel = document.createElement('div');
      stepLabel.className = 'pane-step';
      stepLabel.textContent = step.step;
      titleArea.appendChild(stepLabel);
      header.appendChild(titleArea);

      const actions = document.createElement('div');
      actions.className = 'pane-actions';

      const content = document.createElement('div');
      content.className = 'pane-content';

      function updatePaneStatus(status) {
        const dot = document.getElementById(`status-${envKey}-${step.key}`);
        const paneEl = document.getElementById(`pane-${envKey}-${step.key}`);
        dot.className = 'status-dot';
        paneEl.className = 'pane';
        if (status === 'connected') { dot.classList.add('connected'); paneEl.classList.add('connected'); }
        else if (status === 'active') { dot.classList.add('active'); }
        else if (status === 'error') { dot.classList.add('error'); paneEl.classList.add('error'); }
      }

      if (step.key === 'cloudvision') {
        titleText.textContent = 'CloudVision';
        const panel = new CloudVisionPanel(content, envKey);
        panel.onStatusChange = updatePaneStatus;
        panel.onConnect = () => { termManagers.forEach(tm => tm.refreshDevices()); };
        panel.onDisconnect = () => { termManagers.forEach(tm => tm.resetDevices()); };
        cvPanels[envKey] = panel;

        const connectBtn = document.createElement('button');
        connectBtn.className = 'btn btn-connect';
        connectBtn.textContent = 'Connect';
        connectBtn.id = `cv-connect-${envKey}`;
        const disconnectBtn = document.createElement('button');
        disconnectBtn.className = 'btn btn-disconnect';
        disconnectBtn.textContent = 'Disconnect';
        disconnectBtn.id = `cv-disconnect-${envKey}`;
        disconnectBtn.style.display = 'none';

        connectBtn.addEventListener('click', () => {
          panel.connect();
          connectBtn.style.display = 'none';
          disconnectBtn.style.display = '';
        });
        disconnectBtn.addEventListener('click', () => {
          panel.disconnect();
          connectBtn.style.display = '';
          disconnectBtn.style.display = 'none';
        });
        actions.appendChild(connectBtn);
        actions.appendChild(disconnectBtn);

      } else {
        titleText.textContent = 'Select Device';

        const connectBtn = document.createElement('button');
        connectBtn.className = 'btn btn-connect';
        connectBtn.textContent = 'Connect';
        const disconnectBtn = document.createElement('button');
        disconnectBtn.className = 'btn btn-disconnect';
        disconnectBtn.textContent = 'Disconnect';
        disconnectBtn.style.display = 'none';

        const termMgr = new TerminalManager(content, envKey);
        termManagers.push(termMgr);

        termMgr.onDeviceChange = (hostname) => { titleText.textContent = hostname; };
        termMgr.onStatusChange = (status) => {
          updatePaneStatus(status);
          if (status === 'connected') {
            connectBtn.style.display = 'none';
            disconnectBtn.style.display = '';
          } else {
            connectBtn.style.display = '';
            disconnectBtn.style.display = 'none';
          }
        };

        connectBtn.addEventListener('click', () => termMgr.connect());
        disconnectBtn.addEventListener('click', () => termMgr.disconnect());
        actions.appendChild(connectBtn);
        actions.appendChild(disconnectBtn);
      }

      header.appendChild(actions);
      pane.appendChild(header);
      pane.appendChild(content);
      panes.appendChild(pane);
    }

    row.appendChild(panes);
    envArea.appendChild(row);
  }

  if (envArea.children.length > 0) {
    dashboard.appendChild(envArea);
  }

  // Auto-connect if launched from a demo config
  if (demoConfig) {
    setTimeout(() => {
      if (ghPanel && githubEnabled) {
        ghPanel.connect();
        ghConnectBtn.style.display = 'none';
        ghDisconnectBtn.style.display = '';
      }

      for (const envKey of Object.keys(config.environments)) {
        if (!enabledEnvs[envKey]) continue;
        const panel = cvPanels[envKey];
        if (panel) {
          panel.connect();
          const cb = document.getElementById(`cv-connect-${envKey}`);
          const db = document.getElementById(`cv-disconnect-${envKey}`);
          if (cb) cb.style.display = 'none';
          if (db) db.style.display = '';
        }
      }
    }, 100);
  }

  // ACT Lab Status indicator
  const actEnabled = localStorage.getItem('act_enabled_dev');
  if (actEnabled === 'true' && enabledEnvs.dev) {
    const actStatusEl = document.getElementById('act-status');
    const actDivider = document.getElementById('act-divider');
    const actDot = document.getElementById('act-status-dot');
    const actLabel = document.getElementById('act-status-label');

    actStatusEl.classList.remove('hidden');
    actDivider.classList.remove('hidden');
    actLabel.textContent = 'Checking…';

    async function checkActStatus() {
      try {
        const res = await fetch('/api/act/lab-status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            actUrl: localStorage.getItem('act_url_dev') || '',
            apiKey: localStorage.getItem('act_token_dev') || '',
            labName: localStorage.getItem('act_lab_dev') || '',
            username: localStorage.getItem('act_user_dev') || '',
          }),
        });
        if (!res.ok) throw new Error('API error');
        const data = await res.json();
        actDot.className = 'act-status-dot ' + (data.status === 'running' ? 'running' : 'stopped');
        actLabel.textContent = data.label || 'Unknown';
      } catch {
        actDot.className = 'act-status-dot stopped';
        actLabel.textContent = 'Error';
      }
    }

    checkActStatus();
    setInterval(checkActStatus, 30000);
  }
});
