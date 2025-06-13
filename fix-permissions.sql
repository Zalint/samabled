-- Script pour donner les permissions à l'utilisateur zalint
-- Exécutez ce script en tant que superutilisateur (postgres)

-- Se connecter à la base text_corrector
\c text_corrector;

-- Donner tous les privilèges sur le schéma public à zalint
GRANT ALL PRIVILEGES ON SCHEMA public TO zalint;

-- Donner tous les privilèges sur toutes les tables existantes
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO zalint;

-- Donner tous les privilèges sur toutes les séquences (pour les SERIAL)
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO zalint;

-- Donner les privilèges par défaut pour les futures tables
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO zalint;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO zalint;

-- Vérifier les permissions
\dp users;
\dp corrected_texts;
\dp errors;
\dp user_stats; 