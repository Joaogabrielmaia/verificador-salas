const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const DATA_FILE = path.join(__dirname, 'site_map.json');

app.use(cors());
app.use(express.json());
app.use(express.static('.'));


function loadData() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch (error) {
    console.error('Erro ao carregar dados:', error);
    return { cities: [] };
  }
}


function saveData(data) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    console.error('Erro ao salvar dados:', error);
    return false;
  }
}


app.get('/api/data', (req, res) => {
  res.json(loadData());
});


app.post('/api/data', (req, res) => {
  const newData = req.body;
  if (saveData(newData)) {

    io.emit('data_updated', newData);
    res.json({ success: true, message: 'Dados salvos com sucesso' });
  } else {
    res.status(500).json({ success: false, message: 'Erro ao salvar dados' });
  }
});


app.post('/api/cities', (req, res) => {
  const data = loadData();
  const newCity = req.body;


  if (!newCity.name || !newCity.floors) {
    return res.status(400).json({ success: false, message: 'Dados da cidade inválidos' });
  }

  data.cities.push(newCity);

  if (saveData(data)) {
    io.emit('data_updated', data);
    res.json({ success: true, message: 'Cidade adicionada com sucesso' });
  } else {
    res.status(500).json({ success: false, message: 'Erro ao salvar cidade' });
  }
});

app.put('/api/cities/:index', (req, res) => {
  const data = loadData();
  const cityIndex = parseInt(req.params.index);
  const updatedCity = req.body;

  if (cityIndex < 0 || cityIndex >= data.cities.length) {
    return res.status(404).json({ success: false, message: 'Cidade não encontrada' });
  }

  data.cities[cityIndex] = updatedCity;

  if (saveData(data)) {
    io.emit('data_updated', data);
    res.json({ success: true, message: 'Cidade atualizada com sucesso' });
  } else {
    res.status(500).json({ success: false, message: 'Erro ao atualizar cidade' });
  }
});

app.delete('/api/cities/:index', (req, res) => {
  const data = loadData();
  const cityIndex = parseInt(req.params.index);

  if (cityIndex < 0 || cityIndex >= data.cities.length) {
    return res.status(404).json({ success: false, message: 'Cidade não encontrada' });
  }

  data.cities.splice(cityIndex, 1);

  if (saveData(data)) {
    io.emit('data_updated', data);
    res.json({ success: true, message: 'Cidade removida com sucesso' });
  } else {
    res.status(500).json({ success: false, message: 'Erro ao remover cidade' });
  }
});


io.on('connection', (socket) => {
  console.log('Cliente conectado:', socket.id);


  socket.emit('data_updated', loadData());

  socket.on('disconnect', () => {
    console.log('Cliente desconectado:', socket.id);
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
  console.log(`Admin: http://localhost:${PORT}/admin.html`);
  console.log(`App: http://localhost:${PORT}/index.html`);
});


app.post('/api/cities/:cityIndex/floors', (req, res) => {
  const data = loadData();
  const cityIndex = parseInt(req.params.cityIndex);
  const newFloor = req.body;

  if (cityIndex < 0 || cityIndex >= data.cities.length) {
    return res.status(404).json({ success: false, message: 'Cidade não encontrada' });
  }

  if (!newFloor.id || !newFloor.label) {
    return res.status(400).json({ success: false, message: 'Dados do andar inválidos' });
  }

  data.cities[cityIndex].floors.push(newFloor);

  if (saveData(data)) {
    io.emit('data_updated', data);
    res.json({ success: true, message: 'Andar adicionado com sucesso' });
  } else {
    res.status(500).json({ success: false, message: 'Erro ao salvar andar' });
  }
});

app.put('/api/cities/:cityIndex/floors/:floorIndex', (req, res) => {
  const data = loadData();
  const cityIndex = parseInt(req.params.cityIndex);
  const floorIndex = parseInt(req.params.floorIndex);
  const updatedFloor = req.body;

  if (cityIndex < 0 || cityIndex >= data.cities.length) {
    return res.status(404).json({ success: false, message: 'Cidade não encontrada' });
  }

  if (floorIndex < 0 || floorIndex >= data.cities[cityIndex].floors.length) {
    return res.status(404).json({ success: false, message: 'Andar não encontrado' });
  }

  data.cities[cityIndex].floors[floorIndex] = updatedFloor;

  if (saveData(data)) {
    io.emit('data_updated', data);
    res.json({ success: true, message: 'Andar atualizado com sucesso' });
  } else {
    res.status(500).json({ success: false, message: 'Erro ao atualizar andar' });
  }
});

app.delete('/api/cities/:cityIndex/floors/:floorIndex', (req, res) => {
  const data = loadData();
  const cityIndex = parseInt(req.params.cityIndex);
  const floorIndex = parseInt(req.params.floorIndex);

  if (cityIndex < 0 || cityIndex >= data.cities.length) {
    return res.status(404).json({ success: false, message: 'Cidade não encontrada' });
  }

  if (floorIndex < 0 || floorIndex >= data.cities[cityIndex].floors.length) {
    return res.status(404).json({ success: false, message: 'Andar não encontrado' });
  }

  data.cities[cityIndex].floors.splice(floorIndex, 1);

  if (saveData(data)) {
    io.emit('data_updated', data);
    res.json({ success: true, message: 'Andar removido com sucesso' });
  } else {
    res.status(500).json({ success: false, message: 'Erro ao remover andar' });
  }
});



const STATUS_FILE = path.join(__dirname, 'room_status.json');


function loadStatus() {
  try {
    return JSON.parse(fs.readFileSync(STATUS_FILE, 'utf8'));
  } catch (error) {
    console.error('Erro ao carregar status:', error);
    return { statuses: {}, pendings: {}, resetTime: next3am(Date.now()) };
  }
}


function saveStatus(data) {
  try {
    fs.writeFileSync(STATUS_FILE, JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    console.error('Erro ao salvar status:', error);
    return false;
  }
}


function next3am(ts) {
  const d = new Date(ts);
  d.setHours(6, 0, 0, 0);
  if (d.getTime() <= ts) {
    d.setDate(d.getDate() + 1);
  }
  return d.getTime();
}


function checkResetStatus() {
  const statusData = loadStatus();
  const now = Date.now();

  if (now >= statusData.resetTime) {

    const newStatusData = {
      statuses: {},
      pendings: {},
      resetTime: next3am(now)
    };
    saveStatus(newStatusData);
    console.log('Status resetados automaticamente');
    return newStatusData;
  }

  return statusData;
}


app.get('/api/status', (req, res) => {
  const statusData = checkResetStatus();
  res.json(statusData);
});


app.post('/api/status', (req, res) => {
  const { id, statusData } = req.body;

  if (!id || !statusData) {
    return res.status(400).json({ success: false, message: 'Dados inválidos' });
  }

  const currentStatus = checkResetStatus();
  currentStatus.statuses[id] = statusData;

  if (saveStatus(currentStatus)) {
    io.emit('status_updated', { id, status: statusData });
    res.json({ success: true, message: 'Status salvo com sucesso' });
  } else {
    res.status(500).json({ success: false, message: 'Erro ao salvar status' });
  }
});


app.post('/api/status/pending', (req, res) => {
  const { id, comment } = req.body;

  if (!id || !comment) {
    return res.status(400).json({ success: false, message: 'Dados inválidos' });
  }

  const currentStatus = checkResetStatus();
  if (!currentStatus.pendings[id]) {
    currentStatus.pendings[id] = [];
  }
  currentStatus.pendings[id].push(comment);

  if (saveStatus(currentStatus)) {
    io.emit('pending_updated', { id, pendings: currentStatus.pendings[id] });
    res.json({ success: true, message: 'Comentário salvo com sucesso' });
  } else {
    res.status(500).json({ success: false, message: 'Erro ao salvar comentário' });
  }
});


app.delete('/api/status/pending/:id', (req, res) => {
  const id = req.params.id;
  const currentStatus = checkResetStatus();

  if (currentStatus.pendings[id]) {
    delete currentStatus.pendings[id];

    if (saveStatus(currentStatus)) {
      io.emit('pending_cleared', { id });
      res.json({ success: true, message: 'Comentários limpos com sucesso' });
    } else {
      res.status(500).json({ success: false, message: 'Erro ao limpar comentários' });
    }
  } else {
    res.json({ success: true, message: 'Nenhum comentário para limpar' });
  }
});


app.delete('/api/status/:id', (req, res) => {
  const id = req.params.id;
  const currentStatus = checkResetStatus();

  if (currentStatus.statuses[id]) {
    delete currentStatus.statuses[id];

    if (saveStatus(currentStatus)) {
      io.emit('status_cleared', { id });
      res.json({ success: true, message: 'Status limpo com sucesso' });
    } else {
      res.status(500).json({ success: false, message: 'Erro ao limpar status' });
    }
  } else {
    res.json({ success: true, message: 'Nenhum status para limpar' });
  }
});


io.on('connection', (socket) => {
  console.log('Cliente conectado:', socket.id);


  socket.emit('status_data', checkResetStatus());

  socket.on('disconnect', () => {
    console.log('Cliente desconectado:', socket.id);
  });
});



const crypto = require('crypto');
const SETTINGS_FILE = path.join(__dirname, 'settings.json');
const DEFAULT_PASSWORD = process.env.DEFAULT_ADMIN_PWD || 'Adm1n@Itfield';

function loadSettings() {
  try {
    return JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'));
  } catch (e) {
    return {};
  }
}

function saveSettings(s) {
  try {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(s, null, 2));
    return true;
  } catch (e) {
    console.error('Erro ao salvar settings:', e);
    return false;
  }
}

function sha256Hex(str) {
  return crypto.createHash('sha256').update(str, 'utf8').digest('hex');
}

app.post('/api/auth/ensure-default', (req, res) => {
  const settings = loadSettings();
  if (!settings.pwdHash) {
    settings.pwdHash = sha256Hex(DEFAULT_PASSWORD);
    if (!saveSettings(settings)) {
      return res.status(500).json({ success: false, message: 'Erro ao salvar senha padrão' });
    }
    console.log('Senha padrão criada no servidor');
  }
  return res.json({ success: true });
});

app.post('/api/auth/login', (req, res) => {
  const { password } = req.body || {};
  if (typeof password !== 'string') return res.status(400).json({ success: false, message: 'Password required' });
  const settings = loadSettings();
  if (!settings.pwdHash) {
    settings.pwdHash = sha256Hex(DEFAULT_PASSWORD);
    saveSettings(settings);
  }
  const incomingHash = sha256Hex(password);
  if (incomingHash === settings.pwdHash) {
    return res.json({ success: true });
  } else {
    return res.json({ success: false });
  }
});

app.post('/api/auth/set-password', (req, res) => {
  const { newPassword } = req.body || {};
  if (typeof newPassword !== 'string' || newPassword.length === 0) return res.status(400).json({ success: false, message: 'newPassword required' });
  const settings = loadSettings();
  settings.pwdHash = sha256Hex(newPassword);
  if (saveSettings(settings)) return res.json({ success: true });
  return res.status(500).json({ success: false, message: 'Erro ao salvar nova senha' });
});

