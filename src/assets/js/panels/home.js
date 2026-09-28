/**
 * @author Luuxis
 * Luuxis License v1.0 (voir fichier LICENSE pour les détails en FR/EN)
 */
import { config, database, logger, changePanel, appdata, setStatus, pkg, popup, getErrorMessage, normalizeError } from '../utils.js'

class Home {
    static id = "home";
    async init(config) {
        this.config = config;
        this.db = new database();
        this.serverIcon()
        this.news()
        this.socialLick()
        this.instancesSelect()
        document.querySelector('.settings-btn').addEventListener('click', e => changePanel('settings'))
    }

    /**
     * Icône servie par le panel (/icon) plutôt que celle figée au build, avec
     * repli sur l'image locale si le panel n'en a pas : un changement d'icône
     * dans le dashboard se propage ainsi sans rebuild du launcher.
     */
    setServerIcon(img) {
        if (!img) return
        img.onerror = () => {
            img.onerror = null
            img.src = 'assets/images/icon/icon.png'
        }
        img.src = `${window.luuxAPI.env.apiUrl}/icon`
    }

    serverIcon() {
        // Au montage, seule l'icône du bloc statut existe ; celles des news
        // sont posées bloc par bloc à leur création.
        document.querySelectorAll('img.server-status-icon').forEach(img => this.setServerIcon(img))
    }

    async news() {
        let newsElement = document.querySelector('.news-list');
        // Réglages posés par l'adaptateur news-feed du thème (data-attributes) :
        // sans thème ou sans réglage, comportement historique inchangé.
        const maxItems = Number(newsElement?.dataset.maxItems)
        const hideThumbnail = newsElement?.dataset.hideThumbnail === 'true'
        const hideAuthor = newsElement?.dataset.hideAuthor === 'true'
        const thumbnailHtml = hideThumbnail ? '' : '<img class="server-status-icon" src="assets/images/icon/icon.png">'
        try {
            let news = await config.getNews(this.config);
            if (Number.isFinite(maxItems) && maxItems > 0) news = news.slice(0, maxItems);

            if (!news.length) {
                let blockNews = document.createElement('div');
                const date = this.getdate(new Date())
                blockNews.classList.add('news-block');
                blockNews.innerHTML = `
                    <div class="news-header">
                        ${thumbnailHtml}
                        <div class="header-text">
                            <div class="title">Aucun news n'ai actuellement disponible.</div>
                        </div>
                        <div class="date">
                            <div class="day">${date.day}</div>
                            <div class="month">${date.month}</div>
                        </div>
                    </div>
                    <div class="news-content">
                        <div class="bbWrapper">
                            <p>Vous pourrez suivre ici toutes les news relative au serveur.</p>
                        </div>
                    </div>`
                this.setServerIcon(blockNews.querySelector('img.server-status-icon'))
                newsElement.appendChild(blockNews);
                return;
            }

            for (let News of news) {
                let date = this.getdate(News.publish_date)
                let blockNews = document.createElement('div');
                blockNews.classList.add('news-block');
                blockNews.innerHTML = `
                    <div class="news-header">
                        ${thumbnailHtml}
                        <div class="header-text">
                            <div class="title">${News.title}</div>
                        </div>
                        <div class="date">
                            <div class="day">${date.day}</div>
                            <div class="month">${date.month}</div>
                        </div>
                    </div>
                    <div class="news-content">
                        <div class="bbWrapper">
                            <p>${News.content.replace(/\n/g, '</br>')}</p>
                            ${hideAuthor ? '' : `<p class="news-author">Auteur - <span>${News.author}</span></p>`}
                        </div>
                    </div>`
                this.setServerIcon(blockNews.querySelector('img.server-status-icon'))
                newsElement.appendChild(blockNews);
            }
        } catch (error) {
            console.error('Unable to load news', error);
            let blockNews = document.createElement('div');
            const date = this.getdate(new Date())
            blockNews.classList.add('news-block');
            blockNews.innerHTML = `
                <div class="news-header">
                        ${thumbnailHtml}
                        <div class="header-text">
                            <div class="title">Error.</div>
                        </div>
                        <div class="date">
                            <div class="day">${date.day}</div>
                            <div class="month">${date.month}</div>
                        </div>
                    </div>
                    <div class="news-content">
                        <div class="bbWrapper">
                            <p>${getErrorMessage(error, 'Impossible de contacter le serveur des news.')}</br>Merci de verifier votre configuration.</p>
                        </div>
                    </div>`
            this.setServerIcon(blockNews.querySelector('img.server-status-icon'))
            newsElement.appendChild(blockNews);
        }
    }

    socialLick() {
        this.config.socialLinks.map(social => {
            let socialElement = document.createElement('div')
            socialElement.dataset.url = social.url
            socialElement.classList.add('social-block')
            socialElement.innerHTML = `
                <div class="icon-${social.icon.toLowerCase()} icon-social"></div>
            `
            document.querySelector('.social-list').appendChild(socialElement)
        })

        document.querySelector('.social-list').addEventListener('click', e => {
            if (e.target.classList.contains('social-block') || e.target.classList.contains('icon-social')) {
                let url = e.target.dataset.url || e.target.parentElement.dataset.url
                window.luuxAPI.shell.openExternal(url)
            }
        })
    }

    async instancesSelect() {
        let configClient = await this.db.readData('configClient')
        let auth = await this.db.readData('accounts', configClient.account_selected)
        let instancesList

        try {
            instancesList = await config.getInstanceList()
        } catch (error) {
            console.error('Unable to load instances', error);
            new popup().openPopup({
                title: 'Instances',
                content: getErrorMessage(error, 'Impossible de recuperer la liste des instances.'),
                color: 'red',
                options: true
            });
            return;
        }

        let instanceSelect = instancesList.find(i => i.name == configClient?.instance_select) ? configClient?.instance_select : null

        let instanceBTN = document.querySelector('.play-instance')
        let instancePopup = document.querySelector('.instance-popup')
        let instancesListPopup = document.querySelector('.instances-List')
        let instanceCloseBTN = document.querySelector('.close-popup')

        if (instancesList.length === 1) {
            document.querySelector('.instance-select').style.display = 'none'
            instanceBTN.style.paddingRight = '0'
        }

        if (!instanceSelect) {
            let newInstanceSelect = instancesList.find(i => i.whitelistActive == false)
            let configClient = await this.db.readData('configClient')
            configClient.instance_select = newInstanceSelect.name
            instanceSelect = newInstanceSelect.name
            await this.db.updateData('configClient', configClient)
        }

        for (let instance of instancesList) {
            if (instance.whitelistActive) {
                let whitelist = instance.whitelist.find(whitelist => whitelist == auth?.name)
                if (whitelist !== auth?.name) {
                    if (instance.name == instanceSelect) {
                        let newInstanceSelect = instancesList.find(i => i.whitelistActive == false)
                        let configClient = await this.db.readData('configClient')
                        configClient.instance_select = newInstanceSelect.name
                        instanceSelect = newInstanceSelect.name
                        setStatus(newInstanceSelect.status)
                        await this.db.updateData('configClient', configClient)
                    }
                }
            } else console.log(`Initializing instance ${instance.name}...`)
            if (instance.name == instanceSelect) setStatus(instance.status)
        }

        instancePopup.addEventListener('click', async e => {
            let configClient = await this.db.readData('configClient')

            if (e.target.classList.contains('instance-elements')) {
                let newInstanceSelect = e.target.id
                let activeInstanceSelect = document.querySelector('.active-instance')

                if (activeInstanceSelect) activeInstanceSelect.classList.toggle('active-instance');
                e.target.classList.add('active-instance');

                configClient.instance_select = newInstanceSelect
                await this.db.updateData('configClient', configClient)
                instanceSelect = instancesList.filter(i => i.name == newInstanceSelect)
                instancePopup.style.display = 'none'
                let options = instancesList.find(i => i.name == configClient.instance_select)
                await setStatus(options.status)
            }
        })

        instanceBTN.addEventListener('click', async e => {
            let configClient = await this.db.readData('configClient')
            let instanceSelect = configClient.instance_select
            let auth = await this.db.readData('accounts', configClient.account_selected)

            if (e.target.classList.contains('instance-select')) {
                instancesListPopup.innerHTML = ''
                for (let instance of instancesList) {
                    if (instance.whitelistActive) {
                        instance.whitelist.map(whitelist => {
                            if (whitelist == auth?.name) {
                                if (instance.name == instanceSelect) {
                                    instancesListPopup.innerHTML += `<div id="${instance.name}" class="instance-elements active-instance">${instance.name}</div>`
                                } else {
                                    instancesListPopup.innerHTML += `<div id="${instance.name}" class="instance-elements">${instance.name}</div>`
                                }
                            }
                        })
                    } else {
                        if (instance.name == instanceSelect) {
                            instancesListPopup.innerHTML += `<div id="${instance.name}" class="instance-elements active-instance">${instance.name}</div>`
                        } else {
                            instancesListPopup.innerHTML += `<div id="${instance.name}" class="instance-elements">${instance.name}</div>`
                        }
                    }
                }

                instancePopup.style.display = 'flex'
            }

            if (!e.target.classList.contains('instance-select')) this.startGame()
        })

        instanceCloseBTN.addEventListener('click', () => instancePopup.style.display = 'none')
    }

    async startGame() {
        let configClient = await this.db.readData('configClient')
        let instance
        try {
            instance = await config.getInstanceList()
        } catch (error) {
            new popup().openPopup({
                title: 'Erreur',
                content: getErrorMessage(error, 'Impossible de recuperer les informations de l instance.'),
                color: 'red',
                options: true
            })
            return;
        }
        let authenticator = await this.db.readData('accounts', configClient.account_selected)
        let options = instance.find(i => i.name == configClient.instance_select)

        if (!authenticator || !options) {
            new popup().openPopup({
                title: 'Erreur',
                content: 'La configuration de lancement est incomplete. Veuillez selectionner un compte et une instance valides.',
                color: 'red',
                options: true
            })
            return;
        }

        let playInstanceBTN = document.querySelector('.play-instance')
        let infoStartingBOX = document.querySelector('.info-starting-game')
        let infoStarting = document.querySelector(".info-starting-game-text")
        let progressBar = document.querySelector('.progress-bar')

        const hidePercentage = infoStarting?.dataset.hidePercentage === 'true'
        const showSpeed = infoStarting?.dataset.showSpeed === 'true'
        let lastSpeed = ''
        const progressText = (label, progress, size) => {
            const percent = hidePercentage ? '' : ` ${((progress / size) * 100).toFixed(0)}%`
            const speed = showSpeed && lastSpeed && label === 'Téléchargement' ? ` — ${lastSpeed}` : ''
            return `${label}${percent}${speed}`
        }

        let loaderType = options.loader?.loader_type.toLowerCase() || options.loadder.loadder_type.toLowerCase();
        const mcp = loaderType === 'mcp' ? options.loader?.mcp_file : undefined;
        if (loaderType === 'mcp') loaderType = 'none';

        let opt = {
            url: options.url,
            authenticator: authenticator,
            timeout: 10000,
            path: `${await appdata()}/${window.luuxAPI.env.platform == 'darwin' ? this.config.dataDirectory : `.${this.config.dataDirectory}`}`,
            instance: options.name,
            version: options.loader.minecraft_version,
            detached: configClient.launcher_config.closeLauncher == "close-all" ? false : true,
            downloadFileMultiple: configClient.launcher_config.download_multi,
            mcp: mcp,
            intelEnabledMac: configClient.launcher_config.intelEnabledMac,

            loader: {
                type: loaderType,
                build: options.loader?.loader_version || options.loadder.loadder_version,
                enable: loaderType !== 'none',
                path: './'
            },

            verify: options.verify,

            ignored: [...options.ignored],

            java: {
                path: configClient.java_config.java_path,
            },

            JVM_ARGS: options.jvm_args ? options.jvm_args : [],
            GAME_ARGS: options.game_args ? options.game_args : [],

            screen: {
                width: configClient.game_config.screen_size.width,
                height: configClient.game_config.screen_size.height
            },

            memory: {
                min: `${configClient.java_config.java_memory.min * 1024}M`,
                max: `${configClient.java_config.java_memory.max * 1024}M`
            }
        }

        playInstanceBTN.style.display = "none"
        infoStartingBOX.style.display = "block"
        progressBar.style.display = "";
        window.luuxAPI.window.loadProgress()

        // Le jeu est lance dans le main process : on remet l'interface dans son
        // etat initial depuis un seul endroit, quelle que soit la facon dont la
        // partie se termine.
        let restoreUI = () => {
            if (configClient.launcher_config.closeLauncher == 'close-launcher') {
                window.luuxAPI.window.show()
            }
            window.luuxAPI.window.resetProgress()
            infoStartingBOX.style.display = "none"
            playInstanceBTN.style.display = "flex"
            infoStarting.innerHTML = `Vérification`
            new logger(pkg.name, '#7289da');
        }

        let handlers = {
            extract: extract => {
                window.luuxAPI.window.loadProgress()
                console.log(extract);
            },

            progress: (progress, size) => {
                infoStarting.innerHTML = progressText('Téléchargement', progress, size)
                window.luuxAPI.window.setProgress(progress, size)
                progressBar.value = progress;
                progressBar.max = size;
            },

            check: (progress, size) => {
                infoStarting.innerHTML = progressText('Vérification', progress, size)
                window.luuxAPI.window.setProgress(progress, size)
                progressBar.value = progress;
                progressBar.max = size;
            },

            estimated: time => {
                let hours = Math.floor(time / 3600);
                let minutes = Math.floor((time - hours * 3600) / 60);
                let seconds = Math.floor(time - hours * 3600 - minutes * 60);
                console.log(`${hours}h ${minutes}m ${seconds}s`);
            },

            speed: speed => {
                lastSpeed = `${(speed / 1067008).toFixed(2)} Mb/s`
                console.log(lastSpeed)
            },

            patch: patch => {
                console.log(patch);
                window.luuxAPI.window.loadProgress()
                infoStarting.innerHTML = `Patch en cours...`
            },

            data: e => {
                progressBar.style.display = "none"
                if (configClient.launcher_config.closeLauncher == 'close-launcher') {
                    window.luuxAPI.window.hide()
                }
                new logger('Minecraft', '#36b030');
                window.luuxAPI.window.loadProgress()
                infoStarting.innerHTML = `Demarrage en cours...`
                console.log(e);
            },

            close: () => {
                unsubscribe();
                restoreUI();
                console.log('Close');
            },

            error: err => {
                unsubscribe();

                const normalizedError = normalizeError(err, {
                    code: 'GAME_LAUNCH_ERROR',
                    message: err?.error || 'Le jeu n a pas pu etre lance.'
                });

                new popup().openPopup({
                    title: 'Erreur',
                    content: getErrorMessage(normalizedError, 'Le jeu n a pas pu etre lance.'),
                    color: 'red',
                    options: true
                })

                restoreUI();
                console.error('Launch error', normalizedError);
            }
        }

        // Abonnement avant l'appel : sinon les premiers evenements de
        // verification partent avant que le renderer n'ecoute.
        let unsubscribe = window.luuxAPI.game.onEvent(({ type, args }) => {
            let handler = handlers[type]
            if (handler) handler(...args)
        })

        let result = await window.luuxAPI.game.launch(opt)

        if (!result?.started) {
            unsubscribe();
            restoreUI();
            new popup().openPopup({
                title: 'Erreur',
                content: result?.reason === 'already_running'
                    ? 'Une partie est deja en cours de lancement.'
                    : 'Le jeu n a pas pu etre lance.',
                color: 'red',
                options: true
            })
        }
    }

    getdate(e) {
        let date = new Date(e)
        let year = date.getFullYear()
        let month = date.getMonth() + 1
        let day = date.getDate()
        let allMonth = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']
        return { year: year, month: allMonth[month - 1], day: day }
    }
}
export default Home;