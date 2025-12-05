const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
require('dotenv').config();

const apiRoutes = require('./routes/api');

// Configuration de la base de données
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Middleware d'authentification
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Token d\'accès requis' });
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Token invalide' });
        }
        req.user = user;
        next();
    });
}

const app = express();
const PORT = process.env.PORT || 10000;

// Configuration pour la production
if (process.env.NODE_ENV === 'production') {
    app.use(helmet({
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],
                styleSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
                scriptSrc: ["'self'", "'unsafe-inline'"],
                fontSrc: ["'self'", "https://cdnjs.cloudflare.com"],
                imgSrc: ["'self'", "data:", "https:"],
                connectSrc: ["'self'"]
            }
        }
    }));
    
    // Rate limiting plus strict en production
    const limiter = rateLimit({
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 100, // limite chaque IP à 100 requêtes par windowMs
        message: 'Trop de requêtes depuis cette IP, veuillez réessayer plus tard.'
    });
    app.use(limiter);
} else {
    app.use(helmet());
    
    // Rate limiting plus permissif en développement
    const limiter = rateLimit({
        windowMs: process.env.RATE_LIMIT_WINDOW_MS || 900000,
        max: process.env.RATE_LIMIT_MAX_REQUESTS || 1000
    });
    app.use(limiter);
}

// Middleware
app.use(cors({
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Routes
app.use('/api', apiRoutes);

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Route pour le tableau de bord utilisateur
app.get('/api/dashboard', authenticateToken, async (req, res) => {
    try {
        console.log('📊 Dashboard API appelée pour l\'utilisateur:', req.user.id);
        const userId = req.user.id;
        
        // Récupérer les statistiques générales
        const statsQuery = `
            SELECT 
                COUNT(*) as total_corrections,
                COALESCE(SUM(error_count), 0) as total_errors,
                COALESCE(AVG(error_count), 0) as average_errors,
                COUNT(CASE WHEN language = 'fr' OR language IS NULL THEN 1 END) as french_corrections,
                COUNT(CASE WHEN language = 'en' THEN 1 END) as english_corrections,
                COALESCE(SUM(CASE WHEN language = 'fr' OR language IS NULL THEN error_count ELSE 0 END), 0) as french_errors,
                COALESCE(SUM(CASE WHEN language = 'en' THEN error_count ELSE 0 END), 0) as english_errors
            FROM corrected_texts 
            WHERE user_id = $1
        `;
        const statsResult = await pool.query(statsQuery, [userId]);
        const stats = statsResult.rows[0];

        // Calculer le taux d'amélioration (comparaison des 10 derniers vs 10 précédents)
        const improvementQuery = `
            WITH recent_texts AS (
                SELECT error_count, ROW_NUMBER() OVER (ORDER BY created_at DESC) as rn
                FROM corrected_texts 
                WHERE user_id = $1
                ORDER BY created_at DESC
                LIMIT 20
            ),
            recent_avg AS (
                SELECT AVG(error_count) as avg_errors
                FROM recent_texts 
                WHERE rn <= 10
            ),
            previous_avg AS (
                SELECT AVG(error_count) as avg_errors
                FROM recent_texts 
                WHERE rn > 10
            )
            SELECT 
                COALESCE(recent_avg.avg_errors, 0) as recent_avg,
                COALESCE(previous_avg.avg_errors, 0) as previous_avg
            FROM recent_avg, previous_avg
        `;
        const improvementResult = await pool.query(improvementQuery, [userId]);
        const improvement = improvementResult.rows[0];
        
        let improvementRate = 0;
        if (improvement.previous_avg > 0) {
            improvementRate = ((improvement.previous_avg - improvement.recent_avg) / improvement.previous_avg) * 100;
        }

        // Récupérer les erreurs les plus fréquentes avec exemples
        const commonErrorsQuery = `
            SELECT 
                e.error_type,
                COUNT(*) as count,
                e.original_word as example_text,
                e.corrected_word as example_correction,
                e.error_message as example_message
            FROM errors e
            JOIN corrected_texts ct ON e.text_id = ct.id
            WHERE ct.user_id = $1
            GROUP BY e.error_type, e.original_word, e.corrected_word, e.error_message
            ORDER BY count DESC
            LIMIT 10
        `;
        console.log('🔍 Exécution de la requête des erreurs communes...');
        let commonErrorsResult;
        try {
            commonErrorsResult = await pool.query(commonErrorsQuery, [userId]);
            console.log('📋 Résultats des erreurs communes:', commonErrorsResult.rows.length, 'lignes');
        } catch (error) {
            console.error('❌ Erreur lors de la requête des erreurs communes:', error.message);
            // Si la requête échoue, utiliser une requête plus simple
            const simpleErrorsQuery = `
                SELECT 
                    error_type,
                    COUNT(*) as count
                FROM errors e
                JOIN corrected_texts ct ON e.text_id = ct.id
                WHERE ct.user_id = $1
                GROUP BY error_type
                ORDER BY count DESC
                LIMIT 5
            `;
            commonErrorsResult = await pool.query(simpleErrorsQuery, [userId]);
            console.log('📋 Résultats des erreurs simples:', commonErrorsResult.rows.length, 'lignes');
        }
        
        // Grouper par type d'erreur et garder le meilleur exemple
        const errorGroups = {};
        if (commonErrorsResult.rows && commonErrorsResult.rows.length > 0) {
            commonErrorsResult.rows.forEach(row => {
                const errorType = row.error_type;
                if (!errorGroups[errorType]) {
                    errorGroups[errorType] = {
                        type: errorType,
                        count: 0,
                        examples: []
                    };
                }
                errorGroups[errorType].count += parseInt(row.count);
                
                // Ajouter un exemple seulement si les données sont disponibles
                if (row.example_text && row.example_correction) {
                    errorGroups[errorType].examples.push({
                        original: row.example_text,
                        corrected: row.example_correction,
                        message: row.example_message || 'Aucune explication disponible'
                    });
                }
            });
        }

        // Convertir en tableau et trier par fréquence
        const commonErrors = Object.values(errorGroups)
            .sort((a, b) => b.count - a.count)
            .slice(0, 5)
            .map(error => {
                // Si aucun exemple n'est disponible, créer des exemples par défaut
                let examples = error.examples.slice(0, 2);
                if (examples.length === 0) {
                    examples = [{
                        original: `Exemple d'erreur de ${error.type}`,
                        corrected: `Correction d'erreur de ${error.type}`,
                        message: `Cette erreur de ${error.type} apparaît ${error.count} fois dans vos textes.`
                    }];
                }
                
                return {
                    type: error.type,
                    count: error.count,
                    examples: examples
                };
            });
        
        console.log('📊 Erreurs communes traitées:', commonErrors.length);

        // Récupérer l'historique des textes corrigés
        const historyQuery = `
            SELECT 
                ct.id,
                ct.original_text,
                ct.error_count,
                ct.created_at,
                ct.language,
                ARRAY_AGG(DISTINCT e.error_type) as error_types
            FROM corrected_texts ct
            LEFT JOIN errors e ON ct.id = e.text_id
            WHERE ct.user_id = $1
            GROUP BY ct.id, ct.original_text, ct.error_count, ct.created_at, ct.language
            ORDER BY ct.created_at DESC
            LIMIT 50
        `;
        const historyResult = await pool.query(historyQuery, [userId]);
        const history = historyResult.rows.map(row => ({
            id: row.id,
            original_text: row.original_text,
            error_count: row.error_count,
            created_at: row.created_at,
            language: row.language || 'fr',
            error_types: row.error_types ? row.error_types.filter(type => type !== null) : []
        }));

        // Générer des recommandations basées sur les erreurs fréquentes
        const recommendations = await generateRecommendations(commonErrors, userId);

        // Générer une analyse des forces et faiblesses
        const analysis = await generateAnalysis(commonErrors, stats, userId);

        // Générer des données spécifiques pour le résumé
        const summaryData = {
            totalErrorTypes: commonErrors.length,
            mostFrequentError: commonErrors.length > 0 ? commonErrors[0].count : 0,
            errorDetails: commonErrors,
            tips: await generateSummaryTips(commonErrors, userId)
        };

        const dashboardData = {
            stats: {
                totalCorrections: parseInt(stats.total_corrections),
                totalErrors: parseInt(stats.total_errors),
                averageErrors: parseFloat(stats.average_errors),
                improvementRate: Math.max(0, improvementRate),
                french: {
                    corrections: parseInt(stats.french_corrections),
                    errors: parseInt(stats.french_errors),
                    averageErrors: stats.french_corrections > 0 ? parseFloat(stats.french_errors) / parseInt(stats.french_corrections) : 0
                },
                english: {
                    corrections: parseInt(stats.english_corrections),
                    errors: parseInt(stats.english_errors),
                    averageErrors: stats.english_corrections > 0 ? parseFloat(stats.english_errors) / parseInt(stats.english_corrections) : 0
                }
            },
            commonErrors,
            recommendations,
            history,
            analysis,
            summary: summaryData
        };

        res.json(dashboardData);

    } catch (error) {
        console.error('Erreur dashboard:', error);
        res.status(500).json({ error: 'Erreur lors du chargement du tableau de bord' });
    }
});


// Fonction pour générer des recommandations personnalisées
async function generateRecommendations(commonErrors, userId) {
    const recommendations = [];

    if (commonErrors.length === 0) {
        return [{
            title: "Excellent travail !",
            description: "Continuez à utiliser l'application pour maintenir votre niveau d'écriture."
        }];
    }

    // Recommandations basées sur les erreurs les plus fréquentes
    const errorRecommendations = {
        'Orthographe': {
            title: "Améliorer l'orthographe",
            description: "Concentrez-vous sur la mémorisation des mots difficiles. Utilisez des moyens mnémotechniques et relisez vos textes."
        },
        'Grammaire': {
            title: "Réviser la grammaire",
            description: "Révisez les règles de grammaire de base : accords, conjugaisons, et structure des phrases."
        },
        'Conjugaison': {
            title: "Maîtriser les conjugaisons",
            description: "Pratiquez régulièrement les temps verbaux les plus utilisés et leurs exceptions."
        },
        'Ponctuation': {
            title: "Améliorer la ponctuation",
            description: "Apprenez les règles de ponctuation pour structurer vos phrases et améliorer la lisibilité."
        },
        'Syntaxe': {
            title: "Travailler la syntaxe",
            description: "Variez la structure de vos phrases et veillez à leur cohérence logique."
        }
    };

    commonErrors.slice(0, 3).forEach(error => {
        if (errorRecommendations[error.type]) {
            recommendations.push(errorRecommendations[error.type]);
        }
    });

    return recommendations;
}

// Fonction pour générer une analyse des forces et faiblesses
async function generateAnalysis(commonErrors, stats, userId) {
    const analysis = {
        strengths: [],
        weaknesses: [],
        tips: []
    };

    const totalCorrections = parseInt(stats.total_corrections);
    const averageErrors = parseFloat(stats.average_errors);

    // Analyser les forces
    if (totalCorrections > 10) {
        analysis.strengths.push({
            title: "Utilisateur régulier",
            description: `Vous avez corrigé ${totalCorrections} textes, montrant votre engagement dans l'amélioration de votre écriture.`
        });
    }

    if (averageErrors < 2) {
        analysis.strengths.push({
            title: "Excellente maîtrise",
            description: "Votre moyenne d'erreurs est très faible, vous maîtrisez bien les bases de l'écriture française."
        });
    } else if (averageErrors < 5) {
        analysis.strengths.push({
            title: "Bonne maîtrise",
            description: "Vous avez une bonne base en français avec une moyenne d'erreurs acceptable."
        });
    }

    // Analyser les faiblesses
    if (averageErrors > 8) {
        analysis.weaknesses.push({
            title: "Nombreuses erreurs",
            description: "Votre moyenne d'erreurs est élevée. Concentrez-vous sur les règles de base."
        });
    }

    commonErrors.slice(0, 2).forEach(error => {
        if (error.count > 3) {
            analysis.weaknesses.push({
                title: `Difficultés en ${error.type.toLowerCase()}`,
                description: `Vous faites souvent des erreurs de ${error.type.toLowerCase()} (${error.count} occurrences). Cela mérite une attention particulière.`
            });
        }
    });

    // Conseils personnalisés
    if (averageErrors > 5) {
        analysis.tips.push({
            title: "Relecture systématique",
            description: "Prenez l'habitude de relire vos textes plusieurs fois avant de les finaliser."
        });
    }

    if (commonErrors.length > 0) {
        analysis.tips.push({
            title: "Focus sur vos erreurs récurrentes",
            description: `Concentrez-vous particulièrement sur les erreurs de ${commonErrors[0].type.toLowerCase()} qui reviennent souvent dans vos textes.`
        });
    }

    analysis.tips.push({
        title: "Pratique régulière",
        description: "Utilisez l'application régulièrement pour maintenir et améliorer votre niveau d'écriture."
    });

    return analysis;
}

// Fonction pour générer des conseils spécifiques au résumé
async function generateSummaryTips(commonErrors, userId) {
    const tips = [];

    if (commonErrors.length === 0) {
        tips.push({
            icon: "fas fa-star",
            title: "Excellent travail !",
            description: "Vous n'avez pas d'erreurs récurrentes. Continuez à utiliser l'application pour maintenir votre niveau."
        });
        return tips;
    }

    // Conseils basés sur les types d'erreurs les plus fréquents
    const errorTypeTips = {
        'orthographe': {
            icon: "fas fa-spell-check",
            title: "Améliorer l'orthographe",
            description: "Relisez attentivement vos textes et utilisez un correcteur orthographique. Faites attention aux mots courants que vous confondez souvent."
        },
        'grammaire': {
            icon: "fas fa-language",
            title: "Renforcer la grammaire",
            description: "Révisez les règles de grammaire de base, particulièrement l'accord des verbes et des adjectifs. Pratiquez avec des exercices spécifiques."
        },
        'conjugaison': {
            icon: "fas fa-book",
            title: "Maîtriser la conjugaison",
            description: "Révisez les temps de conjugaison, surtout les verbes irréguliers. Utilisez des tableaux de conjugaison pour vous aider."
        },
        'ponctuation': {
            icon: "fas fa-comma",
            title: "Améliorer la ponctuation",
            description: "Apprenez les règles de ponctuation : virgules, points, points-virgules. La ponctuation améliore la lisibilité de vos textes."
        },
        'vocabulaire': {
            icon: "fas fa-book-open",
            title: "Enrichir le vocabulaire",
            description: "Lisez régulièrement et notez les nouveaux mots. Utilisez un dictionnaire pour vérifier le sens et l'orthographe des mots."
        }
    };

    // Ajouter des conseils pour les 3 erreurs les plus fréquentes
    commonErrors.slice(0, 3).forEach((error, index) => {
        const tip = errorTypeTips[error.type.toLowerCase()] || {
            icon: "fas fa-exclamation-triangle",
            title: `Erreur ${error.type}`,
            description: `Concentrez-vous sur les erreurs de ${error.type.toLowerCase()}. Cette erreur apparaît ${error.count} fois dans vos textes.`
        };
        tips.push(tip);
    });

    // Conseils généraux
    tips.push({
        icon: "fas fa-clock",
        title: "Pratique régulière",
        description: "Utilisez l'application quotidiennement pour identifier et corriger vos erreurs. La régularité est la clé du progrès."
    });

    tips.push({
        icon: "fas fa-eye",
        title: "Relecture attentive",
        description: "Prenez le temps de relire vos textes avant de les soumettre. Lisez à voix haute pour détecter les erreurs plus facilement."
    });

    return tips;
}

// Route pour servir l'application (catch-all pour SPA)
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({
        status: 'error',
        message: 'Something went wrong!'
    });
});

// Démarrage du serveur
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Serveur SamaBled démarré sur le port ${PORT}`);
    console.log(`📊 Environnement: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🗄️ Base de données: ${process.env.DATABASE_URL ? 'Connectée' : 'Non configurée'}`);
}); 