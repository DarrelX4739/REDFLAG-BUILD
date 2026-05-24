// Example Reference setup - change this to match your real initialization!
// const database = firebase.database();

// Global configurations
let currentUserId = "user123"; 
let activeReplyTargetId = null;

// Lock the cycle strictly to the business week!
const DAYS_OF_WEEK = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

// ==========================================================================
// View System Navigation Switches (FIXED)
// ==========================================================================
function switchView(viewName, clickedButton) {
    const scheduleView = document.getElementById('schedule-view');
    const chatView = document.getElementById('chat-view');
    const buttons = document.querySelectorAll('.tab-navigation .tab-btn');
    
    // Clear the active class from all navigation tabs
    buttons.forEach(b => b.classList.remove('active'));
    
    // Explicitly add active styling directly to the button element clicked
    if (clickedButton) {
        clickedButton.classList.add('active');
    }
    
    if (viewName === 'schedule') {
        scheduleView.style.display = 'block';
        chatView.style.display = 'none';
    } else {
        scheduleView.style.display = 'none';
        chatView.style.display = 'flex';
        scrollToBottom();
    }
}

// ==========================================================================
// Schedule Sync & Dynamic Management Rules
// ==========================================================================

function generateCellHTML(savedValue = "") {
    let taskText = "";
    let isChecked = false;

    // Smart-parsing: Handle objects safely, drop back to raw strings if needed
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
    
    // Cycle strictly back to Monday if we exceed Friday
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

    // Prevent deleting the initial label column
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
    
    // Wire up your real live sync line here:
    // database.ref('shared_schedule').set(fullSchedulePayload);
    console.log("Synced Mon-Fri cycle layout to Firebase safely:", fullSchedulePayload);
}

// Watch inputs and checkboxes for changes to trigger an auto-save
document.querySelector('.table-container').addEventListener('change', (e) => {
    if (e.target.classList.contains('schedule-input') || e.target.classList.contains('schedule-checkbox')) {
        saveScheduleToFirebase();
    }
});

function addNewRow(savedRowData = null, columnCount = 6) {
    const tbody = document.getElementById('schedule-body');
    const tr = document.createElement('tr');
    
    for (let i = 0; i < columnCount; i++) {
        let structuralCellData = savedRowData && savedRowData[i] ? savedRowData[i] : "";
        tr.innerHTML += generateCellHTML(structuralCellData);
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

    if (incomingSnapshotPayload) {
        if (incomingSnapshotPayload.headers && incomingSnapshotPayload.rows) {
            headerRow.innerHTML = incomingSnapshotPayload.headers.map(h => `<th>${h}</th>`).join('');
            const colCount = incomingSnapshotPayload.headers.length;
            incomingSnapshotPayload.rows.forEach(rowData => {
                addNewRow(rowData, colCount);
            });
        } 
        else if (Array.isArray(incomingSnapshotPayload)) {
            headerRow.innerHTML = `
                <th>Time / Task</th>
                <th>Monday</th>
                <th>Tuesday</th>
                <th>Wednesday</th>
                <th>Thursday</th>
                <th>Friday</th>
            `;
            incomingSnapshotPayload.forEach(rowData => {
                addNewRow(rowData, 6);
            });
        }
    } else {
        // Build a fresh template layout grid if the database reference path yields nothing
        headerRow.innerHTML = `
            <th>Time / Task</th>
            <th>Monday</th>
            <th>Tuesday</th>
            <th>Wednesday</th>
            <th>Thursday</th>
            <th>Friday</th>
        `;
        for (let r = 0; r < 5; r++) {
            addNewRow(null, 6); // 1 time/task column + 5 weekday columns
        }
    }
}

window.onload = () => {
    // When wiring up live data listeners, replace the fallback loading call below with:
    // database.ref('shared_schedule').on('value', (snap) => { loadScheduleFromFirebase(snap.val()); });
    loadScheduleFromFirebase(null); 
};

// ==========================================================================
// Live Chat View Mechanics
// ==========================================================================
function sendMessage() {
    const input = document.getElementById('message-input');
    if (!input.value.trim()) return;
    
    console.log("Chat Message dispatched:", input.value);
    input.value = "";
    cancelReply();
}

function cancelReply() {
    activeReplyTargetId = null;
    document.getElementById('reply-bar').style.display = 'none';
}

function scrollToBottom() {
    const container = document.getElementById('chat-messages-container');
    if (container) {
        container.scrollTop = container.scrollHeight;
    }
}

function handleLogout() {
    alert("Logging out safely...");
}
