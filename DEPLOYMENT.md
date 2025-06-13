# 🚀 Guide de Déploiement - SamaBled sur Render

Ce guide vous explique comment déployer l'application **SamaBled** (correction orthographique et grammaticale) sur **Render** avec une base de données **PostgreSQL**.

## 📋 Prérequis

- Compte [Render](https://render.com) (gratuit)
- Compte [GitHub](https://github.com) avec votre repository
- Clé API OpenAI (pour les corrections)

## 🗄️ 1. Configuration de la Base de Données PostgreSQL

### Étape 1.1 : Créer la base de données
1. Connectez-vous à [Render Dashboard](https://dashboard.render.com)
2. Cliquez sur **"New +"** → **"PostgreSQL"**
3. Configurez votre base de données :
   - **Name** : `samabled-db`
   - **Database** : `samabled`
   - **User** : `samabled_user`
   - **Region** : Choisissez la région la plus proche
   - **PostgreSQL Version** : 15 (recommandé)
   - **Plan** : Free (pour commencer)

4. Cliquez sur **"Create Database"**

### Étape 1.2 : Récupérer les informations de connexion
Une fois la base créée, notez les informations suivantes dans l'onglet **"Connect"** :
- **Internal Database URL** (pour l'application)
- **External Database URL** (pour les connexions externes)
- **Host**, **Port**, **Database**, **Username**, **Password**

### Étape 1.3 : Initialiser la base de données
1. Utilisez l'**External Database URL** pour vous connecter via un client PostgreSQL
2. Exécutez le script d'initialisation :

```sql
-- Créer la table des utilisateurs
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Créer la table des corrections
CREATE TABLE corrections (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    original_text TEXT NOT NULL,
    corrected_text TEXT NOT NULL,
    error_message TEXT,
    position_start INTEGER NOT NULL DEFAULT 0,
    position_end INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Créer des index pour optimiser les performances
CREATE INDEX idx_corrections_user_id ON corrections(user_id);
CREATE INDEX idx_corrections_created_at ON corrections(created_at);
CREATE INDEX idx_users_email ON users(email);

-- Fonction pour mettre à jour updated_at automatiquement
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger pour la table users
CREATE TRIGGER update_users_updated_at 
    BEFORE UPDATE ON users 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();
```

## 🌐 2. Déploiement de l'Application Web

### Étape 2.1 : Préparer le repository
1. Assurez-vous que votre code est poussé sur GitHub
2. Vérifiez que vous avez les fichiers suivants :
   - `package.json` avec les scripts de démarrage
   - `server.js` (point d'entrée)
   - Variables d'environnement configurées

### Étape 2.2 : Créer le service web sur Render
1. Dans Render Dashboard, cliquez sur **"New +"** → **"Web Service"**
2. Connectez votre repository GitHub :
   - **Repository** : `https://github.com/Zalint/samabled.git`
   - **Branch** : `main`

3. Configurez le service :
   - **Name** : `samabled-app`
   - **Region** : Même région que votre base de données
   - **Branch** : `main`
   - **Root Directory** : (laisser vide)
   - **Runtime** : `Node`
   - **Build Command** : `npm install`
   - **Start Command** : `npm start`
   - **Plan** : Free (pour commencer)

### Étape 2.3 : Configurer les variables d'environnement
Dans l'onglet **"Environment"** de votre service web, ajoutez :

```bash
# Base de données (utilisez l'Internal Database URL de votre PostgreSQL)
DATABASE_URL=postgresql://username:password@host:port/database

# Sécurité
JWT_SECRET=votre_jwt_secret_tres_securise_ici
PORT=10000

# API OpenAI (optionnel, pour les corrections avancées)
OPENAI_API_KEY=votre_cle_api_openai

# Configuration Node.js
NODE_ENV=production
```

**⚠️ Important** : 
- Utilisez l'**Internal Database URL** de votre PostgreSQL Render
- Générez un JWT_SECRET sécurisé (32+ caractères aléatoires)
- Le PORT doit être 10000 pour Render

### Étape 2.4 : Déployer
1. Cliquez sur **"Create Web Service"**
2. Render va automatiquement :
   - Cloner votre repository
   - Installer les dépendances (`npm install`)
   - Démarrer l'application (`npm start`)

## 📝 3. Configuration du package.json

Assurez-vous que votre `package.json` contient :

```json
{
  "name": "samabled",
  "version": "1.0.0",
  "description": "Application de correction orthographique et grammaticale",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js",
    "test": "echo \"Error: no test specified\" && exit 1"
  },
  "engines": {
    "node": ">=18.0.0",
    "npm": ">=8.0.0"
  },
  "dependencies": {
    "express": "^4.18.2",
    "pg": "^8.11.3",
    "bcryptjs": "^2.4.3",
    "jsonwebtoken": "^9.0.2",
    "cors": "^2.8.5",
    "helmet": "^7.0.0",
    "express-rate-limit": "^6.10.0"
  },
  "devDependencies": {
    "nodemon": "^3.0.1"
  }
}
```

## 🔧 4. Configuration du serveur (server.js)

Vérifiez que votre `server.js` utilise les variables d'environnement :

```javascript
const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3000;

// Configuration pour la production
if (process.env.NODE_ENV === 'production') {
    app.use(helmet());
    app.use(rateLimit({
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 100 // limite chaque IP à 100 requêtes par windowMs
    }));
}

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Routes API
app.use('/api', require('./routes/api'));

// Route pour servir l'application
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Serveur démarré sur le port ${PORT}`);
    console.log(`📊 Environnement: ${process.env.NODE_ENV || 'development'}`);
});
```

## 🔐 5. Configuration de la Base de Données (config/database.js)

```javascript
const { Pool } = require('pg');

// Configuration pour Render (utilise DATABASE_URL)
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Test de connexion
pool.on('connect', () => {
    console.log('✅ Connecté à PostgreSQL');
});

pool.on('error', (err) => {
    console.error('❌ Erreur PostgreSQL:', err);
});

module.exports = pool;
```

## 🚀 6. Processus de Déploiement

### Déploiement automatique
Render redéploie automatiquement à chaque push sur la branche `main` :

```bash
git add .
git commit -m "Deploy: Mise à jour de l'application"
git push origin main
```

### Vérification du déploiement
1. **Logs** : Consultez les logs dans Render Dashboard
2. **Santé** : Vérifiez que le service est "Live"
3. **Base de données** : Testez la connexion dans l'onglet "Connect"

## 🔍 7. Surveillance et Maintenance

### Logs de l'application
```bash
# Dans Render Dashboard → Votre service → Logs
# Ou via Render CLI
render logs -s samabled-app
```

### Monitoring de la base de données
- **Métriques** : CPU, Mémoire, Connexions
- **Backups** : Automatiques sur Render
- **Alertes** : Configurables dans les paramètres

### Mise à l'échelle
Pour augmenter les performances :
1. **Web Service** : Passer au plan payant pour plus de ressources
2. **Database** : Upgrader vers un plan avec plus de stockage/connexions

## 🌍 8. Domaine Personnalisé (Optionnel)

1. Dans votre service web → **Settings** → **Custom Domains**
2. Ajoutez votre domaine : `samabled.com`
3. Configurez les DNS selon les instructions Render
4. SSL automatique via Let's Encrypt

## 🔧 9. Variables d'Environnement Complètes

```bash
# Base de données
DATABASE_URL=postgresql://user:password@host:port/database

# Sécurité
JWT_SECRET=your_super_secure_jwt_secret_here_32_chars_min
PORT=10000

# APIs externes
OPENAI_API_KEY=sk-your-openai-api-key-here

# Configuration
NODE_ENV=production
CORS_ORIGIN=https://samabled.onrender.com

# Optionnel : Configuration email (pour reset password)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
```

## 🆘 10. Dépannage

### Problèmes courants

**1. Erreur de connexion à la base de données**
```bash
# Vérifiez DATABASE_URL dans les variables d'environnement
# Format: postgresql://username:password@host:port/database
```

**2. Application ne démarre pas**
```bash
# Vérifiez les logs pour les erreurs
# Assurez-vous que PORT=10000
# Vérifiez que server.js écoute sur '0.0.0.0'
```

**3. Erreurs 502/503**
```bash
# L'application met du temps à démarrer (plan gratuit)
# Vérifiez que le processus écoute sur le bon port
# Consultez les logs pour les erreurs de démarrage
```

### Commandes utiles

```bash
# Redéployer manuellement
git commit --allow-empty -m "Redeploy"
git push origin main

# Vérifier les variables d'environnement
# Dans Render Dashboard → Service → Environment

# Tester la base de données
# Utilisez l'External Database URL avec un client PostgreSQL
```

## 📞 Support

- **Documentation Render** : [docs.render.com](https://docs.render.com)
- **Support Render** : Via le dashboard ou Discord
- **Repository** : [Issues GitHub](https://github.com/Zalint/samabled/issues)

---

## 🎉 Félicitations !

Votre application SamaBled est maintenant déployée sur Render ! 

**URL de votre application** : `https://samabled-app.onrender.com`

N'oubliez pas de tester toutes les fonctionnalités après le déploiement ! 🚀 