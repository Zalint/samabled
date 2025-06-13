# Correcteur de Texte Bilingue

Une application web de correction de texte bilingue (Français/Anglais) utilisant l'API OpenAI pour la correction et la reformulation de texte.

## Fonctionnalités

- Correction de texte en français et en anglais
- Options de correction personnalisables
- Reformulation de texte avec différents styles
- Système d'authentification
- Historique des corrections
- Statistiques d'utilisation
- Interface responsive
- Thème clair/sombre

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