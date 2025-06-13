const { Pool } = require('pg');
require('dotenv').config();

// Configuration pour votre base de données
const pool = new Pool({
    user: 'zalint',
    host: 'localhost',
    database: 'text_corrector',
    password: 'bonea2024',
    port: 5432,
});

async function initializeDatabase() {
    const client = await pool.connect();
    
    try {
        console.log('🔄 Initialisation de la base de données...');
        
        // Créer la table users
        await client.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                email VARCHAR(255) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ Table users créée');

        // Créer la table corrected_texts
        await client.query(`
            CREATE TABLE IF NOT EXISTS corrected_texts (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                original_text TEXT NOT NULL,
                corrected_text TEXT NOT NULL,
                language VARCHAR(10) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ Table corrected_texts créée');

        // Créer la table errors
        await client.query(`
            CREATE TABLE IF NOT EXISTS errors (
                id SERIAL PRIMARY KEY,
                correction_id INTEGER REFERENCES corrected_texts(id) ON DELETE CASCADE,
                error_type VARCHAR(100) NOT NULL,
                original_word VARCHAR(255),
                corrected_word VARCHAR(255),
                explanation TEXT,
                severity VARCHAR(50) DEFAULT 'medium',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ Table errors créée');

        // Créer la table user_stats
        await client.query(`
            CREATE TABLE IF NOT EXISTS user_stats (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                total_corrections INTEGER DEFAULT 0,
                total_errors_found INTEGER DEFAULT 0,
                most_common_error_type VARCHAR(100),
                last_correction_date TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ Table user_stats créée');

        // Créer la table reformulations
        await client.query(`
            CREATE TABLE IF NOT EXISTS reformulations (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                original_text TEXT NOT NULL,
                reformulated_text TEXT NOT NULL,
                style VARCHAR(50) NOT NULL,
                language VARCHAR(10) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ Table reformulations créée');

        console.log('🎉 Base de données initialisée avec succès !');
        
    } catch (error) {
        console.error('❌ Erreur lors de l\'initialisation:', error);
    } finally {
        client.release();
        await pool.end();
    }
}

// Exécuter l'initialisation
initializeDatabase(); 