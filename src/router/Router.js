const express = require('express');
const router = express.Router();
const Controller = require('../controller/Controller');

// Rotas de Páginas (GET)
router.get('/', Controller.getCreateUser);
router.get('/LoginIn', Controller.getLoginPage);
router.get('/JoinRoom', Controller.getJoinRoom);
router.get('/CreateRoom', Controller.getCreateRoomPage);
router.get('/Home',Controller.getSalaPage);
router.get('/Logs',Controller.getLogsPage);

// Rotas de Ação (POST)
router.post('/api/CreateUser', Controller.CreateUser);
router.post('/api/LoginUser', Controller.LoginUser);
router.post('/api/JoinRoom', Controller.JoinRoom);
router.post('/api/CreateRoom', Controller.CreateRoom);

module.exports = router;