/**
 * @author Luuxis
 * Luuxis License v1.0 (voir fichier LICENSE pour les détails en FR/EN)
 *
 * Preload de la fenetre principale (launcher.html).
 *
 * Expose window.luuxAPI. Volontairement auto-portant : un preload sandboxe ne
 * peut pas require() de fichier local, et surtout chaque fenetre ne doit voir
 * que ce dont elle a besoin. La fenetre de mise a jour a son propre preload,
 * bien plus restreint.
 */

const { contextBridge, ipcRenderer, webUtils } = require('electron');

const env = ipcRenderer.sendSync('env:get');

/**
 * N'expose jamais l'objet IpcRendererEvent au renderer : il porte une
 * reference au sender, donc un chemin de retour vers le main process.
 */
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
        close: () => ipcRenderer.send('window:main:close'),
        reload: () => ipcRenderer.send('window:main:reload'),
        minimize: () => ipcRenderer.send('window:main:minimize'),
        maximize: () => ipcRenderer.send('window:main:maximize'),
        hide: () => ipcRenderer.send('window:main:hide'),
        show: () => ipcRenderer.send('window:main:show'),
        openDevTools: () => ipcRenderer.send('window:main:devtools'),
        closeDevTools: () => ipcRenderer.send('window:main:devtools-close'),
        setProgress: (progress, size) => ipcRenderer.send('window:main:progress', { progress, size }),
        resetProgress: () => ipcRenderer.send('window:main:progress-reset'),
        loadProgress: () => ipcRenderer.send('window:main:progress-load')
    },

    paths: {
        userData: () => ipcRenderer.invoke('paths:userData'),
        appData: () => ipcRenderer.invoke('paths:appData')
    },

    theme: {
        isDark: theme => ipcRenderer.invoke('theme:isDark', theme)
    },

    system: {
        memory: () => ipcRenderer.invoke('system:memory')
    },

    shell: {
        openExternal: url => ipcRenderer.invoke('shell:openExternal', url)
    },

    assets: {
        readPanel: id => ipcRenderer.invoke('assets:readPanel', id),
        listBackgrounds: kind => ipcRenderer.invoke('assets:listBackgrounds', kind)
    },

    db: {
        create: (table, data) => ipcRenderer.invoke('db:create', table, data),
        read: (table, key) => ipcRenderer.invoke('db:read', table, key),
        readAll: table => ipcRenderer.invoke('db:readAll', table),
        update: (table, data, key) => ipcRenderer.invoke('db:update', table, data, key),
        delete: (table, key) => ipcRenderer.invoke('db:delete', table, key),
        initDefault: () => ipcRenderer.invoke('db:initDefault')
    },

    auth: {
        microsoft: clientId => ipcRenderer.invoke('auth:microsoft', clientId),
        microsoftRefresh: (clientId, account) => ipcRenderer.invoke('auth:microsoftRefresh', clientId, account),
        azauthLogin: (url, email, password, a2f) => ipcRenderer.invoke('auth:azauthLogin', url, email, password, a2f),
        azauthVerify: (url, account) => ipcRenderer.invoke('auth:azauthVerify', url, account),
        mojangLogin: username => ipcRenderer.invoke('auth:mojangLogin', username),
        mojangRefresh: account => ipcRenderer.invoke('auth:mojangRefresh', account)
    },

    net: {
        status: (ip, port) => ipcRenderer.invoke('net:status', ip, port),
        rss: url => ipcRenderer.invoke('net:rss', url),
        skin: url => ipcRenderer.invoke('net:skin', url)
    },

    game: {
        launch: options => ipcRenderer.invoke('game:launch', options),
        onEvent: callback => subscribe('game:event', callback)
    },

    file: {
        // getPathForFile remplace l'ancien File.path, retire par Electron.
        // Seul le preload y a acces.
        getPath: file => {
            try {
                return webUtils?.getPathForFile?.(file) || null;
            } catch (error) {
                return null;
            }
        }
    }
});
