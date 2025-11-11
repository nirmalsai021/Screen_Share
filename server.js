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

// Canonical session storage
const sessions = {};

// Create session
app.post('/api/session', (req, res) => {
    const sessionId = 'session-' + Date.now();
    sessions[sessionId] = {
        id: sessionId,
        created: Date.now(),
        ttl: Date.now() + (60 * 60 * 1000),
        offer: null,
        answer: null,
        candidates: [],
        hostSocketId: null,
        viewerSocketId: null
    };
    res.json({ sessionId });
});

// WebRTC signaling
app.post('/api/signaling/:sessionId', (req, res) => {
    const { sessionId } = req.params;
    const { type, offer, answer, candidate } = req.body;
    
    if (!sessions[sessionId]) {
        sessions[sessionId] = { offer: null, answer: null, candidates: [] };
    }

    if (type === 'offer') {
        sessions[sessionId].offer = offer;
        console.log('HTTP: Offer stored for', sessionId);
    } else if (type === 'answer') {
        sessions[sessionId].answer = answer;
        console.log('HTTP: Answer stored for', sessionId);
    } else if (type === 'candidate') {
        sessions[sessionId].candidates.push(candidate);
    }

    res.json({ success: true });
});

// Get signaling data
app.get('/api/signaling/:sessionId/:type', (req, res) => {
    const { sessionId, type } = req.params;
    console.log(`API request: ${type} for session ${sessionId}`);
    
    const session = sessions[sessionId];
    if (!session) {
        return res.json(null);
    }
    
    if (type === 'offer') {
        console.log(`Found offer for ${sessionId}:`, !!session.offer);
        res.json(session.offer ? { offer: session.offer, timestamp: Date.now() } : null);
    } else if (type === 'answer') {
        res.json(session.answer ? { answer: session.answer, timestamp: Date.now() } : null);
    } else if (type === 'candidates') {
        res.json(session.candidates || []);
    }
});

// Debug endpoint
app.get('/api/debug', (req, res) => {
    const debug = {};
    Object.keys(sessions).forEach(sessionId => {
        debug[sessionId] = {
            hasOffer: !!sessions[sessionId].offer,
            hasAnswer: !!sessions[sessionId].answer,
            candidatesCount: sessions[sessionId].candidates?.length || 0,
            hostSocketId: sessions[sessionId].hostSocketId,
            viewerSocketId: sessions[sessionId].viewerSocketId
        };
    });
    res.json(debug);
});

// Cleanup old sessions every 5 minutes
setInterval(() => {
    const now = Date.now();
    Object.keys(sessions).forEach(sessionId => {
        const session = sessions[sessionId];
        if (session.ttl && now > session.ttl) {
            delete sessions[sessionId];
        }
    });
}, 5 * 60 * 1000);

// WebSocket signaling for instant connection
io.on('connection', (socket) => {
    console.log('socket connected', socket.id);

    socket.on('join-session', (sessionId) => {
        console.log('joinSession', sessionId, 'socket', socket.id);
        socket.join(sessionId);
        
        // Initialize session if not exists
        if (!sessions[sessionId]) {
            sessions[sessionId] = { offer: null, answer: null, candidates: [], hostSocketId: null, viewerSocketId: null };
        }
        
        // Mark as viewer
        sessions[sessionId].viewerSocketId = socket.id;
        
        // Send existing offer immediately if available
        if (sessions[sessionId].offer) {
            console.log(`Sending existing offer to viewer ${socket.id}`);
            socket.emit('offer', sessions[sessionId].offer);
            
            // Send buffered candidates
            if (sessions[sessionId].candidates.length > 0) {
                sessions[sessionId].candidates.forEach(candidate => {
                    socket.emit('ice-candidate', candidate);
                });
            }
        }
    });

    socket.on('offer', (data) => {
        console.log('hostOffer for', data.sessionId, 'from', socket.id);
        if (!sessions[data.sessionId]) {
            sessions[data.sessionId] = { offer: null, answer: null, candidates: [], hostSocketId: null, viewerSocketId: null };
        }
        
        sessions[data.sessionId].offer = data.offer;
        sessions[data.sessionId].hostSocketId = socket.id;
        
        // Send to viewers in room
        socket.to(data.sessionId).emit('offer', data.offer);
    });

    socket.on('answer', (data) => {
        console.log('viewerAnswer for', data.sessionId, 'from', socket.id);
        if (sessions[data.sessionId]) {
            sessions[data.sessionId].answer = data.answer;
            // Send to host
            socket.to(data.sessionId).emit('answer', data.answer);
        }
    });

    socket.on('ice-candidate', (data) => {
        if (!sessions[data.sessionId]) {
            sessions[data.sessionId] = { offer: null, answer: null, candidates: [], hostSocketId: null, viewerSocketId: null };
        }
        
        // Buffer candidate
        sessions[data.sessionId].candidates.push(data.candidate);
        
        // Forward to other peer
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