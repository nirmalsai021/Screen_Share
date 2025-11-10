import React, { useState, useRef, useEffect } from 'react';

function App() {
    const [sessionId, setSessionId] = useState(null);
    const [isSharing, setIsSharing] = useState(false);
    const [shareUrl, setShareUrl] = useState('');
    const [isViewing, setIsViewing] = useState(false);
    const [status, setStatus] = useState('');
    const localVideoRef = useRef(null);
    const remoteVideoRef = useRef(null);
    const peerConnection = useRef(null);
    const dataChannel = useRef(null);

    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const viewSessionId = urlParams.get('session');
        if (viewSessionId) {
            setSessionId(viewSessionId);
            setIsViewing(true);
            setStatus('Waiting for connection...');
            setupViewer(viewSessionId);
        }
    }, []);

    const startScreenShare = async () => {
        try {
            const stream = await navigator.mediaDevices.getDisplayMedia({
                video: true,
                audio: true
            });

            localVideoRef.current.srcObject = stream;

            const newSessionId = 'session-' + Date.now();
            setSessionId(newSessionId);
            setShareUrl(`${window.location.origin}?session=${newSessionId}`);
            setIsSharing(true);
            setStatus('✅ Screen sharing active - waiting for viewers');

            setupHost(stream, newSessionId);

            stream.getVideoTracks()[0].addEventListener('ended', () => {
                stopSharing();
            });

        } catch (error) {
            setStatus('❌ Permission denied: ' + error.message);
        }
    };

    const setupHost = (stream, sessionId) => {
        const pc = new RTCPeerConnection({
            iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
        });
        peerConnection.current = pc;

        const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

        // Add stream to peer connection
        stream.getTracks().forEach(track => {
            pc.addTrack(track, stream);
        });

        // Create data channel for signaling
        dataChannel.current = pc.createDataChannel('signaling');
        
        pc.ondatachannel = (event) => {
            const channel = event.channel;
            channel.onopen = () => setStatus('✅ Viewer connected!');
            channel.onclose = () => setStatus('✅ Screen sharing active - waiting for viewers');
        };

        // Send ICE candidates to server
        pc.onicecandidate = (event) => {
            if (event.candidate) {
                fetch(`${API_URL}/api/signaling/${sessionId}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ type: 'candidate', candidate: event.candidate })
                }).catch(console.error);
            }
        };

        // Create offer for viewers
        pc.createOffer().then(offer => {
            return pc.setLocalDescription(offer);
        }).then(() => {
            return fetch(`${API_URL}/api/signaling/${sessionId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type: 'offer', offer: pc.localDescription })
            });
        }).then(() => {
            console.log('Host: Offer sent to server for session:', sessionId);
        }).catch(error => {
            console.error('Error creating offer:', error);
            setStatus('❌ Error setting up connection');
        });

        // Listen for answers
        const checkForAnswer = setInterval(() => {
            fetch(`${API_URL}/api/signaling/${sessionId}/answer`)
                .then(res => res.json())
                .then(data => {
                    if (data && data.answer) {
                        pc.setRemoteDescription(data.answer).then(() => {
                            setStatus('✅ Viewer connecting...');
                            // Get viewer candidates after a delay
                            setTimeout(() => {
                                fetch(`${API_URL}/api/signaling/${sessionId}/candidates`)
                                    .then(res => res.json())
                                    .then(candidates => {
                                        candidates.forEach(candidate => {
                                            pc.addIceCandidate(candidate).catch(console.error);
                                        });
                                    }).catch(console.error);
                            }, 1000);
                        }).catch(console.error);
                        clearInterval(checkForAnswer);
                    }
                }).catch(console.error);
        }, 2000);
    };

    const setupViewer = (viewSessionId) => {
        const pc = new RTCPeerConnection({
            iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
        });
        peerConnection.current = pc;

        const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

        pc.ontrack = (event) => {
            console.log('Received remote stream:', event.streams[0]);
            setStatus('✅ Connected - receiving screen share');
            if (remoteVideoRef.current) {
                remoteVideoRef.current.srcObject = event.streams[0];
            }
        };

        pc.ondatachannel = (event) => {
            const channel = event.channel;
            channel.onopen = () => console.log('Data channel opened');
        };

        // Send ICE candidates to server
        pc.onicecandidate = (event) => {
            if (event.candidate) {
                fetch(`${API_URL}/api/signaling/${viewSessionId}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ type: 'candidate', candidate: event.candidate })
                }).catch(console.error);
            }
        };

        let checkForOffer;
        let timeoutId;
        
        // Look for host offer
        checkForOffer = setInterval(() => {
            fetch(`${API_URL}/api/signaling/${viewSessionId}/offer`)
                .then(res => res.json())
                .then(data => {
                    if (data && data.offer) {
                        clearInterval(checkForOffer);
                        clearTimeout(timeoutId);
                        setStatus('🔄 Connecting to screen share...');
                        console.log('Viewer: Processing offer for session:', viewSessionId);
                        pc.setRemoteDescription(data.offer).then(() => {
                            return pc.createAnswer();
                        }).then(answer => {
                            return pc.setLocalDescription(answer);
                        }).then(() => {
                            return fetch(`${API_URL}/api/signaling/${viewSessionId}`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ type: 'answer', answer: pc.localDescription })
                            });
                        }).then(() => {
                            setStatus('🔄 Establishing connection...');
                            // Get host candidates after delay
                            setTimeout(() => {
                                fetch(`${API_URL}/api/signaling/${viewSessionId}/candidates`)
                                    .then(res => res.json())
                                    .then(candidates => {
                                        candidates.forEach(candidate => {
                                            pc.addIceCandidate(candidate).catch(console.error);
                                        });
                                    }).catch(console.error);
                            }, 1500);
                        }).catch(error => {
                            console.error('Error processing offer:', error);
                            setStatus('❌ Error connecting to screen share');
                        });
                    }
                }).catch(console.error);
        }, 2000);

        // Timeout if no offer found
        timeoutId = setTimeout(() => {
            clearInterval(checkForOffer);
            setStatus('❌ No active screen share found. Make sure the presenter started sharing.');
        }, 10000);
    };

    const stopSharing = () => {
        if (localVideoRef.current && localVideoRef.current.srcObject) {
            localVideoRef.current.srcObject.getTracks().forEach(track => track.stop());
            localVideoRef.current.srcObject = null;
        }
        if (peerConnection.current) {
            peerConnection.current.close();
        }
        if (sessionId) {
            localStorage.removeItem(`offer-${sessionId}`);
            localStorage.removeItem(`answer-${sessionId}`);
            localStorage.removeItem(`connection-${sessionId}`);
        }
        setIsSharing(false);
        setStatus('');
    };

    const copyLink = () => {
        navigator.clipboard.writeText(shareUrl);
        alert('✅ Link copied! Open in any browser to view the screen share.');
    };

    return (
        <div className="container">
            <h1>🔒 Screen Share</h1>
            
            <div className="warning">
                <h3>⚠️ Privacy Notice</h3>
                <p>Click "Start Screen Share" and grant permission to share your screen.</p>
            </div>

            {status && (
                <div style={{
                    padding: '15px',
                    margin: '20px 0',
                    borderRadius: '4px',
                    background: status.includes('❌') ? '#f8d7da' : '#d4edda',
                    color: status.includes('❌') ? '#721c24' : '#155724'
                }}>
                    {status}
                </div>
            )}

            {!isViewing ? (
                <div>
                    <h2>📺 Share Your Screen</h2>
                    <button 
                        onClick={startScreenShare} 
                        disabled={isSharing}
                        style={{
                            background: isSharing ? '#28a745' : '#007bff',
                            color: 'white',
                            border: 'none',
                            padding: '15px 30px',
                            borderRadius: '4px',
                            cursor: isSharing ? 'not-allowed' : 'pointer',
                            fontSize: '16px'
                        }}
                    >
                        {isSharing ? '✅ Sharing...' : '🚀 Start Screen Share'}
                    </button>
                    
                    {isSharing && (
                        <button 
                            onClick={stopSharing}
                            style={{
                                background: '#dc3545',
                                color: 'white',
                                border: 'none',
                                padding: '15px 30px',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontSize: '16px',
                                marginLeft: '10px'
                            }}
                        >
                            ⏹️ Stop
                        </button>
                    )}
                    
                    {shareUrl && (
                        <div className="session-info">
                            <h3>📤 Share this link:</h3>
                            <div className="share-link">{shareUrl}</div>
                            <button 
                                onClick={copyLink}
                                style={{
                                    background: '#28a745',
                                    color: 'white',
                                    border: 'none',
                                    padding: '10px 20px',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    marginTop: '10px'
                                }}
                            >
                                📋 Copy Link
                            </button>
                        </div>
                    )}
                    
                    <div className="video-container">
                        <h3>👀 Your Screen Preview:</h3>
                        <video 
                            ref={localVideoRef} 
                            autoPlay 
                            muted 
                            style={{
                                width: '100%', 
                                maxWidth: '600px',
                                border: '2px solid #28a745',
                                borderRadius: '4px'
                            }} 
                        />
                    </div>
                </div>
            ) : (
                <div>
                    <h2>👁️ Viewing Screen Share</h2>
                    <p>Session: <code>{sessionId}</code></p>
                    
                    <div className="video-container">
                        <h3>📺 Live Screen:</h3>
                        <video 
                            ref={remoteVideoRef} 
                            autoPlay
                            controls
                            style={{
                                width: '100%', 
                                maxWidth: '600px',
                                border: '2px solid #007bff',
                                borderRadius: '4px',
                                minHeight: '300px',
                                background: '#000'
                            }}
                        />
                    </div>
                </div>
            )}
        </div>
    );
}

export default App;