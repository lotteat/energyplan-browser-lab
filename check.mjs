import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseEnergyPlan, encodeUtf16 } from '../dist/parser.js';

const root = new URL('../', import.meta.url);
const read = path => readFile(new URL(path, root));
const json = async path => JSON.parse(await read(path));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const manifest = await json('dist/engine/manifest.json');

const filesystemHash = createHash('sha256');
let totalBytes = 0;
for (const name of manifest.rootParts) {
  assert.match(name, /^root-\d{2}\.bin$/);
  const bytes = await read('dist/engine/' + name);
  filesystemHash.update(bytes);
  totalBytes += bytes.length;
}
assert.equal(filesystemHash.digest('hex'), manifest.rootSha256, 'Wine filesystem checksum');
const app = await read('dist/engine/energyplan.zip');
assert.equal(hash(app), manifest.appSha256, 'EnergyPLAN archive checksum');
assert.equal(totalBytes + app.length, manifest.totalBytes, 'Runtime download byte count');
console.log('OK: original runtime and application archive checksums');

const examples = await json('dist/examples/index.json');
assert.equal(examples.length, 2);
const expected = [
  { demand: 0.699, co2: 0.533 },
  { demand: 0.8388, co2: 0.594 }
];
const inputs = [];
for (const [i, example] of examples.entries()) {
  assert.equal(example.demand, expected[i].demand);
  const output = await read('dist/' + example.outputFile);
  assert.equal(hash(output), example.outputSha256, example.name + ': original output checksum');
  const metrics = parseEnergyPlan(new TextDecoder('windows-1252').decode(output));
  assert.equal(metrics.co2, expected[i].co2, example.name + ': corrected CO2');
  assert.equal(metrics.co2Direct, 0);
  assert.equal(metrics.fuel, 2.31);
  assert.equal(metrics.cost, 3068);
  assert.equal(metrics.warnings.length, 3);
  for (const pattern of [/Grid Stabilisation/i, /Critical import/i, /District heating boiler/i]) {
    assert(metrics.warnings.some(message => pattern.test(message)));
  }
  const input = await read('dist/' + example.inputFile);
  assert.equal(input[0], 0xff);
  assert.equal(input[1], 0xfe);
  const text = new TextDecoder('utf-16le').decode(input);
  assert.deepEqual(Buffer.from(encodeUtf16(text)), input, 'Original input bytes survive download encoding');
  inputs.push(text.split(/\r?\n/));
  console.log('OK: ' + example.name + ' output, warnings, and input encoding');
}

assert.equal(inputs[0].length, inputs[1].length);
const differences = inputs[0].flatMap((line, i) => line === inputs[1][i] ? [] : [i]);
assert.equal(differences.length, 1, 'Only one input value changes between recorded examples');
const changed = differences[0];
assert.equal(inputs[0][changed - 1], 'Input_el_demand_Twh=');
assert.equal(Number(inputs[0][changed]), 0.699);
assert.equal(Number(inputs[1][changed]), 0.8388);
assert.equal(parseEnergyPlan('EnergyPLAN: no metrics here').co2, null);

for (const path of ['dist/app.js', 'dist/parser.js', 'dist/engine-bridge.js', 'dist/coi-serviceworker.js']) {
  const result = spawnSync(process.execPath, ['--check', fileURLToPath(new URL(path, root))], { encoding: 'utf8' });
  if (result.error) throw result.error;
  assert.equal(result.status, 0, path + ': ' + result.stderr);
}
console.log('OK: input comparison, missing values, and JavaScript syntax');
console.log('These checks do not execute EnergyPLAN or validate agreement with native Windows.');
