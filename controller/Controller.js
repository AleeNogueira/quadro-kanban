const path = require('path');

// Renderiza a página de Login (index.html)
exports.getLoginPage = (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'src', 'viewer', 'index.html'));
};

// Renderiza a página de Criar Sala
exports.getCreateRoomPage = (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'src', 'viewer', 'CreateRoom.html'));
};

// Processa a entrada na sala
exports.entrarSala = (req, res) => {
    const { nome, codigo } = req.body;

    if (!nome || !codigo) {
        return res.status(400).send('Nome e Código da sala são obrigatórios!');
    }

    console.log(`[LOGIN] Usuário "${nome}" tentando entrar na sala "${codigo}".`);
    res.send(`Bem-vindo(a), ${nome}! Redirecionando para a sala ${codigo}...`);
};

// Processa a criação de uma nova sala
exports.criarSala = (req, res) => {
    const { codigo_sala, nome_sala, descricao } = req.body;

    if (!codigo_sala || !nome_sala) {
        return res.status(400).send('Código e Nome da sala são obrigatórios!');
    }

    console.log(`[CRIAR SALA] Sala "${nome_sala}" (${codigo_sala}) criada. Descrição: ${descricao || 'Nenhuma'}`);
    res.send(`Sala "${nome_sala}" criada com sucesso! Código: ${codigo_sala}`);
};