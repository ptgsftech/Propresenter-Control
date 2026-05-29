// Global variables
let baseURL = 'http://localhost:50001';
let isConnected = false;
let audienceScreenStatus = false;
let stageScreenStatus = false;
let libraries = [];
let playlists = [];
let currentLibraryContents = [];
let currentPlaylistContents = [];
let currentLibraryUuid = null;
let currentPlaylistUuid = null;
let pollingInterval = null;
let currentPresentationId = null;

// DOM Elements
const statusDot = document.getElementById('statusDot');
const connectionText = document.getElementById('connectionText');
const statusPanel = document.getElementById('statusPanel');
const connectBtn = document.getElementById('connectBtn');
const audienceBtn = document.getElementById('audienceBtn');
const stageBtn = document.getElementById('stageBtn');
const audienceStatus = document.getElementById('audienceStatus');
const stageStatus = document.getElementById('stageStatus');
const looksList = document.getElementById('looksList');
const captureStatus = document.getElementById('captureStatus');
const activePresentation = document.getElementById('activePresentation');
const currentSlide = document.getElementById('currentSlide');
const macrosList = document.getElementById('macrosList');
const libraryList = document.getElementById('libraryList');
const playlistList = document.getElementById('playlistList');
const contentsList = document.getElementById('contentsList');
const selectedContainerName = document.getElementById('selectedContainerName');
const itemsCount = document.getElementById('itemsCount');
const disconnectBtn = document.getElementById('disconnectBtn');

// ============================================
// CONNECTION MANAGEMENT
// ============================================

// Get connection info from localStorage (set by login page)
function getConnectionInfo() {
    const ip = localStorage.getItem('proPresenterIP');
    const port = localStorage.getItem('proPresenterPort');
    const connected = localStorage.getItem('proPresenterConnected');
    
    if (!ip || !port || connected !== 'true') {
        // No connection info or not connected, redirect to login page
        console.log('No valid connection found, redirecting to login...');
        window.location.href = 'login.html';
        return null;
    }
    
    return { ip, port };
}

// Initialize connection on page load and trigger all APIs
async function initializeConnection() {
    console.log('Initializing connection...');
    
    const connectionInfo = getConnectionInfo();
    if (!connectionInfo) return;
    
    // Set the global baseURL
    baseURL = `http://${connectionInfo.ip}:${connectionInfo.port}`;
    console.log('Base URL set to:', baseURL);
    
    // Show connecting status
    statusDot.classList.remove('connected');
    connectionText.textContent = 'Connecting...';
    
    // Connect to ProPresenter and load all data
    await connectToProPresenter();
}

// Connect to ProPresenter
async function connectToProPresenter() {
    console.log('Attempting to connect to ProPresenter at:', baseURL);
    
    try {
        const response = await fetch(`${baseURL}/version`);
        if (response.ok) {
            const data = await response.json();
            isConnected = true;
            statusDot.classList.add('connected');
            connectionText.textContent = `Connected v${data.version || 'Unknown'}`;
            statusPanel.style.display = 'block';
            showSuccess(`Connected to ProPresenter v${data.version || 'Unknown'}`);
            
            // TRIGGER ALL APIS - Load all data
            await loadAllData();
            
            // Start polling for status updates
            startStatusPolling();
        } else {
            throw new Error(`HTTP ${response.status}`);
        }
    } catch (error) {
        console.error('Connection error:', error);
        isConnected = false;
        statusDot.classList.remove('connected');
        connectionText.textContent = 'Connection Failed';
        statusPanel.style.display = 'none';
        showError(`Failed to connect. Make sure ProPresenter is running on port ${localStorage.getItem('proPresenterPort')}`);
    }
}

// ============================================
// LOAD ALL DATA - Triggered after successful login
// ============================================

async function loadAllData() {
    console.log('Loading all ProPresenter data...');
    showToast('Loading ProPresenter data...', 'info');
    
    // Run all API calls in parallel for faster loading
    const promises = [
        getScreenStatus(),
        loadLibraries(),
        loadPlaylists(),
        loadLooks(),
        loadMacros(),
        getCurrentStatus()
    ];
    
    try {
        await Promise.all(promises);
        console.log('All data loaded successfully');
        showSuccess('All data loaded successfully');
    } catch (error) {
        console.error('Error loading some data:', error);
        showError('Some data could not be loaded');
    }
}

// ============================================
// SCREEN STATUS
// ============================================

async function getScreenStatus() {
    if (!isConnected) return;
    try {
        const audienceResponse = await fetch(`${baseURL}/v1/status/audience_screens`);
        if (audienceResponse.ok) {
            const audienceData = await audienceResponse.json();
            audienceScreenStatus = audienceData === true || audienceData.enabled === true;
            updateAudienceButton();
        }
        const stageResponse = await fetch(`${baseURL}/v1/status/stage_screens`);
        if (stageResponse.ok) {
            const stageData = await stageResponse.json();
            stageScreenStatus = stageData === true || stageData.enabled === true;
            updateStageButton();
        }
    } catch (error) {
        console.error('Error getting screen status:', error);
    }
}

function updateAudienceButton() {
    if (audienceScreenStatus) {
        audienceBtn.classList.remove('inactive');
        audienceBtn.classList.add('active');
        audienceStatus.classList.remove('bg-danger');
        audienceStatus.classList.add('bg-success');
        audienceStatus.textContent = 'ON';
    } else {
        audienceBtn.classList.remove('active');
        audienceBtn.classList.add('inactive');
        audienceStatus.classList.remove('bg-success');
        audienceStatus.classList.add('bg-danger');
        audienceStatus.textContent = 'OFF';
    }
}

function updateStageButton() {
    if (stageScreenStatus) {
        stageBtn.classList.remove('inactive');
        stageBtn.classList.add('active');
        stageStatus.classList.remove('bg-danger');
        stageStatus.classList.add('bg-success');
        stageStatus.textContent = 'ON';
    } else {
        stageBtn.classList.remove('active');
        stageBtn.classList.add('inactive');
        stageStatus.classList.remove('bg-success');
        stageStatus.classList.add('bg-danger');
        stageStatus.textContent = 'OFF';
    }
}

// ============================================
// LOOKS
// ============================================

async function loadLooks() {
    if (!isConnected) return;
    try {
        const response = await fetch(`${baseURL}/v1/looks`);
        if (response.ok) {
            const looks = await response.json();
            console.log('Looks loaded:', looks.length);
            if (looks.length === 0) {
                looksList.innerHTML = '<div class="text-center text-muted py-2">No looks found</div>';
            } else {
                looksList.innerHTML = looks.map(look => `
                    <div class="list-item" onclick="triggerLook('${look.id}')">
                        <i class="fas fa-palette me-2"></i> ${escapeHtml(look.name)}
                    </div>
                `).join('');
            }
        }
    } catch (error) {
        console.error('Error loading looks:', error);
    }
}

function triggerLook(id) {
    triggerAPI(`/v1/look/${id}/trigger`);
}

// ============================================
// MACROS
// ============================================

async function loadMacros() {
    if (!isConnected) return;
    try {
        const response = await fetch(`${baseURL}/v1/macros`);
        if (response.ok) {
            const macros = await response.json();
            console.log('Macros loaded:', macros.length);
            if (macros.length === 0) {
                macrosList.innerHTML = '<div class="text-center text-muted py-2">No macros found</div>';
            } else {
                macrosList.innerHTML = macros.map(macro => `
                    <div class="list-item" onclick="triggerMacro('${macro.id}')">
                        <i class="fas fa-code-branch me-2"></i> ${escapeHtml(macro.name)}
                    </div>
                `).join('');
            }
        }
    } catch (error) {
        console.error('Error loading macros:', error);
    }
}

function triggerMacro(id) {
    triggerAPI(`/v1/macro/${id}/trigger`);
}

// ============================================
// LIBRARIES
// ============================================

async function loadLibraries() {
    if (!isConnected) return;
    try {
        const response = await fetch(`${baseURL}/v1/libraries?chunked=false`);
        if (response.ok) {
            libraries = await response.json();
            console.log('Libraries loaded:', libraries.length);
            displayLibraries();
        }
    } catch (error) {
        console.error('Error loading libraries:', error);
    }
}

function displayLibraries() {
    if (libraries.length === 0) {
        libraryList.innerHTML = '<div class="text-center text-muted py-3">No libraries found</div>';
        return;
    }
    libraryList.innerHTML = libraries.map(lib => `
        <div class="list-item" onclick="selectLibrary('${lib.uuid}', '${escapeHtml(lib.name)}', this)">
            <i class="fas fa-folder-open text-primary me-2"></i>
            <strong>${escapeHtml(lib.name)}</strong>
        </div>
    `).join('');
}

async function selectLibrary(uuid, name, element) {
    if (!isConnected) return;
    currentLibraryUuid = uuid;
    currentPlaylistUuid = null;
    try {
        const response = await fetch(`${baseURL}/v1/library/${uuid}?chunked=false`);
        if (response.ok) {
            const data = await response.json();
            currentLibraryContents = data.items || [];
            selectedContainerName.textContent = name;
            itemsCount.textContent = currentLibraryContents.length;
            displayContents(currentLibraryContents, 'library');
            
            document.querySelectorAll('#libraryList .list-item, #playlistList .list-item').forEach(el => el.classList.remove('active'));
            if (element) element.classList.add('active');
        }
    } catch (error) {
        showError('Failed to load library contents');
    }
}

// ============================================
// PLAYLISTS
// ============================================

async function loadPlaylists() {
    if (!isConnected) return;
    try {
        const response = await fetch(`${baseURL}/v1/playlists?chunked=false`);
        if (response.ok) {
            playlists = await response.json();
            console.log('Playlists loaded:', playlists.length);
            displayPlaylists();
            loadPlaylistQuickList();
        }
    } catch (error) {
        console.error('Error loading playlists:', error);
    }
}

function displayPlaylists() {
    if (playlists.length === 0) {
        playlistList.innerHTML = '<div class="text-center text-muted py-3">No playlists found</div>';
        return;
    }
    playlistList.innerHTML = playlists.map(playlist => `
        <div class="list-item" onclick="selectPlaylist('${playlist.id.uuid}', '${escapeHtml(playlist.id.name)}', this)">
            <i class="fas fa-stream text-success me-2"></i>
            <strong>${escapeHtml(playlist.id.name)}</strong>
        </div>
    `).join('');
}

async function selectPlaylist(uuid, name, element) {
    if (!isConnected) return;
    currentPlaylistUuid = uuid;
    currentLibraryUuid = null;
    try {
        const response = await fetch(`${baseURL}/v1/playlist/${uuid}?chunked=false`);
        if (response.ok) {
            const data = await response.json();
            currentPlaylistContents = data.items || [];
            selectedContainerName.textContent = name;
            itemsCount.textContent = currentPlaylistContents.length;
            displayContents(currentPlaylistContents, 'playlist');
            
            document.querySelectorAll('#playlistList .list-item, #libraryList .list-item').forEach(el => el.classList.remove('active'));
            if (element) element.classList.add('active');
        }
    } catch (error) {
        showError('Failed to load playlist contents');
    }
}

function displayContents(items, type) {
    if (!items || items.length === 0) {
        contentsList.innerHTML = '<div class="text-center text-muted py-3">No items found</div>';
        return;
    }
    contentsList.innerHTML = items.map(item => `
        <div class="list-item d-flex justify-content-between align-items-center" onclick="triggerMediaItem('${type}', '${item.uuid}', '${escapeHtml(item.name)}')">
            <div>
                <i class="fas fa-file-alt me-2"></i>
                <span>${escapeHtml(item.name)}</span>
            </div>
        </div>
    `).join('');
}

async function triggerMediaItem(type, uuid, name) {
    if (!isConnected) return;
    try {
        if (type === 'library') {
            const focusResponse = await fetch(`${baseURL}/v1/presentation/${uuid}/focus`, { method: 'GET' });
            if (focusResponse.ok) {
                showSuccess(`Focused: ${name}`);
                currentPresentationId = uuid;
                const triggerResponse = await fetch(`${baseURL}/v1/presentation/${uuid}/trigger`, { method: 'GET' });
                if (triggerResponse.ok) {
                    showSuccess(`Triggered: ${name}`);
                    await getPresentationDetailsAndDisplay(uuid);
                }
            }
        } else {
            const endpoint = `/v1/playlist/${currentPlaylistUuid}/${uuid}/trigger`;
            const response = await fetch(`${baseURL}${endpoint}`, { method: 'GET' });
            if (response.ok) {
                showSuccess(`Triggered: ${name}`);
            }
        }
    } catch (error) {
        console.error('Error:', error);
        showError('Failed to trigger');
    }
}

async function loadPlaylistQuickList() {
    const container = document.getElementById('playlistQuickList');
    if (!container) return;
    
    if (playlists.length === 0) {
        container.innerHTML = '<div class="text-center text-muted py-2">No playlists found</div>';
        return;
    }
    container.innerHTML = playlists.slice(0, 10).map(playlist => `
        <div class="playlist-quick-item" onclick="triggerPlaylist('${playlist.id.uuid}')">
            <i class="fas fa-play-circle text-success me-2"></i> ${escapeHtml(playlist.id.name)}
        </div>
    `).join('');
}

async function triggerPlaylist(uuid) {
    if (!isConnected) return;
    try {
        const response = await fetch(`${baseURL}/v1/playlist/${uuid}/trigger`, { method: 'GET' });
        if (response.ok) {
            showSuccess('Playlist triggered');
        }
    } catch (error) {
        showError('Failed to trigger playlist');
    }
}

// ============================================
// PRESENTATION DETAILS
// ============================================

async function getPresentationDetailsAndDisplay(presentationId) {
    try {
        const response = await fetch(`${baseURL}/v1/presentation/${presentationId}`);
        if (response.ok) {
            const data = await response.json();
            const presentation = data.presentation || data;
            const allSlides = [];
            let slideIndex = 0;
            if (presentation.groups) {
                presentation.groups.forEach(group => {
                    if (group.slides) {
                        group.slides.forEach(slide => {
                            allSlides.push({
                                index: slideIndex,
                                groupName: group.name,
                                groupColor: group.color || { red: 0.5, green: 0.5, blue: 0.5, alpha: 1 },
                                text: slide.text || '',
                                label: slide.label || `Slide ${slideIndex + 1}`,
                                enabled: slide.enabled !== false
                            });
                            slideIndex++;
                        });
                    }
                });
            }
            document.getElementById('activePresentation').textContent = presentation.name || 'Unknown';
            displayAllSlidesInMain(presentation.name, allSlides, presentationId);
        }
    } catch (error) {
        console.error('Error loading presentation details:', error);
        showError('Failed to load presentation details');
    }
}

function displayAllSlidesInMain(presentationName, slides, presentationId) {
    const slideImageWrapper = document.getElementById('slideImageWrapper');
    const slidePlaceholder = document.getElementById('slidePlaceholder');
    if (!slides || slides.length === 0) {
        slidePlaceholder.style.display = 'block';
        slideImageWrapper.style.display = 'none';
        slidePlaceholder.innerHTML = '<i class="fas fa-image fa-4x mb-3"></i><p class="mb-0">No slides found</p>';
        return;
    }
    slidePlaceholder.style.display = 'none';
    slideImageWrapper.style.display = 'block';
    
    const slidesHTML = `
        <div class="slides-gallery">
            <div class="slides-header mb-3">
                <h6 class="text-info mb-2">${escapeHtml(presentationName)}</h6>
                <p class="text-muted small">Total Slides: ${slides.length}</p>
                <hr class="border-secondary">
            </div>
            <div class="slides-grid">
                ${slides.map(slide => {
                    const r = Math.round((slide.groupColor.red) * 255);
                    const g = Math.round((slide.groupColor.green) * 255);
                    const b = Math.round((slide.groupColor.blue) * 255);
                    return `
                        <div class="slide-card" onclick="loadAndTriggerSlide('${presentationId}', ${slide.index}, this)">
                            <div class="slide-thumbnail-container" id="thumb-container-${slide.index}">
                                <div class="slide-thumbnail-placeholder">
                                    <i class="fas fa-spinner fa-spin"></i>
                                    <span>Loading...</span>
                                </div>
                                <img class="slide-thumbnail" id="slide-thumb-${slide.index}" style="display: none;">
                            </div>
                            <div class="slide-info">
                                <div class="slide-label">${escapeHtml(slide.label)}</div>
                                <div class="slide-group">
                                    <span class="group-color" style="background: rgb(${r}, ${g}, ${b});"></span>
                                    <span class="group-name">${escapeHtml(slide.groupName)}</span>
                                </div>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
    `;
    slideImageWrapper.innerHTML = slidesHTML;
    slides.forEach(slide => {
        loadSlideThumbnail(presentationId, slide.index);
    });
}

async function loadSlideThumbnail(presentationId, slideIndex) {
    const thumbnailUrl = `${baseURL}/v1/presentation/${presentationId}/thumbnail/${slideIndex}?quality=300`;
    const imgElement = document.getElementById(`slide-thumb-${slideIndex}`);
    const placeholderContainer = document.querySelector(`#thumb-container-${slideIndex} .slide-thumbnail-placeholder`);
    if (!imgElement) return;
    try {
        const response = await fetch(thumbnailUrl);
        if (response.ok) {
            const blob = await response.blob();
            const imageUrl = URL.createObjectURL(blob);
            imgElement.src = imageUrl;
            imgElement.style.display = 'block';
            if (placeholderContainer) placeholderContainer.style.display = 'none';
            imgElement.onload = () => URL.revokeObjectURL(imageUrl);
        }
    } catch (error) {
        console.error('Error loading thumbnail:', error);
    }
}

async function loadAndTriggerSlide(presentationId, slideIndex, element) {
    document.querySelectorAll('.slide-card').forEach(card => card.classList.remove('active'));
    if (element) element.classList.add('active');
    if (!isConnected) return;
    try {
        const response = await fetch(`${baseURL}/v1/presentation/${presentationId}/${slideIndex}/trigger`, { method: 'GET' });
        if (response.ok) {
            showSuccess(`Triggered slide ${slideIndex + 1}`);
            document.getElementById('currentSlide').textContent = `Slide ${slideIndex + 1}`;
        }
    } catch (error) {
        showError('Failed to trigger slide');
    }
}

// ============================================
// CURRENT STATUS
// ============================================

async function getCurrentStatus() {
    if (!isConnected) return;
    try {
        const presentationResponse = await fetch(`${baseURL}/v1/presentation/active`);
        if (presentationResponse.ok) {
            const presentation = await presentationResponse.json();
            activePresentation.textContent = presentation.name || 'Unknown';
            if (presentation.id && presentation.id.uuid) {
                currentPresentationId = presentation.id.uuid;
                const slideResponse = await fetch(`${baseURL}/v1/presentation/slide_index`);
                if (slideResponse.ok) {
                    const slideIndex = await slideResponse.json();
                    const currentIndex = slideIndex.index;
                    document.getElementById('currentSlide').textContent = currentIndex !== undefined ? `Slide ${currentIndex + 1}` : '-';
                    if (currentIndex !== undefined && currentPresentationId) {
                        const thumbnailUrl = `${baseURL}/v1/presentation/${currentPresentationId}/thumbnail/${currentIndex}?quality=500`;
                        const imgResponse = await fetch(thumbnailUrl);
                        if (imgResponse.ok) {
                            const blob = await imgResponse.blob();
                            const imageUrl = URL.createObjectURL(blob);
                            updateMainSlideDisplay(imageUrl, currentIndex);
                        }
                    }
                }
            }
        }
    } catch (error) {
        console.error('Error getting current status:', error);
    }
}

function updateMainSlideDisplay(imageUrl, slideIndex) {
    const slideImageWrapper = document.getElementById('slideImageWrapper');
    const slidePlaceholder = document.getElementById('slidePlaceholder');
    const mainSlideImage = document.getElementById('currentSlideImage');
    if (imageUrl && mainSlideImage) {
        mainSlideImage.src = imageUrl;
        slideImageWrapper.style.display = 'block';
        slidePlaceholder.style.display = 'none';
        document.getElementById('currentSlide').textContent = `Slide ${slideIndex + 1}`;
    }
}

// ============================================
// GENERIC API TRIGGER
// ============================================

async function triggerAPI(endpoint) {
    if (!isConnected) return showError('Not connected');
    try {
        const response = await fetch(`${baseURL}${endpoint}`, { method: 'GET' });
        if (response.ok) showSuccess('Command executed');
    } catch (error) {
        showError('Failed');
    }
}

function timelineOperation(operation) {
    triggerAPI(`/v1/presentation/active/timeline/${operation}`);
}

function clearLayer(layer) {
    triggerAPI(`/v1/clear/layer/${layer}`);
}

// ============================================
// STAGE MESSAGE FUNCTIONS
// ============================================

async function sendStageMessage() {
    const messageInput = document.getElementById('stageMessageText');
    const message = messageInput?.value;
    if (!message?.trim()) {
        showError('Please enter a stage message');
        return;
    }
    try {
        const response = await fetch(`${baseURL}/v1/stage/message`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: message })
        });
        if (response.ok) {
            showSuccess('Stage message sent');
            document.getElementById('stageMessageStatus').innerHTML = `<span class="text-info">${escapeHtml(message)}</span>`;
            messageInput.value = '';
        }
    } catch (error) {
        showError('Failed to send stage message');
    }
}

async function clearStageMessage() {
    try {
        const response = await fetch(`${baseURL}/v1/stage/message`, { method: 'DELETE' });
        if (response.ok) {
            showSuccess('Stage message cleared');
            document.getElementById('stageMessageStatus').innerHTML = 'No active message';
        }
    } catch (error) {
        showError('Failed to clear stage message');
    }
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function startStatusPolling() {
    if (pollingInterval) clearInterval(pollingInterval);
    pollingInterval = setInterval(() => {
        if (isConnected) {
            getCurrentStatus();
            getScreenStatus();
        }
    }, 5000);
}

function showSuccess(message) { showToast(message, 'success'); }
function showError(message) { showToast(message, 'danger'); }

function showToast(message, type) {
    const toast = document.createElement('div');
    toast.className = `position-fixed bottom-0 end-0 p-3 m-3 rounded text-white bg-${type}`;
    toast.style.zIndex = '9999';
    toast.style.animation = 'slideIn 0.3s ease-out';
    toast.innerHTML = `<div class="d-flex align-items-center"><i class="fas ${type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'} me-2"></i><div>${message}</div></div>`;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

// ============================================
// DISCONNECT FUNCTION
// ============================================

function disconnectAndLogout() {
    // Clear localStorage
    localStorage.removeItem('proPresenterIP');
    localStorage.removeItem('proPresenterPort');
    localStorage.removeItem('proPresenterConnected');
    localStorage.removeItem('proPresenterVersion');
    localStorage.removeItem('proPresenterBaseURL');
    localStorage.removeItem('proPresenterAPIs');
    localStorage.removeItem('proPresenterLastConnected');
    
    // Stop polling
    if (pollingInterval) {
        clearInterval(pollingInterval);
        pollingInterval = null;
    }
    
    // Redirect to login page
    window.location.href = 'login.html';
}

// ============================================
// EVENT LISTENERS
// ============================================

// Disconnect button
if (disconnectBtn) {
    disconnectBtn.addEventListener('click', disconnectAndLogout);
}

// Control buttons
document.getElementById('startCaptureBtn')?.addEventListener('click', () => fetch(`${baseURL}/v1/capture/start`, { method: 'GET' }).catch(e => console.log(e)));
document.getElementById('stopCaptureBtn')?.addEventListener('click', () => fetch(`${baseURL}/v1/capture/stop`, { method: 'GET' }).catch(e => console.log(e)));
document.getElementById('startPresentationBtn')?.addEventListener('click', () => triggerAPI('/v1/presentation/active/trigger'));
document.getElementById('nextSlideBtn')?.addEventListener('click', () => triggerAPI('/v1/presentation/active/next/trigger'));
document.getElementById('prevSlideBtn')?.addEventListener('click', () => triggerAPI('/v1/presentation/active/previous/trigger'));
document.getElementById('clearSlideBtn')?.addEventListener('click', () => clearLayer('slide'));
document.getElementById('playMediaBtn')?.addEventListener('click', () => triggerAPI('/v1/media/playlist/active/trigger'));
document.getElementById('nextMediaBtn')?.addEventListener('click', () => triggerAPI('/v1/media/playlist/active/next/trigger'));
document.getElementById('prevMediaBtn')?.addEventListener('click', () => triggerAPI('/v1/media/playlist/active/previous/trigger'));
document.getElementById('stopMediaBtn')?.addEventListener('click', () => clearLayer('media'));
document.getElementById('timelinePlayBtn')?.addEventListener('click', () => timelineOperation('play'));
document.getElementById('timelinePauseBtn')?.addEventListener('click', () => timelineOperation('pause'));
document.getElementById('timelineRewindBtn')?.addEventListener('click', () => timelineOperation('rewind'));
document.getElementById('stageScreenBtn')?.addEventListener('click', async () => {
    const newStatus = !stageScreenStatus;
    try {
        await fetch(`${baseURL}/v1/status/stage_screens`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newStatus)
        });
        stageScreenStatus = newStatus;
        updateStageButton();
        showSuccess(`Stage screen ${newStatus ? 'ON' : 'OFF'}`);
    } catch (error) {
        showError('Failed to toggle stage screen');
    }
});
document.getElementById('sendStageMessageBtn')?.addEventListener('click', sendStageMessage);
document.getElementById('clearStageMessageBtn')?.addEventListener('click', clearStageMessage);
document.getElementById('stageMonitorBtn')?.addEventListener('click', showStageMonitorModal);
audienceBtn?.addEventListener('click', async () => {
    const newStatus = !audienceScreenStatus;
    try {
        await fetch(`${baseURL}/v1/status/audience_screens`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newStatus)
        });
        audienceScreenStatus = newStatus;
        updateAudienceButton();
        showSuccess(`Audience screen ${newStatus ? 'ON' : 'OFF'}`);
    } catch (error) {
        showError('Failed to toggle audience screen');
    }
});

// Make functions global
window.selectLibrary = selectLibrary;
window.selectPlaylist = selectPlaylist;
window.triggerMediaItem = triggerMediaItem;
window.triggerLook = triggerLook;
window.triggerMacro = triggerMacro;
window.loadAndTriggerSlide = loadAndTriggerSlide;
window.triggerPlaylist = triggerPlaylist;

// ============================================
// INITIALIZE PAGE
// ============================================

// Add CSS for slides grid if not exists
if (!document.querySelector('#slides-grid-style')) {
    const style = document.createElement('style');
    style.id = 'slides-grid-style';
    style.textContent = `
        .slides-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
            gap: 12px;
            max-height: 500px;
            overflow-y: auto;
            padding: 10px;
        }
        .slide-card {
            background: #2d2d2d;
            border: 1px solid #404040;
            border-radius: 8px;
            overflow: hidden;
            cursor: pointer;
            transition: all 0.3s ease;
        }
        .slide-card:hover {
            transform: translateY(-3px);
            border-color: #6366f1;
        }
        .slide-card.active {
            border-color: #6366f1;
            background: #3a3a6a;
        }
        .slide-thumbnail-container {
            width: 100%;
            height: 100px;
            background: #1a1a1a;
            display: flex;
            align-items: center;
            justify-content: center;
            overflow: hidden;
        }
        .slide-thumbnail {
            width: 100%;
            height: 100%;
            object-fit: cover;
        }
        .slide-thumbnail-placeholder {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 5px;
            color: #6c757d;
            font-size: 11px;
        }
        @keyframes slideIn {
            from { transform: translateX(100%); }
            to { transform: translateX(0); }
        }
    `;
    document.head.appendChild(style);
}

// Initialize the page
document.addEventListener('DOMContentLoaded', function() {
    console.log('Page loaded, initializing connection...');
    initializeConnection();
});

function updateSystemTime() {
    const now = new Date();
    const time = now.toLocaleTimeString('en-US', { hour12: false });
    const date = now.toLocaleDateString('en-US');
    document.getElementById('systemTime').textContent = time;
    document.getElementById('systemDate').textContent = date;
}

// ============================================
// STAGE MONITOR - QR Code and URL Generation
// ============================================

// Function to get current server IP and port for stage monitor
function getStageMonitorUrl() {
    // Get the current server address
    let serverIp = window.location.hostname;
    let serverPort = window.location.port;
    let proPresenterPort = localStorage.getItem('proPresenterPort') || '50001';
    
    // If localhost, use the actual IP from localStorage
    if (serverIp === 'localhost' || serverIp === '127.0.0.1') {
        serverIp = localStorage.getItem('proPresenterIP') || serverIp;
    }
    
    // Build the URL
    let baseUrl;
    if (serverPort && serverPort !== '80' && serverPort !== '443') {
        baseUrl = `${window.location.protocol}//${serverIp}:${serverPort}`;
    } else {
        baseUrl = `${window.location.protocol}//${serverIp}`;
    }
    
    return `${baseUrl}/pages/stageMonitor.html?ip=${encodeURIComponent(serverIp)}&port=${proPresenterPort}`;
}

// Open Stage Monitor in new window
function openStageMonitor() {
    const url = getStageMonitorUrl();
    window.open(url, '_blank', 'width=1280,height=720,resizable=yes');
}

// Generate QR Code for Stage Monitor
function generateStageMonitorQR() {
    const url = getStageMonitorUrl();
    const stageMonitorUrlInput = document.getElementById('stageMonitorUrl');
    const stageMonitorLink = document.getElementById('stageMonitorLink');
    
    if (stageMonitorUrlInput) {
        stageMonitorUrlInput.value = url;
    }
    if (stageMonitorLink) {
        stageMonitorLink.href = url;
    }
    
    // Clear existing QR code
    const qrcodeDiv = document.getElementById('qrcode');
    if (qrcodeDiv) {
        qrcodeDiv.innerHTML = '';
        
        // Check if QRCode library is loaded
        if (typeof QRCode !== 'undefined') {
            // Generate QR code using the library
            new QRCode(qrcodeDiv, {
                text: url,
                width: 200,
                height: 200,
                colorDark: "#ffd700",
                colorLight: "#000000",
                correctLevel: QRCode.CorrectLevel.H
            });
        } else {
            // Fallback: Create simple text display
            qrcodeDiv.innerHTML = `
                <div class="alert alert-info">
                    <i class="fas fa-info-circle"></i> 
                    <span class="small">URL: ${url}</span>
                </div>
                <canvas id="qrCanvas" width="200" height="200"></canvas>
            `;
            // You can use a canvas-based QR generator here if needed
            generateSimpleQR(url);
        }
    }
}

// Simple QR code fallback using canvas (if library not loaded)
function generateSimpleQR(text) {
    const canvas = document.getElementById('qrCanvas');
    if (!canvas) return;
    
    // Simple fallback - display as text
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, 200, 200);
    ctx.fillStyle = '#ffd700';
    ctx.font = '12px monospace';
    ctx.fillText('Scan with QR app', 50, 100);
    ctx.fillText(text.substring(0, 30) + '...', 10, 130);
}

// Copy URL to clipboard
function copyStageMonitorUrl() {
    const urlInput = document.getElementById('stageMonitorUrl');
    if (urlInput) {
        urlInput.select();
        urlInput.setSelectionRange(0, 99999);
        document.execCommand('copy');
        showSuccess('Stage Monitor URL copied to clipboard!');
        
        // Modern way
        if (navigator.clipboard) {
            navigator.clipboard.writeText(urlInput.value).then(() => {
                showSuccess('Stage Monitor URL copied to clipboard!');
            }).catch(() => {
                showSuccess('URL copied!');
            });
        }
    }
}

// Show Stage Monitor Modal
function showStageMonitorModal() {
    generateStageMonitorQR();
    const modalElement = document.getElementById('stageMonitorModal');
    if (modalElement) {
        const modal = new bootstrap.Modal(modalElement);
        modal.show();
    }
}

// Get simple access URL for display
function getSimpleAccessUrl() {
    const serverIp = localStorage.getItem('proPresenterIP') || window.location.hostname;
    const serverPort = window.location.port;
    if (serverPort && serverPort !== '80' && serverPort !== '443') {
        return `${window.location.protocol}//${serverIp}:${serverPort}/stageMonitor.html`;
    }
    return `${window.location.protocol}//${serverIp}/stageMonitor.html`;
}

setInterval(updateSystemTime, 1000);
updateSystemTime();