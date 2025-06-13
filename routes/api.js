const express = require('express');
const router = express.Router();
const { OpenAI } = require('openai');
const db = require('../config/database');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

// Configuration OpenAI
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

// Middleware d'authentification optionnelle
const optionalAuth = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
        jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
            if (!err) {
                req.user = user;
                req.isAuthenticated = true;
            } else {
                req.isAuthenticated = false;
            }
        });
    } else {
        req.isAuthenticated = false;
    }
    next();
};

// Middleware d'authentification obligatoire
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Token manquant' });
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Token invalide' });
        }
        req.user = user;
        next();
    });
};

// Routes d'authentification
router.post('/auth/register', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        // Validation des données
        if (!email || !password) {
            return res.status(400).json({ error: 'Email et mot de passe requis' });
        }
        
        if (typeof email !== 'string' || typeof password !== 'string') {
            return res.status(400).json({ error: 'Email et mot de passe doivent être des chaînes de caractères' });
        }
        
        // Validation de l'email
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ error: 'Format d\'email invalide' });
        }
        
        if (password.length < 6) {
            return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 6 caractères' });
        }
        
        const hashedPassword = await bcrypt.hash(String(password), 10);

        const result = await db.query(
            'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id',
            [email, hashedPassword]
        );

        const token = jwt.sign({ 
            id: result.rows[0].id, 
            email: email 
        }, process.env.JWT_SECRET, {
            expiresIn: process.env.JWT_EXPIRES_IN
        });

        res.json({ 
            token,
            user: {
                id: result.rows[0].id,
                email: email
            }
        });
    } catch (error) {
        console.error('Erreur d\'inscription:', error);
        
        // Gestion des erreurs spécifiques
        if (error.code === '23505') { // Violation de contrainte unique (email déjà existant)
            return res.status(409).json({ error: 'Cet email est déjà utilisé' });
        }
        
        if (error.code === '42501') { // Permission denied
            return res.status(500).json({ error: 'Erreur de configuration de la base de données' });
        }
        
        res.status(500).json({ error: 'Erreur lors de l\'inscription' });
    }
});

router.post('/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        const result = await db.query(
            'SELECT * FROM users WHERE email = $1',
            [email]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Utilisateur non trouvé' });
        }

        const user = result.rows[0];
        const validPassword = await bcrypt.compare(password, user.password_hash);

        if (!validPassword) {
            return res.status(401).json({ error: 'Mot de passe incorrect' });
        }

        const token = jwt.sign({ 
            id: user.id, 
            email: user.email 
        }, process.env.JWT_SECRET, {
            expiresIn: process.env.JWT_EXPIRES_IN
        });

        res.json({ 
            token,
            user: {
                id: user.id,
                email: user.email
            }
        });
    } catch (error) {
        console.error('Erreur de connexion:', error);
        res.status(500).json({ error: 'Erreur lors de la connexion' });
    }
});

// Route pour changer le mot de passe
router.post('/auth/change-password', authenticateToken, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        const userId = req.user.id;
        
        // Validation des données
        if (!currentPassword || !newPassword) {
            return res.status(400).json({ error: 'Mot de passe actuel et nouveau mot de passe requis' });
        }
        
        if (typeof currentPassword !== 'string' || typeof newPassword !== 'string') {
            return res.status(400).json({ error: 'Les mots de passe doivent être des chaînes de caractères' });
        }
        
        if (newPassword.length < 6) {
            return res.status(400).json({ error: 'Le nouveau mot de passe doit contenir au moins 6 caractères' });
        }
        
        if (currentPassword === newPassword) {
            return res.status(400).json({ error: 'Le nouveau mot de passe doit être différent de l\'ancien' });
        }
        
        // Récupérer l'utilisateur actuel
        const userResult = await db.query(
            'SELECT * FROM users WHERE id = $1',
            [userId]
        );
        
        if (userResult.rows.length === 0) {
            return res.status(404).json({ error: 'Utilisateur non trouvé' });
        }
        
        const user = userResult.rows[0];
        
        // Vérifier le mot de passe actuel
        const validCurrentPassword = await bcrypt.compare(currentPassword, user.password_hash);
        
        if (!validCurrentPassword) {
            return res.status(401).json({ error: 'Mot de passe actuel incorrect' });
        }
        
        // Hasher le nouveau mot de passe
        const hashedNewPassword = await bcrypt.hash(String(newPassword), 10);
        
        // Mettre à jour le mot de passe dans la base de données
        await db.query(
            'UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
            [hashedNewPassword, userId]
        );
        
        res.json({ message: 'Mot de passe changé avec succès' });
        
    } catch (error) {
        console.error('Erreur lors du changement de mot de passe:', error);
        res.status(500).json({ error: 'Erreur lors du changement de mot de passe' });
    }
});

// Route temporaire pour réinitialiser le mot de passe (DÉVELOPPEMENT SEULEMENT)
router.post('/auth/reset-password-dev', async (req, res) => {
    try {
        // Cette route ne devrait être utilisée qu'en développement
        if (process.env.NODE_ENV === 'production') {
            return res.status(403).json({ error: 'Route non disponible en production' });
        }
        
        const { email, newPassword } = req.body;
        
        if (!email || !newPassword) {
            return res.status(400).json({ error: 'Email et nouveau mot de passe requis' });
        }
        
        if (newPassword.length < 6) {
            return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 6 caractères' });
        }
        
        const hashedPassword = await bcrypt.hash(String(newPassword), 10);
        
        const result = await db.query(
            'UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE email = $2 RETURNING id, email',
            [hashedPassword, email]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Utilisateur non trouvé' });
        }
        
        res.json({ 
            message: 'Mot de passe réinitialisé avec succès',
            user: result.rows[0]
        });
        
    } catch (error) {
        console.error('Erreur de réinitialisation:', error);
        res.status(500).json({ error: 'Erreur lors de la réinitialisation' });
    }
});

// Fonction pour la correction principale avec GPT-4
async function correctTextWithGPT4(text, language, options) {
    try {
        const completion = await openai.chat.completions.create({
            model: "gpt-4",
            messages: [
                {
                    role: "system",
                    content: `Vous êtes un professeur de ${language === 'fr' ? 'français' : 'anglais'} expérimenté et bienveillant. 
                    Votre rôle est de corriger le texte et d'expliquer chaque erreur de manière pédagogique, comme si vous enseigniez à un élève.
                    
                    Options de correction:
                    - Ignorer les accents: ${options.ignoreAccents}
                    - Ignorer les majuscules: ${options.ignoreCase}
                    - Ignorer les noms propres: ${options.ignoreProperNouns}
                    
                    Pour chaque erreur, donnez une explication complète qui inclut :
                    - La règle grammaticale ou orthographique concernée
                    - Pourquoi c'est incorrect dans ce contexte
                    - Comment bien l'écrire et pourquoi
                    - Un conseil mnémotechnique ou une astuce pour retenir la règle
                    - Un exemple similaire si pertinent
                    
                    Types d'erreurs possibles : Grammaire, Conjugaison, Orthographe, Accord, Ponctuation, Style, Vocabulaire, Syntaxe
                    
                    IMPORTANT: Retournez UNIQUEMENT un JSON valide, sans texte supplémentaire, avec cette structure exacte:
                    {"correctedText": "texte corrigé", "errors": [{"type": "type d'erreur", "message": "explication pédagogique détaillée avec règles et conseils", "severity": "severe", "original": "mot original", "correction": "mot corrigé"}]}`
                },
                {
                    role: "user",
                    content: text
                }
            ]
        });

        const responseContent = completion.choices[0].message.content;
        console.log('GPT-4 Response:', responseContent);
        
        try {
            // Nettoyer la réponse avant de la parser
            const cleanedContent = responseContent
                .replace(/[\x00-\x1F\x7F-\x9F]/g, '') // Supprimer les caractères de contrôle
                .trim();
            
            return JSON.parse(cleanedContent);
        } catch (parseError) {
            console.error('Erreur de parsing JSON GPT-4:', parseError);
            console.error('Contenu reçu:', responseContent);
            
            // Fallback: retourner une structure basique
            return {
                correctedText: responseContent,
                errors: []
            };
        }
    } catch (error) {
        console.error('Erreur GPT-4:', error);
        throw new Error(`Erreur lors de la correction avec GPT-4: ${error.message}`);
    }
}

// Fonction pour la vérification avec GPT-3.5-turbo
async function verifyCorrectionWithGPT35(originalText, correctedText, language) {
    try {
        const completion = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [
                {
                    role: "system",
                    content: `Vous êtes un professeur de ${language === 'fr' ? 'français' : 'anglais'} qui vérifie le travail d'un collègue.
                    Examinez la correction proposée et identifiez d'éventuelles erreurs supplémentaires manquées.
                    Si vous trouvez des erreurs, expliquez-les de manière pédagogique avec la règle concernée.
                    IMPORTANT: Retournez UNIQUEMENT un JSON valide, sans texte supplémentaire:
                    {"isValid": true, "feedback": "commentaire pédagogique", "additionalErrors": [{"type": "type", "message": "explication détaillée", "original": "mot", "correction": "correction"}]}`
                },
                {
                    role: "user",
                    content: `Texte original: ${originalText}\nTexte corrigé: ${correctedText}`
                }
            ]
        });

        const responseContent = completion.choices[0].message.content;
        console.log('GPT-3.5 Response:', responseContent);
        
        try {
            // Nettoyer la réponse avant de la parser
            const cleanedContent = responseContent
                .replace(/[\x00-\x1F\x7F-\x9F]/g, '') // Supprimer les caractères de contrôle
                .trim();
            
            return JSON.parse(cleanedContent);
        } catch (parseError) {
            console.error('Erreur de parsing JSON GPT-3.5:', parseError);
            console.error('Contenu reçu:', responseContent);
            
            // Fallback: retourner une structure basique
            return {
                isValid: true,
                feedback: responseContent,
                additionalErrors: []
            };
        }
    } catch (error) {
        console.error('Erreur GPT-3.5:', error);
        // Ne pas faire échouer toute la correction si la vérification échoue
        return {
            isValid: true,
            feedback: "Vérification non disponible",
            additionalErrors: []
        };
    }
}

// Route de correction (accessible en mode invité et connecté)
router.post('/correct', optionalAuth, async (req, res) => {
    try {
        const { text, language, options } = req.body;

        // Première correction avec GPT-4
        const initialCorrection = await correctTextWithGPT4(text, language, options);

        // Vérification avec GPT-3.5-turbo
        const verification = await verifyCorrectionWithGPT35(text, initialCorrection.correctedText, language);

        // Combiner les résultats
        const finalResult = {
            correctedText: initialCorrection.correctedText,
            errors: [...initialCorrection.errors],
            verification: verification,
            isGuest: !req.isAuthenticated
        };

        // Si le vérificateur a trouvé des erreurs supplémentaires
        if (!verification.isValid && verification.additionalErrors) {
            finalResult.errors = [...finalResult.errors, ...verification.additionalErrors];
        }

        // Sauvegarder seulement si l'utilisateur est connecté
        if (req.isAuthenticated) {
            console.log('🔄 SAUVEGARDE - Utilisateur connecté:', req.user.id);
            console.log('🔄 SAUVEGARDE - Nombre d\'erreurs à sauvegarder:', finalResult.errors.length);
            
            const correctionResult = await db.query(
                'INSERT INTO corrected_texts (user_id, original_text, corrected_text, language, error_count) VALUES ($1, $2, $3, $4, $5) RETURNING id',
                [req.user.id, text, finalResult.correctedText, language, finalResult.errors.length]
            );

            const textId = correctionResult.rows[0].id;
            console.log('✅ SAUVEGARDE - Texte sauvegardé avec ID:', textId);

            // Sauvegarder les erreurs avec tous les détails disponibles
            for (let i = 0; i < finalResult.errors.length; i++) {
                const error = finalResult.errors[i];
                console.log(`🔄 SAUVEGARDE - Erreur ${i + 1}:`, {
                    type: error.type,
                    severity: error.severity,
                    original: error.original,
                    correction: error.correction,
                    message: error.message?.substring(0, 100) + '...'
                });
                
                try {
                    // Utiliser les colonnes qui existent réellement dans la base de données
                    const insertResult = await db.query(
                        `INSERT INTO errors (text_id, error_type, error_message, severity, position_start, position_end) 
                         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
                        [
                            textId, 
                            error.type, 
                            error.message || 'Erreur détectée',
                            error.severity || 'medium',
                            0, // position_start par défaut
                            0  // position_end par défaut
                        ]
                    );
                    console.log(`✅ SAUVEGARDE - Erreur ${i + 1} sauvegardée avec ID:`, insertResult.rows[0].id);
                } catch (insertError) {
                    console.error(`❌ SAUVEGARDE - Erreur insertion erreur ${i + 1}:`, insertError.message);
                    // Fallback: essayer avec seulement les colonnes obligatoires
                    try {
                        const fallbackResult = await db.query(
                            'INSERT INTO errors (text_id, error_type, error_message, severity, position_start, position_end) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
                            [textId, error.type || 'Autre', 'Erreur détectée', error.severity || 'medium', 0, 0]
                        );
                        console.log(`⚠️ SAUVEGARDE - Erreur ${i + 1} sauvegardée en mode fallback avec ID:`, fallbackResult.rows[0].id);
                    } catch (fallbackError) {
                        console.error(`❌ SAUVEGARDE - Erreur insertion fallback ${i + 1}:`, fallbackError.message);
                    }
                }
            }
            
            // Vérifier ce qui a été réellement sauvegardé
            const verifyResult = await db.query(
                'SELECT COUNT(*) as count FROM errors WHERE text_id = $1',
                [textId]
            );
            console.log('✅ SAUVEGARDE - Vérification: nombre d\'erreurs sauvegardées:', verifyResult.rows[0].count);
        }

        res.json(finalResult);
    } catch (error) {
        console.error('Erreur de correction:', error);
        res.status(500).json({ error: 'Erreur lors de la correction' });
    }
});

// Route de reformulation (accessible en mode invité et connecté)
router.post('/reformulate', optionalAuth, async (req, res) => {
    try {
        const { text, language, style } = req.body;

        // Reformulation avec GPT-4
        const completion = await openai.chat.completions.create({
            model: "gpt-4",
            messages: [
                {
                    role: "system",
                    content: `Vous êtes un expert en reformulation de texte ${language === 'fr' ? 'français' : 'anglais'}.
                    Reformulez le texte dans un style ${style}.
                    Retournez uniquement le texte reformulé.`
                },
                {
                    role: "user",
                    content: text
                }
            ]
        });

        const reformulatedText = completion.choices[0].message.content;

        // Vérification avec GPT-3.5-turbo
        const verification = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [
                {
                    role: "system",
                    content: `Vérifiez si le texte reformulé respecte bien le style ${style} et est grammaticalement correct.
                    Retournez uniquement "OK" si tout est correct, ou une explication de ce qui ne va pas.`
                },
                {
                    role: "user",
                    content: `Texte original: ${text}\nTexte reformulé: ${reformulatedText}`
                }
            ]
        });

        res.json({
            reformulatedText,
            verification: verification.choices[0].message.content,
            isGuest: !req.isAuthenticated
        });
    } catch (error) {
        console.error('Erreur de reformulation:', error);
        res.status(500).json({ error: 'Erreur lors de la reformulation' });
    }
});

// Route pour obtenir l'historique des corrections (authentification obligatoire)
router.get('/history', authenticateToken, async (req, res) => {
    try {
        const result = await db.query(
            `SELECT ct.*, 
                    json_agg(json_build_object(
                        'type', e.error_type,
                        'message', e.error_message,
                        'severity', e.severity,
                        'position_start', e.position_start,
                        'position_end', e.position_end
                    )) as errors
             FROM corrected_texts ct
             LEFT JOIN errors e ON ct.id = e.text_id
             WHERE ct.user_id = $1
             GROUP BY ct.id
             ORDER BY ct.created_at DESC
             LIMIT 10`,
            [req.user.id]
        );

        res.json(result.rows);
    } catch (error) {
        console.error('Erreur lors de la récupération de l\'historique:', error);
        res.status(500).json({ error: 'Erreur lors de la récupération de l\'historique' });
    }
});

// Route pour obtenir les statistiques (authentification obligatoire)
router.get('/stats', authenticateToken, async (req, res) => {
    try {
        const result = await db.query(
            `SELECT 
                COUNT(*) as total_corrections,
                COUNT(DISTINCT error_type) as unique_errors,
                language,
                DATE_TRUNC('day', created_at) as date
             FROM corrected_texts ct
             LEFT JOIN errors e ON ct.id = e.text_id
             WHERE ct.user_id = $1
             GROUP BY language, DATE_TRUNC('day', created_at)
             ORDER BY date DESC`,
            [req.user.id]
        );

        res.json(result.rows);
    } catch (error) {
        console.error('Erreur lors de la récupération des statistiques:', error);
        res.status(500).json({ error: 'Erreur lors de la récupération des statistiques' });
    }
});

// Route pour obtenir les détails des erreurs d'un texte spécifique
router.get('/text-errors/:textId', authenticateToken, async (req, res) => {
    try {
        const textId = req.params.textId;
        const userId = req.user.id;
        
        console.log('🔍 RÉCUPÉRATION - Demande détails erreurs pour text_id:', textId, 'user_id:', userId);
        
        // Vérifier que le texte appartient à l'utilisateur
        const textCheck = await db.query(
            'SELECT id, error_count FROM corrected_texts WHERE id = $1 AND user_id = $2',
            [textId, userId]
        );
        
        if (textCheck.rows.length === 0) {
            console.log('❌ RÉCUPÉRATION - Texte non trouvé pour text_id:', textId, 'user_id:', userId);
            return res.status(404).json({ error: 'Texte non trouvé' });
        }
        
        console.log('✅ RÉCUPÉRATION - Texte trouvé, error_count dans corrected_texts:', textCheck.rows[0].error_count);
        
        // Compter d'abord les erreurs
        const countResult = await db.query(
            'SELECT COUNT(*) as count FROM errors WHERE text_id = $1',
            [textId]
        );
        console.log('🔍 RÉCUPÉRATION - Nombre d\'erreurs dans la table errors:', countResult.rows[0].count);
        
        // Récupérer les erreurs avec tous les détails disponibles
        const result = await db.query(
            `SELECT 
                id,
                error_type,
                error_message,
                severity,
                position_start,
                position_end
             FROM errors 
             WHERE text_id = $1
             ORDER BY id ASC`,
            [textId]
        );

        console.log('✅ RÉCUPÉRATION - Erreurs récupérées:', result.rows.length);
        result.rows.forEach((error, index) => {
            console.log(`   Erreur ${index + 1}:`, {
                id: error.id,
                type: error.error_type,
                severity: error.severity,
                message: error.error_message?.substring(0, 50) + '...',
                position_start: error.position_start,
                position_end: error.position_end
            });
        });

        res.json(result.rows);
    } catch (error) {
        console.error('❌ RÉCUPÉRATION - Erreur lors de la récupération des détails des erreurs:', error);
        res.status(500).json({ error: 'Erreur lors de la récupération des détails des erreurs' });
    }
});

// Route pour obtenir les détails complets d'un texte (original, corrigé, erreurs)
router.get('/text-details/:textId', authenticateToken, async (req, res) => {
    try {
        const textId = req.params.textId;
        const userId = req.user.id;
        
        console.log('🔍 RÉCUPÉRATION - Demande détails complets pour text_id:', textId, 'user_id:', userId);
        
        // Récupérer le texte original et corrigé
        const textResult = await db.query(
            'SELECT id, original_text, corrected_text, error_count, language FROM corrected_texts WHERE id = $1 AND user_id = $2',
            [textId, userId]
        );
        
        if (textResult.rows.length === 0) {
            console.log('❌ RÉCUPÉRATION - Texte non trouvé pour text_id:', textId, 'user_id:', userId);
            return res.status(404).json({ error: 'Texte non trouvé' });
        }
        
        const textData = textResult.rows[0];
        console.log('✅ RÉCUPÉRATION - Texte trouvé:', {
            id: textData.id,
            error_count: textData.error_count,
            language: textData.language,
            original_length: textData.original_text?.length || 0,
            corrected_length: textData.corrected_text?.length || 0
        });
        
        // Récupérer les erreurs associées
        const errorsResult = await db.query(
            `SELECT 
                id,
                error_type,
                error_message,
                severity,
                position_start,
                position_end,
                original_word,
                corrected_word,
                explanation
             FROM errors 
             WHERE text_id = $1
             ORDER BY position_start ASC`,
            [textId]
        );

        console.log('✅ RÉCUPÉRATION - Erreurs récupérées:', errorsResult.rows.length);

        res.json({
            id: textData.id,
            originalText: textData.original_text,
            correctedText: textData.corrected_text,
            errorCount: textData.error_count,
            language: textData.language,
            errors: errorsResult.rows.map(error => ({
                id: error.id,
                type: error.error_type,
                message: error.error_message,
                severity: error.severity,
                position_start: error.position_start,
                position_end: error.position_end,
                original: error.original_word,
                correction: error.corrected_word,
                explanation: error.explanation
            }))
        });
    } catch (error) {
        console.error('❌ RÉCUPÉRATION - Erreur lors de la récupération des détails du texte:', error);
        res.status(500).json({ error: 'Erreur lors de la récupération des détails du texte' });
    }
});

module.exports = router; 