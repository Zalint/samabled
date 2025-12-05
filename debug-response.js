// Simple debug script to examine the server response
// Using built-in fetch (Node.js 18+)

async function debugResponse() {
    try {
        const response = await fetch('http://localhost:3000/api/correct', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                text: `Lutte contre les inondations : Le le Sénégal dévoile sa nouvelle arme contre les inondations 
Le MHA Dr Cheikh Tidiane Dièye a présidé, ce jeudi 19 juin, un séminaire final du projet national de connaissance du risque d'inondation. Ce projet est piloté par le Ministère de l'Hydraulique et de l'Assainissement, avec l'appui de l'Agence Française de Développement (AFD) et un financement de 10 milliards de FCFA du Fonds Vert pour le Climat.
Au cœur de cette rencontre : la présentation des résultats phares d'un projet inédit, conduit en deux phases, qui a permis une cartographie précise des zones inondables et la mise à disposition d'outils modernes pour mieux planifier, prévenir et gérer le risque à l'échelle du territoire.
Devant un parterre composé des gouverneurs de région, de députés, de représentants des collectivités locales, d'experts nationaux et internationaux, et de la société civile, le ministre Cheikh Tidiane Dièye a rappelé le contexte :
«  Ces dernières années, le Sénégal a été confronté à des événements extrêmes d'une ampleur croissante. De nombreuses régions subissent une urbanisation rapide et souvent non planifiée, rendant nos territoires plus vulnérables », a-t-il souligné.
Le projet a permis, grâce à un Modèle Numérique de Terrain de précision inégalée, de produire une cartographie fine et homogène du risque d'inondation sur plus de 10 000 km², notamment dans des zones critiques comme Dakar-Joal-Tivaouane, Touba-Diourbel, Kaolack-Kaffrine, Kolda, Tambacounda, Kédougou et Matam-Kanel.
Le ministre s'est félicité de la mise à disposition de ces données via le Géoportail du PGIIS, accessible en open data, et de leur appropriation par 113 utilisateurs, allant des gouverneurs aux opérateurs comme l'ONAS, l'APIX ou encore l'UCAD.
Autre innovation saluée : les applications mobiles « Moytou Mbeund » et « Fegu Mbeund », qui permettent à tout citoyen de connaître le statut inondable d'un terrain, contribuant ainsi à une meilleure culture du risque.
Au-delà de ce bilan, le ministre a insisté sur la nécessité de capitaliser ces acquis pour « soumettre au Gouvernement, dans les meilleurs délais, une stratégie nationale de gestion des inondations qui sera notre feuille de route pour un changement systémique ».
Enfin, il a félicité les lauréats du concours « Sama dekkou way challenge », de jeunes start-ups qui ont proposé des solutions innovantes pour démocratiser l'accès aux données produites.`,
                language: "fr",
                options: {
                    ignoreAccents: false,
                    ignoreCase: false,
                    ignoreProperNouns: false
                }
            })
        });

        const data = await response.json();
        
        console.log('=== DEBUG RESPONSE ===');
        console.log('Response status:', response.status);
        console.log('Response headers:', response.headers);
        console.log('Raw JSON response:', JSON.stringify(data, null, 2));
        console.log('correctedText type:', typeof data.correctedText);
        console.log('correctedText length:', data.correctedText?.length);
        console.log('correctedText sample:', data.correctedText?.substring(0, 200));
        console.log('Contains "correctedText":', data.correctedText?.includes('"correctedText"'));
        console.log('Contains repeated commas:', data.correctedText?.includes(',,,,'));
        
    } catch (error) {
        console.error('Debug error:', error);
    }
}

debugResponse(); 