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

app.get('/api/config', (_req, res) => {
  const sanitized = { environments: {} };
  for (const [key, env] of Object.entries(config.environments)) {
    sanitized.environments[key] = {
      label: env.label,
      github_actions_url: env.github_actions_url,
      cloudvision_url: env.cloudvision_url,
      devices: env.devices.map(d => ({ name: d.name })),
    };
  }
  res.json(sanitized);
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
      const env = config.environments[msg.envKey];
      if (!env) {
        ws.send(JSON.stringify({ type: 'error', message: `Unknown environment: ${msg.envKey}` }));
        return;
      }
      const device = env.devices[msg.deviceIndex];
      if (!device) {
        ws.send(JSON.stringify({ type: 'error', message: `Unknown device index: ${msg.deviceIndex}` }));
        return;
      }

      sshClient = new Client();

      sshClient.on('ready', () => {
        ws.send(JSON.stringify({ type: 'status', status: 'connected', device: device.name }));

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
            ws.send(JSON.stringify({ type: 'status', status: 'disconnected' }));
            sshClient.end();
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

      sshClient.connect({
        host: device.host,
        port: device.port || 22,
        username: device.username,
        password: device.password,
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
