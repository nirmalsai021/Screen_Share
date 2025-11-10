import React, { useState, useRef, useEffect } from 'react';

function App() {
    const [sessionId, setSessionId] = useState(null);
    const [isSharing, setIsSharing] = useState(false);
    const [shareUrl, setShareUrl] = useState('');
    const [isViewing, setIsViewing] = useState(false);
    const [status, setStatus] = useState('');
    const localVideoRef = useRef(null);
    const remoteVideoRef = useRef(null);
    const streamChannel = useRef(null);

    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const viewSessionId = urlParams.get('session');
        if (viewSessionId) {
            setSessionId(viewSessionId);
            setIsViewing(true);
            setStatus('Connecting to screen share...');
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
            setStatus('✅ Screen sharing active');

            // Create broadcast channel for real-time sharing
            streamChannel.current = new BroadcastChannel(`stream-${newSessionId}`);
            
            // Capture and broadcast frames
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const video = document.createElement('video');
            video.srcObject = stream;
            video.play();

            video.onloadedmetadata = () => {
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                
                const broadcastFrame = () => {
                    if (isSharing && streamChannel.current) {
                        ctx.drawImage(video, 0, 0);
                        const imageData = canvas.toDataURL('image/jpeg', 0.5);
                        streamChannel.current.postMessage({
                            type: 'frame',
                            data: imageData,
                            timestamp: Date.now()
                        });
                        setTimeout(broadcastFrame, 200); // 5 FPS
                    }
                };
                broadcastFrame();
            };

            stream.getVideoTracks()[0].addEventListener('ended', () => {
                stopSharing();
            });

        } catch (error) {
            setStatus('❌ Permission denied: ' + error.message);
        }
    };

    const setupViewer = (sessionId) => {
        const channel = new BroadcastChannel(`stream-${sessionId}`);
        
        channel.onmessage = (event) => {
            if (event.data.type === 'frame') {
                setStatus('✅ Receiving live screen share');
                if (remoteVideoRef.current) {
                    remoteVideoRef.current.src = event.data.data;
                }
            }
        };

        // Timeout if no stream
        setTimeout(() => {
            if (status === 'Connecting to screen share...') {
                setStatus('❌ No active screen share found. Ask presenter to start sharing.');
            }
        }, 5000);
    };

    const stopSharing = () => {
        if (localVideoRef.current && localVideoRef.current.srcObject) {
            localVideoRef.current.srcObject.getTracks().forEach(track => track.stop());
            localVideoRef.current.srcObject = null;
        }
        if (streamChannel.current) {
            streamChannel.current.close();
        }
        setIsSharing(false);
        setStatus('');
    };

    const copyLink = () => {
        navigator.clipboard.writeText(shareUrl);
        alert('✅ Link copied! Open in another browser tab to test viewing.');
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
                        <img 
                            ref={remoteVideoRef} 
                            alt="Live screen share"
                            style={{
                                width: '100%', 
                                maxWidth: '600px',
                                border: '2px solid #007bff',
                                borderRadius: '4px',
                                minHeight: '300px',
                                background: '#f8f9fa'
                            }}
                        />
                    </div>
                    
                    <div style={{marginTop: '20px', fontSize: '14px', color: '#666'}}>
                        <p>💡 <strong>Tip:</strong> If you don't see the screen, make sure the presenter has started sharing and both tabs are in the same browser.</p>
                    </div>
                </div>
            )}
        </div>
    );
}

export default App;