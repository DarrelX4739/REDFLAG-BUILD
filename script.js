// ==========================================================================
// 1. YOUR FIREBASE CONFIGURATION (INSERT YOUR INFO HERE)
// ==========================================================================
const firebaseConfig = {
    apiKey: "AIzaSyBoNeyQM6aUZ7IjJ5RPPXwxPRGFEaYO75M",
    authDomain: "redflag-build.firebaseapp.com",
    databaseURL: "https://redflag-build-default-rtdb.firebaseio.com",
    projectId: "redflag-build",
    storageBucket: "redflag-build.firebasestorage.app",
    messagingSenderId: "713764641955",
    appId: "1:713764641955:web:4730d3b4d6dac39cf8b316"
};

// Initialize Firebase App Instance Safely
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

// Active cloud connection link
const database = firebase.database();

// ==========================================================================
// 2. GLOBAL CONFIGURATIONS & STATE ENGINE
// ==========================================================================
let currentUserId = "user123"; 
let activeReplyTargetId = null;

// Lock dynamic cycles strictly to standard business week layout arrays
const DAYS_OF_WEEK = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

// Horizontal Column Headers sitting at the top of each day's table grid
const DEFAULT_PERIODS = ["Morning", "Recess", "Lunch", "Afternoon"];

// Track currently active visible days
let activeDaysTrack = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

// Clean room messaging store array
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
        scheduleView.style.display = 'block';
        chatView.style.display = 'none';
    } else {
        scheduleView.style.display = 'none';
        chatView.style.display = 'flex';
        renderChatMessages(localMessagesArray);
        scrollToBottom();
        setupChatInputListener();
    }
}

function setupChatInputListener() {
    const chatInput = document.getElementById('message-input');
    if (chatInput && !chatInput.dataset.listenerActive) {
        chatInput.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault(); // Lock form carriage breaks
                sendMessage();
            }
        });
        chatInput.dataset.listenerActive = "true"; // Prevent event stacking duplicates
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
    // Dynamically match matching column configurations to header allocations
    const currentColumnLength = tbody.closest('table').querySelectorAll('thead th').length;
    
    for (let i = 0; i < currentColumnLength; i++) {
        rowCellsHTML += `
            <td style="border: 1px solid #333333; padding: 8px;">
                <div class="cell-action-wrapper" style="display: flex; align-items: center; gap: 8px;">
                    <input type="text" class="schedule-input" placeholder="Task..." style="background: transparent; border: none; color: #fff; width: 100%;">
                    <input type="checkbox" class="schedule-checkbox" style="accent-color: #ff1a1a;">
                </div>
            </td>
        `;
    }

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

function removeDayTable(dayName) {
    activeDaysTrack = activeDaysTrack.filter(d => d !== dayName);
    const targetBlock = document.getElementById(`day-block-${dayName}`);
    if (targetBlock) {
        targetBlock.remove();
    }
    saveScheduleToFirebase();
}

// ==========================================================================
// 5. FIREBASE TIMETABLE CORE READ & WRITE BACKENDS
// ==========================================================================
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

    database.ref('shared_schedule').set(payload)
        .catch(err => console.error("Database connection fault during save sequence:", err));
}

function loadScheduleFromFirebase(snapshotValue) {
    const container = document.getElementById('dynamic-tables-container');
    if (!container) return;
    container.innerHTML = "";

    if (snapshotValue && snapshotValue.activeDays && snapshotValue.tablesData) {
        activeDaysTrack = snapshotValue.activeDays;
        
        activeDaysTrack.forEach(day => {
            let trRowsHTML = "";
            const savedRows = snapshotValue.tablesData[day] || [];

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

            if (!trRowsHTML) {
                let defaultCellsHTML = "";
                DEFAULT_PERIODS.forEach(() => {
                    defaultCellsHTML += `
                        <td style="border: 1px solid #333333; padding: 8px;">
                            <div class="cell-action-wrapper" style="display: flex; align-items: center; gap: 8px;">
                                <input type="text" class="schedule-input" placeholder="Task..." style="background: transparent; border: none; color: #fff; width: 100%;">
                                <input type="checkbox" class="schedule-checkbox" style="accent-color: #ff1a1a;">
                            </div>
                        </td>
                    `;
                });
                trRowsHTML = `<tr>${defaultCellsHTML}</tr>`;
            }

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

// Global typing change detection triggers
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
// 6. CHAT COMPONENT ENGINE WITH ACTION DRAWER INTERACTIONS
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
            replyMarkup = `<div class="msg-reply-context" style="font-size:0.75rem; opacity:0.7; margin-bottom:4px; color:#aaa;">⤺ ${msg.replyToText}</div>`;
        }

        let reactionsMarkup = "";
        if (msg.reactions && Object.keys(msg.reactions).length > 0) {
            reactionsMarkup = `<div class="msg-active-reactions-row" style="display:flex; gap:4px; margin-top:4px;">`;
            for (const [emoji, usersObj] of Object.entries(msg.reactions)) {
                const count = Object.keys(usersObj).length;
                if (count > 0) {
                    reactionsMarkup += `
                        <span style="background:#222; border:1px solid #333; padding:2px 6px; border-radius:10px; font-size:0.75rem; cursor:pointer;" onclick="toggleEmojiReaction('${msg.id}', '${emoji}', event)">
                            ${emoji} ${count}
                        </span>
                    `;
                }
            }
            reactionsMarkup += `</div>`;
        }

        const msgHTML = `
            <div class="${rowClass}" id="msg-row-${msg.id}" style="display:flex; flex-direction:column; align-items:${isSelf ? 'flex-end':'flex-start'}; margin-bottom:12px;">
                <div class="msg-container-block" style="max-width:75%;">
                    <div class="msg-meta" style="font-size:0.75rem; color:#888; margin-bottom:2px;">${isSelf ? "You" : (msg.senderName || "User")}</div>
                    <div class="${bubbleClass}" style="cursor:pointer; padding:10px; border-radius:8px; background:${isSelf ? '#cc0000':'#262626'}; color: #fff;" onclick="toggleMessageDrawer('${msg.id}', event)">
                        ${replyMarkup}
                        <div class="msg-body-text">${msg.text}</div>
                    </div>
                    ${reactionsMarkup}
                    <div id="drawer-${msg.id}" style="display: none; margin-top:5px; background:#1a1a1a; padding:8px; border-radius:4px; border:1px solid #333;"></div>
                </div>
            </div>
        `;
        container.insertAdjacentHTML('beforeend', msgHTML);
    });
}

function toggleMessageDrawer(msgId, event) {
    event.stopPropagation();
    const targetDrawer = document.getElementById(`drawer-${msgId}`);
    const isCurrentlyOpen = targetDrawer.style.display === "block";

    document.querySelectorAll('[id^="drawer-"]').forEach(d => d.style.display = "none");

    if (!isCurrentlyOpen) {
        const matchedMsg = localMessagesArray.find(m => m.id === msgId);
        if (!matchedMsg) return;

        const isMsgOwner = matchedMsg.senderId === currentUserId;
        targetDrawer.innerHTML = `
            <div style="display:flex; flex-direction:column; gap:5px;">
                <div style="display:flex; gap:8px;">
                    <button class="drawer-emoji-btn" style="cursor:pointer; background:none; border:none; font-size:1.1rem;" onclick="addEmojiFromDrawer('${msgId}', '👍')">👍</button>
                    <button class="drawer-emoji-btn" style="cursor:pointer; background:none; border:none; font-size:1.1rem;" onclick="addEmojiFromDrawer('${msgId}', '❤️')">❤️</button>
                    <button class="drawer-emoji-btn" style="cursor:pointer; background:none; border:none; font-size:1.1rem;" onclick="addEmojiFromDrawer('${msgId}', '😂')">😂</button>
                </div>
                <div style="display:flex; gap:10px; margin-top:4px;">
                    <button style="background:#333; color:#fff; border:none; padding:4px 8px; border-radius:3px; font-size:0.75rem; cursor:pointer;" onclick="initiateReplyContext('${msgId}')">Reply</button>
                    ${isMsgOwner ? `<button style="background:#cc0000; color:#fff; border:none; padding:4px 8px; border-radius:3px; font-size:0.75rem; cursor:pointer;" onclick="deleteMessageTrack('${msgId}')">Delete</button>` : ''}
                </div>
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
        database.ref('shared_chat_messages').set(localMessagesArray);
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
        document.getElementById('reply-snippet').innerText = msg.text;
        document.getElementById('reply-bar').style.display = 'flex';
    }
}

function cancelReply() {
    activeReplyTargetId = null;
    document.getElementById('reply-bar').style.display = 'none';
}

function sendMessage() {
    const input = document.getElementById('message-input');
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
    database.ref('shared_chat_messages').set(localMessagesArray);
    
    input.value = "";
    cancelReply();
    scrollToBottom();
}

function deleteMessageTrack(msgId) {
    localMessagesArray = localMessagesArray.filter(m => m.id !== msgId);
    database.ref('shared_chat_messages').set(localMessagesArray);
}

function scrollToBottom() {
    const container = document.getElementById('chat-messages-container');
    if (container) {
        container.scrollTop = container.scrollHeight;
    }
}

// Close open message choice drawers upon viewport miss-clicks
document.addEventListener('click', () => {
    document.querySelectorAll('[id^="drawer-"]').forEach(d => d.style.display = "none");
});

// ==========================================================================
// 7. ACCOUNT ACCESS SECURITY ROUTING (LOGOUT FIX)
// ==========================================================================
function handleLogout() {
    const confirmLogout = confirm("Are you sure you want to log out of Redflag Build?");
    if (confirmLogout) {
        localMessagesArray = [];
        // Force immediate redirection back to auth root forms location
        window.location.href = "index.html"; 
    }
}

// ==========================================================================
// 8. GLOBAL ROOT DOM SYNCHRONIZATION BINDINGS
// ==========================================================================
window.onload = () => {
    // Live Dynamic database streaming subscription - Schedule Tracking Nodes
    database.ref('shared_schedule').on('value', (snapshot) => {
        loadScheduleFromFirebase(snapshot.val());
    });

    // Live Dynamic database streaming subscription - Chat Nodes
    database.ref('shared_chat_messages').on('value', (snapshot) => {
        localMessagesArray = snapshot.val() || [];
        if (document.getElementById('chat-view').style.display === 'flex') {
            renderChatMessages(localMessagesArray);
            scrollToBottom();
        }
    });

    setupChatInputListener();
};
