require('dotenv').config();

const express = require('express');
const http = require('http');
const path = require('path');
const { WebSocketServer, WebSocket } = require('ws');
const Router = require('./src/router/Router');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });
const PORT = process.env.PORT || 3000;

// --- ESTADO GLOBAL & CONSTANTES ---
const AVATARS = ['CS', 'AS', 'BL', 'JS', 'PY', 'DEV'];

const state = {
    users: new Map(), // Armazena ws -> userObj
    tasks: []         // Lista de tarefas da memória
};

// --- MIDDLEWARES ---
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// --- ROTAS ---
app.use('/', Router);

// --- FUNÇÕES AUXILIARES DO WEBSOCKET ---
function broadcast(message) {
    const payload = JSON.stringify(message);
    wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(payload);
        }
    });
}

function getOnlineUsersList() {
    return Array.from(state.users.values());
}

// --- GERENCIAMENTO DE CONEXÕES WEBSOCKET ---
wss.on('connection', (ws) => {
    const userId = `user-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const userName = `Dev_${Math.floor(Math.random() * 100)}`;
    const userAvatar = AVATARS[Math.floor(Math.random() * AVATARS.length)];

    const userObj = { id: userId, name: userName, avatar: userAvatar };
    state.users.set(ws, userObj);

    // Envia o estado inicial para o usuário recém-conectado
    ws.send(JSON.stringify({
        type: 'INITIAL_STATE',
        payload: {
            tasks: state.tasks,
            users: getOnlineUsersList(),
            currentUser: userObj
        }
    }));

    // Notifica todos sobre a entrada de um novo usuário
    broadcast({
        type: 'USER_COUNT_UPDATE',
        payload: { users: getOnlineUsersList() }
    });

    // Processamento de mensagens recebidas
    ws.on('message', (message) => {
        try {
            const { type, payload } = JSON.parse(message);

            switch (type) {
                case 'CREATE_TASK': {
                    const newTask = {
                        id: `task-${Date.now()}`,
                        title: payload.title,
                        category: payload.category || 'Geral',
                        resp: payload.resp || userObj.name,
                        column: payload.column || 'todo',
                        typingBy: null
                    };
                    state.tasks.push(newTask);
                    broadcast({
                        type: 'TASK_CREATED',
                        payload: { task: newTask, user: userObj.name }
                    });
                    break;
                }

                case 'MOVE_TASK': {
                    const task = state.tasks.find(t => t.id === payload.taskId);
                    if (task) {
                        const oldCol = task.column;
                        task.column = payload.targetColumn;
                        broadcast({
                            type: 'CARD_MOVED',
                            payload: {
                                taskId: task.id,
                                title: task.title,
                                from: oldCol,
                                to: payload.targetColumn,
                                user: userObj.name
                            }
                        });
                    }
                    break;
                }

                case 'DELETE_TASK': {
                    state.tasks = state.tasks.filter(t => t.id !== payload.taskId);
                    broadcast({
                        type: 'TASK_DELETED',
                        payload: { taskId: payload.taskId, user: userObj.name }
                    });
                    break;
                }

                case 'USER_TYPING': {
                    const task = state.tasks.find(t => t.id === payload.taskId);
                    if (task) {
                        task.typingBy = payload.isTyping ? userObj.name : null;
                        broadcast({
                            type: 'TYPING_STATUS',
                            payload: { taskId: task.id, userName: userObj.name, isTyping: payload.isTyping }
                        });
                    }
                    break;
                }
            }
        } catch (err) {
            console.error('Erro ao processar mensagem WS:', err);
        }
    });

    // Tratamento de Desconexão
    ws.on('close', () => {
        state.users.delete(ws);
        broadcast({
            type: 'USER_COUNT_UPDATE',
            payload: { users: getOnlineUsersList() }
        });
    });
});

// --- ROTA DE ERRO 404 ---
app.use((req, res) => {
    res.status(404).send('<h1>Erro 404 - Página não encontrada</h1>');
});

// --- INICIALIZAÇÃO DO SERVIDOR ---
// Usa 'server.listen' para o HTTP + WebSocket rodarem na mesma porta
server.listen(PORT, () => {
    console.log(`🚀 Servidor HTTP e WebSockets ativos em: http://localhost:${PORT}`);
});