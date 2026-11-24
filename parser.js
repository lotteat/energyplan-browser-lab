export function parseEnergyPlan(text) {
  const rows = text.split(/\r?\n/);
  const number = value => /^[-+]?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?$/i.test(value || '') ? Number(value) : null;
  const scalar = label => {
    const row = rows.find(line => line.split(/[\0\t]/, 1)[0].trim().toLowerCase() === label.toLowerCase());
    if (!row) return null;
    return number(row.split(/[\0\t]/).slice(1).map(cell => cell.trim()).find(cell => cell !== ''));
  };
  const unit = expression => text.match(expression)?.[1]?.trim() || '';
  return {
    co2: scalar('CO2-emission (corrected)'),
    co2Direct: scalar('CO2-emission (total)'),
    fuel: scalar('Fuel Consumption (total)'),
    cost: scalar('TOTAL ANNUAL COSTS'),
    warnings: [...text.slice(0, 12000).matchAll(/WARNING:\s*([^§\r\n]+)/gi)].map(match => match[1].trim()),
    units: {
      co2: unit(/ANNUAL CO2 EMISSIONS\s*\(([^)]+)\)/i),
      fuel: unit(/ANNUAL FUEL CONSUMPTIONS\s*\(([^)]+)\)/i),
      cost: unit(/ANNUAL COSTS\s*\(([^)]+)\)/i)
    }
  };
}
export function encodeUtf16(text) {
  const bytes = new Uint8Array(2 + text.length * 2); bytes[0] = 255; bytes[1] = 254;
  const view = new DataView(bytes.buffer);
  for (let i = 0; i < text.length; i++) view.setUint16(2 + 2 * i, text.charCodeAt(i), true);
  return bytes;
}
