# Virtual Office

A real-time virtual office application where users can move around a shared office space, chat with nearby colleagues, and start video calls when in proximity. Built with Next.js, Socket.IO, and WebRTC.

## Features

- 🏢 **Interactive Office Layout**: Navigate through desks, meeting rooms, and kitchen areas
- 💬 **Proximity Chat**: Automatic group chat when users are within 1 square of each other
- 📹 **Video Conferencing**: Automatic mesh video calls when users are nearby
- 👥 **Real-time Presence**: See all online users and their positions in real-time
- 🎨 **Modern Dark Theme**: Beautiful, high-contrast dark UI

## Tech Stack

- **Frontend**: Next.js 16, React 19, TypeScript
- **Backend**: Node.js, Express, Socket.IO
- **Video**: PeerJS (WebRTC)
- **Real-time**: Socket.IO for presence and chat

## Prerequisites

- Node.js 20+ (LTS recommended)
- npm or yarn

## Getting Started

### Development

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd virtual-office
   ```

2. **Install dependencies**
   ```bash
   npm install
   cd virtual-office-frontend
   npm install
   cd ..
   ```

3. **Start development servers**
   ```bash
   npm run dev
   ```
   
   This will start:
   - Backend server on `http://localhost:4000`
   - Frontend dev server on `http://localhost:3000`

   Or start them separately:
   ```bash
   npm run dev:backend    # Backend only
   npm run dev:frontend   # Frontend only
   ```

4. **Open your browser**
   - Navigate to `http://localhost:3000`
   - Log in with a username
   - Move around with arrow keys
   - Get close to other users to start chatting and video calls!

## Docker

### Using Docker Compose (Recommended)

```bash
docker-compose up
```

This will start both backend and frontend services.

### Using Docker directly

**Build the image:**
```bash
docker build -t virtual-office .
```

**Run the container:**
```bash
docker run -p 3000:3000 -p 4000:4000 virtual-office
```

## Project Structure

```
virtual-office/
├── index.js                 # Backend server (Express + Socket.IO)
├── package.json             # Backend dependencies
├── virtual-office-frontend/ # Next.js frontend
│   ├── src/
│   │   └── app/
│   │       ├── page.tsx     # Main office interface
│   │       ├── layout.tsx   # Root layout
│   │       └── globals.css  # Global styles
│   └── package.json         # Frontend dependencies
├── Dockerfile               # Docker configuration
├── docker-compose.yml       # Docker Compose configuration
└── README.md                # This file
```

## Environment Variables

Create a `.env` file in the root directory (optional):

```env
PORT=4000                    # Backend port (default: 4000)
NODE_ENV=development         # Environment mode
```

## Usage

1. **Login**: Enter a unique username to join the office
2. **Move**: Use arrow keys to move your avatar around the office
3. **Chat**: When you're within 1 square of another user, a chat sidebar appears automatically
4. **Video**: Video calls start automatically when you're near other users
5. **Groups**: Multiple users can join the same chat/video group if they're all adjacent

## Development

### Backend API

- `POST /api/login` - Login endpoint
- `GET /api/groups` - Get current proximity groups
- WebSocket events:
  - `join` - Join the office
  - `move` - Update position
  - `chat` - Send chat message
  - `presence` - Receive user presence updates

### Frontend

Built with Next.js App Router. The main office interface is in `src/app/page.tsx`.

## Testing

```bash
npm test
```

## Production Build

**Frontend:**
```bash
cd virtual-office-frontend
npm run build
npm start
```

**Backend:**
```bash
node index.js
```

Or use Docker for production deployment.

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

ISC

## Notes

- Video calls use PeerJS public servers by default. For production, consider self-hosting PeerJS or using a TURN server for better reliability.
- User positions and chat history are stored in-memory and reset on server restart.
- For production, consider adding a database for persistence.

