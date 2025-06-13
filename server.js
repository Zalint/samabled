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

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Rate limiting
const limiter = rateLimit({
    windowMs: process.env.RATE_LIMIT_WINDOW_MS || 900000,
    max: process.env.RATE_LIMIT_MAX_REQUESTS || 100
});
app.use(limiter);

// Routes
app.use('/api', apiRoutes);

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Route pour le tableau de bord utilisateur
app.get('/api/dashboard', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        
        // Récupérer les statistiques générales
        const statsQuery = `
            SELECT 
                COUNT(*) as total_corrections,
                COALESCE(SUM(error_count), 0) as total_errors,
                COALESCE(AVG(error_count), 0) as average_errors
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

        // Récupérer les erreurs les plus fréquentes
        const commonErrorsQuery = `
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
        const commonErrorsResult = await pool.query(commonErrorsQuery, [userId]);
        const commonErrors = commonErrorsResult.rows.map(row => ({
            type: row.error_type,
            count: parseInt(row.count)
        }));

        // Récupérer l'historique des textes corrigés
        const historyQuery = `
            SELECT 
                ct.id,
                ct.original_text,
                ct.error_count,
                ct.created_at,
                ARRAY_AGG(DISTINCT e.error_type) as error_types
            FROM corrected_texts ct
            LEFT JOIN errors e ON ct.id = e.text_id
            WHERE ct.user_id = $1
            GROUP BY ct.id, ct.original_text, ct.error_count, ct.created_at
            ORDER BY ct.created_at DESC
            LIMIT 50
        `;
        const historyResult = await pool.query(historyQuery, [userId]);
        const history = historyResult.rows.map(row => ({
            id: row.id,
            original_text: row.original_text,
            error_count: row.error_count,
            created_at: row.created_at,
            error_types: row.error_types ? row.error_types.filter(type => type !== null) : []
        }));

        // Générer des recommandations basées sur les erreurs fréquentes
        const recommendations = await generateRecommendations(commonErrors, userId);

        // Générer une analyse des forces et faiblesses
        const analysis = await generateAnalysis(commonErrors, stats, userId);

        const dashboardData = {
            stats: {
                totalCorrections: parseInt(stats.total_corrections),
                totalErrors: parseInt(stats.total_errors),
                averageErrors: parseFloat(stats.average_errors),
                improvementRate: Math.max(0, improvementRate)
            },
            commonErrors,
            recommendations,
            history,
            analysis
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

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({
        status: 'error',
        message: 'Something went wrong!'
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
}); 