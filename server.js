/*const http = require('http');
const hostname = '127.0.0.1';
const port = 3000;
const server = http.createServer((req,res) => {
    res.statusCode = 200;
    res.setHeader('Content-Type','text/plain');
    res.end('Olá Mundo Silvio Aquino')
});
server.listen(port,hostname, () => {
    console.log("Servidor Rodando!");
});


const express = require('express');
const app = express();*/
const express = require('express');
const app = express();
const path = require('path');
const router = express.Router();



router.get('/front',function(req,res){
    res.sendFile(path.join(__dirname+'/front.html'));
});

router.get('/teste',function(req,res){
    res.sendFile(path.join(__dirname+'/test-webhook.html'));
});

app.use('/',router);
app.listen(process.env.port || 3000);

/*/ server.js com Prisma*/
// server.js
//const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
require('dotenv').config();

//const app = express();
const PORT = process.env.PORT || 3000;

// Configuração do PostgreSQL (NeonDB)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  },
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Middleware
app.use(cors());
app.use(express.json());

// Função para gerar UUID manualmente
function gerarUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// Testar conexão com o banco
async function testarConexao() {
  try {
    const client = await pool.connect();
    console.log('✅ Conectado ao NeonDB com sucesso!');
    
    // Verificar se as tabelas existem
    const tabelas = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    
    console.log('📊 Tabelas existentes:', tabelas.rows.map(t => t.table_name));
    client.release();
    return true;
  } catch (error) {
    console.error('❌ Erro ao conectar com NeonDB:', error.message);
    return false;
  }
}

// Criar tabelas se não existirem (COM UUID EXPLÍCITO)
async function criarTabelas() {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    // Tabela caixa_abertura - COM UUID EXPLÍCITO
    await client.query(`
      CREATE TABLE IF NOT EXISTS caixa_abertura (
        id UUID PRIMARY KEY,
        data_abertura TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        valor_inicial DECIMAL(10,2) NOT NULL,
        observacao TEXT,
        status TEXT DEFAULT 'ABERTO',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // Tabela vendas - COM UUID EXPLÍCITO
    await client.query(`
      CREATE TABLE IF NOT EXISTS vendas (
        id UUID PRIMARY KEY,
        data_venda TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        dados_pedido JSONB NOT NULL,
        tipo_pagamento TEXT DEFAULT 'PENDENTE',
        valor_total DECIMAL(10,2) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        caixa_abertura_id UUID REFERENCES caixa_abertura(id) ON DELETE CASCADE
      )
    `);

    // Tabela retiradas - COM UUID EXPLÍCITO
    await client.query(`
      CREATE TABLE IF NOT EXISTS retiradas (
        id UUID PRIMARY KEY,
        data_retirada TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        valor DECIMAL(10,2) NOT NULL,
        observacao TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        caixa_abertura_id UUID REFERENCES caixa_abertura(id) ON DELETE CASCADE
      )
    `);

    // Tabela caixa_fechamento - COM UUID EXPLÍCITO
    await client.query(`
      CREATE TABLE IF NOT EXISTS caixa_fechamento (
        id UUID PRIMARY KEY,
        data_fechamento TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        valor_abertura DECIMAL(10,2) NOT NULL,
        total_vendas DECIMAL(10,2) NOT NULL,
        retiradas DECIMAL(10,2) NOT NULL,
        saldo_final DECIMAL(10,2) NOT NULL,
        observacoes TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        caixa_abertura_id UUID REFERENCES caixa_abertura(id) ON DELETE CASCADE
      )
    `);

    // Criar índices
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_caixa_abertura_status ON caixa_abertura(status)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_caixa_abertura_data ON caixa_abertura(data_abertura)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_vendas_data ON vendas(data_venda)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_vendas_caixa ON vendas(caixa_abertura_id)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_retiradas_caixa ON retiradas(caixa_abertura_id)
    `);

    await client.query('COMMIT');
    console.log('✅ Tabelas criadas/verificadas com sucesso!');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Erro ao criar tabelas:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Endpoint para verificar status do caixa
app.get('/caixa/status', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM caixa_abertura WHERE status = 'ABERTO' ORDER BY data_abertura DESC LIMIT 1`
    );

    res.json({
      caixaAberto: result.rows.length > 0,
      caixaAtual: result.rows[0] || null
    });
  } catch (error) {
    console.error('Erro ao verificar status do caixa:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao verificar status do caixa'
    });
  }
});

// Endpoint para abrir caixa (CORRIGIDO)
app.post('/caixa/abrir', async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { valor_inicial, observacao } = req.body;

    // Verificar se já existe caixa aberto
    const caixaAberto = await client.query(
      `SELECT * FROM caixa_abertura WHERE status = 'ABERTO' LIMIT 1`
    );

    if (caixaAberto.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Já existe um caixa aberto'
      });
    }

    // Gerar UUID manualmente
    const caixaId = gerarUUID();
    
    console.log('📝 Tentando abrir caixa com ID:', caixaId);
    
    const result = await client.query(
      `INSERT INTO caixa_abertura (id, valor_inicial, observacao, status) 
       VALUES ($1, $2, $3, 'ABERTO') RETURNING *`,
      [caixaId, valor_inicial, observacao || '']
    );

    console.log('✅ Caixa aberto com sucesso:', result.rows[0].id);

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('❌ Erro ao abrir caixa:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao abrir caixa: ' + error.message
    });
  } finally {
    client.release();
  }
});

// Endpoint para listar vendas
app.get('/vendas', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT 
        v.*,
        c.valor_inicial,
        c.data_abertura
       FROM vendas v
       LEFT JOIN caixa_abertura c ON v.caixa_abertura_id = c.id
       ORDER BY v.data_venda DESC`
    );

    // Converter dados_pedido de string JSON para objeto se necessário
    const vendas = result.rows.map(venda => ({
      ...venda,
      dados_pedido: typeof venda.dados_pedido === 'string' 
        ? JSON.parse(venda.dados_pedido) 
        : venda.dados_pedido
    }));

    res.json({
      success: true,
      data: vendas
    });
  } catch (error) {
    console.error('Erro ao buscar vendas:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar vendas'
    });
  }
});

// Endpoint para listar retiradas de um caixa
app.get('/retiradas/caixa/:caixaId', async (req, res) => {
  try {
    const { caixaId } = req.params;
    
    const result = await pool.query(
      `SELECT * FROM retiradas WHERE caixa_abertura_id = $1 ORDER BY data_retirada DESC`,
      [caixaId]
    );

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Erro ao buscar retiradas:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar retiradas'
    });
  }
});

// Endpoint para registrar retirada (CORRIGIDO)
app.post('/retiradas', async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { valor, observacao, caixa_abertura_id } = req.body;

    const retiradaId = gerarUUID();

    const result = await client.query(
      `INSERT INTO retiradas (id, valor, observacao, caixa_abertura_id) 
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [retiradaId, valor, observacao || '', caixa_abertura_id]
    );

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Erro ao registrar retirada:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao registrar retirada'
    });
  } finally {
    client.release();
  }
});

// Endpoint para atualizar venda
app.put('/vendas/:id', async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { id } = req.params;
    const { tipo_pagamento } = req.body;

    const result = await client.query(
      `UPDATE vendas SET tipo_pagamento = $1, updated_at = NOW() 
       WHERE id = $2 RETURNING *`,
      [tipo_pagamento, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Venda não encontrada'
      });
    }

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Erro ao atualizar venda:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao atualizar venda'
    });
  } finally {
    client.release();
  }
});

// Endpoint para fechar caixa (CORRIGIDO)
app.post('/caixa/fechar', async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const { caixa_abertura_id, observacoes } = req.body;

    // Buscar caixa atual
    const caixaResult = await client.query(
      `SELECT * FROM caixa_abertura WHERE id = $1`,
      [caixa_abertura_id]
    );

    if (caixaResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        message: 'Caixa não encontrado'
      });
    }

    const caixa = caixaResult.rows[0];

    // Buscar vendas do caixa
    const vendasResult = await client.query(
      `SELECT * FROM vendas WHERE caixa_abertura_id = $1`,
      [caixa_abertura_id]
    );

    // Buscar retiradas do caixa
    const retiradasResult = await client.query(
      `SELECT * FROM retiradas WHERE caixa_abertura_id = $1`,
      [caixa_abertura_id]
    );

    // Calcular totais
    const totalVendas = vendasResult.rows.reduce((total, venda) => total + parseFloat(venda.valor_total), 0);
    const totalRetiradas = retiradasResult.rows.reduce((total, retirada) => total + parseFloat(retirada.valor), 0);
    const saldoFinal = parseFloat(caixa.valor_inicial) + totalVendas - totalRetiradas;

    // Gerar UUID para o fechamento
    const fechamentoId = gerarUUID();

    // Criar registro de fechamento
    const fechamentoResult = await client.query(
      `INSERT INTO caixa_fechamento 
       (id, valor_abertura, total_vendas, retiradas, saldo_final, observacoes, caixa_abertura_id) 
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [fechamentoId, caixa.valor_inicial, totalVendas, totalRetiradas, saldoFinal, observacoes || '', caixa_abertura_id]
    );

    // Atualizar caixa para fechado
    await client.query(
      `UPDATE caixa_abertura SET status = 'FECHADO', updated_at = NOW() WHERE id = $1`,
      [caixa_abertura_id]
    );

    await client.query('COMMIT');

    res.json({
      success: true,
      data: fechamentoResult.rows[0]
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Erro ao fechar caixa:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao fechar caixa: ' + error.message
    });
  } finally {
    client.release();
  }
});

// Endpoint do Webhook para receber pedidos do cardapio.ai (CORRIGIDO)
app.post('/webhook/vendas', async (req, res) => {
  console.log('📦 Webhook recebido do cardapio.ai');
  
  try {
    const pedido = req.body;
    
    // Validar dados obrigatórios
    if (!pedido.valor_total || !pedido.produtos || !Array.isArray(pedido.produtos)) {
      return res.status(400).json({
        success: false,
        message: 'Dados do pedido inválidos. valor_total e produtos são obrigatórios.'
      });
    }

    // Verificar se há caixa aberto
    const caixaResult = await pool.query(
      `SELECT * FROM caixa_abertura WHERE status = 'ABERTO' ORDER BY data_abertura DESC LIMIT 1`
    );

    if (caixaResult.rows.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Caixa fechado. Não é possível processar vendas.'
      });
    }

    const caixaAberto = caixaResult.rows[0];

    // Preparar dados para salvar
    const dadosPedido = {
      nome_cliente: pedido.nome_cliente || '',
      telefone_cliente: pedido.telefone_cliente || '',
      tipo_pedido: pedido.tipo_pedido || 'outro',
      endereco_completo: pedido.endereco_completo || '',
      data_hora_pedido: pedido.data_hora_pedido || new Date().toISOString(),
      valor_total: pedido.valor_total,
      produtos: pedido.produtos.map(produto => ({
        nome_produto: produto.nome_produto,
        quantidade: produto.quantidade,
        valor: produto.valor,
        adicionais: produto.adicionais || [],
        complementos: produto.complementos || []
      }))
    };

    // Gerar UUID para a venda
    const vendaId = gerarUUID();

    // Salvar venda no banco de dados
    const vendaResult = await pool.query(
      `INSERT INTO vendas 
       (id, data_venda, dados_pedido, tipo_pagamento, valor_total, caixa_abertura_id) 
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [
        vendaId,
        new Date(pedido.data_hora_pedido) || new Date(),
        dadosPedido,
        pedido.tipo_pagamento || 'PENDENTE',
        pedido.valor_total,
        caixaAberto.id
      ]
    );

    console.log('✅ Venda salva com sucesso:', vendaResult.rows[0].id);
    
    res.status(200).json({
      success: true,
      message: 'Pedido processado com sucesso',
      venda_id: vendaResult.rows[0].id
    });

  } catch (error) {
    console.error('❌ Erro no webhook:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor: ' + error.message
    });
  }
});

// Health check
app.get('/health', async (req, res) => {
  const dbConnected = await testarConexao();
  
  res.status(200).json({
    status: 'online',
    database: dbConnected ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString()
  });
});

// Rota simples para teste
app.get('/', (req, res) => {
  res.json({
    message: '🚀 Servidor PDV funcionando com NeonDB!',
    endpoints: {
      webhook: 'POST /webhook/vendas',
      caixa: {
        status: 'GET /caixa/status',
        abrir: 'POST /caixa/abrir',
        fechar: 'POST /caixa/fechar'
      },
      vendas: 'GET /vendas',
      retiradas: 'POST /retiradas'
    },
    timestamp: new Date().toISOString()
  });
});

// Iniciar servidor
app.listen(PORT, async () => {
  console.log(`🚀 Servidor webhook rodando na porta ${PORT}`);
  console.log(`📍 Webhook URL: http://localhost:${PORT}/webhook/vendas`);
  console.log(`❤️  Health Check: http://localhost:${PORT}/health`);
  console.log(`🏠 Página inicial: http://localhost:${PORT}/`);
  
  // Testar conexão com o banco
  const conectado = await testarConexao();
  
  if (conectado) {
    // Criar tabelas se necessário
    await criarTabelas();
  } else {
    console.log('⚠️  Servidor rodando sem conexão com o banco');
  }
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('🛑 Desconectando do banco de dados...');
  await pool.end();
  process.exit(0);
});