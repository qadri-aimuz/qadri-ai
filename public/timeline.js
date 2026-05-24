const { ipcRenderer } = require('electron');
const path = require('path');

lucide.createIcons();

const track = document.getElementById('timelineTrack');
const recordBtn = document.getElementById('toggleRecordBtn');
const recordDot = document.getElementById('recordDot');
const recordText = document.getElementById('recordStatusText');
const searchInput = document.getElementById('searchInput');

let isRecording = true;
let allMemories = [];

async function loadMemories() {
    allMemories = await ipcRenderer.invoke('get-timeline-memories');
    renderMemories(allMemories);
}

function renderMemories(memories) {
    track.innerHTML = '';
    
    if(memories.length === 0) {
        track.innerHTML = '<p style="color: #8a8a9e; grid-column: 1/-1; text-align: center; margin-top: 50px;">No memories recorded yet.</p>';
        return;
    }

    memories.forEach(mem => {
        const card = document.createElement('div');
        card.className = 'memory-card';
        
        // We will load the image via a custom protocol or absolute path
        const imgPath = mem.imageFile ? `file://${mem.imagePath}` : 'fallback.png';
        
        card.innerHTML = `
            <img src="${imgPath}" class="memory-img" alt="Memory Snapshot">
            <div class="memory-details">
                <div class="memory-time">${new Date(mem.timestamp).toLocaleTimeString()} - ${new Date(mem.timestamp).toLocaleDateString()}</div>
                <div class="memory-app">${mem.windowTitle || mem.app}</div>
                <div class="memory-text">${mem.semanticSummary || 'No text extracted.'}</div>
            </div>
        `;

        card.addEventListener('click', () => openModal(mem, imgPath));
        track.appendChild(card);
    });
}

recordBtn.addEventListener('click', async () => {
    isRecording = !isRecording;
    await ipcRenderer.invoke('toggle-memory-recording', isRecording);
    
    if (isRecording) {
        recordDot.classList.add('recording');
        recordText.innerText = 'Recording Active';
        recordBtn.innerHTML = '<i data-lucide="pause-circle"></i> Pause Memory';
        recordBtn.style.color = '';
    } else {
        recordDot.classList.remove('recording');
        recordText.innerText = 'Recording Paused';
        recordBtn.innerHTML = '<i data-lucide="play-circle"></i> Resume Memory';
        recordBtn.style.color = '#00f0ff';
    }
    lucide.createIcons();
});

// Search
searchInput.addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase();
    const filtered = allMemories.filter(m => 
        (m.semanticSummary && m.semanticSummary.toLowerCase().includes(query)) ||
        (m.windowTitle && m.windowTitle.toLowerCase().includes(query))
    );
    renderMemories(filtered);
});

// Semantic Search (Press Enter)
searchInput.addEventListener('keypress', async (e) => {
    if(e.key === 'Enter') {
        const query = e.target.value;
        if(query.length < 3) return;
        
        track.innerHTML = '<p style="color: #00f0ff; grid-column: 1/-1; text-align: center; margin-top: 50px;">Searching neural memories...</p>';
        
        const match = await ipcRenderer.invoke('semantic-search-memory', query);
        if(match && !match.error) {
            renderMemories([match]);
        } else {
            track.innerHTML = `<p style="color: #ff3366; grid-column: 1/-1; text-align: center; margin-top: 50px;">${match.error}</p>`;
        }
    }
});

// Modal Logic
const modal = document.getElementById('imageModal');
const modalImg = document.getElementById('modalImage');
const modalTime = document.getElementById('modalTime');
const modalText = document.getElementById('modalText');
let currentMemory = null;

function openModal(mem, imgPath) {
    currentMemory = mem;
    modalImg.src = imgPath;
    modalTime.innerText = new Date(mem.timestamp).toLocaleString();
    modalText.innerText = mem.semanticSummary;
    modal.classList.add('active');
}

document.querySelector('.close-modal').addEventListener('click', () => {
    modal.classList.remove('active');
});

document.getElementById('reopenBtn').addEventListener('click', () => {
    if(currentMemory) {
        ipcRenderer.invoke('reopen-memory-context', currentMemory);
    }
});

// Listen for new memories
ipcRenderer.on('new-memory-frame', (e, mem) => {
    if(searchInput.value === '') {
        allMemories.unshift(mem);
        renderMemories(allMemories);
    }
});

loadMemories();
