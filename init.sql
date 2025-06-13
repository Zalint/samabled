-- Script d'initialisation pour la base de données PostgreSQL
-- Compatible avec Render et autres services cloud

-- Créer la table users
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Créer la table corrected_texts
CREATE TABLE IF NOT EXISTS corrected_texts (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    original_text TEXT NOT NULL,
    corrected_text TEXT NOT NULL,
    language VARCHAR(10) NOT NULL DEFAULT 'fr',
    error_count INTEGER DEFAULT 0,
    options JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Créer la table errors
CREATE TABLE IF NOT EXISTS errors (
    id SERIAL PRIMARY KEY,
    text_id INTEGER REFERENCES corrected_texts(id) ON DELETE CASCADE,
    error_type VARCHAR(100) NOT NULL,
    original_word VARCHAR(255),
    corrected_word VARCHAR(255),
    explanation TEXT,
    severity VARCHAR(50) DEFAULT 'medium',
    position_start INTEGER,
    position_end INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Créer la table user_stats
CREATE TABLE IF NOT EXISTS user_stats (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    total_corrections INTEGER DEFAULT 0,
    total_errors_found INTEGER DEFAULT 0,
    most_common_error_type VARCHAR(100),
    average_errors_per_text DECIMAL(5,2) DEFAULT 0,
    last_correction_date TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Créer la table reformulations
CREATE TABLE IF NOT EXISTS reformulations (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    original_text TEXT NOT NULL,
    reformulated_text TEXT NOT NULL,
    style VARCHAR(50) NOT NULL,
    language VARCHAR(10) NOT NULL DEFAULT 'fr',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Créer la table sessions (pour la gestion des sessions)
CREATE TABLE IF NOT EXISTS sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    session_token VARCHAR(255) UNIQUE NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Ajouter la colonne error_count si elle n'existe pas déjà
ALTER TABLE corrected_texts ADD COLUMN IF NOT EXISTS error_count INTEGER DEFAULT 0;

-- Ajouter la colonne text_id dans errors si elle n'existe pas
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'errors' AND column_name = 'text_id') THEN
        ALTER TABLE errors ADD COLUMN text_id INTEGER REFERENCES corrected_texts(id) ON DELETE CASCADE;
        
        -- Si correction_id existe, copier ses valeurs vers text_id
        IF EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'errors' AND column_name = 'correction_id') THEN
            UPDATE errors SET text_id = correction_id WHERE text_id IS NULL;
        END IF;
    END IF;
END $$;

-- Ajouter les colonnes manquantes pour les détails des erreurs
ALTER TABLE errors ADD COLUMN IF NOT EXISTS original_word VARCHAR(255);
ALTER TABLE errors ADD COLUMN IF NOT EXISTS corrected_word VARCHAR(255);
ALTER TABLE errors ADD COLUMN IF NOT EXISTS explanation TEXT;

-- Créer des index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_corrected_texts_user_id ON corrected_texts(user_id);
CREATE INDEX IF NOT EXISTS idx_corrected_texts_created_at ON corrected_texts(created_at);
CREATE INDEX IF NOT EXISTS idx_errors_text_id ON errors(text_id);
CREATE INDEX IF NOT EXISTS idx_errors_type ON errors(error_type);
CREATE INDEX IF NOT EXISTS idx_user_stats_user_id ON user_stats(user_id);
CREATE INDEX IF NOT EXISTS idx_reformulations_user_id ON reformulations(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);

-- Créer une fonction pour mettre à jour automatiquement updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Créer des triggers pour mettre à jour automatiquement updated_at
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at 
    BEFORE UPDATE ON users 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_stats_updated_at ON user_stats;
CREATE TRIGGER update_user_stats_updated_at 
    BEFORE UPDATE ON user_stats 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Créer une fonction pour maintenir error_count automatiquement
CREATE OR REPLACE FUNCTION update_error_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE corrected_texts 
        SET error_count = error_count + 1 
        WHERE id = NEW.text_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE corrected_texts 
        SET error_count = GREATEST(error_count - 1, 0) 
        WHERE id = OLD.text_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Créer le trigger pour maintenir error_count
DROP TRIGGER IF EXISTS trigger_update_error_count ON errors;
CREATE TRIGGER trigger_update_error_count
    AFTER INSERT OR DELETE ON errors
    FOR EACH ROW EXECUTE FUNCTION update_error_count();

-- Créer une fonction pour mettre à jour les statistiques utilisateur
CREATE OR REPLACE FUNCTION update_user_stats()
RETURNS TRIGGER AS $$
BEGIN
    -- Mettre à jour les stats quand une nouvelle correction est ajoutée
    INSERT INTO user_stats (user_id, total_corrections, total_errors_found, last_correction_date)
    VALUES (NEW.user_id, 1, COALESCE(NEW.error_count, 0), CURRENT_TIMESTAMP)
    ON CONFLICT (user_id) DO UPDATE SET
        total_corrections = user_stats.total_corrections + 1,
        total_errors_found = user_stats.total_errors_found + COALESCE(NEW.error_count, 0),
        last_correction_date = CURRENT_TIMESTAMP;
    
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Créer un trigger pour mettre à jour automatiquement les stats
DROP TRIGGER IF EXISTS update_stats_on_correction ON corrected_texts;
CREATE TRIGGER update_stats_on_correction
    AFTER INSERT ON corrected_texts
    FOR EACH ROW EXECUTE FUNCTION update_user_stats();

-- Mettre à jour le nombre d'erreurs pour les textes existants
UPDATE corrected_texts 
SET error_count = (
    SELECT COUNT(*) 
    FROM errors 
    WHERE errors.text_id = corrected_texts.id
)
WHERE error_count = 0 OR error_count IS NULL;

-- Insérer des données de test (optionnel, pour le développement)
-- Décommentez ces lignes si vous voulez des données de test
/*
INSERT INTO users (email, password_hash) VALUES 
('test@example.com', '$2a$10$example.hash.here') 
ON CONFLICT (email) DO NOTHING;
*/

-- Afficher un message de confirmation
DO $$
BEGIN
    RAISE NOTICE 'Base de données initialisée avec succès !';
    RAISE NOTICE 'Tables créées : users, corrected_texts, errors, user_stats, reformulations, sessions';
    RAISE NOTICE 'Colonne error_count ajoutée à corrected_texts';
    RAISE NOTICE 'Index et triggers configurés pour les performances';
    RAISE NOTICE 'Triggers automatiques pour error_count et user_stats';
END $$; 