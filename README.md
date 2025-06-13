# 🔤 SamaBled - Correcteur Orthographique et Grammatical

Une application web moderne de correction orthographique et grammaticale bilingue (Français/Anglais) avec système d'authentification, dashboard utilisateur et historique des corrections.

## ✨ Fonctionnalités

### 🔧 Correction et Reformulation
- ✅ Correction orthographique et grammaticale (Français/Anglais)
- ✅ Options de correction personnalisables
- ✅ Reformulation avec différents styles (professionnel, normal, familier)
- ✅ Détection et explication des erreurs
- ✅ Suggestions d'amélioration

### 👤 Gestion Utilisateur
- ✅ Système d'authentification complet (inscription, connexion)
- ✅ Réinitialisation de mot de passe
- ✅ Profil utilisateur avec email
- ✅ Mode invité avec stockage local

### 📊 Dashboard et Statistiques
- ✅ Tableau de bord personnalisé
- ✅ Statistiques détaillées (corrections, erreurs, progression)
- ✅ Historique complet des corrections
- ✅ Analyse des forces et faiblesses
- ✅ Recommandations personnalisées
- ✅ Graphiques de progression

### 🎨 Interface Utilisateur
- ✅ Design moderne et responsive
- ✅ Thème clair/sombre
- ✅ Interface mobile optimisée
- ✅ Animations fluides
- ✅ Notifications en temps réel

## Prérequis

- Node.js (v14 ou supérieur)
- PostgreSQL
- Clé API OpenAI

## Installation

1. Clonez le dépôt :
```bash
git clone [URL_DU_REPO]
cd [NOM_DU_DOSSIER]
```

2. Installez les dépendances :
```bash
npm install
```

3. Créez un fichier `.env` à la racine du projet avec les variables suivantes :
```
PORT=3000
NODE_ENV=development
DATABASE_URL=postgresql://postgres:your_password@localhost:5432/text_corrector
JWT_SECRET=your_jwt_secret_key
JWT_EXPIRES_IN=24h
OPENAI_API_KEY=your_openai_api_key
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

4. Initialisez la base de données :
```bash
psql -U postgres -f database/init.sql
```

5. Démarrez le serveur :
```bash
npm start
```

L'application sera accessible à l'adresse `http://localhost:3000`

## 🌐 Déploiement sur Render

Pour déployer l'application sur Render avec PostgreSQL, consultez le guide détaillé :

**📖 [Guide de Déploiement Complet](DEPLOYMENT.md)**

Le guide couvre :
- Configuration de la base de données PostgreSQL sur Render
- Déploiement de l'application web
- Configuration des variables d'environnement
- Surveillance et maintenance
- Dépannage des problèmes courants

### 🚀 Déploiement Rapide

Utilisez le script de déploiement inclus :

```bash
# Rendre le script exécutable (Linux/Mac)
chmod +x deploy.sh

# Déployer avec un message
./deploy.sh "Mise à jour de l'application"
```

### 🔗 Liens Utiles

- **Application Live** : `https://samabled-app.onrender.com`
- **Dashboard Render** : `https://dashboard.render.com`
- **Repository GitHub** : `https://github.com/Zalint/samabled`

## Structure du Projet

```
.
├── config/
│   └── database.js
├── database/
│   └── init.sql
├── public/
│   ├── css/
│   │   └── style.css
│   ├── js/
│   │   └── app.js
│   └── index.html
├── routes/
│   └── api.js
├── .env
├── package.json
├── README.md
└── server.js
```

## API Endpoints

### Authentification
- `POST /api/auth/register` - Inscription
- `POST /api/auth/login` - Connexion

### Correction
- `POST /api/correct` - Correction de texte
- `POST /api/reformulate` - Reformulation de texte

### Historique et Statistiques
- `GET /api/history` - Historique des corrections
- `GET /api/stats` - Statistiques d'utilisation

## Sécurité

- Authentification JWT
- Protection contre les attaques CSRF
- Rate limiting
- Validation des entrées
- Chiffrement des mots de passe

## Performance

- Mise en cache des résultats
- Optimisation des requêtes API
- Gestion efficace de la mémoire

## Contribution

Les contributions sont les bienvenues ! N'hésitez pas à ouvrir une issue ou à soumettre une pull request.

## Licence

MIT 