/**
 * @author Luuxis
 * Luuxis License v1.0 (voir fichier LICENSE pour les détails en FR/EN)
 *
 * Lectures disque faites pour le compte du renderer.
 *
 * Ces chemins etaient construits cote renderer avec __dirname (= le dossier de
 * la page HTML, donc src/). Ici on repart de app.getAppPath(). Le build
 * reecrit 'src/' en 'app/' dans les litteraux, donc les deux modes marchent.
 */

const { app } = require('electron');
const path = require('path');
const fs = require('fs');

const PANELS = ['home', 'login', 'settings'];
const BACKGROUND_KINDS = ['dark', 'light', 'easterEgg'];

/**
 * Le renderer ne passe qu'un id de panel connu : pas de chemin arbitraire.
 *
 * Les litteraux gardent leur 'src/' : build.js le reecrit en 'app/', et un
 * chemin sans slash final passerait au travers de cette reecriture.
 */
function readPanel(id) {
    if (!PANELS.includes(id)) throw new Error(`Panel inconnu : ${id}`);
    return fs.readFileSync(path.join(app.getAppPath(), 'src/panels', `${id}.html`), 'utf8');
}

/**
 * Renvoie les noms de fichiers d'un dossier de fonds, ou [] s'il n'existe pas.
 * Le renderer reconstruit ensuite une URL relative a la page.
 */
function listBackgrounds(kind) {
    if (!BACKGROUND_KINDS.includes(kind)) return [];

    const dir = path.join(app.getAppPath(), 'src/assets/images/background', kind);
    if (!fs.existsSync(dir)) return [];

    return fs.readdirSync(dir).filter(name => !name.startsWith('.'));
}

module.exports = { readPanel, listBackgrounds };
