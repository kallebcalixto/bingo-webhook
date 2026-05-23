const express = require('express');
const crypto = require('crypto');
const axios = require('axios');

const app = express();
app.use(express.json());

/*
========================================
MERCADO PAGO CONFIG
========================================
*/

// ACCESS TOKEN DO MERCADO PAGO
const MP_ACCESS_TOKEN = 'APP_USR-4600187372479747-052312-671609e2fc63fac76626413c52cde70-1258641529';

// WEBHOOK SECRET
const MP_WEBHOOK_SECRET = 'MPm7a3arEI63ROyfq1NnmTUcDFo7LEGT';

// FIREBASE
const FIREBASE_DB_URL = 'https://azar-c7f24-default-rtdb.firebaseio.com';

app.get('/', (req, res) => {
    res.send('Servidor Mercado Pago ativo!');
});

/*
========================================
WEBHOOK MERCADO PAGO
========================================
*/
app.post('/webhook', async (req, res) => {

    console.log('--- NOVA NOTIFICAÇÃO MP ---');

    try {

        const paymentId = req.body?.data?.id;

        if (!paymentId) {
            console.log('Pagamento sem ID');
            return res.sendStatus(200);
        }

        console.log('Payment ID:', paymentId);

        /*
        ========================================
        BUSCA PAGAMENTO REAL NO MP
        ========================================
        */
        const paymentResponse = await axios.get(
            `https://api.mercadopago.com/v1/payments/${paymentId}`,
            {
                headers: {
                    Authorization: `Bearer ${MP_ACCESS_TOKEN}`
                }
            }
        );

        const payment = paymentResponse.data;

        console.log('Dados pagamento:', payment);

        /*
        ========================================
        VERIFICA SE FOI APROVADO
        ========================================
        */
        if (payment.status === 'approved') {

            const valorReal = Number(payment.transaction_amount || 0);

            // UID do jogador
            const uidJogador = (payment.external_reference || '').trim();

            console.log(`Jogador: ${uidJogador}`);
            console.log(`Valor: R$ ${valorReal}`);

            if (!uidJogador) {
                console.log('UID não encontrado');
                return res.sendStatus(200);
            }

            /*
            ========================================
            FIREBASE
            ========================================
            */
            try {

                const urlUsuario = `${FIREBASE_DB_URL}/users/${uidJogador}.json`;

                // busca usuário
                const userRes = await axios.get(urlUsuario);
                const userData = userRes.data;

                const saldoAtual =
                    userData && userData.creditos
                        ? userData.creditos
                        : 0;

                const novoSaldo = Number(
                    (saldoAtual + valorReal).toFixed(2)
                );

                // atualiza saldo
                await axios.patch(urlUsuario, {
                    creditos: novoSaldo
                });

                console.log(`✅ Saldo atualizado: R$ ${novoSaldo}`);

                /*
                ========================================
                ACUMULADO
                ========================================
                */
                try {

                    const autoRes = await axios.get(
                        `${FIREBASE_DB_URL}/jogo/automacao/acumulado.json`
                    );

                    const acumuladoAtual = autoRes.data ?? 0;

                    const novoAcumulado = Number(
                        (acumuladoAtual + valorReal).toFixed(2)
                    );

                    await axios.patch(
                        `${FIREBASE_DB_URL}/jogo/automacao.json`,
                        {
                            acumulado: novoAcumulado
                        }
                    );

                } catch (e) {
                    console.log('Erro acumulado:', e.message);
                }

            } catch (error) {
                console.error(
                    'Erro Firebase:',
                    error.message
                );
            }
        }

        return res.sendStatus(200);

    } catch (err) {

        console.error(
            'Erro webhook:',
            err.response?.data || err.message
        );

        return res.sendStatus(500);
    }
});

/*
========================================
ANTI SONO
========================================
*/
setInterval(() => {

    axios
        .get('https://bingo-webhook-livepix.onrender.com/')
        .then(() =>
            console.log('Servidor acordado')
        )
        .catch((err) =>
            console.log('Erro ping:', err.message)
        );

}, 300000);

/*
========================================
START
========================================
*/
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});
