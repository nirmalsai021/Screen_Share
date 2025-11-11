import React, { useState, useRef, useEffect } from 'react';
import { io } from 'socket.io-client';

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
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' },
                { urls: 'turn:relay.metered.ca:80', username: 'openai', credential: 'openai123' },
                { urls: 'turn:relay.metered.ca:443', username: 'openai', credential: 'openai123' }
            ]
        });
        peerConnection.current = pc;

        const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';
        const socket = io(API_URL);

        console.log('🎥 Host connecting to:', API_URL);

        // Add stream tracks
        stream.getTracks().forEach(track => {
            pc.addTrack(track, stream);
            console.log('➕ Added track:', track.kind);
        });

        // ICE candidate handling
        pc.onicecandidate = (event) => {
            if (event.candidate) {
                socket.emit('ice-candidate', { 
                    sessionId, 
                    candidate: event.candidate, 
                    isHost: true 
                });
            }
        };

        // Connection state monitoring
        pc.oniceconnectionstatechange = () => {
            console.log('🧊 Host ICE state:', pc.iceConnectionState);
            if (pc.iceConnectionState === 'connected') {
                setStatus('✅ Viewer connected!');
            }
        };

        // Create and send offer
        pc.createOffer().then(offer => {
            return pc.setLocalDescription(offer);
        }).then(() => {
            socket.emit('start-host', { sessionId, offer: pc.localDescription });
            console.log('📤 Host offer sent for session:', sessionId);
        }).catch(error => {
            console.error('❌ Host offer error:', error);
            setStatus('❌ Error setting up connection');
        });

        // Listen for viewer answers
        socket.on('receive-answer', (answer) => {
            console.log('📥 Host received answer');
            pc.setRemoteDescription(answer).then(() => {
                console.log('✅ Host set remote description');
            }).catch(console.error);
        });

        // Listen for viewer ICE candidates
        socket.on('ice-candidate', (candidate) => {
            pc.addIceCandidate(candidate).catch(console.error);
        });
    };

    const setupViewer = (viewSessionId) => {
        const pc = new RTCPeerConnection({
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' },
                { urls: 'turn:relay.metered.ca:80', username: 'openai', credential: 'openai123' },
                { urls: 'turn:relay.metered.ca:443', username: 'openai', credential: 'openai123' }
            ]
        });
        peerConnection.current = pc;

        const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';
        const socket = io(API_URL);
        
        console.log('👁️ Viewer connecting to:', API_URL);

        // Handle incoming video stream
        pc.ontrack = (event) => {
            console.log('📺 Received video stream');
            const remoteVideo = remoteVideoRef.current;
            if (!remoteVideo) return;
            
            const stream = event.streams[0];
            remoteVideo.srcObject = stream;
            remoteVideo.style.display = 'block';
            
            console.log('📊 Stream tracks:', stream.getTracks().map(t => ({kind: t.kind, readyState: t.readyState})));
            
            // Auto-play with fallback
            const playVideo = async () => {
                try {
                    remoteVideo.muted = true;
                    await remoteVideo.play();
                    setStatus('✅ Screen share playing');
                    console.log('▶️ Video playing');
                } catch (err) {
                    console.warn('⚠️ Autoplay blocked, click to play');
                    setStatus('🎬 Click video to play');
                    remoteVideo.onclick = async () => {
                        try {
                            remoteVideo.muted = false;
                            await remoteVideo.play();
                            setStatus('✅ Screen share playing');
                        } catch (e) {
                            console.error('Manual play failed:', e);
                        }
                    };
                }
            };
            
            if (remoteVideo.readyState >= 2) {
                playVideo();
            } else {
                remoteVideo.onloadedmetadata = playVideo;
            }
        };

        // ICE candidate handling
        pc.onicecandidate = (event) => {
            if (event.candidate) {
                socket.emit('ice-candidate', { 
                    sessionId: viewSessionId, 
                    candidate: event.candidate, 
                    isHost: false 
                });
            }
        };

        // Connection state monitoring
        pc.oniceconnectionstatechange = () => {
            console.log('🧊 Viewer ICE state:', pc.iceConnectionState);
            if (pc.iceConnectionState === 'connected') {
                setStatus('✅ Connected to screen share');
            } else if (pc.iceConnectionState === 'failed') {
                setStatus('❌ Connection failed');
            }
        };

        // Socket event handlers
        socket.on('connect', () => {
            console.log('🔌 Viewer socket connected:', socket.id);
            socket.emit('join-viewer', viewSessionId);
        });

        socket.on('receive-offer', (offer) => {
            console.log('📥 Viewer received offer');
            setStatus('🔄 Connecting to screen share...');
            
            pc.setRemoteDescription(offer).then(() => {
                return pc.createAnswer();
            }).then(answer => {
                return pc.setLocalDescription(answer);
            }).then(() => {
                socket.emit('send-answer', { sessionId: viewSessionId, answer: pc.localDescription });
                console.log('📤 Viewer sent answer');
            }).catch(error => {
                console.error('❌ Viewer answer error:', error);
                setStatus('❌ Connection error');
            });
        });

        socket.on('ice-candidate', (candidate) => {
            pc.addIceCandidate(candidate).catch(console.error);
        });

        socket.on('no-session', () => {
            setStatus('❌ No active screen share found');
        });

        socket.on('connect_error', () => {
            setStatus('❌ Connection error');
        });
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
                            playsInline
                            muted
                            controls
                            style={{
                                width: '100%', 
                                maxWidth: '600px',
                                border: '2px solid #007bff',
                                borderRadius: '4px',
                                minHeight: '300px',
                                background: '#000',
                                cursor: 'pointer'
                            }}
                        />
                        <div style={{ textAlign: 'center', marginTop: '10px' }}>
                            <p style={{ color: '#666', fontSize: '14px', margin: '5px 0' }}>
                                If video doesn't start automatically, click on it to play
                            </p>
                            <button 
                                onClick={() => {
                                    if (remoteVideoRef.current) {
                                        const v = remoteVideoRef.current;
                                        console.log('Video debug:', {
                                            videoWidth: v.videoWidth,
                                            videoHeight: v.videoHeight,
                                            paused: v.paused,
                                            readyState: v.readyState,
                                            currentTime: v.currentTime,
                                            srcObject: !!v.srcObject
                                        });
                                        if (v.srcObject) {
                                            console.log('Stream tracks:', v.srcObject.getTracks().map(t => ({kind: t.kind, readyState: t.readyState})));
                                        }
                                    }
                                }}
                                style={{
                                    background: '#17a2b8',
                                    color: 'white',
                                    border: 'none',
                                    padding: '8px 16px',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    fontSize: '12px'
                                }}
                            >
                                Debug Video Status
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default App;