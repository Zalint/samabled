-- Création de la base de données
CREATE DATABASE text_corrector;



-- Table des utilisateurs
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Table des textes corrigés
CREATE TABLE corrected_texts (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    original_text TEXT NOT NULL,
    corrected_text TEXT NOT NULL,
    language VARCHAR(2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Table des erreurs
CREATE TABLE errors (
    id SERIAL PRIMARY KEY,
    corrected_text_id INTEGER REFERENCES corrected_texts(id),
    error_type VARCHAR(50) NOT NULL,
    error_message TEXT NOT NULL,
    severity VARCHAR(20) NOT NULL,
    position_start INTEGER NOT NULL,
    position_end INTEGER NOT NULL
);

-- Table des statistiques utilisateur
CREATE TABLE user_stats (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    total_corrections INTEGER DEFAULT 0,
    most_common_error VARCHAR(50),
    last_correction_date TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index pour optimiser les recherches
CREATE INDEX idx_corrected_texts_user_id ON corrected_texts(user_id);
CREATE INDEX idx_errors_corrected_text_id ON errors(corrected_text_id);
CREATE INDEX idx_user_stats_user_id ON user_stats(user_id); 