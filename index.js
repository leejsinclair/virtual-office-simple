const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

app.use(cors());
app.use(express.json());

// In-memory store for users and positions (in production use DB)
let users = {};

// Helper to calculate all proximity groups
function calculateGroups(users) {
  // Undirected graph: edge if within 1 square
  const names = Object.keys(users);
  const groups = {};
  // Each user: run BFS to discover cluster
  const visited = {};
  for (let i = 0; i < names.length; ++i) {
    const u = names[i];
    if (visited[u]) continue;
    // New group
    const group = [u];
    visited[u] = true;
    const queue = [u];
    while (queue.length) {
      const v = queue.pop();
      for (let j = 0; j < names.length; ++j) {
        const w = names[j];
        if (visited[w]) continue;
        // Adjacent?
        const dx = Math.abs(users[v].x - users[w].x);
        const dy = Math.abs(users[v].y - users[w].y);
        if (dx <= 1 && dy <= 1) {
          visited[w] = true;
          group.push(w);
          queue.push(w);
        }
      }
    }
    // Set membership
    group.forEach(name => { groups[name] = [...group]; });
  }
  return groups; // { username: [members,...] }
}

// REST for frontend debug
app.get('/api/groups', (req, res) => {
  res.json(calculateGroups(users));
});

// REST Auth placeholder (replace with real auth)
app.post('/api/login', (req, res) => {
  const { username } = req.body;
  if (!username) return res.status(400).json({ error: 'No username' });
  // Naive: use username as session ID
  users[username] = { x: 2, y: 2 }; // Spawn at a visible spot
  res.json({ username });
});

io.on('connection', (socket) => {
  let currentUser;

  socket.on('join', (username) => {
    currentUser = username;
    socket.user = username;
    if (!users[username]) {
      users[username] = { x: 2, y: 2 };
    }
    io.emit('presence', users);
  });

  socket.on('move', ({ username, x, y }) => {
    if (users[username]) {
      users[username] = { x, y };
      io.emit('presence', users);
    }
  });

  socket.on('chat', ({ msg }) => {
    if (!currentUser || !users[currentUser]) return;
    const groups = calculateGroups(users);
    const group = groups[currentUser] || [];
    group.forEach(name => {
      // Send chat message to all group members (including self)
      // Only send if they are connected
      io.sockets.sockets.forEach(s => {
        if (s.user === name) {
          s.emit('chat', { from: currentUser, msg, group });
        }
      });
    });
  });

  socket.on('disconnect', () => {
    if (currentUser) {
      delete users[currentUser];
      io.emit('presence', users);
    }
  });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`Backend API running on port ${PORT}`);
});
