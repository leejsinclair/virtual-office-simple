/**
 * Virtual Office Backend Server
 * 
 * Express server with Socket.IO for real-time communication
 * Handles:
 * - User authentication and presence
 * - Real-time position updates
 * - Proximity-based group calculation
 * - Group chat message distribution
 * 
 * @module BackendServer
 */

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
require('dotenv').config();

// Initialize Express app and HTTP server
const app = express();
const server = http.createServer(app);

// Configure Socket.IO with CORS for cross-origin connections
const io = socketIo(server, {
  cors: {
    origin: '*', // Allow all origins (restrict in production)
    methods: ['GET', 'POST']
  }
});

// Middleware
app.use(cors()); // Enable CORS for all routes
app.use(express.json()); // Parse JSON request bodies

// ============================================================================
// Data Storage
// ============================================================================

/**
 * In-memory store for users and their positions
 * Format: { username: { x: number, y: number } }
 * 
 * Note: In production, this should be replaced with a database
 * (e.g., Redis, PostgreSQL, MongoDB) for persistence and scalability
 */
let users = {};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Calculate proximity groups using breadth-first search
 * 
 * Users within 1 square of each other (including diagonals) are grouped together.
 * Uses BFS to find all connected components in the proximity graph.
 * 
 * @param {Object} users - Map of username to position: { username: { x, y } }
 * @returns {Object} Map of username to group members: { username: [members...] }
 * 
 * @example
 * // If user1 at (2,2) and user2 at (3,2) are adjacent:
 * // Returns: { user1: ['user1', 'user2'], user2: ['user1', 'user2'] }
 */
function calculateGroups(users) {
  // Get all usernames
  const names = Object.keys(users);
  const groups = {};
  
  // Track visited users for BFS
  const visited = {};
  
  // For each unvisited user, start a new group
  for (let i = 0; i < names.length; ++i) {
    const u = names[i];
    if (visited[u]) continue; // Skip if already in a group
    
    // Start new group with this user
    const group = [u];
    visited[u] = true;
    const queue = [u]; // BFS queue
    
    // Find all users connected to this user via proximity
    while (queue.length) {
      const v = queue.pop(); // Get next user from queue
      
      // Check all other users for adjacency
      for (let j = 0; j < names.length; ++j) {
        const w = names[j];
        if (visited[w]) continue; // Skip if already processed
        
        // Check if users are adjacent (within 1 square, including diagonals)
        const dx = Math.abs(users[v].x - users[w].x);
        const dy = Math.abs(users[v].y - users[w].y);
        
        if (dx <= 1 && dy <= 1) {
          // Users are adjacent - add to same group
          visited[w] = true;
          group.push(w);
          queue.push(w); // Continue BFS from this user
        }
      }
    }
    
    // Assign all users in this group to each other
    group.forEach(name => { 
      groups[name] = [...group]; // Copy array to avoid reference issues
    });
  }
  
  return groups; // { username: [members,...] }
}

// ============================================================================
// REST API Endpoints
// ============================================================================

/**
 * GET /api/groups
 * 
 * Returns current proximity groups for debugging/frontend polling
 * 
 * @returns {Object} Map of username to group members
 */
app.get('/api/groups', (req, res) => {
  res.json(calculateGroups(users));
});

/**
 * POST /api/login
 * 
 * Simple authentication endpoint (placeholder - replace with real auth in production)
 * Creates a new user entry and spawns them at default position
 * 
 * @param {string} username - User's chosen username
 * @returns {Object} { username: string }
 */
app.post('/api/login', (req, res) => {
  const { username } = req.body;
  
  // Validate username
  if (!username) return res.status(400).json({ error: 'No username' });
  
  // Create user entry at default spawn position
  // Note: This is a naive implementation - use proper session management in production
  users[username] = { x: 2, y: 2 }; // Spawn at a visible spot on the grid
  
  res.json({ username });
});

// ============================================================================
// Socket.IO Event Handlers
// ============================================================================

/**
 * Handle new Socket.IO connections
 * Sets up event listeners for presence, movement, and chat
 */
io.on('connection', (socket) => {
  let currentUser; // Track which user this socket belongs to

  /**
   * Handle user joining the office
   * 
   * @param {string} username - Username of the joining user
   */
  socket.on('join', (username) => {
    currentUser = username;
    socket.user = username; // Store username on socket for message routing
    
    // Create user entry if it doesn't exist (e.g., if they joined via socket before REST login)
    if (!users[username]) {
      users[username] = { x: 2, y: 2 }; // Default spawn position
    }
    
    // Broadcast updated presence to all clients
    io.emit('presence', users);
  });

  /**
   * Handle user movement updates
   * 
   * @param {Object} data - { username: string, x: number, y: number }
   */
  socket.on('move', ({ username, x, y }) => {
    // Update user position if user exists
    if (users[username]) {
      users[username] = { x, y };
      // Broadcast updated presence to all clients
      io.emit('presence', users);
    }
  });

  /**
   * Handle chat messages
   * 
   * Distributes chat messages to all members of the sender's proximity group.
   * Only users within 1 square of each other can chat.
   * 
   * @param {Object} data - { msg: string }
   */
  socket.on('chat', ({ msg }) => {
    // Validate sender
    if (!currentUser || !users[currentUser]) return;
    
    // Calculate current proximity groups
    const groups = calculateGroups(users);
    const group = groups[currentUser] || []; // Get sender's group
    
    // Send message to all group members (including sender)
    group.forEach(name => {
      // Find all connected sockets for this user
      io.sockets.sockets.forEach(s => {
        if (s.user === name) {
          // Emit chat message to this user's socket
          s.emit('chat', { from: currentUser, msg, group });
        }
      });
    });
  });

  /**
   * Handle user disconnection
   * Removes user from presence and notifies all clients
   */
  socket.on('disconnect', () => {
    if (currentUser) {
      // Remove user from presence
      delete users[currentUser];
      // Broadcast updated presence to all clients
      io.emit('presence', users);
    }
  });
});

// ============================================================================
// Server Startup
// ============================================================================

/**
 * Start the server
 * Listens on port from environment variable or default 4000
 */
const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`Backend API running on port ${PORT}`);
});
