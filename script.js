// Example Reference setup - change this to match your real initialization!
// const database = firebase.database();

// Global configurations
let currentUserId = "user123"; 
let activeReplyTargetId = null;

// Lock the dynamic addition strictly to the standard business week
const DAYS_OF_WEEK = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

// Original default rows structure
const DEFAULT_PERIODS = ["Morning", "Recess", "Lunch", "Afternoon", "Tasks"];

// Dummy local chat state to keep rendering alive if database is building
let localMessagesArray = [
    { id: "m1", senderId: "other456", senderName: "Alex", text: "Hey! Did you update the Friday build schedule?", timestamp: 1716552000000, reactions: {} },
    { id: "m2", senderId: "user123", senderName: "You", text: "Just getting the layout fixed up now.", timestamp: 1716552060000, reactions: {}, replyToId: "m1", replyToText: "Hey! Did you update the Friday build schedule?" }
];

// ==========================================================================
// View System Navigation Switches
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
    }
}

// ==========================================================================
// Schedule Sync & Dynamic Management Rules
// ==========================================================================
function generateCellHTML(savedValue = "") {
    let taskText = "";
    let isChecked = false;

    if (savedValue && typeof savedValue === 'object') {
        taskText = savedValue.text || "";
        isChecked = savedValue.checked || false;
    } else {
        taskText = savedValue || "";
    }

    return `
        <td>
            <div class="cell-action-wrapper">
                <input type="text" class="schedule-input" value="${taskText}" placeholder="...">
                <input type="checkbox" class="schedule-checkbox" ${isChecked ? 'checked' : ''}>
            </div>
        </td>
    `;
}

function addNewDayColumn() {
    const headerRow = document.getElementById('table-header-row');
    const currentHeaders = headerRow.querySelectorAll('th');
    
    const lastDayName = currentHeaders[currentHeaders.length - 1].innerText.trim();
    const formattedLastDay = lastDayName.charAt(0).toUpperCase() + lastDayName.slice(1).toLowerCase();
    
    let nextDayIndex = DAYS_OF_WEEK.indexOf(formattedLastDay) + 1;
    
    if (nextDayIndex >= DAYS_OF_WEEK.length || nextDayIndex <= 0) {
        nextDayIndex = 0;
    }
    const nextDayName = DAYS_OF_WEEK[nextDayIndex];

    const newTh = document.createElement('th');
    newTh.innerText = nextDayName;
    headerRow.appendChild(newTh);

    const tableRows = document.querySelectorAll('#schedule-body tr');
    tableRows.forEach(row => {
        row.insertAdjacentHTML('beforeend', generateCellHTML(""));
    });

    saveScheduleToFirebase();
}

function removeLastDayColumn() {
    const headerRow = document.getElementById('table-header-row');
    const currentHeaders = headerRow.querySelectorAll('th');

    if (currentHeaders.length <= 2) {
        alert("Cannot remove any more days!");
        return;
    }

    headerRow.removeChild(currentHeaders[currentHeaders.length - 1]);

    const tableRows = document.querySelectorAll('#schedule-body tr');
    tableRows.forEach(row => {
        if (row.lastElementChild) {
            row.removeChild(row.lastElementChild);
        }
    });

    saveScheduleToFirebase();
}

function saveScheduleToFirebase() {
    const headerRow = document.getElementById('table-header-row');
    const currentHeaders = Array.from(headerRow.querySelectorAll('th')).map(th => th.innerText.trim());

    const rowsData = [];
    const tableRows = document.querySelectorAll('#schedule-body tr');
    
    tableRows.forEach(row => {
        const rowCells = [];
        const actionWrappers = row.querySelectorAll('.cell-action-wrapper');
        
        actionWrappers.forEach(wrapper => {
            const txtInput = wrapper.querySelector('.schedule-input');
            const chkBox = wrapper.querySelector('.schedule-checkbox');
            
            rowCells.push({
                text: txtInput ? txtInput.value : "",
                checked: chkBox ? chkBox.checked : false
            });
        });
        rowsData.push(rowCells);
    });

    const fullSchedulePayload = {
        headers: currentHeaders,
        rows: rowsData
    };
    
    console.log("Synced Schedule to Firebase:", fullSchedulePayload);
}

document.querySelector('.table-container').addEventListener('change', (e) => {
    if (e.target.classList.contains('schedule-input') || e.target.classList.contains('schedule-checkbox')) {
        saveScheduleToFirebase();
    }
});

function addNewRow(savedRowData = null, columnCount = 6) {
    const tbody = document.getElementById('schedule-body');
    const tr = document.createElement('tr');
    
    for (let i = 0; i < columnCount; i++) {
        let cellData = savedRowData && savedRowData[i] ? savedRowData[i] : "";
        tr.innerHTML += generateCellHTML(cellData);
    }
    
    tbody.appendChild(tr);
}

function deleteLastRow() {
    const tbody = document.getElementById('schedule-body');
    if (tbody.lastElementChild) {
        tbody.removeChild(tbody.lastElementChild);
        saveScheduleToFirebase();
    }
}

function loadScheduleFromFirebase(incomingSnapshotPayload) {
    const headerRow = document.getElementById('table-header-row');
    const tbody = document.getElementById('schedule-body');
    
    tbody.innerHTML = ""; 

    if (incomingSnapshotPayload && incomingSnapshotPayload.headers && incomingSnapshotPayload.rows) {
        headerRow.innerHTML = incomingSnapshotPayload.headers.map(h => `<th>${h}</th>`).join('');
        const colCount = incomingSnapshotPayload.headers.length;
        incomingSnapshotPayload.rows.forEach(rowData => {
            addNewRow(rowData, colCount);
        });
    } else {
        headerRow.innerHTML = `
            <th>Time / Task</th>
            <th>Monday</th>
            <th>Tuesday</th>
            <th>Wednesday</th>
            <th>Thursday</th>
            <th>Friday</th>
        `;
        
        DEFAULT_PERIODS.forEach(periodLabel => {
            const rowSetup = [{ text: periodLabel, checked: false }, "", "", "", "", ""];
            addNewRow(rowSetup, 6);
        });
    }
}

// ==========================================================================
// RESTORED: Live Chat Rendering & Interactive Mechanics
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

        // Build Active Reactions Pills
        let reactionsMarkup = "";
        if (msg.reactions && Object.keys(msg.reactions).length > 0) {
            reactionsMarkup = `<div class="msg-active-reactions-row">`;
            for (const [emoji, usersObj] of Object.entries(msg.reactions)) {
                const count = Object.keys(usersObj).length;
                if (count > 0) {
                    const hasUserReacted = usersObj[currentUserId] ? "user-active" : "";
                    reactionsMarkup += `
                        <div class="reaction-counter-pill ${hasUserReacted}" onclick="toggleEmojiReaction('${msg.id}', '${emoji}', event)">
                            <span>${emoji}</span><span class="count">${count}</span>
                        </div>
                    `;
                }
            }
            reactionsMarkup += `</div>`;
        }

        const msgHTML = `
            <div class="${rowClass}" id="msg-row-${msg.id}">
                <div class="msg-container-block">
                    <div class="msg-meta">${isSelf ? "You" : msg.senderName}</div>
                    <div class="${bubbleClass}" onclick="toggleMessageDrawer('${msg.id}', event)">
                        ${replyMarkup}
                        <div class="msg-body-text">${msg.text}</div>
                    </div>
                    ${reactionsMarkup}
                    <div id="drawer-${msg.id}" style="display: none;"></div>
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

    // Close all open drawers first
    document.querySelectorAll('[id^="drawer-"]').forEach(d => d.style.display = "none");

    if (!isCurrentlyOpen) {
        const matchedMsg = localMessagesArray.find(m => m.id === msgId);
        if (!matchedMsg) return;

        const isMsgOwner = matchedMsg.senderId === currentUserId;
        targetDrawer.innerHTML = `
            <div class="msg-action-menu-drawer">
                <div class="drawer-emoji-row">
                    <button class="drawer-emoji-btn" onclick="addEmojiFromDrawer('${msgId}', '👍')">👍</button>
                    <button class="drawer-emoji-btn" onclick="addEmojiFromDrawer('${msgId}', '❤️')">❤️</button>
                    <button class="drawer-emoji-btn" onclick="addEmojiFromDrawer('${msgId}', '😂')">😂</button>
                    <button class="drawer-emoji-btn" onclick="addEmojiFromDrawer('${msgId}', '😮')">😮</button>
                </div>
                <div class="drawer-buttons-row">
                    <button class="drawer-action-btn" onclick="initiateReplyContext('${msgId}')">Reply</button>
                    ${isMsgOwner ? `<button class="drawer-action-btn delete-btn-style" onclick="deleteMessageTrack('${msgId}')">Delete</button>` : ''}
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
        renderChatMessages(localMessagesArray);
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
        document.querySelectorAll('[id^="drawer-"]').forEach(d => d.style.display = "none");
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
        reactions: {},
        replyToId: activeReplyTargetId,
        replyToText: replyText
    };

    localMessagesArray.push(newMsgObj);
    renderChatMessages(localMessagesArray);
    
    input.value = "";
    cancelReply();
    scrollToBottom();
}

function deleteMessageTrack(msgId) {
    localMessagesArray = localMessagesArray.filter(m => m.id !== msgId);
    renderChatMessages(localMessagesArray);
}

function scrollToBottom() {
    const container = document.getElementById('chat-messages-container');
    if (container) {
        container.scrollTop = container.scrollHeight;
    }
}

// Close active drawers if clicking anywhere else on screen
document.addEventListener('click', () => {
    document.querySelectorAll('[id^="drawer-"]').forEach(d => d.style.display = "none");
});

// ==========================================================================
// RESTORED: Authentication / Logout Function
// ==========================================================================
function handleLogout() {
    const confirmLogout = confirm("Are you sure you want to log out of Redflag Build?");
    if (confirmLogout) {
        alert("Logged out safely.");
        // If your page uses custom routing or an auth listener, redirect here:
        // window.location.href = "login.html"; 
    }
}

window.onload = () => {
    loadScheduleFromFirebase(null); 
};
