#!/bin/bash

# Script de déploiement pour SamaBled sur Render
# Usage: ./deploy.sh "message de commit"

echo "🚀 Déploiement de SamaBled sur Render"
echo "======================================"

# Vérifier si un message de commit est fourni
if [ -z "$1" ]; then
    echo "❌ Erreur: Veuillez fournir un message de commit"
    echo "Usage: ./deploy.sh \"votre message de commit\""
    exit 1
fi

COMMIT_MESSAGE="$1"

echo "📝 Message de commit: $COMMIT_MESSAGE"
echo ""

# Vérifier le statut Git
echo "🔍 Vérification du statut Git..."
git status --porcelain

# Ajouter tous les fichiers modifiés
echo "📦 Ajout des fichiers modifiés..."
git add .

# Créer le commit
echo "💾 Création du commit..."
git commit -m "$COMMIT_MESSAGE"

if [ $? -eq 0 ]; then
    echo "✅ Commit créé avec succès"
else
    echo "⚠️  Aucun changement à commiter ou erreur lors du commit"
fi

# Pousser vers GitHub (déclenchera le redéploiement automatique sur Render)
echo "🌐 Push vers GitHub..."
git push origin main

if [ $? -eq 0 ]; then
    echo "✅ Push réussi vers GitHub"
    echo ""
    echo "🎉 Déploiement en cours sur Render..."
    echo "📱 Surveillez les logs sur: https://dashboard.render.com"
    echo "🌍 Votre app sera disponible sur: https://samabled-app.onrender.com"
else
    echo "❌ Erreur lors du push vers GitHub"
    exit 1
fi

echo ""
echo "✨ Déploiement terminé !" 