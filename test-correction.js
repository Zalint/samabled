const fetch = require('node-fetch');

async function testCorrection() {
    console.log('🧪 TEST - Correction d\'un texte simple...');
    
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
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        
        console.log('✅ TEST - Réponse reçue:');
        console.log('📝 Texte corrigé:', data.correctedText);
        console.log('🔢 Nombre d\'erreurs:', data.errors.length);
        console.log('📊 Structure:', {
            hasCorrectText: !!data.correctedText,
            hasErrors: Array.isArray(data.errors),
            isTextString: typeof data.correctedText === 'string',
            containsJSON: data.correctedText?.includes('{"correctedText"'),
            textLength: data.correctedText?.length
        });
        
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

// Lancer le test
testCorrection().then(success => {
    if (success) {
        console.log('\n🎉 Tous les tests passent !');
        process.exit(0);
    } else {
        console.log('\n💥 Des erreurs ont été détectées !');
        process.exit(1);
    }
}); 