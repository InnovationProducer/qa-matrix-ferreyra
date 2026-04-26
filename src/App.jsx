import { useState, useMemo, useCallback, useRef } from 'react';
import { processExcelData } from './engine';
import { DETECTION_POINTS, CLASIF_LABELS } from './data';

const VOZ_COLORS = { AA: '#DC2626', A: '#EA580C', B: '#CA8A04', C: '#16A34A' };

function VozBadge({ voz }) {
  return <span style={{ background: VOZ_COLORS[voz], color: '#fff', padding: '2px 10px', borderRadius: 4, fontWeight: 700, fontSize: 13, letterSpacing: 1 }}>{voz}</span>;
}

export default function App() {
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [filter, setFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [selectedRow, setSelectedRow] = useState(null);
  const fileRef = useRef(null);

  const handleFile = useCallback((file) => {
    if (!file) return;
    setLoading(true); setError(null); setResult(null); setSelectedRow(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      try { setResult(processExcelData(e.target.result)); }
      catch (err) { setError(err.message); }
      setLoading(false);
    };
    reader.readAsArrayBuffer(file);
  }, []);

  const filteredRows = useMemo(() => {
    if (!result) return [];
    let rows = result.qaRows;
    if (filter !== 'ALL') rows = rows.filter(r => r.voz === filter);
    if (search) { const s = search.toLowerCase(); rows = rows.filter(r => r.concat.toLowerCase().includes(s) || r.component.toLowerCase().includes(s)); }
    return rows;
  }, [result, filter, search]);

  const pareto = useMemo(() => {
    if (!result) return [];
    const byComp = {};
    for (const r of result.qaRows) byComp[r.component] = (byComp[r.component] || 0) + r.cantDefectos;
    return Object.entries(byComp).sort((a, b) => b[1] - a[1]);
  }, [result]);

  // ─── UPLOAD SCREEN ───
  if (!result) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(165deg, #0F172A 0%, #1E293B 50%, #0F172A 100%)', padding: 24 }}>
        <div style={{ textAlign: 'center', marginBottom: 40 }} className="fade-in">
          <div style={{ fontSize: 14, fontWeight: 600, letterSpacing: 4, color: '#F59E0B', textTransform: 'uppercase', marginBottom: 8 }}>World Class Manufacturing</div>
          <h1 style={{ fontSize: 42, fontWeight: 700, color: '#F8FAFC', margin: 0, lineHeight: 1.1 }}>Matriz QA</h1>
          <p style={{ fontSize: 16, color: '#94A3B8', marginTop: 12, maxWidth: 420, margin: '12px auto 0' }}>Generador automático de giros · Planta Ferreyra</p>
        </div>

        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files[0]); }}
          onClick={() => fileRef.current?.click()}
          className="fade-in-d1"
          style={{
            width: '100%', maxWidth: 520,
            border: `2px dashed ${dragOver ? '#F59E0B' : '#475569'}`,
            borderRadius: 16, padding: '56px 40px', textAlign: 'center', cursor: 'pointer',
            transition: 'all 0.3s',
            background: dragOver ? 'rgba(245,158,11,0.06)' : 'rgba(30,41,59,0.6)',
          }}
        >
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" onChange={(e) => handleFile(e.target.files[0])} style={{ display: 'none' }} />
          <div style={{ fontSize: 56, marginBottom: 16 }}>📊</div>
          <p style={{ fontSize: 18, fontWeight: 600, color: '#F8FAFC', margin: '0 0 8px' }}>
            {loading ? 'Procesando datos...' : 'Arrastrá el archivo Excel aquí'}
          </p>
          <p style={{ fontSize: 14, color: '#64748B', margin: 0 }}>
            {loading ? 'Generando Matriz QA automáticamente' : 'Archivo exportado de SurveyMonkey (.xlsx)'}
          </p>
          {loading && <div style={{ marginTop: 24 }}><div style={{ width: 200, height: 4, background: '#1E293B', borderRadius: 2, margin: '0 auto', overflow: 'hidden' }}><div style={{ width: '60%', height: '100%', background: '#F59E0B', borderRadius: 2, animation: 'pulse 1.5s infinite' }} /></div></div>}
        </div>

        {error && <div className="fade-in-d2" style={{ marginTop: 24, padding: '16px 24px', background: '#7F1D1D', borderRadius: 12, color: '#FCA5A5', fontSize: 14, maxWidth: 520 }}>⚠️ {error}</div>}
      </div>
    );
  }

  // ─── RESULTS ───
  const { summary, totalRecords, totalDefectTypes, bancosControlados, totalDefects } = result;
  const thSt = { padding: '10px 8px', textAlign: 'center', color: '#94A3B8', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: '2px solid #334155', whiteSpace: 'nowrap', position: 'sticky', top: 0, background: '#1E293B', zIndex: 10 };
  const tdSt = { padding: '8px', textAlign: 'center', whiteSpace: 'nowrap' };

  return (
    <div style={{ minHeight: '100vh' }}>
      {/* HEADER */}
      <div style={{ background: 'linear-gradient(135deg, #1E293B, #0F172A)', borderBottom: '1px solid #334155', padding: '16px 24px', position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, maxWidth: 1600, margin: '0 auto' }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 3, color: '#F59E0B', textTransform: 'uppercase' }}>WCM · Pilar Calidad</div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: '#F8FAFC', margin: '2px 0 0' }}>Matriz QA — Giro Automático</h1>
          </div>
          <button onClick={() => { setResult(null); setError(null); setFilter('ALL'); setSearch(''); }} style={{ padding: '8px 20px', background: '#334155', color: '#F8FAFC', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600, transition: 'background 0.2s' }} onMouseEnter={e => e.target.style.background='#475569'} onMouseLeave={e => e.target.style.background='#334155'}>
            ↻ Nuevo Giro
          </button>
        </div>
      </div>

      <div style={{ padding: '20px 24px', maxWidth: 1600, margin: '0 auto' }}>
        {/* KPI CARDS */}
        <div className="fade-in" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 24 }}>
          {[
            { label: 'Registros', value: totalRecords, icon: '📋' },
            { label: 'Bancos Ctrl.', value: bancosControlados.toLocaleString(), icon: '🏭' },
            { label: 'Total Defectos', value: totalDefects, icon: '🔍' },
            { label: 'Tipos Defecto', value: totalDefectTypes, icon: '📊' },
            { label: 'Voces AA', value: summary.AA, color: VOZ_COLORS.AA, icon: '🔴' },
            { label: 'Voces A', value: summary.A, color: VOZ_COLORS.A, icon: '🟠' },
            { label: 'Voces B', value: summary.B, color: VOZ_COLORS.B, icon: '🟡' },
            { label: 'Voces C', value: summary.C, color: VOZ_COLORS.C, icon: '🟢' },
          ].map((kpi, i) => (
            <div key={i} style={{ background: '#1E293B', borderRadius: 12, padding: '14px 16px', border: '1px solid #334155' }}>
              <div style={{ fontSize: 11, color: '#94A3B8', fontWeight: 500, marginBottom: 4 }}>{kpi.icon} {kpi.label}</div>
              <div style={{ fontSize: 26, fontWeight: 700, color: kpi.color || '#F8FAFC', fontFamily: "'IBM Plex Mono', monospace" }}>{kpi.value}</div>
            </div>
          ))}
        </div>

        {/* PARETO */}
        <div className="fade-in-d1" style={{ background: '#1E293B', borderRadius: 12, padding: 20, marginBottom: 24, border: '1px solid #334155' }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: '#F59E0B', margin: '0 0 14px', letterSpacing: 1, textTransform: 'uppercase' }}>Pareto por Componente</h3>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {pareto.slice(0, 10).map(([comp, cnt], i) => {
              const pct = (cnt / totalDefects * 100).toFixed(1);
              return (
                <div key={i} style={{ flex: '1 1 auto', minWidth: 120, background: '#0F172A', borderRadius: 8, padding: '10px 14px', border: '1px solid #334155' }}>
                  <div style={{ fontSize: 12, color: '#94A3B8', marginBottom: 4 }}>{comp}</div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                    <span style={{ fontSize: 22, fontWeight: 700, color: '#F8FAFC', fontFamily: "'IBM Plex Mono'" }}>{cnt}</span>
                    <span style={{ fontSize: 12, color: '#64748B' }}>{pct}%</span>
                  </div>
                  <div style={{ height: 3, background: '#334155', borderRadius: 2, marginTop: 6 }}>
                    <div style={{ height: '100%', width: `${Math.min(parseFloat(pct), 100)}%`, background: '#F59E0B', borderRadius: 2, transition: 'width 0.6s' }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* FILTERS */}
        <div className="fade-in-d2" style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
          {['ALL', 'AA', 'A', 'B', 'C'].map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{
              padding: '6px 16px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
              background: filter === f ? (f === 'ALL' ? '#F59E0B' : VOZ_COLORS[f]) : '#334155',
              color: filter === f ? '#0F172A' : '#94A3B8', transition: 'all 0.2s',
            }}>
              {f === 'ALL' ? 'Todas' : `Voz ${f}`} ({f === 'ALL' ? totalDefectTypes : summary[f]})
            </button>
          ))}
          <input placeholder="Buscar defecto..." value={search} onChange={(e) => setSearch(e.target.value)}
            style={{ marginLeft: 'auto', padding: '7px 14px', borderRadius: 6, border: '1px solid #475569', background: '#1E293B', color: '#F8FAFC', fontSize: 13, width: 240 }} />
        </div>

        {/* TABLE */}
        <div className="fade-in-d3" style={{ overflowX: 'auto', borderRadius: 12, border: '1px solid #334155' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 1200 }}>
            <thead>
              <tr style={{ background: '#1E293B' }}>
                <th style={thSt}>#</th>
                <th style={thSt}>Voz</th>
                <th style={{ ...thSt, textAlign: 'left', minWidth: 280 }}>Modo de Falla + Cuadrante + Modelo</th>
                <th style={thSt}>S</th>
                <th style={thSt}>Qty</th>
                <th style={thSt}>O</th>
                <th style={thSt}>D</th>
                <th style={thSt}>C</th>
                <th style={{ ...thSt, color: '#F59E0B' }}>Índice</th>
                {DETECTION_POINTS.map(dp => <th key={dp.key} style={thSt}>{dp.label}</th>)}
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row, i) => {
                const isSelected = selectedRow === row.vozNum;
                return [
                  <tr key={row.vozNum} onClick={() => setSelectedRow(isSelected ? null : row.vozNum)}
                    style={{ background: isSelected ? '#1E3A5F' : (i % 2 === 0 ? '#0F172A' : '#131C2E'), cursor: 'pointer', borderBottom: '1px solid #1E293B', transition: 'background 0.15s' }}
                    onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = '#1E293B'; }}
                    onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = i % 2 === 0 ? '#0F172A' : '#131C2E'; }}>
                    <td style={tdSt}>{row.vozNum}</td>
                    <td style={tdSt}><VozBadge voz={row.voz} /></td>
                    <td style={{ ...tdSt, textAlign: 'left', fontWeight: 500 }}>{row.concat}</td>
                    <td style={tdSt}>{row.severidad}</td>
                    <td style={{ ...tdSt, fontWeight: 700 }}>{row.cantDefectos}</td>
                    <td style={tdSt}>{row.ocurrencia}</td>
                    <td style={tdSt}>{row.detectabilidad}</td>
                    <td style={tdSt}>{row.costo}</td>
                    <td style={{ ...tdSt, fontWeight: 700, color: '#F59E0B', fontSize: 14, fontFamily: "'IBM Plex Mono'" }}>{row.index}</td>
                    {DETECTION_POINTS.map(dp => {
                      const val = row.dpBreakdown[dp.key];
                      return <td key={dp.key} style={{ ...tdSt, color: val ? '#F59E0B' : '#334155' }}>{val || '·'}</td>;
                    })}
                  </tr>,
                  isSelected && (
                    <tr key={`d-${row.vozNum}`}>
                      <td colSpan={19} style={{ padding: '12px 16px', background: '#1E293B', borderBottom: '2px solid #F59E0B' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8 }}>
                          <Detail label="Componente" value={row.component} />
                          <Detail label="Criterio" value={row.criterio || '—'} />
                          <Detail label="Ocurrencia %" value={`${(row.ocurrenciaPct * 100).toFixed(4)}%`} mono />
                          <Detail label="Fórmula" value={`${row.severidad}×${row.ocurrencia}×${row.detectabilidad}×${row.costo}=${row.index}`} mono highlight />
                        </div>
                        <div style={{ marginTop: 12 }}>
                          <div style={{ fontSize: 10, color: '#64748B', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Origen 4M + 1D</div>
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            {CLASIF_LABELS.map((label, ci) => (
                              <span key={ci} style={{ padding: '3px 10px', borderRadius: 4, fontSize: 11, fontWeight: 500, background: row.clasificacion[ci] ? '#F59E0B' : '#334155', color: row.clasificacion[ci] ? '#0F172A' : '#64748B' }}>{label}</span>
                            ))}
                          </div>
                        </div>
                      </td>
                    </tr>
                  ),
                ];
              })}
            </tbody>
          </table>
        </div>

        <div style={{ textAlign: 'center', padding: '24px 0 40px', color: '#475569', fontSize: 12 }}>
          Mostrando {filteredRows.length} de {totalDefectTypes} voces · WCM Pilar Calidad · Planta Ferreyra
        </div>
      </div>
    </div>
  );
}

function Detail({ label, value, mono, highlight }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: '#64748B', textTransform: 'uppercase', letterSpacing: 1 }}>{label}</div>
      <div style={{ fontWeight: 600, color: highlight ? '#F59E0B' : '#F8FAFC', fontFamily: mono ? "'IBM Plex Mono',monospace" : 'inherit', fontSize: mono ? 11 : 13 }}>{value}</div>
    </div>
  );
}
