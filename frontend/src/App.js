import React, { useState, useRef, useEffect } from 'react';

const API_BASE = process.env.REACT_APP_API_URL || 'https://your-api-gateway-url.execute-api.region.amazonaws.com/prod';

function App() {
    const [sessionId, setSessionId] = useState(null);
    const [isSharing, setIsSharing] = useState(false);
    const [shareUrl, setShareUrl] = useState('');
    const [isViewing, setIsViewing] = useState(false);
    const localVideoRef = useRef(null);
    const remoteVideoRef = useRef(null);
    const peerConnection = useRef(null);

    useEffect(() => {
        // Check if viewing a shared session
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
            alert('Failed to create session');
        }
    };

    const startScreenShare = async () => {
        try {
            // Request screen sharing permission
            const stream = await navigator.mediaDevices.getDisplayMedia({
                video: true,
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

        } catch (error) {
            if (error.name === 'NotAllowedError') {
                alert('Screen sharing permission denied. Please allow screen sharing to continue.');
            } else {
                alert('Failed to start screen sharing: ' + error.message);
            }
        }
    };

    const joinSession = async (sessionId) => {
        try {
            setupPeerConnection(null, sessionId, false);
        } catch (error) {
            alert('Failed to join session');
        }
    };

    const setupPeerConnection = (stream, sessionId, isHost) => {
        const pc = new RTCPeerConnection({
            iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
        });

        peerConnection.current = pc;

        if (stream && isHost) {
            stream.getTracks().forEach(track => {
                pc.addTrack(track, stream);
            });
        }

        pc.ontrack = (event) => {
            if (remoteVideoRef.current) {
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
    };

    const sendSignal = async (sessionId, type, data) => {
        try {
            await fetch(`${API_BASE}/signaling/${sessionId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type, data })
            });
        } catch (error) {
            console.error('Signaling error:', error);
        }
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

            {!isViewing ? (
                <div>
                    <h2>Share Your Screen</h2>
                    <button onClick={startScreenShare} disabled={isSharing}>
                        {isSharing ? 'Sharing...' : 'Start Screen Share'}
                    </button>
                    {isSharing && (
                        <button onClick={stopSharing}>Stop Sharing</button>
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
                        <video ref={remoteVideoRef} autoPlay />
                    </div>
                </div>
            )}
        </div>
    );
}

export default App;