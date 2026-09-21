const { WebSocketServer, WebSocket } = require('ws');
const supabase = require('../config/supabase');

const state = {
    users: new Map(), // ws -> { id_user, nome_user, avatar }
    room: new Map(),  // ws -> { id_room, nome_quadro, codigo }
};

function getOnlineUsers(idQuadro) {
    const users = [];
    state.users.forEach((user, clientWs) => {
        const clientRoom = state.room.get(clientWs);
        // Retorna apenas os usuários conectados no MESMO quadro
        if (user && clientRoom && clientRoom.id_room === idQuadro) {
            users.push({
                id_user: user.id_user,
                nome_user: user.nome_user,
                avatar: user.avatar
            });
        }
    });
    return users;
}

// Broadcast isolado por sala
function broadcastRoom(wss, idQuadro, message) {
    const payload = JSON.stringify(message);
    wss.clients.forEach((client) => {
        const clientRoom = state.room.get(client);
        if (client.readyState === WebSocket.OPEN && clientRoom && clientRoom.id_room === idQuadro) {
            client.send(payload);
        }
    });
}

async function registrarEBroadcastLog(wss, roomId, userId, tipoEvento, detalheTexto) {
    const timestamp = new Date().toISOString();

    try {
        await supabase
            .from('log_atividade_ws')
            .insert([{
                id_quadro: Number(roomId),
                id_usuario: userId ? Number(userId) : null,
                tipo_evento: tipoEvento,
                detalhes_payload: detalheTexto,
                timestamp_evento: timestamp
            }]);
    } catch (err) {
        console.error('Erro ao persistir em log_atividade_ws:', err);
    }

    broadcastRoom(wss, roomId, {
        type: 'NEW_LOG',
        payload: {
            tipo_evento: tipoEvento,
            detalhes_payload: detalheTexto,
            timestamp_evento: timestamp
        }
    });
}

function setupWebSocket(server) {
    const wss = new WebSocketServer({ server });

    console.log('⚡ Servidor WebSocket em standby');

    wss.on('connection', (ws) => {
        let currentUser = null;
        let currentRoom = null;

        ws.on('message', async (message) => {
            try {
                const { type, payload } = JSON.parse(message);

                if (type === 'JOIN_ROOM') {
                    const { usuario, sala } = payload;

                    // Tratamento unificado do ID do Quadro
                    const idQuadro = Number(sala?.id_quadro || sala?.id);
                    const idUsuario = usuario?.id_usuario || usuario?.id || usuario?.id_user;

                    if (!idQuadro || isNaN(idQuadro)) {
                        console.error('Erro: ID do quadro inválido:', sala);
                        ws.send(JSON.stringify({
                            type: 'ERROR',
                            payload: { message: 'ID do quadro não identificado na sala.' }
                        }));
                        return;
                    }

                    // 1. Instancia usuário e sala da sessão
                    const nomeCompleto = usuario?.nome_completo || usuario?.nome || usuario?.nome_user || 'Usuário';
                    currentUser = {
                        id_user: idUsuario,
                        nome_user: nomeCompleto,
                        avatar: (nomeCompleto).substring(0, 2).toUpperCase()
                    };
                    state.users.set(ws, currentUser);

                    currentRoom = {
                        id_room: idQuadro,
                        nome_quadro: sala?.nome_projeto || sala?.nome || 'Kanban',
                        codigo: sala?.codigo_projeto || sala?.codigo
                    };
                    state.room.set(ws, currentRoom);

                    // 2. Atualiza status no banco (se ID do usuário for válido)
                    if (idUsuario && !isNaN(Number(idUsuario))) {
                        await supabase
                            .from('usuario')
                            .update({ status_online: true })
                            .eq('id_usuario', Number(idUsuario));
                    }

                    let rolePerfil = 'membro';
                    try {
                        const { data: relacao, error: errPerfil} = await supabase
                            .from('usuario_quadro')
                            .select('*')
                            .eq('id_usuario', Number(idUsuario))
                            .eq('id_quadro', Number(idQuadro))
                            .single(); // Retorna o objeto direto em vez de um Array

                        if (errPerfil) {
                            console.error('Erro na consulta usuario_quadro:', errPerfil);
                        } else if (relacao) {
                            rolePerfil = relacao.papel;
                        }
                    } catch (err) {
                        console.error('Erro ao buscar perfil:', err);
                    }

                    // 3. Busca no Supabase as colunas com suas respectivas tarefas
                    const { data: colunas, error: errCol } = await supabase
                        .from('coluna')
                        .select(`
                        id_coluna,
                        nome_coluna,
                        ordem_posicao,
                        cartao_tarefa (
                            id_tarefa,
                            titulo,
                            descricao,
                            prioridade,
                            ordem_card,
                            bloqueado_edicao,
                            id_usuario_bloqueio,
                            id_usuario_responsavel,
                            usuario:id_usuario_responsavel ( nome_completo )
                        )
                    `)
                    .eq('id_quadro', currentRoom.id_room)
                    .order('ordem_posicao', { ascending: true });

                    const { data: logs } = await supabase
                        .from('log_atividade_ws')
                        .select('tipo_evento, detalhes_payload, timestamp_evento')
                        .eq('id_quadro', currentRoom.id_room)
                        .order('timestamp_evento', { ascending: false })
                        .limit(30);

                    if (errCol) {
                        console.error('Erro ao buscar estado do quadro:', errCol);
                    }

                    // 4. Envia o INITIAL_STATE completo para o cliente recém-conectado
                    ws.send(JSON.stringify({
                        type: 'INITIAL_STATE',
                        payload: {
                            columns: colunas || [],
                            users: getOnlineUsers(currentRoom.id_room),
                            perfil: rolePerfil,
                            logs: logs || []
                        }
                    }));

                    // 5. Notifica apenas os participantes do mesmo quadro
                    broadcastRoom(wss, currentRoom.id_room, {
                        type: 'USERS_UPDATE',
                        payload: {
                            users: getOnlineUsers(currentRoom.id_room),
                            msg: `${currentUser.nome_user} entrou no Kanban!`
                        }

                    });
                    // 6. REGISTRA O LOG NO BANCO E TRANSMITE VIA BROADCAST
                    await registrarEBroadcastLog(
                        wss,
                        currentRoom.id_room,
                        idUsuario,
                        'USER_JOINED',
                        `${currentUser.nome_user} entrou na sala`
                    );
                }

                if (type === 'CREATE_TASK') {
                    const { titulo, descricao, id_usuario_responsavel, prioridade, id_coluna } = payload;

                    if (!titulo || !id_coluna) {
                        ws.send(JSON.stringify({
                            type: 'ERROR',
                            payload: { message: 'Título e id_coluna são obrigatórios para criar uma tarefa.' }
                        }));
                        return;
                    }

                    try {
                        const { data: novaTarefa, error } = await supabase
                            .from('cartao_tarefa')
                            .insert([{
                                titulo,
                                descricao: descricao || null,
                                id_usuario_responsavel: id_usuario_responsavel || null,
                                prioridade: prioridade || 'Média',
                                id_coluna,
                                ordem_card: 0,
                                bloqueado_edicao: false
                            }])
                            .select(`
                                *,
                                usuario:id_usuario_responsavel ( nome_completo )
                            `)
                            .single();

                        if (error) {
                            console.error('Erro ao inserir tarefa no Supabase:', error);
                            ws.send(JSON.stringify({
                                type: 'ERROR',
                                payload: { message: 'Erro ao salvar a tarefa no banco de dados.' }
                            }));
                            return;
                        }

                        // Emite o Broadcast apenas para a sala atual usando nome_user corrigido
                        const roomId = currentRoom ? currentRoom.id_room : null;
                        const task = novaTarefa.titulo;
                        if (roomId) {
                            broadcastRoom(wss, roomId, {
                                type: 'TASK_CREATED',
                                payload: {
                                    task: novaTarefa,
                                    user: currentUser ? currentUser.nome_user : 'Um usuário'
                                }
                            });
                            await registrarEBroadcastLog(
                                wss, roomId, currentUser?.id_user, 'CREATE_TASK',
                                `${currentUser.nome_user} criou a tarefa "${task}"`
                            );
                        }

                    } catch (err) {
                        console.error('Erro inesperado no CREATE_TASK:', err);
                    }
                }

                if (type === 'MOVE_TASK') {
                    const { id_tarefa, id_coluna } = payload;

                    if (!id_tarefa || !id_coluna) {
                        return;
                    }

                    try {
                        // 1. Atualiza a coluna da tarefa no Supabase
                        const { error } = await supabase
                            .from('cartao_tarefa')
                            .update({
                                id_coluna: Number(id_coluna),
                                bloqueado_edicao: false,
                                id_usuario_bloqueio: null
                            })
                            .eq('id_tarefa', Number(id_tarefa));

                        if (error) {
                            console.error('Erro ao mover tarefa no Supabase:', error);
                            return;
                        }

                        // 2. Retransmite o evento CARD_MOVED para todos os conectados da sala
                        const roomId = currentRoom ? currentRoom.id_room : null;
                        if (roomId) {
                            broadcastRoom(wss, roomId, {
                                type: 'CARD_MOVED',
                                payload: {
                                    id_tarefa,
                                    id_coluna,
                                    user: currentUser ? currentUser.nome_user : 'Um usuário'
                                }
                            });
                            await registrarEBroadcastLog(
                                wss, roomId, currentUser?.id_user, 'MOVE_TASK',
                                `${currentUser.nome_user} moveu a tarefa #${id_tarefa}`
                            );
                        }

                    } catch (err) {
                        console.error('Erro ao processar MOVE_TASK:', err);
                    }
                }
                if (type === 'START_MOVE_TASK') {
                    const { id_tarefa } = payload;
                    const roomId = currentRoom ? currentRoom.id_room : null;

                    if (id_tarefa) {
                        await supabase
                            .from('cartao_tarefa')
                            .update({ bloqueado_edicao: true, id_usuario_bloqueio: currentUser.id_user })
                            .eq('id_tarefa', Number(id_tarefa));
                    }

                    if (roomId && id_tarefa) {
                        // Envia para todos da sala que o cartão começou a ser arrastado
                        broadcastRoom(wss, roomId, {
                            type: 'TASK_MOVING',
                            payload: {
                                id_tarefa,
                                user: currentUser ? currentUser.nome_user : 'Um usuário'
                            }
                        });
                    }
                }
                if (type === 'STOP_MOVE_TASK') {
                    const { id_tarefa } = payload;
                    const roomId = currentRoom ? currentRoom.id_room : null;

                    if (id_tarefa) {
                        await supabase
                            .from('cartao_tarefa')
                            .update({ bloqueado_edicao: false, id_usuario_bloqueio: null })
                            .eq('id_tarefa', Number(id_tarefa));
                    }

                    if (roomId && id_tarefa) {
                        broadcastRoom(wss, roomId, {
                            type: 'TASK_STOPPED_MOVING',
                            payload: { id_tarefa }
                        });
                    }
                }

                if (type === 'DELETE_TASK') {
                    const { id_tarefa } = payload;

                    if (!id_tarefa) return;

                    try {
                        // 1. Remove do banco no Supabase
                        const { error } = await supabase
                            .from('cartao_tarefa')
                            .delete()
                            .eq('id_tarefa', Number(id_tarefa));

                        if (error) {
                            console.error('Erro ao excluir tarefa do Supabase:', error);
                            ws.send(JSON.stringify({
                                type: 'ERROR',
                                payload: { message: 'Erro ao excluir tarefa no banco de dados.' }
                            }));
                            return;
                        }

                        // 2. Transmite a ordem de remoção visual para a sala
                        const roomId = currentRoom ? currentRoom.id_room : null;
                        if (roomId) {
                            broadcastRoom(wss, roomId, {
                                type: 'TASK_DELETED',
                                payload: {
                                    id_tarefa: Number(id_tarefa),
                                    user: currentUser ? currentUser.nome_user : 'Um usuário'
                                }
                            });
                            await registrarEBroadcastLog(
                                wss, roomId, currentUser?.id_user, 'DELETE_TASK',
                                `${currentUser.nome_user} excluiu a tarefa #${id_tarefa}`
                            );
                        }

                    } catch (err) {
                        console.error('Erro ao processar DELETE_TASK:', err);
                    }
                }
                if (type === 'UPDATE_TASK') {
                    const { id_tarefa, titulo, descricao, prioridade, id_usuario_responsavel } = payload;

                    if (!id_tarefa || !titulo) return;

                    try {
                        const { data: tarefaAtualizada, error } = await supabase
                            .from('cartao_tarefa')
                            .update({
                                titulo,
                                descricao: descricao || null,
                                prioridade: prioridade || 'Média',
                                id_usuario_responsavel: id_usuario_responsavel || null,
                                bloqueado_edicao: false,
                                id_usuario_bloqueio: null
                            })
                            .eq('id_tarefa', Number(id_tarefa))
                            .select(`
                            *,
                            usuario:id_usuario_responsavel ( nome_completo )
                        `)
                            .single();

                        if (error) {
                            console.error('Erro ao atualizar tarefa no Supabase:', error);
                            return;
                        }

                        const roomId = currentRoom ? currentRoom.id_room : null;
                        if (roomId) {
                            broadcastRoom(wss, roomId, {
                                type: 'TASK_UPDATED',
                                payload: {
                                    task: tarefaAtualizada,
                                    user: currentUser ? currentUser.nome_user : 'Um usuário'
                                }
                            });
                            await registrarEBroadcastLog(
                                wss, roomId, currentUser?.id_user, 'UPDATE_TASK',
                                `${currentUser.nome_user} alterou a tarefa "${tarefaAtualizada.titulo}"`
                            );
                        }

                    } catch (err) {
                        console.error('Erro ao processar UPDATE_TASK:', err);
                    }
                }
                if (type === 'START_EDIT_TASK') {
                    const { id_tarefa } = payload;
                    const roomId = currentRoom ? currentRoom.id_room : null;
                    const userId = currentUser ? Number(currentUser.id_user) : null;

                    if (id_tarefa) {
                        // Atualiza a trava no banco
                        await supabase
                            .from('cartao_tarefa')
                            .update({
                                bloqueado_edicao: true,
                                id_usuario_bloqueio: userId
                            })
                            .eq('id_tarefa', Number(id_tarefa));
                    }

                    if (roomId && id_tarefa) {
                        broadcastRoom(wss, roomId, {
                            type: 'TASK_EDITING',
                            payload: {
                                id_tarefa,
                                user: currentUser ? currentUser.nome_user : 'Um usuário'
                            }
                        });
                    }
                }
                if (type === 'STOP_EDIT_TASK') {
                    const { id_tarefa } = payload;
                    const roomId = currentRoom ? currentRoom.id_room : null;

                    if (id_tarefa) {
                        // Libera a trava no banco
                        await supabase
                            .from('cartao_tarefa')
                            .update({
                                bloqueado_edicao: false,
                                id_usuario_bloqueio: null
                            })
                            .eq('id_tarefa', Number(id_tarefa));
                    }

                    if (roomId && id_tarefa) {
                        broadcastRoom(wss, roomId, {
                            type: 'TASK_STOPPED_EDITING',
                            payload: { id_tarefa }
                        });
                    }
                }

            } catch (err) {
                console.error('Erro no processamento do WS:', err);
            }
        });

        ws.on('close', async () => {
            if (currentUser && currentRoom) {
                const roomId = currentRoom.id_room;
                const userId = currentUser.id_user;

                state.users.delete(ws);
                state.room.delete(ws);

                if (userId && !isNaN(Number(userId))) {
                    try {
                        await supabase
                            .from('usuario')
                            .update({ status_online: false })
                            .eq('id_usuario', Number(userId));
                    } catch (err) {
                        console.error('Erro ao atualizar status_online no banco:', err);
                    }
                }

                broadcastRoom(wss, roomId, {
                    type: 'USERS_UPDATE',
                    payload: {
                        users: getOnlineUsers(roomId),
                        msg: `${currentUser.nome_user} saiu do Kanban.`
                    }
                });
            }
        });
    });

    return wss;
}

module.exports = setupWebSocket;