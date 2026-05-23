import express from 'express';
import cors from 'cors';
import { MercadoPagoConfig, Payment } from 'mercadopago';

const app = express();
app.use(express.json());
app.use(cors());

// CONFIGURAÇÃO SEGURO DO CLIENT DO MERCADO PAGO V2
// Certifique-se de que a variável de ambiente MERCADO_PAGO_TOKEN está configurada no painel do Render
const client = new MercadoPagoConfig({ 
    accessToken: process.env.MERCADO_PAGO_TOKEN || 'APP_USR-458222214312-TESTE-EXEMPLO' 
});
const payment = new Payment(client);

app.get('/', (req, res) => {
    res.send('Servidor do Bingo Royale rodando perfeitamente!');
});

// ROTA ULTRA-BLINDADA PARA GERAÇÃO DO PIX
app.post('/criar-pix', async (req, res) => {
    console.log('--- NOVA TENTATIVA DE GERAÇÃO DE PIX ---');
    const { uid, valor, email } = req.body;

    if (!uid || !valor) {
        console.error('❌ Falha: uid ou valor ausentes na requisição.');
        return res.status(400).json({ error: 'Dados insuficientes enviados pelo front-end.' });
    }

    try {
        const dadosPagamento = {
            body: {
                transaction_amount: Number(valor),
                description: `Recarga Bingo - Jogador ${uid}`,
                payment_method_id: 'pix',
                payer: {
                    email: email || 'usuario.bingo@gmail.com'
                },
                metadata: {
                    user_id: uid
                }
            }
        };

        console.log(`Enviando dados ao Mercado Pago para o valor de R$ ${valor}...`);
        const response = await payment.create(dadosPagamento);
        
        // Coleta os dados independente do nível de aninhamento retornado pelo SDK
        const copiaCola = response.point_of_interaction?.transaction_data?.qr_code;
        const qrCodeBase64 = response.point_of_interaction?.transaction_data?.qr_code_base64;
        
        if (!copiaCola) {
            console.error('❌ Resposta inválida do Mercado Pago (Chave Copia e Cola ausente):', JSON.stringify(response));
            return res.status(500).json({ error: 'O Mercado Pago respondeu, mas não gerou o código Pix.' });
        }

        console.log(`✅ Pix gerado com sucesso para o ID: ${uid}`);
        return res.json({ 
            copiaCola: copiaCola,
            qrCodeBase64: qrCodeBase64
        });

    } catch (error) {
        // ESSA SEÇÃO FOI ATUALIZADA PARA ENVIAR O ERRO REAL PARA A UI DO JOGO
        console.error('❌ ERRO DETALHADO NO MERCADO PAGO:', error);
        
        // Extrai a mensagem de erro interna do Mercado Pago, se houver
        const mensagemErroInterno = error.message || (error.cause && error.cause[0]?.description) || 'Erro interno na API do MP';
        
        return res.status(500).json({ 
            error: 'Erro ao gerar Pix', 
            detalhes: mensagemErroInterno 
        });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Servidor integrado rodando com sucesso na porta ${PORT}`);
});
