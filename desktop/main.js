// Electron shell: starts the bundled server (paya-server.exe), waits until it answers, shows the coach
// panel in a window and stops the server on quit. All data stays on this PC (%APPDATA%/PAYA Group).
const { app, BrowserWindow, dialog, shell } = require('electron');
const { spawn } = require('child_process');
const fs = require('fs');
const http = require('http');
const net = require('net');
const path = require('path');

let server = null;
let win = null;

const dataDir = () => path.join(process.env.APPDATA || app.getPath('appData'), 'PAYA Group');

function serverCommand() {
  if (app.isPackaged) return { cmd: path.join(process.resourcesPath, 'server', 'paya-server.exe'), args: [] };
  // development: run the Django project directly (python + built web from apps/web/dist)
  const root = path.join(__dirname, '..');
  return { cmd: process.env.PYTHON || 'python', args: [path.join(root, 'backend', 'desktop_entry.py')], env: { PAYA_WEB_DIR: path.join(root, 'apps', 'web', 'dist') } };
}

function freePort() {
  return new Promise((resolve, reject) => {
    const s = net.createServer();
    s.listen(0, '127.0.0.1', () => {
      const { port } = s.address();
      s.close(() => resolve(port));
    });
    s.on('error', reject);
  });
}

function waitUntilUp(port, timeoutMs = 180000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      http
        .get({ host: '127.0.0.1', port, path: '/healthz', timeout: 2000 }, (r) => {
          r.resume();
          r.statusCode === 200 ? resolve() : retry();
        })
        .on('error', retry);
    };
    const retry = () => (Date.now() - start > timeoutMs ? reject(new Error('server did not start')) : setTimeout(tick, 500));
    tick();
  });
}

async function showFirstRunCredentials() {
  const f = path.join(dataDir(), 'first-run.json');
  if (!fs.existsSync(f)) return;
  try {
    const c = JSON.parse(fs.readFileSync(f, 'utf8'));
    const lines = [];
    if (c.head_coach) lines.push(`سرمربی\nنام کاربری: ${c.head_coach.username}\nرمز عبور: ${c.head_coach.password}`);
    if (c.admin) lines.push(`مدیر سیستم (پشتیبانی)\nنام کاربری: ${c.admin.username}\nرمز عبور: ${c.admin.password}`);
    await dialog.showMessageBox(win, {
      type: 'info',
      title: 'اطلاعات ورود',
      message: 'اطلاعات ورود اولیه',
      detail: lines.join('\n\n') + '\n\nاین اطلاعات در فایل «اطلاعات-ورود.txt» داخل پوشه‌ی داده‌ها هم ذخیره شده است.',
      buttons: ['متوجه شدم', 'باز کردن پوشه'],
    }).then((r) => r.response === 1 && shell.openPath(dataDir()));
  } finally {
    fs.unlinkSync(f);
  }
}

async function start() {
  const port = await freePort();
  const { cmd, args, env } = serverCommand();
  server = spawn(cmd, [...args, String(port)], { env: { ...process.env, ...env }, windowsHide: true });
  let log = '';
  server.stdout.on('data', (d) => (log = (log + d).slice(-4000)));
  server.stderr.on('data', (d) => (log = (log + d).slice(-4000)));
  server.on('exit', (code) => {
    if (!app.isQuitting) {
      dialog.showErrorBox('PAYA Group', `سرور برنامه متوقف شد (کد ${code}).\n\n${log}`);
      app.quit();
    }
  });

  win = new BrowserWindow({ width: 1440, height: 900, minWidth: 1024, minHeight: 640, show: false, title: 'PAYA Group', autoHideMenuBar: true });
  win.once('ready-to-show', () => win.show());
  win.loadURL(`data:text/html;charset=utf-8,<body dir="rtl" style="font-family:Tahoma,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:%230a0a0a;color:%23fff">در حال راه‌اندازی…</body>`);
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url); // exercise links in PDFs, site links… open in the default browser
    return { action: 'deny' };
  });
  try {
    await waitUntilUp(port);
  } catch (e) {
    dialog.showErrorBox('PAYA Group', `راه‌اندازی سرور ممکن نشد.\n\n${log}`);
    return app.quit();
  }
  await win.loadURL(`http://127.0.0.1:${port}/coach/login`);
  showFirstRunCredentials();
}

const lock = app.requestSingleInstanceLock();
if (!lock) app.quit();
else {
  app.on('second-instance', () => win && (win.isMinimized() && win.restore(), win.focus()));
  app.whenReady().then(start);
  app.on('before-quit', () => {
    app.isQuitting = true;
    if (server && !server.killed) server.kill();
  });
  app.on('window-all-closed', () => app.quit());
}
