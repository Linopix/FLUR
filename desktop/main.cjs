const { app, BrowserWindow, Menu, Tray, ipcMain, nativeImage, shell } = require("electron");
const { spawn } = require("node:child_process");
const http = require("node:http");
const net = require("node:net");
const path = require("node:path");

const SERVER_ROOT = path.join(__dirname, "server");
const SERVER_ENTRY = path.join(SERVER_ROOT, "server", "index.mjs");

let serverProcess = null;
let mainWindow = null;
let tray = null;
let quitting = false;
let bar = { lesson: "FLUR", change: "", ride: "" };

function clip(value, max) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function trayImage() {
  const size = 22;
  const buf = Buffer.alloc(size * size * 4);
  const set = (x, y) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    const i = (y * size + x) * 4;
    buf[i] = 0;
    buf[i + 1] = 0;
    buf[i + 2] = 0;
    buf[i + 3] = 255;
  };
  for (let y = 5; y < 18; y++) {
    set(6, y);
    set(7, y);
    set(14, y);
    set(15, y);
  }
  for (let x = 6; x <= 15; x++) {
    set(x, 4);
    set(x, 5);
  }
  set(10, 9);
  set(10, 10);
  set(10, 11);
  set(11, 11);
  set(12, 11);
  const image = nativeImage.createFromBitmap(buf, { width: size, height: size, scaleFactor: 1 });
  image.setTemplateImage(true);
  return image;
}

function showWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

function refreshTray() {
  if (!tray) return;
  const title = [bar.lesson, bar.ride].filter(Boolean).join(" · ");
  if (process.platform === "darwin") tray.setTitle(title ? ` ${title}` : "");
  tray.setToolTip(["FLUR", bar.lesson, bar.change, bar.ride].filter(Boolean).join("\n"));
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: bar.lesson || "FLUR", enabled: false },
      ...(bar.change ? [{ label: bar.change, enabled: false }] : []),
      ...(bar.ride ? [{ label: bar.ride, enabled: false }] : []),
      { type: "separator" },
      { label: "FLUR öffnen", click: showWindow },
      { type: "separator" },
      {
        label: "Beenden",
        click: () => {
          quitting = true;
          app.quit();
        },
      },
    ]),
  );
}

function installTray() {
  tray = new Tray(trayImage());
  refreshTray();
  ipcMain.on("flur-bar", (_event, payload) => {
    bar = {
      lesson: clip(payload?.lesson, 42) || "FLUR",
      change: clip(payload?.change, 80),
      ride: clip(payload?.ride, 42),
    };
    refreshTray();
  });
}

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
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  mainWindow.on("close", (event) => {
    if (quitting) return;
    event.preventDefault();
    mainWindow.hide();
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
    showWindow();
  });
  app.whenReady().then(async () => {
    installMenu();
    installTray();
    try {
      await createWindow();
    } catch (error) {
      const message = error instanceof Error ? error.message : "FLUR startet nicht.";
      const fallback = new BrowserWindow({ width: 640, height: 360, title: "FLUR", backgroundColor: "#14110d" });
      await fallback.loadURL("data:text/plain;charset=utf-8," + encodeURIComponent(message));
    }
  });
  app.on("before-quit", () => {
    quitting = true;
    stopServer();
  });
  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
      quitting = true;
      stopServer();
      app.quit();
    }
  });
  app.on("activate", () => {
    showWindow();
  });
}
