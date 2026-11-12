const { app, BrowserWindow, Menu, shell } = require("electron");
const { spawn } = require("node:child_process");
const http = require("node:http");
const net = require("node:net");
const path = require("node:path");

const SERVER_ROOT = path.join(__dirname, "server");
const SERVER_ENTRY = path.join(SERVER_ROOT, "server", "index.mjs");

let serverProcess = null;
let mainWindow = null;

function freePort() {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const address = probe.address();
      const port = typeof address === "object" && address ? address.port : 0;
      probe.close(() => resolve(port));
    });
  });
}

function waitForServer(port) {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const tick = () => {
      const request = http.get({ host: "127.0.0.1", port, path: "/", timeout: 1000 }, (response) => {
        response.resume();
        if ((response.statusCode ?? 500) < 500) resolve();
        else retry();
      });
      request.on("error", retry);
      request.on("timeout", () => {
        request.destroy();
        retry();
      });
    };
    const retry = () => {
      if (Date.now() - started > 25_000) {
        reject(new Error("FLUR ist nicht hochgekommen."));
        return;
      }
      setTimeout(tick, 250);
    };
    tick();
  });
}

async function startServer() {
  const port = await freePort();
  serverProcess = spawn(process.execPath, [SERVER_ENTRY], {
    cwd: SERVER_ROOT,
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: "1",
      HOST: "127.0.0.1",
      PORT: String(port),
      NITRO_HOST: "127.0.0.1",
      NITRO_PORT: String(port),
      NODE_ENV: "production",
    },
    stdio: "pipe",
  });
  let log = "";
  serverProcess.stdout?.on("data", (chunk) => {
    log = (log + chunk.toString()).slice(-4000);
  });
  serverProcess.stderr?.on("data", (chunk) => {
    log = (log + chunk.toString()).slice(-4000);
  });
  serverProcess.once("exit", (code) => {
    if (mainWindow && !mainWindow.isDestroyed() && code) {
      mainWindow.loadURL("data:text/plain;charset=utf-8," + encodeURIComponent(log || `Server beendet (${code}).`));
    }
  });
  await waitForServer(port);
  return port;
}

function stopServer() {
  if (!serverProcess || serverProcess.killed) return;
  serverProcess.kill("SIGTERM");
  serverProcess = null;
}

async function createWindow() {
  const port = await startServer();
  mainWindow = new BrowserWindow({
    width: 1180,
    height: 800,
    minWidth: 390,
    minHeight: 640,
    title: "FLUR",
    backgroundColor: "#14110d",
    autoHideMenuBar: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("http://") || url.startsWith("https://")) void shell.openExternal(url);
    return { action: "deny" };
  });
  await mainWindow.loadURL(`http://127.0.0.1:${port}/`);
}

function installMenu() {
  const template = [
    {
      label: "FLUR",
      submenu: [
        { role: "about", label: "Über FLUR" },
        { type: "separator" },
        { role: "hide", label: "FLUR ausblenden" },
        { role: "hideOthers", label: "Andere ausblenden" },
        { role: "unhide", label: "Alle einblenden" },
        { type: "separator" },
        { role: "quit", label: "FLUR beenden" },
      ],
    },
    {
      label: "Bearbeiten",
      submenu: [
        { role: "undo", label: "Widerrufen" },
        { role: "redo", label: "Wiederholen" },
        { type: "separator" },
        { role: "cut", label: "Ausschneiden" },
        { role: "copy", label: "Kopieren" },
        { role: "paste", label: "Einsetzen" },
        { role: "selectAll", label: "Alles auswählen" },
      ],
    },
    {
      label: "Darstellung",
      submenu: [
        { role: "reload", label: "Neu laden" },
        { role: "togglefullscreen", label: "Vollbild" },
        { role: "resetZoom", label: "Originalgröße" },
        { role: "zoomIn", label: "Größer" },
        { role: "zoomOut", label: "Kleiner" },
      ],
    },
    {
      label: "Fenster",
      submenu: [
        { role: "minimize", label: "Im Dock ablegen" },
        { role: "zoom", label: "Zoomen" },
        { role: "close", label: "Schließen" },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  });
  app.whenReady().then(async () => {
    installMenu();
    try {
      await createWindow();
    } catch (error) {
      const message = error instanceof Error ? error.message : "FLUR startet nicht.";
      const fallback = new BrowserWindow({ width: 640, height: 360, title: "FLUR", backgroundColor: "#14110d" });
      await fallback.loadURL("data:text/plain;charset=utf-8," + encodeURIComponent(message));
    }
  });
  app.on("before-quit", stopServer);
  app.on("window-all-closed", () => {
    stopServer();
    app.quit();
  });
}
