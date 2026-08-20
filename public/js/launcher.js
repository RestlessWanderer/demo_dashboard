document.addEventListener('DOMContentLoaded', () => {
  const launcher = document.getElementById('launcher');
  const overlay = document.getElementById('modal-overlay');
  const modalTitle = document.getElementById('modal-title');
  const saveBtn = document.getElementById('modal-save');
  const cancelBtn = document.getElementById('modal-cancel');

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

  let editingId = null;

  function getDemos() {
    try { return JSON.parse(localStorage.getItem('demos')) || []; }
    catch { return []; }
  }

  function saveDemos(demos) {
    localStorage.setItem('demos', JSON.stringify(demos));
  }

  function generateId() {
    return 'demo-' + Date.now().toString(36) + '-' + Math.random().toString(36).substr(2, 6);
  }

  function esc(str) {
    const d = document.createElement('div');
    d.textContent = str || '';
    return d.innerHTML;
  }

  function renderGrid() {
    const demos = getDemos();
    let html = '';

    for (const demo of demos) {
      html += `
        <div class="demo-tile">
          <div class="demo-tile-name">${esc(demo.name)}</div>
          <div class="demo-tile-info">
            ${demo.github_url ? '<span class="demo-tile-badge">GitHub</span>' : ''}
            ${demo.dev_cv_url ? '<span class="demo-tile-badge">Dev CV</span>' : ''}
            ${demo.prod_cv_url ? '<span class="demo-tile-badge">Prod CV</span>' : ''}
          </div>
          <div class="demo-tile-actions">
            <button class="btn btn-open" onclick="launchDemo('${demo.id}')">Launch</button>
            <button class="btn" onclick="editDemo('${demo.id}')">Edit</button>
            <button class="btn btn-disconnect" onclick="deleteDemo('${demo.id}')">Delete</button>
          </div>
        </div>`;
    }

    html += `
      <div class="demo-tile add-tile" onclick="openAddModal()">
        <div class="add-tile-icon">+</div>
        <div class="add-tile-text">Add Demo</div>
      </div>`;

    launcher.innerHTML = html;
  }

  function openModal(demo) {
    editingId = demo ? demo.id : null;
    modalTitle.textContent = demo ? 'Edit Demo' : 'Add Demo';

    document.getElementById('demo-name').value = demo?.name || '';
    document.getElementById('demo-github-url').value = demo?.github_url || '';
    document.getElementById('demo-github-token').value = demo?.github_token || '';
    document.getElementById('demo-dev-cv-url').value = demo?.dev_cv_url || '';
    document.getElementById('demo-dev-cv-token').value = demo?.dev_cv_token || '';
    document.getElementById('demo-prod-cv-url').value = demo?.prod_cv_url || '';
    document.getElementById('demo-prod-cv-token').value = demo?.prod_cv_token || '';
    document.getElementById('demo-ssh-user').value = demo?.ssh_username || '';
    document.getElementById('demo-ssh-pass').value = demo?.ssh_password || '';

    const actCheckbox = document.getElementById('demo-dev-act-enabled');
    const actFields = document.getElementById('demo-dev-act-fields');
    actCheckbox.checked = !!demo?.dev_act_enabled;
    actFields.classList.toggle('hidden', !actCheckbox.checked);
    document.getElementById('demo-dev-act-url').value = demo?.dev_act_url || '';
    document.getElementById('demo-dev-act-user').value = demo?.dev_act_user || '';
    document.getElementById('demo-dev-act-token').value = demo?.dev_act_token || '';
    document.getElementById('demo-dev-act-lab').value = demo?.dev_act_lab || '';

    overlay.classList.remove('hidden');
  }

  function closeModal() {
    overlay.classList.add('hidden');
    editingId = null;
  }

  function saveModal() {
    const name = document.getElementById('demo-name').value.trim();
    if (!name) {
      document.getElementById('demo-name').focus();
      return;
    }

    const demo = {
      id: editingId || generateId(),
      name,
      github_url: document.getElementById('demo-github-url').value.trim(),
      github_token: document.getElementById('demo-github-token').value.trim(),
      dev_cv_url: document.getElementById('demo-dev-cv-url').value.trim(),
      dev_cv_token: document.getElementById('demo-dev-cv-token').value.trim(),
      prod_cv_url: document.getElementById('demo-prod-cv-url').value.trim(),
      prod_cv_token: document.getElementById('demo-prod-cv-token').value.trim(),
      ssh_username: document.getElementById('demo-ssh-user').value.trim(),
      ssh_password: document.getElementById('demo-ssh-pass').value.trim(),
      dev_act_enabled: document.getElementById('demo-dev-act-enabled').checked,
      dev_act_url: document.getElementById('demo-dev-act-url').value.trim(),
      dev_act_user: document.getElementById('demo-dev-act-user').value.trim(),
      dev_act_token: document.getElementById('demo-dev-act-token').value.trim(),
      dev_act_lab: document.getElementById('demo-dev-act-lab').value.trim(),
    };

    const demos = getDemos();
    if (editingId) {
      const idx = demos.findIndex(d => d.id === editingId);
      if (idx !== -1) demos[idx] = demo;
    } else {
      demos.push(demo);
    }

    saveDemos(demos);
    closeModal();
    renderGrid();
  }

  window.openAddModal = () => openModal(null);

  window.editDemo = (id) => {
    const demo = getDemos().find(d => d.id === id);
    if (demo) openModal(demo);
  };

  window.deleteDemo = (id) => {
    const demos = getDemos();
    const demo = demos.find(d => d.id === id);
    if (demo && confirm(`Delete "${demo.name}"?`)) {
      saveDemos(demos.filter(d => d.id !== id));
      renderGrid();
    }
  };

  window.launchDemo = (id) => {
    window.location.href = `demo.html?id=${id}`;
  };

  document.getElementById('demo-dev-act-enabled').addEventListener('change', (e) => {
    document.getElementById('demo-dev-act-fields').classList.toggle('hidden', !e.target.checked);
  });

  cancelBtn.addEventListener('click', closeModal);
  saveBtn.addEventListener('click', saveModal);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeModal();
  });

  renderGrid();
});
