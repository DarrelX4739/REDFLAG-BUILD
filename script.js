// ==========================================================================
// 1. YOUR FIREBASE CONFIGURATION (INSERT YOUR INFO HERE)
// ==========================================================================
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
    databaseURL: "https://YOUR_PROJECT_ID-default-rtdb.firebaseio.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT_ID.appspot.com",
    messagingSenderId: "YOUR_SENDER_ID",
    appId: "YOUR_APP_ID"
};

// Global reference database pointer
let database = null;

// Initialize Firebase App instance safely if configuration values are set
if (firebaseConfig.apiKey !== "YOUR_API_KEY" && typeof firebase !== 'undefined') {
    if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
    }
    database = firebase.database();
} else {
    console.warn("Firebase configuration credentials not set. Falling back to localized storage memory modes.");
}

// ==========================================================================
// 2. GLOBAL CONFIGURATIONS & STATE ENGINE
// ==========================================================================
let currentUserId = "user123"; 
let activeReplyTargetId = null;

const DAYS_OF_WEEK = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
const DEFAULT_PERIODS = ["Morning", "Recess", "Lunch", "Afternoon"];
let activeDaysTrack = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
let localMessagesArray = [];

// ==========================================================================
// 3. DASHBOARD VIEW NAVIGATION & INTERFACE LOCKS
// ==========================================================================
function switchView(viewName, clickedButton) {
    const scheduleView = document.getElementById('schedule-view');
    const chatView = document.getElementById('chat-view');
    const buttons = document.querySelectorAll('.tab-navigation .tab-btn');
    
    buttons.forEach(b => b.classList.remove('active'));
    if (clickedButton) {
        clickedButton.classList.add('active');
    }
    
    if (viewName === 'schedule') {
        if (scheduleView) scheduleView.style.display = 'block';
        if (chatView) chatView.style.display = 'none';
    } else {
        if (scheduleView) scheduleView.style.display = 'none';
        if (chatView) chatView.style.display = 'flex';
        renderChatMessages(localMessagesArray);
        scrollToBottom();
    }
}

function setupChatInputListener() {
    const chatInput = document.getElementById('message-input');
    if (chatInput && !chatInput.dataset.listenerActive) {
        chatInput.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault(); 
                sendMessage();
            }
        });
        chatInput.dataset.listenerActive = "true"; 
    }
}

// ==========================================================================
// 4. TIMETABLE STRUCTURAL ORIENTATION ENGINE (TIME AT TOP)
// ==========================================================================
function createSingleDayTableHTML(dayName) {
    let headersHTML = "";
    let defaultCellsHTML = "";

    DEFAULT_PERIODS.forEach(period => {
        headersHTML += `<th style="color: #ff1a1a; text-align: center; border: 1px solid #333333; padding: 10px;">${period}</th>`;
        defaultCellsHTML += `
            <td style="border: 1px solid #333333; padding: 8px;">
                <div class="cell-action-wrapper" style="display: flex; align-items: center; gap: 8px;">
                    <input type="text" class="schedule-input" placeholder="Task..." style="background: transparent; border: none; color: #fff; width: 100%;">
                    <input type="checkbox" class="schedule-checkbox" style="accent-color: #ff1a1a;">
                </div>
            </td>
        `;
    });

    return `
        <div class="day-table-block" id="day-block-${dayName}" style="margin-bottom: 35px; background: #1f1f1f; padding: 15px; border-radius: 6px; border: 1px solid #333333;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                <h3 style="color: #ffffff; text-transform: uppercase; letter-spacing: 1px; margin: 0;">${dayName}</h3>
                <div style="display: flex; gap: 8px;">
                    <button class="btn btn-add" style="padding: 4px 10px; font-size: 0.75rem;" onclick="addRowToDayTable('${dayName}')">+ Add Row</button>
                    <button class="btn btn-del" style="padding: 4px 10px; font-size: 0.75rem;" onclick="removeLastRowFromDayTable('${dayName}')">- Delete Row</button>
                    <button class="btn btn-del" style="padding: 4px 10px; font-size: 0.75rem; background-color: transparent;" onclick="removeDayTable('${dayName}')">Remove Day</button>
                </div>
            </div>
            <div class="table-container" style="width: 100%; overflow-x: auto;">
                <table style="width: 100%; border-collapse: collapse;">
                    <thead>
                        <tr>${headersHTML}</tr>
                    </thead>
                    <tbody id="tbody-${dayName}">
                        <tr>${defaultCellsHTML}</tr>
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

function addRowToDayTable(dayName) {
    const tbody = document.getElementById(`tbody-${dayName}`);
    if (!tbody) return;

    let rowCellsHTML = "";
    DEFAULT_PERIODS.forEach(() => {
        rowCellsHTML += `
            <td style="border: 1px solid #333333; padding: 8px;">
                <div class="cell-action-wrapper" style="display: flex; align-items: center; gap: 8px;">
                    <input type="text" class="schedule-input" placeholder="Task..." style="background: transparent; border: none; color: #fff; width: 100%;">
                    <input type="checkbox" class="schedule-checkbox" style="accent-color: #ff1a1a;">
                </div>
            </td>
        `;
    });

    const newRowHTML = `<tr>${rowCellsHTML}</tr>`;
    tbody.insertAdjacentHTML('beforeend', newRowHTML);
    saveScheduleToFirebase();
}

function removeLastRowFromDayTable(dayName) {
    const tbody = document.getElementById(`tbody-${dayName}`);
    if (tbody && tbody.children.length > 1) {
        tbody.removeChild(tbody.lastElementChild);
        saveScheduleToFirebase();
    } else {
        alert("Cannot delete the base row tracker!");
    }
}

function addNewDayTable() {
    if (activeDaysTrack.length >= 7) {
        alert("Weekly dashboard capacity ceiling reached!");
        return;
    }

    let lastDayName = activeDaysTrack[activeDaysTrack.length - 1];
    let nextDayIndex = DAYS_OF_WEEK.indexOf(lastDayName) + 1;

    if (nextDayIndex >= DAYS_OF_WEEK.length || nextDayIndex <= 0) {
        nextDayIndex = 0; 
    }
    
    let nextDayName = DAYS_OF_WEEK[nextDayIndex];
    if (activeDaysTrack.includes(nextDayName)) {
        nextDayName = `${nextDayName} (Alt)`;
    }

    activeDaysTrack.push(nextDayName);
    const container = document.getElementById('dynamic-tables-container');
    if (container) {
        container.insertAdjacentHTML('beforeend', createSingleDayTableHTML(nextDayName));
    }
    saveScheduleToFirebase();
}

// ==========================================================================
// 5. TIMETABLE CORE DATA SYNC BACKENDS
// ==========================================================================
function removeDayTable(dayName) {
    activeDaysTrack = activeDaysTrack.filter(d => d !== dayName);
    const targetBlock = document.getElementById(`day-block-${dayName}`);
    if (targetBlock) {
        targetBlock.remove();
    }
    saveScheduleToFirebase();
}

function saveScheduleToFirebase() {
    const payload = {
        activeDays: activeDaysTrack,
        tablesData: {}
    };

    activeDaysTrack.forEach(day => {
        payload.tablesData[day] = [];
        const tbody = document.getElementById(`tbody-${day}`);
        if (!tbody) return;

        const rows = tbody.querySelectorAll('tr');
        rows.forEach(row => {
            const rowDataArray = [];
            const cells = row.querySelectorAll('td');
            
            cells.forEach(cell => {
                const taskInput = cell.querySelector('.schedule-input');
                const chkBox = cell.querySelector('.schedule-checkbox');
                
                rowDataArray.push({
                    taskText: taskInput ? taskInput.value : "",
                    checked: chkBox ? chkBox.checked : false
                });
            });
            payload.tablesData[day].push(rowDataArray);
        });
    });

    if (database) {
        database.ref('shared_schedule').set(payload)
            .catch(err => console.error("Database connection fault during save sequence:", err));
    } else {
        localStorage.setItem('local_schedule_backup', JSON.stringify(payload));
    }
}

function loadScheduleFromFirebase(snapshotValue) {
    const container = document.getElementById('dynamic-tables-container');
    if (!container) return;
    container.innerHTML = "";

    const data = snapshotValue || JSON.parse(localStorage.getItem('local_schedule_backup'));

    if (data && data.activeDays && data.tablesData) {
        activeDaysTrack = data.activeDays;
        
        activeDaysTrack.forEach(day => {
            let trRowsHTML = "";
            const savedRows = data.tablesData[day] || [];

            savedRows.forEach(rowCellsData => {
                let cellsHTML = "";
                rowCellsData.forEach(cellData => {
                    cellsHTML += `
                        <td style="border: 1px solid #333333; padding: 8px;">
                            <div class="cell-action-wrapper" style="display: flex; align-items: center; gap: 8px;">
                                <input type="text" class="schedule-input" value="${cellData.taskText || ''}" placeholder="Task..." style="background: transparent; border: none; color: #fff; width: 100%;">
                                <input type="checkbox" class="schedule-checkbox" ${cellData.checked ? 'checked' : ''} style="accent-color: #ff1a1a;">
                            </div>
                        </td>
                    `;
                });
                trRowsHTML += `<tr>${cellsHTML}</tr>`;
            });

            let headersHTML = DEFAULT_PERIODS.map(p => `<th style="color: #ff1a1a; text-align: center; border: 1px solid #333333; padding: 10px;">${p}</th>`).join('');

            const tableBlockHTML = `
                <div class="day-table-block" id="day-block-${day}" style="margin-bottom: 35px; background: #1f1f1f; padding: 15px; border-radius: 6px; border: 1px solid #333333;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                        <h3 style="color: #ffffff; text-transform: uppercase; letter-spacing: 1px; margin: 0;">${day}</h3>
                        <div style="display: flex; gap: 8px;">
                            <button class="btn btn-add" style="padding: 4px 10px; font-size: 0.75rem;" onclick="addRowToDayTable('${day}')">+ Add Row</button>
                            <button class="btn btn-del" style="padding: 4px 10px; font-size: 0.75rem;" onclick="removeLastRowFromDayTable('${day}')">- Delete Row</button>
                            <button class="btn btn-del" style="padding: 4px 10px; font-size: 0.75rem; background-color: transparent;" onclick="removeDayTable('${day}')">Remove Day</button>
                        </div>
                    </div>
                    <div class="table-container" style="width: 100%; overflow-x: auto;">
                        <table style="width: 100%; border-collapse: collapse;">
                            <thead>
                                <tr>${headersHTML}</tr>
                            </thead>
                            <tbody id="tbody-${day}">
                                ${trRowsHTML}
                            </tbody>
                        </table>
                    </div>
                </div>
            `;
            container.insertAdjacentHTML('beforeend', tableBlockHTML);
        });
    } else {
        activeDaysTrack = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
        activeDaysTrack.forEach(day => {
            container.insertAdjacentHTML('beforeend', createSingleDayTableHTML(day));
        });
    }
}

document.addEventListener('input', (e) => {
    if (e.target.classList.contains('schedule-input')) {
        saveScheduleToFirebase();
    }
});
document.addEventListener('change', (e) => {
    if (e.target.classList.contains('schedule-checkbox')) {
        saveScheduleToFirebase();
    }
});

// ==========================================================================
// 6. CHAT COMPONENT ENGINE WITH MENU DRAWERS
// ==========================================================================
function renderChatMessages(messages) {
    const container = document.getElementById('chat-messages-container');
    if (!container) return;
    container.innerHTML = "";

    messages.forEach(msg => {
        const isSelf = msg.senderId === currentUserId;
        const rowClass = isSelf ? "chat-msg-row self" : "chat-msg-row";
        const bubbleClass = isSelf ? "chat-msg-bubble self" : "chat-msg-bubble";

        let replyMarkup = "";
        if (msg.replyToText) {
            replyMarkup = `<div class="msg-reply-context">⤺ ${msg.replyToText}</div>`;
        }

        let reactionsMarkup = "";
        if (msg.reactions && Object.keys(msg.reactions).length > 0) {
            reactionsMarkup = `<div class="msg-active-reactions-row">`;
            for (const [emoji, usersObj] of Object.entries(msg.reactions)) {
                const count = Object.keys(usersObj).length;
                if (count > 0) {
                    reactionsMarkup += `
                        <span class="reaction-counter-pill" onclick="toggleEmojiReaction('${msg.id}', '${emoji}', event)">
                            ${emoji} ${count}
                        </span>
                    `;
                }
            }
            reactionsMarkup += `</div>`;
        }

        const msgHTML = `
            <div class="${rowClass}" id="msg-row-${msg.id}">
                <div class="msg-container-block">
                    <div class="msg-meta">${isSelf ? "You" : (msg.senderName || "User")}</div>
                    <div class="${bubbleClass}" onclick="toggleMessageDrawer('${msg.id}', event)">
                        ${replyMarkup}
                        <div class="msg-body-text">${msg.text}</div>
                    </div>
                    ${reactionsMarkup}
                    <div id="drawer-${msg.id}" class="msg-action-menu-drawer" style="display: none;"></div>
                </div>
            </div>
        `;
        container.insertAdjacentHTML('beforeend', msgHTML);
    });
}

function toggleMessageDrawer(msgId, event) {
    event.stopPropagation();
    const targetDrawer = document.getElementById(`drawer-${msgId}`);
    if (!targetDrawer) return;
    
    const isCurrentlyOpen = targetDrawer.style.display === "block";
    document.querySelectorAll('.msg-action-menu-drawer').forEach(d => d.style.display = "none");

    if (!isCurrentlyOpen) {
        const matchedMsg = localMessagesArray.find(m => m.id === msgId);
        if (!matchedMsg) return;

        const isMsgOwner = matchedMsg.senderId === currentUserId;
        targetDrawer.innerHTML = `
            <div class="drawer-emoji-row">
                <button class="drawer-emoji-btn" onclick="addEmojiFromDrawer('${msgId}', '👍')">👍</button>
                <button class="drawer-emoji-btn" onclick="addEmojiFromDrawer('${msgId}', '❤️')">❤️</button>
                <button class="drawer-emoji-btn" onclick="addEmojiFromDrawer('${msgId}', '😂')">😂</button>
            </div>
            <div class="drawer-buttons-row">
                <button class="drawer-action-btn" onclick="initiateReplyContext('${msgId}')">Reply</button>
                ${isMsgOwner ? `<button class="drawer-action-btn delete-btn-style" onclick="deleteMessageTrack('${msgId}')">Delete</button>` : ''}
            </div>
        `;
        targetDrawer.style.display = "block";
    }
}

function addEmojiFromDrawer(msgId, emoji) {
    const msg = localMessagesArray.find(m => m.id === msgId);
    if (msg) {
        if (!msg.reactions) msg.reactions = {};
        if (!msg.reactions[emoji]) msg.reactions[emoji] = {};
        
        if (msg.reactions[emoji][currentUserId]) {
            delete msg.reactions[emoji][currentUserId];
        } else {
            msg.reactions[emoji][currentUserId] = true;
        }
        
        if (database) {
            database.ref('shared_chat_messages').set(localMessagesArray);
        } else {
            renderChatMessages(localMessagesArray);
        }
    }
}

function toggleEmojiReaction(msgId, emoji, event) {
    event.stopPropagation();
    addEmojiFromDrawer(msgId, emoji);
}

function initiateReplyContext(msgId) {
    const msg = localMessagesArray.find(m => m.id === msgId);
    if (msg) {
        activeReplyTargetId = msgId;
        const snippet = document.getElementById('reply-snippet');
        const bar = document.getElementById('reply-bar');
        if (snippet) snippet.innerText = msg.text;
        if (bar) bar.style.display = 'flex';
    }
}

function cancelReply() {
    activeReplyTargetId = null;
    const bar = document.getElementById('reply-bar');
    if (bar) bar.style.display = 'none';
}

function sendMessage() {
    const input = document.getElementById('message-input');
    if (!input) return;
    
    const text = input.value.trim();
    if (!text) return;

    let replyText = null;
    if (activeReplyTargetId) {
        const matched = localMessagesArray.find(m => m.id === activeReplyTargetId);
        if (matched) replyText = matched.text;
    }

    const newMsgObj = {
        id: "msg_" + Date.now(),
        senderId: currentUserId,
        senderName: "You",
        text: text,
        timestamp: Date.now(),
        replyToText: replyText
    };

    localMessagesArray.push(newMsgObj);
    
    if (database) {
        database.ref('shared_chat_messages').set(localMessagesArray);
    } else {
        renderChatMessages(localMessagesArray);
    }
    
    input.value = "";
    cancelReply();
    scrollToBottom();
}

function deleteMessageTrack(msgId) {
    localMessagesArray = localMessagesArray.filter(m => m.id !== msgId);
    if (database) {
        database.ref('shared_chat_messages').set(localMessagesArray);
    } else {
        renderChatMessages(localMessagesArray);
    }
}

function scrollToBottom() {
    const container = document.getElementById('chat-messages-container');
    if (container) {
        container.scrollTop = container.scrollHeight;
    }
}

document.addEventListener('click', () => {
    document.querySelectorAll('.msg-action-menu-drawer').forEach(d => d.style.display = "none");
});

// ==========================================================================
// 7. ACCOUNT ACCESS SECURITY ROUTING (LOGOUT FIX)
// ==========================================================================
function handleLogout() {
    const confirmLogout = confirm("Are you sure you want to log out of Redflag Build?");
    if (confirmLogout) {
        localMessagesArray = [];
        window.location.href = "index.html"; 
    }
}

// ==========================================================================
// 8. GLOBAL ROOT DOM INITIALIZATION
// ==========================================================================
window.onload = () => {
    if (database) {
        database.ref('shared_schedule').on('value', (snapshot) => {
            loadScheduleFromFirebase(snapshot.val());
        });

        database.ref('shared_chat_messages').on('value', (snapshot) => {
            localMessagesArray = snapshot.val() || [];
            if (document.getElementById('chat-view').style.display === 'flex') {
                renderChatMessages(localMessagesArray);
                scrollToBottom();
            }
        });
    } else {
        loadScheduleFromFirebase(null);
    }

    setupChatInputListener();
};
