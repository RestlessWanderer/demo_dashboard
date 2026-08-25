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
  const sectionState = { github: false, dev: false, prod: false };

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

  function toggleSection(section, enabled) {
    sectionState[section] = enabled;
    const fields = document.getElementById(`section-${section}-fields`);
    const toggleEl = document.getElementById(`section-${section}-toggle`);
    const icon = toggleEl.querySelector('.section-toggle-icon');
    const remove = toggleEl.querySelector('.section-toggle-remove');

    fields.classList.toggle('hidden', !enabled);
    icon.textContent = enabled ? '⊖' : '⊕';
    remove.classList.toggle('hidden', !enabled);
    toggleEl.classList.toggle('section-active', enabled);
  }

  function renderGrid() {
    const demos = getDemos();
    let html = '';

    for (const demo of demos) {
      const badges = [];
      if (demo.github_enabled) badges.push('GitHub');
      if (demo.dev_enabled) badges.push('Dev CV');
      if (demo.prod_enabled) badges.push('Prod CV');
      const badgeHtml = badges.map(b => `<span class="demo-tile-badge">${b}</span>`).join('');

      html += `
        <div class="demo-tile">
          <div class="demo-tile-name">${esc(demo.name)}</div>
          <div class="demo-tile-info">${badgeHtml}</div>
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
    document.getElementById('demo-dev-ssh-user').value = demo?.dev_ssh_username || '';
    document.getElementById('demo-dev-ssh-pass').value = demo?.dev_ssh_password || '';
    document.getElementById('demo-prod-ssh-user').value = demo?.prod_ssh_username || '';
    document.getElementById('demo-prod-ssh-pass').value = demo?.prod_ssh_password || '';

    const actCheckbox = document.getElementById('demo-dev-act-enabled');
    actCheckbox.checked = !!demo?.dev_act_enabled;
    document.getElementById('demo-dev-act-fields').classList.toggle('hidden', !actCheckbox.checked);
    document.getElementById('demo-dev-act-url').value = demo?.dev_act_url || '';
    document.getElementById('demo-dev-act-user').value = demo?.dev_act_user || '';
    document.getElementById('demo-dev-act-token').value = demo?.dev_act_token || '';
    document.getElementById('demo-dev-act-lab').value = demo?.dev_act_lab || '';

    toggleSection('github', !!demo?.github_enabled);
    toggleSection('dev', !!demo?.dev_enabled);
    toggleSection('prod', !!demo?.prod_enabled);

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
      github_enabled: sectionState.github,
      github_url: document.getElementById('demo-github-url').value.trim(),
      github_token: document.getElementById('demo-github-token').value.trim(),
      dev_enabled: sectionState.dev,
      dev_cv_url: document.getElementById('demo-dev-cv-url').value.trim(),
      dev_cv_token: document.getElementById('demo-dev-cv-token').value.trim(),
      dev_ssh_username: document.getElementById('demo-dev-ssh-user').value.trim(),
      dev_ssh_password: document.getElementById('demo-dev-ssh-pass').value.trim(),
      dev_act_enabled: document.getElementById('demo-dev-act-enabled').checked,
      dev_act_url: document.getElementById('demo-dev-act-url').value.trim(),
      dev_act_user: document.getElementById('demo-dev-act-user').value.trim(),
      dev_act_token: document.getElementById('demo-dev-act-token').value.trim(),
      dev_act_lab: document.getElementById('demo-dev-act-lab').value.trim(),
      prod_enabled: sectionState.prod,
      prod_cv_url: document.getElementById('demo-prod-cv-url').value.trim(),
      prod_cv_token: document.getElementById('demo-prod-cv-token').value.trim(),
      prod_ssh_username: document.getElementById('demo-prod-ssh-user').value.trim(),
      prod_ssh_password: document.getElementById('demo-prod-ssh-pass').value.trim(),
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

  document.querySelectorAll('.section-toggle').forEach(el => {
    el.addEventListener('click', (e) => {
      if (e.target.classList.contains('section-toggle-remove')) {
        toggleSection(el.dataset.section, false);
      } else if (!sectionState[el.dataset.section]) {
        toggleSection(el.dataset.section, true);
      }
    });
  });

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
