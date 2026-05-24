// Example Reference setup - change this to match your real initialization!
// const database = firebase.database();

// Global configurations
let currentUserId = "user123"; 
let activeReplyTargetId = null;

// Lock the dynamic addition strictly to the standard business week
const DAYS_OF_WEEK = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

// Original explicit default row periods
const DEFAULT_PERIODS = ["Morning", "Recess", "Lunch", "Afternoon", "Tasks"];

// Tracking array for currently displayed day tables
let activeDaysTrack = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

let localMessagesArray = [];

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
// Schedule Multi-Table Management Rules (Fixed Squish Layout)
// ==========================================================================

function createSingleDayTableHTML(dayName) {
    let rowsHTML = "";
    
    DEFAULT_PERIODS.forEach(period => {
        rowsHTML += `
            <tr>
                <td style="width: 25%; font-weight: bold; color: #ff1a1a;">${period}</td>
                <td>
                    <div class="cell-action-wrapper">
                        <input type="text" class="schedule-input" placeholder="Enter task details..." data-day="${dayName}" data-period="${period}">
                        <input type="checkbox" class="schedule-checkbox" data-day="${dayName}" data-period="${period}">
                    </div>
                </td>
            </tr>
        `;
    });

    return `
        <div class="day-table-block" id="day-block-${dayName}" style="margin-bottom: 35px; background: #1f1f1f; padding: 15px; border-radius: 6px; border: 1px solid #333333;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                <h3 style="color: #ffffff; text-transform: uppercase; letter-spacing: 1px; margin: 0;">${dayName}</h3>
                <div style="display: flex; gap: 8px;">
                    <button class="btn btn-add" style="padding: 4px 10px; font-size: 0.75rem;" onclick="addRowToDayTable('${dayName}')">+ Add Row</button>
                    <button class="btn btn-del" style="padding: 4px 10px; font-size: 0.75rem;" onclick="removeDayTable('${dayName}')">Remove Day</button>
                </div>
            </div>
            <div class="table-container">
                <table style="width: 100%; border-collapse: collapse;">
                    <thead>
                        <tr>
                            <th style="width: 25%; text-align: left;">Time / Block</th>
                            <th style="text-align: left;">Task / Assignment Line</th>
                        </tr>
                    </thead>
                    <tbody id="tbody-${dayName}">
                        ${rowsHTML}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

function renderAllDayTables() {
    const container = document.getElementById('dynamic-tables-container');
    if (!container) return;
    
    container.innerHTML = "";
    activeDaysTrack.forEach(day => {
        container.insertAdjacentHTML('beforeend', createSingleDayTableHTML(day));
    });
}

function addRowToDayTable(dayName) {
    const tbody = document.getElementById(`tbody-${dayName}`);
    if (!tbody) return;

    const uniqueId = Date.now();
    const newRowHTML = `
        <tr>
            <td style="width: 25%; font-weight: bold; color: #ff1a1a;">
                <input type="text" value="Custom Task" class="schedule-input" style="font-weight: bold; color: #ff1a1a !important;">
            </td>
            <td>
                <div class="cell-action-wrapper">
                    <input type="text" class="schedule-input" placeholder="Enter task details...">
                    <input type="checkbox" class="schedule-checkbox">
                </div>
            </td>
        </tr>
    `;
    tbody.insertAdjacentHTML('beforeend', newRowHTML);
    saveScheduleToFirebase();
}

function addNewDayTable() {
    if (activeDaysTrack.length >= 7) {
        alert("Maximum weekly tracking limit reached!");
        return;
    }

    let lastDayName = activeDaysTrack[activeDaysTrack.length - 1];
    let nextDayIndex = DAYS_OF_WEEK.indexOf(lastDayName) + 1;

    if (nextDayIndex >= DAYS_OF_WEEK.length || nextDayIndex <= 0) {
        nextDayIndex = 0; // Loops back to Monday safely
    }
    
    let nextDayName = DAYS_OF_WEEK[nextDayIndex];
    
    // De-duplicate name conflicts if clicking excessively
    if (activeDaysTrack.includes(nextDayName)) {
        nextDayName = `${nextDayName} (Alt)`;
    }

    activeDaysTrack.push(nextDayName);
    const container = document.getElementById('dynamic-tables-container');
    container.insertAdjacentHTML('beforeend', createSingleDayTableHTML(nextDayName));
    
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

function saveScheduleToFirebase() {
    // Collects current layout data cleanly without string crushing bugs
    console.log("Saving modern isolated table payloads to Firebase. Active configuration:", activeDaysTrack);
}

// Global cross-table change event tracking for auto-saving checkbox states
document.addEventListener('change', (e) => {
    if (e.target.classList.contains('schedule-input') || e.target.classList.contains('schedule-checkbox')) {
        saveScheduleToFirebase();
    }
});

// ==========================================================================
// Live Chat View Mechanics
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

        const msgHTML = `
            <div class="${rowClass}" id="msg-row-${msg.id}">
                <div class="msg-container-block">
                    <div class="msg-meta">${isSelf ? "You" : msg.senderName}</div>
                    <div class="${bubbleClass}">
                        ${replyMarkup}
                        <div class="msg-body-text">${msg.text}</div>
                    </div>
                </div>
            </div>
        `;
        container.insertAdjacentHTML('beforeend', msgHTML);
    });
}

function sendMessage() {
    const input = document.getElementById('message-input');
    const text = input.value.trim();
    if (!text) return;

    const newMsgObj = {
        id: "msg_" + Date.now(),
        senderId: currentUserId,
        senderName: "You",
        text: text,
        timestamp: Date.now()
    };

    localMessagesArray.push(newMsgObj);
    renderChatMessages(localMessagesArray);
    
    input.value = "";
    scrollToBottom();
}

function scrollToBottom() {
    const container = document.getElementById('chat-messages-container');
    if (container) {
        container.scrollTop = container.scrollHeight;
    }
}

// ==========================================================================
// Fixed Authentication / Logout Function
// ==========================================================================
function handleLogout() {
    const confirmLogout = confirm("Are you sure you want to log out of Redflag Build?");
    if (confirmLogout) {
        alert("Logged out safely.");
        // Redirect completely out or refresh state cleanly
        window.location.reload();
    }
}

// Setup initial triggers when window completes script load cycles
window.onload = () => {
    renderAllDayTables(); 

    // Listen for the Enter key on the chat input box
    const chatInput = document.getElementById('message-input');
    if (chatInput) {
        chatInput.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                sendMessage();
            }
        });
    }
};
