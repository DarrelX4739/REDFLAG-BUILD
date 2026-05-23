// CONFIGURATION: Replace the URL placeholder below with your actual Supabase Project URL
const SUPABASE_URL = "sb_publishable_wsMn3PgnOS8sss77zfcKkQ_OnNF4l40"; 
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndjZ3JiemNrYXlkd2dqY3pxa29yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk1NTc2MDEsImV4cCI6MjA5NTEzMzYwMX0.ElTZ8PfPfPPiewHQSRW27WGrgzmovEWmc5f0yHdr9rw"; // Filled automatically from your screenshot

// Inject Supabase library directly from CDN
const script = document.createElement('script');
script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
document.head.appendChild(script);

let supabaseClient;

function checkPassword() {
    const input = document.getElementById('password-input').value;
    const errorMsg = document.getElementById('error-msg');
    
    if (input === '4739') {
        document.getElementById('password-screen').style.display = 'none';
        document.getElementById('main-content').style.display = 'block';
        
        // Initialize standard Supabase client configuration
        supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
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

async function initApp() {
    try {
        const { data, error } = await supabaseClient
            .from('schedule')
            .select('data')
            .eq('id', 1);

        if (data && data.length > 0) {
            appData = data[0].data;
        } else {
            appData = JSON.parse(JSON.stringify(defaultData));
            await saveToCloud();
        }
        renderSchedule();
    } catch (err) {
        console.error("Database connection dropped, loading fallback layout:", err);
        appData = JSON.parse(JSON.stringify(defaultData));
        renderSchedule();
    }

    // Live sync streaming pipeline setup
    supabaseClient
        .channel('schema-db-changes')
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'schedule', filter: 'id=eq.1' }, payload => {
            if (payload.new && payload.new.data) {
                appData = payload.new.data;
                renderSchedule();
            }
        })
        .subscribe();
}

async function saveToCloud() {
    try {
        await supabaseClient
            .from('schedule')
            .upsert({ id: 1, data: appData });
    } catch (err) {
        console.error("Failed to commit updates to database context:", err);
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
                
                // Triggers structural sync action upon input defocus
                input.addEventListener('change', async (e) => {
                    appData.values[day][rIdx][cIdx] = e.target.value;
                    await saveToCloud();
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

async function addRow(day) {
    const newRow = new Array(appData.headers.length).fill('');
    if (!appData.values[day]) appData.values[day] = [];
    appData.values[day].push(newRow);
    await saveToCloud(); 
    renderSchedule();
}

async function deleteRow(day) {
    if (appData.values[day] && appData.values[day].length > 1) {
        appData.values[day].pop();
        await saveToCloud(); 
        renderSchedule();
    }
}

async function addColumn() {
    const colName = prompt("Enter column name:");
    if (colName) {
        appData.headers.push(colName);
        appData.days.forEach(day => {
            if (appData.values[day]) {
                appData.values[day].forEach(row => row.push(''));
            }
        });
        await saveToCloud(); 
        renderSchedule();
    }
}

async function deleteColumn() {
    if (appData.headers.length > 1) {
        appData.headers.pop();
        appData.days.forEach(day => {
            if (appData.values[day]) {
                appData.values[day].forEach(row => row.pop());
            }
        });
        await saveToCloud(); 
        renderSchedule();
    }
}
