/**
 * @author Luuxis
 * Luuxis License v1.0 (voir fichier LICENSE pour les détails en FR/EN)
 */

const pkg = window.luuxAPI.env.pkg;

import config from './utils/config.js';
import database from './utils/database.js';
import logger from './utils/logger.js';
import popup from './utils/popup.js';
import { getErrorCode, getErrorMessage, normalizeError } from './utils/error.js';
import { skin2D } from './utils/skin.js';
import slider from './utils/slider.js';

async function setBackground(theme) {
    if (typeof theme == 'undefined') {
        let databaseLauncher = new database();
        let configClient = await databaseLauncher.readData('configClient');
        theme = configClient?.launcher_config?.theme || "auto"
        theme = await window.luuxAPI.theme.isDark(theme)
    }
    let background
    let body = document.body;
    body.className = theme ? 'dark global' : 'light global';

    let pick = list => list[Math.floor(Math.random() * list.length)];

    let easterEgg = Math.random() < 0.005 ? await window.luuxAPI.assets.listBackgrounds('easterEgg') : [];

    if (easterEgg.length) {
        background = `url(./assets/images/background/easterEgg/${pick(easterEgg)})`;
    } else {
        let kind = theme ? 'dark' : 'light';
        let backgrounds = await window.luuxAPI.assets.listBackgrounds(kind);
        // Un dossier vide donnait auparavant une url(undefined) : on retombe
        // desormais sur la couleur unie.
        if (backgrounds.length) {
            background = `linear-gradient(#00000080, #00000080), url(./assets/images/background/${kind}/${pick(backgrounds)})`;
        }
    }

    body.style.backgroundImage = background ? background : theme ? '#000' : '#fff';
    body.style.backgroundSize = 'cover';
}

async function changePanel(id) {
    let panel = document.querySelector(`.${id}`);
    let active = document.querySelector(`.active`)
    if (active) active.classList.toggle("active");
    panel.classList.add("active");
}

async function appdata() {
    return await window.luuxAPI.paths.appData()
}

async function addAccount(data) {
    let skin = false
    if (data?.profile?.skins[0]?.base64) skin = await new skin2D().creatHeadTexture(data.profile.skins[0].base64);
    let div = document.createElement("div");
    div.classList.add("account");
    div.id = data.ID;
    div.innerHTML = `
        <div class="profile-image" ${skin ? 'style="background-image: url(' + skin + ');"' : ''}></div>
        <div class="profile-infos">
            <div class="profile-pseudo">${data.name}</div>
            <div class="profile-uuid">${data.uuid}</div>
        </div>
        <div class="delete-profile" id="${data.ID}">
            <div class="icon-account-delete delete-profile-icon"></div>
        </div>
    `
    return document.querySelector('.accounts-list').appendChild(div);
}

async function accountSelect(data) {
    let account = document.getElementById(`${data.ID}`);
    let activeAccount = document.querySelector('.account-select')

    if (activeAccount) activeAccount.classList.toggle('account-select');
    account.classList.add('account-select');
    if (data?.profile?.skins[0]?.base64) headplayer(data.profile.skins[0].base64);
}

async function headplayer(skinBase64) {
    let skin = await new skin2D().creatHeadTexture(skinBase64);
    document.querySelector(".player-head").style.backgroundImage = `url(${skin})`;
}

async function setStatus(opt) {
    let nameServerElement = document.querySelector('.server-status-name')
    let statusServerElement = document.querySelector('.server-status-text')
    let playersOnline = document.querySelector('.status-player-count .player-count')

    // Réglage posé par l'adaptateur server-status du thème : masquer la
    // latence. Sans thème, comportement historique (ping affiché).
    const hidePing = document.querySelector('.server-status-infos')?.dataset.hidePing === 'true'

    if (!opt) {
        statusServerElement.classList.add('red')
        statusServerElement.innerHTML = hidePing ? 'Ferme' : `Ferme - 0 ms`
        document.querySelector('.status-player-count').classList.add('red')
        playersOnline.innerHTML = '0'
        return
    }

    let { ip, port, nameServer } = opt
    nameServerElement.innerHTML = nameServer
    let statusServer = await window.luuxAPI.net.status(ip, port);

    if (statusServer.online) {
        statusServerElement.classList.remove('red')
        document.querySelector('.status-player-count').classList.remove('red')
        statusServerElement.innerHTML = hidePing ? 'En ligne' : `En ligne - ${statusServer.ms ? statusServer.ms : 0} ms`
        playersOnline.innerHTML = statusServer.playersConnect ? statusServer.playersConnect : '0'
    } else {
        statusServerElement.classList.add('red')
        statusServerElement.innerHTML = hidePing ? 'Ferme' : `Ferme - 0 ms`
        document.querySelector('.status-player-count').classList.add('red')
        playersOnline.innerHTML = '0'
    }
}


export {
    appdata as appdata,
    changePanel as changePanel,
    config as config,
    database as database,
    logger as logger,
    popup as popup,
    getErrorCode as getErrorCode,
    getErrorMessage as getErrorMessage,
    normalizeError as normalizeError,
    setBackground as setBackground,
    skin2D as skin2D,
    addAccount as addAccount,
    accountSelect as accountSelect,
    slider as Slider,
    pkg as pkg,
    setStatus as setStatus
}