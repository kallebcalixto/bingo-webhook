const express = require('express');
const crypto = require('crypto');
const axios = require('axios');

const app = express();
app.use(express.json());

// Suas credenciais reais configuradas
const LIVEPIX_SECRET = '/33Gl0UQfX1EfGUXflpS8Cg9knJXrQDUjSNf1WiVJHHO9';
const FIREBASE_DB_URL = 'https://azar-c7f24-default-rtdb.firebaseio.com/';

app.post('/webhook', async (req, res) => {
    const signature = req.headers['x-livepix-signature'];
    const payload = JSON.stringify(req.body);

    // Validação de segurança obrigatória do LivePix
    const expectedSignature = crypto
        .createHmac('sha256', LIVEPIX_SECRET)
        .update(payload)
        .digest('hex');

    if (signature !== expectedSignature) {
        return res.status(401).send('Assinatura inválida');
    }

    const data = req.body;

    // Se o Pix foi aprovado com sucesso
    if (data && data.status === 'APPROVED') {
        const valorReal = (data.amount ?? 0) / 100;
        const uidJogador = (data.message ?? '').trim();

        if (uidJogador) {
            try {
                // 1. Busca o saldo atual do jogador no Firebase
                const userRes = await axios.get(`${FIREBASE_DB_URL}users/${uidJogador}.json`);
                const userData = userRes.data;

                if (userData) {
                    const saldoAtual = userData.creditos ?? 0;
                    const novoSaldo = saldoAtual + valorReal;

                    // 2. Injeta o novo saldo na conta do jogador
                    await axios.patch(`${FIREBASE_DB_URL}users/${uidJogador}.json`, {
                        creditos: novoSaldo
                    });

                    // 3. Atualiza o caixa geral acumulado da rodada
                    const autoRes = await axios.get(`${FIREBASE_DB_URL}jogo/automacao/acumulado.json`);
                    const acumuladoAtual = autoRes.data ?? 0;
                    const novoAcumulado = acumuladoAtual + valorReal;

                    await axios.patch(`${FIREBASE_DB_URL}jogo/automacao.json`, {
                        acumulado: Array.isArray(novoAcumulado) ? 0 : novoAcumulado
                    });
                }
            } catch (error) {
                console.error('Erro ao atualizar Firebase:', error.message);
            }
        }
    }

    return res.status(200).send('OK');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));