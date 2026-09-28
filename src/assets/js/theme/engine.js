/**
 * @author Luuxis
 * Luuxis License v1.0 (voir fichier LICENSE pour les détails en FR/EN)
 *
 * Moteur de rendu JSON -> DOM.
 *
 * ⚠ COPIE SYNCHRONISÉE de LuuxCraftPanel/public/js/theme/engine.js.
 * Les deux fichiers doivent rester identiques : c'est ce qui garantit que
 * l'aperçu de l'éditeur corresponde au rendu réel du launcher. Toute
 * modification ici doit être reportée là-bas, et inversement.
 *
 * Volontairement sans dépendance et sans rien connaître du launcher : il reçoit
 * un document, des adaptateurs, et produit du DOM. Toute la logique propre à
 * l'hôte vit dans les adaptateurs, ce qui permet de réutiliser ce fichier tel
 * quel pour l'aperçu de l'éditeur côté panel.
 *
 * Deux garanties qu'il doit tenir :
 *  - les classes du contrat existent toujours, même si l'auteur du thème a
 *    supprimé le composant : sans elles, les querySelector de panels/home.js
 *    renvoient null et le lancement de partie casse ;
 *  - les propriétés protégées ne viennent jamais du thème, elles sont posées
 *    par les adaptateurs après le montage.
 */

const TOKEN_REF_RE = /^\$tokens\.(colors|fonts)\.([a-z0-9-]{1,32})$/;

/** Positionnement en pourcentage : la fenêtre est redimensionnable, une mise
 *  en page en pixels figés laisserait des bandes vides ou déborderait. */
function percent(value, total) {
    if (!Number.isFinite(value) || !Number.isFinite(total) || total <= 0) return '0%';
    return `${(value / total) * 100}%`;
}

function resolveToken(value) {
    if (typeof value !== 'string') return value;
    const match = TOKEN_REF_RE.exec(value);
    if (!match) return value;
    const [, group, key] = match;
    return `var(--theme-${group === 'colors' ? 'color' : 'font'}-${key})`;
}

/**
 * Traduit le style validé du document en CSS. Les valeurs ont déjà été filtrées
 * côté panel ; on reste malgré tout sur une liste blanche, le document arrivant
 * par le réseau. Exporté : applySettingsTheme (launcher) habille le panneau
 * Paramètres avec le même traducteur, pour que l'aperçu de l'éditeur et le
 * rendu réel ne divergent jamais.
 */
export function applyStyle(element, style) {
    if (!style || typeof style !== 'object') return;

    const set = (prop, value) => {
        if (value === undefined || value === null || value === '') return;
        element.style.setProperty(prop, value);
    };

    set('background-color', resolveToken(style.fill));
    set('color', resolveToken(style.textColor));
    set('text-align', style.textAlign);

    if (Number.isFinite(style.borderRadius)) set('border-radius', `${style.borderRadius}px`);
    if (Number.isFinite(style.opacity)) set('opacity', String(style.opacity));
    if (Number.isFinite(style.fontSize)) set('font-size', `${style.fontSize}px`);
    if (Number.isFinite(style.fontWeight)) set('font-weight', String(style.fontWeight));
    if (Number.isFinite(style.letterSpacing)) set('letter-spacing', `${style.letterSpacing}px`);
    if (Number.isFinite(style.padding)) set('padding', `${style.padding}px`);
    if (Number.isFinite(style.gap)) set('gap', `${style.gap}px`);

    if (Number.isFinite(style.lineHeight)) set('line-height', String(style.lineHeight));

    if (Number.isFinite(style.borderWidth) && style.borderWidth > 0) {
        set('border', `${style.borderWidth}px solid ${resolveToken(style.borderColor) || 'currentColor'}`);
    }

    // Ombre : décalage par défaut (0, 2) identique à l'ancien comportement où
    // seul le flou était réglable — mais uniquement quand aucun décalage n'est
    // réglé, pour ne pas ajouter un Y fantôme à une ombre purement horizontale.
    const shadowX = Number.isFinite(style.shadowX) ? style.shadowX : 0;
    const shadowY = Number.isFinite(style.shadowY) ? style.shadowY : (Number.isFinite(style.shadowX) ? 0 : 2);
    const shadowBlur = Number.isFinite(style.shadowBlur) ? style.shadowBlur : 0;
    if (shadowBlur > 0 || shadowX !== 0 || (Number.isFinite(style.shadowY) && shadowY !== 0)) {
        set('box-shadow', `${shadowX}px ${shadowY}px ${shadowBlur}px ${resolveToken(style.shadowColor) || 'rgba(0,0,0,.4)'}`);
    }

    // Effet « verre » des popups. Le préfixe -webkit- couvre les versions de
    // Chromium embarquées par les vieux Electron.
    if (Number.isFinite(style.backdropBlur) && style.backdropBlur > 0) {
        set('backdrop-filter', `blur(${style.backdropBlur}px)`);
        set('-webkit-backdrop-filter', `blur(${style.backdropBlur}px)`);
    }

    if (style.fontFamily === 'heading' || style.fontFamily === 'body') {
        set('font-family', `var(--theme-font-${style.fontFamily})`);
    }
}

export function applyTokens(tokens, root) {
    const colors = tokens?.colors && typeof tokens.colors === 'object' ? tokens.colors : {};
    const fonts = tokens?.fonts && typeof tokens.fonts === 'object' ? tokens.fonts : {};

    for (const [key, value] of Object.entries(colors)) {
        root.style.setProperty(`--theme-color-${key}`, value);
    }
    for (const [key, value] of Object.entries(fonts)) {
        root.style.setProperty(`--theme-font-${key}`, value);
    }
}

/**
 * Bloc communautaire : rendu dans une iframe sans allow-same-origin, donc avec
 * une origine opaque et aucun accès au contexte du launcher. C'est cette
 * isolation qui rend le bloc sûr, pas un filtrage du contenu.
 *
 * Note : une iframe srcdoc hérite de la CSP parente. Activer les blocs custom
 * suppose donc d'assouplir frame-src côté main process (voir src/app.js).
 */
function renderCustomNode(node) {
    const iframe = document.createElement('iframe');
    iframe.setAttribute('sandbox', 'allow-scripts');
    iframe.setAttribute('referrerpolicy', 'no-referrer');
    iframe.style.width = '100%';
    iframe.style.height = '100%';
    iframe.style.border = '0';
    iframe.style.display = 'block';

    const { html = '', css = '', js = '' } = node.sandbox || {};
    iframe.srcdoc = [
        '<!doctype html><meta charset="utf-8">',
        `<style>html,body{margin:0;padding:0}${css}</style>`,
        html,
        js ? `<script>${js}<\/script>` : '',
    ].join('');

    return iframe;
}

export class ThemeRenderer {
    /**
     * @param {object} options
     * @param {Record<string, {mount: (el: HTMLElement, props: object, ctx: object) => void}>} options.adapters
     * @param {Record<string, string[]>} [options.contract] composant -> classes garanties
     * @param {(message: string, detail?: unknown) => void} [options.onWarning]
     */
    constructor({ adapters = {}, contract = {}, onWarning = () => {} } = {}) {
        this.adapters = adapters;
        this.contract = contract;
        this.onWarning = onWarning;
        this.container = null;
        this.mounted = new Map();
    }

    /**
     * @param {object} document document de thème validé
     * @param {HTMLElement} container
     * @param {object} [ctx] passé tel quel aux adaptateurs
     */
    render(themeDocument, container, ctx = {}) {
        this.container = container;
        this.mounted.clear();
        container.innerHTML = '';

        // Racine interne plutôt que le conteneur de l'hôte : celui-ci porte déjà
        // sa propre mise en page (.panel est en position absolute, plein cadre),
        // et la réécrire casserait la superposition des panneaux.
        const root = document.createElement('div');
        root.className = 'theme-root';
        root.style.position = 'absolute';
        root.style.inset = '0';
        root.style.overflow = 'hidden';
        container.appendChild(root);

        const canvas = themeDocument?.canvas?.width && themeDocument?.canvas?.height
            ? themeDocument.canvas
            : { width: 1280, height: 720 };

        applyTokens(themeDocument?.tokens, root);

        const assets = new Map(
            (Array.isArray(themeDocument?.assets) ? themeDocument.assets : []).map((a) => [a.id, a]),
        );

        const tree = Array.isArray(themeDocument?.tree) ? themeDocument.tree : [];
        const sorted = [...tree].sort((a, b) => (a?.transform?.zIndex || 0) - (b?.transform?.zIndex || 0));

        for (const node of sorted) {
            try {
                this.renderNode(node, root, canvas, assets, ctx);
            } catch (error) {
                // Un composant défaillant ne doit pas empêcher les autres de se
                // monter : le filet de sécurité rattrapera ses sélecteurs.
                this.onWarning(`Rendu du nœud ${node?.id} impossible`, error);
            }
        }

        this.ensureContract(root, ctx);
        return { mounted: this.mounted, root };
    }

    renderNode(node, container, canvas, assets, ctx) {
        if (!node || typeof node !== 'object') return;

        const wrapper = document.createElement('div');
        wrapper.className = 'theme-node';
        wrapper.dataset.nodeId = node.id || '';

        const t = node.transform || {};
        wrapper.style.position = 'absolute';
        // border-box : un contour réglé par le thème ne doit pas faire déborder
        // le bloc de son cadre (l'éditeur dessine ses poignées sur ce cadre).
        wrapper.style.boxSizing = 'border-box';
        wrapper.style.left = percent(t.x, canvas.width);
        wrapper.style.top = percent(t.y, canvas.height);
        wrapper.style.width = percent(t.width, canvas.width);
        wrapper.style.height = percent(t.height, canvas.height);
        wrapper.style.zIndex = String(t.zIndex || 0);

        // Masqué mais présent : les classes du contrat doivent rester
        // interrogeables même quand l'auteur cache le composant.
        if (node.hidden) wrapper.style.display = 'none';

        applyStyle(wrapper, node.style);

        if (node.type === 'custom') {
            wrapper.appendChild(renderCustomNode(node));
            container.appendChild(wrapper);
            return;
        }

        if (node.type !== 'component') return;

        const adapter = this.adapters[node.componentRef];
        if (!adapter || typeof adapter.mount !== 'function') {
            this.onWarning(`Aucun adaptateur pour ${node.componentRef}`);
            return;
        }

        wrapper.dataset.component = node.componentRef;
        container.appendChild(wrapper);

        // Les props protégées ont été retirées côté panel ; l'adaptateur pose
        // ensuite l'état réel (données, handlers) par-dessus. `canvas` permet à
        // un adaptateur de convertir le cadre du nœud en pourcentages (popup).
        adapter.mount(wrapper, node.props || {}, { ...ctx, assets, node, canvas });
        this.mounted.set(node.componentRef, wrapper);
    }

    /**
     * Filet de sécurité : monte hors écran tout composant absent de l'arbre dont
     * des classes sont attendues. Sans ça, un thème qui supprime le bouton Jouer
     * ferait planter startGame() sur un querySelector null.
     */
    ensureContract(container, ctx) {
        const missing = Object.entries(this.contract).filter(([ref, selectors]) => {
            if (!Array.isArray(selectors) || selectors.length === 0) return false;
            return selectors.some((selector) => !container.querySelector(`.${selector}`));
        });

        if (missing.length === 0) return;

        const fallback = document.createElement('div');
        fallback.className = 'theme-fallback';
        fallback.style.display = 'none';
        container.appendChild(fallback);

        for (const [ref] of missing) {
            const adapter = this.adapters[ref];
            if (!adapter || typeof adapter.mount !== 'function') continue;

            const slot = document.createElement('div');
            slot.dataset.component = ref;
            fallback.appendChild(slot);
            try {
                adapter.mount(slot, {}, { ...ctx, node: null, fallback: true });
                if (!this.mounted.has(ref)) this.mounted.set(ref, slot);
            } catch (error) {
                this.onWarning(`Montage de secours impossible pour ${ref}`, error);
            }
        }

        this.onWarning(`Composants rétablis hors écran : ${missing.map(([ref]) => ref).join(', ')}`);
    }

    destroy() {
        if (this.container) this.container.innerHTML = '';
        this.mounted.clear();
        this.container = null;
    }
}

export default ThemeRenderer;
