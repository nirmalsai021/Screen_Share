const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

app.use(cors());
app.use(express.json());

// In-memory storage
const sessions = new Map();
const offers = new Map();
const answers = new Map();
const candidates = new Map();

// Create session
app.post('/api/session', (req, res) => {
    const sessionId = 'session-' + Date.now();
    sessions.set(sessionId, {
        id: sessionId,
        created: Date.now(),
        ttl: Date.now() + (60 * 60 * 1000) // 1 hour
    });
    res.json({ sessionId });
});

// WebRTC signaling
app.post('/api/signaling/:sessionId', (req, res) => {
    const { sessionId } = req.params;
    const { type, offer, answer, candidate } = req.body;

    if (type === 'offer') {
        offers.set(sessionId, { offer, timestamp: Date.now() });
    } else if (type === 'answer') {
        answers.set(sessionId, { answer, timestamp: Date.now() });
    } else if (type === 'candidate') {
        if (!candidates.has(sessionId)) {
            candidates.set(sessionId, []);
        }
        candidates.get(sessionId).push(candidate);
    }

    res.json({ success: true });
});

// Get signaling data
app.get('/api/signaling/:sessionId/:type', (req, res) => {
    const { sessionId, type } = req.params;
    
    if (type === 'offer') {
        const data = offers.get(sessionId);
        res.json(data || null);
    } else if (type === 'answer') {
        const data = answers.get(sessionId);
        res.json(data || null);
    } else if (type === 'candidates') {
        const data = candidates.get(sessionId) || [];
        res.json(data);
    }
});

// Cleanup old sessions every 5 minutes
setInterval(() => {
    const now = Date.now();
    for (const [sessionId, session] of sessions.entries()) {
        if (now > session.ttl) {
            sessions.delete(sessionId);
            offers.delete(sessionId);
            answers.delete(sessionId);
            candidates.delete(sessionId);
        }
    }
}, 5 * 60 * 1000);

// WebSocket signaling for instant connection
io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    socket.on('join-session', (sessionId) => {
        socket.join(sessionId);
        console.log(`Socket ${socket.id} joined session ${sessionId}`);
    });

    socket.on('offer', (data) => {
        offers.set(data.sessionId, data.offer);
        socket.to(data.sessionId).emit('offer', data.offer);
    });

    socket.on('answer', (data) => {
        answers.set(data.sessionId, data.answer);
        socket.to(data.sessionId).emit('answer', data.answer);
    });

    socket.on('ice-candidate', (data) => {
        socket.to(data.sessionId).emit('ice-candidate', data.candidate);
    });

    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
    });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});