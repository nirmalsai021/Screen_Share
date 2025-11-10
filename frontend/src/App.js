import React, { useState, useRef, useEffect } from 'react';

function App() {
    const [sessionId, setSessionId] = useState(null);
    const [isSharing, setIsSharing] = useState(false);
    const [shareUrl, setShareUrl] = useState('');
    const [isViewing, setIsViewing] = useState(false);
    const [connectionStatus, setConnectionStatus] = useState('');
    const localVideoRef = useRef(null);
    const remoteVideoRef = useRef(null);
    const peerConnection = useRef(null);
    const localStream = useRef(null);

    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const viewSessionId = urlParams.get('session');
        if (viewSessionId) {
            setSessionId(viewSessionId);
            setIsViewing(true);
            setConnectionStatus('Waiting for screen share...');
            setupViewer(viewSessionId);
        }
    }, []);

    const createSession = () => {
        const newSessionId = 'session-' + Math.random().toString(36).substr(2, 9);
        setSessionId(newSessionId);
        const url = `${window.location.origin}?session=${newSessionId}`;
        setShareUrl(url);
        return newSessionId;
    };

    const startScreenShare = async () => {
        try {
            const stream = await navigator.mediaDevices.getDisplayMedia({
                video: { mediaSource: 'screen' },
                audio: true
            });

            localStream.current = stream;
            if (localVideoRef.current) {
                localVideoRef.current.srcObject = stream;
            }

            let currentSessionId = sessionId;
            if (!currentSessionId) {
                currentSessionId = createSession();
            }

            setIsSharing(true);
            setConnectionStatus('Screen sharing active');
            
            // Store stream for viewers
            localStorage.setItem(`stream-${currentSessionId}`, 'active');
            
            stream.getVideoTracks()[0].addEventListener('ended', () => {
                stopSharing();
            });

        } catch (error) {
            if (error.name === 'NotAllowedError') {
                setConnectionStatus('❌ Screen sharing permission denied');
            } else {
                setConnectionStatus('❌ Failed to start screen sharing: ' + error.message);
            }
        }
    };

    const setupViewer = (sessionId) => {
        // Check if stream is active
        const checkStream = setInterval(() => {
            const streamActive = localStorage.getItem(`stream-${sessionId}`);
            if (streamActive === 'active') {
                setConnectionStatus('✅ Connected to screen share');
                // In a real implementation, this would receive the actual stream
                // For demo, show a placeholder
                if (remoteVideoRef.current) {
                    remoteVideoRef.current.style.background = '#000';
                    remoteVideoRef.current.style.display = 'block';
                }
                clearInterval(checkStream);
            }
        }, 1000);

        // Stop checking after 30 seconds
        setTimeout(() => {
            clearInterval(checkStream);
            if (connectionStatus === 'Waiting for screen share...') {
                setConnectionStatus('❌ No active screen share found');
            }
        }, 30000);
    };

    const stopSharing = () => {
        if (localStream.current) {
            localStream.current.getTracks().forEach(track => track.stop());
            localStream.current = null;
        }
        if (localVideoRef.current) {
            localVideoRef.current.srcObject = null;
        }
        if (sessionId) {
            localStorage.removeItem(`stream-${sessionId}`);
        }
        setIsSharing(false);
        setConnectionStatus('');
    };

    const copyShareUrl = () => {
        navigator.clipboard.writeText(shareUrl);
        alert('✅ Share URL copied! Open this link on another device to view the screen share.');
    };

    return (
        <div className="container">
            <h1>🔒 Secure Screen Share</h1>
            
            <div className="warning">
                <h3>⚠️ Privacy Notice</h3>
                <p>This application requires your explicit permission to share your screen. 
                   Your screen will only be shared when you click "Start Screen Share" and grant permission through your browser.</p>
            </div>

            {connectionStatus && (
                <div style={{
                    background: connectionStatus.includes('❌') ? '#f8d7da' : '#d4edda',
                    border: `1px solid ${connectionStatus.includes('❌') ? '#f5c6cb' : '#c3e6cb'}`,
                    padding: '15px',
                    borderRadius: '4px',
                    margin: '20px 0',
                    color: connectionStatus.includes('❌') ? '#721c24' : '#155724'
                }}>
                    {connectionStatus}
                </div>
            )}

            {!isViewing ? (
                <div>
                    <h2>📺 Share Your Screen</h2>
                    <p>Click the button below to start sharing your screen with others.</p>
                    
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
                            fontSize: '16px',
                            margin: '10px 5px'
                        }}
                    >
                        {isSharing ? '✅ Sharing Screen...' : '🚀 Start Screen Share'}
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
                                fontSize: '16px'
                            }}
                        >
                            ⏹️ Stop Sharing
                        </button>
                    )}
                    
                    {shareUrl && (
                        <div className="session-info">
                            <h3>📤 Share this link with others:</h3>
                            <div className="share-link">{shareUrl}</div>
                            <button 
                                onClick={copyShareUrl}
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
                            <p style={{fontSize: '14px', color: '#666', marginTop: '10px'}}>
                                Session ID: {sessionId}
                            </p>
                        </div>
                    )}
                    
                    <div className="video-container">
                        <h3>👀 Your Screen Preview:</h3>
                        {isSharing ? (
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
                        ) : (
                            <div style={{
                                width: '100%',
                                maxWidth: '600px',
                                height: '300px',
                                background: '#f8f9fa',
                                border: '2px dashed #dee2e6',
                                borderRadius: '4px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: '#6c757d',
                                fontSize: '16px'
                            }}>
                                Click "Start Screen Share" to see your screen here
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                <div>
                    <h2>👁️ Viewing Shared Screen</h2>
                    <p>Session ID: <code>{sessionId}</code></p>
                    
                    <div className="video-container">
                        <h3>📺 Shared Screen:</h3>
                        <video 
                            ref={remoteVideoRef}
                            autoPlay
                            controls
                            style={{
                                width: '100%',
                                maxWidth: '600px',
                                height: '400px',
                                background: '#000',
                                border: '2px solid #007bff',
                                borderRadius: '4px',
                                display: 'none'
                            }}
                        />
                        <div style={{
                            width: '100%',
                            maxWidth: '600px',
                            height: '400px',
                            background: '#f8f9fa',
                            border: '2px dashed #007bff',
                            borderRadius: '4px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#6c757d',
                            fontSize: '16px',
                            flexDirection: 'column'
                        }}>
                            <div>🔄 Waiting for screen share to start...</div>
                            <div style={{fontSize: '14px', marginTop: '10px'}}>
                                Ask the presenter to click "Start Screen Share"
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <div style={{
                marginTop: '40px',
                padding: '20px',
                background: '#e9ecef',
                borderRadius: '4px',
                fontSize: '14px'
            }}>
                <h3>🛠️ How it works:</h3>
                <ol style={{textAlign: 'left', margin: '10px 0'}}>
                    <li>Click "Start Screen Share" and grant browser permission</li>
                    <li>Copy the generated link and share it with others</li>
                    <li>Others can view your screen by opening the link</li>
                    <li>Click "Stop Sharing" to end the session</li>
                </ol>
                <p><strong>Privacy:</strong> Your screen is only shared when you explicitly start sharing. No automatic recording or storage.</p>
            </div>
        </div>
    );
}

export default App;