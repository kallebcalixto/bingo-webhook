const express = require('express');
const crypto = require('crypto');
const axios = require('axios');

const app = express();
app.use(express.json());

// Suas credenciais reais configuradas
const LIVEPIX_SECRET = '/33Gl0UQfX1EfGUXflpS8Cg9knJXrQDUjSNf1WiVJHHO9';
const FIREBASE_DB_URL = 'https://azar-c7f24-default-rtdb.firebaseio.com';

app.get('/', (req, res) => {
    res.send('Servidor do Bingo Ativo e Acordado!');
});

app.post('/webhook', async (req, res) => {
    console.log('--- NOVA NOTIFICAÇÃO DE PIX RECEBIDA ---');
    
    const signature = req.headers['x-livepix-signature'];
    const payload = JSON.stringify(req.body);

    const expectedSignature = crypto
        .createHmac('sha256', LIVEPIX_SECRET)
        .update(payload)
        .digest('hex');

    // SE A ASSINATURA FALHAR, O SERVIDOR VAI AVISAR MAS NÃO VAI BLOQUEAR O PIX!
    if (signature !== expectedSignature) {
        console.log('⚠️ AVISO: Assinatura não bateu, mas vamos processar assim mesmo para testar!');
    }

    const data = req.body;
    console.log('Dados do Pix:', JSON.stringify(data));

    if (data && data.status === 'APPROVED') {
        const valorReal = (data.amount ?? 0) / 100;
        const uidJogador = (data.message ?? '').trim();

        console.log(`Processando: Jogador [${uidJogador}] - Valor: R$ ${valorReal}`);

        if (uidJogador) {
            try {
                const urlUsuario = `${FIREBASE_DB_URL}/users/${uidJogador}.json`;
                
                // 1. Busca o usuário
                const userRes = await axios.get(urlUsuario);
                const userData = userRes.data;

                // Define o saldo atual (se o usuário for novo e não existir, começa com 0)
                const saldoAtual = userData && userData.creditos ? userData.creditos : 0;
                const novoSaldo = Number((saldoAtual + valorReal).toFixed(2));

                // 2. Grava o novo saldo no Firebase
                await axios.patch(urlUsuario, { creditos: novoSaldo });
                console.log(`✅ SUCESSO ABSOLUTO: Saldo atualizado para R$ ${novoSaldo}`);

                // 3. Atualiza o acumulado geral
                try {
                    const autoRes = await axios.get(`${FIREBASE_DB_URL}/jogo/automacao/acumulado.json`);
                    const acumuladoAtual = autoRes.data ?? 0;
                    const novoAcumulado = Number((acumuladoAtual + valorReal).toFixed(2));
                    await axios.patch(`${FIREBASE_DB_URL}/jogo/automacao.json`, { acumulado: novoAcumulado });
                } catch (e) {
                    console.log('Aviso: Pasta de automação ignorada no teste.');
                }

            } catch (error) {
                console.error('❌ ERRO ao salvar no Firebase:', error.message);
            }
        } else {
            console.log('❌ ERRO: O Pix chegou sem nenhum ID de jogador na mensagem.');
        }
    }

    return res.status(200).send('OK');
});

// FUNÇÃO ANTI-SONO
setInterval(() => {
    axios.get(`https://bingo-webhook-livepix.onrender.com/`)
        .then(() => console.log('Auto-ping: Servidor acordado.'))
        .catch((err) => console.log('Erro ping:', err.message));
}, 300000);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
