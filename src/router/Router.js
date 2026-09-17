const express = require('express');
const router = express.Router();
const roomController = require('../controller/Controller');

// Rotas de Páginas (GET)
router.get('/', roomController.getLoginPage);
router.get('/createroom', roomController.getCreateRoomPage);

// Rotas de Ação (POST)
router.post('/api/entrar-sala', roomController.entrarSala);
router.post('/api/CreateRoom', roomController.criarSala);

module.exports = router;