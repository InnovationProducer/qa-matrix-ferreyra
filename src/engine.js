import readXlsxFile from 'read-excel-file';
import { COSTO_DB, SEV_DB, DETECTION_POINTS, OCCURRENCE_TABLE } from './data';

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════

function mapDetectionPoint(raw) {
  const r = (raw || '').toString().trim();
  // Direct matches to our 11 canonical keys
  const MAP = {
    'Recepción': 'Recepción',
    'Autocontrol': 'Autocontrol',
    'Autocontrol & Scrap': 'Autocontrol',
    'IPPM': 'IPPM',
    'Scrap': 'Scrap',
    'Quality Gate': 'Quality Gate',
    'Fast Audit': 'Fast Audit',
    'Auditoría de Producto': 'Auditoría de Producto',
    'Auditoría de producto': 'Auditoría de Producto',
    'Antena': 'Antena',
    'SCA': 'SCA',
    'CPA/SCA': 'SCA',
    'TDF/TTV': 'TDF/TTV',
    'Garantía': 'Garantía',
  };
  return MAP[r] || null;
}

function findValueInRange(row, start, end) {
  for (let c = start; c <= end && c < row.length; c++) {
    const v = row[c];
    if (v != null && v !== '' && String(v).trim() !== '') return String(v).trim();
  }
  return null;
}

function calcOccurrence(pct) {
  if (pct <= 0) return 1;
  for (let i = OCCURRENCE_TABLE.length - 1; i >= 0; i--) {
    if (pct >= OCCURRENCE_TABLE[i].pct) return OCCURRENCE_TABLE[i].occ;
  }
  return 1;
}

// ═══════════════════════════════════════════════════════════════
// FORMAT DETECTION & PARSING
// ═══════════════════════════════════════════════════════════════

function detectFormat(headers) {
  return headers.length > 100 ? 'ampliado' : 'condensado';
}

function parseAmpliado(rows) {
  const records = [];
  for (let i = 2; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length < 92) continue;
    const detection = findValueInRange(row, 9, 19);
    const seatType = findValueInRange(row, 20, 23);
    const quadDel = findValueInRange(row, 24, 53);
    const quadTras = findValueInRange(row, 54, 86);
    const model = findValueInRange(row, 87, 91);
    const component = findValueInRange(row, 92, 124);
    const defectName = findValueInRange(row, 125, row.length - 1);
    if (!detection || !seatType || !component || !defectName) continue;
    const detPoint = mapDetectionPoint(detection);
    if (!detPoint) continue;
    records.push({
      detection: detPoint, seatType, quadrant: quadDel || quadTras || null,
      model: model || 'N/A', component, defectName,
      concat: `${defectName} en el sector ${quadDel || quadTras || 'N/A'} del modelo ${model || 'N/A'}`,
    });
  }
  return records;
}

function parseCondensado(rows) {
  const headers = rows[0];
  const col11 = String(headers[11] || '').toLowerCase();
  const hasSeq = col11.includes('secuencia') || col11.includes('número');
  const colQD = hasSeq ? 12 : 11, colQT = 13, colM = 14, colC = 15, defStart = 16;
  let startRow = 1;
  if (rows.length > 1) {
    const t = String(rows[1][9] || '').trim().toLowerCase();
    if (t === 'response' || t === '') startRow = 2;
  }
  const records = [];
  for (let i = startRow; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length < colC + 1) continue;
    const detection = row[9], seatType = row[10], model = row[colM], component = row[colC];
    if (!detection || !seatType || !component) continue;
    const defectName = findValueInRange(row, defStart, row.length - 1);
    if (!defectName || defectName.toLowerCase() === 'response') continue;
    const detPoint = mapDetectionPoint(String(detection).trim());
    if (!detPoint) continue;
    const qd = row[colQD], qt = row[colQT];
    let quadrant = null;
    if (qd && String(qd).trim() && String(qd).toLowerCase() !== 'response') quadrant = String(qd).trim();
    else if (qt && String(qt).trim() && String(qt).toLowerCase() !== 'response') quadrant = String(qt).trim();
    const modelStr = (model && String(model).trim()) || 'N/A';
    records.push({
      detection: detPoint, seatType: String(seatType).trim(), quadrant,
      model: modelStr, component: String(component).trim(), defectName,
      concat: `${defectName} en el sector ${quadrant || 'N/A'} del modelo ${modelStr}`,
    });
  }
  return records;
}

// ═══════════════════════════════════════════════════════════════
// DYNAMIC COST CALCULATION
// If detected in internal points (1-7) → costo interno
// If detected in external points (8-11) → costo externo
// If detected in both → MAX(interno, externo)
// ═══════════════════════════════════════════════════════════════

function calcDynamicCost(defectName, detectionPoints) {
  const costoData = COSTO_DB[defectName] || [1, 4];
  const costoInt = costoData[0];
  const costoExt = costoData[1];

  let hasInternal = false, hasExternal = false;
  for (const dp of DETECTION_POINTS) {
    if (detectionPoints[dp.key] > 0) {
      if (dp.scope === 'int') hasInternal = true;
      if (dp.scope === 'ext') hasExternal = true;
    }
  }

  if (hasInternal && hasExternal) return Math.max(costoInt, costoExt);
  if (hasExternal) return costoExt;
  return costoInt; // default to internal
}

// ═══════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════

export async function processExcelFile(file, bancosControlados) {
  const result = await readXlsxFile(file);
  let rows;
  if (Array.isArray(result) && result.length > 0) {
    rows = (result[0] && result[0].data) ? result[0].data : Array.isArray(result[0]) ? result : null;
  }
  if (!rows || rows.length < 3) throw new Error('El archivo no tiene datos suficientes');

  const format = detectFormat(rows[0]);
  const records = format === 'ampliado' ? parseAmpliado(rows) : parseCondensado(rows);
  if (records.length === 0) throw new Error('No se encontraron registros válidos.');

  // Use provided bancosControlados or fall back to record count
  const bancos = bancosControlados || records.length;

  // Group by concat
  const groups = {};
  for (const r of records) {
    if (!groups[r.concat]) {
      groups[r.concat] = {
        concat: r.concat, defectName: r.defectName, model: r.model,
        quadrant: r.quadrant, component: r.component, count: 0, detectionPoints: {},
      };
    }
    groups[r.concat].count++;
    groups[r.concat].detectionPoints[r.detection] = (groups[r.concat].detectionPoints[r.detection] || 0) + 1;
  }

  const qaRows = [];
  for (const g of Object.values(groups)) {
    const dn = g.defectName;
    const sev = SEV_DB[dn] || 3;
    const costo = calcDynamicCost(dn, g.detectionPoints);

    const pct = g.count / bancos;
    const occurrence = calcOccurrence(pct);

    let detectability = 0;
    const dpBreakdown = {};
    for (const dp of DETECTION_POINTS) {
      if (g.detectionPoints[dp.key] > 0) {
        detectability += dp.weight;
        dpBreakdown[dp.key] = dp.weight;
      }
    }
    if (detectability === 0) detectability = 4;

    const index = sev * occurrence * detectability * costo;
    const costoData = COSTO_DB[dn] || [1, 4];

    qaRows.push({
      concat: g.concat, defectName: dn, model: g.model, quadrant: g.quadrant,
      component: g.component, severidad: sev, cantDefectos: g.count,
      ocurrenciaPct: pct, ocurrencia: occurrence, detectabilidad: detectability,
      dpBreakdown, costo, costoInterno: costoData[0], costoExterno: costoData[1],
      index,
    });
  }

  qaRows.sort((a, b) => b.index - a.index);

  const totalDefects = qaRows.reduce((s, r) => s + r.cantDefectos, 0);
  const totalIndex = qaRows.reduce((s, r) => s + r.index, 0);
  
  // Voice classification by cumulative INDEX (not defect count)
  // AA = top 50% of total index, A = next 20%, B = next 20%, C = last 10%
  let cumIndex = 0;
  for (const row of qaRows) {
    cumIndex += row.index;
    const p = cumIndex / totalIndex;
    row.voz = p <= 0.50 ? 'AA' : p <= 0.70 ? 'A' : p <= 0.90 ? 'B' : 'C';
  }
  qaRows.forEach((r, i) => { r.vozNum = i + 1; });

  return {
    qaRows, totalRecords: records.length, totalDefectTypes: qaRows.length,
    bancosControlados: bancos, totalDefects, format,
    summary: {
      AA: qaRows.filter(r => r.voz === 'AA').length, A: qaRows.filter(r => r.voz === 'A').length,
      B: qaRows.filter(r => r.voz === 'B').length, C: qaRows.filter(r => r.voz === 'C').length,
    },
  };
}
