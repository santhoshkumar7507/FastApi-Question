let currentUser = null;
let ws = null;
let users = [];

// DOM Elements
const loginOverlay = document.getElementById('login-overlay');
const appContainer = document.getElementById('app-container');
const userSelection = document.getElementById('user-selection');

const userNameEl = document.getElementById('current-user-name');
const userRoleEl = document.getElementById('current-user-role');
const userAvatarEl = document.getElementById('current-user-avatar');

const navItems = document.querySelectorAll('.nav-item');
const views = document.querySelectorAll('.view');
const teacherOnlyElements = document.querySelectorAll('.teacher-only');

// Data Elements
const announcementsList = document.getElementById('announcements-list');
const activityList = document.getElementById('activity-list');
const chatMessages = document.getElementById('chat-messages');
const chatForm = document.getElementById('chat-form');
const chatInput = document.getElementById('chat-input');
const metricMessages = document.getElementById('metric-messages');
const badge = document.querySelector('.badge');
const attendanceList = document.getElementById('attendance-students-list');

let chartInstance = null;
let studentAttendance = {};

// Initialize
async function init() {
    try {
        const response = await fetch('/api/users');
        users = await response.json();
        renderUserSelection();
    } catch (err) {
        console.error("Error fetching users", err);
    }
}

function renderUserSelection() {
    userSelection.innerHTML = '';
    users.forEach(user => {
        const btn = document.createElement('button');
        btn.className = 'user-btn';
        btn.innerHTML = `<strong>${user.full_name}</strong> (${user.is_teacher ? 'Teacher' : 'Student'})`;
        btn.onclick = () => login(user);
        userSelection.appendChild(btn);
    });
}

function login(user) {
    currentUser = user;
    
    // Update UI
    loginOverlay.classList.remove('active');
    setTimeout(() => {
        loginOverlay.classList.add('hidden');
        appContainer.classList.remove('hidden');
    }, 300);

    userNameEl.textContent = user.full_name;
    userRoleEl.textContent = user.is_teacher ? 'Teacher' : 'Student';
    userAvatarEl.textContent = user.full_name.charAt(0);

    if (user.is_teacher) {
        teacherOnlyElements.forEach(el => el.classList.remove('hidden'));
        renderAttendanceList();
    }

    // Connect WebSocket
    connectWebSocket();
    
    // Load Initial Data
    loadHistory();

    // Trigger login Confetti
    triggerConfetti();

    // Init Chart
    initChart();
}

function initChart() {
    const ctx = document.getElementById('attendanceChart');
    if (!ctx) return;
    chartInstance = new Chart(ctx.getContext('2d'), {
        type: 'doughnut',
        data: {
            labels: ['Present', 'Absent'],
            datasets: [{
                data: [0, 0],
                backgroundColor: ['#34d399', '#f87171'],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom', labels: { color: document.body.classList.contains('light-mode') ? '#0f172a' : '#f8fafc' } }
            }
        }
    });
}

function updateChart() {
    let present = 0, absent = 0;
    for (let id in studentAttendance) {
        if (studentAttendance[id] === 'present') present++;
        else if (studentAttendance[id] === 'absent') absent++;
    }
    if (chartInstance) {
        chartInstance.data.datasets[0].data = [present, absent];
        chartInstance.update();
    }
}

function triggerConfetti() {
    if (typeof confetti !== 'undefined') {
        confetti({
            particleCount: 100,
            spread: 70,
            origin: { y: 0.6 }
        });
    }
}

function showToast(title, content, type="success") {
    playPopSound();
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <div class="toast-content">
            <h4>${title}</h4>
            <p>${content}</p>
        </div>
    `;
    container.appendChild(toast);
    setTimeout(() => {
        toast.classList.add('hiding');
        setTimeout(() => toast.remove(), 400);
    }, 3000);
}

function connectWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    ws = new WebSocket(`${protocol}//${window.location.host}/ws/${currentUser.username}`);
    
    ws.onmessage = function(event) {
        const data = JSON.parse(event.data);
        handleSocketMessage(data);
    };

    ws.onclose = function() {
        console.log("WebSocket closed");
        // Reconnect logic could be added here
    };
}

function handleSocketMessage(data) {
    if (data.type === 'chat') {
        appendMessage(data.sender, data.content, data.sender === currentUser.full_name);
        if(document.getElementById('view-chat').classList.contains('active') === false) {
            let count = parseInt(metricMessages.textContent) || 0;
            metricMessages.textContent = count + 1;
            badge.style.display = 'block';
            showToast('New Message', `${data.sender}: ${data.content}`, 'success');
        }
    } else if (data.type === 'announcement') {
        appendAnnouncement(data.title, data.content, new Date());
        badge.style.display = 'block';
        addActivity('New Announcement', `"${data.title}" was just posted.`);
        showToast('Announcement', data.title, 'announcement');
        triggerConfetti();
    } else if (data.type === 'attendance') {
        addActivity('Attendance Updated', `${data.student_name} marked as ${data.status}`);
        // Ensure studentAttendance has a mapping from name if ID is not available in event
        // In this case we just mock it using the name as key for the chart
        studentAttendance[data.student_name] = data.status;
        updateChart();
    } else if (data.type === 'typing') {
        const ind = document.getElementById('typing-indicator');
        const txt = ind.querySelector('.typing-text');
        if (data.is_typing && data.sender !== currentUser.full_name) {
            txt.textContent = `${data.sender} is typing`;
            ind.classList.remove('hidden');
        } else {
            ind.classList.add('hidden');
        }
    }
}

// Markdown Parser
function parseMarkdown(text) {
    if (!text) return '';
    return text
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/`(.*?)`/g, '<code>$1</code>');
}

// Audio Cue
function playPopSound() {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(0, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.1, ctx.currentTime + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.3);
    } catch (e) { console.error(e); }
}

async function loadHistory() {
    // Load announcements
    try {
        const annRes = await fetch('/api/announcements');
        const anns = await annRes.json();
        anns.forEach(a => appendAnnouncement(a.title, a.content, new Date(a.timestamp)));
    } catch(e) { console.error(e) }

    // Load chat
    try {
        const chatRes = await fetch('/api/chat');
        const chats = await chatRes.json();
        chats.forEach(c => appendMessage(c.sender, c.content, c.sender === currentUser.full_name));
    } catch(e) { console.error(e) }
}

// Navigation
navItems.forEach(item => {
    item.addEventListener('click', () => {
        navItems.forEach(nav => nav.classList.remove('active'));
        item.classList.add('active');
        
        const target = item.getAttribute('data-target');
        views.forEach(view => view.classList.remove('active'));
        document.getElementById(`view-${target}`).classList.add('active');

        if (target === 'chat') {
            metricMessages.textContent = '0';
            badge.style.display = 'none';
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }
    });
});

// Chat
let typingTimeout;
chatInput.addEventListener('input', () => {
    if (ws) ws.send(JSON.stringify({ action: 'typing', is_typing: true }));
    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => {
        if (ws) ws.send(JSON.stringify({ action: 'typing', is_typing: false }));
    }, 1500);
});

chatForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const content = chatInput.value.trim();
    if (content && ws) {
        ws.send(JSON.stringify({ action: 'chat', content: content }));
        ws.send(JSON.stringify({ action: 'typing', is_typing: false }));
        chatInput.value = '';
    }
});

function appendMessage(sender, content, isMe) {
    const div = document.createElement('div');
    div.className = `message ${isMe ? 'sent' : 'received'}`;
    const parsedContent = parseMarkdown(content);
    div.innerHTML = `
        <div class="message-sender">${sender}</div>
        <div class="message-content">${parsedContent}</div>
    `;
    chatMessages.appendChild(div);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function appendAnnouncement(title, content, date) {
    const div = document.createElement('div');
    div.className = 'announcement-item';
    
    // Format date roughly
    const timeStr = typeof date === 'string' ? new Date(date).toLocaleTimeString() : date.toLocaleTimeString();
    const parsedContent = parseMarkdown(content);

    div.innerHTML = `
        <h4>${title}</h4>
        <p>${parsedContent}</p>
        <div class="announcement-meta">
            <span>Admin</span>
            <span>${timeStr}</span>
        </div>
    `;
    announcementsList.prepend(div);
}

function addActivity(title, desc) {
    const div = document.createElement('div');
    div.className = 'activity-item';
    const timeStr = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    div.innerHTML = `
        <div class="time">${timeStr}</div>
        <div class="info">
            <strong>${title}</strong>
            <p style="font-size: 13px; color: var(--text-muted); margin-top: 2px;">${desc}</p>
        </div>
    `;
    activityList.prepend(div);
    if(activityList.children.length > 5) {
        activityList.removeChild(activityList.lastChild);
    }
}

// Attendance (Teachers only)
function renderAttendanceList() {
    const students = users.filter(u => !u.is_teacher);
    attendanceList.innerHTML = '';
    students.forEach(student => {
        const row = document.createElement('div');
        row.className = 'student-row';
        row.innerHTML = `
            <div class="student-info">
                <div class="avatar" style="width: 32px; height: 32px; font-size: 14px;">${student.full_name.charAt(0)}</div>
                <span>${student.full_name}</span>
            </div>
            <div class="attendance-actions">
                <button class="btn-present" onclick="markAttendance(${student.id}, 'present', this)">Present</button>
                <button class="btn-absent" onclick="markAttendance(${student.id}, 'absent', this)">Absent</button>
            </div>
        `;
        attendanceList.appendChild(row);
    });
}

window.markAttendance = function(studentId, status, btnElement) {
    if (ws) {
        ws.send(JSON.stringify({ action: 'attendance', student_id: studentId, status: status }));
        
        // Update UI of the buttons in this row
        const row = btnElement.closest('.attendance-actions');
        row.querySelectorAll('button').forEach(b => b.classList.remove('active'));
        btnElement.classList.add('active');
    }
}

// Modal logic
const modalAnnouncement = document.getElementById('modal-announcement');
const btnNewAnnouncement = document.getElementById('btn-new-announcement');
const btnCloseModal = document.getElementById('btn-close-modal');
const formAnnouncement = document.getElementById('form-announcement');

btnNewAnnouncement.addEventListener('click', () => {
    modalAnnouncement.classList.remove('hidden');
});

btnCloseModal.addEventListener('click', () => {
    modalAnnouncement.classList.add('hidden');
});

formAnnouncement.addEventListener('submit', (e) => {
    e.preventDefault();
    const title = document.getElementById('announce-title').value;
    const content = document.getElementById('announce-content').value;
    
    if (title && content && ws) {
        ws.send(JSON.stringify({ action: 'announce', title, content }));
        modalAnnouncement.classList.add('hidden');
        formAnnouncement.reset();
    }
});

// Theme Toggle
const themeToggleBtn = document.getElementById('theme-toggle');
if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', () => {
        document.body.classList.toggle('light-mode');
        if (chartInstance) {
            chartInstance.options.plugins.legend.labels.color = document.body.classList.contains('light-mode') ? '#0f172a' : '#f8fafc';
            chartInstance.update();
        }
    });
}

// Interactive Fluid Background
document.addEventListener('mousemove', (e) => {
    const x = (e.clientX / window.innerWidth - 0.5) * 40;
    const y = (e.clientY / window.innerHeight - 0.5) * 40;
    const s1 = document.querySelector('.shape-1');
    const s2 = document.querySelector('.shape-2');
    const s3 = document.querySelector('.shape-3');
    if(s1) s1.style.transform = `translate(${x}px, ${y}px)`;
    if(s2) s2.style.transform = `translate(${-x * 1.5}px, ${-y * 1.5}px)`;
    if(s3) s3.style.transform = `translate(${x * 0.5}px, ${-y * 0.5}px)`;
});

// Command Palette Logic
const cpOverlay = document.getElementById('command-palette-overlay');
const cpInput = document.getElementById('cp-input');
const cpResults = document.getElementById('cp-results');

document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        toggleCommandPalette();
    } else if (e.key === 'Escape' && cpOverlay && !cpOverlay.classList.contains('hidden')) {
        toggleCommandPalette(false);
    }
});

function toggleCommandPalette(force) {
    if (!cpOverlay) return;
    const isHidden = force !== undefined ? !force : cpOverlay.classList.contains('hidden');
    if (isHidden) {
        cpOverlay.classList.remove('hidden');
        cpInput.value = '';
        cpInput.focus();
        renderCPResults('');
    } else {
        cpOverlay.classList.add('hidden');
    }
}

if (cpInput) {
    cpInput.addEventListener('input', (e) => renderCPResults(e.target.value));
}

function renderCPResults(query) {
    if (!cpResults) return;
    const q = query.toLowerCase();
    const actions = [
        { title: 'Go to Dashboard', icon: 'M4 6h16M4 12h16M4 18h16', action: () => document.querySelector('[data-target="dashboard"]').click() },
        { title: 'Go to Chat', icon: 'M8 12h.01M12 12h.01M16 12h.01', action: () => document.querySelector('[data-target="chat"]').click() },
    ];
    if (currentUser && currentUser.is_teacher) {
        actions.push({ title: 'New Announcement', icon: 'M12 4v16m8-8H4', action: () => btnNewAnnouncement.click() });
    }
    
    const matches = actions.filter(a => a.title.toLowerCase().includes(q));
    cpResults.innerHTML = '';
    matches.forEach(m => {
        const div = document.createElement('div');
        div.className = 'cp-item';
        div.innerHTML = `<div class="cp-item-icon"><svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="${m.icon}"></path></svg></div><span>${m.title}</span>`;
        div.onclick = () => { m.action(); toggleCommandPalette(false); };
        cpResults.appendChild(div);
    });
}

// Start
init();
