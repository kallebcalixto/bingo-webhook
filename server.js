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
            metadata: {
                user_id: uid
            }
        };

        const response = await payment.create({ body });
        
        // CORREÇÃO AQUI: Garante o caminho exato do dado no SDK v2
        const copiaCola = response.point_of_interaction?.transaction_data?.qr_code;
        
        if (!copiaCola) {
            console.error('Estrutura de resposta inesperada:', JSON.stringify(response));
            return res.status(500).json({ error: 'Formato de Pix inválido' });
        }

        console.log(`✅ Pix criado com sucesso para o jogador: ${uid}`);
        return res.json({ copiaCola });

    } catch (error) {
        console.error('❌ Erro ao criar cobrança no Mercado Pago:', error.message);
        return res.status(500).json({ error: 'Erro ao gerar Pix' });
    }
});
