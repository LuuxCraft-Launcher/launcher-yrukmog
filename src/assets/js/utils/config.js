/**
 * @author Luuxis
 * Luuxis License v1.0 (voir fichier LICENSE pour les détails en FR/EN)
 */

import { LauncherError, normalizeError, createHttpError } from './error.js';
let url = window.luuxAPI.env.apiUrl;

let config = `${url}/config`;
let articles = `${url}/articles`;

class Config {
    async request(resource, options = {}) {
        const {
            timeout = 10000,
            retries = 1,
            parse = 'json',
            fallbackMessage = 'Le serveur est inaccessible.'
        } = options;

        let lastError = null;

        for (let attempt = 0; attempt <= retries; attempt++) {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), timeout);

            try {
                const response = await fetch(resource, { signal: controller.signal, cache: 'no-store' });
                clearTimeout(timeoutId);

                if (!response.ok) {
                    throw createHttpError(response, fallbackMessage);
                }

                if (parse === 'text') return await response.text();
                return await response.json();
            } catch (error) {
                clearTimeout(timeoutId);

                const isAbort = error?.name === 'AbortError';
                lastError = error instanceof LauncherError
                    ? error
                    : new LauncherError({
                        code: isAbort ? 'REQUEST_TIMEOUT' : 'NETWORK_ERROR',
                        message: isAbort ? 'Le serveur a mis trop de temps a repondre.' : fallbackMessage,
                        details: error?.message || null,
                        retryable: true,
                        cause: error
                    });

                if (attempt < retries) {
                    await new Promise(resolve => setTimeout(resolve, 300 * (attempt + 1)));
                    continue;
                }
            }
        }

        throw normalizeError(lastError, {
            code: 'NETWORK_ERROR',
            message: fallbackMessage,
            retryable: true
        });
    }

    async GetConfig() {
        return await this.request(config, {
            retries: 1,
            fallbackMessage: 'Impossible de recuperer la configuration du launcher.'
        });
    }

    /**
     * Document de thème appliqué au démarrage, en remplacement des placeholders
     * resolus au build. Renvoie null si le panel n'en sert pas : l'appelant
     * retombe alors sur les panneaux HTML statiques.
     */
    async getTheme() {
        const payload = await this.request(`${url}/theme`, {
            retries: 0,
            fallbackMessage: 'Impossible de recuperer le theme du launcher.'
        });
        if (!payload || typeof payload !== 'object') return null;
        return {
            document: payload.document || null,
            contract: payload.contract && typeof payload.contract === 'object' ? payload.contract : {},
            // Écran de chaque composant sous contrat : permet à launcher.js de
            // ne garantir dans chaque panneau que les classes de SES composants.
            contractViews: payload.contractViews && typeof payload.contractViews === 'object' ? payload.contractViews : {}
        };
    }

    async getInstanceList() {
        const urlInstance = `${url}/instances`;
        const instances = await this.request(urlInstance, {
            retries: 1,
            fallbackMessage: 'Impossible de recuperer la liste des instances.'
        });

        if (!instances || typeof instances !== 'object' || Array.isArray(instances)) {
            throw new LauncherError({
                code: 'INVALID_INSTANCES_RESPONSE',
                message: 'La reponse du serveur pour les instances est invalide.'
            });
        }

        return [...Object.values(instances)];
    }

    async getNews(config) {
        if (config.rss) {
            // Recupere et parse cote main : le flux pointe vers une origine
            // arbitraire, l'autoriser dans connect-src viderait la CSP de son
            // sens, et le parsing XML dependait d'un module Node.
            try {
                return await window.luuxAPI.net.rss(config.rss);
            } catch (error) {
                throw normalizeError(error, {
                    code: 'NETWORK_ERROR',
                    message: 'Impossible de recuperer le flux des actualites.',
                    retryable: true
                });
            }
        }

        const news = await this.request(articles, {
            retries: 1,
            fallbackMessage: 'Impossible de recuperer les actualites.'
        });

        if (!Array.isArray(news)) {
            throw new LauncherError({
                code: 'INVALID_NEWS_RESPONSE',
                message: 'La reponse du serveur pour les actualites est invalide.'
            });
        }

        return news;
    }
}

export default new Config;