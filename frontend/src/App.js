import React, { useState, useRef, useEffect } from 'react';

function App() {
    const [sessionId, setSessionId] = useState(null);
    const [isSharing, setIsSharing] = useState(false);
    const [shareUrl, setShareUrl] = useState('');
    const [isViewing, setIsViewing] = useState(false);
    const [status, setStatus] = useState('');
    const localVideoRef = useRef(null);
    const remoteVideoRef = useRef(null);

    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const viewSessionId = urlParams.get('session');
        if (viewSessionId) {
            setSessionId(viewSessionId);
            setIsViewing(true);
            setStatus('Waiting for screen share...');
            checkForStream(viewSessionId);
        }
    }, []);

    const startScreenShare = async () => {
        try {
            const stream = await navigator.mediaDevices.getDisplayMedia({
                video: true,
                audio: true
            });

            // Show local preview
            localVideoRef.current.srcObject = stream;

            // Create session
            const newSessionId = 'session-' + Date.now();
            setSessionId(newSessionId);
            setShareUrl(`${window.location.origin}?session=${newSessionId}`);
            setIsSharing(true);
            setStatus('✅ Screen sharing active');

            // Store stream data for other viewers
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const video = document.createElement('video');
            video.srcObject = stream;
            video.play();

            video.onloadedmetadata = () => {
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                
                const captureFrame = () => {
                    if (isSharing) {
                        ctx.drawImage(video, 0, 0);
                        const imageData = canvas.toDataURL('image/jpeg', 0.8);
                        localStorage.setItem(`stream-${newSessionId}`, imageData);
                        setTimeout(captureFrame, 100); // 10 FPS
                    }
                };
                captureFrame();
            };

            stream.getVideoTracks()[0].addEventListener('ended', () => {
                stopSharing();
            });

        } catch (error) {
            setStatus('❌ Permission denied or error: ' + error.message);
        }
    };

    const checkForStream = (sessionId) => {
        const interval = setInterval(() => {
            const imageData = localStorage.getItem(`stream-${sessionId}`);
            if (imageData) {
                setStatus('✅ Connected - viewing screen');
                if (remoteVideoRef.current) {
                    remoteVideoRef.current.src = imageData;
                }
            }
        }, 200);

        setTimeout(() => clearInterval(interval), 30000);
    };

    const stopSharing = () => {
        if (localVideoRef.current && localVideoRef.current.srcObject) {
            localVideoRef.current.srcObject.getTracks().forEach(track => track.stop());
            localVideoRef.current.srcObject = null;
        }
        if (sessionId) {
            localStorage.removeItem(`stream-${sessionId}`);
        }
        setIsSharing(false);
        setStatus('');
    };

    const copyLink = () => {
        navigator.clipboard.writeText(shareUrl);
        alert('Link copied! Open on another device to view screen.');
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
                    <h2>Share Your Screen</h2>
                    <button onClick={startScreenShare} disabled={isSharing}>
                        {isSharing ? '✅ Sharing...' : '🚀 Start Screen Share'}
                    </button>
                    {isSharing && (
                        <button onClick={stopSharing} style={{marginLeft: '10px'}}>
                            ⏹️ Stop
                        </button>
                    )}
                    
                    {shareUrl && (
                        <div className="session-info">
                            <h3>Share this link:</h3>
                            <div className="share-link">{shareUrl}</div>
                            <button onClick={copyLink}>📋 Copy Link</button>
                        </div>
                    )}
                    
                    <div className="video-container">
                        <h3>Your Screen:</h3>
                        <video ref={localVideoRef} autoPlay muted style={{width: '100%', maxWidth: '600px'}} />
                    </div>
                </div>
            ) : (
                <div>
                    <h2>Viewing Screen</h2>
                    <p>Session: {sessionId}</p>
                    <div className="video-container">
                        <img 
                            ref={remoteVideoRef} 
                            alt="Shared screen"
                            style={{width: '100%', maxWidth: '600px', border: '1px solid #ccc'}}
                        />
                    </div>
                </div>
            )}
        </div>
    );
}

export default App;