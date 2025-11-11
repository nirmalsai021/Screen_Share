const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Session storage
const sessions = {};

// Socket.IO connection handling
io.on('connection', (socket) => {
    console.log('🔌 Client connected:', socket.id);

    // Host starts sharing
    socket.on('start-host', ({ sessionId, offer }) => {
        console.log('🎥 Host started session:', sessionId);
        sessions[sessionId] = {
            hostId: socket.id,
            offer: offer,
            viewers: [],
            candidates: []
        };
        socket.join(sessionId);
    });

    // Viewer joins session
    socket.on('join-viewer', (sessionId) => {
        console.log('👁️ Viewer joined session:', sessionId);
        socket.join(sessionId);
        
        const session = sessions[sessionId];
        if (session && session.offer) {
            session.viewers.push(socket.id);
            // Send offer immediately to viewer
            socket.emit('receive-offer', session.offer);
            console.log('📤 Sent offer to viewer:', socket.id);
        } else {
            socket.emit('no-session');
            console.log('❌ No session found for:', sessionId);
        }
    });

    // Handle answer from viewer
    socket.on('send-answer', ({ sessionId, answer }) => {
        console.log('📥 Received answer for session:', sessionId);
        const session = sessions[sessionId];
        if (session) {
            // Send answer to host
            io.to(session.hostId).emit('receive-answer', answer);
        }
    });

    // Handle ICE candidates
    socket.on('ice-candidate', ({ sessionId, candidate, isHost }) => {
        const session = sessions[sessionId];
        if (session) {
            if (isHost) {
                // Host candidate - send to all viewers
                session.viewers.forEach(viewerId => {
                    io.to(viewerId).emit('ice-candidate', candidate);
                });
            } else {
                // Viewer candidate - send to host
                io.to(session.hostId).emit('ice-candidate', candidate);
            }
        }
    });

    socket.on('disconnect', () => {
        console.log('❌ Client disconnected:', socket.id);
        // Clean up sessions where this socket was host
        Object.keys(sessions).forEach(sessionId => {
            const session = sessions[sessionId];
            if (session.hostId === socket.id) {
                delete sessions[sessionId];
                console.log('🗑️ Cleaned up session:', sessionId);
            }
        });
    });
});

// Debug endpoint
app.get('/api/debug', (req, res) => {
    const debug = {};
    Object.keys(sessions).forEach(sessionId => {
        debug[sessionId] = {
            hostId: sessions[sessionId].hostId,
            viewerCount: sessions[sessionId].viewers.length,
            hasOffer: !!sessions[sessionId].offer
        };
    });
    res.json(debug);
});

app.get('/', (req, res) => {
    res.send('✅ Screen Share Server Running');
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});