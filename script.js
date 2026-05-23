function checkPassword() {
    const input = document.getElementById('password-input').value;
    const errorMsg = document.getElementById('error-msg');
    
    if (input === '4739') {
        document.getElementById('password-screen').style.display = 'none';
        document.getElementById('main-content').style.display = 'block';
        initApp();
    } else {
        errorMsg.style.display = 'block';
        document.getElementById('password-input').value = '';
    }
}

document.getElementById('password-input').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') checkPassword();
});

const defaultData = {
    days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
    headers: ['Morning', 'Recess', 'Lunch', 'Afternoon'],
    rows: [['', '', '', ''], ['', '', '', ''], ['', '', '', '']]
};

let appData = {};

function initApp() {
    // This wipes older saved data setups to force display the new layout columns correctly
    localStorage.removeItem('redflag_schedule_data');
    
    appData = JSON.parse(JSON.stringify(defaultData));
    saveToStorage();
    renderSchedule();
}

function saveToStorage() {
    localStorage.setItem('redflag_schedule_data', JSON.stringify(appData));
}

function renderSchedule() {
    const container = document.getElementById('schedule-container');
    container.innerHTML = '';

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
                input.addEventListener('input', (e) => {
                    appData.values[day][rIdx][cIdx] = e.target.value;
                    saveToStorage();
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
    saveToStorage(); 
    renderSchedule();
}

function deleteRow(day) {
    if (appData.values[day] && appData.values[day].length > 1) {
        appData.values[day].pop();
        saveToStorage(); 
        renderSchedule();
    }
}

function addColumn() {
    const colName = prompt("Enter column name:");
    if (colName) {
        appData.headers.push(colName);
        appData.days.forEach(day => {
            if (appData.values[day]) {
                appData.values[day].forEach(row => row.push(''));
            }
        });
        saveToStorage(); 
        renderSchedule();
    }
}

function deleteColumn() {
    if (appData.headers.length > 1) {
        appData.headers.pop();
        appData.days.forEach(day => {
            if (appData.values[day]) {
                appData.values[day].forEach(row => row.pop());
            }
        });
        saveToStorage(); 
        renderSchedule();
    }
}
