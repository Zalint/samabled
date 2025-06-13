-- Script pour ajouter les tables manquantes à SamaBled
-- Exécuter après avoir créé users et corrections

-- ==============================================
-- TABLE DES TEXTES CORRIGÉS (pour le dashboard)
-- ==============================================
CREATE TABLE corrected_texts (
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
CREATE TABLE errors (
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
CREATE TABLE user_stats (
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
CREATE TABLE reformulations (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    original_text TEXT NOT NULL,
    reformulated_text TEXT NOT NULL,
    style VARCHAR(20) NOT NULL, -- 'professional', 'normal', 'casual'
    language VARCHAR(2) NOT NULL DEFAULT 'fr',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ==============================================
-- INDEX SUPPLÉMENTAIRES
-- ==============================================

-- Index pour les textes corrigés
CREATE INDEX idx_corrected_texts_user_id ON corrected_texts(user_id);
CREATE INDEX idx_corrected_texts_created_at ON corrected_texts(created_at);

-- Index pour les erreurs
CREATE INDEX idx_errors_text_id ON errors(text_id);
CREATE INDEX idx_errors_corrected_text_id ON errors(corrected_text_id);
CREATE INDEX idx_errors_error_type ON errors(error_type);

-- Index pour les statistiques
CREATE INDEX idx_user_stats_user_id ON user_stats(user_id);

-- Index pour les reformulations
CREATE INDEX idx_reformulations_user_id ON reformulations(user_id);
CREATE INDEX idx_reformulations_created_at ON reformulations(created_at);

-- ==============================================
-- TRIGGER POUR USER_STATS
-- ==============================================
CREATE TRIGGER update_user_stats_updated_at 
    BEFORE UPDATE ON user_stats 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- ==============================================
-- VÉRIFICATION
-- ==============================================
SELECT 'Tables ajoutées avec succès !' as message; 