import React, { useState, useRef, useEffect } from 'react';

const API_BASE = process.env.REACT_APP_API_URL || 'https://your-api-gateway-url.execute-api.region.amazonaws.com/prod';

function App() {
    const [sessionId, setSessionId] = useState(null);
    const [isSharing, setIsSharing] = useState(false);
    const [shareUrl, setShareUrl] = useState('');
    const [isViewing, setIsViewing] = useState(false);
    const [error, setError] = useState('');
    const localVideoRef = useRef(null);
    const remoteVideoRef = useRef(null);
    const peerConnection = useRef(null);

    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const viewSessionId = urlParams.get('session');
        if (viewSessionId) {
            setSessionId(viewSessionId);
            setIsViewing(true);
            joinSession(viewSessionId);
        }
    }, []);

    const createSession = async () => {
        try {
            const response = await fetch(`${API_BASE}/session`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            const { sessionId } = await response.json();
            setSessionId(sessionId);
            
            const url = `${window.location.origin}?session=${sessionId}`;
            setShareUrl(url);
            
            return sessionId;
        } catch (error) {
            // Fallback to local session for demo
            const localSessionId = 'local-' + Math.random().toString(36).substr(2, 9);
            setSessionId(localSessionId);
            const url = `${window.location.origin}?session=${localSessionId}`;
            setShareUrl(url);
            return localSessionId;
        }
    };

    const startScreenShare = async () => {
        try {
            setError('');
            
            const stream = await navigator.mediaDevices.getDisplayMedia({
                video: { mediaSource: 'screen' },
                audio: true
            });

            if (localVideoRef.current) {
                localVideoRef.current.srcObject = stream;
            }

            let currentSessionId = sessionId;
            if (!currentSessionId) {
                currentSessionId = await createSession();
            }

            setIsSharing(true);
            setupPeerConnection(stream, currentSessionId, true);

            stream.getVideoTracks()[0].addEventListener('ended', () => {
                stopSharing();
            });

        } catch (error) {
            if (error.name === 'NotAllowedError') {
                setError('Screen sharing permission denied. Please allow screen sharing to continue.');
            } else {
                setError('Failed to start screen sharing: ' + error.message);
            }
        }
    };

    const joinSession = async (sessionId) => {
        setupPeerConnection(null, sessionId, false);
    };

    const setupPeerConnection = (stream, sessionId, isHost) => {
        const pc = new RTCPeerConnection({
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' }
            ]
        });

        peerConnection.current = pc;

        if (stream && isHost) {
            stream.getTracks().forEach(track => {
                pc.addTrack(track, stream);
            });
        }

        pc.ontrack = (event) => {
            if (remoteVideoRef.current && event.streams[0]) {
                remoteVideoRef.current.srcObject = event.streams[0];
            }
        };

        pc.onicecandidate = async (event) => {
            if (event.candidate) {
                await sendSignal(sessionId, 'ice-candidate', event.candidate);
            }
        };

        if (isHost) {
            pc.createOffer().then(offer => {
                pc.setLocalDescription(offer);
                sendSignal(sessionId, 'offer', offer);
            });
        }

        // Poll for signaling messages
        if (!isHost) {
            pollForSignals(sessionId, pc);
        }
    };

    const sendSignal = async (sessionId, type, data) => {
        try {
            await fetch(`${API_BASE}/signaling/${sessionId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type, data })
            });
        } catch (error) {
            console.log('Using local signaling (demo mode)');
            // Store in localStorage for demo
            const signals = JSON.parse(localStorage.getItem('signals') || '{}');
            if (!signals[sessionId]) signals[sessionId] = [];
            signals[sessionId].push({ type, data, timestamp: Date.now() });
            localStorage.setItem('signals', JSON.stringify(signals));
        }
    };

    const pollForSignals = async (sessionId, pc) => {
        const interval = setInterval(() => {
            try {
                const signals = JSON.parse(localStorage.getItem('signals') || '{}');
                const sessionSignals = signals[sessionId] || [];
                
                sessionSignals.forEach(async (signal) => {
                    if (signal.type === 'offer') {
                        await pc.setRemoteDescription(signal.data);
                        const answer = await pc.createAnswer();
                        await pc.setLocalDescription(answer);
                        sendSignal(sessionId, 'answer', answer);
                    } else if (signal.type === 'answer') {
                        await pc.setRemoteDescription(signal.data);
                    } else if (signal.type === 'ice-candidate') {
                        await pc.addIceCandidate(signal.data);
                    }
                });
            } catch (error) {
                console.log('Polling error:', error);
            }
        }, 2000);

        setTimeout(() => clearInterval(interval), 300000); // Stop after 5 minutes
    };

    const stopSharing = () => {
        if (localVideoRef.current && localVideoRef.current.srcObject) {
            localVideoRef.current.srcObject.getTracks().forEach(track => track.stop());
            localVideoRef.current.srcObject = null;
        }
        if (peerConnection.current) {
            peerConnection.current.close();
        }
        setIsSharing(false);
        setError('');
    };

    const copyShareUrl = () => {
        navigator.clipboard.writeText(shareUrl);
        alert('Share URL copied to clipboard!');
    };

    return (
        <div className="container">
            <h1>🔒 Secure Screen Share</h1>
            
            <div className="warning">
                <h3>⚠️ Privacy Notice</h3>
                <p>This application requires your explicit permission to share your screen. 
                   Your screen will only be shared when you click "Start Screen Share" and grant permission through your browser.</p>
            </div>

            {error && (
                <div style={{background: '#f8d7da', border: '1px solid #f5c6cb', padding: '15px', borderRadius: '4px', margin: '20px 0', color: '#721c24'}}>
                    {error}
                </div>
            )}

            {!isViewing ? (
                <div>
                    <h2>Share Your Screen</h2>
                    <button onClick={startScreenShare} disabled={isSharing}>
                        {isSharing ? 'Sharing...' : 'Start Screen Share'}
                    </button>
                    {isSharing && (
                        <button onClick={stopSharing} style={{marginLeft: '10px'}}>Stop Sharing</button>
                    )}
                    
                    {shareUrl && (
                        <div className="session-info">
                            <h3>Share this link with others:</h3>
                            <div className="share-link">{shareUrl}</div>
                            <button onClick={copyShareUrl}>Copy Link</button>
                        </div>
                    )}
                    
                    <div className="video-container">
                        <h3>Your Screen:</h3>
                        <video ref={localVideoRef} autoPlay muted />
                    </div>
                </div>
            ) : (
                <div>
                    <h2>Viewing Shared Screen</h2>
                    <p>Session ID: {sessionId}</p>
                    <div className="video-container">
                        <video ref={remoteVideoRef} autoPlay controls />
                    </div>
                </div>
            )}
        </div>
    );
}

export default App;