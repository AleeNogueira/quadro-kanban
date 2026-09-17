const path = require('path');
const supabase = require('../config/supabase');

//Renderizar a página de Criar usuario
exports.getCreateUser = (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'view', 'index.html'));
};

//Renderizar a página de Login
exports.getLoginPage = (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'view', 'LoginIn.html'));
};

//Renderizar a página entrar na sala
exports.getJoinRoom = (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'view', 'JoinRoom.html'));
}

// Renderiza a página de Criar Sala
exports.getCreateRoomPage = (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'view', 'CreateRoom.html'));
};

//Renderizar a página da Sala
exports.getSalaPage = (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'view', 'Home.html'));
}

// Processa a criação de usuario
exports.CreateUser = async (req, res) => {
    try {
        const { nome, email } = req.body;

        // Insere os dados na tabela do Supabase
        const { data: usuarios, error } = await supabase
            .from('usuario')
            .insert([{ nome: nome, email: email, status_online: true }])
            .select();

        if (error) {
            return res.status(400).json({ sucesso: false, erro: error.message });
        }

        const usuarioLogado = usuarios[0];

        return res.status(201).json({ sucesso: true, mensagem: 'Usuário criado com sucesso!', usuario: usuarioLogado });
    } catch (err) {
        return res.status(500).json({ sucesso: false, erro: err.message });
    }
};

exports.LoginUser = async (req, res) => {
    try {
        const { email } = req.body;

        const { data: usuarios, error } = await supabase
            .from('usuario')
            .select('*')
            .eq('email', email);

        if (error) {
            return res.status(400).json({ sucesso: false, erro: error.message });
        }

        // Se o array de retorno estiver vazio, o usuário não existe
        if (!usuarios || usuarios.length === 0) {
            return res.status(401).json({
                sucesso: false,
                erro: 'Usuário não encontrado. Verifique o e-mail digitado.'
            });
        }

        const usuarioLogado = usuarios[0];

        const { error: updateError } = await supabase
            .from('usuario')
            .update({ status_online: true })
            .eq('id_usuario', usuarioLogado.id_usuario);     // Usa o ID do usuário como filtro

        if (updateError) {
            return res.status(400).json({ sucesso: false, erro: updateError.message });
        }

        // Atualiza a propriedade no objeto local antes de devolver ao front-end
        usuarioLogado.status_online = true;

        // Retorna sucesso e os dados do usuário para o front-end
        return res.status(200).json({
            sucesso: true,
            mensagem: 'Login realizado com sucesso!',
            usuario: usuarioLogado
        });
    } catch (err) {
        return res.status(500).json({ sucesso: false, erro: err.message });
    }
};

// Processa a entrada na sala
exports.JoinRoom = async (req, res) => {
    try {
        const { codigo } = req.body;

        if (!codigo) {
            return res.status(400).json({ sucesso: false, erro: 'Por favor, informe o código do quadro.' });
        }

        // Busca no Supabase um quadro que tenha esse código exato
        const { data: quadros, error } = await supabase
            .from('quadro')
            .select('*')
            .eq('codigo_projeto', codigo);

        if (error) {
            return res.status(400).json({ sucesso: false, erro: error.message });
        }

        // Se não encontrou nenhuma sala com esse código
        if (!quadros || quadros.length === 0) {
            return res.status(404).json({
                sucesso: false,
                erro: 'Código de quadro inválido. Sala não encontrada!'
            });
        }

        const quadroEncontrado = quadros[0];

        return res.status(200).json({
            sucesso: true,
            mensagem: 'Acesso permitido ao quadro!',
            quadro: quadroEncontrado
        });
    } catch (err) {
        return res.status(500).json({ sucesso: false, erro: err.message });
    }
};

// Processa a criação de uma nova sala
exports.CreateRoom = async (req, res) => {
    try {
        const {  codigo_sala, nome_sala, descricao  } = req.body;

        // Insere os dados na tabela do Supabase
        const { data : quadro, error } = await supabase
            .from('quadro') // Nome da sua tabela no Supabase
            .insert([{codigo_projeto: codigo_sala, nome_projeto: nome_sala, descricao: descricao  }])
            .select();

        if (error) {
            return res.status(400).json({ sucesso: false, erro: error.message });
        }

        const quadroLogado = quadro[0]

        return res.status(201).json({ sucesso: true, mensagem: 'Quadro criado com sucesso!', quadro: quadroLogado });
    } catch (err) {
        return res.status(500).json({ sucesso: false, erro: err.message });
    }
};