let arSystem;
let peer;
let roomId;
let localStream;
let connections = [];

async function startAR() {
    try {
        localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        document.getElementById('video').srcObject = localStream;
        document.getElementById('ar-section').style.display = 'block';
        document.getElementById('room-section').style.display = 'none';

        arSystem = new MindAR.MindARThree({
            container: document.querySelector('#ar-section'),
            imageTargetSrc: 'targets.mind'
        });
        await arSystem.start();

        // Create a default AR object (e.g., a box) - this can be updated per product
        const geometry = new THREE.BoxGeometry(0.5, 0.5, 0.1);
        const material = new THREE.MeshBasicMaterial({ color: 0xff0000 });
        const productObject = new THREE.Mesh(geometry, material);
        arSystem.scene.add(productObject);

        console.log('AR started!');
    } catch (error) {
        console.error('AR failed:', error);
        alert('Camera access denied or not supported.');
    }
}

// NEW: Load products from JSON and create buttons dynamically
fetch('products.json')
    .then(response => response.json())
    .then(products => {
        const productsDiv = document.getElementById('products'); // Ensure your HTML has <div id="products"></div>
        
        products.forEach((product, index) => {
            // Create a button for each product
            const button = document.createElement('button');
            button.textContent = `Try ${product.name} (${product.brand})`;
            button.style.margin = '10px'; // Optional styling
            button.dataset.product = product.name.toLowerCase(); // For compatibility with existing code
            
            // Add click event: Open affiliate link and update AR
            button.addEventListener('click', () => {
                // Open affiliate link
                window.open(product.affiliateLink, '_blank');
                
                // AR: Switch to the product's target and update object
                if (arSystem) {
                    // Switch to the specific target (assumes targets.mind has multiple targets)
                    arSystem.switchTarget(product.targetIndex); // MindAR method for switching targets
                    
                    // Update the AR object (e.g., change color)
                    const productObject = arSystem.scene.children.find(obj => obj.geometry.type === 'BoxGeometry');
                    if (productObject && product.color) {
                        productObject.material.color.setHex(parseInt(product.color.replace('#', ''), 16));
                    }
                    
                    alert(`Trying on ${product.name}!`);
                }
                
                // For video calling: Send to friends (existing logic)
                const targetUser = prompt('Enter friend\'s ID:');
                if (targetUser) {
                    connections.forEach(conn => {
                        if (conn.peer === targetUser) {
                            conn.send({ action: 'tryOn', product: product.name.toLowerCase() });
                        }
                    });
                }
            });
            
            // Append button to the products div
            productsDiv.appendChild(button);
        });
    })
    .catch(error => console.error('Error loading products:', error));

// PeerJS setup (unchanged)
peer = new Peer();

// Room creation (unchanged, but calls startAR)
document.getElementById('create-room').addEventListener('click', () => {
    roomId = peer.id;
    document.getElementById('room-info').textContent = `Room ID: ${roomId}`;
    startAR();

    peer.on('call', (call) => {
        call.answer(localStream);
        call.on('stream', (remoteStream) => {
            displayRemoteVideo(remoteStream, call.peer);
        });
        connections.push(call);
    });

    peer.on('disconnected', () => {
        connections.forEach(conn => conn.close());
        connections = [];
        alert('Room ended.');
    });
});

// Room joining (unchanged, but calls startAR)
document.getElementById('join-room').addEventListener('click', () => {
    const inputId = document.getElementById('room-id').value;
    if (!inputId) return alert('Enter a Room ID');
    roomId = inputId;
    startAR();

    const call = peer.call(roomId, localStream);
    call.on('stream', (remoteStream) => {
        displayRemoteVideo(remoteStream, roomId);
    });
    connections.push(call);
});

// Display remote video (unchanged)
function displayRemoteVideo(stream, peerId) {
    const video = document.createElement('video');
    video.srcObject = stream;
    video.autoplay = true;
    video.style.width = '200px';
    document.getElementById('ar-section').appendChild(video);
    const label = document.createElement('p');
    label.textContent = `Friend: ${peerId}`;
    document.getElementById('ar-section').appendChild(label);
}

// Peer data handling for try-on (updated to work with dynamic products)
peer.on('connection', (conn) => {
    conn.on('data', (data) => {
        if (data.action === 'tryOn') {
            // Find the product by name and update AR
            fetch('products.json')
                .then(response => response.json())
                .then(products => {
                    const product = products.find(p => p.name.toLowerCase() === data.product);
                    if (product && arSystem) {
                        arSystem.switchTarget(product.targetIndex);
                        const productObject = arSystem.scene.children.find(obj => obj.geometry.type === 'BoxGeometry');
                        if (productObject && product.color) {
                            productObject.material.color.setHex(parseInt(product.color.replace('#', ''), 16));
                        }
                    }
                });
        }
    });
});

// Photo capture (unchanged)
document.getElementById('capture-photo').addEventListener('click', () => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = document.getElementById('video').videoWidth;
    canvas.height = document.getElementById('video').videoHeight;
    ctx.drawImage(document.getElementById('video'), 0, 0);
    const link = document.createElement('a');
    link.download = 'ar-social-room-photo.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
});

// Video recording (unchanged)
document.getElementById('record-video').addEventListener('click', () => {
    const stream = document.getElementById('video').captureStream();
    const recorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
    recorder.ondataavailable = (e) => {
        const blob = new Blob([e.data], { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.download = 'ar-social-room-video.webm';
        link.href = url;
        link.click();
        URL.revokeObjectURL(url);
    };
    recorder.start();
    alert('Recording 5 seconds...');
    setTimeout(() => recorder.stop(), 5000);
});

// Share room (unchanged)
document.getElementById('share-room').addEventListener('click', () => {
    const shareUrl = `${window.location.origin}?room=${roomId}`;
    if (navigator.share) {
        navigator.share({ title: 'Join my AR Social Room!', url: shareUrl });
    } else {
        navigator.clipboard.writeText(shareUrl);
        alert('Link copied!');
    }
});

// Window onload (unchanged)
window.onload = () => {
    const urlParams = new URLSearchParams(window.location.search);
    const roomParam = urlParams.get('room');
    if (roomParam) {
        document.getElementById('room-id').value = roomParam;
        document.getElementById('join-room').click();
    }
};

// REMOVED: Hardcoded affiliate link listeners (replaced by dynamic code above)
// document.querySelector('[data-product="shirt"]').addEventListener('click', () => { ... });
// document.querySelector('[data-product="pants"]').addEventListener('click', () => { ... });