const express = require('express');
const path = require('path');
const Router = require('./router/Router');

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public', 'src')));

// Registrar as Rotas da Aplicação
app.use('/', Router);

// Tratamento de Erro 404 (Sempre no final)
app.use((req, res) => {
    res.status(404).send('<h1>Erro 404 - Página não encontrada</h1>');
});

// Iniciar o Servidor
app.listen(PORT, () => {
    console.log(`🚀 Servidor rodando em: http://localhost:${PORT}`);
});