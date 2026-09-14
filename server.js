process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const express = require('express');
const http = require('http');
const { WebSocketServer } = require('ws');
const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const configPath = path.join(__dirname, 'config.yaml');
const config = yaml.load(fs.readFileSync(configPath, 'utf8'));

const app = express();
const server = http.createServer(app);

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

app.get('/api/config', (_req, res) => {
  const sanitized = { environments: {} };
  for (const [key, env] of Object.entries(config.environments)) {
    sanitized.environments[key] = { label: env.label };
  }
  res.json(sanitized);
});

function parseGitHubUrl(url) {
  try {
    const parts = new URL(url).pathname.split('/').filter(Boolean);
    if (parts.length >= 2) return { owner: parts[0], repo: parts[1] };
  } catch {}
  return null;
}

function parseSubnet(cidr) {
  const match = cidr.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)\/(\d+)$/);
  if (!match) return null;
  const octets = [+match[1], +match[2], +match[3], +match[4]];
  if (octets.some(o => o > 255)) return null;
  const prefix = +match[5];
  if (prefix > 32) return null;
  return { octets, prefix };
}

function buildSviEntry(vlanId, vlanName, subnet, existingNodes) {
  const parsed = parseSubnet(subnet);
  if (!parsed) throw new Error(`Invalid subnet: ${subnet}`);
  const { octets, prefix } = parsed;
  const base = `${octets[0]}.${octets[1]}.${octets[2]}`;

  const nodes = existingNodes.map((n, i) => ({
    node: n.node,
    ip_address: `${base}.${i + 2}/${prefix}`,
  }));

  return {
    id: Number(vlanId),
    name: vlanName,
    enabled: true,
    ip_virtual_router_addresses: [`${base}.1`],
    nodes,
  };
}

function findNetworkServicesFile(entries) {
  const match = entries.find(
    e => e.type === 'blob' && /group_vars\/.*_network_services\.yml$/.test(e.path)
  );
  return match ? match.path : null;
}

function generateMockGitHubRuns() {
  const now = Date.now();
  return [
    { id: 1001, name: 'Deploy AVD Config', status: 'completed', conclusion: 'success', branch: 'main', commitMessage: 'Update spine BGP configuration', actor: 'networkeng', createdAt: new Date(now - 15 * 60000).toISOString(), updatedAt: new Date(now - 12 * 60000).toISOString() },
    { id: 1002, name: 'Validate Network State', status: 'in_progress', conclusion: null, branch: 'feature/mlag-update', commitMessage: 'Add MLAG configuration for leaf pair', actor: 'netops', createdAt: new Date(now - 3 * 60000).toISOString(), updatedAt: new Date(now - 60000).toISOString() },
    { id: 1003, name: 'Deploy AVD Config', status: 'completed', conclusion: 'failure', branch: 'fix/acl-rules', commitMessage: 'Update ACL rules for management plane', actor: 'seceng', createdAt: new Date(now - 45 * 60000).toISOString(), updatedAt: new Date(now - 42 * 60000).toISOString() },
    { id: 1004, name: 'Generate Documentation', status: 'completed', conclusion: 'success', branch: 'main', commitMessage: 'Auto-generate fabric documentation', actor: 'networkeng', createdAt: new Date(now - 2 * 3600000).toISOString(), updatedAt: new Date(now - 2 * 3600000 + 180000).toISOString() },
    { id: 1005, name: 'Validate Network State', status: 'completed', conclusion: 'success', branch: 'main', commitMessage: 'Post-deploy validation checks', actor: 'netops', createdAt: new Date(now - 3 * 3600000).toISOString(), updatedAt: new Date(now - 3 * 3600000 + 240000).toISOString() },
  ];
}

app.post('/api/github/runs', async (req, res) => {
  const { url, token } = req.body || {};
  if (!token) return res.json({ runs: generateMockGitHubRuns(), mock: true });
  if (!url) return res.status(400).json({ error: 'URL required' });

  const repo = parseGitHubUrl(url);
  if (!repo) return res.status(400).json({ error: 'Cannot parse GitHub URL' });

  try {
    const apiRes = await fetch(
      `https://api.github.com/repos/${repo.owner}/${repo.repo}/actions/runs?per_page=10`,
      { headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' } }
    );
    if (!apiRes.ok) throw new Error(`GitHub API ${apiRes.status}`);
    const data = await apiRes.json();
    const runs = (data.workflow_runs || []).map(r => ({
      id: r.id,
      name: r.name,
      status: r.status,
      conclusion: r.conclusion,
      branch: r.head_branch,
      commitMessage: r.head_commit?.message?.split('\n')[0] || '',
      actor: r.actor?.login || '',
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      htmlUrl: r.html_url,
    }));
    res.json({ runs, mock: false });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

app.post('/api/github/jobs', async (req, res) => {
  const { url, token, runId } = req.body || {};
  if (!token || !runId) {
    return res.json({ jobs: [
      { id: 1, name: 'Build & Validate', status: 'completed', conclusion: 'success', steps: [
        { number: 1, name: 'Checkout', status: 'completed', conclusion: 'success' },
        { number: 2, name: 'Generate AVD Config', status: 'completed', conclusion: 'success' },
        { number: 3, name: 'Validate Config', status: 'completed', conclusion: 'success' },
      ]},
      { id: 2, name: 'Deploy to Network', status: 'in_progress', conclusion: null, steps: [
        { number: 1, name: 'Checkout', status: 'completed', conclusion: 'success' },
        { number: 2, name: 'Push to CloudVision', status: 'in_progress', conclusion: null },
        { number: 3, name: 'Execute Change Control', status: 'queued', conclusion: null },
      ]},
    ], mock: true });
  }

  const repo = parseGitHubUrl(url);
  if (!repo) return res.status(400).json({ error: 'Cannot parse GitHub URL' });

  try {
    const apiRes = await fetch(
      `https://api.github.com/repos/${repo.owner}/${repo.repo}/actions/runs/${runId}/jobs`,
      { headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' } }
    );
    if (!apiRes.ok) throw new Error(`GitHub API ${apiRes.status}`);
    const data = await apiRes.json();
    const jobs = (data.jobs || []).map(j => ({
      id: j.id,
      name: j.name,
      status: j.status,
      conclusion: j.conclusion,
      steps: (j.steps || []).map(s => ({
        number: s.number,
        name: s.name,
        status: s.status,
        conclusion: s.conclusion,
      })),
    }));
    res.json({ jobs, mock: false });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

app.post('/api/github/create-change', async (req, res) => {
  const { url, token, vlan_id, vlan_name, subnet } = req.body || {};
  if (!token) return res.status(400).json({ error: 'GitHub token required' });
  if (!url) return res.status(400).json({ error: 'URL required' });
  if (!vlan_id || !vlan_name || !subnet) return res.status(400).json({ error: 'vlan_id, vlan_name, and subnet are required' });

  if (!parseSubnet(subnet)) return res.status(400).json({ error: `Invalid subnet format: ${subnet}` });

  const repo = parseGitHubUrl(url);
  if (!repo) return res.status(400).json({ error: 'Cannot parse GitHub URL' });

  const ghHeaders = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'Content-Type': 'application/json',
  };
  const api = `https://api.github.com/repos/${repo.owner}/${repo.repo}`;

  try {
    // 1. Get default branch
    const repoRes = await fetch(api, { headers: ghHeaders });
    if (!repoRes.ok) throw new Error(`GitHub API ${repoRes.status}: could not fetch repo info`);
    const repoData = await repoRes.json();
    const defaultBranch = repoData.default_branch;

    // 2. Get HEAD SHA of default branch
    const refRes = await fetch(`${api}/git/ref/heads/${defaultBranch}`, { headers: ghHeaders });
    if (!refRes.ok) throw new Error(`Could not get ref for ${defaultBranch}`);
    const refData = await refRes.json();
    const baseSha = refData.object.sha;

    // 3. Create branch
    const branchName = `ticket/add-vlan-${vlan_id}`;
    const branchRes = await fetch(`${api}/git/refs`, {
      method: 'POST',
      headers: ghHeaders,
      body: JSON.stringify({ ref: `refs/heads/${branchName}`, sha: baseSha }),
    });
    if (branchRes.status === 422) {
      return res.status(409).json({ error: `Branch ${branchName} already exists. A ticket for this VLAN may already be in progress.` });
    }
    if (!branchRes.ok) throw new Error(`Could not create branch: ${branchRes.status}`);

    // 4. Find network services file via repo tree
    const treeRes = await fetch(`${api}/git/trees/${baseSha}?recursive=1`, { headers: ghHeaders });
    if (!treeRes.ok) throw new Error(`Could not fetch repo tree`);
    const treeData = await treeRes.json();
    const filePath = findNetworkServicesFile(treeData.tree || []);
    if (!filePath) {
      return res.status(404).json({ error: 'Could not find a *_network_services.yml file under group_vars/ in the repository' });
    }

    // 5. Read current file content
    const fileRes = await fetch(`${api}/contents/${filePath}?ref=${branchName}`, { headers: ghHeaders });
    if (!fileRes.ok) throw new Error(`Could not read ${filePath}`);
    const fileData = await fileRes.json();
    const fileContent = Buffer.from(fileData.content, 'base64').toString('utf8');
    const fileSha = fileData.sha;

    // 6. Parse YAML, append new SVI
    const doc = yaml.load(fileContent);
    if (!doc?.tenants?.[0]?.vrfs?.[0]?.svis) {
      return res.status(400).json({ error: 'Unexpected YAML structure: could not find tenants[0].vrfs[0].svis' });
    }
    const svis = doc.tenants[0].vrfs[0].svis;

    if (svis.some(s => s.id === Number(vlan_id))) {
      return res.status(409).json({ error: `VLAN ID ${vlan_id} already exists in ${filePath}` });
    }

    const existingNodes = (svis.find(s => s.nodes?.length)?.nodes || [])
      .map(n => ({ node: n.node }));
    if (existingNodes.length === 0) {
      existingNodes.push({ node: 'spine-1' }, { node: 'spine-2' });
    }

    svis.push(buildSviEntry(vlan_id, vlan_name, subnet, existingNodes));

    const updatedYaml = yaml.dump(doc, { indent: 2, lineWidth: -1, quotingType: "'", forceQuotes: false });

    // 7. Commit the change
    const commitRes = await fetch(`${api}/contents/${filePath}`, {
      method: 'PUT',
      headers: ghHeaders,
      body: JSON.stringify({
        message: `Add VLAN ${vlan_id} (${vlan_name})`,
        content: Buffer.from(updatedYaml).toString('base64'),
        sha: fileSha,
        branch: branchName,
      }),
    });
    if (!commitRes.ok) throw new Error(`Could not commit changes: ${commitRes.status}`);

    // 8. Create PR
    const prRes = await fetch(`${api}/pulls`, {
      method: 'POST',
      headers: ghHeaders,
      body: JSON.stringify({
        title: `Add VLAN ${vlan_id} - ${vlan_name}`,
        body: `Adds SVI for VLAN ${vlan_id} (${vlan_name}) with subnet ${subnet}`,
        head: branchName,
        base: defaultBranch,
      }),
    });
    if (!prRes.ok) {
      const errBody = await prRes.text();
      throw new Error(`Could not create PR: ${prRes.status} ${errBody}`);
    }
    const prData = await prRes.json();

    res.json({ success: true, pr_url: prData.html_url });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

function generateMockChangeControls() {
  const now = Date.now();
  return [
    { id: 'CC-2024-0042', name: 'Spine BGP Peer Update', status: 'COMPLETED', approvalStatus: 'APPROVED', createdBy: 'networkeng', createdAt: new Date(now - 20 * 60000).toISOString(), stages: [
      { id: 'root', name: 'Root', status: 'COMPLETED', steps: [] },
      { id: 's1', name: 'Update spine-1', status: 'COMPLETED', action: 'Config Push', steps: [
        { name: 'Validate Config', status: 'FINISHED' },
        { name: 'Push Config', status: 'FINISHED' },
      ]},
      { id: 's2', name: 'Update spine-2', status: 'COMPLETED', action: 'Config Push', steps: [
        { name: 'Validate Config', status: 'FINISHED' },
        { name: 'Push Config', status: 'FINISHED' },
      ]},
    ]},
    { id: 'CC-2024-0043', name: 'MLAG Domain Configuration', status: 'NOT_STARTED', approvalStatus: 'PENDING', createdBy: 'netops', createdAt: new Date(now - 5 * 60000).toISOString(), stages: [
      { id: 'root', name: 'Root', status: 'NOT_STARTED', steps: [] },
      { id: 's1', name: 'Configure leaf-1a', status: 'NOT_STARTED', action: 'Config Push', steps: [] },
      { id: 's2', name: 'Configure leaf-1b', status: 'NOT_STARTED', action: 'Config Push', steps: [] },
    ]},
    { id: 'CC-2024-0044', name: 'ACL Policy Refresh', status: 'RUNNING', approvalStatus: 'APPROVED', createdBy: 'seceng', createdAt: new Date(now - 8 * 60000).toISOString(), stages: [
      { id: 'root', name: 'Root', status: 'RUNNING', steps: [] },
      { id: 's1', name: 'Update ACL on leaf-1a', status: 'COMPLETED', action: 'Config Push', steps: [
        { name: 'Validate Config', status: 'FINISHED' },
        { name: 'Push Config', status: 'FINISHED' },
      ]},
      { id: 's2', name: 'Update ACL on leaf-2a', status: 'RUNNING', action: 'Config Push', steps: [
        { name: 'Validate Config', status: 'FINISHED' },
        { name: 'Push Config', status: 'RUNNING' },
      ]},
    ]},
    { id: 'CC-2024-0041', name: 'VXLAN Overlay Update', status: 'COMPLETED', approvalStatus: 'APPROVED', createdBy: 'networkeng', createdAt: new Date(now - 2 * 3600000).toISOString(), stages: [] },
    { id: 'CC-2024-0040', name: 'Management VRF Changes', status: 'COMPLETED', approvalStatus: 'APPROVED', createdBy: 'netops', createdAt: new Date(now - 4 * 3600000).toISOString(), stages: [] },
  ];
}

function normalizeUrl(url) {
  url = url.trim().replace(/\/$/, '');
  if (url && !url.startsWith('http://') && !url.startsWith('https://')) {
    url = 'https://' + url;
  }
  return url;
}

app.post('/api/cloudvision/changecontrols', async (req, res) => {
  const { url, token } = req.body || {};
  if (!token) return res.json({ changeControls: generateMockChangeControls(), mock: true });
  if (!url) return res.status(400).json({ error: 'URL required' });

  try {
    const baseUrl = normalizeUrl(url);
    const apiRes = await fetch(
      `${baseUrl}/api/resources/changecontrol/v1/ChangeControl/all`,
      { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } }
    );
    if (!apiRes.ok) throw new Error(`CloudVision API ${apiRes.status}`);
    const text = await apiRes.text();
    const items = text.trim().split('\n').filter(Boolean).map(line => {
      const obj = JSON.parse(line);
      const val = obj.result?.value || obj;
      const key = val.key || {};
      const change = val.change || {};
      let status = 'UNKNOWN';
      if (val.status) {
        status = val.status.replace('CHANGE_CONTROL_STATUS_', '');
      }
      const stagesMap = change.stages?.values || change.stages || {};
      const stages = Object.entries(stagesMap).map(([stageId, stage]) => {
        const stepsMap = stage.steps?.values || stage.steps || {};
        const steps = Object.entries(stepsMap).map(([stepId, step]) => ({
          name: step.name || stepId,
          status: (step.status || '').replace('STEP_STATUS_', ''),
          error: step.error || '',
        }));
        return {
          id: stageId,
          name: stage.name || stageId,
          status: (stage.status || '').replace('STAGE_STATUS_', ''),
          action: stage.action?.name || '',
          error: stage.error || '',
          steps,
        };
      });

      let completionReason = '';
      if (val.completion_reason) {
        completionReason = val.completion_reason.replace('COMPLETION_REASON_', '');
      }

      return {
        id: key.id || val.id || '',
        name: change.name || val.name || key.id || '',
        status,
        error: val.error || '',
        completionReason,
        approvalStatus: val.approve?.value ? 'APPROVED' : 'PENDING',
        createdBy: change.user || val.createdBy || '',
        createdAt: obj.result?.time || val.createdAt || '',
        stages,
      };
    });
    items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json({ changeControls: items.slice(0, 15), mock: false });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

function generateMockDevices() {
  return [
    { hostname: 'spine-1', ipAddress: '10.0.0.1', modelName: 'DCS-7280SR3-48YC8' },
    { hostname: 'spine-2', ipAddress: '10.0.0.2', modelName: 'DCS-7280SR3-48YC8' },
    { hostname: 'leaf-1', ipAddress: '10.0.0.11', modelName: 'DCS-7050SX3-48YC12' },
    { hostname: 'leaf-2', ipAddress: '10.0.0.12', modelName: 'DCS-7050SX3-48YC12' },
    { hostname: 'leaf-3', ipAddress: '10.0.0.13', modelName: 'DCS-7050SX3-48YC12' },
    { hostname: 'leaf-4', ipAddress: '10.0.0.14', modelName: 'DCS-7050SX3-48YC12' },
  ];
}

app.post('/api/cloudvision/devices', async (req, res) => {
  const { url, token } = req.body || {};
  if (!token) return res.json({ devices: generateMockDevices(), mock: true });
  if (!url) return res.status(400).json({ error: 'URL required' });

  try {
    const baseUrl = normalizeUrl(url);

    // Try the REST API first (has management IPs)
    let devices = [];
    let restDebug = '';
    try {
      const restRes = await fetch(
        `${baseUrl}/cvpservice/inventory/devices`,
        { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } }
      );
      restDebug = `REST API status: ${restRes.status}`;
      if (restRes.ok) {
        const data = await restRes.json();
        restDebug += `, returned ${Array.isArray(data) ? data.length : 'non-array'} items`;
        devices = (Array.isArray(data) ? data : []).map(d => ({
          hostname: d.hostname || d.fqdn || '',
          ipAddress: d.ipAddress || '',
          modelName: d.modelName || '',
        })).filter(d => d.hostname && d.ipAddress);
        restDebug += `, parsed ${devices.length} with IPs`;
      }
    } catch (e) {
      restDebug = `REST API error: ${e.message}`;
    }
    console.log(`[CV Devices] ${restDebug}`);

    // Fall back to Resource API if REST API didn't work
    if (devices.length === 0) {
      const apiRes = await fetch(
        `${baseUrl}/api/resources/inventory/v1/Device/all`,
        { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } }
      );
      if (!apiRes.ok) throw new Error(`CloudVision API ${apiRes.status}`);
      const text = await apiRes.text();
      const lines = text.trim().split('\n').filter(Boolean);
      devices = lines.map(line => {
        const obj = JSON.parse(line);
        const val = obj.result?.value || obj;
        const key = obj.result?.key || val.key || {};
        return {
          hostname: val.hostname || key.deviceId || '',
          ipAddress: val.ipAddress || val.managementAddress || val.fqdn || '',
          modelName: val.modelName || '',
        };
      }).filter(d => d.hostname && d.ipAddress);
    }

    devices.sort((a, b) => a.hostname.localeCompare(b.hostname));
    res.json({ devices, mock: false });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

const ACT_LAB_STATES = {
  0: 'Ready', 1: 'Pending', 2: 'Running', 3: 'Stopping',
  4: 'Stopped', 5: 'Deploying', 6: 'DeploymentFailed',
  7: 'Failed', 8: 'Starting', 9: 'Undeploying', 10: 'Queued',
  11: 'Job Created', 12: 'Configuring',
};

app.post('/api/act/lab-status', async (req, res) => {
  const { actUrl, apiKey, labName, username } = req.body || {};
  if (!apiKey || !labName) return res.status(400).json({ error: 'apiKey and labName required' });

  try {
    const actHost = normalizeUrl(actUrl || 'lab.act.arista.com');
    const actBase = `${actHost}/rest/v1`;

    const loginRes = await fetch(`${actBase}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_key: apiKey }),
    });
    if (!loginRes.ok) throw new Error(`ACT login failed: ${loginRes.status}`);
    const loginData = await loginRes.json();
    const token = loginData.token;
    if (!token) throw new Error('No token in ACT login response');

    const labParams = new URLSearchParams();
    if (labName) labParams.set('name', labName);
    if (username) labParams.set('user', username);
    const labsRes = await fetch(`${actBase}/labs?${labParams}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    });
    if (!labsRes.ok) throw new Error(`ACT labs API: ${labsRes.status}`);
    const labsData = await labsRes.json();
    let labs = labsData.result || labsData || [];
    if (!Array.isArray(labs)) labs = [];

    const lab = labs.find(l => (l.name || '').trim().toLowerCase() === labName.trim().toLowerCase());
    if (!lab) return res.json({ status: 'unknown', label: 'Not Found' });

    const stateNum = lab.state;
    const label = ACT_LAB_STATES[stateNum] || `Unknown (${stateNum})`;
    const running = stateNum === 2;

    res.json({ status: running ? 'running' : 'stopped', label, state: stateNum });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

app.post('/api/act/devices', async (req, res) => {
  const { actUrl, apiKey, labName, username } = req.body || {};
  if (!apiKey) return res.status(400).json({ error: 'apiKey required' });

  try {
    const actHost = normalizeUrl(actUrl || 'lab.act.arista.com');
    const actBase = `${actHost}/rest/v1`;

    const loginRes = await fetch(`${actBase}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_key: apiKey }),
    });
    if (!loginRes.ok) throw new Error(`ACT login failed: ${loginRes.status}`);
    const loginData = await loginRes.json();
    const token = loginData.token;
    if (!token) throw new Error('No token in ACT login response');

    // Fetch labs, filtering by user if provided
    const labParams = new URLSearchParams();
    if (labName) labParams.set('name', labName);
    if (username) labParams.set('user', username);
    const labsRes = await fetch(`${actBase}/labs?${labParams}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    });
    if (!labsRes.ok) throw new Error(`ACT labs API: ${labsRes.status}`);
    const labsData = await labsRes.json();
    let labs = labsData.result || labsData || [];
    if (!Array.isArray(labs)) labs = [];

    // If no lab name given, just list available labs
    if (!labName) {
      const labNames = labs.map(l => ({ name: l.name, id: l.lab_id || l.id, state: l.state }));
      return res.json({ devices: [], labs: labNames, debug: `Found ${labs.length} labs` });
    }

    let lab = labs.find(l => (l.name || '').trim().toLowerCase() === labName.trim().toLowerCase());
    if (!lab && labs.length === 0) {
      return res.json({ devices: [], debug: `No labs returned for name "${labName}"` });
    }
    if (!lab) {
      const names = labs.slice(0, 10).map(l => l.name);
      return res.json({ devices: [], debug: `Lab "${labName}" not found in ${labs.length} results. First 10: ${names.join(', ')}` });
    }

    const labId = lab.id || lab.lab_id;

    // Fetch full lab details to get the device list
    const labDetailRes = await fetch(`${actBase}/labs/${labId}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    });
    if (!labDetailRes.ok) throw new Error(`ACT lab detail API: ${labDetailRes.status}`);
    const labDetail = await labDetailRes.json();

    const devicesObj = labDetail.devices;
    if (!devicesObj || typeof devicesObj !== 'object') {
      return res.json({ devices: [], debug: 'No devices in lab detail' });
    }

    const devices = [];
    for (const nodeList of Object.values(devicesObj)) {
      if (!Array.isArray(nodeList)) continue;
      for (const n of nodeList) {
        if (n.hostname && n.internal_ip) {
          devices.push({ hostname: n.hostname, ipAddress: n.internal_ip });
        }
      }
    }

    res.json({ devices });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

const wss = new WebSocketServer({ server, path: '/ws/ssh' });

wss.on('connection', (ws) => {
  let sshClient = null;
  let sshStream = null;

  ws.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch {
      if (sshStream) sshStream.write(raw);
      return;
    }

    if (msg.type === 'connect') {
      if (!msg.host || !msg.username || !msg.password) {
        ws.send(JSON.stringify({ type: 'error', message: 'Host, username, and password are required' }));
        return;
      }

      sshClient = new Client();

      sshClient.on('ready', () => {
        ws.send(JSON.stringify({ type: 'status', status: 'connected' }));

        const shellOpts = {};
        if (msg.cols && msg.rows) {
          shellOpts.cols = msg.cols;
          shellOpts.rows = msg.rows;
        }

        sshClient.shell(shellOpts, (err, stream) => {
          if (err) {
            ws.send(JSON.stringify({ type: 'error', message: err.message }));
            return;
          }
          sshStream = stream;

          stream.on('data', (data) => {
            if (ws.readyState === ws.OPEN) {
              ws.send(data);
            }
          });

          stream.on('close', () => {
            if (ws.readyState === ws.OPEN) {
              ws.send(JSON.stringify({ type: 'status', status: 'disconnected' }));
            }
            if (sshClient) sshClient.end();
          });

          stream.stderr.on('data', (data) => {
            if (ws.readyState === ws.OPEN) {
              ws.send(data);
            }
          });
        });
      });

      sshClient.on('error', (err) => {
        ws.send(JSON.stringify({ type: 'error', message: err.message }));
      });

      sshClient.on('keyboard-interactive', (_name, _instructions, _lang, prompts, finish) => {
        finish(prompts.map(() => msg.password));
      });

      sshClient.connect({
        host: msg.host,
        port: msg.port || 22,
        username: msg.username,
        password: msg.password,
        tryKeyboard: true,
        readyTimeout: 10000,
        algorithms: {
          kex: [
            'ecdh-sha2-nistp256',
            'ecdh-sha2-nistp384',
            'ecdh-sha2-nistp521',
            'diffie-hellman-group-exchange-sha256',
            'diffie-hellman-group14-sha256',
            'diffie-hellman-group14-sha1',
          ],
        },
      });
    }

    if (msg.type === 'data' && sshStream) {
      sshStream.write(msg.data);
    }

    if (msg.type === 'resize' && sshStream) {
      sshStream.setWindow(msg.rows, msg.cols, msg.height || 480, msg.width || 640);
    }

    if (msg.type === 'disconnect') {
      if (sshStream) sshStream.close();
      if (sshClient) sshClient.end();
      sshStream = null;
      sshClient = null;
    }
  });

  ws.on('close', () => {
    if (sshStream) sshStream.close();
    if (sshClient) sshClient.end();
    sshStream = null;
    sshClient = null;
  });
});

const port = config.server?.port || 3000;
server.listen(port, () => {
  console.log(`Demo Dashboard running at http://localhost:${port}`);
});
