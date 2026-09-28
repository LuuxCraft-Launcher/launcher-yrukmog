/**
 * @author Luuxis
 * Luuxis License v1.0 (voir fichier LICENSE pour les détails en FR/EN)
 *
 * Lancement du jeu cote main process.
 *
 * Le renderer ne peut plus instancier Launch (lib Node). Il envoie les options
 * via IPC et recoit les evenements de progression sur un canal unique
 * 'game:event'. Un seul lancement a la fois, comme le comportement d'origine.
 */

const { Launch } = require('minecraft-java-core');

const FORWARDED_EVENTS = [
    'extract',
    'progress',
    'check',
    'estimated',
    'speed',
    'patch',
    'data',
    'close',
    'error'
];

let running = false;

function serializeError(error) {
    if (!error) return { message: 'Le jeu n a pas pu etre lance.' };
    if (typeof error === 'string') return { message: error };
    return {
        code: error.code || 'GAME_LAUNCH_ERROR',
        message: error.message || error.error || 'Le jeu n a pas pu etre lance.',
        error: typeof error.error === 'string' ? error.error : undefined
    };
}

function launch(webContents, options) {
    if (running) return { started: false, reason: 'already_running' };

    running = true;
    const launcher = new Launch();

    const send = (type, args) => {
        if (webContents.isDestroyed()) return;
        webContents.send('game:event', { type, args });
    };

    for (const type of FORWARDED_EVENTS) {
        launcher.on(type, (...args) => {
            if (type === 'close' || type === 'error') running = false;
            // Les objets Error ne survivent pas au structured clone : on aplatit.
            send(type, type === 'error' ? [serializeError(args[0])] : args);
        });
    }

    try {
        launcher.Launch(options);
    } catch (error) {
        running = false;
        send('error', [serializeError(error)]);
        return { started: false, reason: 'launch_threw' };
    }

    return { started: true };
}

module.exports = { launch };
