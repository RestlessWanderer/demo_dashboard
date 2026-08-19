document.addEventListener('DOMContentLoaded', async () => {
  const dashboard = document.getElementById('dashboard');

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
    { key: 'device0', label: null, step: 'Step 3 · Config Verification' },
    { key: 'device1', label: null, step: 'Step 4 · Config Verification' },
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

      if (step.key === 'actions') {
        titleText.textContent = 'GitHub Actions';
        const openBtn = document.createElement('button');
        openBtn.className = 'btn btn-open';
        openBtn.textContent = 'Open';
        openBtn.addEventListener('click', () => {
          window.open(env.github_actions_url, `actions_${envKey}`);
        });
        actions.appendChild(openBtn);

        const mgr = new IframeManager(content, env.github_actions_url, 'GitHub Actions');
        window._iframeManagers[`GitHub Actions_${env.github_actions_url}`] = mgr;
      } else if (step.key === 'cloudvision') {
        titleText.textContent = 'CloudVision';
        const openBtn = document.createElement('button');
        openBtn.className = 'btn btn-open';
        openBtn.textContent = 'Open';
        openBtn.addEventListener('click', () => {
          window.open(env.cloudvision_url, `cv_${envKey}`);
        });
        actions.appendChild(openBtn);

        const mgr = new IframeManager(content, env.cloudvision_url, 'CloudVision');
        window._iframeManagers[`CloudVision_${env.cloudvision_url}`] = mgr;
      } else {
        const devIdx = step.key === 'device0' ? 0 : 1;
        const deviceName = env.devices[devIdx]?.name || `Device ${devIdx + 1}`;
        titleText.textContent = deviceName;

        const connectBtn = document.createElement('button');
        connectBtn.className = 'btn btn-connect';
        connectBtn.textContent = 'Connect';

        const disconnectBtn = document.createElement('button');
        disconnectBtn.className = 'btn btn-disconnect';
        disconnectBtn.textContent = 'Disconnect';
        disconnectBtn.style.display = 'none';

        const termMgr = new TerminalManager(content, envKey, devIdx, deviceName);

        termMgr.onStatusChange = (status) => {
          const dot = document.getElementById(`status-${envKey}-${step.key}`);
          const paneEl = document.getElementById(`pane-${envKey}-${step.key}`);

          dot.className = 'status-dot';
          paneEl.className = 'pane';

          if (status === 'connected') {
            dot.classList.add('connected');
            paneEl.classList.add('connected');
            connectBtn.style.display = 'none';
            disconnectBtn.style.display = '';
          } else if (status === 'error') {
            dot.classList.add('error');
            paneEl.classList.add('error');
            connectBtn.style.display = '';
            disconnectBtn.style.display = 'none';
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
