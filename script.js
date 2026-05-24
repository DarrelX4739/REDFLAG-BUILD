// Example Reference setup - change this to match your real initialization!
// const database = firebase.database();

let currentUserId = "user123"; 
let activeReplyTargetId = null;

// Lock the cycle strictly to the business week!
const DAYS_OF_WEEK = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

// ==========================================================================
// View System Navigation Switches
// ==========================================================================
function switchView(viewName) {
    const scheduleView = document.getElementById('schedule-view');
    const chatView = document.getElementById('chat-view');
    const buttons = document.querySelectorAll('.tab-navigation .tab-btn');
    
    buttons.forEach(b => b.classList.remove('active'));
    
    if (viewName === 'schedule') {
        scheduleView.style.display = 'block';
        chatView.style.display = 'none';
        event.target.classList.add('active');
    } else {
        scheduleView.style.display = 'none';
        chatView.style.display = 'flex';
        event.target.classList.add('active');
        scrollToBottom();
    }
}

// ==========================================================================
// Schedule Sync & Dynamic Management Rules (Firebase Object Enabled)
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

// Dynamically handles adding a day header and cycling cleanly between Mon-Fri
function addNewDayColumn() {
    const headerRow = document.getElementById('table-header-row');
    const currentHeaders = headerRow.querySelectorAll('th');
    
    const lastDayName = currentHeaders[currentHeaders.length - 1].innerText.trim();
    const formattedLastDay = lastDayName.charAt(0).toUpperCase() + lastDayName.slice(1).toLowerCase();
    
    let nextDayIndex = DAYS_OF_WEEK.indexOf(formattedLastDay) + 1;
    
    // If it hits Friday or a broken index, roll straight back to Monday!
    if (nextDayIndex >= DAYS_OF_WEEK.length || nextDayIndex <= 0) {
        nextDayIndex = 0;
    }
    const nextDayName = DAYS_OF_WEEK[nextDayIndex];

    // 1. Create header column element
    const newTh = document.createElement('th');
    newTh.innerText = nextDayName;
    headerRow.appendChild(newTh);

    // 2. Inject task structure cell item into every active line row
    const tableRows = document.querySelectorAll('#schedule-body tr');
    tableRows.forEach(row => {
        row.insertAdjacentHTML('beforeend', generateCellHTML(""));
    });

    saveScheduleToFirebase();
}

function removeLastDayColumn() {
    const headerRow = document.getElementById('table-header-row');
    const currentHeaders = headerRow.querySelectorAll('th');

    // Never remove the first indexing label column ("Time / Task")
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
    
    // Replace with your real target Firebase routing configurations
    // database.ref('schedules/weekly').set(fullSchedulePayload);
    console.log("Synced Mon-Fri cycle layout to Firebase safely:", fullSchedulePayload);
}

// Event tracking for content updates
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
        for (let r = 0; r < 5; r++) addNewRow(null, 6);
    }
}

window.onload = () => {
    // Dummy link simulation. Wire up your true database references here:
    // database.ref('schedules/weekly').on('value', (snap) => { loadScheduleFromFirebase(snap.val()); });
    loadScheduleFromFirebase(null); 
};

// ==========================================================================
// Live Chat View Mechanics (Unchanged messaging rules)
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
    container.scrollTop = container.scrollHeight;
}

function handleLogout() {
    alert("Logging out safely...");
}
