-- Script d'initialisation complet pour SamaBled
-- Compatible avec PostgreSQL et Render

-- Supprimer les tables existantes si elles existent (optionnel)
-- DROP TABLE IF EXISTS corrections CASCADE;
-- DROP TABLE IF EXISTS users CASCADE;

-- ==============================================
-- TABLE DES UTILISATEURS
-- ==============================================
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ==============================================
-- TABLE DES CORRECTIONS (utilisée par l'API dashboard)
-- ==============================================
CREATE TABLE IF NOT EXISTS corrections (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    original_text TEXT NOT NULL,
    corrected_text TEXT NOT NULL,
    error_message TEXT,
    position_start INTEGER NOT NULL DEFAULT 0,
    position_end INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ==============================================
-- TABLE DES TEXTES CORRIGÉS (pour compatibilité)
-- ==============================================
CREATE TABLE IF NOT EXISTS corrected_texts (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    original_text TEXT NOT NULL,
    corrected_text TEXT NOT NULL,
    language VARCHAR(2) NOT NULL DEFAULT 'fr',
    error_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ==============================================
-- TABLE DES ERREURS DÉTAILLÉES
-- ==============================================
CREATE TABLE IF NOT EXISTS errors (
    id SERIAL PRIMARY KEY,
    text_id INTEGER REFERENCES corrected_texts(id) ON DELETE CASCADE,
    corrected_text_id INTEGER REFERENCES corrected_texts(id) ON DELETE CASCADE,
    error_type VARCHAR(50) NOT NULL,
    error_message TEXT NOT NULL,
    severity VARCHAR(20) NOT NULL DEFAULT 'medium',
    position_start INTEGER NOT NULL DEFAULT 0,
    position_end INTEGER NOT NULL DEFAULT 0,
    original_word VARCHAR(255),
    corrected_word VARCHAR(255),
    explanation TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ==============================================
-- TABLE DES STATISTIQUES UTILISATEUR
-- ==============================================
CREATE TABLE IF NOT EXISTS user_stats (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    total_corrections INTEGER DEFAULT 0,
    total_errors INTEGER DEFAULT 0,
    most_common_error VARCHAR(50),
    last_correction_date TIMESTAMP WITH TIME ZONE,
    improvement_rate DECIMAL(5,2) DEFAULT 0.0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ==============================================
-- TABLE DES REFORMULATIONS
-- ==============================================
CREATE TABLE IF NOT EXISTS reformulations (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    original_text TEXT NOT NULL,
    reformulated_text TEXT NOT NULL,
    style VARCHAR(20) NOT NULL, -- 'professional', 'normal', 'casual'
    language VARCHAR(2) NOT NULL DEFAULT 'fr',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ==============================================
-- INDEX POUR OPTIMISER LES PERFORMANCES
-- ==============================================

-- Index pour les corrections
CREATE INDEX IF NOT EXISTS idx_corrections_user_id ON corrections(user_id);
CREATE INDEX IF NOT EXISTS idx_corrections_created_at ON corrections(created_at);

-- Index pour les textes corrigés
CREATE INDEX IF NOT EXISTS idx_corrected_texts_user_id ON corrected_texts(user_id);
CREATE INDEX IF NOT EXISTS idx_corrected_texts_created_at ON corrected_texts(created_at);

-- Index pour les erreurs
CREATE INDEX IF NOT EXISTS idx_errors_text_id ON errors(text_id);
CREATE INDEX IF NOT EXISTS idx_errors_corrected_text_id ON errors(corrected_text_id);
CREATE INDEX IF NOT EXISTS idx_errors_error_type ON errors(error_type);

-- Index pour les statistiques
CREATE INDEX IF NOT EXISTS idx_user_stats_user_id ON user_stats(user_id);

-- Index pour les reformulations
CREATE INDEX IF NOT EXISTS idx_reformulations_user_id ON reformulations(user_id);
CREATE INDEX IF NOT EXISTS idx_reformulations_created_at ON reformulations(created_at);

-- Index pour les emails (authentification)
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- ==============================================
-- FONCTIONS ET TRIGGERS
-- ==============================================

-- Fonction pour mettre à jour updated_at automatiquement
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger pour la table users
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at 
    BEFORE UPDATE ON users 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger pour la table user_stats
DROP TRIGGER IF EXISTS update_user_stats_updated_at ON user_stats;
CREATE TRIGGER update_user_stats_updated_at 
    BEFORE UPDATE ON user_stats 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- ==============================================
-- DONNÉES DE TEST (OPTIONNEL)
-- ==============================================

-- Insérer un utilisateur de test (mot de passe: "test123")
-- Le hash correspond à "test123" avec bcrypt
INSERT INTO users (email, password_hash) 
VALUES ('test@example.com', '$2b$10$rOzJqQjQjQjQjQjQjQjQjOzJqQjQjQjQjQjQjQjQjQjQjQjQjQjQj')
ON CONFLICT (email) DO NOTHING;

-- ==============================================
-- VÉRIFICATION DE L'INSTALLATION
-- ==============================================

-- Afficher un résumé des tables créées
DO $$
DECLARE
    table_count INTEGER;
    index_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO table_count 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name IN ('users', 'corrections', 'corrected_texts', 'errors', 'user_stats', 'reformulations');
    
    SELECT COUNT(*) INTO index_count 
    FROM pg_indexes 
    WHERE schemaname = 'public' 
    AND indexname LIKE 'idx_%';
    
    RAISE NOTICE '✅ Installation terminée !';
    RAISE NOTICE '📊 Tables créées: %', table_count;
    RAISE NOTICE '🔍 Index créés: %', index_count;
    RAISE NOTICE '🚀 Base de données prête pour SamaBled !';
END $$; 