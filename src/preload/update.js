/**
 * @author Luuxis
 * Luuxis License v1.0 (voir fichier LICENSE pour les détails en FR/EN)
 *
 * Preload de la fenetre de mise a jour (index.html).
 *
 * Surface deliberement minimale : ce splash n'a pas a pouvoir lancer le jeu,
 * s'authentifier ni ecrire en base. Il lit le theme, suit l'updater, et ouvre
 * la fenetre principale quand tout est pret.
 */

const { contextBridge, ipcRenderer } = require('electron');

const env = ipcRenderer.sendSync('env:get');

function subscribe(channel, callback) {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on(channel, listener);
    return () => ipcRenderer.removeListener(channel, listener);
}

contextBridge.exposeInMainWorld('luuxAPI', {
    env: Object.freeze({
        platform: env.platform,
        isDev: env.isDev,
        apiUrl: env.apiUrl,
        pkg: Object.freeze(env.pkg)
    }),

    window: {
        close: () => ipcRenderer.send('window:update:close'),
        openDevTools: () => ipcRenderer.send('window:update:devtools'),
        setProgress: (progress, size) => ipcRenderer.send('window:update:progress', { progress, size }),
        resetProgress: () => ipcRenderer.send('window:update:progress-reset'),
        loadProgress: () => ipcRenderer.send('window:update:progress-load'),
        openMain: () => ipcRenderer.send('window:main:open')
    },

    theme: {
        isDark: theme => ipcRenderer.invoke('theme:isDark', theme)
    },

    shell: {
        openExternal: url => ipcRenderer.invoke('shell:openExternal', url)
    },

    db: {
        read: (table, key) => ipcRenderer.invoke('db:read', table, key)
    },

    updater: {
        check: () => ipcRenderer.invoke('updater:check'),
        start: () => ipcRenderer.send('updater:start'),
        onAvailable: callback => subscribe('updater:available', callback),
        onNotAvailable: callback => subscribe('updater:not-available', callback),
        onProgress: callback => subscribe('updater:progress', callback),
        onError: callback => subscribe('updater:error', callback)
    }
});
