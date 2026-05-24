// CONFIGURATION: Paste your actual Firebase web app details inside the quotes below
const FIREBASE_API_KEY = "AIzaSyBoNeyQM6aUZ7IjJ5RPPXwxPRGFEaYO75M";
const FIREBASE_AUTH_DOMAIN = "redflag-build.firebaseapp.com";
const FIREBASE_DATABASE_URL = "https://redflag-build-default-rtdb.firebaseio.com";

// Inject the standard Firebase App and Database SDK libraries via CDN
const scriptApp = document.createElement('script');
scriptApp.src = 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js';
document.head.appendChild(scriptApp);

const scriptDB = document.createElement('script');
scriptDB.src = 'https://www.gstatic.com/firebasejs/10.8.0/firebase-database-compat.js';
document.head.appendChild(scriptDB);

let db;

function checkPassword() {
    const input = document.getElementById('password-input').value;
    const errorMsg = document.getElementById('error-msg');
    
    if (input === '4739') {
        document.getElementById('password-screen').style.display = 'none';
        document.getElementById('main-content').style.display = 'block';
        
        // Initialize Firebase client connections
        const firebaseConfig = {
            apiKey: FIREBASE_API_KEY,
            authDomain: FIREBASE_AUTH_DOMAIN,
            databaseURL: FIREBASE_DATABASE_URL
        };
        firebase.initializeApp(firebaseConfig);
        db = firebase.database();
        
        initApp();
    } else {
        errorMsg.style.display = 'block';
        document.getElementById('password-input').value = '';
    }
}

document.getElementById('password-input').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') checkPassword();
});

// PREBUILT DATA: The fallback template used if your cloud database is totally empty
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

let appData = {};

function initApp() {
    // Set up a real-time live synchronization listener pipeline on the "shared_schedule" data tree path
    db.ref('shared_schedule').on('value', (snapshot) => {
        const data = snapshot.val();
        if (data) {
            appData = data;
        } else {
            appData = JSON.parse(JSON.stringify(defaultData));
            saveToCloud();
        }
        renderSchedule();
    });
}

function saveToCloud() {
    if (db) {
        db.ref('shared_schedule').set(appData);
    }
}

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
                
                // Updates Firebase live when user clicks away or completes typing
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
    saveToCloud(); 
    renderSchedule();
}

function deleteRow(day) {
    if (appData.values[day] && appData.values[day].length > 1) {
        appData.values[day].pop();
        saveToCloud(); 
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
        saveToCloud(); 
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
        saveToCloud(); 
        renderSchedule();
    }
// Force-inject the Normanhurst Nitro logo directly using JavaScript
(function() {
    let link = document.querySelector("link[rel*='icon']");
    if (!link) {
        link = document.createElement('link');
        document.head.appendChild(link);
    }
    link.type = 'image/png';
    link.rel = 'icon';
    link.href = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAANSUhEUgAAAAsAAAAAsCAYAAABzNVQICAgIfAhkiAAAA0VJREFUWlxtbU9oXFUUxn/nZRgHDSH/WtoYm1YLFXUhIuJCgpS0BrWlNehGEcFF1aXoShBERETcVBeKK10IBUNcBNE62jEqsYuCpaJtGrApEpNJjFoaJq5530Ricx7706r2ZoPHrx3z8f5vnvuOffBJv7vsGYBSY+4+4HsepIkr5rZDxnuoLs/miLWZj05ueM16yff/dcIIbyuCEEIL0e4x3LEI8fkFeY1xlMSSTOd5oEkGYmtm9lDjd+SeJPbmyOeL8MERf+RPbzNjmY60SOQ1A1UJc2a2bYIZY+ZTdS5dwCncoz3d0F1GlZBc1y0Be6zd/kuS4tWwN2fB9okfdTE+KGG94FcdHESzk7DeeAXsJ/Zqg8ZDz28py7uuqoBM7sfeLDZMUgaanJflzdQhl1AH3ANSAVoYclEjweOqIsntJNS1ICkbWZ2m6TDQEXSYstDNzJ6JZWAe3LR1c+gC2gFdM3ANfTjtFLC0XEMv0aielQiT5ekkHgYkUTN7rJFgZglwEKiYWSm9gwXTsAMMAUU1x671SIz3IzoFvRYKrPVKrkKuPu+usi1wMBVjuGspJlUYO4UnFuAZUDAcmiWOSZ5moTtVqLPaJxMwnFbopoz0DhS7n4Y+ETScRDP9Cea9TFMrQAtbQBc8CntGuSNxWY1SWGKTDADdRiu7ql8S5x93JBXcfiV1Kkh6XtDe18v290udIzyLdiNSJvJPfQwevqJPerGa2B1IjZWaDQL+ZjZAevXDQ2Y2JKlqZp3U/oKfxmGOtSk4BJpizH7JHKSpUgV01MQ6l6T4xKypdsXZBJ0igAF76C0ytwBpgAXeZj6+MFayKeMiCpWNq5pglJcsbMqkA1G6s36v5/GrVahu2gm3C2cCR5iwfKF83E08ZA042s7YI54u62HASgbsPAccLlety2dXNmHXwJFuvLJxDCOGlbIe5++n1uKqedw8RzoKkol+aGvYv7Q+N8ak+JbaRK8Pdv4n8et/IcMabTMN+TTxzu07Q/Z+F67trc/fVSOLBDo+5mHoI4Z0NCTckPhgp7Yqk1gXvd8yAu/+6Ue31e6Dk7h9kYtNJkvzZUGbmkyGeo5ArdXWjBjaxU1s4m++nHeOqdo/qwAAABJRU5ErkJggg==';
})();
