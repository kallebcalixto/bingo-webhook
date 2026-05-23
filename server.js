const express = require('express');
const cors = require('cors');
const axios = require('axios');
const { MercadoPagoConfig, Payment } = require('mercadopago');

const app = express();

// Ativa o CORS para permitir que o GitHub Pages converse com o Render sem bloqueios
app.use(cors());
app.use(express.json());

// CONFIGURAÇÃO DO MERCADO PAGO
// Cole o seu Access Token de Produção dentro das aspas abaixo
const MP_ACCESS_TOKEN = 'SEU_ACCESS_TOKEN_AQUI'; 
const client = new MercadoPagoConfig({ accessToken: MP_ACCESS_TOKEN });
const payment = new Payment(client);

// URL do seu banco de dados Firebase
const FIREBASE_DB_URL = 'https://azar-c7f24-default-rtdb.firebaseio.com';

app.get('/', (req, res) => {
    res.send('Servidor do Bingo com Mercado Pago Ativo!');
});

// 1. ROTA QUE CRIA O PIX COPIA E COLA
app.post('/criar-pix', async (req, res) => {
    console.log('--- SOLICITAÇÃO DE GERAÇÃO DE PIX ---');
    const { uid, valor, email } = req.body;

    if (!uid || !valor) {
        return res.status(400).json({ error: 'Dados insuficientes.' });
    }

    try {
        const body = {
            transaction_amount: Number(valor),
            description: `Recarga Bingo - ID ${uid}`,
            payment_method_id: 'pix',
            payer: {
                email: email || 'usuario@bingo.com'
            },
            // Guarda o ID do jogador dentro da transação para o Mercado Pago devolver depois
            metadata: {
                user_id: uid
            }
        };

        const response = await payment.create({ body });
        
        const copiaCola = response.point_of_interaction.transaction_data.qr_code;
        console.log(`✅ Pix criado com sucesso para o jogador: ${uid}`);

        return res.json({ copiaCola });

    } catch (error) {
        console.error('❌ Erro ao criar cobrança no Mercado Pago:', error.message);
        return res.status(500).json({ error: 'Erro ao gerar Pix' });
    }
});

// 2. WEBHOOK DO MERCADO PAGO (AVISA QUANDO O PIX FOI PAGO)
app.post('/webhook', async (req, res) => {
    console.log('--- NOTIFICAÇÃO DE PAGAMENTO RECEBIDA ---');
    
    // O Mercado Pago avisa eventos de 'payment'
    if (req.query.type === 'payment' || req.body.type === 'payment') {
        const idPagamento = req.query['data.id'] || req.body.data.id;
        console.log(`Verificando pagamento ID: ${idPagamento}`);

        try {
            // Busca os detalhes reais do pagamento diretamente no Mercado Pago
            const pagInfo = await payment.get({ id: idPagamento });
            
            if (pagInfo.status === 'approved') {
                const valorReal = pagInfo.transaction_amount;
                const uidJogador = pagInfo.metadata.user_id;

                console.log(`💰 APROVADO! Jogador: [${uidJogador}] - Valor: R$ ${valorReal}`);

                if (uidJogador) {
                    const urlUsuario = `${FIREBASE_DB_URL}/users/${uidJogador}.json`;
                    
                    // Busca o saldo atual do jogador no Firebase
                    const userRes = await axios.get(urlUsuario);
                    const userData = userRes.data;

                    const saldoAtual = userData && userData.creditos ? userData.creditos : 0;
                    const novoSaldo = Number((saldoAtual + valorReal).toFixed(2));

                    // Atualiza os créditos no banco de dados
                    await axios.patch(urlUsuario, { creditos: novoSaldo });
                    console.log(`✅ Saldo atualizado no Firebase para R$ ${novoSaldo}`);
                }
            }
        } catch (error) {
            console.error('❌ Erro ao processar o webhook:', error.message);
        }
    }

    // Responde 200 OK para o Mercado Pago não ficar repetindo o aviso
    return res.status(200).send('OK');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
