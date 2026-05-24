const FIREBASE_API_KEY = "AIzaSyBoNeyQM6aUZ7IjJ5RPPXwxPRGFEaYO75M";
const FIREBASE_AUTH_DOMAIN = "redflag-build.firebaseapp.com";
const FIREBASE_DATABASE_URL = "https://redflag-build-default-rtdb.firebaseio.com";

const firebaseConfig = {
    apiKey: FIREBASE_API_KEY,
    authDomain: FIREBASE_AUTH_DOMAIN,
    databaseURL: FIREBASE_DATABASE_URL
};

// Initialize modules instantly upon framework availability
firebase.initializeApp(firebaseConfig);
const db = firebase.database();
const auth = firebase.auth();

let appData = {};
let isSignUpMode = false;
let currentUserProfile = null;
let activeReplyTargetKey = null; 
let currentlyOpenMenuKey = null; // Track which message has an active context menu visible

const AVAILABLE_EMOJIS = ['😊', '😡', '👍', '💀', '🔥', '😂', '👎', '❤️'];

// Realtime User Account Status Listener
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
            resetMsg.innerHTML = "A password reset link has been dispatched to your email.";
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
    document.getElementById('auth-instruction').innerText = isSignUpMode ? "Create a strict profile" : "Sign in with your account";
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
                input.className = 'schedule-input';
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

    // Create and append the global "Add Day" button at the bottom
    const addDayBtnContainer = document.createElement('div');
    addDayBtnContainer.style.textAlign = 'center';
    addDayBtnContainer.style.marginTop = '10px';
    addDayBtnContainer.style.paddingBottom = '30px';

    const addDayBtn = document.createElement('button');
    addDayBtn.className = 'btn btn-add';
    addDayBtn.style.padding = '12px 30px';
    addDayBtn.style.fontSize = '1.05rem';
    addDayBtn.innerHTML = '➕ Add New Day';
    addDayBtn.onclick = addDay;

    addDayBtnContainer.appendChild(addDayBtn);
    container.appendChild(addDayBtnContainer);
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

function addDay() {
    const sequence = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    let nextDayName = 'Monday'; // Default fallback
    
    if (appData.days && appData.days.length > 0) {
        // Get the very last day currently on the screen
        const lastDayFull = appData.days[appData.days.length - 1];
        
        // Extract just the word (ignores numbers, e.g., gets "Monday" from "Monday 2")
        const baseDayMatch = lastDayFull.match(/[A-Za-z]+/);
        const lastBaseDay = baseDayMatch ? baseDayMatch[0] : 'Friday';
        
        // Find where we are in the Mon-Fri sequence
        const currentIndex = sequence.indexOf(lastBaseDay);
        
        // Move to the next day, wrapping back to Monday if the last day was Friday
        const nextIndex = currentIndex !== -1 ? (currentIndex + 1) % sequence.length : 0;
        let targetBaseDay = sequence[nextIndex];
        
        // Ensure a unique name to prevent Firebase from overwriting previous tables
        nextDayName = targetBaseDay;
        let counter = 2;
        while (appData.days.includes(nextDayName)) {
            nextDayName = `${targetBaseDay} ${counter}`;
            counter++;
        }
    } else {
        // Failsafe if all days were deleted
        appData.days = [];
    }

    // Initialize the new day with empty rows matching current column headers
    const initialRows = [
        new Array(appData.headers.length).fill(''),
        new Array(appData.headers.length).fill(''),
        new Array(appData.headers.length).fill('')
    ];

    // Push to local memory
    appData.days.push(nextDayName);
    if (!appData.values) appData.values = {};
    appData.values[nextDayName] = initialRows;

    // Sync to Cloud and update UI
    saveToCloud();
    renderSchedule();
}

// Synchronized Team Messaging Engine
function initChat() {
    db.ref('chat_messages').limitToLast(60).on('value', (snapshot) => {
        renderChatFromSnapshot(snapshot.val());
    });
}

function renderChatFromSnapshot(data) {
    const msgsBox = document.getElementById('chat-messages-box');
    if(!msgsBox) return;
    
    const isAtBottom = msgsBox.scrollHeight - msgsBox.scrollTop <= msgsBox.clientHeight + 150;
    msgsBox.innerHTML = '';
    if(!data) return;

    Object.keys(data).forEach(key => {
        const msgObj = data[key];
        const isSelf = msgObj.uid === currentUserProfile.uid;
        
        const messageRow = document.createElement('div');
        messageRow.className = `chat-msg-row ${isSelf ? 'self' : ''}`;

        const containerBlock = document.createElement('div');
        containerBlock.className = 'msg-container-block';

        const bubble = document.createElement('div');
        bubble.className = `chat-msg-bubble ${isSelf ? 'self' : ''}`;
        
        const senderDisplayName = msgObj.senderName || msgObj.sender || 'Anonymous User';
        let htmlContent = `<div class="msg-meta">${isSelf ? 'You' : senderDisplayName}</div>`;
        
        if (msgObj.replyTo) {
            htmlContent += `
                <div class="msg-reply-context">
                    ↪️ Replying to <b>${msgObj.replyTo.user}</b>: "${escapeHTML(msgObj.replyTo.text)}"
                </div>
            `;
        }
        
        htmlContent += `<div class="msg-body">${escapeHTML(msgObj.text)}</div>`;
        bubble.innerHTML = htmlContent;

        bubble.onclick = (e) => {
            e.stopPropagation();
            toggleMessageActionMenu(key);
        };

        containerBlock.appendChild(bubble);

        if (msgObj.reactions) {
            const activeReactionsRow = document.createElement('div');
            activeReactionsRow.className = 'msg-active-reactions-row';
            
            Object.keys(msgObj.reactions).forEach(emoji => {
                const clickUsersList = msgObj.reactions[emoji] || {};
                const reactionCount = Object.keys(clickUsersList).length;
                
                if (reactionCount > 0) {
                    const hasCurrentUserReacted = clickUsersList[currentUserProfile.uid] === true;
                    const pill = document.createElement('div');
                    pill.className = `reaction-counter-pill ${hasCurrentUserReacted ? 'user-active' : ''}`;
                    pill.innerHTML = `<span>${emoji}</span> <span>${reactionCount}</span>`;
                    pill.onclick = (e) => {
                        e.stopPropagation();
                        toggleEmojiReaction(key, emoji);
                    };
                    activeReactionsRow.appendChild(pill);
                }
            });
            containerBlock.appendChild(activeReactionsRow);
        }

        if (currentlyOpenMenuKey === key) {
            const menuDrawer = document.createElement('div');
            menuDrawer.className = 'msg-action-menu-drawer';
            menuDrawer.onclick = (e) => e.stopPropagation();

            const emojiRow = document.createElement('div');
            emojiRow.className = 'drawer-emoji-row';
            AVAILABLE_EMOJIS.forEach(emoji => {
                const emoBtn = document.createElement('button');
                const emoBtnClass = 'drawer-emoji-btn';
                emoBtn.className = emoBtnClass;
                emoBtn.innerText = emoji;
                emoBtn.onclick = () => {
                    toggleEmojiReaction(key, emoji);
                    closeAllContextMenus();
                };
                emojiRow.appendChild(emoBtn);
            });
            menuDrawer.appendChild(emojiRow);

            const buttonsRow = document.createElement('div');
            buttonsRow.className = 'drawer-buttons-row';

            const replyBtn = document.createElement('button');
            replyBtn.className = 'drawer-action-btn';
            replyBtn.innerText = '💬 Reply';
            replyBtn.onclick = () => {
                setReplyTarget(key, senderDisplayName, msgObj.text);
                closeAllContextMenus();
            };
            buttonsRow.appendChild(replyBtn);

            if (isSelf) {
                const deleteBtn = document.createElement('button');
                deleteBtn.className = 'drawer-action-btn delete-btn-style';
                deleteBtn.innerText = '🗑️ Delete';
                deleteBtn.onclick = () => {
                    deleteChatMessage(key);
                    closeAllContextMenus();
                };
                buttonsRow.appendChild(deleteBtn);
            }

            menuDrawer.appendChild(buttonsRow);
            containerBlock.appendChild(menuDrawer);
        }

        messageRow.appendChild(containerBlock);
        msgsBox.appendChild(messageRow);
    });

    if (isAtBottom) scrollToBottomChat();
}

function toggleMessageActionMenu(messageKey) {
    if (currentlyOpenMenuKey === messageKey) {
        currentlyOpenMenuKey = null;
    } else {
        currentlyOpenMenuKey = messageKey;
    }
    syncRenderCurrentChatUI();
}

function closeAllContextMenus() {
    if (currentlyOpenMenuKey !== null) {
        currentlyOpenMenuKey = null;
        syncRenderCurrentChatUI();
    }
}

function syncRenderCurrentChatUI() {
    db.ref('chat_messages').once('value', (snapshot) => {
        if (snapshot.exists()) {
            renderChatFromSnapshot(snapshot.val());
        }
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

    if (activeReplyTargetKey) {
        msgPayload.replyTo = {
            msgKey: activeReplyTargetKey,
            user: document.getElementById('reply-target-user').innerText,
            text: document.getElementById('reply-target-text').innerText
        };
    }

    db.ref('chat_messages').push(msgPayload);
    inputField.value = '';
    cancelReply();
}

function toggleEmojiReaction(messageKey, emoji) {
    if (!currentUserProfile) return;
    const reactionUserRef = db.ref(`chat_messages/${messageKey}/reactions/${emoji}/${currentUserProfile.uid}`);
    
    reactionUserRef.once('value', (snapshot) => {
        if (snapshot.exists()) {
            reactionUserRef.remove(); 
        } else {
            reactionUserRef.set(true); 
        }
    });
}

function deleteChatMessage(messageKey) {
    if (confirm("Are you sure you want to permanently delete this message?")) {
        db.ref(`chat_messages/${messageKey}`).remove()
            .catch(err => alert("Error removing message: " + err.message));
    }
}

// Global Application Core Bindings
document.addEventListener('DOMContentLoaded', () => {
    document.body.addEventListener('keypress', function(e) {
        if (e.key === 'Enter' && document.activeElement.id === 'chat-msg-input') {
            sendChatMessage();
        }
    });

    document.addEventListener('click', () => {
        closeAllContextMenus();
    });
});

function scrollToBottomChat() {
    const box = document.getElementById('chat-messages-box');
    if(box) box.scrollTop = box.scrollHeight;
}

function escapeHTML(str) {
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
