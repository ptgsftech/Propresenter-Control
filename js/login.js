// Get DOM elements
const ipInput = document.getElementById('ipAddress');
const portInput = document.getElementById('port');
const connectBtn = document.getElementById('connectBtn');
const connectionForm = document.getElementById('connectionForm');

// Load saved values from localStorage
if (localStorage.getItem('proPresenterIP')) {
    ipInput.value = localStorage.getItem('proPresenterIP');
}
if (localStorage.getItem('proPresenterPort')) {
    portInput.value = localStorage.getItem('proPresenterPort');
}

// Form submit handler
connectionForm.addEventListener('submit', function (e) {
    e.preventDefault();
    connectToProPresenter();
});

// Connect function
async function connectToProPresenter() {
    const ip = ipInput.value.trim();
    const port = portInput.value.trim();

    // Validation
    if (!ip) {
        showToast('Please enter an IP address', 'error');
        ipInput.focus();
        return;
    }

    if (!port) {
        showToast('Please enter a port number', 'error');
        portInput.focus();
        return;
    }

    // Validate IP format (basic)
    const ipPattern = /^(\d{1,3}\.){3}\d{1,3}$/;
    if (!ipPattern.test(ip)) {
        showToast('Please enter a valid IP address', 'error');
        ipInput.focus();
        return;
    }

    // Validate port range
    const portNum = parseInt(port);
    if (portNum < 1 || portNum > 65535) {
        showToast('Port must be between 1 and 65535', 'error');
        portInput.focus();
        return;
    }

    // Save connection info to localStorage
    localStorage.setItem('proPresenterIP', ip);
    localStorage.setItem('proPresenterPort', port);
    localStorage.setItem('proPresenterConnected', 'false'); // Will be set to true after successful connection

    // Show connecting state
    const originalText = connectBtn.innerHTML;
    connectBtn.innerHTML = '<i class="fas fa-spinner"></i> Connecting...';
    connectBtn.disabled = true;

    // Test connection
    const baseURL = `http://${ip}:${port}`;

    try {
        // First, test the connection by fetching version
        const versionResponse = await fetch(`${baseURL}/version`, {
            method: 'GET',
            mode: 'cors',
            headers: {
                'Accept': 'application/json'
            }
        });

        if (versionResponse.ok) {
            const versionData = await versionResponse.json();

            const serverPort = window.location.port || '80';
            const serverProtocol = window.location.protocol;
            localStorage.setItem('serverProtocol', serverProtocol);
            localStorage.setItem('serverHost', window.location.hostname);
            localStorage.setItem('serverPort', serverPort);

            // Test API endpoints to ensure they work
            let apiStatus = {
                libraries: false,
                playlists: false,
                looks: false,
                macros: false
            };

            // Test libraries API
            try {
                const libResponse = await fetch(`${baseURL}/v1/libraries?chunked=false`);
                apiStatus.libraries = libResponse.ok;
            } catch (e) { console.log('Libraries API not available'); }

            // Test playlists API
            try {
                const playResponse = await fetch(`${baseURL}/v1/playlists?chunked=false`);
                apiStatus.playlists = playResponse.ok;
            } catch (e) { console.log('Playlists API not available'); }

            // Test looks API
            try {
                const looksResponse = await fetch(`${baseURL}/v1/looks`);
                apiStatus.looks = looksResponse.ok;
            } catch (e) { console.log('Looks API not available'); }

            // Test macros API
            try {
                const macrosResponse = await fetch(`${baseURL}/v1/macros`);
                apiStatus.macros = macrosResponse.ok;
            } catch (e) { console.log('Macros API not available'); }

            // Store all connection info
            localStorage.setItem('proPresenterConnected', 'true');
            localStorage.setItem('proPresenterVersion', versionData.version || 'Unknown');
            localStorage.setItem('proPresenterBaseURL', baseURL);
            localStorage.setItem('proPresenterAPIs', JSON.stringify(apiStatus));

            showToast(`Connected successfully to v${versionData.version || 'Unknown'}`, 'success');

            // Store connection timestamp
            localStorage.setItem('proPresenterLastConnected', new Date().toISOString());

            // Redirect to main page after short delay
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 1000);
        } else {
            throw new Error(`HTTP ${versionResponse.status}`);
        }
    } catch (error) {
        console.error('Connection error:', error);
        showToast(`Failed to connect to ${ip}:${port}. Make sure ProPresenter is running.`, 'error');
        connectBtn.innerHTML = originalText;
        connectBtn.disabled = false;
        localStorage.setItem('proPresenterConnected', 'false');
    }
}

// Toast notification function
function showToast(message, type) {
    // Remove existing toast
    const existingToast = document.querySelector('.custom-toast');
    if (existingToast) existingToast.remove();

    // Create toast element
    const toast = document.createElement('div');
    toast.className = 'custom-toast';

    // Set icon and color based on type
    let icon = 'fa-info-circle';
    let bgColor = '#6366f1';

    if (type === 'success') {
        icon = 'fa-check-circle';
        bgColor = '#10b981';
    } else if (type === 'error') {
        icon = 'fa-exclamation-circle';
        bgColor = '#ef4444';
    }

    toast.innerHTML = `
        <div style="display: flex; align-items: center; gap: 10px;">
            <i class="fas ${icon}"></i>
            <span>${message}</span>
        </div>
    `;

    toast.style.background = bgColor;
    toast.style.color = 'white';
    toast.style.padding = '12px 24px';
    toast.style.borderRadius = '12px';
    toast.style.fontSize = '14px';
    toast.style.fontWeight = '500';
    toast.style.position = 'fixed';
    toast.style.bottom = '30px';
    toast.style.left = '50%';
    toast.style.transform = 'translateX(-50%)';
    toast.style.zIndex = '10000';
    toast.style.animation = 'slideUp 0.3s ease-out';
    toast.style.boxShadow = '0 8px 20px rgba(0,0,0,0.2)';
    toast.style.whiteSpace = 'nowrap';

    document.body.appendChild(toast);

    // Auto remove after 3 seconds
    setTimeout(() => {
        toast.style.animation = 'slideDown 0.3s ease-out';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Enter key support
ipInput.addEventListener('keypress', function (e) {
    if (e.key === 'Enter') {
        e.preventDefault();
        portInput.focus();
    }
});

portInput.addEventListener('keypress', function (e) {
    if (e.key === 'Enter') {
        e.preventDefault();
        connectToProPresenter();
    }
});

// Auto-focus on IP input on page load
window.addEventListener('DOMContentLoaded', function () {
    ipInput.focus();
});