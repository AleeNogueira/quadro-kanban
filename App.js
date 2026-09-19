require('dotenv').config();

const express = require('express');
const http = require('http');
const path = require('path');
const Router = require('./src/router/Router');
const setupWebSocket = require('./src/websocket/wsServer');

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3000;

// --- MIDDLEWARES ---
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// --- ROTAS DA APLICAÇÃO ---
app.use('/', Router);

// Inicializa a camada de WebSockets
setupWebSocket(server);

// --- ROTA DE ERRO 404 ---
app.use((req, res) => {
    res.status(404).send('<h1>Erro 404 - Página não encontrada</h1>');
});

// --- INICIALIZAÇÃO DO SERVIDOR ---
server.listen(PORT, () => {
    console.log(`🚀 Servidor HTTP e WebSockets ativos na porta: ${PORT}`);
});