/* EnergyPLAN Lab: original EnergyPLAN executable inside Boxedwine WebAssembly. */
(() => {
  'use strict';
  const query = new URLSearchParams(location.search);
  const runId = query.get('run') || 'preview';
  const runtimeBase = 'engine/';
  const emit = (type, data = {}) => parent.postMessage({ source: 'energyplan-engine', runId, type, ...data }, location.origin);
  let failed = false, delivered = false;
  const fail = error => { if (failed || delivered) return; failed = true; emit('error', { message: error?.message || String(error) }); document.getElementById('status').textContent = 'The run could not finish'; };
  window.addEventListener('error', event => { emit('log', { message: 'Runtime error · ' + (event.error?.stack || event.message) }); fail(event.error || event.message); });
  window.addEventListener('unhandledrejection', event => fail(event.reason));
  Config.storageMode = STORAGE_MEMORY;
  Config.persist_d_drive = false;
  Config.urlParams = 'app=energyplan&p=energyPLAN.exe&auto=true&sound=false&resolution=1280x900&storage=memory&rootfs=memory&storageKey=default&rootBase=engine&appBase=engine&overlayBase=engine';
  Config.showSaveJITCache = false;
  Config.locateAppBaseUrl = 'engine/';
  Config.locateRootBaseUrl = 'engine/';
  Config.locateOverlayBaseUrl = 'engine/';
  const originalArgs = getEmulatorParams;
  getEmulatorParams = function () {
    const args = originalArgs();
    const mount = args.findIndex((arg, i) => arg === '-mount' && args[i + 1] === 'energyplan.zip');
    if (mount >= 0) args.splice(mount, 3);
    const workingDirectory = args.indexOf('-w');
    if (workingDirectory < 0) throw new Error('The program working directory is missing');
    args[workingDirectory + 1] = '/mnt/drive_d/energyplan';
    return [...args, '-i', 'browser-scenario.txt', '-ascii', 'd:\\result.txt'];
  };
  let manifest, scenarioText, applicationZip;
  const encodeUtf16 = text => {
    const out = new Uint8Array(2 + text.length * 2); out[0] = 255; out[1] = 254;
    const view = new DataView(out.buffer); for (let i = 0; i < text.length; i++) view.setUint16(2 + i * 2, text.charCodeAt(i), true);
    return out;
  };
  function setValue(text, key, value) {
    const lines = text.split(/\r?\n/); let count = 0;
    for (let i = 0; i < lines.length - 1; i++) if (lines[i].toLowerCase() === key.toLowerCase() + '=') { lines[i + 1] = String(value); count++; }
    if (count !== 1) throw new Error('Could not identify model parameter ' + key);
    return lines.join('\r\n');
  }
  const originalBuild = buildBrowserFileSystem;
  buildBrowserFileSystem = function () {
    if (!applicationZip) throw new Error('The program archive is missing');
    const directory = Config.d_drive + '/energyplan';
    const files = fflate.unzipSync(applicationZip);
    let unpacked = 0, count = 0;
    for (const [name, bytes] of Object.entries(files)) {
      if (name.startsWith('/') || name.includes('\\') || name.split('/').includes('..')) throw new Error('Invalid file path in the program archive');
      unpacked += bytes.length;
      if (unpacked > 200 * 1024 * 1024) throw new Error('The program archive is too large');
      const path = directory + '/' + name;
      if (name.endsWith('/')) { FS.mkdirTree(path); continue; }
      FS.mkdirTree(path.slice(0, path.lastIndexOf('/')));
      FS.writeFile(path, bytes); count++;
    }
    FS.writeFile(directory + '/energyPlan Data/Data/browser-scenario.txt', encodeUtf16(scenarioText));
    FS.writeFile(Config.d_drive + '/result.txt', new Uint8Array());
    applicationZip = null;
    emit('log', { message: count + ' program and data files unpacked into browser memory (' + Math.round(unpacked / 1e6) + ' MB).' });
    originalBuild();
  };
  let loaded = 0;
  async function getBytes(url) {
    const response = await fetch(url); if (!response.ok) throw new Error('Could not download a model file (' + response.status + ')');
    const bytes = new Uint8Array(await response.arrayBuffer()); loaded += bytes.length;
    emit('progress', { loaded, total: manifest.totalBytes, message: 'Loading EnergyPLAN and its runtime' });
    return bytes;
  }
  loadFile = function (prefix, filename, callback) {
    (async () => {
      if (filename === 'boxedwine.zip') {
        const parts = await Promise.all(manifest.rootParts.map(p => getBytes('engine/' + p)));
        const data = new Uint8Array(parts.reduce((n, p) => n + p.length, 0)); let offset = 0;
        for (const part of parts) { data.set(part, offset); offset += part.length; }
        callback(data);
      } else {
        const bytes = await getBytes(prefix + filename);
        if (filename === 'energyplan.zip') applicationZip = bytes;
        callback(bytes);
      }
    })().catch(fail);
  };
  Module.locateFile = path => runtimeBase + path;
  Module.mainScriptUrlOrBlob = new URL(runtimeBase + 'boxedwine.js', location.href).href;
  const originalPrint = Module.print;
  Module.print = (...args) => { originalPrint(...args); const message = args.join(' '); emit('log', { message }); if (/Importing dlls.*failed/i.test(message)) fail(new Error('EnergyPLAN could not start because a Windows component is missing. See the run log.')); };
  const originalPrintErr = Module.printErr;
  Module.printErr = (...args) => { originalPrintErr(...args); const message = args.join(' '); emit('log', { message }); if (/Importing dlls.*failed/i.test(message)) fail(new Error('EnergyPLAN could not start because a Windows component is missing. See the run log.')); };
  Module.onAbort = reason => fail(new Error('The model engine stopped · ' + reason));
  const upstreamRuntimeInitialized = Module.onRuntimeInitialized;
  Module.onRuntimeInitialized = function () {
    upstreamRuntimeInitialized?.call(this);
    emit('running', { message: 'EnergyPLAN is running the scenario' });
    let previousSize = 0, stableSince = 0, inspected = false;
    const poll = setInterval(() => {
      if (failed || delivered) { clearInterval(poll); return; }
      try {
        const stat = FS.stat(Config.d_drive + '/result.txt');
        if (!stat.size) return;
        if (stat.size !== previousSize) { if (!previousSize) emit('log', { message: 'EnergyPLAN is writing the result file (' + stat.size + ' bytes).' }); previousSize = stat.size; stableSince = Date.now(); return; }
        if (Date.now() - stableSince < 4000) return;
        const bytes = FS.readFile(Config.d_drive + '/result.txt');
        const encoding = bytes[0] === 255 && bytes[1] === 254 ? 'utf-16le' : bytes[0] === 254 && bytes[1] === 255 ? 'utf-16be' : bytes[0] === 239 && bytes[1] === 187 && bytes[2] === 191 ? 'utf-8' : 'windows-1252';
        const output = new TextDecoder(encoding).decode(bytes);
        if (!inspected) { inspected = true; emit('log', { message: 'Result file · ' + bytes.length + ' bytes, ' + encoding + '. ' + output.slice(0, 180).replace(/\0/g, ' ') }); }
        if (!output.includes('EnergyPLAN') || !/TOTAL ANNUAL COSTS|Fuel Consumption|CO2.emission/i.test(output)) return;
        delivered = true; clearInterval(poll);
        emit('result', { output, rawBytes: bytes, input: scenarioText, bytes: bytes.length, completedAt: new Date().toISOString() });
        document.getElementById('status').textContent = 'EnergyPLAN has written the result file';
      } catch { /* No output file yet. */ }
    }, 750);
  };
  (async () => {
    const [m, model] = await Promise.all([fetch('engine/manifest.json').then(r => r.json()), fetch('model.json').then(r => r.json())]);
    manifest = m; scenarioText = model.input;
    // The source case sets additional exports to zero but references a profile absent from its bundle.
    // Use the included all-zero profile for that inactive demand and preserve all energy quantities.
    scenarioText = setValue(scenarioText, 'Filnavn_AddExport', 'zero.txt');
    for (const [param, key, min, max, fallback] of [
      ['demand','Input_el_demand_Twh',0.01,10,0.699],
      ['wind','input_RES1_capacity',0,5000,0],
      ['solar','input_RES3_capacity',0,5000,0]
    ]) {
      const raw = query.get(param); const value = raw === null ? fallback : Number(raw);
      if (!Number.isFinite(value) || value < min || value > max) throw new Error('Invalid value for ' + param);
      scenarioText = setValue(scenarioText, key, value);
    }
    emit('loading', { total: manifest.totalBytes, message: 'Preparing the scenario' });
    if (!self.crossOriginIsolated || typeof SharedArrayBuffer === 'undefined') throw new Error('The browser runtime is not ready. Reload the page in Chrome or Firefox.');
    emit('log', { message: 'Runtime · Boxedwine build 140 · MT interpreter · Wine 11 web-v41 · isolated browser environment' });
    const script = document.createElement('script'); script.src = runtimeBase + 'boxedwine.js'; script.onerror = () => fail(new Error('Could not load the model engine')); document.body.append(script);
  })().catch(fail);
})();
