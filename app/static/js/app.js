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
        }
    } else if (data.type === 'announcement') {
        appendAnnouncement(data.title, data.content, new Date());
        badge.style.display = 'block';
        addActivity('New Announcement', `"${data.title}" was just posted.`);
    } else if (data.type === 'attendance') {
        addActivity('Attendance Updated', `${data.student_name} marked as ${data.status}`);
        // Optionally update a metric if we wanted
    }
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
chatForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const content = chatInput.value.trim();
    if (content && ws) {
        ws.send(JSON.stringify({ action: 'chat', content: content }));
        chatInput.value = '';
    }
});

function appendMessage(sender, content, isMe) {
    const div = document.createElement('div');
    div.className = `message ${isMe ? 'sent' : 'received'}`;
    div.innerHTML = `
        <div class="message-sender">${sender}</div>
        <div class="message-content">${content}</div>
    `;
    chatMessages.appendChild(div);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function appendAnnouncement(title, content, date) {
    const div = document.createElement('div');
    div.className = 'announcement-item';
    
    // Format date roughly
    const timeStr = typeof date === 'string' ? new Date(date).toLocaleTimeString() : date.toLocaleTimeString();

    div.innerHTML = `
        <h4>${title}</h4>
        <p>${content}</p>
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

// Start
init();
