/**
 * @author Luuxis
 * Luuxis License v1.0 (voir fichier LICENSE pour les détails en FR/EN)
 *
 * Adaptateurs de composants pour le launcher.
 *
 * Chaque adaptateur reproduit exactement la structure de classes de
 * panels/home.html. C'est ce qui permet à panels/home.js de fonctionner sans la
 * moindre modification : il continue de trouver .play-btn, .news-list, etc., et
 * le CSS existant (à sélecteurs plats) s'applique tel quel.
 *
 * Les propriétés protégées ne sont jamais lues ici : les données et les
 * gestionnaires d'événements restent posés par home.js après le montage.
 */

/** Le cadre du nœud porte la géométrie ; le composant le remplit. */
function fill(element) {
    element.style.width = '100%';
    element.style.height = '100%';
    element.style.margin = '0';
    return element;
}

function el(tag, className, parent) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (parent) parent.appendChild(node);
    return node;
}

export const adapters = {
    'play-button': {
        mount(root, props) {
            const playInstance = fill(el('div', 'play-instance', root));
            const btn = el('button', 'play-btn', playInstance);
            btn.textContent = typeof props.label === 'string' && props.label ? props.label : 'Jouer';

            const select = el('div', 'instance-select icon-arrow', playInstance);
            // home.js masque déjà ce sélecteur quand il n'y a qu'une instance ;
            // ici c'est le choix explicite de l'auteur du thème.
            if (props.instanceSelectorVisible === false) {
                select.style.display = 'none';
                playInstance.style.paddingRight = '0';
            }
        },
    },

    'progress-bar': {
        mount(root, props) {
            // .info-starting-game est masqué par le CSS et révélé par
            // startGame() : on ne touche pas à son display.
            const box = el('div', 'info-starting-game', root);
            box.style.width = '100%';

            const text = el('div', 'info-starting-game-text', box);
            text.textContent = 'Connexion...';

            const progress = el('progress', 'progress-bar', box);
            progress.value = 0;
            progress.max = 0;
            progress.style.width = '100%';

            if (props.showPercentage === false) text.dataset.hidePercentage = 'true';
            if (props.showSpeed === true) text.dataset.showSpeed = 'true';
        },
    },

    'instance-popup': {
        mount(root, props, ctx) {
            // Le cadre du nœud est le PANNEAU de la popup : l'auteur du thème le
            // place et le dimensionne dans l'éditeur. L'overlay (voile + zone de
            // fermeture) doit couvrir tout l'écran : il déborde du wrapper en
            // coordonnées négatives, theme-root (overflow hidden) le rogne au
            // cadre. `.instance-popup` reste l'élément que home.js affiche et
            // masque, et il contient voile ET panneau — fermé, rien ne subsiste.
            root.style.pointerEvents = 'none';

            const t = ctx?.node?.transform;
            const canvas = ctx?.canvas;
            // Repli héritage : les documents d'avant la refonte ont une popup
            // plein canvas (0,0,1280,720) — leur cadre décrivait l'overlay, pas
            // le panneau. Les traiter comme « framed » donnerait un panneau
            // plein écran. Un cadre couvrant tout le canvas, ou un nœud sans
            // `view` (jamais revalidé), retombe donc sur le CSS d'origine :
            // overlay 100 % + panneau centré auto-dimensionné.
            const fullCanvas = t && canvas
                && t.x <= 0 && t.y <= 0
                && t.x + t.width >= canvas.width && t.y + t.height >= canvas.height;
            const framed = typeof ctx?.node?.view === 'string' && !fullCanvas
                && t && t.width > 0 && t.height > 0 && canvas?.width > 0 && canvas?.height > 0;

            const popup = el('div', 'instance-popup', root);
            popup.style.pointerEvents = 'auto';
            if (framed) {
                popup.style.position = 'absolute';
                popup.style.left = `${(-t.x / t.width) * 100}%`;
                popup.style.top = `${(-t.y / t.height) * 100}%`;
                popup.style.width = `${(canvas.width / t.width) * 100}%`;
                popup.style.height = `${(canvas.height / t.height) * 100}%`;
            }

            const tab = el('div', 'instances-tab', popup);
            if (framed) {
                tab.style.position = 'absolute';
                tab.style.left = `${(t.x / canvas.width) * 100}%`;
                tab.style.top = `${(t.y / canvas.height) * 100}%`;
                tab.style.width = `${(t.width / canvas.width) * 100}%`;
                tab.style.height = `${(t.height / canvas.height) * 100}%`;
                tab.style.transform = 'none';
                tab.style.margin = '0';
                tab.style.boxSizing = 'border-box';
                // Panneau à taille fixe : la liste doit défiler dedans, pas
                // déborder dessous.
                tab.style.overflow = 'hidden';
                tab.style.display = 'flex';
                tab.style.flexDirection = 'column';
            }

            // Le moteur pose le style du nœud (fond, rayon, ombre…) sur le
            // wrapper ; ici le wrapper reste visible popup fermée, donc ces
            // styles doivent suivre le panneau.
            const VISUAL_PROPS = [
                'background-color', 'color', 'text-align', 'border-radius', 'opacity',
                'font-size', 'font-weight', 'letter-spacing', 'padding', 'gap',
                'line-height', 'border', 'box-shadow', 'backdrop-filter',
                '-webkit-backdrop-filter', 'font-family',
            ];
            for (const prop of VISUAL_PROPS) {
                const value = root.style.getPropertyValue(prop);
                if (value) {
                    tab.style.setProperty(prop, value);
                    root.style.removeProperty(prop);
                }
            }

            el('div', 'close-popup icon-close', tab);

            const title = el('p', null, tab);
            title.textContent = typeof props.title === 'string' && props.title
                ? props.title
                : 'Choisissez votre instance...';

            const list = el('div', 'instances-List content-scroll', tab);
            if (framed) {
                list.style.flex = '1 1 auto';
                list.style.minHeight = '0';
                list.style.overflowY = 'auto';
            }
        },
    },

    'server-status': {
        mount(root, props) {
            const status = fill(el('div', 'status-server', root));

            if (props.showIcon !== false) {
                const icon = el('img', 'server-status-icon', status);
                icon.src = 'assets/images/icon/icon.png';
            }

            const infos = el('div', 'server-status-infos', status);
            el('div', 'server-status-name', infos).textContent = 'Minecraft';
            el('div', 'server-status-text', infos).textContent = 'Chargement...';

            // Toujours présent, même masqué : utils.js setStatus() écrit dedans
            // sans vérifier son existence.
            const count = el('div', 'status-player-count', status);
            el('div', 'player-count', count).textContent = '0';
            if (props.showPlayerCount === false) count.style.display = 'none';
            if (props.showPing === false) infos.dataset.hidePing = 'true';
        },
    },

    'news-feed': {
        mount(root, props) {
            const tab = fill(el('div', 'new-tab', root));

            if (typeof props.title === 'string' && props.title !== '') {
                el('div', 'titre-tab-new', tab).textContent = props.title;
            }

            const list = el('div', 'news-list content-scroll', tab);
            if (Number.isFinite(props.maxItems)) list.dataset.maxItems = String(props.maxItems);
            if (props.showThumbnail === false) list.dataset.hideThumbnail = 'true';
            if (props.showAuthor === false) list.dataset.hideAuthor = 'true';
        },
    },

    'social-links': {
        mount(root, props) {
            // .social-tab est positionné en absolu bas-droite par le CSS : on ne
            // le reprend pas, il annulerait le placement libre du nœud.
            const list = fill(el('div', 'social-list content-scroll', root));
            if (typeof props.iconStyle === 'string') list.dataset.iconStyle = props.iconStyle;
            if (props.layout === 'grid') {
                list.style.display = 'grid';
                list.style.gridTemplateColumns = 'repeat(auto-fill, minmax(3rem, 1fr))';
            }
        },
    },

    'skin-viewer': {
        mount(root, props) {
            const options = fill(el('div', 'player-options', root));
            const head = el('div', 'player-head', options);
            head.style.width = '100%';
            head.style.height = '100%';
            if (typeof props.background === 'string' && props.background) {
                head.style.backgroundColor = props.background;
            }
            if (props.rounded === false) head.style.borderRadius = '0';
        },
    },

    'account-info': {
        mount(root, props) {
            const box = fill(el('div', 'account-info', root));
            box.style.display = 'flex';
            box.style.alignItems = 'center';
            box.style.gap = '0.5rem';

            if (props.showAvatar !== false) el('div', 'account-info-avatar', box);
            if (props.showUsername !== false) el('div', 'account-info-username', box);
        },
    },

    'settings-button': {
        mount(root, props) {
            const btn = fill(el('div', 'settings-btn icon-settings', root));
            if (props.showLabel === true && typeof props.label === 'string' && props.label) {
                btn.textContent = props.label;
            }
        },
    },

    background: {
        mount(root, props, ctx) {
            root.style.left = '0';
            root.style.top = '0';
            root.style.width = '100%';
            root.style.height = '100%';
            root.style.pointerEvents = 'none';

            const layer = el('div', 'theme-background', root);
            layer.style.width = '100%';
            layer.style.height = '100%';

            const asset = props.assetRef ? ctx.assets?.get(props.assetRef) : null;
            if (asset?.url) {
                layer.style.backgroundImage = `url("${encodeURI(asset.url)}")`;
                layer.style.backgroundSize = props.fit === 'contain' ? 'contain'
                    : props.fit === 'fill' ? '100% 100%'
                    : props.fit === 'none' ? 'auto'
                    : 'cover';
                layer.style.backgroundPosition = 'center';
                layer.style.backgroundRepeat = 'no-repeat';
            }

            const opacity = Number(props.overlayOpacity);
            if (typeof props.overlayColor === 'string' && Number.isFinite(opacity) && opacity > 0) {
                const overlay = el('div', 'theme-background-overlay', layer);
                overlay.style.width = '100%';
                overlay.style.height = '100%';
                overlay.style.backgroundColor = props.overlayColor;
                overlay.style.opacity = String(Math.min(1, Math.max(0, opacity)));
            }
        },
    },

    // --- Blocs libres ---

    text: {
        mount(root, props) {
            // Bloc décoratif : ne doit jamais voler les clics d'un composant
            // piloté (bouton Jouer, sélecteur d'instance) placé dessous.
            root.style.pointerEvents = 'none';
            // textContent, jamais innerHTML : le contenu vient d'un tiers.
            const block = el('div', 'theme-free-text', root);
            block.style.width = '100%';
            block.style.height = '100%';
            block.style.overflow = 'hidden';
            block.style.whiteSpace = 'pre-wrap';
            block.style.wordBreak = 'break-word';
            // Même repli que l'aperçu de l'éditeur : sans prop, « Texte ». Un
            // contenu explicitement vidé ('') reste vide.
            block.textContent = typeof props.content === 'string' ? props.content : 'Texte';
        },
    },

    image: {
        mount(root, props, ctx) {
            // Décoratif : mêmes raisons que le bloc texte.
            root.style.pointerEvents = 'none';
            const asset = props.assetRef ? ctx.assets?.get(props.assetRef) : null;
            if (!asset?.url) return;
            const img = el('img', 'theme-free-image', root);
            img.src = asset.url;
            img.alt = '';
            img.style.display = 'block';
            img.style.width = '100%';
            img.style.height = '100%';
            img.style.objectFit = props.fit === 'contain' ? 'contain'
                : props.fit === 'fill' ? 'fill'
                : props.fit === 'none' ? 'none'
                : 'cover';
        },
    },

    card: {
        mount(root, props) {
            // Décoratif : mêmes raisons que le bloc texte.
            root.style.pointerEvents = 'none';
            // Le visuel (fond, rayon, ombre…) vient du style du nœud, posé par
            // le moteur sur le wrapper : la carte n'apporte que la mise en page
            // du titre et du contenu. textContent, jamais innerHTML : le
            // contenu vient d'un tiers.
            const box = el('div', 'theme-free-card', root);
            box.style.width = '100%';
            box.style.height = '100%';
            box.style.boxSizing = 'border-box';
            box.style.display = 'flex';
            box.style.flexDirection = 'column';
            box.style.gap = '6px';
            box.style.overflow = 'hidden';

            if (typeof props.title === 'string' && props.title) {
                const title = el('div', 'theme-free-card-title', box);
                title.style.fontWeight = '700';
                title.textContent = props.title;
            }
            if (typeof props.content === 'string' && props.content) {
                const content = el('div', 'theme-free-card-content', box);
                content.style.whiteSpace = 'pre-wrap';
                content.style.wordBreak = 'break-word';
                content.style.opacity = '0.9';
                content.textContent = props.content;
            }
        },
    },

    // --- Écrans à panneau propre : Paramètres et Connexion ---
    // Ces deux adaptateurs montent le HTML STATIQUE du panneau (fourni par
    // launcher.js via ctx.panelHtml) dans le cadre du nœud : la structure que
    // panels/settings.js et panels/login.js interrogent est reproduite à
    // l'identique par construction, et le thème pilote position, taille, style
    // et textes d'habillage.

    'settings-panel': {
        mount(root, props, ctx) {
            const html = typeof ctx?.panelHtml === 'string' ? ctx.panelHtml : null;
            if (!html) {
                // Rendu hors de son écran (nœud égaré) : on ne peint rien
                // par-dessus l'accueil.
                root.style.display = 'none';
                return;
            }
            root.innerHTML = html;
            // Un panel pas encore à jour ne sert pas contractViews : le repli
            // « tout est un composant d'accueil » peut monter ce bloc en
            // secours pendant le rendu de l'accueil, avec le HTML de home. On
            // vérifie que le balisage est bien celui du panneau Paramètres.
            if (!root.querySelector('.nav-settings')) {
                root.innerHTML = '';
                root.style.display = 'none';
                return;
            }
            root.style.overflow = 'hidden';

            const title = typeof props.title === 'string' ? props.title.trim() : '';
            if (title) {
                const heading = root.querySelector('.nav-settings p');
                if (heading) heading.textContent = title;
            }

            // --background / --color pilotent en interne le reste du CSS du
            // panneau (boutons de nav actifs, cartes…) : les garder alignées
            // sur ce que le moteur vient de poser depuis le style du nœud.
            const bg = root.style.getPropertyValue('background-color');
            if (bg) root.style.setProperty('--background', bg);
            const color = root.style.getPropertyValue('color');
            if (color) root.style.setProperty('--color', color);
        },
    },

    'login-card': {
        mount(root, props, ctx) {
            const html = typeof ctx?.panelHtml === 'string' ? ctx.panelHtml : null;
            if (!html) {
                root.style.display = 'none';
                return;
            }
            // Le cadre du nœud est la ZONE où la carte se centre : le HTML de
            // login.html apporte .container (flex centré plein cadre) et les
            // quatre onglets .login-tabs ; login.js affiche le bon selon le
            // mode d'authentification du panel.
            root.innerHTML = html;
            // Même garde que settings-panel : ne monter que le vrai balisage
            // de connexion (voir le commentaire là-bas).
            if (!root.querySelector('.login-tabs')) {
                root.innerHTML = '';
                root.style.display = 'none';
                return;
            }

            const message = typeof props.message === 'string' ? props.message.trim() : '';
            if (message) {
                // Pas l'onglet A2F : sa consigne « entrez le code de sécurité »
                // est une instruction fonctionnelle, pas un texte d'accueil.
                for (const textEl of root.querySelectorAll('.login-tabs:not(.login-AZauth-A2F) .login-text')) {
                    textEl.textContent = message;
                }
            }
            const buttonLabel = typeof props.buttonLabel === 'string' ? props.buttonLabel.trim() : '';
            if (buttonLabel) {
                for (const selector of ['.connect-home', '.connect-offline', '.connect-AZauth']) {
                    const btn = root.querySelector(selector);
                    if (btn) btn.textContent = buttonLabel;
                }
            }

            // Le style du nœud habille la CARTE (chaque onglet), pas la zone :
            // même transfert que instance-popup, en miroir de l'aperçu de
            // l'éditeur qui reporte ces propriétés sur .lp-login-card.
            const VISUAL_PROPS = [
                'background-color', 'color', 'text-align', 'border-radius', 'opacity',
                'font-size', 'font-weight', 'letter-spacing', 'padding', 'gap',
                'line-height', 'border', 'box-shadow', 'backdrop-filter',
                '-webkit-backdrop-filter', 'font-family',
            ];
            const tabs = root.querySelectorAll('.login-tabs');
            for (const prop of VISUAL_PROPS) {
                const value = root.style.getPropertyValue(prop);
                if (!value) continue;
                for (const tab of tabs) tab.style.setProperty(prop, value);
                root.style.removeProperty(prop);
            }
        },
    },
};

export default adapters;
