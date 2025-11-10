const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

// In-memory storage (replace with database in production)
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

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});