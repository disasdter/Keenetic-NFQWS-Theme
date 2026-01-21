class UI {
    constructor() {
        this.currentLang = localStorage.getItem('lang') || 'en';
        this.translations = {};
        this.editor = null;
        this.originalContent = '';
        this.currentFilename = '';
        this.isAuthenticated = localStorage.getItem('hasSession') === 'true';
        this.checkInProgress = false;
        this.historyManager = new HistoryManager();
        this.keyboardShortcuts = new KeyboardShortcuts(this);
        
        this.init();
    }

    async init() {
        await this.loadTranslations();
        this.initCodeMirror();
        this.initUIComponents();
        this.applyTranslations();
        
        if (this.isAuthenticated) {
            await this.checkAuth();
        } else {
            this.showLoginForm();
        }
        
        // Инициализируем историю после загрузки редактора
        if (this.editor) {
            this.historyManager.init(this.editor);
        }
    }

    async checkAuth() {
        try {
            const response = await this.postData({ cmd: 'filenames' });
            
            if (response && response.status === 0) {
                this.isAuthenticated = true;
                document.body.classList.add('authenticated');
                localStorage.setItem('hasSession', 'true');
                this.setStatus(response.service);
                await this.loadFiles();
            } else if (response && response.status === 401) {
                this.isAuthenticated = false;
                localStorage.removeItem('hasSession');
                document.body.classList.remove('authenticated');
                this.showLoginForm();
            } else {
                console.error('Auth check error:', response);
                this.showLoginForm();
            }
        } catch (error) {
            console.error('Auth check error:', error);
            this.showLoginForm();
        }
    }

    async loadTranslations() {
        try {
            const response = await fetch(`lang/${this.currentLang}.json`);
            this.translations = await response.json();
        } catch (error) {
            console.error('Error loading translations:', error);
            this.translations = {
                save: "Save",
                restart: "Restart",
                reload: "Reload",
                stop: "Stop",
                start: "Start",
                update: "Update",
                login: "Login",
                logout: "Logout",
                confirmSave: "Save changes?",
                confirmRestart: "Restart service?",
                confirmReload: "Reload service?",
                confirmStop: "Stop service?",
                confirmStart: "Start service?",
                confirmUpdate: "Update nfqws-keenetic?",
                confirmClose: "File has unsaved changes. Close anyway?",
                confirmDelete: "Delete this file?",
                confirmClear: "Clear log file?",
                yes: "Yes",
                no: "No",
                close: "Close",
                cancel: "Cancel",
                confirm: "Confirm",
                fileSaved: "File saved successfully",
                fileDeleted: "File deleted successfully",
                logCleared: "Log cleared successfully",
                serviceRestarted: "Service restarted successfully",
                serviceReloaded: "Service reloaded successfully",
                serviceStopped: "Service stopped successfully",
                serviceStarted: "Service started successfully",
                upgradeCompleted: "Upgrade completed",
                error: "Error",
                success: "Success",
                processing: "Processing...",
                statusRunning: "Running",
                statusStopped: "Stopped",
                themeLight: "Switch to light theme",
                themeDark: "Switch to dark theme",
                language: "Language",
                placeholder: "# Configuration file\n# Edit and save...",
                noFileSelected: "No file selected",
                fullscreen: "Toggle fullscreen",
                exitFullscreen: "Exit fullscreen",
                checkAvailability: "Проверить доступность",
                checkingDomains: "Проверка доступности доменов...",
                domainCheckComplete: "Проверка доменов завершена",
                totalDomains: "Всего",
                accessibleDomains: "Доступны",
                blockedDomains: "Заблокированы",
                progress: "Прогресс",
                domainAccessible: "Доступен",
                domainBlocked: "Заблокирован",
                noDomainsFound: "Домены не найдены в файле",
                selectListFile: "Выберите файл .list для проверки доменов",
                checkingDomain: "Проверка {domain}..."
            };
        }
    }

    initCodeMirror() {
        const textarea = document.getElementById('config');
        const theme = localStorage.getItem('theme') === 'dark' ? 'dracula' : 'default';
        
        this.editor = CodeMirror.fromTextArea(textarea, {
            lineNumbers: true,
            mode: 'shell',
            theme: theme,
            lineWrapping: true,
            autofocus: false,
            placeholder: this.translations.placeholder,
            viewportMargin: Infinity,
            readOnly: !this.isAuthenticated,
            extraKeys: {
                "Ctrl-S": (cm) => {
                    this.saveCurrentFile();
                    return false; // Предотвращаем стандартное поведение
                },
                "Cmd-S": (cm) => {
                    this.saveCurrentFile();
                    return false; // Предотвращаем стандартное поведение
                },
                "Ctrl-Z": (cm) => {
                    // Позволяем CodeMirror обработать отмену самостоятельно
                    return CodeMirror.Pass;
                },
                "Cmd-Z": (cm) => {
                    // Позволяем CodeMirror обработать отмену самостоятельно
                    return CodeMirror.Pass;
                },
                "Ctrl-Y": (cm) => {
                    // Позволяем CodeMirror обработать повтор самостоятельно
                    return CodeMirror.Pass;
                },
                "Cmd-Y": (cm) => {
                    // Позволяем CodeMirror обработать повтор самостоятельно
                    return CodeMirror.Pass;
                },
                "Ctrl-Shift-Z": (cm) => {
                    // Позволяем CodeMirror обработать повтор самостоятельно
                    return CodeMirror.Pass;
                },
                "Cmd-Shift-Z": (cm) => {
                    // Позволяем CodeMirror обработать повтор самостоятельно
                    return CodeMirror.Pass;
                }
            }
        });

        this.editor.on('change', () => {
            this.checkForChanges();
        });
        
        // Фокус на редакторе для работы горячих клавиш
        this.editor.on('focus', () => {
            document.activeEditor = this.editor;
        });
    }

    checkForChanges() {
        if (!this.isAuthenticated) return;
        
        const currentContent = this.editor.getValue();
        const hasChanges = currentContent !== this.originalContent;
        document.body.classList.toggle('changed', hasChanges);
        
        const saveButton = document.getElementById('save');
        const saveFsButton = document.getElementById('save-fullscreen');
        
        if (hasChanges) {
            saveButton.style.display = 'inline-flex';
            saveFsButton.style.display = 'inline-flex';
        } else {
            saveButton.style.display = 'none';
            
            const editorContainer = document.querySelector('.editor-container');
            if (!editorContainer.classList.contains('fullscreen')) {
                saveFsButton.style.display = 'none';
            }
        }
    }

    initUIComponents() {
        this.$tabs = document.querySelector('nav');
        this.initButtons();
        this.tabs = this.initTabs();
        this.initPopups();
        this.initLanguageSwitcher();
        this.initThemeSwitcher();
        this.initLoginForm();
        this.initAvailabilityPopup();
    }

    initButtons() {
        // Save button
        document.getElementById('save').addEventListener('click', () => this.saveCurrentFile());
        
        // Check Availability button
        document.getElementById('check-availability').addEventListener('click', () => this.checkDomainsAvailability());
        
        // Restart button
        document.getElementById('restart').addEventListener('click', () => this.confirmServiceAction('restart'));
        
        // Dropdown button
        document.getElementById('dropdown').addEventListener('click', (e) => {
            e.stopPropagation();
            if (!this.isAuthenticated) return;
            document.getElementById('dropdown-menu').classList.toggle('hidden');
        });
        
        // Dropdown items
        document.getElementById('reload').addEventListener('click', () => {
            document.getElementById('dropdown-menu').classList.add('hidden');
            this.confirmServiceAction('reload');
        });
        
        document.getElementById('stop').addEventListener('click', () => {
            document.getElementById('dropdown-menu').classList.add('hidden');
            this.confirmServiceAction('stop');
        });
        
        document.getElementById('start').addEventListener('click', () => {
            document.getElementById('dropdown-menu').classList.add('hidden');
            this.confirmServiceAction('start');
        });
        
        document.getElementById('upgrade').addEventListener('click', () => {
            document.getElementById('dropdown-menu').classList.add('hidden');
            this.confirmServiceAction('upgrade');
        });
        
        // Logout button
        document.getElementById('logout').addEventListener('click', async () => {
            const result = await this.postData({ cmd: 'logout' });
            if (result && result.status === 0) {
                localStorage.removeItem('hasSession');
                window.location.reload();
            }
        });
        
        // Fullscreen button
        document.getElementById('editor-fullscreen').addEventListener('click', () => this.toggleFullscreen());
        
        // Save button in fullscreen
        document.getElementById('save-fullscreen').addEventListener('click', () => this.saveCurrentFile());
        
        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            const dropdown = document.getElementById('dropdown-menu');
            const dropdownBtn = document.getElementById('dropdown');
            
            if (!dropdown.classList.contains('hidden') && 
                !dropdown.contains(e.target) && 
                !dropdownBtn.contains(e.target)) {
                dropdown.classList.add('hidden');
            }
        });
    }

    initTabs() {
        const tabs = {};
        let currentFile = '';

        const add = (filename) => {
            const tab = document.createElement('div');
            tab.classList.add('nav-tab');
            tab.dataset.filename = filename;
            tab.textContent = filename;

            const isLog = filename.endsWith('.log');
            const isConfig = filename.endsWith('.conf') || filename.includes('.conf-');
            const isList = filename.endsWith('.list') || filename.includes('.list-');

            if (isLog) {
                const clear = document.createElement('div');
                clear.classList.add('nav-clear');
                clear.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>';
                clear.title = this.translations.confirmClear || "Clear log";

                clear.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    if (!this.isAuthenticated) return;
                    if (await this.showConfirm(this.translations.confirmClear)) {
                        const result = await this.saveFile(filename, '');
                        if (!result.status) {
                            if (filename === currentFile) {
                                this.editor.setValue('');
                                this.originalContent = '';
                                this.checkForChanges();
                            }
                            this.showNotification(this.translations.logCleared, 'success');
                        }
                    }
                });

                tab.appendChild(clear);
            } else if (!isConfig && !isList) {
                tab.classList.add('secondary');
                const trash = document.createElement('div');
                trash.classList.add('nav-trash');
                trash.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>';
                trash.title = this.translations.confirmDelete || "Delete file";

                trash.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    if (!this.isAuthenticated) return;
                    if (await this.showConfirm(this.translations.confirmDelete)) {
                        const result = await this.removeFile(filename);
                        if (!result.status) {
                            this.removeTab(filename);
                            this.showNotification(this.translations.fileDeleted, 'success');
                        }
                    }
                });

                tab.appendChild(trash);
            }

            tab.addEventListener('click', async () => {
                if (!this.isAuthenticated) return;
                await this.loadFile(filename);
            });

            this.$tabs.appendChild(tab);
            tabs[filename] = tab;
        };

        const removeTab = (filename) => {
            const tab = tabs[filename];
            if (tab) {
                tab.parentNode.removeChild(tab);
                delete tabs[filename];

                if (filename === currentFile) {
                    const firstTab = Object.keys(tabs)[0];
                    if (firstTab) {
                        this.loadFile(firstTab);
                    } else {
                        this.editor.setValue('');
                        this.originalContent = '';
                        this.currentFilename = '';
                        document.getElementById('current-filename').textContent = this.translations.noFileSelected;
                        this.checkForChanges();
                    }
                }
            }
        };

        const activate = (filename) => {
            Object.values(tabs).forEach(tab => {
                tab.classList.toggle('active', tab.dataset.filename === filename);
            });
            currentFile = filename;
            document.getElementById('current-filename').textContent = filename;
            
            // Обновляем историю при переключении вкладок
            if (this.historyManager) {
                this.historyManager.updateCurrentFile(filename);
            }
        };

        return {
            add,
            remove: removeTab,
            activate,
            get currentFileName() {
                return currentFile;
            }
        };
    }

    initLoginForm() {
        const loginForm = document.getElementById('login-form');
        const loginInput = document.getElementById('login');
        const passwordInput = document.getElementById('password');
        const loginButton = document.getElementById('login-button');
        const closeButton = loginForm.querySelector('.popup-close-btn');
        const loginTitle = document.getElementById('login-title');
        
        loginTitle.textContent = this.translations.login || 'Login';
        loginButton.textContent = this.translations.login || 'Login';
        
        loginButton.addEventListener('click', async () => {
            const user = loginInput.value.trim();
            const password = passwordInput.value;
            
            if (!user || !password) {
                this.showNotification(this.translations.error + ': Please enter login and password', 'error');
                return;
            }
            
            try {
                const result = await this.postData({
                    cmd: 'login',
                    user: user,
                    password: password
                });
                
                if (result && result.status === 0) {
                    this.isAuthenticated = true;
                    localStorage.setItem('hasSession', 'true');
                    document.body.classList.add('authenticated');
                    loginForm.classList.add('hidden');
                    document.body.classList.remove('disabled');
                    
                    await this.loadFiles();
                } else {
                    this.showNotification(this.translations.error + ': Login failed', 'error');
                    passwordInput.value = '';
                }
            } catch (error) {
                this.showNotification(this.translations.error + ': Login error', 'error');
            }
        });
        
        // Close button for login form
        closeButton.addEventListener('click', () => {
            loginForm.classList.add('hidden');
            document.body.classList.remove('disabled');
        });
        
        // Enter key для логина
        loginInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                passwordInput.focus();
            }
        });
        
        passwordInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                loginButton.click();
            }
        });
    }

    initAvailabilityPopup() {
        const popup = document.getElementById('availability-results');
        const closeBtn = document.getElementById('availability-close');
        const headerCloseBtn = popup.querySelector('.popup-close-btn');
        
        closeBtn.addEventListener('click', () => {
            popup.classList.add('hidden');
            document.body.classList.remove('disabled');
        });
        
        headerCloseBtn.addEventListener('click', () => {
            popup.classList.add('hidden');
            document.body.classList.remove('disabled');
        });
    }

    showLoginForm() {
        const loginForm = document.getElementById('login-form');
        const loginInput = document.getElementById('login');
        const loginButton = document.getElementById('login-button');
        const loginTitle = document.getElementById('login-title');
        
        loginTitle.textContent = this.translations.login || 'Login';
        loginButton.textContent = this.translations.login || 'Login';
        loginForm.classList.remove('hidden');
        document.body.classList.add('disabled');
        loginInput.focus();
        loginInput.value = '';
        document.getElementById('password').value = '';
    }

    initPopups() {
        const popup = document.getElementById('alert');
        const content = document.getElementById('popup-content');
        const buttonClose = document.getElementById('popup-close');
        const buttonYes = document.getElementById('popup-yes');
        const buttonNo = document.getElementById('popup-no');
        const popupTitle = document.getElementById('popup-title');
        const closeButton = popup.querySelector('.popup-close-btn');
        
        this.resolveCallback = null;
        let isProcessing = false;

        // Close buttons
        buttonClose.addEventListener('click', () => {
            this.closePopup(popup, false);
        });

        // Close button in header
        closeButton.addEventListener('click', () => {
            this.closePopup(popup, false);
        });

        // Yes/No buttons
        buttonYes.addEventListener('click', () => {
            if (!isProcessing) {
                this.closePopup(popup, true);
            }
        });

        buttonNo.addEventListener('click', () => {
            if (!isProcessing) {
                this.closePopup(popup, false);
            }
        });

        // Store methods
        this.showAlert = (message, title = '') => {
            return new Promise((resolve) => {
                content.textContent = message;
                popupTitle.textContent = title || '';
                popup.classList.remove('hidden');
                popup.classList.add('alert');
                popup.classList.remove('confirm');
                document.body.classList.add('disabled');
                this.resolveCallback = resolve;
            });
        };

        this.showConfirm = (message, title = '') => {
            return new Promise((resolve) => {
                content.textContent = message;
                popupTitle.textContent = title || '';
                popup.classList.remove('hidden');
                popup.classList.add('confirm');
                popup.classList.remove('alert');
                document.body.classList.add('disabled');
                this.resolveCallback = resolve;
            });
        };

        this.showProcessing = async (message, action, title = '') => {
            return new Promise(async (resolve) => {
                if (!this.isAuthenticated) {
                    resolve(false);
                    return;
                }
                
                content.textContent = `${message}\n\n${this.translations.processing || 'Processing...'}`;
                popupTitle.textContent = title || '';
                popup.classList.remove('hidden');
                popup.classList.add('alert', 'locked');
                document.body.classList.add('disabled');
                isProcessing = true;
                
                try {
                    const result = await action();
                    if (result && !result.status) {
                        content.textContent = `${message}\n\n✅ ${this.translations.success || 'Success'}!`;
                        if (result.output) {
                            content.textContent += `\n${result.output.join('\n')}`;
                        }
                        resolve(true);
                    } else {
                        content.textContent = `${message}\n\n❌ ${this.translations.error || 'Error'}: ${result ? result.status : 'Unknown error'}`;
                        if (result && result.output) {
                            content.textContent += `\n${result.output.join('\n')}`;
                        }
                        resolve(false);
                    }
                } catch (error) {
                    content.textContent = `${message}\n\n❌ ${this.translations.error || 'Error'}: ${error.message}`;
                    resolve(false);
                } finally {
                    popup.classList.remove('locked');
                    isProcessing = false;
                }
            });
        };
    }

    closePopup(popup, result) {
        popup.classList.add('hidden');
        document.body.classList.remove('disabled');
        if (this.resolveCallback) {
            this.resolveCallback(result);
            this.resolveCallback = null;
        }
    }

    initLanguageSwitcher() {
        const switcher = document.getElementById('language-switcher');
        
        // Устанавливаем активный язык при загрузке
        this.updateLanguageSwitcher();
        
        switcher.addEventListener('click', (e) => {
            if (e.target.classList.contains('language-option')) {
                const lang = e.target.dataset.lang;
                this.switchLanguage(lang);
            }
        });
    }
    
    updateLanguageSwitcher() {
        document.querySelectorAll('.language-option').forEach(option => {
            option.classList.remove('active');
            if (option.dataset.lang === this.currentLang) {
                option.classList.add('active');
            }
        });
    }

    initThemeSwitcher() {
        document.getElementById('theme').addEventListener('click', () => this.toggleTheme());
    }

    async switchLanguage(lang) {
        this.currentLang = lang;
        localStorage.setItem('lang', lang);
        document.documentElement.lang = lang;
        
        await this.loadTranslations();
        this.applyTranslations();
        this.updateLanguageSwitcher();
    }

    applyTranslations() {
        // Buttons
        document.getElementById('save-text').textContent = this.translations.save;
        document.getElementById('restart-text').textContent = this.translations.restart;
        document.getElementById('reload-text').textContent = this.translations.reload;
        document.getElementById('stop-text').textContent = this.translations.stop;
        document.getElementById('start-text').textContent = this.translations.start;
        document.getElementById('update-text').textContent = this.translations.update;
        document.getElementById('save-fs-text').textContent = this.translations.save;
        document.getElementById('check-availability-text').textContent = this.translations.checkAvailability || 'Проверить доступность';
        
        // Popup buttons
        document.getElementById('popup-yes').textContent = this.translations.yes;
        document.getElementById('popup-no').textContent = this.translations.no;
        document.getElementById('popup-close').textContent = this.translations.close;
        
        // Popup titles
        document.getElementById('login-title').textContent = this.translations.login;
        document.getElementById('login-button').textContent = this.translations.login;
        
        // Availability popup
        document.getElementById('availability-title').textContent = this.translations.checkingDomains || 'Проверка доступности доменов';
        document.getElementById('availability-close').textContent = this.translations.close || 'Закрыть';
        
        // Statistics labels
        const totalLabel = document.querySelector('.stat-item:nth-child(1) .stat-label');
        const accessibleLabel = document.querySelector('.stat-item:nth-child(2) .stat-label');
        const blockedLabel = document.querySelector('.stat-item:nth-child(3) .stat-label');
        const progressLabel = document.querySelector('.stat-item:nth-child(4) .stat-label');
        
        if (totalLabel) totalLabel.textContent = this.translations.totalDomains || 'Всего';
        if (accessibleLabel) accessibleLabel.textContent = this.translations.accessibleDomains || 'Доступны';
        if (blockedLabel) blockedLabel.textContent = this.translations.blockedDomains || 'Заблокированы';
        if (progressLabel) progressLabel.textContent = this.translations.progress || 'Прогресс';
        
        // Editor
        if (this.editor) {
            this.editor.setOption("placeholder", this.translations.placeholder);
        }
        
        // Filename
        document.getElementById('current-filename').textContent = 
            this.currentFilename || this.translations.noFileSelected;
        
        // Titles
        document.getElementById('editor-fullscreen').title = this.translations.fullscreen;
        document.getElementById('theme').title = this.translations.themeLight;
        document.getElementById('logout').title = this.translations.logout;
        document.getElementById('language-switcher').title = this.translations.language;
        document.getElementById('check-availability').title = this.translations.checkAvailability || 'Проверить доступность доменов';
    }

    toggleTheme() {
        const root = document.querySelector(':root');
        const theme = root.dataset.theme === 'dark' ? 'light' : 'dark';
        localStorage.setItem('theme', theme);
        root.dataset.theme = theme;
        
        const themeButton = document.getElementById('theme');
        themeButton.title = theme === 'dark' ? this.translations.themeLight : this.translations.themeDark;
        
        if (this.editor) {
            this.editor.setOption('theme', theme === 'dark' ? 'dracula' : 'default');
        }
    }

    toggleFullscreen() {
        const editorContainer = document.querySelector('.editor-container');
        const fsButton = document.getElementById('editor-fullscreen');
        
        if (editorContainer.classList.contains('fullscreen')) {
            // Плавное закрытие
            editorContainer.classList.add('closing');
            fsButton.title = this.translations.fullscreen;
            
            setTimeout(() => {
                editorContainer.classList.remove('fullscreen', 'closing');
                document.body.classList.remove('fullscreen-active');
                
                // Восстанавливаем стандартную иконку
                fsButton.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"></path></svg>';
                
                // Скрываем кнопку Save в normal режиме
                const saveFsButton = document.getElementById('save-fullscreen');
                if (!document.body.classList.contains('changed')) {
                    saveFsButton.style.display = 'none';
                }
            }, 500);
        } else {
            // Плавное открытие
            editorContainer.classList.add('fullscreen');
            document.body.classList.add('fullscreen-active');
            fsButton.title = this.translations.exitFullscreen;
            
            // Меняем иконку на "выход из fullscreen"
            fsButton.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"></path></svg>';
            
            // Показываем кнопку Save в fullscreen
            const saveFsButton = document.getElementById('save-fullscreen');
            saveFsButton.style.display = 'inline-flex';
        }
        
        if (this.editor) {
            setTimeout(() => {
                this.editor.refresh();
                this.editor.focus();
            }, 100);
        }
    }

    async checkDomainsAvailability() {
        if (!this.isAuthenticated || this.checkInProgress) return;
        
        const filename = this.tabs.currentFileName;
        if (!filename || (!filename.endsWith('.list') && !filename.includes('.list-'))) {
            this.showNotification(this.translations.selectListFile || 'Выберите файл .list для проверки доменов', 'error');
            return;
        }
        
        this.checkInProgress = true;
        
        try {
            const content = this.editor.getValue();
            const domains = this.extractDomainsFromContent(content);
            
            if (domains.length === 0) {
                this.showNotification(this.translations.noDomainsFound || 'Домены не найдены в файле', 'error');
                this.checkInProgress = false;
                return;
            }
            
            // Show availability popup
            this.showAvailabilityPopup(domains);
            
            // Start checking domains
            await this.checkDomains(domains);
            
        } catch (error) {
            console.error('Error checking domains:', error);
            this.showNotification('Ошибка проверки доменов: ' + error.message, 'error');
            this.checkInProgress = false;
        }
    }

    extractDomainsFromContent(content) {
        const lines = content.split('\n');
        const domains = new Set();
        
        for (const line of lines) {
            const trimmedLine = line.trim();
            
            // Skip empty lines and comments
            if (!trimmedLine || trimmedLine.startsWith('#') || trimmedLine.startsWith('//')) {
                continue;
            }
            
            // Extract domain from line (supports various formats)
            let domain = trimmedLine;
            
            // Remove leading http:// or https://
            domain = domain.replace(/^(https?:\/\/)/, '');
            
            // Remove leading www.
            domain = domain.replace(/^www\./, '');
            
            // Remove everything after # (comments)
            domain = domain.split('#')[0].trim();
            
            // Remove everything after / (paths)
            domain = domain.split('/')[0];
            
            // Remove port numbers
            domain = domain.split(':')[0];
            
            // Remove whitespace
            domain = domain.trim();
            
            // Validate domain format (basic validation)
            if (domain && /^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(domain)) {
                domains.add(domain);
            }
        }
        
        return Array.from(domains);
    }

    showAvailabilityPopup(domains) {
        const popup = document.getElementById('availability-results');
        const title = document.getElementById('availability-title');
        const totalDomains = document.getElementById('total-domains');
        const accessibleDomains = document.getElementById('accessible-domains');
        const blockedDomains = document.getElementById('blocked-domains');
        const progress = document.getElementById('progress');
        const progressBar = document.getElementById('progress-bar');
        const domainsList = document.getElementById('domains-list');
        
        title.textContent = this.translations.checkingDomains || 'Проверка доступности доменов...';
        totalDomains.textContent = domains.length;
        accessibleDomains.textContent = '0';
        blockedDomains.textContent = '0';
        progress.textContent = '0%';
        progressBar.style.width = '0%';
        domainsList.innerHTML = '';
        
        // Create domain list container
        domains.forEach(domain => {
            const domainItem = document.createElement('div');
            domainItem.className = 'domain-item pending';
            domainItem.dataset.domain = domain;
            domainItem.innerHTML = `
                <span class="domain-name">${domain}</span>
                <span class="domain-status">⏳ ${this.translations.checkingDomain?.replace('{domain}', '') || 'Проверка...'}</span>
            `;
            domainsList.appendChild(domainItem);
        });
        
        popup.classList.remove('hidden');
        document.body.classList.add('disabled');
    }

    async checkDomains(domains) {
        const total = domains.length;
        let checked = 0;
        let accessible = 0;
        let blocked = 0;
        
        // Update button state
        const checkButton = document.getElementById('check-availability');
        const originalText = checkButton.querySelector('span').textContent;
        checkButton.disabled = true;
        checkButton.classList.add('disabled');
        checkButton.querySelector('span').textContent = '⏳ Проверка...';
        
        const checkPromises = domains.map(async (domain) => {
            try {
                const isAccessible = await this.checkDomainAccessibility(domain);
                
                // Update counters
                checked++;
                if (isAccessible) {
                    accessible++;
                } else {
                    blocked++;
                }
                
                // Update UI
                this.updateAvailabilityUI(domain, isAccessible, checked, total, accessible, blocked);
                
                // Small delay to avoid overwhelming the network
                await new Promise(resolve => setTimeout(resolve, 50));
                
                return { domain, accessible: isAccessible };
            } catch (error) {
                checked++;
                blocked++;
                this.updateAvailabilityUI(domain, false, checked, total, accessible, blocked);
                return { domain, accessible: false, error: error.message };
            }
        });
        
        try {
            // Check domains in batches of 10 to avoid overwhelming
            const batchSize = 10;
            for (let i = 0; i < checkPromises.length; i += batchSize) {
                const batch = checkPromises.slice(i, i + batchSize);
                await Promise.all(batch);
            }
            
            // All checks completed
            this.showNotification(`${this.translations.domainCheckComplete || 'Проверка доменов завершена'}: ${accessible} доступны, ${blocked} заблокированы`, 'success');
            
            // Update popup title
            document.getElementById('availability-title').textContent = 
                `${this.translations.domainCheckComplete || 'Проверка доменов завершена'}`;
            
        } catch (error) {
            console.error('Domain check error:', error);
        } finally {
            this.checkInProgress = false;
            // Restore button state
            checkButton.disabled = false;
            checkButton.classList.remove('disabled');
            checkButton.querySelector('span').textContent = originalText;
        }
    }

    async checkDomainAccessibility(domain) {
        // Try different methods to check domain accessibility
        return new Promise((resolve, reject) => {
            const timeout = 3000; // 3 seconds timeout
            
            // Method 1: Fetch with timeout
            const controller = new AbortController();
            const timeoutId = setTimeout(() => {
                controller.abort();
                reject(new Error('Таймаут'));
            }, timeout);
            
            fetch(`https://${domain}`, {
                method: 'HEAD',
                mode: 'no-cors',
                signal: controller.signal,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            })
            .then(response => {
                clearTimeout(timeoutId);
                // In no-cors mode, we can't read the response status
                // If we get a response, the domain is accessible
                resolve(true);
            })
            .catch(error => {
                clearTimeout(timeoutId);
                // Try alternative method
                this.checkWithImage(domain).then(resolve).catch(() => {
                    // Try one more method with HTTP
                    this.checkWithHttp(domain).then(resolve).catch(() => resolve(false));
                });
            });
        });
    }

    async checkWithImage(domain) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            const timeout = 2000;
            
            const timeoutId = setTimeout(() => {
                img.onerror = null;
                img.onload = null;
                reject(new Error('Таймаут'));
            }, timeout);
            
            img.onload = () => {
                clearTimeout(timeoutId);
                resolve(true);
            };
            
            img.onerror = () => {
                clearTimeout(timeoutId);
                reject(new Error('Изображение не загрузилось'));
            };
            
            // Try to load favicon or a small image
            img.src = `https://${domain}/favicon.ico?t=${Date.now()}`;
        });
    }

    async checkWithHttp(domain) {
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            const timeout = 2000;
            
            xhr.timeout = timeout;
            xhr.onreadystatechange = () => {
                if (xhr.readyState === 4) {
                    resolve(true);
                }
            };
            
            xhr.ontimeout = () => {
                reject(new Error('Таймаут'));
            };
            
            xhr.onerror = () => {
                reject(new Error('Ошибка сети'));
            };
            
            xhr.open('HEAD', `http://${domain}`, true);
            xhr.send();
        });
    }

    updateAvailabilityUI(domain, isAccessible, checked, total, accessible, blocked) {
        // Update statistics
        document.getElementById('total-domains').textContent = total;
        document.getElementById('accessible-domains').textContent = accessible;
        document.getElementById('blocked-domains').textContent = blocked;
        
        const progressPercent = Math.round((checked / total) * 100);
        document.getElementById('progress').textContent = `${progressPercent}%`;
        document.getElementById('progress-bar').style.width = `${progressPercent}%`;
        
        // Update individual domain status
        const domainItem = document.querySelector(`.domain-item[data-domain="${domain}"]`);
        if (domainItem) {
            domainItem.className = isAccessible ? 'domain-item accessible' : 'domain-item blocked';
            domainItem.innerHTML = `
                <span class="domain-name">${domain}</span>
                <span class="domain-status">${isAccessible ? 
                    (this.translations.domainAccessible || 'Доступен') : 
                    (this.translations.domainBlocked || 'Заблокирован')}</span>
            `;
        }
    }

    async loadFiles() {
        try {
            const response = await this.getFiles();
            this.setStatus(response.service);

            if (response.files?.length) {
                for (const filename of response.files) {
                    this.tabs.add(filename);
                }
                
                const firstFile = response.files[0];
                if (firstFile) {
                    await this.loadFile(firstFile);
                }
            }
        } catch (error) {
            console.error('Error loading files:', error);
        }
    }

    async loadFile(filename) {
        if (!this.isAuthenticated) return;
        
        // Проверяем наличие несохраненных изменений
        if (document.body.classList.contains('changed')) {
            const confirm = await this.showConfirm(
                this.translations.confirmClose,
                this.translations.confirm || 'Confirm'
            );
            if (!confirm) return;
        }

        try {
            this.tabs.activate(filename);
            this.currentFilename = filename;
            
            const content = await this.getFileContent(filename);
            this.editor.setValue(content);
            this.originalContent = content;
            
            // Устанавливаем режим shell для всех файлов с .conf в названии
            const isConfigFile = filename.includes('.conf') || filename.includes('.conf-');
            this.editor.setOption('mode', isConfigFile ? 'shell' : 'text/plain');
            this.editor.setOption('readOnly', filename.endsWith('.log'));
            
            document.body.classList.remove('changed');
            
            // Обновляем историю при загрузке нового файла
            if (this.historyManager) {
                this.historyManager.clear();
                this.historyManager.updateCurrentFile(filename);
            }
            
            this.editor.focus();
        } catch (error) {
            console.error('Error loading file:', error);
            this.showNotification(`${this.translations.error}: Failed to load file`, 'error');
        }
    }

    async saveCurrentFile() {
        if (!this.isAuthenticated) return;
        
        const filename = this.tabs.currentFileName;
        if (!filename) return;

        try {
            const result = await this.saveFile(filename, this.editor.getValue());
            if (!result.status) {
                this.originalContent = this.editor.getValue();
                document.body.classList.remove('changed');
                
                // Показываем уведомление в правом верхнем углу
                this.showNotification(this.translations.fileSaved, 'success');
                
                // Обновляем историю после сохранения
                if (this.historyManager) {
                    this.historyManager.updateCurrentFile(filename);
                }
            }
        } catch (error) {
            console.error('Error saving file:', error);
            this.showNotification(`${this.translations.error}: Failed to save file`, 'error');
        }
    }

    async confirmServiceAction(action) {
        if (!this.isAuthenticated) return;
        
        const confirmTexts = {
            'restart': this.translations.confirmRestart,
            'reload': this.translations.confirmReload,
            'stop': this.translations.confirmStop,
            'start': this.translations.confirmStart,
            'upgrade': this.translations.confirmUpdate
        };

        const successMessages = {
            'restart': this.translations.serviceRestarted,
            'reload': this.translations.serviceReloaded,
            'stop': this.translations.serviceStopped,
            'start': this.translations.serviceStarted,
            'upgrade': this.translations.upgradeCompleted
        };

        const confirmText = confirmTexts[action];
        if (!confirmText) return;

        const confirm = await this.showConfirm(
            confirmText,
            this.translations.confirm || 'Confirm'
        );
        if (!confirm) return;

        const success = await this.showProcessing(
            `Executing: nfqws-keenetic ${action}`,
            () => this.serviceActionRequest(action),
            this.translations.processing || 'Processing'
        );

        if (success) {
            if (action === 'stop') {
                this.setStatus(false);
            } else if (action === 'start' || action === 'restart') {
                this.setStatus(true);
            }
            
            const successMessage = successMessages[action];
            if (successMessage) {
                this.showNotification(successMessage, 'success');
            }
            
            if (action === 'upgrade') {
                // Обновляем версию в футере
                const result = await this.postData({ cmd: 'getversion' });
                if (result && result.status === 0 && result.version) {
                    document.getElementById('version').textContent = `v${result.version}`;
                }
                
                setTimeout(() => window.location.reload(), 2000);
            }
        }
    }

    setStatus(status) {
        document.body.classList.toggle('running', status);
    }

    showNotification(message, type = 'success') {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        
        // Уведомления всегда показываются справа
        notification.style.cssText = `
            position: fixed;
            top: 96px;
            right: 30px;
            padding: 12px 20px;
            background: ${type === 'success' ? '#34c759' : '#ff3b30'};
            color: white;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 99999999;
            animation: slideIn 0.3s ease;
            max-width: 300px;
            word-break: break-word;
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }

    // API methods
    async postData(data) {
        const formData = new FormData();
        for (const [key, value] of Object.entries(data)) {
            formData.append(key, value);
        }

        try {
            const response = await fetch('index.php', {
                method: 'POST',
                body: formData,
            });

            if (response.ok) {
                return await response.json();
            }

            if (response.status === 401) {
                this.isAuthenticated = false;
                localStorage.removeItem('hasSession');
                document.body.classList.remove('authenticated');
                this.showLoginForm();
                return { status: 401 };
            }
            
            return { status: response.status };
        } catch (e) {
            console.error('API Error:', e);
            return { status: 500 };
        }
    }

    async getFiles() {
        return this.postData({ cmd: 'filenames' });
    }

    async getFileContent(filename) {
        const data = await this.postData({ cmd: 'filecontent', filename });
        return data.content || '';
    }

    async saveFile(filename, content) {
        return this.postData({ cmd: 'filesave', filename, content });
    }

    async removeFile(filename) {
        return this.postData({ cmd: 'fileremove', filename });
    }

    async serviceActionRequest(action) {
        return this.postData({ cmd: action });
    }
}

// Класс для управления историей изменений
class HistoryManager {
    constructor() {
        this.history = {};
        this.currentFile = '';
        this.maxHistorySize = 100;
    }

    init(editor) {
        this.editor = editor;
        
        // Обработчик изменений для сохранения истории
        this.editor.on('change', (cm, change) => {
            if (this.currentFile) {
                this.addToHistory(change);
            }
        });
    }

    updateCurrentFile(filename) {
        this.currentFile = filename;
        if (!this.history[filename]) {
            this.history[filename] = {
                changes: [],
                currentIndex: -1
            };
        }
    }

    addToHistory(change) {
        if (!this.currentFile) return;
        
        const fileHistory = this.history[this.currentFile];
        
        // Добавляем изменение в историю
        fileHistory.changes = fileHistory.changes.slice(0, fileHistory.currentIndex + 1);
        fileHistory.changes.push(change);
        fileHistory.currentIndex++;
        
        // Ограничиваем размер истории
        if (fileHistory.changes.length > this.maxHistorySize) {
            fileHistory.changes.shift();
            fileHistory.currentIndex--;
        }
    }

    clear() {
        if (this.currentFile && this.history[this.currentFile]) {
            this.history[this.currentFile] = {
                changes: [],
                currentIndex: -1
            };
        }
    }

    canUndo() {
        return this.currentFile && 
               this.history[this.currentFile] && 
               this.history[this.currentFile].currentIndex >= 0;
    }

    canRedo() {
        return this.currentFile && 
               this.history[this.currentFile] && 
               this.history[this.currentFile].currentIndex < this.history[this.currentFile].changes.length - 1;
    }
}

// Класс для управления горячими клавишами
class KeyboardShortcuts {
    constructor(ui) {
        this.ui = ui;
        this.init();
    }

    init() {
        // Обработчик глобальных горячих клавиш
        document.addEventListener('keydown', (e) => {
            // Ctrl+S или Cmd+S для сохранения
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault(); // Предотвращаем стандартное сохранение страницы
                if (this.ui.isAuthenticated) {
                    this.ui.saveCurrentFile();
                }
                return false;
            }
            
            // Ctrl+Z или Cmd+Z для отмены - позволяем CodeMirror обработать
            if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
                // Разрешаем CodeMirror обработать стандартным образом
                return true;
            }
            
            // Ctrl+Y или Ctrl+Shift+Z для повтора
            if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
                // Разрешаем CodeMirror обработать стандартным образом
                return true;
            }
        });
    }
}

// Start the UI
document.addEventListener('DOMContentLoaded', () => {
    window.ui = new UI();
});