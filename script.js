const FIREBASE_API_KEY = "AIzaSyBoNeyQM6aUZ7IjJ5RPPXwxPRGFEaYO75M";
const FIREBASE_AUTH_DOMAIN = "redflag-build.firebaseapp.com";
const FIREBASE_DATABASE_URL = "https://redflag-build-default-rtdb.firebaseio.com";

const firebaseConfig = {
    apiKey: FIREBASE_API_KEY,
    authDomain: FIREBASE_AUTH_DOMAIN,
    databaseURL: FIREBASE_DATABASE_URL
};

// Initialize application modules instantly upon framework availability
firebase.initializeApp(firebaseConfig);
const db = firebase.database();
const auth = firebase.auth();

let appData = {};
let isSignUpMode = false;
let currentUserProfile = null;
let activeReplyTargetKey = null; // Holds active message payload data for target replies

const AVAILABLE_EMOJIS = ['😊', '😡', '👍', '💀', '🔥', '😂', '👎', '❤️'];

// Realtime User Account Authorization Status State Listener
auth.onAuthStateChanged((user) => {
    if (user) {
        currentUserProfile = user;
        document.getElementById('password-screen').style.display = 'none';
        document.getElementById('main-content').style.display = 'block';
        initApp();
        initChat();
    } else {
        currentUserProfile = null;
        document.getElementById('password-screen').style.display = 'flex';
        document.getElementById('main-content').style.display = 'none';
    }
});

function handleAuth() {
    const email = document.getElementById('email-input').value.trim();
    const password = document.getElementById('password-input').value;
    const errorMsg = document.getElementById('error-msg');
    errorMsg.style.display = 'none';

    if(!email || !password) {
        errorMsg.innerText = "Please completely fill all fields.";
        errorMsg.style.display = 'block';
        return;
    }

    if (isSignUpMode) {
        const customUsername = document.getElementById('username-input').value.trim();
        if(!customUsername) {
            errorMsg.innerText = "Please select a custom Display Name.";
            errorMsg.style.display = 'block';
            return;
        }

        auth.createUserWithEmailAndPassword(email, password)
            .then((result) => {
                return result.user.updateProfile({ displayName: customUsername });
            })
            .catch(err => { errorMsg.innerText = err.message; errorMsg.style.display = 'block'; });
    } else {
        auth.signInWithEmailAndPassword(email, password)
            .catch(err => { errorMsg.innerText = err.message; errorMsg.style.display = 'block'; });
    }
}

function sendPasswordReset() {
    const email = document.getElementById('reset-email-input').value.trim();
    const resetMsg = document.getElementById('reset-msg');
    
    if(!email) {
        alert("Please specify a valid account email address.");
        return;
    }

    auth.sendPasswordResetEmail(email)
        .then(() => {
            resetMsg.innerHTML = "A password reset link has been successfully dispatched to your email address. If you do not receive the message within a few minutes, please check your spam or junk folders.";
            resetMsg.style.display = 'block';
        })
        .catch(err => {
            alert(err.message);
        });
}

function handleLogout() {
    auth.signOut();
}

function toggleAuthMode() {
    isSignUpMode = !isSignUpMode;
    document.getElementById('main-auth-btn').innerText = isSignUpMode ? "Sign Up" : "Login";
    document.getElementById('username-field-wrapper').style.display = isSignUpMode ? "block" : "none";
    document.getElementById('auth-instruction').innerText = isSignUpMode ? "Create a strict individual profile" : "Sign in with your individual account";
    document.querySelector('.toggle-auth-text').innerHTML = isSignUpMode ? "Already have an account? <span class='accent-link'>Login</span>" : "Don't have an account? <span class='accent-link'>Sign Up</span>";
}

function showForgotPassword() {
    document.getElementById('auth-box').style.display = 'none';
    document.getElementById('forgot-box').style.display = 'block';
}

function hideForgotPassword() {
    document.getElementById('auth-box').style.display = 'block';
    document.getElementById('forgot-box').style.display = 'none';
    document.getElementById('reset-msg').style.display = 'none';
}

function switchView(targetView) {
    document.querySelectorAll('.dashboard-view').forEach(view => view.style.display = 'none');
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));

    if(targetView === 'schedule') {
        document.getElementById('view-schedule').style.display = 'block';
        document.getElementById('tab-schedule-btn').classList.add('active');
    } else if (targetView === 'chat') {
        document.getElementById('view-chat').style.display = 'block';
        document.getElementById('tab-chat-btn').classList.add('active');
        scrollToBottomChat();
    }
}

// System Schedule Sync Engine Logic
const defaultData = {
    days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
    headers: ['Morning', 'Recess', 'Lunch', 'Afternoon'],
    rows: [['', '', '', ''], ['', '', '', ''], ['', '', '', '']],
    values: {
        'Monday': [['', '', '', ''], ['', '', '', ''], ['', '', '', '']],
        'Tuesday': [['', '', '', ''], ['', '', '', ''], ['', '', '', '']],
        'Wednesday': [['', '', '', ''], ['', '', '', ''], ['', '', '', '']],
        'Thursday': [['', '', '', ''], ['', '', '', ''], ['', '', '', '']],
        'Friday': [['', '', '', ''], ['', '', '', ''], ['', '', '', '']]
    }
};

function initApp() {
    db.ref('shared_schedule').on('value', (snapshot) => {
        const data = snapshot.val();
        if (data) { appData = data; } 
        else { appData = JSON.parse(JSON.stringify(defaultData)); saveToCloud(); }
        renderSchedule();
    });
}

function saveToCloud() { if (db) { db.ref('shared_schedule').set(appData); } }

function renderSchedule() {
    const container = document.getElementById('schedule-container');
    container.innerHTML = '';
    if (!appData.days) return;

    appData.days.forEach((day) => {
        const daySection = document.createElement('div');
        daySection.className = 'day-section';

        const title = document.createElement('h3');
        title.className = 'day-title';
        title.innerText = day;
        daySection.appendChild(title);

        const controls = document.createElement('div');
        controls.className = 'controls';
        controls.innerHTML = `
            <button class="btn btn-add" onclick="addRow('${day}')">+ Add Row</button>
            <button class="btn btn-del" onclick="deleteRow('${day}')">- Remove Row</button>
            <button class="btn btn-add" onclick="addColumn()">+ Add Col</button>
            <button class="btn btn-del" onclick="deleteColumn()">- Remove Col</button>
        `;
        daySection.appendChild(controls);

        const tableContainer = document.createElement('div');
        tableContainer.className = 'table-container';
        const table = document.createElement('table');
        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');
        
        appData.headers.forEach(header => {
            const th = document.createElement('th');
            th.innerText = header;
            headerRow.appendChild(th);
        });
        thead.appendChild(headerRow);
        table.appendChild(thead);

        const tbody = document.createElement('tbody');
        if(!appData.values) appData.values = {};
        if(!appData.values[day]) appData.values[day] = appData.rows.map(r => [...r]);

        appData.values[day].forEach((rowData, rIdx) => {
            const tr = document.createElement('tr');
            for(let cIdx = 0; cIdx < appData.headers.length; cIdx++) {
                const td = document.createElement('td');
                const input = document.createElement('input');
                input.type = 'text';
                input.value = rowData[cIdx] || '';
                input.placeholder = 'Insert Task';
                
                input.addEventListener('change', (e) => {
                    appData.values[day][rIdx][cIdx] = e.target.value;
                    saveToCloud();
                });
                td.appendChild(input);
                tr.appendChild(td);
            }
            tbody.appendChild(tr);
        });

        table.appendChild(tbody);
        tableContainer.appendChild(table);
        daySection.appendChild(tableContainer);
        container.appendChild(daySection);
    });
}

function addRow(day) {
    const newRow = new Array(appData.headers.length).fill('');
    if (!appData.values[day]) appData.values[day] = [];
    appData.values[day].push(newRow);
    saveToCloud(); renderSchedule();
}

function deleteRow(day) {
    if (appData.values[day] && appData.values[day].length > 1) {
        appData.values[day].pop();
        saveToCloud(); renderSchedule();
    }
}

function addColumn() {
    const colName = prompt("Enter column name:");
    if (colName) {
        appData.headers.push(colName);
        appData.days.forEach(day => {
            if (appData.values[day]) appData.values[day].forEach(row => row.push(''));
        });
        saveToCloud(); renderSchedule();
    }
}

function deleteColumn() {
    if (appData.headers.length > 1) {
        appData.headers.pop();
        appData.days.forEach(day => {
            if (appData.values[day]) appData.values[day].forEach(row => row.pop());
        });
        saveToCloud(); renderSchedule();
    }
}

// Synchronized Team Messaging Operations Module Engine
function initChat() {
    db.ref('chat_messages').limitToLast(60).on('value', (snapshot) => {
        const msgsBox = document.getElementById('chat-messages-box');
        if(!msgsBox) return;
        msgsBox.innerHTML = '';
        const data = snapshot.val();
        if(!data) return;

        Object.keys(data).forEach(key => {
            const msgObj = data[key];
            
            const messageRow = document.createElement('div');
            const isSelf = msgObj.uid === currentUserProfile.uid;
            messageRow.className = `chat-msg-row ${isSelf ? 'self' : ''}`;

            // Create Hover Emoji Picker Tray Panel Layout
            const pickerTray = document.createElement('div');
            pickerTray.className = 'reaction-picker-tray';
            AVAILABLE_EMOJIS.forEach(emoji => {
                const emoBtn = document.createElement('button');
                emoBtn.className = 'react-badge-btn';
                emoBtn.innerText = emoji;
                emoBtn.onclick = (e) => {
                    e.stopPropagation();
                    toggleEmojiReaction(key, emoji);
                };
                pickerTray.appendChild(emoBtn);
            });
            messageRow.appendChild(pickerTray);

            // Create Inner Alignment block wrapper
            const containerBlock = document.createElement('div');
            containerBlock.className = 'msg-container-block';

            // Create Message Content text container box bubble
            const bubble = document.createElement('div');
            bubble.className = `chat-msg-bubble ${isSelf ? 'self' : ''}`;
            
            // Set up click action to trigger thread replies smoothly
            bubble.onclick = () => setReplyTarget(key, msgObj.senderName || msgObj.sender || 'User', msgObj.text);
            
            const senderDisplayName = msgObj.senderName || msgObj.sender || 'Anonymous User';
            
            let htmlContent = `<div class="msg-meta">${isSelf ? 'You' : senderDisplayName}</div>`;
            
            // Inject nested structural context markup if message is flagged as comment reply
            if (msgObj.replyTo) {
                htmlContent += `
                    <div class="msg-reply-context">
                        ↪️ Replying to <b>${msgObj.replyTo.user}</b>: "${escapeHTML(msgObj.replyTo.text)}"
                    </div>
                `;
            }
            
            htmlContent += `<div class="msg-body">${escapeHTML(msgObj.text)}</div>`;
            bubble.innerHTML = htmlContent;
            containerBlock.appendChild(bubble);

            // Construct Active Saved Reactions Badge Counter Pill Elements
            if (msgObj.reactions) {
                const activeReactionsRow = document.createElement('div');
                activeReactionsRow.className = 'msg-active-reactions-row';
                
                Object.keys(msgObj.reactions).forEach(emoji => {
                    const explicitClickUsersList = msgObj.reactions[emoji] || {};
                    const reactionCount = Object.keys(explicitClickUsersList).length;
                    
                    if (reactionCount > 0) {
                        const hasCurrentUserReacted = explicitClickUsersList[currentUserProfile.uid] === true;
                        const pill = document.createElement('div');
                        pill.className = `reaction-counter-pill ${hasCurrentUserReacted ? 'user-active' : ''}`;
                        pill.innerHTML = `<span>${emoji}</span> <span>${reactionCount}</span>`;
                        pill.onclick = (e) => {
                            e.stopPropagation(); // Avoid triggering thread reply systems accidentally
                            toggleEmojiReaction(key, emoji);
                        };
                        activeReactionsRow.appendChild(pill);
                    }
                });
                containerBlock.appendChild(activeReactionsRow);
            }

            messageRow.appendChild(containerBlock);

            // Functional action options layout controls (Reply & Delete button nodes)
            const controlActionWrapper = document.createElement('div');
            controlActionWrapper.style.display = 'flex';
            controlActionWrapper.style.flexDirection = 'column';

            const replyActionBtn = document.createElement('button');
            replyActionBtn.className = 'msg-action-control-btn';
            replyActionBtn.innerHTML = '💬';
            replyActionBtn.title = 'Reply to Message';
            replyActionBtn.onclick = (e) => {
                e.stopPropagation();
                setReplyTarget(key, senderDisplayName, msgObj.text);
            };
            controlActionWrapper.appendChild(replyActionBtn);

            if (isSelf) {
                const deleteBtn = document.createElement('button');
                deleteBtn.className = 'msg-action-control-btn';
                deleteBtn.innerHTML = '🗑️';
                deleteBtn.title = 'Delete Message';
                deleteBtn.onclick = (e) => {
                    e.stopPropagation();
                    deleteChatMessage(key);
                };
                controlActionWrapper.appendChild(deleteBtn);
            }
            messageRow.appendChild(controlActionWrapper);

            msgsBox.appendChild(messageRow);
        });
        scrollToBottomChat();
    });
}

function setReplyTarget(messageKey, user, text) {
    activeReplyTargetKey = messageKey;
    document.getElementById('reply-target-user').innerText = user;
    document.getElementById('reply-target-text').innerText = text.length > 50 ? text.substring(0, 50) + '...' : text;
    document.getElementById('reply-preview-bar').style.display = 'flex';
    document.getElementById('chat-msg-input').focus();
}

function cancelReply() {
    activeReplyTargetKey = null;
    document.getElementById('reply-preview-bar').style.display = 'none';
}

function sendChatMessage() {
    const inputField = document.getElementById('chat-msg-input');
    const msgText = inputField.value.trim();
    if(!msgText || !currentUserProfile) return;

    const msgPayload = {
        uid: currentUserProfile.uid,
        sender: currentUserProfile.email.split('@')[0],
        senderName: currentUserProfile.displayName || currentUserProfile.email.split('@')[0],
        text: msgText,
        timestamp: firebase.database.ServerValue.TIMESTAMP
    };

    // Append reply contextual payload mapping if targeted session flag is active
    if (activeReplyTargetKey) {
        msgPayload.replyTo = {
            msgKey: activeReplyTargetKey,
            user: document.getElementById('reply-target-user').innerText,
            text: document.getElementById('reply-target-text').innerText
        };
    }

    db.ref('chat_messages').push(msgPayload);
    inputField.value = '';
    cancelReply(); // Wipes inline reply mode fields instantly upon completion
}

function toggleEmojiReaction(messageKey, emoji) {
    if (!currentUserProfile) return;
    const reactionUserRef = db.ref(`chat_messages/${messageKey}/reactions/${emoji}/${currentUserProfile.uid}`);
    
    reactionUserRef.once('value', (snapshot) => {
        if (snapshot.exists()) {
            reactionUserRef.remove(); // Removes user register toggle matching click input
        } else {
            reactionUserRef.set(true); // Registers user click tracking variables safely
        }
    });
}

function deleteChatMessage(messageKey) {
    if (confirm("Are you sure you want to permanently delete this message?")) {
        db.ref(`chat_messages/${messageKey}`).remove()
            .catch(err => alert("Error removing message: " + err.message));
    }
}

// Bind Enter key to instant message dispatching routing actions
document.addEventListener('DOMContentLoaded', () => {
    document.body.addEventListener('keypress', function(e) {
        if (e.key === 'Enter' && document.activeElement.id === 'chat-msg-input') {
            sendChatMessage();
        }
    });
});

function scrollToBottomChat() {
    const box = document.getElementById('chat-messages-box');
    if(box) box.scrollTop = box.scrollHeight;
}

function escapeHTML(str) {
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
