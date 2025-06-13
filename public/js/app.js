// Configuration
const API_URL = window.location.hostname === 'localhost' ? 'http://localhost:3000/api' : 'https://samabled.onrender.com/api';
let currentLanguage = 'fr';
let currentTheme = 'light';
let isAuthenticated = false;

// Variables globales pour le tableau de bord
let dashboardData = null;
let currentTab = 'overview';

// Éléments DOM
const elements = {
    loginBtn: document.getElementById('loginBtn'),
    registerBtn: document.getElementById('registerBtn'),
    themeToggle: document.getElementById('themeToggle'),
    guestHistoryBtn: document.getElementById('guestHistoryBtn'),
    languageButtons: document.querySelectorAll('.language-selector button'),
    inputText: document.getElementById('inputText'),
    correctBtn: document.getElementById('correctBtn'),
    correctedText: document.getElementById('correctedText'),
    errorsList: document.getElementById('errorsList'),
    copyBtn: document.getElementById('copyBtn'),
    styleButtons: document.querySelectorAll('.style-buttons button'),
    loginModal: document.getElementById('loginModal'),
    registerModal: document.getElementById('registerModal'),
    loginForm: document.getElementById('loginForm'),
    registerForm: document.getElementById('registerForm'),
    wordCount: document.getElementById('wordCount'),
    charCount: document.getElementById('charCount')
};

// Gestionnaire de localStorage pour les invités
const guestStorage = {
    saveCorrection: (correction) => {
        const corrections = JSON.parse(localStorage.getItem('guestCorrections') || '[]');
        corrections.unshift({
            ...correction,
            timestamp: new Date().toISOString(),
            id: Date.now()
        });
        // Garder seulement les 10 dernières corrections
        if (corrections.length > 10) {
            corrections.splice(10);
        }
        localStorage.setItem('guestCorrections', JSON.stringify(corrections));
    },

    getCorrections: () => {
        return JSON.parse(localStorage.getItem('guestCorrections') || '[]');
    },

    saveReformulation: (reformulation) => {
        const reformulations = JSON.parse(localStorage.getItem('guestReformulations') || '[]');
        reformulations.unshift({
            ...reformulation,
            timestamp: new Date().toISOString(),
            id: Date.now()
        });
        // Garder seulement les 10 dernières reformulations
        if (reformulations.length > 10) {
            reformulations.splice(10);
        }
        localStorage.setItem('guestReformulations', JSON.stringify(reformulations));
    },

    getReformulations: () => {
        return JSON.parse(localStorage.getItem('guestReformulations') || '[]');
    },

    clearAll: () => {
        localStorage.removeItem('guestCorrections');
        localStorage.removeItem('guestReformulations');
    }
};

// Fonction pour l'historique des invités (définie avant les event listeners)
function renderGuestHistory() {
    const corrections = guestStorage.getCorrections();
    const reformulations = guestStorage.getReformulations();
    
    // Mettre à jour les statistiques
    document.getElementById('guestTotalCorrections').textContent = corrections.length;
    const totalErrors = corrections.reduce((sum, correction) => sum + (correction.errors?.length || 0), 0);
    document.getElementById('guestTotalErrors').textContent = totalErrors;
    
    const historyList = document.getElementById('guestHistoryList');
    
    if (corrections.length === 0) {
        historyList.innerHTML = `
            <div class="empty-guest-history">
                <i class="fas fa-history"></i>
                <h4>Aucun historique</h4>
                <p>Vos corrections apparaîtront ici une fois que vous aurez commencé à utiliser l'application.</p>
            </div>
        `;
        return;
    }
    
    // Trier par date (plus récent en premier)
    const sortedCorrections = corrections.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    historyList.innerHTML = sortedCorrections.map((correction, index) => {
        const errorCount = correction.errors?.length || 0;
        const hasErrors = errorCount > 0;
        
        return `
            <div class="guest-history-item" data-index="${index}">
                <div class="guest-item-header">
                    <span class="guest-item-date">${formatDate(correction.timestamp)}</span>
                    <span class="guest-item-errors ${hasErrors ? 'has-errors' : 'no-errors'}">
                        ${errorCount} erreur${errorCount !== 1 ? 's' : ''}
                    </span>
                </div>
                <div class="guest-item-text">${truncateText(correction.originalText, 100)}</div>
                <div class="guest-item-details" id="guestDetails${index}">
                    <div class="guest-corrected-text">
                        <h5>Texte corrigé</h5>
                        <p>${correction.correctedText}</p>
                    </div>
                    ${hasErrors ? `
                        <div class="guest-errors-list">
                            ${correction.errors.map(error => `
                                <div class="guest-error-item">
                                    <div class="guest-error-type">${error.type}</div>
                                    <div class="guest-error-message">${error.message}</div>
                                </div>
                            `).join('')}
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    }).join('');
    
    // Ajouter les event listeners pour les éléments d'historique
    document.querySelectorAll('.guest-history-item').forEach(item => {
        item.addEventListener('click', () => {
            const index = item.dataset.index;
            toggleGuestHistoryDetails(index);
        });
    });
}

function toggleGuestHistoryDetails(index) {
    const details = document.getElementById(`guestDetails${index}`);
    const item = document.querySelector(`[data-index="${index}"]`);
    
    // Fermer tous les autres détails
    document.querySelectorAll('.guest-item-details').forEach(detail => {
        if (detail !== details) {
            detail.classList.remove('expanded');
        }
    });
    
    document.querySelectorAll('.guest-history-item').forEach(historyItem => {
        if (historyItem !== item) {
            historyItem.classList.remove('active');
        }
    });
    
    // Basculer l'état de l'élément cliqué
    details.classList.toggle('expanded');
    item.classList.toggle('active');
}

// Gestionnaires d'événements
function initializeEventListeners() {
    // Événements existants
    elements.correctBtn.addEventListener('click', handleCorrection);
    elements.copyBtn.addEventListener('click', copyCorrectedText);
    elements.themeToggle.addEventListener('click', toggleTheme);
    elements.inputText.addEventListener('input', updateTextStats);
    
    // Sélecteurs de langue
    document.querySelectorAll('.language-selector button').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.language-selector button').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            switchLanguage(e.target.dataset.lang);
        });
    });

    // Boutons de reformulation
    document.querySelectorAll('[data-style]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            handleReformulation(e.target.dataset.style);
        });
    });

    // Boutons de copie des reformulations
    document.querySelectorAll('.copy-reformulation-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            copyReformulation(e.target.dataset.target);
        });
    });

    // Modales
    elements.loginBtn.addEventListener('click', () => showModal(elements.loginModal));
    elements.registerBtn.addEventListener('click', () => showModal(elements.registerModal));
    elements.loginForm.addEventListener('submit', handleLogin);
    elements.registerForm.addEventListener('submit', handleRegister);
    
    // Déconnexion
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }

    // Fermer les modales en cliquant à l'extérieur
    window.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal')) {
            hideModal(e.target);
        }
    });

    // Boutons de fermeture des modales
    document.querySelectorAll('.close-modal').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const modalId = e.target.dataset.modal;
            const modal = document.getElementById(modalId);
            if (modal) {
                hideModal(modal);
            }
        });
    });

    // Gestion de la visibilité des mots de passe
    document.querySelectorAll('.toggle-password').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            togglePasswordVisibility(btn);
        });
    });

    // Collapse des erreurs
    const errorsHeader = document.getElementById('errorsHeader');
    const errorsList = document.getElementById('errorsList');
    const collapseIcon = document.getElementById('collapseIcon');
    
    if (errorsHeader && errorsList && collapseIcon) {
        errorsHeader.addEventListener('click', () => {
            errorsList.classList.toggle('collapsed');
            collapseIcon.classList.toggle('collapsed');
        });
    }

    // Tableau de bord
    const dashboardBtn = document.querySelector('.dashboard-btn');
    if (dashboardBtn) {
        dashboardBtn.addEventListener('click', openDashboard);
    }

    // Changement de mot de passe
    const changePasswordBtn = document.getElementById('changePasswordBtn');
    const changePasswordForm = document.getElementById('changePasswordForm');
    if (changePasswordBtn) {
        changePasswordBtn.addEventListener('click', () => showModal(document.getElementById('changePasswordModal')));
    }
    if (changePasswordForm) {
        changePasswordForm.addEventListener('submit', handleChangePassword);
    }

    // Réinitialisation de mot de passe
    const forgotPasswordLink = document.getElementById('forgotPasswordLink');
    const backToLoginLink = document.getElementById('backToLoginLink');
    const resetPasswordForm = document.getElementById('resetPasswordForm');
    
    if (forgotPasswordLink) {
        forgotPasswordLink.addEventListener('click', (e) => {
            e.preventDefault();
            hideModal(document.getElementById('loginModal'));
            showModal(document.getElementById('resetPasswordModal'));
        });
    }
    
    if (backToLoginLink) {
        backToLoginLink.addEventListener('click', (e) => {
            e.preventDefault();
            hideModal(document.getElementById('resetPasswordModal'));
            showModal(document.getElementById('loginModal'));
        });
    }
    
    if (resetPasswordForm) {
        resetPasswordForm.addEventListener('submit', handleResetPassword);
    }

    // Historique invité
    const guestHistoryBtn = document.getElementById('guestHistoryBtn');
    const closeGuestHistory = document.getElementById('closeGuestHistory');
    const clearGuestHistory = document.getElementById('clearGuestHistory');
    
    if (guestHistoryBtn) {
        guestHistoryBtn.addEventListener('click', () => {
            const panel = document.getElementById('guestHistoryPanel');
            panel.classList.add('open');
            renderGuestHistory();
        });
    }
    
    if (closeGuestHistory) {
        closeGuestHistory.addEventListener('click', () => {
            const panel = document.getElementById('guestHistoryPanel');
            panel.classList.remove('open');
        });
    }
    
    if (clearGuestHistory) {
        clearGuestHistory.addEventListener('click', () => {
            showConfirmModal(
                'Effacer l\'historique local ?',
                'Cette action supprimera définitivement toutes vos corrections sauvegardées localement. Cette action est irréversible.',
                () => {
                    guestStorage.clearAll();
                    renderGuestHistory();
                    showNotification('Historique local effacé', 'success');
                },
                () => {
                    // Annuler - ne rien faire
                }
            );
        });
    }

    // Initialiser le tableau de bord
    initDashboard();
}

// Fonctions de gestion du thème
function toggleTheme() {
    currentTheme = currentTheme === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', currentTheme);
    localStorage.setItem('theme', currentTheme);
    updateThemeIcon();
}

function updateThemeIcon() {
    const icon = elements.themeToggle.querySelector('i');
    icon.className = currentTheme === 'light' ? 'fas fa-moon' : 'fas fa-sun';
}

// Fonctions de gestion de la langue
function switchLanguage(lang) {
    currentLanguage = lang;
    elements.languageButtons.forEach(button => {
        button.classList.toggle('active', button.dataset.lang === lang);
    });
    updatePlaceholders();
    updateTextStats(); // Mettre à jour les compteurs avec la nouvelle langue
}

function updatePlaceholders() {
    const translations = {
        fr: {
            input: 'Collez votre texte ici...',
            correct: 'Corriger',
            copy: 'Copier',
            professional: 'Style professionnel',
            normal: 'Style normal',
            casual: 'Style familier',
            // Checkboxes
            ignoreAccents: 'Ignorer les accents',
            ignoreCase: 'Ignorer les majuscules',
            ignoreProperNouns: 'Ignorer les noms propres',
            // Main sections
            correctedText: 'Texte corrigé',
            originalWithHighlights: 'Texte original avec erreurs surlignées',
            errorsDetected: 'Erreurs détectées',
            reformulation: 'Reformulation',
            // Dashboard
            dashboard: 'Tableau de bord',
            overview: 'Vue d\'ensemble',
            history: 'Historique',
            progress: 'Progression',
            analysis: 'Analyse',
            // Stats
            correctedTexts: 'Textes corrigés',
            detectedErrors: 'Erreurs détectées',
            errorsPerText: 'Erreurs par texte',
            improvement: 'Amélioration',
            // Dashboard sections
            mostFrequentErrors: 'Erreurs les plus fréquentes',
            personalizedRecommendations: 'Recommandations personnalisées',
            languageStats: 'Statistiques par langue',
            errorEvolution: 'Évolution des erreurs',
            errorTypeDistribution: 'Répartition par type d\'erreur',
            strengths: 'Points forts',
            areasToImprove: 'Points à améliorer',
            personalizedTips: 'Conseils personnalisés',
            // History filters
            allTexts: 'Tous les textes',
            thisWeek: 'Cette semaine',
            thisMonth: 'Ce mois',
            thisYear: 'Cette année',
            allLanguages: 'Toutes les langues',
            french: 'Français',
            english: 'English',
            searchHistory: 'Rechercher dans l\'historique...',
            // Navigation
            logout: 'Déconnexion',
            localHistory: 'Historique local',
            changePassword: 'Changer le mot de passe',
            login: 'Connexion',
            register: 'Inscription',
            // Text stats
            words: 'mots',
            characters: 'caractères',
            // Error messages
            noErrors: 'Aucune erreur détectée dans votre texte. Votre français est impeccable !',
            excellentWork: 'Excellent travail !',
            // Tooltips
            correction: 'Correction'
        },
        en: {
            input: 'Paste your text here...',
            correct: 'Correct',
            copy: 'Copy',
            professional: 'Professional style',
            normal: 'Normal style',
            casual: 'Casual style',
            // Checkboxes (remove ignoreAccents for English)
            ignoreCase: 'Ignore case',
            ignoreProperNouns: 'Ignore proper nouns',
            // Main sections
            correctedText: 'Corrected text',
            originalWithHighlights: 'Original text with highlighted errors',
            errorsDetected: 'Errors detected',
            reformulation: 'Reformulation',
            // Dashboard
            dashboard: 'Dashboard',
            overview: 'Overview',
            history: 'History',
            progress: 'Progress',
            analysis: 'Analysis',
            // Stats
            correctedTexts: 'Corrected texts',
            detectedErrors: 'Detected errors',
            errorsPerText: 'Errors per text',
            improvement: 'Improvement',
            // Dashboard sections
            mostFrequentErrors: 'Most frequent errors',
            personalizedRecommendations: 'Personalized recommendations',
            languageStats: 'Statistics by language',
            errorEvolution: 'Error evolution',
            errorTypeDistribution: 'Error type distribution',
            strengths: 'Strengths',
            areasToImprove: 'Areas to improve',
            personalizedTips: 'Personalized tips',
            // History filters
            allTexts: 'All texts',
            thisWeek: 'This week',
            thisMonth: 'This month',
            thisYear: 'This year',
            allLanguages: 'All languages',
            french: 'Français',
            english: 'English',
            searchHistory: 'Search in history...',
            // Navigation
            logout: 'Logout',
            localHistory: 'Local history',
            changePassword: 'Change password',
            login: 'Login',
            register: 'Register',
            // Text stats
            words: 'words',
            characters: 'characters',
            // Error messages
            noErrors: 'No errors detected in your text. Your English is perfect!',
            excellentWork: 'Excellent work!',
            // Tooltips
            correction: 'Correction'
        }
    };

    const t = translations[currentLanguage];

    // Update basic elements
    elements.inputText.placeholder = t.input;
    elements.correctBtn.textContent = t.correct;
    elements.copyBtn.innerHTML = `<i class="fas fa-copy"></i> ${t.copy}`;
    elements.styleButtons.forEach(button => {
        button.textContent = t[button.dataset.style];
    });

    // Update checkboxes
    updateCheckboxLabels(t);
    
    // Update main section headers
    updateSectionHeaders(t);
    
    // Update reformulation section headers
    updateReformulationHeaders(t);
    
    // Update dashboard if it exists
    updateDashboardTranslations(t);
    
    // Update navigation elements
    updateNavigationTranslations(t);
    
    // Update text stats
    updateTextStats();
}

function updateCheckboxLabels(translations) {
    const checkboxes = document.querySelectorAll('.correction-options label');
    checkboxes.forEach(label => {
        const checkbox = label.querySelector('input[type="checkbox"]');
        if (checkbox) {
            const id = checkbox.id;
            if (id === 'ignoreAccents' && currentLanguage === 'en') {
                // Hide the "ignore accents" checkbox for English
                label.style.display = 'none';
            } else if (id === 'ignoreAccents' && currentLanguage === 'fr') {
                // Show it back for French
                label.style.display = 'flex';
                label.innerHTML = `<input type="checkbox" id="ignoreAccents"> ${translations.ignoreAccents}`;
            } else if (translations[id]) {
                label.innerHTML = `<input type="checkbox" id="${id}"> ${translations[id]}`;
            }
        }
    });
}

function updateSectionHeaders(translations) {
    // Update main section headers
    const correctedTextHeader = document.querySelector('.corrected-text h3');
    if (correctedTextHeader) correctedTextHeader.textContent = translations.correctedText;
    
    const originalHighlightHeader = document.querySelector('.original-highlighted-section h3');
    if (originalHighlightHeader) originalHighlightHeader.textContent = translations.originalWithHighlights;
    
    const errorsHeader = document.querySelector('.errors-header h3');
    if (errorsHeader) {
        const badge = errorsHeader.querySelector('#errorsBadge');
        const icon = errorsHeader.querySelector('.collapse-icon');
        errorsHeader.innerHTML = `${translations.errorsDetected} `;
        if (badge) errorsHeader.appendChild(badge);
        if (icon) errorsHeader.appendChild(icon);
    }
    
    const reformulationHeader = document.querySelector('.reformulation-section h3');
    if (reformulationHeader) reformulationHeader.textContent = translations.reformulation;
}

function updateDashboardTranslations(translations) {
    // Dashboard title
    const dashboardTitle = document.querySelector('.dashboard-content h2');
    if (dashboardTitle) {
        dashboardTitle.innerHTML = `<i class="fas fa-chart-line"></i> ${translations.dashboard}`;
    }
    
    // Dashboard tabs
    const tabs = document.querySelectorAll('.tab-btn');
    tabs.forEach(tab => {
        const tabName = tab.dataset.tab;
        if (translations[tabName]) {
            tab.textContent = translations[tabName];
        }
    });
    
    // Stats cards
    const statCards = document.querySelectorAll('.stat-card p');
    if (statCards.length >= 4) {
        statCards[0].textContent = translations.correctedTexts;
        statCards[1].textContent = translations.detectedErrors;
        statCards[2].textContent = translations.errorsPerText;
        statCards[3].textContent = translations.improvement;
    }
    
    // Dashboard section headers
    const dashboardSections = document.querySelectorAll('.dashboard-section h3');
    if (dashboardSections.length >= 2) {
        dashboardSections[0].textContent = translations.mostFrequentErrors;
        dashboardSections[1].textContent = translations.personalizedRecommendations;
    }
    
    // Language statistics section header
    const languageStatsHeader = document.querySelector('.language-stats-section h3');
    if (languageStatsHeader) {
        languageStatsHeader.textContent = translations.languageStats;
    }
    
    // Progress section headers
    const progressSections = document.querySelectorAll('.progress-section h3');
    if (progressSections.length >= 2) {
        progressSections[0].textContent = translations.errorEvolution;
        progressSections[1].textContent = translations.errorTypeDistribution;
    }
    
    // Analysis section headers
    const analysisSections = document.querySelectorAll('.analysis-section h3');
    if (analysisSections.length >= 3) {
        analysisSections[0].innerHTML = `<i class="fas fa-thumbs-up"></i> ${translations.strengths}`;
        analysisSections[1].innerHTML = `<i class="fas fa-target"></i> ${translations.areasToImprove}`;
        analysisSections[2].innerHTML = `<i class="fas fa-lightbulb"></i> ${translations.personalizedTips}`;
    }
    
    // History filters
    const historyFilter = document.getElementById('historyFilter');
    if (historyFilter) {
        historyFilter.innerHTML = `
            <option value="all">${translations.allTexts}</option>
            <option value="week">${translations.thisWeek}</option>
            <option value="month">${translations.thisMonth}</option>
            <option value="year">${translations.thisYear}</option>
        `;
    }
    
    const languageFilter = document.getElementById('languageFilter');
    if (languageFilter) {
        languageFilter.innerHTML = `
            <option value="all">${translations.allLanguages}</option>
            <option value="fr">${translations.french}</option>
            <option value="en">${translations.english}</option>
        `;
    }
    
    const historySearch = document.getElementById('historySearch');
    if (historySearch) {
        historySearch.placeholder = translations.searchHistory;
    }
}

function updateReformulationHeaders(translations) {
    // Update reformulation container headers
    const reformulationHeaders = document.querySelectorAll('.reformulation-header h4');
    reformulationHeaders.forEach((header, index) => {
        const styles = ['professional', 'normal', 'casual'];
        if (styles[index] && translations[styles[index]]) {
            header.textContent = translations[styles[index]];
        }
    });
    
    // Update copy buttons in reformulation section
    const copyButtons = document.querySelectorAll('.copy-reformulation-btn');
    copyButtons.forEach(button => {
        button.innerHTML = `<i class="fas fa-copy"></i> ${translations.copy}`;
    });
}

function updateNavigationTranslations(translations) {
    // Dashboard button
    const dashboardBtn = document.getElementById('dashboardBtn');
    if (dashboardBtn) {
        dashboardBtn.innerHTML = `<i class="fas fa-chart-line"></i> ${translations.dashboard}`;
    }
    
    // Change password button
    const changePasswordBtn = document.getElementById('changePasswordBtn');
    if (changePasswordBtn) {
        changePasswordBtn.innerHTML = `<i class="fas fa-key"></i> ${translations.changePassword}`;
    }
    
    // Logout button
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.innerHTML = `<i class="fas fa-sign-out-alt"></i> ${translations.logout}`;
    }
    
    // Guest history button
    const guestHistoryBtn = document.getElementById('guestHistoryBtn');
    if (guestHistoryBtn) {
        guestHistoryBtn.innerHTML = `<i class="fas fa-history"></i> ${translations.localHistory}`;
    }
    
    // Guest history panel header
    const guestHistoryHeader = document.querySelector('.guest-history-header h3');
    if (guestHistoryHeader) {
        guestHistoryHeader.innerHTML = `<i class="fas fa-history"></i> ${translations.localHistory}`;
    }
    
    // Login and register buttons
    const loginBtn = document.getElementById('loginBtn');
    if (loginBtn) {
        loginBtn.textContent = translations.login;
    }
    
    const registerBtn = document.getElementById('registerBtn');
    if (registerBtn) {
        registerBtn.textContent = translations.register;
    }
}

// Fonction de détection automatique de langue via LLM
async function detectLanguage(text) {
    try {
        const headers = {
            'Content-Type': 'application/json'
        };

        // Ajouter le token si l'utilisateur est connecté
        const token = localStorage.getItem('token');
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        const response = await fetch(`${API_URL}/detect-language`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ text })
        });

        if (!response.ok) {
            console.warn('Erreur détection langue, utilisation langue interface');
            return currentLanguage;
        }

        const data = await response.json();
        return data.language || currentLanguage;
        
    } catch (error) {
        console.warn('Erreur détection langue:', error);
        return currentLanguage;
    }
}

// Fonctions de correction
async function handleCorrection() {
    const text = elements.inputText.value;
    if (!text) {
        showNotification('Veuillez saisir un texte à corriger', 'warning');
        return;
    }

    const options = getOptionsFromCheckboxes();

    // Afficher le loader et désactiver tous les boutons
    showLoading('Détection de la langue...');
    disableAllButtons(true);

    // Détecter automatiquement la langue du texte
    const detectedLanguage = await detectLanguage(text);
    console.log('Langue détectée:', detectedLanguage);
    
    // Afficher la langue détectée à l'utilisateur
    const languageName = detectedLanguage === 'fr' ? 'Français' : 'English';
    showNotification(`Langue détectée : ${languageName}`, 'info');
    
    // Mettre à jour le message de chargement
    showLoading('Correction en cours...');

    try {
        const headers = {
            'Content-Type': 'application/json'
        };

        // Ajouter le token si l'utilisateur est connecté
        const token = localStorage.getItem('token');
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        const response = await fetch(`${API_URL}/correct`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                text,
                language: detectedLanguage,
                options
            })
        });

        if (!response.ok) {
            throw new Error(`Erreur ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        displayCorrection(data);

        // Sauvegarder en localStorage si mode invité
        if (data.isGuest) {
            guestStorage.saveCorrection({
                originalText: text,
                correctedText: data.correctedText,
                errors: data.errors,
                language: detectedLanguage,
                options
            });
            showNotification('Correction sauvegardée localement (mode invité)', 'info');
        } else {
            showNotification('Correction sauvegardée dans votre compte', 'success');
            
            // Mettre à jour le tableau de bord si l'utilisateur est connecté
            refreshDashboardData();
        }

    } catch (error) {
        console.error('Erreur:', error);
        showNotification('Une erreur est survenue lors de la correction', 'error');
    } finally {
        // Masquer le loader et réactiver tous les boutons
        hideLoading();
        disableAllButtons(false);
    }
}

function displayCorrection(data) {
    // Afficher le texte corrigé
    elements.correctedText.textContent = data.correctedText;
    
    // Afficher/masquer la section "Texte original avec erreurs surlignées" selon s'il y a des erreurs
    const originalHighlightSection = document.querySelector('.original-highlighted-section');
    if (data.errors && data.errors.length > 0) {
        if (originalHighlightSection) {
            originalHighlightSection.style.display = 'block';
        }
        // Afficher le texte original avec erreurs surlignées
        displayOriginalWithHighlights(data.originalText, data.errors);
    } else {
        if (originalHighlightSection) {
            originalHighlightSection.style.display = 'none';
        }
    }
    
    // Afficher la liste des erreurs
    displayErrors(data.errors);
}

function displayOriginalWithHighlights(originalText, errors) {
    const originalTextContainer = document.getElementById('originalTextHighlighted');
    if (!originalTextContainer) return;
    
    // Vérifier que originalText existe
    if (!originalText) {
        originalTextContainer.innerHTML = '<p class="error-loading">Texte original non disponible</p>';
        return;
    }
    
    if (!errors || errors.length === 0) {
        originalTextContainer.innerHTML = `<p>${originalText}</p>`;
        return;
    }
    
    // Créer une copie du texte pour le surlignage
    let highlightedText = originalText;
    
    // Dédupliquer les erreurs qui ont les mêmes positions
    const uniqueErrors = [];
    const seenPositions = new Set();
    
    errors.forEach(error => {
        const positionKey = `${error.positionStart}-${error.positionEnd}`;
        if (!seenPositions.has(positionKey) && error.positionStart !== undefined && error.positionEnd !== undefined) {
            uniqueErrors.push(error);
            seenPositions.add(positionKey);
        }
    });
    
    // Trier les erreurs par position pour éviter les conflits (de la fin vers le début)
    const sortedErrors = uniqueErrors.sort((a, b) => (b.positionStart || 0) - (a.positionStart || 0));
    
    // Appliquer le surlignage pour chaque erreur
    sortedErrors.forEach(error => {
        if (error.positionStart !== undefined && error.positionEnd !== undefined && 
            error.positionStart >= 0 && error.positionEnd > error.positionStart) {
            
            const before = highlightedText.substring(0, error.positionStart);
            const errorText = highlightedText.substring(error.positionStart, error.positionEnd);
            const after = highlightedText.substring(error.positionEnd);
            
            const severityClass = `error-highlight-${error.severity || 'medium'}`;
            const correctionLabel = currentLanguage === 'fr' ? 'Correction' : 'Correction';
            const tooltipText = error.correction ? `${correctionLabel}: ${error.correction}` : error.message;
            // Échapper les caractères spéciaux dans le title
            const escapedTooltip = tooltipText ? tooltipText.replace(/"/g, '&quot;').replace(/'/g, '&#39;') : '';
            const highlightedError = `<span class="error-highlight ${severityClass}" title="${escapedTooltip}">${errorText}</span>`;
            
            highlightedText = before + highlightedError + after;
        }
    });
    
    originalTextContainer.innerHTML = `<p>${highlightedText}</p>`;
}

function highlightErrors(text, errors) {
    // Cette fonction n'est plus utilisée car on affiche juste le texte corrigé
    return text;
}

function displayErrors(errors) {
    const errorsList = elements.errorsList;
    const errorsBadge = document.getElementById('errorsBadge');
    const errorsHeader = document.getElementById('errorsHeader');
    
    // Mettre à jour le badge
    updateErrorsBadge(errors.length);
    
    if (errors.length === 0) {
        const excellentWork = currentLanguage === 'fr' ? 'Excellent travail !' : 'Excellent work!';
        const noErrors = currentLanguage === 'fr' ? 
            'Aucune erreur détectée dans votre texte. Votre français est impeccable !' :
            'No errors detected in your text. Your English is perfect!';
            
        errorsList.innerHTML = `
            <div class="no-errors">
                <i class="fas fa-check-circle"></i>
                <h4>${excellentWork}</h4>
                <p>${noErrors}</p>
            </div>
        `;
        return;
    }

    // Get translations for error display
    const incorrectLabel = currentLanguage === 'fr' ? 'Ce qui était incorrect :' : 'What was incorrect:';
    const beforeLabel = currentLanguage === 'fr' ? 'Avant :' : 'Before:';
    const afterLabel = currentLanguage === 'fr' ? 'Après :' : 'After:';

    errorsList.innerHTML = errors.map(error => `
        <div class="error-item error-${error.severity}">
            <div class="error-header">
                <div class="error-title">
                    <i class="fas ${getErrorIcon(error.severity)}"></i>
                    <strong>${error.type}</strong>
                    <span class="error-severity">${getSeverityLabel(error.severity)}</span>
                </div>
            </div>
            <div class="error-content">
                <div class="error-explanation">
                    <h5>${incorrectLabel}</h5>
                    <p class="error-description">${error.message}</p>
                </div>
                
                ${error.original && error.correction && error.original !== error.correction ? 
                    `<div class="error-correction">
                        <div class="correction-before">
                            <span class="label">❌ ${beforeLabel}</span>
                            <span class="text">"${error.original}"</span>
                        </div>
                        <div class="correction-after">
                            <span class="label">✅ ${afterLabel}</span>
                            <span class="text">"${error.correction}"</span>
                        </div>
                    </div>` : ''
                }
            </div>
        </div>
    `).join('');
}

function getErrorIcon(severity) {
    const icons = {
        severe: 'fa-exclamation-circle',
        medium: 'fa-exclamation-triangle',
        minor: 'fa-info-circle',
        suggestion: 'fa-lightbulb'
    };
    return icons[severity] || 'fa-info-circle';
}

function getSeverityLabel(severity) {
    if (currentLanguage === 'fr') {
        const labels = {
            severe: 'Erreur grave',
            medium: 'Erreur moyenne', 
            minor: 'Erreur mineure',
            suggestion: 'Suggestion'
        };
        return labels[severity] || 'Erreur';
    } else {
        const labels = {
            severe: 'Severe error',
            medium: 'Medium error', 
            minor: 'Minor error',
            suggestion: 'Suggestion'
        };
        return labels[severity] || 'Error';
    }
}

function updateErrorsBadge(errorCount) {
    const errorsBadge = document.getElementById('errorsBadge');
    
    if (errorCount === 0) {
        errorsBadge.classList.add('hidden');
        return;
    }
    
    errorsBadge.classList.remove('hidden');
    errorsBadge.textContent = errorCount;
    
    // Supprimer les classes existantes
    errorsBadge.classList.remove('excellent', 'good', 'needs-improvement');
    
    // Ajouter la classe appropriée selon le nombre d'erreurs
    if (errorCount <= 2) {
        errorsBadge.classList.add('excellent');
    } else if (errorCount <= 5) {
        errorsBadge.classList.add('good');
    } else {
        errorsBadge.classList.add('needs-improvement');
    }
}

function getOptionsFromCheckboxes() {
    return {
        ignoreAccents: document.getElementById('ignoreAccents').checked,
        ignoreCase: document.getElementById('ignoreCase').checked,
        ignoreProperNouns: document.getElementById('ignoreProperNouns').checked
    };
}

// Fonctions de reformulation
async function handleReformulation(style) {
    const text = elements.inputText.value;
    if (!text) {
        showNotification('Veuillez saisir un texte à reformuler', 'warning');
        return;
    }

    // Désactiver le bouton pendant le traitement
    const button = document.querySelector(`[data-style="${style}"]`);
    const originalText = button.textContent;
    button.disabled = true;
    button.textContent = 'Reformulation...';

    try {
        const headers = {
            'Content-Type': 'application/json'
        };

        const token = localStorage.getItem('token');
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        const response = await fetch(`${API_URL}/reformulate`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                text,
                language: currentLanguage,
                style
            })
        });

        if (!response.ok) {
            throw new Error(`Erreur ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        const outputElement = document.getElementById(`${style}Output`);
        outputElement.textContent = data.reformulatedText;

        // Activer le bouton de copie correspondant
        const copyButton = document.querySelector(`[data-target="${style}Output"]`);
        copyButton.disabled = false;

        // Sauvegarder en localStorage si mode invité
        if (data.isGuest) {
            guestStorage.saveReformulation({
                originalText: text,
                reformulatedText: data.reformulatedText,
                style,
                language: currentLanguage
            });
        }

        showNotification(`Reformulation ${style} terminée !`, 'success');

    } catch (error) {
        console.error('Erreur:', error);
        showNotification('Une erreur est survenue lors de la reformulation', 'error');
    } finally {
        // Restaurer le bouton
        button.disabled = false;
        button.textContent = originalText;
    }
}

// Fonction pour copier une reformulation
function copyReformulation(targetId) {
    const element = document.getElementById(targetId);
    const text = element.textContent;
    
    if (!text || text.trim() === '') {
        showNotification('Aucun texte à copier', 'warning');
        return;
    }

    navigator.clipboard.writeText(text).then(() => {
        showNotification('Reformulation copiée !', 'success');
        
        // Animation du bouton
        const button = document.querySelector(`[data-target="${targetId}"]`);
        const originalText = button.innerHTML;
        button.innerHTML = '<i class="fas fa-check"></i> Copié !';
        button.style.backgroundColor = '#4CAF50';
        
        setTimeout(() => {
            button.innerHTML = originalText;
            button.style.backgroundColor = '';
        }, 2000);
        
    }).catch(() => {
        showNotification('Erreur lors de la copie', 'error');
    });
}

// Fonctions d'authentification
async function handleLogin(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    
    try {
        const response = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: formData.get('email'),
                password: formData.get('password')
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Erreur de connexion');
        }

        const data = await response.json();
        localStorage.setItem('token', data.token);
        hideModal(elements.loginModal);
        updateAuthUI(true, data.user.email);
        showNotification('Connexion réussie !', 'success');
        
        // Proposer de migrer les données localStorage
        offerDataMigration();
        
    } catch (error) {
        console.error('Erreur:', error);
        showNotification(error.message, 'error');
    }
}

async function handleRegister(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    
    const password = formData.get('password');
    const confirmPassword = formData.get('confirmPassword');
    
    if (password !== confirmPassword) {
        showNotification('Les mots de passe ne correspondent pas', 'error');
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: formData.get('email'),
                password: password
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Erreur d\'inscription');
        }

        const data = await response.json();
        localStorage.setItem('token', data.token);
        hideModal(elements.registerModal);
        updateAuthUI(true, data.user.email);
        showNotification('Inscription réussie !', 'success');
        
        // Proposer de migrer les données localStorage
        offerDataMigration();
        
    } catch (error) {
        console.error('Erreur:', error);
        showNotification(error.message, 'error');
    }
}

// Fonctions utilitaires
function showModal(modal) {
    modal.style.display = 'block';
    
    // Réinitialiser l'état des boutons toggle password dans cette modale
    const toggleButtons = modal.querySelectorAll('.toggle-password');
    toggleButtons.forEach(button => {
        const container = button.closest('.password-input-container');
        if (container) {
            const passwordInput = container.querySelector('input');
            const icon = button.querySelector('i');
            
            if (passwordInput && icon) {
                // Forcer le type password et l'icône eye
                passwordInput.type = 'password';
                icon.classList.remove('fa-eye-slash');
                icon.classList.add('fa-eye');
                button.setAttribute('aria-label', 'Afficher le mot de passe');
                button.setAttribute('title', 'Afficher le mot de passe');
            }
        }
    });
}

function hideModal(modal) {
    modal.style.display = 'none';
}

function showNotification(message, type = 'info') {
    // Créer une notification temporaire
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    
    // Styles inline pour la notification
    const isMobile = window.innerWidth < 768;
    notification.style.cssText = `
        position: fixed;
        top: ${isMobile ? '10px' : '20px'};
        right: ${isMobile ? '10px' : '20px'};
        left: ${isMobile ? '10px' : 'auto'};
        padding: ${isMobile ? '12px 16px' : '15px 20px'};
        border-radius: 4px;
        color: white;
        z-index: 1001;
        max-width: ${isMobile ? 'calc(100% - 20px)' : '300px'};
        opacity: 0;
        transition: opacity 0.3s;
        font-size: ${isMobile ? '14px' : '16px'};
        text-align: center;
    `;
    
    // Couleurs selon le type
    const colors = {
        success: '#4CAF50',
        error: '#f44336',
        warning: '#ff9800',
        info: '#2196F3'
    };
    notification.style.backgroundColor = colors[type] || colors.info;
    
    document.body.appendChild(notification);
    
    // Animation d'apparition
    setTimeout(() => notification.style.opacity = '1', 100);
    
    // Suppression automatique (plus long sur mobile)
    const duration = isMobile ? 4000 : 3000;
    setTimeout(() => {
        notification.style.opacity = '0';
        setTimeout(() => {
            if (document.body.contains(notification)) {
                document.body.removeChild(notification);
            }
        }, 300);
    }, duration);
}

function copyCorrectedText() {
    const text = elements.correctedText.textContent;
    navigator.clipboard.writeText(text).then(() => {
        showNotification('Texte copié !', 'success');
    }).catch(() => {
        showNotification('Erreur lors de la copie', 'error');
    });
}

function updateAuthUI(authenticated, userEmail = null) {
    isAuthenticated = authenticated;
    
    const authButtons = document.getElementById('authButtons');
    const userMenu = document.getElementById('userMenu');
    const userEmailElement = document.getElementById('userEmail');
    const guestHistoryBtn = document.getElementById('guestHistoryBtn');
    
    if (authenticated) {
        // Masquer les boutons de connexion/inscription
        if (authButtons) authButtons.classList.add('hidden');
        
        // Afficher le menu utilisateur
        if (userMenu) userMenu.classList.remove('hidden');
        
        // Masquer le bouton historique invité
        if (guestHistoryBtn) guestHistoryBtn.classList.add('hidden');
        
        // Afficher l'email de l'utilisateur
        if (userEmailElement && userEmail) {
            userEmailElement.textContent = userEmail;
        }
        
        // Mettre à jour les boutons de navigation
        elements.loginBtn.style.display = 'none';
        elements.registerBtn.style.display = 'none';
    } else {
        // Afficher les boutons de connexion/inscription
        if (authButtons) authButtons.classList.remove('hidden');
        
        // Masquer le menu utilisateur
        if (userMenu) userMenu.classList.add('hidden');
        
        // Afficher le bouton historique invité
        if (guestHistoryBtn) guestHistoryBtn.classList.remove('hidden');
        
        // Réinitialiser l'affichage des boutons
        elements.loginBtn.style.display = 'block';
        elements.registerBtn.style.display = 'block';
    }
}

function offerDataMigration() {
    const corrections = guestStorage.getCorrections();
    const reformulations = guestStorage.getReformulations();
    
    if (corrections.length > 0 || reformulations.length > 0) {
        const migrate = confirm(`Vous avez ${corrections.length} corrections et ${reformulations.length} reformulations sauvegardées localement. Voulez-vous les migrer vers votre compte ?`);
        if (migrate) {
            // TODO: Implémenter la migration des données
            showNotification('Migration des données en cours...', 'info');
            // Pour l'instant, on garde les données locales
        }
    }
}

// Fonctions de comptage de texte
function updateTextStats() {
    const text = elements.inputText.value;
    const wordCount = countWords(text);
    const charCount = text.length;

    // Mettre à jour l'affichage selon la langue
    if (currentLanguage === 'fr') {
        elements.wordCount.textContent = `${wordCount} ${wordCount <= 1 ? 'mot' : 'mots'}`;
        elements.charCount.textContent = `${charCount} ${charCount <= 1 ? 'caractère' : 'caractères'}`;
    } else {
        elements.wordCount.textContent = `${wordCount} ${wordCount <= 1 ? 'word' : 'words'}`;
        elements.charCount.textContent = `${charCount} ${charCount <= 1 ? 'character' : 'characters'}`;
    }

    // Changer la couleur selon le nombre de mots
    if (wordCount === 0) {
        elements.wordCount.style.color = 'var(--text-color)';
    } else if (wordCount < 50) {
        elements.wordCount.style.color = 'var(--error-minor)';
    } else if (wordCount < 200) {
        elements.wordCount.style.color = 'var(--primary-color)';
    } else {
        elements.wordCount.style.color = 'var(--error-medium)';
    }
}

function countWords(text) {
    if (!text || text.trim() === '') {
        return 0;
    }
    
    // Nettoyer le texte et compter les mots
    const cleanText = text.trim()
        .replace(/\s+/g, ' ') // Remplacer les espaces multiples par un seul
        .replace(/[^\w\s\u00C0-\u017F\u0100-\u024F]/g, ' ') // Garder les lettres, espaces et accents
        .trim();
    
    if (cleanText === '') {
        return 0;
    }
    
    return cleanText.split(' ').filter(word => word.length > 0).length;
}

// Initialisation
function initialize() {
    // Charger le thème sauvegardé
    const savedTheme = localStorage.getItem('theme') || 'light';
    currentTheme = savedTheme;
    document.documentElement.setAttribute('data-theme', currentTheme);
    updateThemeIcon();

    // Initialiser les écouteurs d'événements
    initializeEventListeners();

    // Initialiser les compteurs de texte
    updateTextStats();

    // Vérifier l'authentification
    const token = localStorage.getItem('token');
    if (token) {
        // Essayer de décoder l'email du token
        const email = getUserEmailFromToken(token);
        updateAuthUI(true, email);
    } else {
        // Mode invité - s'assurer que l'interface est correctement configurée
        updateAuthUI(false);
        // Mode invité activé silencieusement
    }

    // Optimisations mobiles
    setupMobileOptimizations();
}

// Optimisations spécifiques pour mobile
function setupMobileOptimizations() {
    // Détecter si on est sur mobile
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    if (isMobile) {
        // Ajouter une classe CSS pour mobile
        document.body.classList.add('mobile-device');
        
        // Gérer l'orientation
        window.addEventListener('orientationchange', () => {
            setTimeout(() => {
                // Forcer un reflow pour corriger les problèmes d'affichage
                window.scrollTo(0, 0);
            }, 100);
        });

        // Optimiser les textarea pour mobile
        const textareas = document.querySelectorAll('textarea');
        textareas.forEach(textarea => {
            // Éviter le zoom automatique sur iOS
            textarea.addEventListener('focus', () => {
                if (window.innerWidth < 768) {
                    setTimeout(() => {
                        textarea.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }, 300);
                }
            });
        });

        // Améliorer les modales sur mobile
        const modals = document.querySelectorAll('.modal');
        modals.forEach(modal => {
            modal.addEventListener('touchstart', (e) => {
                if (e.target === modal) {
                    hideModal(modal);
                }
                    });
    });
}



    // Gérer le redimensionnement de la fenêtre
    let resizeTimer;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
            // Ajuster la hauteur des textarea si nécessaire
            adjustTextareaHeight();
        }, 250);
    });
}

// Ajuster la hauteur des textarea selon l'écran
function adjustTextareaHeight() {
    const textarea = elements.inputText;
    if (window.innerWidth < 480) {
        textarea.style.height = '120px';
    } else if (window.innerWidth < 768) {
        textarea.style.height = '150px';
    } else {
        textarea.style.height = '200px';
    }
}

// Démarrer l'application
document.addEventListener('DOMContentLoaded', initialize);

function togglePasswordVisibility(button) {
    // Trouver le conteneur parent
    const container = button.closest('.password-input-container');
    if (!container) {
        console.warn('Container .password-input-container non trouvé');
        return;
    }
    
    // Trouver l'input de mot de passe
    const passwordInput = container.querySelector('input[type="password"], input[type="text"]');
    if (!passwordInput) {
        console.warn('Input de mot de passe non trouvé');
        return;
    }
    
    // Trouver l'icône
    const icon = button.querySelector('i');
    if (!icon) {
        console.warn('Icône non trouvée dans le bouton');
        return;
    }
    
    // Forcer le focus sur l'input pour éviter les problèmes de timing
    const cursorPosition = passwordInput.selectionStart;
    
    // Basculer le type d'input et l'icône
    if (passwordInput.type === 'password') {
        passwordInput.type = 'text';
        icon.classList.remove('fa-eye');
        icon.classList.add('fa-eye-slash');
        button.setAttribute('aria-label', 'Masquer le mot de passe');
        button.setAttribute('title', 'Masquer le mot de passe');
    } else {
        passwordInput.type = 'password';
        icon.classList.remove('fa-eye-slash');
        icon.classList.add('fa-eye');
        button.setAttribute('aria-label', 'Afficher le mot de passe');
        button.setAttribute('title', 'Afficher le mot de passe');
    }
    
    // Restaurer la position du curseur et le focus
    setTimeout(() => {
        passwordInput.focus();
        passwordInput.setSelectionRange(cursorPosition, cursorPosition);
    }, 0);
}

// Fonction de déconnexion
function handleLogout() {
    // Supprimer le token
    localStorage.removeItem('token');
    
    // Mettre à jour l'interface
    updateAuthUI(false);
    
    // Afficher une notification
    showNotification('Déconnexion réussie', 'success');
    
    // Optionnel : proposer de garder les données locales
    const corrections = guestStorage.getCorrections();
    const reformulations = guestStorage.getReformulations();
    
    if (corrections.length > 0 || reformulations.length > 0) {
        showConfirmModal(
            'Conserver les données locales ?',
            'Voulez-vous conserver vos données locales (corrections et reformulations) ?',
            () => {
                // OK - ne rien faire, garder les données
            },
            () => {
                // Cancel - supprimer les données
                guestStorage.clearAll();
                showNotification('Données locales supprimées', 'info');
            }
        );
    }
}

// Fonction pour décoder le JWT et extraire l'email
function getUserEmailFromToken(token) {
    try {
        // Décoder le payload du JWT (partie centrale)
        const payload = token.split('.')[1];
        const decodedPayload = JSON.parse(atob(payload));
        return decodedPayload.email || null;
    } catch (error) {
        console.error('Erreur lors du décodage du token:', error);
        return null;
    }
}

// Fonction pour vérifier la validité du token
async function verifyToken(token) {
    try {
        const response = await fetch(`${API_URL}/auth/verify`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            return data.user;
        }
        return null;
    } catch (error) {
        console.error('Erreur lors de la vérification du token:', error);
        return null;
    }
}

// Initialisation du tableau de bord
function initDashboard() {
    console.log('initDashboard called');
    
    // Gestion des onglets
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const tabName = btn.dataset.tab;
            switchTab(tabName);
        });
    });
}

function attachDashboardEventListeners() {
    console.log('attachDashboardEventListeners called');
    
    // Gestion des filtres d'historique
    const historyFilter = document.getElementById('historyFilter');
    const languageFilter = document.getElementById('languageFilter');
    const historySearch = document.getElementById('historySearch');
    
    console.log('Elements found:', {
        historyFilter: !!historyFilter,
        languageFilter: !!languageFilter,
        historySearch: !!historySearch
    });
    
    // Supprimer les anciens event listeners pour éviter les doublons
    if (historyFilter) {
        historyFilter.removeEventListener('change', filterHistory);
        historyFilter.addEventListener('change', filterHistory);
        console.log('Added event listener to historyFilter');
    }
    
    if (languageFilter) {
        languageFilter.removeEventListener('change', filterHistory);
        languageFilter.addEventListener('change', filterHistory);
        console.log('Added event listener to languageFilter');
    }
    
    if (historySearch) {
        historySearch.removeEventListener('input', debouncedFilterHistory);
        historySearch.addEventListener('input', debouncedFilterHistory);
        console.log('Added event listener to historySearch');
    }
}

// Fonction debounced pour le filtrage
const debouncedFilterHistory = debounce(filterHistory, 300);

// Basculer entre les onglets
function switchTab(tabName) {
    // Mettre à jour les boutons d'onglets
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

    // Mettre à jour le contenu des onglets
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    document.getElementById(`${tabName}-tab`).classList.add('active');

    currentTab = tabName;

    // Charger les données spécifiques à l'onglet
    if (tabName === 'progress' && dashboardData) {
        renderCharts();
    }
}

// Charger les données du tableau de bord
async function loadDashboardData() {
    try {
        showLoading('Chargement du tableau de bord...');
        
        const response = await fetch(`${API_URL}/dashboard`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });

        if (!response.ok) {
            throw new Error('Erreur lors du chargement du tableau de bord');
        }

        dashboardData = await response.json();
        renderDashboard();
        
    } catch (error) {
        console.error('Erreur dashboard:', error);
        showNotification('Erreur lors du chargement du tableau de bord', 'error');
    } finally {
        hideLoading();
    }
}

// Afficher les données du tableau de bord
function renderDashboard() {
    if (!dashboardData) return;

    // Vue d'ensemble
    renderOverview();
    
    // Historique
    renderHistory();
    
    // Analyse
    renderAnalysis();
    
    // Réattacher les event listeners après le rendu
    setTimeout(() => {
        attachDashboardEventListeners();
    }, 100);
}

// Afficher la vue d'ensemble
function renderOverview() {
    const stats = dashboardData.stats;
    
    // Statistiques principales
    document.getElementById('totalCorrections').textContent = stats.totalCorrections || 0;
    document.getElementById('totalErrors').textContent = stats.totalErrors || 0;
    document.getElementById('averageErrors').textContent = (stats.averageErrors || 0).toFixed(1);
    document.getElementById('improvementRate').textContent = `${(stats.improvementRate || 0).toFixed(1)}%`;

    // Statistiques par langue
    if (stats.french) {
        document.getElementById('frenchCorrections').textContent = stats.french.corrections || 0;
        document.getElementById('frenchErrors').textContent = stats.french.errors || 0;
        document.getElementById('frenchAverage').textContent = (stats.french.averageErrors || 0).toFixed(1);
    }
    
    if (stats.english) {
        document.getElementById('englishCorrections').textContent = stats.english.corrections || 0;
        document.getElementById('englishErrors').textContent = stats.english.errors || 0;
        document.getElementById('englishAverage').textContent = (stats.english.averageErrors || 0).toFixed(1);
    }

    // Erreurs les plus fréquentes
    renderCommonErrors(dashboardData.commonErrors || []);
    
    // Recommandations
    renderRecommendations(dashboardData.recommendations || []);
}

// Afficher les erreurs communes
function renderCommonErrors(errors) {
    const container = document.getElementById('commonErrors');
    
    if (errors.length === 0) {
        container.innerHTML = '<p style="color: var(--text-secondary); text-align: center; padding: 20px;">Aucune erreur récurrente détectée</p>';
        return;
    }

    container.innerHTML = errors.map(error => `
        <div class="error-frequency">
            <span class="error-type">${error.type}</span>
            <span class="error-count">${error.count}</span>
        </div>
    `).join('');
}

// Afficher les recommandations
function renderRecommendations(recommendations) {
    const container = document.getElementById('recommendations');
    
    if (recommendations.length === 0) {
        container.innerHTML = '<p style="color: var(--text-secondary); text-align: center; padding: 20px;">Continuez à utiliser l\'application pour recevoir des recommandations personnalisées</p>';
        return;
    }

    container.innerHTML = recommendations.map(rec => `
        <div class="recommendation-item">
            <h4>${rec.title}</h4>
            <p>${rec.description}</p>
        </div>
    `).join('');
}

// Afficher l'historique
function renderHistory(filteredData = null) {
    const history = filteredData || dashboardData.history || [];
    const container = document.getElementById('historyList');
    
    if (history.length === 0) {
        container.innerHTML = '<p style="color: var(--text-secondary); text-align: center; padding: 40px;">Aucun texte corrigé trouvé</p>';
        return;
    }

    container.innerHTML = history.map((item, index) => `
        <div class="history-item" data-item-id="${item.id}">
            <div class="history-header" data-toggle-id="${item.id}">
                <div class="history-info">
                    <span class="history-date">${formatDate(item.created_at)}</span>
                    <span class="language-badge ${item.language || 'fr'}">${item.language === 'en' ? 'EN' : 'FR'}</span>
                    <span class="history-errors ${item.error_count === 0 ? 'no-errors' : ''}">${item.error_count} ${currentLanguage === 'fr' ? (item.error_count > 1 ? 'erreurs' : 'erreur') : (item.error_count > 1 ? 'errors' : 'error')}</span>
                </div>
                <i class="fas fa-chevron-down history-toggle" id="toggle-${item.id}"></i>
            </div>
            <div class="history-text">${truncateText(item.original_text, 150)}</div>
            <div class="history-summary">
                ${(item.error_types || []).map(type => `<span class="error-tag">${type}</span>`).join('')}
            </div>
            <div class="history-details" id="details-${item.id}" style="display: none;">
                <div class="history-details-content">
                    <h4><i class="fas fa-file-alt"></i> Texte original complet</h4>
                    <div class="original-text-full">${item.original_text}</div>
                    
                    <h4><i class="fas fa-highlight"></i> Texte original avec erreurs surlignées</h4>
                    <div id="original-highlighted-${item.id}" class="original-text-highlighted">
                        <div class="loading-errors">Chargement du texte avec erreurs surlignées...</div>
                    </div>
                    
                    <h4><i class="fas fa-check-circle"></i> Texte corrigé</h4>
                    <div id="corrected-text-${item.id}" class="original-text-highlighted">
                        <div class="loading-errors">Chargement du texte corrigé...</div>
                    </div>
                    
                    <div class="error-details-section">
                        <h4><i class="fas fa-exclamation-triangle"></i> Détails des erreurs détectées</h4>
                        <div id="error-details-${item.id}" class="error-details-list">
                            <div class="loading-errors">Chargement des détails...</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `).join('');
    
    // Ajouter les event listeners pour les éléments d'historique
    history.forEach(item => {
        const headerElement = document.querySelector(`[data-toggle-id="${item.id}"]`);
        if (headerElement) {
            headerElement.addEventListener('click', () => toggleHistoryDetails(item.id));
        }
    });
}

// Fonction pour basculer l'affichage des détails d'un élément d'historique
async function toggleHistoryDetails(itemId) {
    const detailsElement = document.getElementById(`details-${itemId}`);
    const toggleIcon = document.getElementById(`toggle-${itemId}`);
    const errorDetailsContainer = document.getElementById(`error-details-${itemId}`);
    const originalHighlightedContainer = document.getElementById(`original-highlighted-${itemId}`);
    const correctedTextContainer = document.getElementById(`corrected-text-${itemId}`);
    
    if (detailsElement.style.display === 'none') {
        // Ouvrir les détails
        detailsElement.style.display = 'block';
        toggleIcon.classList.add('rotated');
        
        // Charger les détails des erreurs si pas encore chargé
        if (errorDetailsContainer.innerHTML.includes('Chargement des détails...')) {
            await loadErrorDetails(itemId, errorDetailsContainer);
        }
        
        // Charger le texte avec erreurs surlignées et le texte corrigé
        if (originalHighlightedContainer.innerHTML.includes('Chargement du texte avec erreurs surlignées...')) {
            await loadTextDetails(itemId, originalHighlightedContainer, correctedTextContainer);
        }
    } else {
        // Fermer les détails
        detailsElement.style.display = 'none';
        toggleIcon.classList.remove('rotated');
    }
}

// Fonction pour charger le texte avec erreurs surlignées et le texte corrigé
async function loadTextDetails(textId, originalHighlightedContainer, correctedTextContainer) {
    try {
        // Récupérer les données du texte depuis l'API
        const response = await fetch(`${API_URL}/text-details/${textId}`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        
        if (!response.ok) {
            throw new Error('Erreur lors du chargement des détails du texte');
        }
        
        const textDetails = await response.json();
        
        // Afficher le texte corrigé
        correctedTextContainer.innerHTML = `<p>${textDetails.correctedText || 'Texte corrigé non disponible'}</p>`;
        
        // Afficher le texte original avec erreurs surlignées
        if (textDetails.errors && textDetails.errors.length > 0) {
            let highlightedText = textDetails.originalText;
            
            // Dédupliquer les erreurs qui ont les mêmes positions
            const uniqueErrors = [];
            const seenPositions = new Set();
            
            textDetails.errors.forEach(error => {
                const positionKey = `${error.position_start}-${error.position_end}`;
                if (!seenPositions.has(positionKey) && error.position_start !== undefined && error.position_end !== undefined) {
                    uniqueErrors.push(error);
                    seenPositions.add(positionKey);
                }
            });
            
            // Trier les erreurs par position pour éviter les conflits (de la fin vers le début)
            const sortedErrors = uniqueErrors.sort((a, b) => (b.position_start || 0) - (a.position_start || 0));
            
            // Appliquer le surlignage pour chaque erreur
            sortedErrors.forEach(error => {
                if (error.position_start !== undefined && error.position_end !== undefined && 
                    error.position_start >= 0 && error.position_end > error.position_start) {
                    
                    const before = highlightedText.substring(0, error.position_start);
                    const errorText = highlightedText.substring(error.position_start, error.position_end);
                    const after = highlightedText.substring(error.position_end);
                    
                    const severityClass = `error-highlight-${error.severity || 'medium'}`;
                    const tooltipText = error.correction ? `Correction: ${error.correction}` : (error.error_message || error.message);
                    // Échapper les caractères spéciaux dans le title
                    const escapedTooltip = tooltipText ? tooltipText.replace(/"/g, '&quot;').replace(/'/g, '&#39;') : '';
                    const highlightedError = `<span class="error-highlight ${severityClass}" title="${escapedTooltip}">${errorText}</span>`;
                    
                    highlightedText = before + highlightedError + after;
                }
            });
            
            originalHighlightedContainer.innerHTML = `<p>${highlightedText}</p>`;
        } else {
            originalHighlightedContainer.innerHTML = `<p>${textDetails.originalText}</p>`;
        }
        
    } catch (error) {
        console.error('Erreur chargement détails du texte:', error);
        originalHighlightedContainer.innerHTML = '<p class="error-loading">Erreur lors du chargement du texte avec erreurs surlignées</p>';
        correctedTextContainer.innerHTML = '<p class="error-loading">Erreur lors du chargement du texte corrigé</p>';
    }
}

// Fonction pour charger les détails des erreurs d'un texte spécifique
async function loadErrorDetails(textId, container) {
    try {
        const response = await fetch(`${API_URL}/text-errors/${textId}`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        
        if (!response.ok) {
            throw new Error('Erreur lors du chargement des détails');
        }
        
        const errorDetails = await response.json();
        
        if (errorDetails.length === 0) {
            container.innerHTML = '<p class="no-errors-message"><i class="fas fa-check-circle"></i> Aucune erreur détectée dans ce texte</p>';
            return;
        }
        
        container.innerHTML = errorDetails.map(error => `
            <div class="error-detail-item ${getSeverityClass(error.severity)}">
                <div class="error-detail-header">
                    <div class="error-type-badge">
                        <i class="fas ${getErrorIcon(error.error_type)}"></i>
                        <strong>${error.error_type}</strong>
                    </div>
                    <span class="error-severity-badge ${error.severity}">${getSeverityLabel(error.severity)}</span>
                </div>
                
                ${error.error_message ? `
                    <div class="error-explanation-detail">
                        <h5><i class="fas fa-lightbulb"></i> Explication</h5>
                        <p>${error.error_message}</p>
                    </div>
                ` : ''}
                
                ${error.position_start !== undefined && error.position_end !== undefined && (error.position_start !== 0 || error.position_end !== 0) ? `
                    <div class="error-position-detail">
                        <small><i class="fas fa-map-marker-alt"></i> Position: ${error.position_start} - ${error.position_end}</small>
                    </div>
                ` : ''}
            </div>
        `).join('');
        
    } catch (error) {
        console.error('Erreur chargement détails:', error);
        container.innerHTML = '<p class="error-loading">Erreur lors du chargement des détails des erreurs</p>';
    }
}

// Fonction pour obtenir l'icône selon le type d'erreur
function getErrorIcon(errorType) {
    const icons = {
        'Orthographe': 'fa-spell-check',
        'Grammaire': 'fa-language',
        'Conjugaison': 'fa-clock',
        'Ponctuation': 'fa-quote-right',
        'Vocabulaire': 'fa-book',
        'Syntaxe': 'fa-code',
        'Accord': 'fa-handshake',
        'Style': 'fa-palette'
    };
    return icons[errorType] || 'fa-exclamation-triangle';
}

// Fonction pour obtenir la classe CSS selon la sévérité
function getSeverityClass(severity) {
    const classes = {
        'low': 'error-minor',
        'medium': 'error-medium', 
        'high': 'error-severe',
        'severe': 'error-severe'
    };
    return classes[severity] || 'error-medium';
}

// Filtrer l'historique
function filterHistory() {
    console.log('filterHistory called');
    if (!dashboardData || !dashboardData.history) {
        console.log('No dashboard data or history');
        return;
    }

    const filter = document.getElementById('historyFilter').value;
    const languageFilter = document.getElementById('languageFilter').value;
    const search = document.getElementById('historySearch').value.toLowerCase();
    
    console.log('Filter values:', { filter, languageFilter, search });
    
    let filteredHistory = [...dashboardData.history];
    console.log('Original history length:', filteredHistory.length);

    // Filtrer par période
    if (filter !== 'all') {
        const now = new Date();
        const filterDate = new Date();
        
        switch (filter) {
            case 'week':
                filterDate.setDate(now.getDate() - 7);
                break;
            case 'month':
                filterDate.setMonth(now.getMonth() - 1);
                break;
            case 'year':
                filterDate.setFullYear(now.getFullYear() - 1);
                break;
        }
        
        filteredHistory = filteredHistory.filter(item => 
            new Date(item.created_at) >= filterDate
        );
    }

    // Filtrer par langue
    if (languageFilter !== 'all') {
        console.log('Filtering by language:', languageFilter);
        const beforeLength = filteredHistory.length;
        filteredHistory = filteredHistory.filter(item => 
            item.language === languageFilter
        );
        console.log('After language filter:', beforeLength, '->', filteredHistory.length);
    }

    // Filtrer par recherche
    if (search) {
        filteredHistory = filteredHistory.filter(item =>
            item.original_text.toLowerCase().includes(search) ||
            (item.error_types || []).some(type => type.toLowerCase().includes(search))
        );
    }

    console.log('Final filtered history length:', filteredHistory.length);
    renderHistory(filteredHistory);
}

// Afficher l'analyse
function renderAnalysis() {
    const analysis = dashboardData.analysis || {};
    
    // Points forts
    renderAnalysisSection('strengths', analysis.strengths || [], 'strength');
    
    // Points faibles
    renderAnalysisSection('weaknesses', analysis.weaknesses || [], 'weakness');
    
    // Conseils personnalisés
    renderPersonalizedTips(analysis.tips || []);
}

// Afficher une section d'analyse
function renderAnalysisSection(containerId, items, className) {
    const container = document.getElementById(containerId);
    
    if (items.length === 0) {
        container.innerHTML = '<p style="color: var(--text-secondary); text-align: center; padding: 20px;">Analyse en cours...</p>';
        return;
    }

    container.innerHTML = items.map(item => `
        <div class="analysis-item ${className}">
            <div class="analysis-icon">
                <i class="fas fa-${className === 'strength' ? 'check-circle' : 'exclamation-circle'}"></i>
            </div>
            <div class="analysis-content">
                <h4>${item.title}</h4>
                <p>${item.description}</p>
            </div>
        </div>
    `).join('');
}

// Afficher les conseils personnalisés
function renderPersonalizedTips(tips) {
    const container = document.getElementById('personalizedTips');
    
    if (tips.length === 0) {
        container.innerHTML = '<p style="color: var(--text-secondary); text-align: center; padding: 20px;">Continuez à utiliser l\'application pour recevoir des conseils personnalisés</p>';
        return;
    }

    container.innerHTML = tips.map(tip => `
        <div class="tip-item">
            <h4><i class="fas fa-lightbulb"></i> ${tip.title}</h4>
            <p>${tip.description}</p>
        </div>
    `).join('');
}

// Afficher les graphiques de progression
function renderCharts() {
    if (!dashboardData) return;
    
    renderErrorEvolutionChart();
    renderErrorTypesChart();
}

// Graphique d'évolution des erreurs
function renderErrorEvolutionChart() {
    const canvas = document.getElementById('evolutionChart');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const history = dashboardData.history || [];
    
    // Préparer les données (derniers 10 textes)
    const recentHistory = history.slice(0, 10).reverse();
    const labels = recentHistory.map((item, index) => `Texte ${index + 1}`);
    const errorCounts = recentHistory.map(item => item.error_count || 0);
    
    // Nettoyer le canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    if (errorCounts.length === 0) {
        ctx.fillStyle = 'var(--text-secondary)';
        ctx.font = '14px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Aucune donnée disponible', canvas.width / 2, canvas.height / 2);
        return;
    }
    
    // Configuration du graphique
    const padding = 40;
    const chartWidth = canvas.width - 2 * padding;
    const chartHeight = canvas.height - 2 * padding;
    const maxErrors = Math.max(...errorCounts, 1);
    
    // Dessiner les axes
    ctx.strokeStyle = '#e0e0e0';
    ctx.lineWidth = 1;
    
    // Axe Y
    ctx.beginPath();
    ctx.moveTo(padding, padding);
    ctx.lineTo(padding, canvas.height - padding);
    ctx.stroke();
    
    // Axe X
    ctx.beginPath();
    ctx.moveTo(padding, canvas.height - padding);
    ctx.lineTo(canvas.width - padding, canvas.height - padding);
    ctx.stroke();
    
    // Dessiner les lignes de grille horizontales
    ctx.strokeStyle = '#f0f0f0';
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= 5; i++) {
        const y = padding + (chartHeight * i) / 5;
        ctx.beginPath();
        ctx.moveTo(padding, y);
        ctx.lineTo(canvas.width - padding, y);
        ctx.stroke();
        
        // Labels Y
        ctx.fillStyle = '#666';
        ctx.font = '12px Arial';
        ctx.textAlign = 'right';
        const value = Math.round(maxErrors * (5 - i) / 5);
        ctx.fillText(value.toString(), padding - 10, y + 4);
    }
    
    // Dessiner la courbe
    if (errorCounts.length > 1) {
        ctx.strokeStyle = '#4A90E2';
        ctx.lineWidth = 3;
        ctx.beginPath();
        
        errorCounts.forEach((count, index) => {
            const x = padding + (chartWidth * index) / (errorCounts.length - 1);
            const y = canvas.height - padding - (chartHeight * count) / maxErrors;
            
            if (index === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        });
        
        ctx.stroke();
        
        // Dessiner les points
        ctx.fillStyle = '#4A90E2';
        errorCounts.forEach((count, index) => {
            const x = padding + (chartWidth * index) / (errorCounts.length - 1);
            const y = canvas.height - padding - (chartHeight * count) / maxErrors;
            
            ctx.beginPath();
            ctx.arc(x, y, 4, 0, 2 * Math.PI);
            ctx.fill();
            
            // Label du point
            ctx.fillStyle = '#333';
            ctx.font = '11px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(count.toString(), x, y - 10);
            ctx.fillStyle = '#4A90E2';
        });
    }
    
    // Labels X
    ctx.fillStyle = '#666';
    ctx.font = '11px Arial';
    ctx.textAlign = 'center';
    labels.forEach((label, index) => {
        const x = padding + (chartWidth * index) / Math.max(labels.length - 1, 1);
        ctx.fillText(label, x, canvas.height - padding + 20);
    });
    
    // Titre
    ctx.fillStyle = '#333';
    ctx.font = 'bold 14px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Évolution du nombre d\'erreurs', canvas.width / 2, 20);
}

// Graphique de répartition par type d'erreur
function renderErrorTypesChart() {
    const canvas = document.getElementById('typesChart');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const commonErrors = dashboardData.commonErrors || [];
    
    // Nettoyer le canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    if (commonErrors.length === 0) {
        ctx.fillStyle = 'var(--text-secondary)';
        ctx.font = '14px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Aucune erreur détectée', canvas.width / 2, canvas.height / 2);
        return;
    }
    
    // Configuration
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2 - 10;
    const radius = Math.min(canvas.width, canvas.height) / 3;
    
    // Couleurs pour chaque type d'erreur
    const colors = [
        '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
        '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9'
    ];
    
    const total = commonErrors.reduce((sum, error) => sum + error.count, 0);
    let currentAngle = -Math.PI / 2; // Commencer en haut
    
    // Dessiner les secteurs
    commonErrors.forEach((error, index) => {
        const sliceAngle = (error.count / total) * 2 * Math.PI;
        
        ctx.fillStyle = colors[index % colors.length];
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.arc(centerX, centerY, radius, currentAngle, currentAngle + sliceAngle);
        ctx.closePath();
        ctx.fill();
        
        // Bordure
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        currentAngle += sliceAngle;
    });
    
    // Légende
    const legendX = 20;
    let legendY = canvas.height - (commonErrors.length * 25) - 20;
    
    ctx.font = '12px Arial';
    commonErrors.forEach((error, index) => {
        // Carré de couleur
        ctx.fillStyle = colors[index % colors.length];
        ctx.fillRect(legendX, legendY, 15, 15);
        
        // Texte
        ctx.fillStyle = '#333';
        ctx.textAlign = 'left';
        const percentage = ((error.count / total) * 100).toFixed(1);
        ctx.fillText(`${error.type} (${error.count} - ${percentage}%)`, legendX + 20, legendY + 12);
        
        legendY += 25;
    });
    
    // Titre
    ctx.fillStyle = '#333';
    ctx.font = 'bold 14px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Répartition des types d\'erreurs', canvas.width / 2, 20);
}

// Ouvrir le tableau de bord
function openDashboard() {
    if (!isLoggedIn()) {
        showNotification('Vous devez être connecté pour accéder au tableau de bord', 'error');
        return;
    }
    
    document.getElementById('dashboardModal').style.display = 'block';
    
    // Initialiser les event listeners du dashboard
    initDashboard();
    
    // Charger les données si pas encore chargées
    if (!dashboardData) {
        loadDashboardData();
    } else {
        // Si les données sont déjà chargées, re-rendre le dashboard
        renderDashboard();
    }
    
    // Attacher les event listeners après un court délai
    setTimeout(() => {
        attachDashboardEventListeners();
    }, 200);
}

// Vérifier si l'utilisateur est connecté
function isLoggedIn() {
    return localStorage.getItem('token') !== null;
}

// Formater une date
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Tronquer un texte
function truncateText(text, maxLength) {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
}

// Fonction debounce
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Fonction pour gérer le changement de mot de passe
async function handleChangePassword(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const currentPassword = formData.get('currentPassword');
    const newPassword = formData.get('newPassword');
    const confirmNewPassword = formData.get('confirmNewPassword');
    
    // Validation côté client
    if (newPassword !== confirmNewPassword) {
        showNotification('Les nouveaux mots de passe ne correspondent pas', 'error');
        return;
    }
    
    if (newPassword.length < 6) {
        showNotification('Le nouveau mot de passe doit contenir au moins 6 caractères', 'error');
        return;
    }
    
    if (currentPassword === newPassword) {
        showNotification('Le nouveau mot de passe doit être différent de l\'ancien', 'error');
        return;
    }
    
    try {
        const token = localStorage.getItem('token');
        if (!token) {
            showNotification('Vous devez être connecté pour changer votre mot de passe', 'error');
            return;
        }
        
        const response = await fetch(`${API_URL}/auth/change-password`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                currentPassword,
                newPassword
            })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showNotification('Mot de passe changé avec succès', 'success');
            hideModal(document.getElementById('changePasswordModal'));
            e.target.reset(); // Réinitialiser le formulaire
        } else {
            showNotification(data.error || 'Erreur lors du changement de mot de passe', 'error');
        }
        
    } catch (error) {
        console.error('Erreur:', error);
        showNotification('Une erreur est survenue lors du changement de mot de passe', 'error');
    }
}

// Fonction pour gérer la réinitialisation de mot de passe
async function handleResetPassword(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const email = formData.get('email');
    const newPassword = formData.get('newPassword');
    const confirmPassword = formData.get('confirmPassword');
    
    // Validation côté client
    if (!email || !newPassword || !confirmPassword) {
        showNotification('Tous les champs sont requis', 'error');
        return;
    }
    
    if (newPassword !== confirmPassword) {
        showNotification('Les mots de passe ne correspondent pas', 'error');
        return;
    }
    
    if (newPassword.length < 6) {
        showNotification('Le mot de passe doit contenir au moins 6 caractères', 'error');
        return;
    }
    
    try {
        showLoading('Réinitialisation en cours...');
        
        const response = await fetch(`${API_URL}/auth/reset-password-dev`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                email,
                newPassword
            })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showNotification('Mot de passe réinitialisé avec succès ! Vous pouvez maintenant vous connecter.', 'success');
            hideModal(document.getElementById('resetPasswordModal'));
            showModal(document.getElementById('loginModal'));
            
            // Pré-remplir l'email dans le formulaire de connexion
            const loginEmailInput = document.querySelector('#loginForm input[name="email"]');
            if (loginEmailInput) {
                loginEmailInput.value = email;
            }
            
            e.target.reset(); // Réinitialiser le formulaire
        } else {
            showNotification(data.error || 'Erreur lors de la réinitialisation', 'error');
        }
        
    } catch (error) {
        console.error('Erreur:', error);
        showNotification('Une erreur est survenue lors de la réinitialisation', 'error');
    } finally {
        hideLoading();
    }
}

// Fonctions de chargement
function showLoading(message = 'Chargement...') {
    // Créer ou mettre à jour l'indicateur de chargement
    let loadingElement = document.getElementById('loadingIndicator');
    
    if (!loadingElement) {
        loadingElement = document.createElement('div');
        loadingElement.id = 'loadingIndicator';
        loadingElement.className = 'loading-indicator';
        document.body.appendChild(loadingElement);
    }
    
    loadingElement.innerHTML = `
        <div class="loading-content">
            <div class="loading-spinner"></div>
            <p>${message}</p>
        </div>
    `;
    
    loadingElement.style.display = 'flex';
}

function hideLoading() {
    const loadingElement = document.getElementById('loadingIndicator');
    if (loadingElement) {
        loadingElement.style.display = 'none';
    }
}

// Fonction pour rafraîchir les données du tableau de bord après une correction
async function refreshDashboardData() {
    try {
        // Ne recharger que si l'utilisateur est connecté
        if (!isLoggedIn()) return;
        
        // Recharger les données en arrière-plan
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_URL}/dashboard`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (response.ok) {
            const newData = await response.json();
            dashboardData = newData;
            
            // Si le tableau de bord est ouvert, le mettre à jour
            const dashboardModal = document.getElementById('dashboardModal');
            if (dashboardModal && dashboardModal.style.display === 'block') {
                renderDashboard();
                
                // Si on est sur l'onglet progression, re-rendre les graphiques
                if (currentTab === 'progress') {
                    renderCharts();
                }
            }
            
            console.log('📊 Tableau de bord mis à jour automatiquement');
        }
    } catch (error) {
        console.error('Erreur lors de la mise à jour du tableau de bord:', error);
        // Ne pas afficher d'erreur à l'utilisateur car c'est en arrière-plan
    }
}

// Fonction pour afficher une modale de confirmation personnalisée
function showConfirmModal(title, message, onConfirm, onCancel) {
    const modal = document.getElementById('confirmModal');
    const titleElement = document.getElementById('confirmTitle');
    const messageElement = document.getElementById('confirmMessage');
    const confirmBtn = document.getElementById('confirmOk');
    const cancelBtn = document.getElementById('confirmCancel');
    
    // Mettre à jour le contenu
    titleElement.textContent = title;
    messageElement.textContent = message;
    
    // Nettoyer les anciens event listeners
    const newConfirmBtn = confirmBtn.cloneNode(true);
    const newCancelBtn = cancelBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
    cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);
    
    // Ajouter les nouveaux event listeners
    newConfirmBtn.addEventListener('click', () => {
        hideModal(modal);
        if (onConfirm) onConfirm();
    });
    
    newCancelBtn.addEventListener('click', () => {
        hideModal(modal);
        if (onCancel) onCancel();
    });
    
    // Fermer avec Escape
    const handleEscape = (e) => {
        if (e.key === 'Escape') {
            hideModal(modal);
            if (onCancel) onCancel();
            document.removeEventListener('keydown', handleEscape);
        }
    };
    document.addEventListener('keydown', handleEscape);
    
    // Afficher la modale
    showModal(modal);
}

// Fonction pour désactiver/réactiver tous les boutons pendant les opérations
function disableAllButtons(disable) {
    // Boutons principaux
    const buttons = [
        elements.correctBtn,
        ...document.querySelectorAll('.reformulation-btn'),
        ...document.querySelectorAll('.auth-btn'),
        ...document.querySelectorAll('.modal-btn'),
        document.getElementById('dashboardBtn'),
        document.getElementById('themeToggle'),
        document.getElementById('languageToggle')
    ].filter(btn => btn); // Filtrer les éléments null/undefined

    buttons.forEach(button => {
        if (disable) {
            button.disabled = true;
            button.style.opacity = '0.6';
            button.style.cursor = 'not-allowed';
        } else {
            button.disabled = false;
            button.style.opacity = '';
            button.style.cursor = '';
        }
    });

    // Désactiver aussi les inputs et textarea
    const inputs = [
        elements.inputText,
        ...document.querySelectorAll('input'),
        ...document.querySelectorAll('textarea')
    ].filter(input => input);

    inputs.forEach(input => {
        if (disable) {
            input.disabled = true;
            input.style.opacity = '0.6';
        } else {
            input.disabled = false;
            input.style.opacity = '';
        }
    });
} 