/**
 * @author Luuxis
 * Luuxis License v1.0 (voir fichier LICENSE pour les détails en FR/EN)
 */
// import panel
import Login from './panels/login.js';
import Home from './panels/home.js';
import Settings from './panels/settings.js';

// import modules
import { logger, config, changePanel, database, popup, setBackground, accountSelect, addAccount, pkg, getErrorCode, getErrorMessage, normalizeError } from './utils.js';
import { ThemeRenderer, applyStyle, applyTokens } from './theme/engine.js';
import { adapters } from './theme/adapters.js';

class Launcher {
    async init() {
        this.initLog();
        console.log('Initializing Launcher...');
        this.shortcut()
        await setBackground()
        this.initFrame();
        this.db = new database();

        try {
            this.config = await config.GetConfig();
            await this.db.initDefaultData();
            await this.initConfigClient();
            await this.createPanels(Login, Home, Settings);
            await this.startLauncher();
        } catch (error) {
            this.configError = normalizeError(error, {
                code: 'CONFIG_ERROR',
                message: 'Impossible de demarrer le launcher.'
            });
            console.error('Launcher initialization failed', this.configError);
            return this.errorConnect();
        }
    }

    initLog() {
        document.addEventListener('keydown', e => {
            if (e.ctrlKey && e.shiftKey && e.keyCode == 73 || e.keyCode == 123) {
                window.luuxAPI.window.closeDevTools();
                window.luuxAPI.window.openDevTools();
            }
        })
        new logger(pkg.name, '#7289da')
    }

    shortcut() {
        document.addEventListener('keydown', e => {
            if (e.ctrlKey && e.keyCode == 87) {
                window.luuxAPI.window.close();
            }
        })
    }


    errorConnect() {
        new popup().openPopup({
            title: getErrorCode(this.configError, 'CONNEXION'),
            content: getErrorMessage(this.configError, 'Impossible de contacter le serveur.'),
            color: 'red',
            exit: true,
            options: true
        });
    }

    initFrame() {
        console.log('Initializing Frame...')
        const platform = window.luuxAPI.env.platform === 'darwin' ? "darwin" : "other";

        document.querySelector(`.${platform} .frame`).classList.toggle('hide')

        document.querySelector(`.${platform} .frame #minimize`).addEventListener('click', () => {
            window.luuxAPI.window.minimize();
        });

        let maximized = false;
        let maximize = document.querySelector(`.${platform} .frame #maximize`);
        maximize.addEventListener('click', () => {
            window.luuxAPI.window.maximize();
            maximized = !maximized
            maximize.classList.toggle('icon-maximize')
            maximize.classList.toggle('icon-restore-down')
        });

        document.querySelector(`.${platform} .frame #close`).addEventListener('click', () => {
            window.luuxAPI.window.close();
        })
    }

    async initConfigClient() {
        console.log('Initializing Config Client...')
        let configClient = await this.db.readData('configClient')

        let defaultConfig = {
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
        }

        if (!configClient) await this.db.createData('configClient', defaultConfig)


        let needUpdate = false

        function deepMerge(target, defaults) {
            for (let key in defaults) {
                if (!(key in target)) {
                    target[key] = defaults[key]
                    needUpdate = true
                } else if (defaults[key] !== null && typeof defaults[key] === 'object' && !Array.isArray(defaults[key]) && target[key] !== null && typeof target[key] === 'object' && !Array.isArray(target[key])) {
                    deepMerge(target[key], defaults[key])
                }
            }
        }
        deepMerge(configClient, defaultConfig)

        if (needUpdate) await this.db.updateData('configClient', configClient)
    }

    /**
     * Le thème est optionnel : toute absence ou erreur ramène aux panneaux HTML
     * statiques. Un panel injoignable ne doit jamais empêcher de jouer.
     */
    async loadTheme() {
        try {
            const theme = await config.getTheme();
            if (!theme?.document) return null;
            console.log('Theme document loaded');
            return theme;
        } catch (error) {
            console.warn('No theme document, falling back to static panels', error);
            return null;
        }
    }

    /**
     * Écran d'un composant sous contrat : les écrans à panneau propre
     * (Connexion, Paramètres) sont routés vers leur panneau, tout le reste
     * (accueil, popup, téléchargement — états superposés) vers l'accueil.
     */
    static panelForView(view) {
        return view === 'settings' || view === 'login' ? view : 'home'
    }

    /**
     * Contrat restreint à un panneau : chaque rendu ne doit garantir (et donc
     * remonter en secours) que les classes de SES composants. Sans ce filtre,
     * le rendu de l'accueil monterait une carte de connexion cachée dont les
     * classes doubleraient celles du vrai panneau Connexion.
     */
    contractFor(theme, panelId) {
        const contract = {}
        for (const [ref, selectors] of Object.entries(theme.contract || {})) {
            const view = theme.contractViews?.[ref] || 'home'
            if (Launcher.panelForView(view) === panelId) contract[ref] = selectors
        }
        return contract
    }

    async createPanels(...panels) {
        let panelsElem = document.querySelector('.panels')
        let theme = await this.loadTheme()
        let renderedPanels = new Set()

        for (let panel of panels) {
            console.log(`Initializing ${panel.name} Panel...`);
            let div = document.createElement('div');
            div.classList.add('panel', panel.id)

            // Le HTML statique sert de repli, et alimente les adaptateurs des
            // écrans à panneau propre (settings-panel, login-card) qui montent
            // cette structure telle quelle dans le cadre de leur nœud.
            const staticHtml = await window.luuxAPI.assets.readPanel(panel.id)

            let rendered = false
            if (theme) {
                const tree = (theme.document.tree || []).filter(
                    (node) => Launcher.panelForView(node?.view) === panel.id,
                )
                // L'accueil se rend même sans nœud (thème vide assumé) ; les
                // autres écrans ne remplacent leur HTML statique que si le
                // thème les décrit réellement, ET que leur composant essentiel
                // (le panneau lui-même) est présent et visible — sinon les
                // commandes de l'écran ne survivraient que cachées via le
                // montage de secours du contrat. L'éditeur l'empêche, mais un
                // document antérieur ou retouché hors éditeur peut l'omettre.
                const essentialRef = { settings: 'settings-panel', login: 'login-card' }[panel.id]
                const hasEssential = !essentialRef
                    || tree.some((node) => node?.componentRef === essentialRef && !node.hidden)
                if ((panel.id === 'home' || tree.length > 0) && hasEssential) {
                    try {
                        new ThemeRenderer({
                            adapters,
                            contract: this.contractFor(theme, panel.id),
                            onWarning: (message, detail) => console.warn(`[theme] ${message}`, detail ?? '')
                        }).render({ ...theme.document, tree }, div, { panelHtml: staticHtml });
                        rendered = true
                        renderedPanels.add(panel.id)
                    } catch (error) {
                        console.error(`Theme rendering failed for ${panel.id}, falling back to static panel`, error);
                    }
                }
            }

            if (!rendered) div.innerHTML = staticHtml;

            panelsElem.appendChild(div);
            new panel().init(this.config);
        }

        // Repli d'habillage : si l'écran Paramètres n'est pas passé par le
        // moteur (rendu en échec), le nœud settings-panel du thème habille
        // au moins le HTML statique comme avant.
        if (theme && !renderedPanels.has('settings')) this.applySettingsTheme(theme.document)
    }

    /**
     * Habillage du panneau Paramètres depuis le nœud `settings-panel` du thème.
     *
     * Le panneau garde son HTML statique (settings.html) : on n'applique que
     * l'apparence — pas de re-render du contenu des onglets. Mais l'apparence
     * elle-même passe par le MÊME traducteur que le moteur de rendu (applyStyle
     * / applyTokens) plutôt qu'une résolution ad hoc de fill/textColor : sans
     * ça, un auteur qui règle un rayon, une ombre ou un flou d'arrière-plan sur
     * ce nœud le verrait dans l'éditeur mais jamais dans le launcher.
     */
    applySettingsTheme(themeDocument) {
        try {
            const node = (themeDocument.tree || []).find(
                (n) => n?.view === 'settings' && n?.componentRef === 'settings-panel' && !n?.hidden,
            )
            if (!node) return

            const panel = document.querySelector('.panel.settings')
            if (!panel) return

            applyTokens(themeDocument.tokens, panel)
            applyStyle(panel, node.style)

            // --background / --color pilotent en interne le reste du CSS du
            // panneau (boutons de nav actifs, cartes...) : les garder alignées
            // sur ce qu'applyStyle vient de poser.
            const bg = panel.style.getPropertyValue('background-color')
            if (bg) panel.style.setProperty('--background', bg)
            const color = panel.style.getPropertyValue('color')
            if (color) panel.style.setProperty('--color', color)

            const title = typeof node.props?.title === 'string' ? node.props.title.trim() : ''
            if (title) {
                const heading = panel.querySelector('.nav-settings p')
                if (heading) heading.textContent = title
            }
        } catch (error) {
            console.warn('Settings theme skipped', error)
        }
    }

    async startLauncher() {
        let accounts = await this.db.readAllData('accounts')
        let configClient = await this.db.readData('configClient')
        let account_selected = configClient ? configClient.account_selected : null
        let popupRefresh = new popup();
        let refreshedAccounts = [];
        let refreshErrors = [];

        if (accounts?.length) {
            for (let account of accounts) {
                let account_ID = account.ID
                if (account.error) {
                    await this.db.deleteData('accounts', account_ID)
                    continue
                }
                popupRefresh.openPopup({
                    title: 'Connexion',
                    content: `Verification du compte ${account.name}...`,
                    color: 'var(--color)',
                    background: false
                });

                const refreshResult = await this.refreshAccount(account);

                if (!refreshResult.success) {
                    refreshErrors.push(refreshResult.error);
                    if (account_ID == account_selected) {
                        configClient.account_selected = null
                        await this.db.updateData('configClient', configClient)
                    }
                    console.error(`[Account] ${account.name}:`, refreshResult.error);
                    continue;
                }

                refreshedAccounts.push(refreshResult.account);
                await addAccount(refreshResult.account)
                if (account_ID == account_selected) accountSelect(refreshResult.account)
            }

            accounts = refreshedAccounts
            configClient = await this.db.readData('configClient')
            account_selected = configClient ? configClient.account_selected : null

            if (!account_selected) {
                let firstAccount = accounts[0]
                if (firstAccount?.ID) {
                    configClient.account_selected = firstAccount.ID
                    await this.db.updateData('configClient', configClient)
                    accountSelect(firstAccount)
                }
            }

            if (!accounts.length) {
                configClient.account_selected = null
                await this.db.updateData('configClient', configClient);
                popupRefresh.closePopup()
                if (refreshErrors.length) {
                    const firstError = refreshErrors[0];
                    new popup().openPopup({
                        title: 'Connexion requise',
                        content: `${getErrorMessage(firstError, 'Aucun compte n a pu etre rafraichi.')}<br>Veuillez vous reconnecter.`,
                        color: 'red',
                        options: true
                    });
                }
                return changePanel("login");
            }

            popupRefresh.closePopup()
            changePanel("home");
        } else {
            popupRefresh.closePopup()
            changePanel('login');
        }
    }

    async refreshAccount(account) {
        const account_ID = account.ID;

        try {
            if (account.meta.type === 'Xbox') {
                let refreshAccount = await window.luuxAPI.auth.microsoftRefresh(this.config.client_id, account);

                if (refreshAccount.error) {
                    throw new Error(refreshAccount.errorMessage || 'Echec du rafraichissement Microsoft.');
                }

                refreshAccount.ID = account_ID;
                await this.db.updateData('accounts', refreshAccount, account_ID);
                return { success: true, account: refreshAccount };
            }

            if (account.meta.type === 'AZauth') {
                let refreshAccount = await window.luuxAPI.auth.azauthVerify(this.config.online, account);

                if (refreshAccount.error) {
                    throw new Error(refreshAccount.message || 'Echec du rafraichissement AZauth.');
                }

                refreshAccount.ID = account_ID;
                await this.db.updateData('accounts', refreshAccount, account_ID);
                return { success: true, account: refreshAccount };
            }

            if (account.meta.type === 'Mojang') {
                let refreshAccount = account.meta.online == false
                    ? await window.luuxAPI.auth.mojangLogin(account.name)
                    : await window.luuxAPI.auth.mojangRefresh(account);

                if (refreshAccount.error) {
                    throw new Error(refreshAccount.errorMessage || refreshAccount.message || 'Echec du rafraichissement Mojang.');
                }

                refreshAccount.ID = account_ID;
                await this.db.updateData('accounts', refreshAccount, account_ID);
                return { success: true, account: refreshAccount };
            }

            throw new Error('Type de compte inconnu.');
        } catch (error) {
            return {
                success: false,
                error: normalizeError(error, {
                    code: 'ACCOUNT_REFRESH_ERROR',
                    message: `Impossible de rafraichir le compte ${account.name}.`
                })
            };
        }
    }
}

new Launcher().init();
