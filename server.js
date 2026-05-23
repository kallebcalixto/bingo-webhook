import express from 'express';
import cors from 'cors';
import { MercadoPagoConfig, Payment } from 'mercadopago';

const app = express();
app.use(express.json());
app.use(cors());

// COLE O SEU TOKEN REAL DO MERCADO PAGO ENTRE AS ASPAS ABAIXO
// Exemplo: 'APP_USR-xxxxxxxxx' ou 'TEST-xxxxxxxxx'
const MEU_TOKEN_MERCADO_PAGO = 'SEU_TOKEN_AQUI'; 

// O sistema tenta ler o Render, se não achar, usa o token fixo que você colou acima
const tokenFinal = process.env.MERCADO_PAGO_TOKEN || MEU_TOKEN_MERCADO_PAGO;

const client = new MercadoPagoConfig({ 
    accessToken: tokenFinal 
});
const payment = new Payment(client);

app.get('/', (req, res) => {
    res.send('Servidor do Bingo Royale rodando perfeitamente!');
});

app.post('/criar-pix', async (req, res) => {
    console.log('--- SOLICITAÇÃO DE GERAÇÃO DE PIX ---');
    const { uid, valor, email } = req.body;

    if (!uid || !valor) {
        return res.status(400).json({ error: 'Dados insuficientes.' });
    }

    try {
        const response = await payment.create({
            body: {
                transaction_amount: Number(valor),
                description: `Recarga Bingo - ID ${uid}`,
                payment_method_id: 'pix',
                payer: {
                    email: email || 'usuario@bingo.com'
                },
                metadata: {
                    user_id: uid
                }
            }
        });
        
        const copiaCola = response.point_of_interaction?.transaction_data?.qr_code;
        const qrCodeBase64 = response.point_of_interaction?.transaction_data?.qr_code_base64;
        
        if (!copiaCola) {
            return res.status(500).json({ error: 'O Mercado Pago nao gerou o texto do Pix.' });
        }

        console.log(`✅ Pix gerado com sucesso: ${uid}`);
        return res.json({ 
            copiaCola: copiaCola,
            qrCodeBase64: qrCodeBase64
        });

    } catch (error) {
        console.error('❌ Erro no Mercado Pago:', error);
        const mensagemErroInterno = error.message || (error.cause && error.cause[0]?.description) || 'Erro na API';
        return res.status(500).json({ 
            error: 'Erro ao gerar Pix', 
            detalhes: mensagemErroInterno 
        });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Servidor rodando na porta ${PORT}`);
});
