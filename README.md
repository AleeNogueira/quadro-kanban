# Requisitos Funcionais

~~[RF-01] Conexão Bidirecional WebSocket: O servidor Node.js/Express deve disponibilizar o endpoint 
WebSocket (ws://localhost:3000) aceitando múltiplas conexões concorrentes de navegadores de 
desenvolvedores, mantendo um canal full-duplex persistente baseado na RFC 6455.
Prioridade: Crítica~~

~~[RF-02] Inicialização do Estado Global do Quadro: Ao aceitar uma nova conexão WebSocket, o servidor 
deve retransmitir imediatamente a mensagem do tipo INITIAL_STATE contendo a lista consolidada das 
tarefas ativas por coluna (A Fazer, Em Progresso, Revisão, Concluído) e a relação de usuários online.
Prioridade: Crítica~~

~~[RF-03] Criação Colaborativa de Tarefas em Tempo Real: A interface front-end deve permitir o envio do
evento CREATE_TASK especificando título, descrição, responsável e prioridade. O servidor deve atribuir
um ID único sequencial, persistir o cartão no estado em memória e emitir um broadcast de notificação 
para todos os clientes conectados.
Prioridade: Alta~~

~~[RF-04] Movimentação Interativa de Tarefas (Drag & Drop): Quando um usuário arrastar um cartão entre 
as colunas do Kanban, o navegador deve disparar a mensagem WebSocket MOVE_TASK. O servidor deve 
atualizar a posição e a coluna do cartão e retransmitir o evento CARD_MOVED para que os quadros de todos
os colegas atualizem a posição do cartão instantaneamente.
Prioridade: Crítica~~

~~[RF-05] Exclusão de Cartões de Tarefa: O sistema deve permitir a remoção de tarefas via evento 
DELETE_TASK. Ao validar o comando, o servidor deve remover o cartão da memória global e emitir a ordem
de remoção visual para todos os clientes ativos.
Prioridade: Média~~

~~[RF-06] Rastreamento de Presença e Usuários Online: O servidor deve gerenciar o ciclo de vida das 
conexões TCP/WebSocket, detectando handshakes e desconexões (socket.on(’close’)). A lista de membros
ativos deve ser retransmitida aos clientes através do evento USER_COUNT_UPDATE.
Prioridade: Alta~~

~~[RF-07] Indicador de Digitação Presencial / Bloqueio: Enquanto um desenvolvedor estiver digitando ou
editando campos de um cartão no modal, o cliente deve enviar o evento USER_TYPING. Os demais usuários
devem visualizar o indicador em tempo real "[Em Edição] Maria Santos está alterando esta tarefa...".
Prioridade: Média~~

[RF-08] Feed Lateral de Histórico de Atividades: A aplicação front-end deve manter um painel de 
registro (Activity Log) que liste em tempo real com carimbo de hora cada ação realizada na sessão 
(ex: "14:32 - Carlos moveu a tarefa #15 para EM PROGRESSO").
Prioridade: Média

# Dados para teste no banco

usuario 01
nome: tony
email: tony@teste.com

usuario 02
nome: tonyTeste
email: TonyTest@teste.com

quadro
codigo: 1234

# TO DO - Logs