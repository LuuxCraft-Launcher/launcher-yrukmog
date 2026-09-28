/**
 * @author Luuxis
 * Luuxis License v1.0 (voir fichier LICENSE pour les détails en FR/EN)
 *
 * Acces reseau qui ne peut pas rester dans le renderer :
 *  - status : ping TCP Minecraft (socket Node)
 *  - rss    : parsing XML via xml-js, et evite d'ouvrir connect-src a https:
 *  - skin   : le renderer dessine la tete sur un canvas puis appelle
 *             toDataURL(). Charger la texture depuis une origine distante
 *             tainterait le canvas, donc on rapatrie en data: URL ici.
 */

const { Status } = require('minecraft-java-core');
const convert = require('xml-js');

async function status(ip, port) {
    try {
        const result = await new Status(ip, port).getStatus();
        if (result?.error) return { online: false };
        return {
            online: true,
            ms: result?.ms ?? 0,
            playersConnect: result?.playersConnect ?? 0
        };
    } catch (error) {
        return { online: false };
    }
}

async function rss(url) {
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) {
        throw new Error(`Le flux RSS a repondu ${response.status}.`);
    }

    const text = await response.text();
    const items = JSON.parse(convert.xml2json(text, { compact: true }))?.rss?.channel?.item;
    const list = Array.isArray(items) ? items : items ? [items] : [];

    return list.map(item => ({
        title: item?.title?._text || 'Actualite',
        content: item?.['content:encoded']?._text || item?.description?._text || '',
        author: item?.['dc:creator']?._text || 'Equipe',
        publish_date: item?.pubDate?._text || new Date().toISOString()
    }));
}

async function skin(url) {
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) throw new Error(`Skin indisponible (${response.status}).`);

    const buffer = Buffer.from(await response.arrayBuffer());
    const type = response.headers.get('content-type') || 'image/png';
    return `data:${type};base64,${buffer.toString('base64')}`;
}

module.exports = { status, rss, skin };
