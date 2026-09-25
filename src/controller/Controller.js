const path = require('path');
const supabase = require('../config/supabase.js');

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
            .insert([{ nome_completo: nome, email: email, status_online: true }])
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

// Processa o login de usuario
exports.LoginUser = async (req, res) => {
    try {
        const { email } = req.body;

        const { data: usuarios, error } = await supabase
            .from('usuario')
            .select('*')
            .eq('email', email);

        if (error) {
            console.error('Erro na busca do Supabase:', error);
            return res.status(400).json({ sucesso: false, erro: error.message });
        }

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
        const { codigo, id_usuario } = req.body;

        if (!codigo) {
            return res.status(400).json({ sucesso: false, erro: 'Por favor, informe o código do quadro.' });
        }
        if (!id_usuario) {
            return res.status(400).json({ sucesso: false, erro: 'ID do usuário é obrigatório.' });
        }

        // Busca no Supabase um quadro que tenha esse código exato
        const { data: quadros, error } = await supabase
            .from('quadro')
            .select('*')
            .eq('codigo_projeto', codigo);

        if (error) {
            return res.status(400).json({ sucesso: false, erro: error.message });
        }

        if (!quadros || quadros.length === 0) {
            return res.status(404).json({
                sucesso: false,
                erro: 'Código de quadro inválido. Sala não encontrada!'
            });
        }

        const quadroEncontrado = quadros[0];
        const idQuadro = quadroEncontrado.id_quadro;

        // VERIFICAÇÃO DE SEGURANÇA: Usuário está banido/bloqueado nesta sala?
        const { data: bloqueado } = await supabase
            .from('usuario_bloqueado_quadro')
            .select('*')
            .eq('id_usuario', Number(id_usuario))
            .eq('id_quadro', Number(idQuadro))
            .maybeSingle();

        if (bloqueado) {
            return res.status(403).json({
                sucesso: false,
                erro: 'Acesso negado: Você está bloqueado nesta sala pelo administrador.'
            });
        }

        // Consulta se já existe vínculo na tabela usuario_quadro
        const { data: vinculo, error: errVinculo } = await supabase
            .from('usuario_quadro')
            .select('*')
            .eq('id_usuario', Number(id_usuario))
            .eq('id_quadro', Number(idQuadro))
            .maybeSingle();

        if (errVinculo) {
            return res.status(400).json({ sucesso: false, erro: errVinculo.message });
        }

        // Tratamento do Vínculo
        if (!vinculo) {
            // PRIMEIRO ACESSO: Cria a linha setando como membro comum
            const { error: errInsert } = await supabase
                .from('usuario_quadro')
                .insert([{
                    id_usuario: Number(id_usuario),
                    id_quadro: Number(idQuadro),
                    papel: 'membro',
                    ativo: true
                }]);

            if (errInsert) {
                return res.status(400).json({ sucesso: false, erro: errInsert.message });
            }
        } else if (!vinculo.ativo) {
            // REATIVAÇÃO: Caso já tenha feito parte mas estivesse marcado como inativo
            await supabase
                .from('usuario_quadro')
                .update({ ativo: true, data_saida: null })
                .eq('id_usuario', Number(id_usuario))
                .eq('id_quadro', Number(idQuadro));
        }

        return res.status(200).json({
            sucesso: true,
            mensagem: 'Acesso permitido ao quadro!',
            quadro: quadroEncontrado,
            papel: vinculo ? vinculo.papel : 'membro'
        });

    } catch (err) {
        return res.status(500).json({ sucesso: false, erro: err.message });
    }
};

// Processa a criação de uma nova sala
exports.CreateRoom = async (req, res) => {
    try {
        const {  codigo_sala, nome_sala, colunas, id_usuario } = req.body;

        // Validação básica do array de colunas
        if (!colunas || !Array.isArray(colunas) || colunas.length < 3) {
            return res.status(400).json({
                sucesso: false,
                erro: 'A sala precisa ter pelo menos 3 colunas.'
            });
        }

        // Insere os dados na tabela do Supabase
        const { data : quadro, error } = await supabase
            .from('quadro')
            .insert([{codigo_projeto: codigo_sala, nome_projeto: nome_sala}])
            .select();

        if (error) {
            return res.status(400).json({ sucesso: false, erro: error.message });
        }

        const quadroCriado = quadro[0];

        // Se o id_usuario for enviado, vincula o criador como 'admin' na tabela usuario_quadro
        if (id_usuario) {
            const { error: errVinculo } = await supabase
                .from('usuario_quadro')
                .insert([{
                    id_usuario: Number(id_usuario),
                    id_quadro: quadroCriado.id_quadro,
                    papel: 'admin',
                    ativo: true
                }]);

            if (errVinculo) {
                console.error('Erro ao vincular criador como admin:', errVinculo.message);
            }
        }

        // Prepara o array de colunas para inserir na tabela 'coluna'
        const colunasParaInserir = colunas.map((col, index) => ({
            id_quadro: quadroCriado.id_quadro,
            nome_coluna: col.nome,
            ordem_posicao: col.ordem || (index + 1)
        }));

        // Insere as colunas em lote no Supabase
        const { data: colunasCriadas, error: errorColunas } = await supabase
            .from('coluna')
            .insert(colunasParaInserir)
            .select();

        if (errorColunas) {
            return res.status(400).json({
                sucesso: false,
                erro: 'Quadro criado, mas houve erro ao inserir as colunas: ' + errorColunas.message
            });
        }

        const quadroLogado = quadroCriado

        return res.status(201).json({ sucesso: true, mensagem: 'Quadro e colunas criados com sucesso!!', quadro: quadroLogado });
    } catch (err) {
        return res.status(500).json({ sucesso: false, erro: err.message });
    }
};