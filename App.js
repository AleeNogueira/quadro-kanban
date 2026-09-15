const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware para ler dados enviados por formulários (POST)
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Servir arquivos estáticos da pasta 'public' (CSS, JS, Imagens)
app.use(express.static(path.join(__dirname, 'public')));

// ROTAS DE PÁGINAS

// Rota Principal (Página de Login/Entrar)
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'src', 'viewer', 'index.html'));
});

// Rota para a página de Criar Sala
app.get('/CreateRoom', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'src', 'viewer', 'criar-sala.html'));
});


// ROTAS DE AÇÃO (POST)

// Processar a entrada na sala
app.post('/api/entrar-sala', (req, res) => {
    const { nome, codigo } = req.body;

    // Validação simples
    if (!nome || !codigo) {
        return res.status(400).send('Nome e Código da sala são obrigatórios!');
    }

    console.log(`[LOGIN] Usuário "${nome}" tentando entrar na sala "${codigo}".`);

    // Aqui você pode adicionar a lógica de banco de dados / checagem de sala
    res.send(`Bem-vindo(a), ${nome}! Redirecionando para a sala ${codigo}...`);
});

// Processar a criação de uma nova sala
app.post('/api/criar-sala', (req, res) => {
    const { codigo_sala, nome_sala, descricao } = req.body;

    // Validação simples dos campos obrigatórios
    if (!codigo_sala || !nome_sala) {
        return res.status(400).send('Código e Nome da sala são obrigatórios!');
    }

    console.log(`[CRIAR SALA] Sala "${nome_sala}" (${codigo_sala}) criada. Descrição: ${descricao || 'Nenhuma'}`);

    // Aqui você salva a sala no banco de dados
    res.send(`Sala "${nome_sala}" criada com sucesso! Código: ${codigo_sala}`);
});


// Tratamento de Erro 404 (Página Não Encontrada)
app.use((req, res) => {
    res.status(404).send('<h1>Erro 404 - Página não encontrada</h1>');
});

// Iniciar o Servidor
app.listen(PORT, () => {
    console.log(`🚀 Servidor rodando em: http://localhost:${PORT}`);
});
