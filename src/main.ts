// Safe global hooks accessing Tauri's architecture engines
const tauriCore = (window as any).__TAURI__?.core;
let masterRowsGlobal: string[] = [];

window.addEventListener("DOMContentLoaded", () => {
  const syncBtn = document.getElementById("btn-sync-device");
  const status = document.getElementById("status-msg");

  if (status) status.innerText = "Ready. Set hardware to USB SYNC MODE (Hold Button 6 for 5s).";

  syncBtn?.addEventListener("click", async () => {
    const serialPlugin = (window as any).__TAURI__?.serialport;
    if (!serialPlugin) {
      alert("Tauri Serialport plugin is missing. Verify setup.");
      return;
    }

    if (status) {
      status.style.color = "#007acc";
      status.innerText = "Scanning active USB serial lines...";
    }

    try {
      // 1. Discover and target the plugged-in ESP32 board
      const ports = await serialPlugin.availablePorts();
      if (ports.length === 0) {
        if (status) status.innerText = "Error: No plugged-in device detected! Check wire connection.";
        return;
      }

      const targetPort = ports[0].portName;
      if (status) status.innerText = `Connecting to ${targetPort} at 115200 baud...`;

      // 2. Open serial line matching your firmware configuration
      const connection = await serialPlugin.open({
        path: targetPort,
        baudRate: 115200
      });

      if (status) status.innerText = "Handshake success! Querying CSV database dump...";

      // 3. Request the firmware data dump
      await connection.write("DOWNLOAD_CSV\n");

      // 4. Gather the text buffer chunks
      let accumulator = "";
      let isReadingData = false;
      let incomingDeviceRows: string[] = [];
      const decoder = new TextDecoder();

      // Read loop watching incoming byte packets
      while (true) {
        const chunk = await connection.read({ timeout: 2000 });
        if (!chunk || chunk.length === 0) break; // Break out if connection silences

        accumulator += decoder.decode(new Uint8Array(chunk));
        let lines = accumulator.split("\n");
        accumulator = lines.pop() || ""; // Retain incomplete trailing string sequences safely

        for (let line of lines) {
          line = line.trim();

          // Intercept firmware flags
          if (line === "---CSV_START---") {
            isReadingData = true;
            continue;
          }
          if (line === "---CSV_END---") {
            isReadingData = false;
            break; // Data extraction finished successfully
          }

          if (isReadingData && line.length > 0) {
            incomingDeviceRows.push(line);
          }
        }

        if (accumulator.includes("---CSV_END---") || !isReadingData && incomingDeviceRows.length > 0) {
          break;
        }
      }

      // Safe clean up closure closing down port locks
      await connection.close();

      if (incomingDeviceRows.length === 0) {
        if (status) status.innerText = "Failed to capture logs. Ensure device shows 'USB SYNC MODE' on screen.";
        return;
      }

      if (status) status.innerText = `Extracted ${incomingDeviceRows.length - 1} log items. Syncing with Master...`;

      // 5. Invoke your native Master CSV engine to append and deduplicate these rows!
      // We pass the fresh device array directly into your existing sync backend
      masterRowsGlobal = await tauriCore.invoke("sync_with_device_csv", { deviceLines: incomingDeviceRows });

      if (status) {
        status.style.color = "#28a745";
        status.innerText = `Success! Local Master CSV expanded to ${masterRowsGlobal.length - 1} unique metrics.`;
      }

      // Redraw visual table spreadsheets and Chart.js graphics canvases
      (window as any).renderTable?.(masterRowsGlobal);
      (window as any).renderChart?.();

    } catch (err) {
      if (status) {
        status.style.color = "#dc3545";
        status.innerText = "Extraction Error: " + err;
      }
    }
  });
});
