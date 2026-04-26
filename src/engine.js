import * as XLSX from 'xlsx';
import { COSTO_DB, SEV_DB, CLASIF_DB, DETECTION_POINTS, OCCURRENCE_TABLE } from './data';

function mapDetectionPoint(raw) {
  const r = (raw || '').trim();
  for (const dp of DETECTION_POINTS) {
    if (dp.key === r) return dp.key;
    if (dp.aliases && dp.aliases.includes(r)) return dp.key;
  }
  return null;
}

function getDefectName(row) {
  for (let c = 16; c <= 29; c++) {
    const v = row[c];
    if (v && typeof v === 'string' && v.trim()) return v.trim();
  }
  return null;
}

function getQuadrant(row) {
  const del = row[12];
  const tras = row[13];
  if (del && typeof del === 'string' && del.trim()) return del.trim();
  if (tras && typeof tras === 'string' && tras.trim()) return tras.trim();
  return null;
}

function calcOccurrence(pct) {
  if (pct <= 0) return 1;
  for (let i = OCCURRENCE_TABLE.length - 1; i >= 0; i--) {
    if (pct >= OCCURRENCE_TABLE[i].pct) return OCCURRENCE_TABLE[i].occ;
  }
  return 1;
}

export function processExcelData(arrayBuffer) {
  const wb = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array' });
  const sheetName = wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });

  if (data.length < 2) throw new Error('El archivo no tiene datos suficientes');

  const records = [];
  let bancosControlados = 0;

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row || row.length < 16) continue;
    const detection = row[9];
    const seatType = row[10];
    const model = row[14];
    const component = row[15];
    const defectName = getDefectName(row);
    const quadrant = getQuadrant(row);

    if (!detection || !seatType || !component || !defectName) continue;
    const detPoint = mapDetectionPoint(detection);
    if (!detPoint) continue;

    const concat = `${defectName} en el sector ${quadrant || 'N/A'} del modelo ${model || 'N/A'}`;
    records.push({ detection: detPoint, seatType, quadrant, model: model || 'N/A', component, defectName, concat });
    bancosControlados++;
  }

  if (records.length === 0) throw new Error('No se encontraron registros válidos. Verificá que el archivo sea el export de SurveyMonkey.');

  // Group by concat
  const groups = {};
  for (const r of records) {
    if (!groups[r.concat]) {
      groups[r.concat] = { concat: r.concat, defectName: r.defectName, model: r.model, quadrant: r.quadrant, component: r.component, count: 0, detectionPoints: {} };
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
    const clasifArr = CLASIF_DB[dn] || [0,0,0,0,0,0,0,0,0,0];

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
      concat: g.concat, defectName: dn, model: g.model, quadrant: g.quadrant, component: g.component,
      severidad: sev, cantDefectos: g.count, ocurrenciaPct: pct, ocurrencia: occurrence,
      detectabilidad: detectability, dpBreakdown, costo: costoInterno, criterio, index, clasificacion: clasifArr,
    });
  }

  qaRows.sort((a, b) => b.index - a.index);

  // Voice classification
  const totalDefects = qaRows.reduce((s, r) => s + r.cantDefectos, 0);
  let cumDefects = 0;
  for (const row of qaRows) {
    cumDefects += row.cantDefectos;
    const p = cumDefects / totalDefects;
    row.voz = p <= 0.50 ? 'AA' : p <= 0.70 ? 'A' : p <= 0.90 ? 'B' : 'C';
  }
  qaRows.forEach((r, i) => r.vozNum = i + 1);

  return {
    qaRows, totalRecords: records.length, totalDefectTypes: qaRows.length, bancosControlados, totalDefects,
    summary: { AA: qaRows.filter(r => r.voz === 'AA').length, A: qaRows.filter(r => r.voz === 'A').length, B: qaRows.filter(r => r.voz === 'B').length, C: qaRows.filter(r => r.voz === 'C').length },
  };
}
