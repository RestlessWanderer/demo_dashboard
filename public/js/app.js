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
    const next = document.body.classList.contains('light-theme') ? 'dark' : 'light';
    applyTheme(next);
  });

  const sshUser = document.getElementById('ssh-username');
  const sshPass = document.getElementById('ssh-password');
  sshUser.value = localStorage.getItem('ssh_username') || '';
  sshPass.value = localStorage.getItem('ssh_password') || '';
  sshUser.addEventListener('input', () => localStorage.setItem('ssh_username', sshUser.value));
  sshPass.addEventListener('input', () => localStorage.setItem('ssh_password', sshPass.value));

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

  const stepLabels = [
    { key: 'actions', label: 'GitHub Actions', step: 'Step 1 · CI Pipeline' },
    { key: 'cloudvision', label: 'CloudVision', step: 'Step 2 · Change Control' },
    { key: 'device0', label: null, step: '' },
    { key: 'device1', label: null, step: '' },
  ];

  for (const [envKey, env] of Object.entries(config.environments)) {
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

      if (step.key === 'actions') {
        titleText.textContent = 'GitHub Actions';
        const panel = new GitHubPanel(content, envKey);
        panel.onStatusChange = updatePaneStatus;

        const connectBtn = document.createElement('button');
        connectBtn.className = 'btn btn-connect';
        connectBtn.textContent = 'Connect';
        const disconnectBtn = document.createElement('button');
        disconnectBtn.className = 'btn btn-disconnect';
        disconnectBtn.textContent = 'Disconnect';
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

      } else if (step.key === 'cloudvision') {
        titleText.textContent = 'CloudVision';
        const panel = new CloudVisionPanel(content, envKey);
        panel.onStatusChange = updatePaneStatus;
        panel.onConnect = () => {
          termManagers.forEach(tm => tm.refreshDevices());
        };

        const connectBtn = document.createElement('button');
        connectBtn.className = 'btn btn-connect';
        connectBtn.textContent = 'Connect';
        const disconnectBtn = document.createElement('button');
        disconnectBtn.className = 'btn btn-disconnect';
        disconnectBtn.textContent = 'Disconnect';
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

        termMgr.onDeviceChange = (hostname) => {
          titleText.textContent = hostname;
        };

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
    dashboard.appendChild(row);
  }
});
