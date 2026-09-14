const TICKET_TEMPLATES = [
  {
    id: 'add-network-service',
    name: 'Add Network Service',
    fields: [
      { id: 'vlan_id', label: 'VLAN ID', placeholder: 'e.g., 100', required: true },
      { id: 'vlan_name', label: 'VLAN Name', placeholder: 'e.g., Web-Frontend', required: true },
      { id: 'subnet', label: 'Subnet', placeholder: 'e.g., 10.1.100.0/24', required: true },
    ],
  },
];

document.addEventListener('DOMContentLoaded', () => {
  const theme = localStorage.getItem('theme') || 'dark';
  if (theme === 'light') document.body.classList.add('light-theme');

  const container = document.getElementById('ticket-container');
  let selectedTemplate = TICKET_TEMPLATES[0];

  function render() {
    const optionsHtml = TICKET_TEMPLATES.map(t =>
      `<option value="${t.id}" ${t.id === selectedTemplate.id ? 'selected' : ''}>${t.name}</option>`
    ).join('');

    const fieldsHtml = selectedTemplate.fields.map(f =>
      `<label class="config-label">${f.label}</label>
       <input type="text" class="config-input" id="field-${f.id}" placeholder="${f.placeholder}" ${f.required ? 'required' : ''}>`
    ).join('');

    container.innerHTML = `
      <div class="ticket-title">Create Ticket</div>
      <span class="ticket-type-label">Change Request</span>

      <div class="ticket-fields">
        <label class="config-label">Template</label>
        <select class="config-input" id="ticket-template">${optionsHtml}</select>

        ${fieldsHtml}
      </div>

      <div class="ticket-status hidden" id="ticket-status"></div>

      <div class="ticket-actions">
        <button class="btn btn-disconnect" id="ticket-cancel">Cancel</button>
        <button class="btn btn-connect" id="ticket-submit">Submit</button>
      </div>
    `;

    document.getElementById('ticket-template').addEventListener('change', (e) => {
      selectedTemplate = TICKET_TEMPLATES.find(t => t.id === e.target.value) || TICKET_TEMPLATES[0];
      render();
    });

    document.getElementById('ticket-cancel').addEventListener('click', () => window.close());
    document.getElementById('ticket-submit').addEventListener('click', submit);
  }

  function showStatus(message, type) {
    const el = document.getElementById('ticket-status');
    el.textContent = message;
    el.className = 'ticket-status ' + type;
  }

  async function submit() {
    const githubUrl = localStorage.getItem('github_url');
    const githubToken = localStorage.getItem('github_token');

    if (!githubToken) {
      showStatus('GitHub PAT required to create changes', 'error');
      return;
    }
    if (!githubUrl) {
      showStatus('GitHub URL not configured for this demo', 'error');
      return;
    }

    const fields = {};
    for (const f of selectedTemplate.fields) {
      const val = document.getElementById(`field-${f.id}`).value.trim();
      if (f.required && !val) {
        showStatus(`${f.label} is required`, 'error');
        document.getElementById(`field-${f.id}`).focus();
        return;
      }
      fields[f.id] = val;
    }

    const submitBtn = document.getElementById('ticket-submit');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Creating PR…';

    try {
      const res = await fetch('/api/github/create-change', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: githubUrl,
          token: githubToken,
          vlan_id: fields.vlan_id,
          vlan_name: fields.vlan_name,
          subnet: fields.subnet,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create change');

      const el = document.getElementById('ticket-status');
      const link = document.createElement('a');
      link.href = data.pr_url;
      link.target = '_blank';
      link.style.cssText = 'color: var(--success); text-decoration: underline;';
      link.textContent = 'View PR';
      el.textContent = 'PR created successfully! ';
      el.appendChild(link);
      el.className = 'ticket-status success';

      document.getElementById('ticket-cancel').textContent = 'Close';
      submitBtn.style.display = 'none';
    } catch (err) {
      showStatus(err.message, 'error');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Submit';
    }
  }

  render();
});
