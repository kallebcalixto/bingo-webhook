const express = require('express');
const crypto = require('crypto');
const axios = require('axios');

const app = express();
app.use(express.json());

// Suas credenciais reais configuradas
const LIVEPIX_SECRET = '/33Gl0UQfX1EfGUXflpS8Cg9knJXrQDUjSNf1WiVJHHO9';
// Removeu-se a barra '/' do final para evitar erros de rota no Axios
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

    if (signature !== expectedSignature) {
        console.error('❌ ERRO: Assinatura inválida! O Segredo do Cliente não bate.');
        return res.status(401).send('Assinatura inválida');
    }

    const data = req.body;
    console.log('Dados recebidos do LivePix:', JSON.stringify(data));

    if (data && data.status === 'APPROVED') {
        const valorReal = (data.amount ?? 0) / 100;
        const uidJogador = (data.message ?? '').trim();

        console.log(`Processando: Jogador ID [${uidJogador}] - Valor: R$ ${valorReal}`);

        if (uidJogador) {
            try {
                // 1. Busca ou cria o saldo do jogador
                const urlUsuario = `${FIREBASE_DB_URL}/users/${uidJogador}.json`;
                console.log('Tentando acessar Firebase na URL:', urlUsuario);
                
                const userRes = await axios.get(urlUsuario);
                const userData = userRes.data;

                // Se o usuário limpou o banco e ele ainda não existe, criamos com saldo 0
                const saldoAtual = userData && userData.creditos ? userData.creditos : 0;
                const novoSaldo = Number((saldoAtual + valorReal).toFixed(2));

                // 2. Salva o novo saldo
                await axios.patch(urlUsuario, { creditos: novoSaldo });
                console.log(`✅ SUCESSO: Saldo atualizado no Firebase para R$ ${novoSaldo}`);

                // 3. Atualiza o caixa geral acumulado da rodada
                try {
                    const autoRes = await axios.get(`${FIREBASE_DB_URL}/jogo/automacao/acumulado.json`);
                    const acumuladoAtual = autoRes.data ?? 0;
                    const novoAcumulado = Number((acumuladoAtual + valorReal).toFixed(2));

                    await axios.patch(`${FIREBASE_DB_URL}/jogo/automacao.json`, {
                        acumulado: Array.isArray(novoAcumulado) ? 0 : novoAcumulado
                    });
                } catch (e) {
                    console.log('Aviso: Pasta de automação geral ainda não iniciada.');
                }

            } catch (error) {
                console.error('❌ ERRO ao conectar ou salvar no Firebase:', error.message);
            }
        } else {
            console.warn('⚠️ AVISO: O Pix foi aprovado, mas o campo de Mensagem (UID) veio em branco.');
        }
    }

    return res.status(200).send('OK');
});

// FUNÇÃO SISTEMA ANTI-SONO
setInterval(() => {
    axios.get(`https://bingo-webhook-livepix.onrender.com/`)
        .then(() => console.log('Auto-ping realizado: Mantendo o servidor acordado!'))
        .catch((err) => console.log('Aviso de ping:', err.message));
}, 300000);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
