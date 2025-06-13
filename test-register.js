const bcrypt = require('bcryptjs');
const { Pool } = require('pg');
require('dotenv').config();

// Configuration de la base de données
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function testRegistration() {
    console.log('🔍 Test d\'inscription...');
    
    try {
        // Test de connexion à la base
        console.log('1. Test de connexion à la base de données...');
        const client = await pool.connect();
        console.log('✅ Connexion réussie');
        
        // Test de hachage du mot de passe
        console.log('2. Test de hachage du mot de passe...');
        const password = 'testpassword';
        const hashedPassword = await bcrypt.hash(password, 10);
        console.log('✅ Hachage réussi:', hashedPassword.substring(0, 20) + '...');
        
        // Test d'insertion dans la base
        console.log('3. Test d\'insertion dans la base...');
        const email = `test${Date.now()}@example.com`; // Email unique
        
        const result = await client.query(
            'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email',
            [email, hashedPassword]
        );
        
        console.log('✅ Insertion réussie:', result.rows[0]);
        
        // Test de vérification du mot de passe
        console.log('4. Test de vérification du mot de passe...');
        const isValid = await bcrypt.compare(password, hashedPassword);
        console.log('✅ Vérification:', isValid ? 'Réussie' : 'Échouée');
        
        client.release();
        console.log('🎉 Tous les tests sont passés !');
        
    } catch (error) {
        console.error('❌ Erreur lors du test:', error);
        console.error('Code d\'erreur:', error.code);
        console.error('Message:', error.message);
        
        if (error.code === '23505') {
            console.log('💡 L\'email existe déjà dans la base');
        }
    } finally {
        await pool.end();
    }
}

testRegistration(); 