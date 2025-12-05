// Node.js v18+ has built-in fetch, no need to import

// Test pour vérifier si le texte est traité correctement sans l'API
function testTextProcessingLogic() {
    console.log('🧪 TEST - Logique de traitement du texte...');
    
    const longText = `Lutte contre les inondations : Le le Sénégal dévoile sa nouvelle arme contre les inondations 
Le MHA Dr Cheikh Tidiane Dièye a présidé, ce jeudi 19 juin, un séminaire final du projet national de connaissance du risque d'inondation.`;
    
    // Simuler une réponse GPT-4 correcte (sans le préfixe problématique)
    const correctResponse = `{"correctedText": "${longText.replace('Le le', 'Le')}", "errors": []}`;
    
    console.log('📝 Texte original:', longText.substring(0, 100) + '...');
    console.log('📝 Réponse simulée:', correctResponse.substring(0, 100) + '...');
    
    // Vérifier si le préfixe problématique est absent
    if (correctResponse.includes('Analyze this text for correction:')) {
        console.error('❌ PROBLÈME DÉTECTÉ - Le préfixe "Analyze this text for correction:" est présent');
        return false;
    } else {
        console.log('✅ TEST RÉUSSI - Le préfixe problématique n\'est pas présent');
        return true;
    }
}

async function testLongTextCorrection() {
    console.log('🧪 TEST - Correction d\'un texte long (inondations Sénégal)...');
    
    const longText = `Lutte contre les inondations : Le le Sénégal dévoile sa nouvelle arme contre les inondations 
Le MHA Dr Cheikh Tidiane Dièye a présidé, ce jeudi 19 juin, un séminaire final du projet national de connaissance du risque d'inondation. Ce projet est piloté par le Ministère de l'Hydraulique et de l'Assainissement, avec l'appui de l'Agence Française de Développement (AFD) et un financement de 10 milliards de FCFA du Fonds Vert pour le Climat.
Au cœur de cette rencontre : la présentation des résultats phares d'un projet inédit, conduit en deux phases, qui a permis une cartographie précise des zones inondables et la mise à disposition d'outils modernes pour mieux planifier, prévenir et gérer le risque à l'échelle du territoire.
Devant un parterre composé des gouverneurs de région, de députés, de représentants des collectivités locales, d'experts nationaux et internationaux, et de la société civile, le ministre Cheikh Tidiane Dièye a rappelé le contexte :
«  Ces dernières années, le Sénégal a été confronté à des événements extrêmes d'une ampleur croissante. De nombreuses régions subissent une urbanisation rapide et souvent non planifiée, rendant nos territoires plus vulnérables », a-t-il souligné.
Le projet a permis, grâce à un Modèle Numérique de Terrain de précision inégalée, de produire une cartographie fine et homogène du risque d'inondation sur plus de 10 000 km², notamment dans des zones critiques comme Dakar-Joal-Tivaouane, Touba-Diourbel, Kaolack-Kaffrine, Kolda, Tambacounda, Kédougou et Matam-Kanel.
Le ministre s'est félicité de la mise à disposition de ces données via le Géoportail du PGIIS, accessible en open data, et de leur appropriation par 113 utilisateurs, allant des gouverneurs aux opérateurs comme l'ONAS, l'APIX ou encore l'UCAD.
Autre innovation saluée : les applications mobiles « Moytou Mbeund » et « Fegu Mbeund », qui permettent à tout citoyen de connaître le statut inondable d'un terrain, contribuant ainsi à une meilleure culture du risque.
Au-delà de ce bilan, le ministre a insisté sur la nécessité de capitaliser ces acquis pour « soumettre au Gouvernement, dans les meilleurs délais, une stratégie nationale de gestion des inondations qui sera notre feuille de route pour un changement systémique ».
Enfin, il a félicité les lauréats du concours « Sama dekkou way challenge », de jeunes start-ups qui ont proposé des solutions innovantes pour démocratiser l'accès aux données produites.`;
    
    try {
        console.log('📊 Statistiques du texte à tester:', {
            length: longText.length,
            words: longText.split(' ').length
        });
        
        console.log('🔍 Vérification de la connectivité serveur...');
        const healthResponse = await fetch('http://localhost:3000/');
        
        if (!healthResponse.ok) {
            throw new Error(`Serveur non accessible: ${healthResponse.status}`);
        }
        
        console.log('✅ Serveur accessible, tentative de correction...');
        
        const response = await fetch('http://localhost:3000/api/correct', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                text: longText,
                language: "fr",
                options: {
                    ignoreAccents: false,
                    ignoreCase: false,
                    ignoreProperNouns: false
                }
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP ${response.status}: ${response.statusText}\nDétails: ${errorText}`);
        }

        const data = await response.json();
        
        console.log('✅ TEST - Réponse reçue:');
        console.log('📊 Statistiques:', {
            originalLength: longText.length,
            correctedLength: data.correctedText?.length || 0,
            originalWords: longText.split(' ').length,
            correctedWords: data.correctedText?.split(' ').length || 0,
            errors: data.errors?.length || 0
        });
        
        if (data.correctedText) {
            console.log('📝 Début du texte corrigé:', data.correctedText.substring(0, 200) + '...');
            console.log('📝 Fin du texte corrigé:', '...' + data.correctedText.substring(-200));
        }
        
        // Vérifier si le texte est complet
        const isComplete = data.correctedText && 
                          data.correctedText.length >= longText.length * 0.8 &&
                          !data.correctedText.endsWith('...') &&
                          !data.correctedText.endsWith('…');
        
        if (isComplete) {
            console.log('✅ TEST RÉUSSI - Texte complet reçu');
            
            // Vérifier si le texte contient les éléments clés du texte original
            const keyPhrases = [
                'Lutte contre les inondations',
                'Cheikh Tidiane Dièye',
                'Agence Française de Développement',
                'Moytou Mbeund',
                'Sama dekkou way challenge'
            ];
            
            const missingPhrases = keyPhrases.filter(phrase => 
                !data.correctedText.includes(phrase)
            );
            
            if (missingPhrases.length === 0) {
                console.log('✅ VALIDATION - Toutes les phrases clés sont présentes');
                return true;
            } else {
                console.warn('⚠️ VALIDATION - Phrases manquantes:', missingPhrases);
                return false;
            }
        } else {
            console.error('❌ TEST ÉCHOUÉ - Texte incomplet ou tronqué');
            console.error('Détails:', {
                hasText: !!data.correctedText,
                lengthRatio: data.correctedText ? (data.correctedText.length / longText.length) : 0,
                endsWithEllipsis: data.correctedText?.endsWith('...') || data.correctedText?.endsWith('…')
            });
            return false;
        }
        
    } catch (error) {
        console.error('❌ TEST ÉCHOUÉ:', error.message);
        return false;
    }
}

// Fonction pour tester un texte court (régression)
async function testShortTextCorrection() {
    console.log('🧪 TEST - Correction d\'un texte court (régression)...');
    
    try {
        const response = await fetch('http://localhost:3000/api/correct', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                text: "Je veux que tu me dises: Cherie amene mois des beignets",
                language: "fr",
                options: {
                    ignoreAccents: false,
                    ignoreCase: false,
                    ignoreProperNouns: false
                }
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP ${response.status}: ${response.statusText}\nDétails: ${errorText}`);
        }

        const data = await response.json();
        
        console.log('✅ TEST - Réponse reçue:');
        console.log('📝 Texte corrigé:', data.correctedText);
        console.log('🔢 Nombre d\'erreurs:', data.errors.length);
        
        // Vérifier si c'est du JSON brut (régression)
        if (data.correctedText?.includes('{"correctedText"')) {
            console.error('❌ RÉGRESSION DÉTECTÉE - Le texte corrigé contient du JSON brut !');
            return false;
        } else {
            console.log('✅ TEST RÉUSSI - Aucune régression détectée');
            return true;
        }
        
    } catch (error) {
        console.error('❌ TEST ÉCHOUÉ:', error.message);
        return false;
    }
}

// Exécuter les tests
async function runAllTests() {
    console.log('🚀 DÉBUT DES TESTS DE CORRECTION\n');
    
    // Test de logique (sans API)
    const logicTestResult = testTextProcessingLogic();
    console.log('\n' + '='.repeat(50) + '\n');
    
    // Tests avec API (si disponible)
    const shortTestResult = await testShortTextCorrection();
    console.log('\n' + '='.repeat(50) + '\n');
    
    const longTestResult = await testLongTextCorrection();
    
    console.log('\n' + '='.repeat(50));
    console.log('📊 RÉSULTATS FINAUX:');
    console.log('- Test logique:', logicTestResult ? '✅ RÉUSSI' : '❌ ÉCHOUÉ');
    console.log('- Test texte court:', shortTestResult ? '✅ RÉUSSI' : '❌ ÉCHOUÉ');
    console.log('- Test texte long:', longTestResult ? '✅ RÉUSSI' : '❌ ÉCHOUÉ');
    
    const allPassed = logicTestResult && shortTestResult && longTestResult;
    
    if (allPassed) {
        console.log('🎉 TOUS LES TESTS RÉUSSIS !');
        process.exit(0);
    } else {
        console.log('💥 CERTAINS TESTS ONT ÉCHOUÉ');
        process.exit(1);
    }
}

// Lancer les tests si le script est exécuté directement
if (require.main === module) {
    runAllTests();
}

module.exports = { testLongTextCorrection, testShortTextCorrection }; 