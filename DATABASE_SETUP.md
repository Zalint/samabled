# Configuration de la Base de Données

## Pour le développement local

Si vous avez des problèmes de permissions avec votre base PostgreSQL locale, exécutez ces commandes en tant que superutilisateur :

```sql
-- Se connecter à votre base de données
\c text_corrector;

-- Donner tous les privilèges à votre utilisateur
GRANT ALL PRIVILEGES ON SCHEMA public TO zalint;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO zalint;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO zalint;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO zalint;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO zalint;
```

## Pour Render (Production)

### 1. Créer une base de données PostgreSQL sur Render

1. Allez sur [Render Dashboard](https://dashboard.render.com)
2. Cliquez sur "New +" → "PostgreSQL"
3. Configurez votre base de données :
   - **Name** : `correcteur-bilingue-db`
   - **Database** : `correcteur_bilingue`
   - **User** : `correcteur_user`
   - **Region** : Choisissez la région la plus proche
   - **PostgreSQL Version** : 15 (recommandé)
   - **Plan** : Free (pour commencer)

### 2. Initialiser la base de données

Une fois votre base créée sur Render :

1. **Récupérez l'URL de connexion** depuis le dashboard Render
2. **Connectez-vous à votre base** via psql ou un client PostgreSQL
3. **Exécutez le script d'initialisation** :

```bash
psql "votre_database_url_render" -f init.sql
```

Ou copiez-collez le contenu du fichier `init.sql` dans votre client PostgreSQL.

### 3. Variables d'environnement pour Render

Dans votre service web Render, configurez ces variables d'environnement :

```env
DATABASE_URL=postgresql://user:password@host:port/database
JWT_SECRET=votre_jwt_secret_securise
JWT_EXPIRES_IN=24h
OPENAI_API_KEY=votre_cle_openai
NODE_ENV=production
PORT=10000
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

### 4. Script de déploiement

Render exécutera automatiquement :
- `npm install` pour installer les dépendances
- `node server.js` pour démarrer l'application

### 5. Vérification

Une fois déployé, votre application sera accessible à l'URL fournie par Render.

## Structure de la base de données

Le script `init.sql` crée :

### Tables principales :
- **users** : Utilisateurs avec authentification
- **corrected_texts** : Textes corrigés avec métadonnées
- **errors** : Erreurs détectées avec explications
- **user_stats** : Statistiques utilisateur
- **reformulations** : Reformulations de texte
- **sessions** : Gestion des sessions

### Fonctionnalités avancées :
- **Index optimisés** pour les performances
- **Triggers automatiques** pour les timestamps
- **Contraintes de clés étrangères** pour l'intégrité
- **Fonctions PostgreSQL** pour les statistiques

## Dépannage

### Erreur de permissions
Si vous obtenez "permission denied", assurez-vous que l'utilisateur a les bonnes permissions (voir section développement local).

### Erreur de connexion
Vérifiez que votre `DATABASE_URL` est correcte dans les variables d'environnement.

### Tables manquantes
Exécutez le script `init.sql` pour créer toutes les tables nécessaires. 