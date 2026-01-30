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
        this.currentDomains = []; // Сохраняем текущие домены для повторной проверки
        
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
                newFile: "New File",
                createFile: "Create New File",
                filenameLabel: "File name (without extension)",
                filenameHint: "Enter file name without extension",
                extensionLabel: "File type",
                listFile: ".list file",
                configFile: ".conf file",
                fileCreated: "File created successfully",
                fileCreationFailed: "Failed to create file",
                fileExists: "File already exists",
                protectedFile: "This file is protected and cannot be deleted",
                checkAvailability: "Check Availability",
                checkingDomains: "Checking domain availability...",
                domainCheckComplete: "Domain check completed",
                domainCheckCompleted: "Domain check completed: {accessible} accessible, {blocked} blocked",
                totalDomains: "Total domains:",
                accessibleDomains: "Accessible:",
                blockedDomains: "Blocked:",
                progress: "Progress:",
                domainAccessible: "✓ Accessible",
                domainBlocked: "✗ Blocked",
                noDomainsFound: "No domains found in the file",
                selectListFile: "Select a .list file to check domains",
                checkingDomain: "Checking...",
                invalidFilename: "Invalid file name. Use only letters, numbers, dots, hyphens and underscores",
                enterCredentials: "Please enter login and password",
                loginFailed: "Login failed",
                loginError: "Login error",
                executing: "Executing: nfqws-keenetic",
                authCheckError: "Auth check error",
                failedToLoadFile: "Failed to load file",
                failedToSaveFile: "Failed to save file",
                failedToDeleteFile: "Failed to delete file",
                clearLog: "Clear log",
                deleteFile: "Delete file",
                editFile: "Edit file",
                retryCheck: "Retry Check",
                retryCheckingDomains: "Re-checking domain availability..."
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
                    return false;
                },
                "Cmd-S": (cm) => {
                    this.saveCurrentFile();
                    return false;
                },
                "Ctrl-Z": (cm) => {
                    return CodeMirror.Pass;
                },
                "Cmd-Z": (cm) => {
                    return CodeMirror.Pass;
                },
                "Ctrl-Y": (cm) => {
                    return CodeMirror.Pass;
                },
                "Cmd-Y": (cm) => {
                    return CodeMirror.Pass;
                },
                "Ctrl-Shift-Z": (cm) => {
                    return CodeMirror.Pass;
                },
                "Cmd-Shift-Z": (cm) => {
                    return CodeMirror.Pass;
                }
            }
        });

        this.editor.on('change', () => {
            this.checkForChanges();
        });
        
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
        this.initCreateFilePopup();
        this.initAvailabilityPopup();
    }

    initButtons() {
        // Save button
        document.getElementById('save').addEventListener('click', () => this.saveCurrentFile());
        
        // Create file button
        document.getElementById('create-file').addEventListener('click', () => this.showCreateFilePopup());
        
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

            // Определяем, является ли файл защищенным
            const protectedFiles = [
                'nfqws.conf',
                'user.list',
                'exclude.list',
                'auto.list',
                'ipset.list',
                'ipset_exclude.list'
            ];
            
            const isProtected = protectedFiles.includes(filename);
            
            // Добавляем иконку мусорки только для незащищенных файлов (кроме логов)
            if (!isLog && !isProtected) {
                const trash = document.createElement('div');
                trash.classList.add('nav-trash');
                
                // Создаем SVG контейнер для иконки мусорки
                const trashSvg = document.createElement('div');
                trashSvg.style.cssText = 'width: 15px; height: 15px;';
                trashSvg.innerHTML = `<img src="img/Musor.svg" alt="Delete" style="width: 100%; height: 100%; filter: invert(16%) sepia(99%) saturate(2554%) hue-rotate(0deg) brightness(100%) contrast(114%);">`;
                
                trash.appendChild(trashSvg);
                trash.title = this.translations.deleteFile || "Delete file";

                trash.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    if (!this.isAuthenticated) return;
                    if (await this.showConfirm(this.translations.confirmDelete)) {
                        const result = await this.removeFile(filename);
                        if (result && result.status === 0) {
                            // Удаляем вкладку из DOM
                            if (tabs[filename]) {
                                tabs[filename].remove();
                                delete tabs[filename];
                            }
                            
                            // Если удаляем текущий файл, загружаем первый доступный
                            if (filename === currentFile) {
                                const remainingFiles = Object.keys(tabs);
                                if (remainingFiles.length > 0) {
                                    await this.loadFile(remainingFiles[0]);
                                } else {
                                    this.editor.setValue('');
                                    this.originalContent = '';
                                    this.currentFilename = '';
                                    document.getElementById('current-filename').textContent = this.translations.noFileSelected;
                                    this.checkForChanges();
                                }
                            }
                            
                            this.showNotification(this.translations.fileDeleted, 'success');
                        } else {
                            this.showNotification(this.translations.error + ': ' + this.translations.failedToDeleteFile, 'error');
                        }
                    }
                });

                tab.appendChild(trash);
            }

            // Для логов добавляем кнопку очистки с иконкой веника
            if (isLog) {
                const clear = document.createElement('div');
                clear.classList.add('nav-clear');
                
                // Создаем контейнер для иконки веника
                const clearSvg = document.createElement('div');
                clearSvg.style.cssText = 'width: 15px; height: 15px;';
                clearSvg.innerHTML = `<img src="img/Venik.svg" alt="Clear" style="width: 100%; height: 100%; filter: invert(58%) sepia(89%) saturate(576%) hue-rotate(1deg) brightness(102%) contrast(101%);">`;
                
                clear.appendChild(clearSvg);
                clear.title = this.translations.clearLog || "Clear log";

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
                tab.remove();
                delete tabs[filename];
            }
        };

        const activate = (filename) => {
            Object.values(tabs).forEach(tab => {
                tab.classList.toggle('active', tab.dataset.filename === filename);
            });
            currentFile = filename;
            document.getElementById('current-filename').textContent = filename;
            
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

    initCreateFilePopup() {
        const popup = document.getElementById('create-file-popup');
        const cancelBtn = document.getElementById('create-file-cancel');
        const confirmBtn = document.getElementById('create-file-confirm');
        const closeBtn = popup.querySelector('.popup-close-btn');
        const filenameInput = document.getElementById('new-filename');
        
        // Открытие попапа
        document.getElementById('create-file').addEventListener('click', () => {
            this.showCreateFilePopup();
        });
        
        // Кнопка отмены
        cancelBtn.addEventListener('click', () => {
            this.closeCreateFilePopup();
        });
        
        // Кнопка закрытия
        closeBtn.addEventListener('click', () => {
            this.closeCreateFilePopup();
        });
        
        // Кнопка создания
        confirmBtn.addEventListener('click', async () => {
            await this.createNewFile();
        });
        
        // Enter для создания файла
        filenameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                confirmBtn.click();
            }
        });
    }

    showCreateFilePopup() {
        if (!this.isAuthenticated) return;
        
        const popup = document.getElementById('create-file-popup');
        const title = document.getElementById('create-file-title');
        const filenameLabel = document.getElementById('filename-label');
        const filenameHint = document.getElementById('filename-hint');
        const extensionLabel = document.getElementById('extension-label');
        const cancelBtn = document.getElementById('create-file-cancel');
        const confirmBtn = document.getElementById('create-file-confirm');
        
        // Устанавливаем переводы
        title.textContent = this.translations.createFile || 'Create New File';
        filenameLabel.textContent = this.translations.filenameLabel || 'File name (without extension)';
        filenameHint.textContent = this.translations.filenameHint || 'Enter file name without extension';
        extensionLabel.textContent = this.translations.extensionLabel || 'File type';
        cancelBtn.textContent = this.translations.cancel || 'Cancel';
        confirmBtn.textContent = this.translations.confirm || 'Confirm';
        
        // Устанавливаем переводы для радиокнопок
        const listFileText = document.querySelector('.radio-text:nth-child(1)');
        const configFileText = document.querySelector('.radio-text:nth-child(2)');
        if (listFileText) listFileText.textContent = this.translations.listFile || '.list file';
        if (configFileText) configFileText.textContent = this.translations.configFile || '.conf file';
        
        // Очищаем поле ввода
        document.getElementById('new-filename').value = '';
        
        // Устанавливаем .list по умолчанию
        document.querySelector('input[name="filetype"][value=".list"]').checked = true;
        
        popup.classList.remove('hidden');
        document.body.classList.add('disabled');
        
        // Фокус на поле ввода
        setTimeout(() => {
            document.getElementById('new-filename').focus();
        }, 100);
    }

    closeCreateFilePopup() {
        const popup = document.getElementById('create-file-popup');
        popup.classList.add('hidden');
        document.body.classList.remove('disabled');
    }

    async createNewFile() {
        const filenameInput = document.getElementById('new-filename');
        const filename = filenameInput.value.trim();
        
        if (!filename) {
            this.showNotification(this.translations.error + ': ' + (this.translations.enterCredentials || 'Please enter login and password'), 'error');
            return;
        }
        
        // Проверяем допустимые символы
        if (!/^[a-zA-Z0-9_.-]+$/.test(filename)) {
            this.showNotification(this.translations.error + ': ' + (this.translations.invalidFilename || 'Invalid file name. Use only letters, numbers, dots, hyphens and underscores'), 'error');
            return;
        }
        
        // Получаем выбранное расширение
        const fileType = document.querySelector('input[name="filetype"]:checked').value;
        const fullFilename = filename + fileType;
        
        // Проверяем, существует ли файл
        try {
            const existingFiles = await this.getFiles();
            if (existingFiles.files && existingFiles.files.includes(fullFilename)) {
                this.showNotification(this.translations.fileExists || 'File already exists', 'error');
                return;
            }
            
            // Создаем пустой файл
            const result = await this.saveFile(fullFilename, '');
            
            if (result && result.status === 0) {
                // Добавляем вкладку
                this.tabs.add(fullFilename);
                
                // Загружаем созданный файл
                await this.loadFile(fullFilename);
                
                // Закрываем попап
                this.closeCreateFilePopup();
                
                // Показываем уведомление
                this.showNotification(this.translations.fileCreated || 'File created successfully', 'success');
            } else {
                this.showNotification(this.translations.fileCreationFailed || 'Failed to create file', 'error');
            }
        } catch (error) {
            console.error('Error creating file:', error);
            this.showNotification(this.translations.fileCreationFailed || 'Failed to create file', 'error');
        }
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
                this.showNotification(this.translations.error + ': ' + (this.translations.enterCredentials || 'Please enter login and password'), 'error');
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
                    this.showNotification(this.translations.error + ': ' + (this.translations.loginFailed || 'Login failed'), 'error');
                    passwordInput.value = '';
                }
            } catch (error) {
                this.showNotification(this.translations.error + ': ' + (this.translations.loginError || 'Login error'), 'error');
            }
        });
        
        closeButton.addEventListener('click', () => {
            loginForm.classList.add('hidden');
            document.body.classList.remove('disabled');
        });
        
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
        const retryBtn = document.getElementById('availability-retry');
        const headerCloseBtn = popup.querySelector('.popup-close-btn');
        
        closeBtn.addEventListener('click', () => {
            popup.classList.add('hidden');
            document.body.classList.remove('disabled');
            this.resetAvailabilityUI();
        });
        
        retryBtn.addEventListener('click', () => {
            this.retryDomainCheck();
        });
        
        headerCloseBtn.addEventListener('click', () => {
            popup.classList.add('hidden');
            document.body.classList.remove('disabled');
            this.resetAvailabilityUI();
        });
    }

    resetAvailabilityUI() {
        // Сбрасываем состояние проверки
        this.checkInProgress = false;
        const checkButton = document.getElementById('check-availability');
        checkButton.disabled = false;
        checkButton.classList.remove('disabled');
        
        // Восстанавливаем оригинальный текст кнопки
        const originalText = this.translations.checkAvailability || 'Check Availability';
        checkButton.querySelector('span').textContent = originalText;
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

        buttonClose.addEventListener('click', () => {
            this.closePopup(popup, false);
        });

        closeButton.addEventListener('click', () => {
            this.closePopup(popup, false);
        });

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
        document.getElementById('create-file-text').textContent = this.translations.newFile || 'New File';
        document.getElementById('check-availability-text').textContent = this.translations.checkAvailability || 'Check Availability';
        
        // Popup buttons
        document.getElementById('popup-yes').textContent = this.translations.yes;
        document.getElementById('popup-no').textContent = this.translations.no;
        document.getElementById('popup-close').textContent = this.translations.close;
        
        // Availability popup buttons
        document.getElementById('availability-close').textContent = this.translations.close || 'Close';
        document.getElementById('availability-retry').textContent = this.translations.retryCheck || 'Retry Check';
        
        // Popup titles
        document.getElementById('login-title').textContent = this.translations.login;
        document.getElementById('login-button').textContent = this.translations.login;
        
        // Create file popup
        const createTitle = document.getElementById('create-file-title');
        const filenameLabel = document.getElementById('filename-label');
        const filenameHint = document.getElementById('filename-hint');
        const extensionLabel = document.getElementById('extension-label');
        const listFileText = document.querySelector('.radio-text:nth-child(1)');
        const configFileText = document.querySelector('.radio-text:nth-child(2)');
        const cancelBtn = document.getElementById('create-file-cancel');
        const confirmBtn = document.getElementById('create-file-confirm');
        
        if (createTitle) createTitle.textContent = this.translations.createFile || 'Create New File';
        if (filenameLabel) filenameLabel.textContent = this.translations.filenameLabel || 'File name (without extension)';
        if (filenameHint) filenameHint.textContent = this.translations.filenameHint || 'Enter file name without extension';
        if (extensionLabel) extensionLabel.textContent = this.translations.extensionLabel || 'File type';
        if (listFileText) listFileText.textContent = this.translations.listFile || '.list file';
        if (configFileText) configFileText.textContent = this.translations.configFile || '.conf file';
        if (cancelBtn) cancelBtn.textContent = this.translations.cancel || 'Cancel';
        if (confirmBtn) confirmBtn.textContent = this.translations.confirm || 'Confirm';
        
        // Availability popup
        const availabilityTitle = document.getElementById('availability-title');
        const totalLabel = document.querySelector('.info-row:nth-child(1) .info-label');
        const accessibleLabel = document.querySelector('.info-row:nth-child(2) .info-label');
        const blockedLabel = document.querySelector('.info-row:nth-child(3) .info-label');
        const progressLabel = document.querySelector('.info-row:nth-child(4) .info-label');
        
        if (availabilityTitle) availabilityTitle.textContent = this.translations.checkingDomains || 'Checking domain availability...';
        if (totalLabel) totalLabel.textContent = this.translations.totalDomains || 'Total domains:';
        if (accessibleLabel) accessibleLabel.textContent = this.translations.accessibleDomains || 'Accessible:';
        if (blockedLabel) blockedLabel.textContent = this.translations.blockedDomains || 'Blocked:';
        if (progressLabel) progressLabel.textContent = this.translations.progress || 'Progress:';
        
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
        document.getElementById('create-file').title = this.translations.newFile || 'Create new file';
        document.getElementById('check-availability').title = this.translations.checkAvailability || 'Check domain availability';
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
            editorContainer.classList.add('closing');
            fsButton.title = this.translations.fullscreen;
            
            setTimeout(() => {
                editorContainer.classList.remove('fullscreen', 'closing');
                document.body.classList.remove('fullscreen-active');
                
                fsButton.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"></path></svg>';
                
                const saveFsButton = document.getElementById('save-fullscreen');
                if (!document.body.classList.contains('changed')) {
                    saveFsButton.style.display = 'none';
                }
            }, 500);
        } else {
            editorContainer.classList.add('fullscreen');
            document.body.classList.add('fullscreen-active');
            fsButton.title = this.translations.exitFullscreen;
            
            fsButton.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"></path></svg>';
            
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
            this.showNotification(this.translations.selectListFile || 'Select a .list file to check domains', 'error');
            return;
        }
        
        this.checkInProgress = true;
        
        try {
            const content = this.editor.getValue();
            const domains = this.extractDomainsFromContent(content);
            
            if (domains.length === 0) {
                this.showNotification(this.translations.noDomainsFound || 'No domains found in the file', 'error');
                this.checkInProgress = false;
                return;
            }
            
            // Сохраняем домены для возможной повторной проверки
            this.currentDomains = domains;
            
            this.showAvailabilityPopup(domains);
            await this.checkDomains(domains);
            
        } catch (error) {
            console.error('Error checking domains:', error);
            this.showNotification(this.translations.error + ': ' + error.message, 'error');
            this.checkInProgress = false;
        }
    }

    async retryDomainCheck() {
        if (!this.isAuthenticated || this.checkInProgress || this.currentDomains.length === 0) return;
        
        this.checkInProgress = true;
        
        try {
            // Обновляем заголовок попапа для повторной проверки
            document.getElementById('availability-title').textContent = 
                this.translations.retryCheckingDomains || 'Re-checking domain availability...';
            
            await this.checkDomains(this.currentDomains);
            
        } catch (error) {
            console.error('Error retrying domain check:', error);
            this.showNotification(this.translations.error + ': ' + error.message, 'error');
            this.checkInProgress = false;
        }
    }

    extractDomainsFromContent(content) {
        const lines = content.split('\n');
        const domains = new Set();
        
        for (const line of lines) {
            const trimmedLine = line.trim();
            
            if (!trimmedLine || trimmedLine.startsWith('#') || trimmedLine.startsWith('//')) {
                continue;
            }
            
            let domain = trimmedLine;
            domain = domain.replace(/^(https?:\/\/)/, '');
            domain = domain.replace(/^www\./, '');
            domain = domain.split('#')[0].trim();
            domain = domain.split('/')[0];
            domain = domain.split(':')[0];
            domain = domain.trim();
            
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
        const resultsContainer = document.getElementById('results-container');
        
        title.textContent = this.translations.checkingDomains || 'Checking domain availability...';
        totalDomains.textContent = domains.length;
        accessibleDomains.textContent = '0';
        blockedDomains.textContent = '0';
        progress.textContent = '0%';
        progressBar.style.width = '0%';
        resultsContainer.innerHTML = '';
        
        // Создаем контейнер для результатов
        domains.forEach(domain => {
            const domainItem = document.createElement('div');
            domainItem.className = 'domain-result pending';
            domainItem.dataset.domain = domain;
            domainItem.innerHTML = `
                <span class="domain-name">${domain}</span>
                <span class="domain-status">⏳ ${this.translations.checkingDomain || 'Checking...'}</span>
            `;
            resultsContainer.appendChild(domainItem);
        });
        
        popup.classList.remove('hidden');
        document.body.classList.add('disabled');
    }

    async checkDomains(domains) {
        const total = domains.length;
        let checked = 0;
        let accessible = 0;
        let blocked = 0;
        
        const checkButton = document.getElementById('check-availability');
        const retryButton = document.getElementById('availability-retry');
        const originalText = checkButton.querySelector('span').textContent;
        
        checkButton.disabled = true;
        checkButton.classList.add('disabled');
        checkButton.querySelector('span').textContent = '⏳ ' + (this.translations.checkingDomains || 'Checking...');
        
        retryButton.disabled = true;
        retryButton.classList.add('disabled');
        
        const checkPromises = domains.map(async (domain) => {
            try {
                const isAccessible = await this.checkDomainAccessibility(domain);
                
                checked++;
                if (isAccessible) {
                    accessible++;
                } else {
                    blocked++;
                }
                
                this.updateAvailabilityUI(domain, isAccessible, checked, total, accessible, blocked);
                
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
            const batchSize = 10;
            for (let i = 0; i < checkPromises.length; i += batchSize) {
                const batch = checkPromises.slice(i, i + batchSize);
                await Promise.all(batch);
            }
            
            // Используем новый перевод с заменой переменных
            const message = this.translations.domainCheckCompleted 
                ? this.translations.domainCheckCompleted
                    .replace('{accessible}', accessible)
                    .replace('{blocked}', blocked)
                : `${this.translations.domainCheckComplete || 'Domain check completed'}: ${accessible} accessible, ${blocked} blocked`;
            
            this.showNotification(message, 'success');
            
            document.getElementById('availability-title').textContent = 
                this.translations.domainCheckComplete || 'Domain check completed';
            
        } catch (error) {
            console.error('Domain check error:', error);
            this.showNotification(this.translations.error + ': ' + error.message, 'error');
        } finally {
            this.checkInProgress = false;
            checkButton.disabled = false;
            checkButton.classList.remove('disabled');
            checkButton.querySelector('span').textContent = originalText;
            
            retryButton.disabled = false;
            retryButton.classList.remove('disabled');
        }
    }

    async checkDomainAccessibility(domain) {
        return new Promise((resolve, reject) => {
            const timeout = 3000;
            
            const controller = new AbortController();
            const timeoutId = setTimeout(() => {
                controller.abort();
                reject(new Error('Timeout'));
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
                resolve(true);
            })
            .catch(error => {
                clearTimeout(timeoutId);
                this.checkWithImage(domain).then(resolve).catch(() => {
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
                reject(new Error('Timeout'));
            }, timeout);
            
            img.onload = () => {
                clearTimeout(timeoutId);
                resolve(true);
            };
            
            img.onerror = () => {
                clearTimeout(timeoutId);
                reject(new Error('Image not loaded'));
            };
            
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
                reject(new Error('Timeout'));
            };
            
            xhr.onerror = () => {
                reject(new Error('Network error'));
            };
            
            xhr.open('HEAD', `http://${domain}`, true);
            xhr.send();
        });
    }

    updateAvailabilityUI(domain, isAccessible, checked, total, accessible, blocked) {
        document.getElementById('total-domains').textContent = total;
        document.getElementById('accessible-domains').textContent = accessible;
        document.getElementById('blocked-domains').textContent = blocked;
        
        const progressPercent = Math.round((checked / total) * 100);
        document.getElementById('progress').textContent = `${progressPercent}%`;
        document.getElementById('progress-bar').style.width = `${progressPercent}%`;
        
        const domainItem = document.querySelector(`.domain-result[data-domain="${domain}"]`);
        if (domainItem) {
            domainItem.className = isAccessible ? 'domain-result accessible' : 'domain-result blocked';
            domainItem.innerHTML = `
                <span class="domain-name">${domain}</span>
                <span class="domain-status">${isAccessible ? 
                    (this.translations.domainAccessible || '✓ Accessible') : 
                    (this.translations.domainBlocked || '✗ Blocked')}</span>
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
            
            const isConfigFile = filename.includes('.conf') || filename.includes('.conf-');
            this.editor.setOption('mode', isConfigFile ? 'shell' : 'text/plain');
            this.editor.setOption('readOnly', filename.endsWith('.log'));
            
            document.body.classList.remove('changed');
            
            if (this.historyManager) {
                this.historyManager.clear();
                this.historyManager.updateCurrentFile(filename);
            }
            
            this.editor.focus();
        } catch (error) {
            console.error('Error loading file:', error);
            this.showNotification(this.translations.error + ': ' + (this.translations.failedToLoadFile || 'Failed to load file'), 'error');
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
                
                this.showNotification(this.translations.fileSaved, 'success');
                
                if (this.historyManager) {
                    this.historyManager.updateCurrentFile(filename);
                }
            }
        } catch (error) {
            console.error('Error saving file:', error);
            this.showNotification(this.translations.error + ': ' + (this.translations.failedToSaveFile || 'Failed to save file'), 'error');
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
            `${this.translations.executing || 'Executing: nfqws-keenetic'} ${action}`,
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

class HistoryManager {
    constructor() {
        this.history = {};
        this.currentFile = '';
        this.maxHistorySize = 100;
    }

    init(editor) {
        this.editor = editor;
        
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
        
        fileHistory.changes = fileHistory.changes.slice(0, fileHistory.currentIndex + 1);
        fileHistory.changes.push(change);
        fileHistory.currentIndex++;
        
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

class KeyboardShortcuts {
    constructor(ui) {
        this.ui = ui;
        this.init();
    }

    init() {
        document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                if (this.ui.isAuthenticated) {
                    this.ui.saveCurrentFile();
                }
                return false;
            }
            
            if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
                return true;
            }
            
            if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
                return true;
            }
        });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.ui = new UI();
});