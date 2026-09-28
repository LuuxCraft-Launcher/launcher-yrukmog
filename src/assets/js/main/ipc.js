/**
 * @author Luuxis
 * Luuxis License v1.0 (voir fichier LICENSE pour les détails en FR/EN)
 *
 * Point d'entree unique des canaux IPC.
 *
 * Chaque canal est etroit et nomme <domaine>:<action>. Le renderer n'a aucun
 * acces direct a Node : tout passe par ici, et rien n'accepte de chemin de
 * fichier arbitraire.
 */

const { app, ipcMain, nativeTheme, shell } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const os = require('os');

const store = require('./store.js');
const auth = require('./auth.js');
const game = require('./game.js');
const net = require('./net.js');
const assets = require('./assets.js');

function loadPkg() {
    try {
        return require(path.join(app.getAppPath(), 'package.json'));
    } catch (error) {
        return {};
    }
}

function registerIpc({ MainWindow, UpdateWindow }) {
    const pkg = loadPkg();

    // -- Environnement -------------------------------------------------------
    // sendSync : appele une seule fois au chargement du preload, ce qui evite
    // de rendre toute l'API du renderer asynchrone juste pour trois constantes.
    ipcMain.on('env:get', event => {
        event.returnValue = {
            platform: process.platform,
            isDev: process.env.NODE_ENV === 'dev',
            apiUrl: process.env.API_URL || pkg.url || '',
            pkg: {
                name: pkg.name || '',
                version: pkg.version || '',
                url: pkg.url || '',
                repository: pkg.repository || {}
            }
        };
    });

    // -- Fenetres ------------------------------------------------------------
    const mainWin = () => MainWindow.getWindow();
    const updateWin = () => UpdateWindow.getWindow();

    ipcMain.on('window:main:open', () => MainWindow.createWindow());
    ipcMain.on('window:main:close', () => MainWindow.destroyWindow());
    ipcMain.on('window:main:reload', () => mainWin()?.reload());
    ipcMain.on('window:main:minimize', () => mainWin()?.minimize());
    ipcMain.on('window:main:hide', () => mainWin()?.hide());
    ipcMain.on('window:main:show', () => mainWin()?.show());
    ipcMain.on('window:main:devtools', () => mainWin()?.webContents.openDevTools({ mode: 'detach' }));
    ipcMain.on('window:main:devtools-close', () => mainWin()?.webContents.closeDevTools());
    ipcMain.on('window:main:maximize', () => {
        const win = mainWin();
        if (!win) return;
        if (win.isMaximized()) win.unmaximize();
        else win.maximize();
    });
    ipcMain.on('window:main:progress', (_, options) => {
        if (!options?.size) return;
        mainWin()?.setProgressBar(options.progress / options.size);
    });
    ipcMain.on('window:main:progress-reset', () => mainWin()?.setProgressBar(-1));
    ipcMain.on('window:main:progress-load', () => mainWin()?.setProgressBar(2));

    ipcMain.on('window:update:close', () => UpdateWindow.destroyWindow());
    ipcMain.on('window:update:devtools', () => updateWin()?.webContents.openDevTools({ mode: 'detach' }));
    ipcMain.on('window:update:progress', (_, options) => {
        if (!options?.size) return;
        updateWin()?.setProgressBar(options.progress / options.size);
    });
    ipcMain.on('window:update:progress-reset', () => updateWin()?.setProgressBar(-1));
    ipcMain.on('window:update:progress-load', () => updateWin()?.setProgressBar(2));

    // -- Chemins et theme ----------------------------------------------------
    ipcMain.handle('paths:userData', () => app.getPath('userData'));
    ipcMain.handle('paths:appData', () => app.getPath('appData'));

    ipcMain.handle('theme:isDark', (_, theme) => {
        if (theme === 'dark') return true;
        if (theme === 'light') return false;
        return nativeTheme.shouldUseDarkColors;
    });

    // -- Systeme -------------------------------------------------------------
    ipcMain.handle('system:memory', () => ({
        total: os.totalmem(),
        free: os.freemem()
    }));

    // Seuls http/https sortent vers le navigateur : sans ce filtre, un lien
    // social mal forme suffirait a declencher file:// ou un handler systeme.
    ipcMain.handle('shell:openExternal', (_, url) => {
        let parsed;
        try {
            parsed = new URL(url);
        } catch (error) {
            return false;
        }
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
        shell.openExternal(parsed.href);
        return true;
    });

    // -- Ressources locales --------------------------------------------------
    ipcMain.handle('assets:readPanel', (_, id) => assets.readPanel(id));
    ipcMain.handle('assets:listBackgrounds', (_, kind) => assets.listBackgrounds(kind));

    // -- Base de donnees -----------------------------------------------------
    ipcMain.handle('db:create', (_, table, data) => store.createData(table, data));
    ipcMain.handle('db:read', (_, table, key) => store.readData(table, key));
    ipcMain.handle('db:readAll', (_, table) => store.readAllData(table));
    ipcMain.handle('db:update', (_, table, data, key) => store.updateData(table, data, key));
    ipcMain.handle('db:delete', (_, table, key) => store.deleteData(table, key));
    ipcMain.handle('db:initDefault', () => store.initDefaultData());

    // -- Authentification ----------------------------------------------------
    ipcMain.handle('auth:microsoft', (_, clientId) => auth.microsoft(clientId));
    ipcMain.handle('auth:microsoftRefresh', (_, clientId, account) => auth.microsoftRefresh(clientId, account));
    ipcMain.handle('auth:azauthLogin', (_, url, email, password, a2f) => auth.azauthLogin(url, email, password, a2f));
    ipcMain.handle('auth:azauthVerify', (_, url, account) => auth.azauthVerify(url, account));
    ipcMain.handle('auth:mojangLogin', (_, username) => auth.mojangLogin(username));
    ipcMain.handle('auth:mojangRefresh', (_, account) => auth.mojangRefresh(account));

    // -- Reseau --------------------------------------------------------------
    ipcMain.handle('net:status', (_, ip, port) => net.status(ip, port));
    ipcMain.handle('net:rss', (_, url) => net.rss(url));
    ipcMain.handle('net:skin', (_, url) => net.skin(url));

    // -- Jeu -----------------------------------------------------------------
    ipcMain.handle('game:launch', (event, options) => game.launch(event.sender, options));

    // -- Mise a jour ---------------------------------------------------------
    ipcMain.handle('updater:check', async () => {
        try {
            const result = await autoUpdater.checkForUpdates();
            if (!result) return null;
            return {
                updateAvailable: !!result.updateInfo,
                version: result.updateInfo?.version || null
            };
        } catch (error) {
            throw new Error(error?.message || 'Impossible de verifier les mises a jour.');
        }
    });

    ipcMain.on('updater:start', () => autoUpdater.downloadUpdate());
}

module.exports = { registerIpc };
