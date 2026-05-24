// ==========================================
// 1. FIREBASE CONFIGURATION & INITIALIZATION
// ==========================================
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_AUTH_DOMAIN",
    databaseURL: "YOUR_DATABASE_URL",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_STORAGE_BUCKET",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID"
};

// Initialize Firebase
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

const auth = firebase.auth();
const db = firebase.database();

// Track active reply state for chat
let currentReplyTo = null;

// ==========================================
// 2. AUTHENTICATION STATE OBSERVER & PRESENCE
// ==========================================
auth.onAuthStateChanged((user) => {
    const passwordScreen = document.getElementById('password-screen');
    const mainContent = document.getElementById('main-content');

    if (user) {
        // User logged in -> Show app, hide login
        passwordScreen.style.display = 'none';
        mainContent.style.display = 'block';

        // Get their username (fallback to email prefix if displayName isn't set yet)
        const username = user.displayName || user.email.split('@')[0];

        // --- Realtime Presence Setup ---
        const userStatusRef = db.ref(`/status/${user.uid}`);
        const connectedRef = db.ref('.info/connected');

        connectedRef.on('value', (snapshot) => {
            if (snapshot.val() === false) return;

            // When user logs out/disconnects, wipe their status node
            userStatusRef.onDisconnect().remove().then(() => {
                // Set status to online using USERNAME
                userStatusRef.set({
                    username: username,
                    state: 'online',
                    last_changed: firebase.database.ServerValue.TIMESTAMP
                });
            });
        });

        // Initialize streams
        initOnlineUsersListener();
        initChatListener();
        initScheduleListener();

    } else {
        // User logged out -> Show login, hide app
        passwordScreen.style.display = 'flex';
        mainContent.style.display = 'none';
        
        // Clean up listeners if any
        db.ref('/status').off();
        db.ref('/chat').off();
        db.ref('/schedule').off();
    }
});

// ==========================================
// 3. AUTHENTICATION ACTIONS (Login/Signup/Reset)
// ==========================================
let isSignUpMode = false;

function toggleAuthMode() {
    isSignUpMode = !isSignUpMode;
    const title = document.querySelector('#auth-box h2');
    const instruction = document.getElementById('auth-instruction');
    const usernameWrapper = document.getElementById('username-field-wrapper');
    const mainBtn = document.getElementById('main-auth-btn');
    const toggleText = document.querySelector('.toggle-auth-text');

    if (isSignUpMode) {
        title.innerText = "CREATE ACCOUNT";
        instruction.innerText = "Register your builder profile";
        usernameWrapper.style.display = "block";
        mainBtn.innerText = "Sign Up";
        toggleText.innerHTML = 'Already have an account? <span class="accent-link">Login</span>';
    } else {
        title.innerText = "REDFLAG BUILD:";
        instruction.innerText = "Sign in with your individual account";
        usernameWrapper.style.display = "none";
        mainBtn.innerText = "Login";
        toggleText.innerHTML = 'Don\'t have an account? <span class="accent-link">Sign Up</span>';
    }
}

function handleAuth() {
    const email = document.getElementById('email-input').value.trim();
    const password = document.getElementById('password-input').value.trim();
    const errorMsg = document.getElementById('error-msg');
    
    errorMsg.style.display = 'none';

    if (!email || !password) {
        showError("Please fill out all fields.");
        return;
    }

    if (isSignUpMode) {
        const username = document.getElementById('username-input').value.trim();
        if (!username) {
            showError("Please choose a display name / username.");
            return;
        }

        // CREATE USER
        auth.createUserWithEmailAndPassword(email, password)
            .then((userCredential) => {
                // Instantly update their profile with the username
                return userCredential.user.updateProfile({
                    displayName: username
                });
            })
            .catch((error) => showError(error.message));
    } else {
        // LOGIN USER
        auth.signInWithEmailAndPassword(email, password)
            .catch((error) => showError(error.message));
    }
}

function handleLogout() {
    const user = auth.currentUser;
    if (user) {
        // Clean up presence node explicitly on manual logout
        db.ref(`/status/${user.uid}`).remove().then(() => {
            auth.signOut();
        });
    } else {
        auth.signOut();
    }
}

function showForgotPassword() {
    document.getElementById('auth-box').style.display = 'none';
    document.getElementById('forgot-box').style.display = 'block';
}

function hideForgotPassword() {
    document.getElementById('forgot-box').style.display = 'none';
    document.getElementById('auth-box').style.display = 'block';
}

function sendPasswordReset() {
    const email = document.getElementById('reset-email-input').value.trim();
    const resetMsg = document.getElementById('reset-msg');
    
    if (!email) {
        alert("Please enter your email address.");
        return;
    }

    auth.sendPasswordResetEmail(email)
        .then(() => {
            resetMsg.innerText = "Reset link sent! Check your inbox.";
            resetMsg.style.display = "block";
        })
        .catch((error) => {
            alert(error.message);
        });
}

function showError(message) {
    const errorMsg = document.getElementById('error-msg');
    errorMsg.innerText = message;
    errorMsg.style.display = 'block';
}

// ==========================================
// 4. UI NAVIGATION CONTROL
// ==========================================
function switchView(viewName) {
    // Hide all views
    document.querySelectorAll('.dashboard-view').style?.forEach(el => el.style.display = 'none'); // failsafe
    document.getElementById('view-schedule').style.display = 'none';
    document.getElementById('view-chat').style.display = 'none';
    
    // Remove active button classes
    document.getElementById('tab-schedule-btn').classList.remove('active');
    document.getElementById('tab-chat-btn').classList.remove('active');

    // Show selected view & set active button
    if (viewName === 'schedule') {
        document.getElementById('view-schedule').style.display = 'block';
        document.getElementById('tab-schedule-btn').classList.add('active');
    } else if (viewName === 'chat') {
        document.getElementById('view-chat').style.display = 'block';
        document.getElementById('tab-chat-btn').classList.add('active');
        scrollToBottom('chat-messages-box');
    }
}

// ==========================================
// 5. PRESENCE SYSTEM UI LISTENER
// ==========================================
function initOnlineUsersListener() {
    const onlineUsersBox = document.getElementById('online-users-box');

    db.ref('/status').on('value', (snapshot) => {
        // Clear previous list but preserve header title layout
        onlineUsersBox.innerHTML = '<div class="online-title">● Online Teammates</div><div id="online-users-list"></div>'; 
        const listContainer = document.getElementById('online-users-list');
        
        let count = 0;

        snapshot.forEach((childSnapshot) => {
            const userData = childSnapshot.val();
            
            if (userData.state === 'online') {
                count++;
                const userTag = document.createElement('span');
                userTag.className = 'online-user-tag';
                // Grabs the username parameter from the database
                userTag.innerHTML = `<span class="user-dot"></span>${userData.username}`;
                listContainer.appendChild(userTag);
            }
        });

        if (count === 0) {
            listContainer.innerHTML = '<span class="none-text">No users online</span>';
        }
    });
}

// ==========================================
// 6. LIVE TEAM CHAT SYSTEM
// ==========================================
function initChatListener() {
    const chatBox = document.getElementById('chat-messages-box');
    
    db.ref('/chat').limitToLast(50).on('value', (snapshot) => {
        chatBox.innerHTML = '';
        
        snapshot.forEach((childSnapshot) => {
            const msg = childSnapshot.val();
            const msgId = childSnapshot.key;
            
            const msgDiv = document.createElement('div');
            msgDiv.className = 'chat-message';
            
            // Build inner HTML markup supporting optional threaded replies
            let replyMarkup = '';
            if (msg.replyTo) {
                replyMarkup = `
                    <div class="message-reply-preview">
                        <b>@${msg.replyTo.user}:</b> ${msg.replyTo.text}
                    </div>`;
            }

            msgDiv.innerHTML = `
                ${replyMarkup}
                <div class="message-meta">
                    <span class="message-sender">${msg.sender}</span>
                    <span class="message-time">${formatTime(msg.timestamp)}</span>
                </div>
                <div class="message-body">${msg.text}</div>
                <button class="reply-action-btn" onclick="setupReply('${msgId}', '${msg.sender}', '${escapeHtml(msg.text)}')">Reply</button>
            `;
            
            chatBox.appendChild(msgDiv);
        });
        
        scrollToBottom('chat-messages-box');
    });
}

function sendChatMessage() {
    const input = document.getElementById('chat-msg-input');
    const text = input.value.trim();
    const user = auth.currentUser;

    if (!text || !user) return;

    const username = user.displayName || user.email.split('@')[0];
    
    const messageData = {
        sender: username,
        text: text,
        timestamp: firebase.database.ServerValue.TIMESTAMP
    };

    // If it's a threaded reply reply, inject dependency mapping data
    if (currentReplyTo) {
        messageData.replyTo = {
            messageId: currentReplyTo.msgId,
            user: currentReplyTo.sender,
            text: currentReplyTo.text
        };
    }

    db.ref('/chat').push(messageData)
        .then(() => {
            input.value = '';
            cancelReply(); // Clear interface back to default
        });
}

function setupReply(msgId, sender, text) {
    currentReplyTo = { msgId, sender, text };
    document.getElementById('reply-target-user').innerText = sender;
    document.getElementById('reply-target-text').innerText = text;
    document.getElementById('reply-preview-bar').style.display = 'flex';
    document.getElementById('chat-msg-input').focus();
}

function cancelReply() {
    currentReplyTo = null;
    document.getElementById('reply-preview-bar').style.display = 'none';
}

// ==========================================
// 7. SCHEDULE VIEW LOGIC
// ==========================================
function initScheduleListener() {
    const scheduleContainer = document.getElementById('schedule-container');
    
    db.ref('/schedule').on('value', (snapshot) => {
        scheduleContainer.innerHTML = '<h2>Project Schedule</h2>';
        
        if(!snapshot.exists()){
            scheduleContainer.innerHTML += '<p>No tasks loaded into schedule yet.</p>';
            return;
        }

        snapshot.forEach((childSnapshot) => {
            const task = childSnapshot.val();
            const taskDiv = document.createElement('div');
            taskDiv.className = 'schedule-item';
            taskDiv.innerHTML = `
                <h3>${task.title || 'Untitled Task'}</h3>
                <p>${task.description || ''}</p>
                <small>Due: ${task.dueDate || 'N/A'}</small>
            `;
            scheduleContainer.appendChild(taskDiv);
        });
    });
}

// ==========================================
// 8. UTILITY HELPERS
// ==========================================
function scrollToBottom(id) {
    const element = document.getElementById(id);
    if (element) {
        element.scrollTop = element.scrollHeight;
    }
}

function formatTime(timestamp) {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function escapeHtml(str) {
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}
