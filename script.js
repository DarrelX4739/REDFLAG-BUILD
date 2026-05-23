// CONFIGURATION: Replace the text inside the quotes with your actual Supabase credentials
const SUPABASE_URL = "sb_publishable_wsMn3PgnOS8sss77zfcKkQ_OnNF4l40"; 
const SUPABASE_ANON_KEY = "sb_secret_KjXTdt9pzeyrrRQeyVvwwA_MBCB-HNr";

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
        
        // Initialize Supabase client
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
    rows: [['', '', '', ''], ['', '', '', ''], ['', '', '', '']]
};

let appData = {};

async function initApp() {
    // Fetch initial configuration state from Cloud DB storage row
    const { data, error } = await supabaseClient
        .from('schedule')
        .select('data')
        .eq('id', 1)
        .single();

    if (data) {
        appData = data.data;
    } else {
        appData = JSON.parse(JSON.stringify(defaultData));
        await saveToCloud();
    }
    renderSchedule();

    // Open Realtime Websocket channel network listener pipeline
    supabaseClient
        .channel('schema-db-changes')
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'schedule', filter: 'id=eq.1' }, payload => {
            appData = payload.new.data;
            renderSchedule();
        })
        .subscribe();
}

async function saveToCloud() {
    await supabaseClient
        .from('schedule')
        .upsert({ id: 1, data: appData });
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
                
                // Triggers structural data save upon cloud synchronization events
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
