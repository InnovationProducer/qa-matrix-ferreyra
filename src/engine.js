import readXlsxFile from 'read-excel-file/browser';
import { COSTO_DB, SEV_DB, CLASIF_DB, DETECTION_POINTS, OCCURRENCE_TABLE } from './data';

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════

function mapDetectionPoint(raw) {
  const r = (raw || '').toString().trim();
  if (r === 'Autocontrol & Scrap' || r === 'Autocontrol' || r === 'Scrap') return 'Autocontrol';
  if (r === 'Fast Audit' || r === 'Auditoría de Producto') return 'Auditoría de Producto';
  if (r === 'Quality Gate') return null;
  if (r === 'SCA') return 'CPA/SCA';
  for (const dp of DETECTION_POINTS) {
    if (dp.key === r) return dp.key;
    if (dp.aliases && dp.aliases.includes(r)) return dp.key;
  }
  return null;
}

function findValueInRange(row, start, end) {
  for (let c = start; c <= end && c < row.length; c++) {
    const v = row[c];
    if (v != null && v !== '' && String(v).trim() !== '') {
      return String(v).trim();
    }
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
  const totalCols = headers.length;
  if (totalCols > 100) return 'ampliado';
  return 'condensado';
}

function parseAmpliado(rows) {
  // Ampliado: 411 cols. Each SurveyMonkey question is expanded into N columns (one per option).
  // Only the selected option has a value in that row.
  // Col 9-19: Detection point | Col 20-23: Seat type | Col 24-53: Quad delantero
  // Col 54-86: Quad trasero | Col 87-91: Model | Col 92-124: Component | Col 125+: Defects
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

    const quadrant = quadDel || quadTras || null;
    const modelStr = model || 'N/A';
    const concat = `${defectName} en el sector ${quadrant || 'N/A'} del modelo ${modelStr}`;

    records.push({ detection: detPoint, seatType, quadrant, model: modelStr, component, defectName, concat });
  }
  return records;
}

function parseCondensado(rows) {
  const headers = rows[0];
  const col11Header = String(headers[11] || '').toLowerCase();
  const hasSequence = col11Header.includes('secuencia') || col11Header.includes('número');

  const colQuadDel = hasSequence ? 12 : 11;
  const colQuadTras = 13;
  const colModel = 14;
  const colComponent = 15;
  const defectStart = 16;

  let startRow = 1;
  if (rows.length > 1) {
    const testVal = String(rows[1][9] || '').trim().toLowerCase();
    if (testVal === 'response' || testVal === '') startRow = 2;
  }

  const records = [];
  for (let i = startRow; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length < colComponent + 1) continue;

    const detection = row[9];
    const seatType = row[10];
    const model = row[colModel];
    const component = row[colComponent];
    if (!detection || !seatType || !component) continue;

    const defectName = findValueInRange(row, defectStart, row.length - 1);
    if (!defectName || defectName.toLowerCase() === 'response') continue;

    const detPoint = mapDetectionPoint(String(detection).trim());
    if (!detPoint) continue;

    const qd = row[colQuadDel];
    const qt = row[colQuadTras];
    let quadrant = null;
    if (qd && String(qd).trim() && String(qd).toLowerCase() !== 'response') quadrant = String(qd).trim();
    else if (qt && String(qt).trim() && String(qt).toLowerCase() !== 'response') quadrant = String(qt).trim();

    const modelStr = (model && String(model).trim()) || 'N/A';
    const concat = `${defectName} en el sector ${quadrant || 'N/A'} del modelo ${modelStr}`;

    records.push({ detection: detPoint, seatType: String(seatType).trim(), quadrant, model: modelStr, component: String(component).trim(), defectName, concat });
  }
  return records;
}

// ═══════════════════════════════════════════════════════════════
// MAIN ENTRY POINT
// ═══════════════════════════════════════════════════════════════

export async function processExcelFile(file) {
  // read-excel-file reads the File object directly (handles ZIP64)
  const rows = await readXlsxFile(file);

  if (rows.length < 3) throw new Error('El archivo no tiene datos suficientes');

  const format = detectFormat(rows[0]);
  const records = format === 'ampliado' ? parseAmpliado(rows) : parseCondensado(rows);

  if (records.length === 0) {
    throw new Error('No se encontraron registros válidos. Verificá que el archivo sea el export de SurveyMonkey.');
  }

  const bancosControlados = records.length;

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

  // Build QA rows
  const qaRows = [];
  for (const g of Object.values(groups)) {
    const dn = g.defectName;
    const sev = SEV_DB[dn] ? SEV_DB[dn][1] : 3;
    const costoData = COSTO_DB[dn] || [1, 4, ''];
    const costoInterno = costoData[0];
    const criterio = costoData[2];
    const clasifArr = CLASIF_DB[dn] || [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

    const pct = g.count / bancosControlados;
    const occurrence = calcOccurrence(pct);

    let detectability = 0;
    const dpBreakdown = {};
    for (const dp of DETECTION_POINTS) {
      const cnt = g.detectionPoints[dp.key] || 0;
      if (cnt > 0) { detectability += dp.weight; dpBreakdown[dp.key] = dp.weight; }
    }
    if (detectability === 0) detectability = 4;

    const index = sev * occurrence * detectability * costoInterno;

    qaRows.push({
      concat: g.concat, defectName: dn, model: g.model, quadrant: g.quadrant,
      component: g.component, severidad: sev, cantDefectos: g.count,
      ocurrenciaPct: pct, ocurrencia: occurrence, detectabilidad: detectability,
      dpBreakdown, costo: costoInterno, criterio, index, clasificacion: clasifArr,
    });
  }

  qaRows.sort((a, b) => b.index - a.index);

  const totalDefects = qaRows.reduce((s, r) => s + r.cantDefectos, 0);
  let cumDefects = 0;
  for (const row of qaRows) {
    cumDefects += row.cantDefectos;
    const p = cumDefects / totalDefects;
    row.voz = p <= 0.50 ? 'AA' : p <= 0.70 ? 'A' : p <= 0.90 ? 'B' : 'C';
  }
  qaRows.forEach((r, i) => { r.vozNum = i + 1; });

  return {
    qaRows, totalRecords: records.length, totalDefectTypes: qaRows.length,
    bancosControlados, totalDefects, format,
    summary: {
      AA: qaRows.filter(r => r.voz === 'AA').length, A: qaRows.filter(r => r.voz === 'A').length,
      B: qaRows.filter(r => r.voz === 'B').length, C: qaRows.filter(r => r.voz === 'C').length,
    },
  };
}
