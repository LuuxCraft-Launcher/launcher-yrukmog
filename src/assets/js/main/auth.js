/**
 * @author Luuxis
 * Luuxis License v1.0 (voir fichier LICENSE pour les détails en FR/EN)
 *
 * Authentification Minecraft cote main process.
 * minecraft-java-core est une lib Node : elle ne peut plus vivre dans le
 * renderer une fois nodeIntegration desactive.
 */

const { AZauth, Microsoft, Mojang } = require('minecraft-java-core');

async function microsoft(clientId) {
    return await new Microsoft(clientId).getAuth();
}

async function microsoftRefresh(clientId, account) {
    return await new Microsoft(clientId).refresh(account);
}

async function azauthLogin(url, email, password, a2f) {
    const client = new AZauth(url);
    return a2f
        ? await client.login(email, password, a2f)
        : await client.login(email, password);
}

async function azauthVerify(url, account) {
    return await new AZauth(url).verify(account);
}

async function mojangLogin(username) {
    return await Mojang.login(username);
}

async function mojangRefresh(account) {
    return await Mojang.refresh(account);
}

module.exports = {
    microsoft,
    microsoftRefresh,
    azauthLogin,
    azauthVerify,
    mojangLogin,
    mojangRefresh
};
