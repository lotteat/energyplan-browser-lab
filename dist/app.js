import { parseEnergyPlan, encodeUtf16 } from './parser.js';
const $ = id => document.getElementById(id);
const presets = { reference: { name: 'Reference', demand: .699, wind: 0, solar: 0 }, demand: { name: '+20% electricity demand', demand: .8388, wind: 0, solar: 0 }, wind: { name: '100 MW wind', demand: .699, wind: 100, solar: 0 } };
const history = [];
let active = null, selected = null, clock = null, examplesLoading = false;
const format = value => value === null || !Number.isFinite(value) ? '—' : new Intl.NumberFormat('en-GB', { maximumFractionDigits: 4 }).format(value);
function status(title, detail, state = '') { $('status').textContent = title; $('status-detail').textContent = detail; $('status-dot').className = 'status-dot ' + state; }
function tab(name) {
  document.querySelectorAll('[data-tab]').forEach(button => { const chosen = button.dataset.tab === name; button.classList.toggle('active', chosen); button.setAttribute('aria-selected', String(chosen)); });
  ['results','model','log'].forEach(id => $('panel-' + id).hidden = id !== name);
}
document.querySelectorAll('[data-tab]').forEach(button => button.onclick = () => tab(button.dataset.tab));
document.querySelectorAll('[data-preset]').forEach(button => button.onclick = () => {
  const preset = presets[button.dataset.preset]; $('scenario-name').value = preset.name;
  ['demand','wind','solar'].forEach(id => $(id).value = preset[id]);
  document.querySelectorAll('[data-preset]').forEach(item => item.classList.toggle('active', item === button));
});
['demand','wind','solar'].forEach(id => $(id).addEventListener('input', () => document.querySelectorAll('[data-preset]').forEach(button => button.classList.remove('active'))));
function busy(value) { $('run').disabled = value; $('inputs').disabled = value; $('scenario-name').disabled = value; $('load-examples').disabled = value; $('stop').hidden = !value; }
function clearEngine() { const frame = $('engine'); if (frame) frame.remove(); clearInterval(clock); }
function log(message) { $('log').textContent += message + '\n'; $('log').scrollTop = $('log').scrollHeight; }
function showResult(result) {
  selected = result; $('empty').hidden = true; $('completed').hidden = false;
  if (!active) {
    $('scenario-name').value = result.name;
    ['demand','wind','solar'].forEach(id => $(id).value = result[id]);
    document.querySelectorAll('[data-preset]').forEach(button => button.classList.toggle('active', ['demand','wind','solar'].every(id => presets[button.dataset.preset][id] === result[id])));
  }
  $('result-name').textContent = result.name;
  $('result-meta').textContent = 'EnergyPLAN 16.3 · ' + new Date(result.completedAt).toLocaleString('en-GB') + ' · ' + Math.round(result.bytes / 1024) + ' KB result file';
  $('result-origin').textContent = result.isExample ? 'Precomputed example' : 'Completed';
  $('co2-context').textContent = 'Direct model total · ' + format(result.metrics.co2Direct) + ' ' + result.metrics.units.co2;
  $('model-warnings').hidden = !result.metrics.warnings.length;
  $('warning-list').replaceChildren(...result.metrics.warnings.map(warning => { const item = document.createElement('li'); item.textContent = warning; return item; }));
  $('raw-result').textContent = result.output.replace(/\0/g, '\t');
  for (const id of ['co2','fuel','cost']) { $(id).textContent = format(result.metrics[id]); $(id + '-unit').textContent = result.metrics.units[id] || 'See the result file for the unit'; }
}
function renderHistory() {
  $('history').replaceChildren(); $('scenario-count').textContent = history.length + (history.length === 1 ? ' run' : ' runs');
  for (const id of ['co2','fuel','cost']) $('table-' + id + '-unit').textContent = history[0]?.metrics.units[id] || '';
  history.forEach(result => {
    const row = document.createElement('tr'), nameCell = document.createElement('td'), button = document.createElement('button');
    button.textContent = result.name + (result.isExample ? ' · example' : ''); button.onclick = () => { showResult(result); tab('results'); }; nameCell.append(button); row.append(nameCell);
    [format(result.demand), format(result.wind) + ' / ' + format(result.solar), format(result.metrics.co2), format(result.metrics.fuel), format(result.metrics.cost)].forEach(value => { const cell = document.createElement('td'); cell.textContent = value; row.append(cell); });
    $('history').append(row);
  });
}
$('scenario-form').onsubmit = event => {
  event.preventDefault(); if (active || examplesLoading || !$('scenario-form').reportValidity()) return;
  clearEngine();
  active = { id: crypto.randomUUID(), name: $('scenario-name').value.trim() || 'My scenario', demand: Number($('demand').value), wind: Number($('wind').value), solar: Number($('solar').value), startedAt: Date.now() };
  busy(true); $('log').textContent = ''; $('download-progress').hidden = false; $('download-progress').value = 0;
  for (const id of ['co2','fuel','cost']) { $(id).textContent = '—'; $(id + '-unit').textContent = 'Awaiting results'; }
  $('co2-context').textContent = ''; $('elapsed').textContent = '0:00';
  $('completed').hidden = true; $('empty').hidden = false;
  status('Preparing run', 'Loading the original EnergyPLAN program…', 'running');
  const frame = document.createElement('iframe'); frame.id = 'engine'; frame.title = 'EnergyPLAN model engine';
  frame.src = 'engine.html?' + new URLSearchParams({ run: active.id, demand: active.demand, wind: active.wind, solar: active.solar });
  $('engine-holder').replaceChildren(frame); tab('model');
  clock = setInterval(() => { if (!active) return; const seconds = Math.floor((Date.now() - active.startedAt) / 1000); $('elapsed').textContent = Math.floor(seconds / 60) + ':' + String(seconds % 60).padStart(2, '0'); if (seconds === 180) status('EnergyPLAN is still starting', 'Starting the model can take a few minutes. You can follow its progress in the EnergyPLAN window. Keep this tab open.', 'running'); }, 1000);
};
$('stop').onclick = () => { if (!active) return; active = null; clearEngine(); busy(false); $('download-progress').hidden = true; $('engine-holder').textContent = 'The run has stopped.'; status('Run stopped', 'You can change the scenario and start another run.'); log('You stopped the run.'); };
window.addEventListener('message', event => {
  const data = event.data;
  if (event.origin !== location.origin || !data || data.source !== 'energyplan-engine' || !active || data.runId !== active.id || event.source !== $('engine')?.contentWindow) return;
  if (data.type === 'log') { log(data.message); return; }
  if (data.type === 'loading' || data.type === 'progress') { status('Loading the model engine', data.loaded ? Math.round(data.loaded / 1e6) + ' of ' + Math.round(data.total / 1e6) + ' MB' : data.message, 'running'); if (data.total) $('download-progress').value = 100 * (data.loaded || 0) / data.total; }
  if (data.type === 'running') { $('download-progress').hidden = true; status('EnergyPLAN is running', 'EnergyPLAN is starting up and processing your scenario. Keep this tab open.', 'running'); }
  if (data.type === 'error') { active = null; clearInterval(clock); busy(false); $('download-progress').hidden = true; status('The run could not finish', data.message, 'error'); log('ERROR · ' + data.message); }
  if (data.type === 'result') {
    const result = { ...active, ...data, metrics: parseEnergyPlan(data.output) };
    history.unshift(result); if (history.length > 12) history.pop();
    active = null; clearEngine(); busy(false); $('download-progress').hidden = true;
    $('engine-holder').textContent = 'EnergyPLAN has finished. Your results are available in this session.';
    status('Run complete', result.name + ' · Results are ready to explore.', 'done');
    showResult(result); renderHistory(); tab('results');
  }
});
function download(blob, filename) { const url = URL.createObjectURL(blob), link = document.createElement('a'); link.href = url; link.download = filename; link.click(); setTimeout(() => URL.revokeObjectURL(url), 10000); }
function slug() { return (selected.name.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-|-$/g, '') || 'scenario').slice(0,50); }
$('download-output').onclick = () => { if (selected) download(new Blob([selected.rawBytes || selected.output], {type: selected.rawBytes ? 'application/octet-stream' : 'text/plain;charset=utf-8'}), slug() + '-result.txt'); };
$('download-input').onclick = () => { if (selected) download(new Blob([encodeUtf16(selected.input)], {type:'application/octet-stream'}), slug() + '-input.txt'); };
$('download-csv').onclick = () => {
  if (!selected) return;
  const r = selected, csv = [['Scenario','Parameter','Value','Unit'],[r.name,'Electricity demand',r.demand,'TWh/year'],[r.name,'Wind RES1',r.wind,'MW'],[r.name,'Solar PV RES3',r.solar,'MW'],[r.name,'CO2 (direct model total)',r.metrics.co2Direct ?? '',r.metrics.units.co2],...[['co2','CO2 (corrected)'],['fuel','Fuel consumption'],['cost','Annual costs']].map(([id,label])=>[r.name,label,r.metrics[id] ?? '',r.metrics.units[id]])];
  const cell = value => { const text = String(value); return '"' + (typeof value !== 'number' && /^[=+\-@]/.test(text) ? "'" + text : text).replace(/"/g,'""') + '"'; };
  download(new Blob(['\ufeff' + csv.map(row => row.map(cell).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'}), slug() + '-indicators.csv');
};
$('load-examples').onclick = async () => {
  if (active || examplesLoading) return;
  examplesLoading = true; $('load-examples').disabled = true; $('run').disabled = true;
  status('Loading worked examples', 'Fetching the original input and result files from two completed runs.', 'running');
  try {
    const response = await fetch('examples/index.json'); if (!response.ok) throw new Error('Could not download the examples');
    const examples = await response.json();
    const records = await Promise.all(examples.map(async example => {
      const [outputResponse, inputResponse] = await Promise.all([fetch(example.outputFile), fetch(example.inputFile)]);
      if (!outputResponse.ok || !inputResponse.ok) throw new Error('Could not download an example file');
      const rawBytes = new Uint8Array(await outputResponse.arrayBuffer());
      const output = new TextDecoder('windows-1252').decode(rawBytes);
      const input = new TextDecoder('utf-16le').decode(await inputResponse.arrayBuffer());
      return {...example, rawBytes, output, input, bytes:rawBytes.length, metrics:parseEnergyPlan(output), isExample:true};
    }));
    for (const record of records) if (!history.some(existing => existing.id === record.id)) history.push(record);
    renderHistory(); showResult(records[0]); tab('results');
    status('Worked examples loaded', 'These are results from earlier EnergyPLAN runs. Start a new run to test your own inputs.', 'done');
    $('elapsed').textContent = '';
  } catch (error) { status('Could not load the examples', error.message, 'error'); }
  finally { examplesLoading = false; $('load-examples').disabled = false; $('run').disabled = !self.crossOriginIsolated; }
};
window.addEventListener('beforeunload', event => { if (active) { event.preventDefault(); event.returnValue = ''; } });
if (!self.crossOriginIsolated) {
  $('run').disabled = true;
  status('Preparing your browser', 'The page will reload automatically when the model environment is ready.');
  setTimeout(() => status('Browser setup incomplete', 'Reload the page. Use Chrome or Firefox with service workers enabled.', 'error'), 12000);
}
