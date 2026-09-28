/**
 * @author Luuxis
 * Luuxis License v1.0 (voir fichier LICENSE pour les détails en FR/EN)
 */

const { app, session } = require('electron');
const { autoUpdater } = require('electron-updater')

const path = require('path');
const fs = require('fs');

const UpdateWindow = require("./assets/js/windows/updateWindow.js");
const MainWindow = require("./assets/js/windows/mainWindow.js");
const { registerIpc } = require("./assets/js/main/ipc.js");

let dev = process.env.NODE_ENV === 'dev';

app.commandLine.appendSwitch('disable-http-cache');

/**
 * Origine du panel, seule origine distante autorisee par la CSP.
 * En dev API_URL est fourni par le script npm, en production la valeur est
 * substituee dans package.json au moment du build du launcher.
 */
function getApiOrigin() {
    let raw = process.env.API_URL;
    if (!raw) {
        try {
            raw = require(path.join(app.getAppPath(), 'package.json')).url;
        } catch (error) {
            raw = null;
        }
    }

    try {
        return new URL(raw).origin;
    } catch (error) {
        // Placeholder non substitue (dev sans API_URL) : on n'autorise rien.
        return null;
    }
}

/**
 * La CSP est posee ici plutot que dans une balise <meta> : l'origine du panel
 * n'est connue qu'a l'execution, et une politique servie par le main process
 * ne peut pas etre alteree depuis le renderer.
 *
 * 'unsafe-inline' est necessaire sur style-src uniquement : le launcher pose
 * de nombreux attributs style="" (listes de comptes, blocs de news). Il reste
 * volontairement absent de script-src.
 */
function buildCsp() {
    const api = getApiOrigin();
    const remote = api ? ` ${api}` : '';

    return [
        "default-src 'none'",
        "script-src 'self'",
        `style-src 'self' 'unsafe-inline'${remote}`,
        `img-src 'self' data:${remote}`,
        "font-src 'self'",
        `connect-src 'self'${remote} https://api.github.com`,
        "media-src 'self'",
        "frame-src 'none'",
        "object-src 'none'",
        "base-uri 'none'",
        "form-action 'none'"
    ].join('; ');
}

function configureSession() {
    const defaultSession = session.defaultSession;
    const csp = buildCsp();

    defaultSession.clearCache().catch(() => {});

    defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
        details.requestHeaders['Cache-Control'] = 'no-cache, no-store, must-revalidate';
        details.requestHeaders['Pragma'] = 'no-cache';
        callback({ requestHeaders: details.requestHeaders });
    });

    defaultSession.webRequest.onHeadersReceived((details, callback) => {
        const responseHeaders = { ...details.responseHeaders };
        responseHeaders['Cache-Control'] = ['no-store, no-cache, must-revalidate, max-age=0'];
        responseHeaders['Pragma'] = ['no-cache'];
        responseHeaders['Expires'] = ['0'];

        if (details.resourceType === 'mainFrame' || details.resourceType === 'subFrame') {
            // Remplace toute politique deja presente au lieu de s'y ajouter :
            // deux CSP se cumulent par intersection et rendent le debug opaque.
            delete responseHeaders['content-security-policy'];
            delete responseHeaders['Content-Security-Policy'];
            responseHeaders['Content-Security-Policy'] = [csp];
        }

        callback({ responseHeaders });
    });
}

if (dev) {
    let appPath = path.resolve('./data/Launcher').replace(/\\/g, '/');
    let appdata = path.resolve('./data').replace(/\\/g, '/');
    if (!fs.existsSync(appPath)) fs.mkdirSync(appPath, { recursive: true });
    if (!fs.existsSync(appdata)) fs.mkdirSync(appdata, { recursive: true });
    app.setPath('userData', appPath);
    app.setPath('appData', appdata)
}

if (!app.requestSingleInstanceLock()) app.quit();
else app.whenReady().then(() => {
    configureSession();
    registerIpc({ MainWindow, UpdateWindow });
    if (dev) return MainWindow.createWindow()
    UpdateWindow.createWindow()
});

app.on('window-all-closed', () => app.quit());

autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = true;

function sendToUpdateWindow(channel, payload) {
    const updateWindow = UpdateWindow.getWindow();
    if (updateWindow && !updateWindow.isDestroyed()) {
        updateWindow.webContents.send(channel, payload);
    }
}

autoUpdater.on('update-available', info => {
    sendToUpdateWindow('updater:available', { version: info?.version || null });
});

autoUpdater.on('update-not-available', () => {
    sendToUpdateWindow('updater:not-available', null);
});

autoUpdater.on('download-progress', progress => {
    sendToUpdateWindow('updater:progress', {
        transferred: progress?.transferred || 0,
        total: progress?.total || 0
    });
});

autoUpdater.on('update-downloaded', () => {
    autoUpdater.quitAndInstall(true, true);
});

autoUpdater.on('error', err => {
    sendToUpdateWindow('updater:error', {
        code: 'AUTO_UPDATER_ERROR',
        message: err?.message || 'Une erreur est survenue pendant la mise a jour.'
    });
});
