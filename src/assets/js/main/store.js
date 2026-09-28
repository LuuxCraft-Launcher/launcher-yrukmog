/**
 * @author Luuxis
 * Luuxis License v1.0 (voir fichier LICENSE pour les détails en FR/EN)
 *
 * Base de données du launcher, cote main process.
 * Portage de l'ancien src/assets/js/utils/database.js qui tournait dans le
 * renderer avec electron-store + fs + crypto. Le format de stockage et la
 * derivation de la cle sont identiques pour rester compatible avec les
 * donnees deja presentes chez les utilisateurs.
 */

const { app } = require('electron');
const Store = require('electron-store');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');

let dev = process.env.NODE_ENV === 'dev';

const DEFAULT_CONFIG_CLIENT = {
    account_selected: null,
    instance_select: null,
    java_config: {
        java_path: null,
        java_memory: {
            min: 2,
            max: 4
        }
    },
    game_config: {
        screen_size: {
            width: 854,
            height: 480
        }
    },
    launcher_config: {
        download_multi: 5,
        theme: 'auto',
        closeLauncher: 'close-launcher',
        intelEnabledMac: true
    }
};

let store = null;

function getKey(length, userDataPath) {
    const keyPath = path.join(userDataPath, 'key.txt');

    if (fs.existsSync(keyPath)) return fs.readFileSync(keyPath, 'utf-8');

    const key = crypto.randomBytes(length).toString('hex');
    fs.writeFileSync(keyPath, key);
    return key;
}

function initStore() {
    if (store) return store;

    const userDataPath = app.getPath('userData');
    store = new Store({
        name: 'launcher-data',
        cwd: userDataPath,
        encryptionKey: dev ? undefined : getKey(32, userDataPath)
    });
    return store;
}

function createData(tableName, data) {
    const db = initStore();
    const tableData = db.get(tableName, []);

    const maxId = tableData.length > 0
        ? Math.max(...tableData.map(item => item.ID || 0))
        : 0;

    data.ID = maxId + 1;
    tableData.push(data);
    db.set(tableName, tableData);
    return data;
}

function readData(tableName, key = 1) {
    const db = initStore();
    const tableData = db.get(tableName, []);
    const data = tableData.find(item => item.ID === key);
    return data ? data : undefined;
}

function readAllData(tableName) {
    return initStore().get(tableName, []);
}

function updateData(tableName, data, key = 1) {
    const db = initStore();
    const tableData = db.get(tableName, []);
    const index = tableData.findIndex(item => item.ID === key);

    data.ID = key;
    if (index !== -1) tableData[index] = data;
    else tableData.push(data);

    db.set(tableName, tableData);
}

function deleteData(tableName, key = 1) {
    const db = initStore();
    let tableData = db.get(tableName, []);
    tableData = tableData.filter(item => item.ID !== key);
    db.set(tableName, tableData);
}

async function ensureData(tableName, defaultData, key = 1, maxRetries = 5) {
    let retries = 0;
    while (retries < maxRetries) {
        try {
            const existingData = readData(tableName, key);
            if (existingData) return existingData;
            defaultData.ID = key;
            createData(tableName, defaultData);
            return defaultData;
        } catch (error) {
            retries++;
            await new Promise(resolve => setTimeout(resolve, 100 * retries));
        }
    }
}

async function initDefaultData() {
    // structuredClone evite que ensureData mute l'objet partage en y posant un ID.
    return await ensureData('configClient', structuredClone(DEFAULT_CONFIG_CLIENT));
}

module.exports = {
    createData,
    readData,
    readAllData,
    updateData,
    deleteData,
    ensureData,
    initDefaultData,
    DEFAULT_CONFIG_CLIENT
};
