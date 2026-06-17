import { Chart, registerables } from 'chart.js';
Chart.register(...registerables); // Required to initialize Chart.js modules

let file1Path: string = "";
let file2Path: string = "";
let mergedRowsGlobal: string[] = [];
let chartInstance: Chart | null = null;

window.addEventListener("DOMContentLoaded", () => {
  const tauriCore = (window as any).__TAURI__?.core;
  const tauriDialog = (window as any).__TAURI__?.dialog;

  // File 1 Selector
  document.getElementById("btn-file1")?.addEventListener("click", async () => {
    const selected = await tauriDialog?.open({ multiple: false, filters: [{ name: 'CSV', extensions: ['csv'] }] });
    if (selected) {
      file1Path = typeof selected === 'string' ? selected : selected.path;
      updatePathsLabel();
    }
  });

  // File 2 Selector
  document.getElementById("btn-file2")?.addEventListener("click", async () => {
    const selected = await tauriDialog?.open({ multiple: false, filters: [{ name: 'CSV', extensions: ['csv'] }] });
    if (selected) {
      file2Path = typeof selected === 'string' ? selected : selected.path;
      updatePathsLabel();
    }
  });

  function updatePathsLabel() {
    const lbl = document.getElementById("paths-summary");
    if (lbl) lbl.innerText = `Ready:\nSheet 1: ${file1Path || 'None'}\nSheet 2: ${file2Path || 'None'}`;
  }

  // Combine & Render Dashboard Command
  document.getElementById("btn-combine")?.addEventListener("click", async () => {
    if (!file1Path || !file2Path) {
      alert("Please assign both files first!");
      return;
    }
    const status = document.getElementById("status-msg");
    if (status) status.innerText = "Processing records...";

    try {
      mergedRowsGlobal = await tauriCore.invoke("process_csv_files", { fileA: file1Path, fileB: file2Path });
      if (status) status.innerText = `Success! Derived ${mergedRowsGlobal.length - 1} data records.`;

      // Enable the save button
      (document.getElementById("btn-save") as HTMLButtonElement).disabled = false;

      renderTable(mergedRowsGlobal);
      renderChart();
    } catch (err) {
      if (status) status.innerText = "Error: " + err;
    }
  });

  // Save Merged File Command
  document.getElementById("btn-save")?.addEventListener("click", async () => {
    if (mergedRowsGlobal.length === 0) return;
    try {
      const savePath = await tauriDialog?.save({
        title: "Save Merged Data Sheet",
        filters: [{ name: 'CSV Document', extensions: ['csv'] }]
      });

      if (savePath) {
        // Send our cleaned array rows straight to a native file saver command
        await tauriCore.invoke("save_csv_file", { path: savePath, content: mergedRowsGlobal });
        alert("File exported successfully!");
      }
    } catch (err) {
      alert("Save Error: " + err);
    }
  });

  // Redraw the graph whenever the user toggles the dropdown selector box
  document.getElementById("chart-type")?.addEventListener("change", () => {
    if (mergedRowsGlobal.length > 0) renderChart();
  });
});

// Render the Spreadsheet Table Grid View
function renderTable(rows: string[]) {
  const dataArea = document.getElementById("data-display");
  if (!dataArea) return;

  let tableHtml = "<table>";
  rows.forEach((row, index) => {
    const columns = row.split(",");
    tableHtml += "<tr>";
    columns.forEach(col => {
      tableHtml += index === 0 ? `<th>${col}</th>` : `<td>${col}</td>`;
    });
    tableHtml += "</tr>";
  });
  tableHtml += "</table>";
  dataArea.innerHTML = tableHtml;
}

// Generate the Chart.js visual graphics
function renderChart() {
  if (mergedRowsGlobal.length < 2) return;

  const labels: string[] = [];
  const numericData: number[] = [];

  // Index 0 contains our column titles. Row items start at Index 1.
  for (let i = 1; i < mergedRowsGlobal.length; i++) {
    const cols = mergedRowsGlobal[i].split(",");
    if (cols.length >= 2) {
      labels.push(cols[0]); // Column 1: Row Item Labels
      numericData.push(parseFloat(cols[1]) || 0); // Column 2: Plotted Numbers
    }
  }

  const select = document.getElementById("chart-type") as HTMLSelectElement;
  const chartType = select.value as 'bar' | 'line' | 'pie';
  const ctx = (document.getElementById('analyticsChart') as HTMLCanvasElement).getContext('2d');

  if (chartInstance) chartInstance.destroy(); // Clear out old rendering canvases safely

  if (ctx) {
    chartInstance = new Chart(ctx, {
      type: chartType,
      data: {
        labels: labels,
        datasets: [{
          label: 'Data Values',
          data: numericData,
          backgroundColor: chartType === 'pie'
              ? ['#ff6384', '#36a2eb', '#cc65fe', '#ffce56', '#4bc0c0', '#9966ff']
              : '#007acc',
          borderColor: '#005999',
          borderWidth: 1
        }]
      },
      options: { responsive: true, maintainAspectRatio: false }
    });
  }
}
