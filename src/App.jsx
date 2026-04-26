import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { processExcelFile } from './engine';
import { DETECTION_POINTS } from './data';
import { saveGiro, savePdca, loadPdcas, isSupabaseConfigured } from './supabase';

const VOZ_COLORS = { AA: '#DC2626', A: '#EA580C', B: '#CA8A04', C: '#16A34A' };
const VozBadge = ({ voz }) => <span style={{ background: VOZ_COLORS[voz], color: '#fff', padding: '2px 10px', borderRadius: 4, fontWeight: 700, fontSize: 13, letterSpacing: 1 }}>{voz}</span>;

export default function App() {
  const [result, setResult] = useState(null);
  const [giroId, setGiroId] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [filter, setFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [selectedRow, setSelectedRow] = useState(null);
  const [bancos, setBancos] = useState('');
  const [giroName, setGiroName] = useState('');
  const [pendingFile, setPendingFile] = useState(null);
  const [pdcaMap, setPdcaMap] = useState({});
  const fileRef = useRef(null);

  const handleFileDrop = useCallback((file) => {
    if (!file) return;
    setPendingFile(file);
    setError(null);
    setResult(null);
  }, []);

  const handleProcess = useCallback(async () => {
    if (!pendingFile) return;
    const bancosNum = parseInt(bancos);
    if (!bancosNum || bancosNum < 1) { setError('Ingresá la cantidad de bancos controlados (debe ser mayor a 0)'); return; }
    setLoading(true); setError(null);
    try {
      const res = await processExcelFile(pendingFile, bancosNum);
      setResult(res);
      const name = giroName || `Giro ${new Date().toLocaleDateString('es-AR')}`;
      try {
        const saved = await saveGiro({ ...res, name, date: new Date().toISOString().split('T')[0] });
        if (saved?.id) { setGiroId(saved.id); const pdcas = await loadPdcas(saved.id); setPdcaMap(pdcas); }
      } catch (e) { console.warn('No se pudo guardar el giro:', e); }
    } catch (err) { setError(err.message || 'Error al procesar'); }
    setLoading(false);
  }, [pendingFile, bancos, giroName]);

  const handlePdcaChange = useCallback(async (vozNum, field, value) => {
    setPdcaMap(prev => {
      const cur = prev[vozNum] || { responsable: '', plan: false, do_step: false, check: false, act: false, comments: '' };
      const updated = { ...cur, [field]: value };
      if (giroId) savePdca(giroId, vozNum, updated).catch(() => {});
      return { ...prev, [vozNum]: updated };
    });
  }, [giroId]);

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
          <h1 style={{ fontSize: 42, fontWeight: 700, color: '#F8FAFC', margin: 0 }}>Matriz QA</h1>
          <p style={{ fontSize: 16, color: '#94A3B8', marginTop: 12 }}>Generador automático de giros · Planta Ferreyra</p>
          {!isSupabaseConfigured() && <p style={{ fontSize: 11, color: '#475569', marginTop: 8 }}>Modo local (Supabase no configurado)</p>}
        </div>

        {!pendingFile ? (
          <div
            onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setDragOver(true); }}
            onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setDragOver(false); }}
            onDrop={(e) => { e.preventDefault(); e.stopPropagation(); setDragOver(false); handleFileDrop(e.dataTransfer?.files?.[0]); }}
            onClick={() => fileRef.current?.click()}
            style={{ width: '100%', maxWidth: 520, border: `2px dashed ${dragOver ? '#F59E0B' : '#475569'}`, borderRadius: 16, padding: '48px 40px', textAlign: 'center', cursor: 'pointer', background: dragOver ? 'rgba(245,158,11,0.06)' : 'rgba(30,41,59,0.6)', transition: 'all 0.3s' }}>
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" onChange={(e) => { handleFileDrop(e.target?.files?.[0]); e.target.value = ''; }} style={{ display: 'none' }} />
            <div style={{ fontSize: 56, marginBottom: 16 }}>📊</div>
            <p style={{ fontSize: 18, fontWeight: 600, color: '#F8FAFC', margin: '0 0 8px' }}>Arrastrá el archivo Excel aquí</p>
            <p style={{ fontSize: 14, color: '#64748B', margin: '0 0 16px' }}>Archivo exportado de SurveyMonkey (.xlsx)</p>
            <div style={{ padding: '8px 24px', background: '#F59E0B', color: '#0F172A', borderRadius: 8, fontWeight: 600, fontSize: 14, display: 'inline-block' }}>Seleccionar archivo</div>
          </div>
        ) : (
          <div style={{ width: '100%', maxWidth: 520, background: 'rgba(30,41,59,0.8)', borderRadius: 16, padding: 32, border: '1px solid #334155' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
              <div style={{ fontSize: 32 }}>📄</div>
              <div>
                <div style={{ fontWeight: 600, color: '#F8FAFC', fontSize: 15 }}>{pendingFile.name}</div>
                <div style={{ color: '#64748B', fontSize: 12 }}>{(pendingFile.size / 1024).toFixed(0)} KB</div>
              </div>
              <button onClick={() => setPendingFile(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#64748B', cursor: 'pointer', fontSize: 18 }}>✕</button>
            </div>

            <label style={{ display: 'block', marginBottom: 16 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 1, display: 'block', marginBottom: 6 }}>Nombre del giro</span>
              <input value={giroName} onChange={e => setGiroName(e.target.value)} placeholder={`Giro ${new Date().toLocaleDateString('es-AR')}`}
                style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #475569', background: '#1E293B', color: '#F8FAFC', fontSize: 14 }} />
            </label>

            <label style={{ display: 'block', marginBottom: 24 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#F59E0B', textTransform: 'uppercase', letterSpacing: 1, display: 'block', marginBottom: 6 }}>Bancos controlados (producidos en el período) *</span>
              <input type="number" min="1" value={bancos} onChange={e => setBancos(e.target.value)} placeholder="Ej: 5000"
                style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #F59E0B', background: '#1E293B', color: '#F8FAFC', fontSize: 16, fontWeight: 700, fontFamily: "'IBM Plex Mono'" }} />
              <span style={{ fontSize: 11, color: '#64748B', marginTop: 4, display: 'block' }}>Este dato es fundamental para calcular la ocurrencia correcta de cada defecto</span>
            </label>

            <button onClick={handleProcess} disabled={loading}
              style={{ width: '100%', padding: '12px', background: loading ? '#475569' : '#F59E0B', color: '#0F172A', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 15, cursor: loading ? 'wait' : 'pointer', transition: 'background 0.2s' }}>
              {loading ? 'Generando Matriz QA...' : 'Generar Matriz QA'}
            </button>
          </div>
        )}

        {error && <div style={{ marginTop: 24, padding: '16px 24px', background: '#7F1D1D', borderRadius: 12, color: '#FCA5A5', fontSize: 14, maxWidth: 520 }}>⚠️ {error}</div>}
      </div>
    );
  }

  // ─── RESULTS ───
  const { summary, totalRecords, totalDefectTypes, bancosControlados, totalDefects } = result;
  const thSt = { padding: '10px 6px', textAlign: 'center', color: '#94A3B8', fontWeight: 600, fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.3, borderBottom: '2px solid #334155', whiteSpace: 'nowrap', position: 'sticky', top: 0, background: '#1E293B', zIndex: 10 };
  const tdSt = { padding: '7px 6px', textAlign: 'center', whiteSpace: 'nowrap', fontSize: 12 };

  return (
    <div style={{ minHeight: '100vh' }}>
      <div style={{ background: 'linear-gradient(135deg, #1E293B, #0F172A)', borderBottom: '1px solid #334155', padding: '16px 24px', position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, maxWidth: 1800, margin: '0 auto' }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 3, color: '#F59E0B', textTransform: 'uppercase' }}>WCM · Pilar Calidad</div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: '#F8FAFC', margin: '2px 0 0' }}>Matriz QA — {giroName || 'Giro Automático'}</h1>
          </div>
          <button onClick={() => { setResult(null); setError(null); setFilter('ALL'); setSearch(''); setPendingFile(null); setBancos(''); setGiroName(''); setPdcaMap({}); setGiroId(null); }}
            style={{ padding: '8px 20px', background: '#334155', color: '#F8FAFC', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>↻ Nuevo Giro</button>
        </div>
      </div>

      <div style={{ padding: '20px 24px', maxWidth: 1800, margin: '0 auto' }}>
        {/* KPIs */}
        <div className="fade-in" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, marginBottom: 20 }}>
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
            <div key={i} style={{ background: '#1E293B', borderRadius: 12, padding: '12px 14px', border: '1px solid #334155' }}>
              <div style={{ fontSize: 11, color: '#94A3B8', fontWeight: 500, marginBottom: 4 }}>{kpi.icon} {kpi.label}</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: kpi.color || '#F8FAFC', fontFamily: "'IBM Plex Mono'" }}>{kpi.value}</div>
            </div>
          ))}
        </div>

        {/* PARETO */}
        <div style={{ background: '#1E293B', borderRadius: 12, padding: 16, marginBottom: 20, border: '1px solid #334155' }}>
          <h3 style={{ fontSize: 13, fontWeight: 600, color: '#F59E0B', margin: '0 0 12px', letterSpacing: 1, textTransform: 'uppercase' }}>Pareto por Componente</h3>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {pareto.slice(0, 10).map(([comp, cnt], i) => {
              const pct = (cnt / totalDefects * 100).toFixed(1);
              return (
                <div key={i} style={{ flex: '1 1 auto', minWidth: 110, background: '#0F172A', borderRadius: 8, padding: '8px 12px', border: '1px solid #334155' }}>
                  <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 3 }}>{comp}</div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                    <span style={{ fontSize: 20, fontWeight: 700, color: '#F8FAFC', fontFamily: "'IBM Plex Mono'" }}>{cnt}</span>
                    <span style={{ fontSize: 11, color: '#64748B' }}>{pct}%</span>
                  </div>
                  <div style={{ height: 3, background: '#334155', borderRadius: 2, marginTop: 4 }}><div style={{ height: '100%', width: `${Math.min(parseFloat(pct), 100)}%`, background: '#F59E0B', borderRadius: 2 }} /></div>
                </div>
              );
            })}
          </div>
        </div>

        {/* FILTERS */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 14, flexWrap: 'wrap' }}>
          {['ALL', 'AA', 'A', 'B', 'C'].map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{
              padding: '6px 14px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
              background: filter === f ? (f === 'ALL' ? '#F59E0B' : VOZ_COLORS[f]) : '#334155',
              color: filter === f ? '#0F172A' : '#94A3B8',
            }}>{f === 'ALL' ? 'Todas' : `Voz ${f}`} ({f === 'ALL' ? totalDefectTypes : summary[f]})</button>
          ))}
          <input placeholder="Buscar defecto..." value={search} onChange={e => setSearch(e.target.value)}
            style={{ marginLeft: 'auto', padding: '7px 14px', borderRadius: 6, border: '1px solid #475569', background: '#1E293B', color: '#F8FAFC', fontSize: 13, width: 220 }} />
        </div>

        {/* TABLE */}
        <div style={{ overflowX: 'auto', borderRadius: 12, border: '1px solid #334155' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1400 }}>
            <thead>
              <tr style={{ background: '#1E293B' }}>
                <th style={thSt}>#</th>
                <th style={thSt}>Voz</th>
                <th style={{ ...thSt, textAlign: 'left', minWidth: 240 }}>Modo de Falla</th>
                <th style={thSt}>S</th>
                <th style={thSt}>Qty</th>
                <th style={thSt}>O</th>
                <th style={thSt}>D</th>
                <th style={thSt}>C</th>
                <th style={{ ...thSt, color: '#F59E0B' }}>Índice</th>
                <th style={{ ...thSt, borderLeft: '2px solid #334155' }}>PDCA</th>
                <th style={thSt}>Resp.</th>
                {DETECTION_POINTS.map(dp => (
                  <th key={dp.key} style={{ ...thSt, color: dp.scope === 'ext' ? '#F59E0B' : '#94A3B8', fontSize: 9 }}>{dp.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row, i) => {
                const isSelected = selectedRow === row.vozNum;
                const pdca = pdcaMap[row.vozNum] || { responsable: '', plan: false, do_step: false, check: false, act: false, comments: '' };
                const pdcaCount = [pdca.plan, pdca.do_step, pdca.check, pdca.act].filter(Boolean).length;

                return [
                  <tr key={row.vozNum} onClick={() => setSelectedRow(isSelected ? null : row.vozNum)}
                    style={{ background: isSelected ? '#1E3A5F' : (i % 2 === 0 ? '#0F172A' : '#131C2E'), cursor: 'pointer', borderBottom: '1px solid #1E293B' }}
                    onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = '#1E293B'; }}
                    onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = i % 2 === 0 ? '#0F172A' : '#131C2E'; }}>
                    <td style={tdSt}>{row.vozNum}</td>
                    <td style={tdSt}><VozBadge voz={row.voz} /></td>
                    <td style={{ ...tdSt, textAlign: 'left', fontWeight: 500, fontSize: 11 }}>{row.concat}</td>
                    <td style={tdSt}>{row.severidad}</td>
                    <td style={{ ...tdSt, fontWeight: 700 }}>{row.cantDefectos}</td>
                    <td style={tdSt}>{row.ocurrencia}</td>
                    <td style={tdSt}>{row.detectabilidad}</td>
                    <td style={tdSt}>{row.costo}</td>
                    <td style={{ ...tdSt, fontWeight: 700, color: '#F59E0B', fontSize: 14, fontFamily: "'IBM Plex Mono'" }}>{row.index}</td>
                    <td style={{ ...tdSt, borderLeft: '2px solid #334155' }} onClick={e => e.stopPropagation()}>
                      <div style={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
                        {['P', 'D', 'C', 'A'].map((letter, li) => {
                          const field = ['plan', 'do_step', 'check', 'act'][li];
                          const checked = pdca[field];
                          return (
                            <button key={letter} onClick={() => handlePdcaChange(row.vozNum, field, !checked)}
                              style={{ width: 22, height: 22, borderRadius: 4, border: 'none', fontSize: 10, fontWeight: 700, cursor: 'pointer',
                                background: checked ? '#16A34A' : '#334155', color: checked ? '#fff' : '#64748B' }}>{letter}</button>
                          );
                        })}
                      </div>
                    </td>
                    <td style={{ ...tdSt, fontSize: 10, maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis', color: pdca.responsable ? '#F8FAFC' : '#475569' }}>
                      {pdca.responsable || '—'}
                    </td>
                    {DETECTION_POINTS.map(dp => {
                      const val = row.dpBreakdown[dp.key];
                      return <td key={dp.key} style={{ ...tdSt, color: val ? (dp.scope === 'ext' ? '#F59E0B' : '#38BDF8') : '#1E293B', fontSize: 11 }}>{val || '·'}</td>;
                    })}
                  </tr>,
                  isSelected && (
                    <tr key={`d-${row.vozNum}`}>
                      <td colSpan={11 + DETECTION_POINTS.length} style={{ padding: '14px 16px', background: '#1E293B', borderBottom: '2px solid #F59E0B' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                          <div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 8, marginBottom: 12 }}>
                              <Detail label="Componente" value={row.component} />
                              <Detail label="Ocurrencia %" value={`${(row.ocurrenciaPct * 100).toFixed(4)}%`} mono />
                              <Detail label="Costo Int." value={row.costoInterno} mono />
                              <Detail label="Costo Ext." value={row.costoExterno} mono />
                              <Detail label="Costo Usado" value={row.costo} mono highlight />
                              <Detail label="Fórmula" value={`${row.severidad}×${row.ocurrencia}×${row.detectabilidad}×${row.costo}=${row.index}`} mono highlight />
                            </div>
                          </div>
                          <div>
                            <div style={{ marginBottom: 8 }}>
                              <span style={{ fontSize: 10, color: '#64748B', textTransform: 'uppercase', letterSpacing: 1 }}>Responsable</span>
                              <input value={pdca.responsable} onChange={e => handlePdcaChange(row.vozNum, 'responsable', e.target.value)} placeholder="Asignar responsable..."
                                onClick={e => e.stopPropagation()}
                                style={{ width: '100%', padding: '6px 10px', borderRadius: 6, border: '1px solid #475569', background: '#0F172A', color: '#F8FAFC', fontSize: 13, marginTop: 4 }} />
                            </div>
                            <div>
                              <span style={{ fontSize: 10, color: '#64748B', textTransform: 'uppercase', letterSpacing: 1 }}>Comentarios</span>
                              <textarea value={pdca.comments} onChange={e => handlePdcaChange(row.vozNum, 'comments', e.target.value)} placeholder="Notas, acciones, observaciones..."
                                onClick={e => e.stopPropagation()} rows={2}
                                style={{ width: '100%', padding: '6px 10px', borderRadius: 6, border: '1px solid #475569', background: '#0F172A', color: '#F8FAFC', fontSize: 12, marginTop: 4, resize: 'vertical', fontFamily: 'inherit' }} />
                            </div>
                            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                              {[['plan','Plan'],['do_step','Do'],['check','Check'],['act','Act']].map(([field, label]) => (
                                <label key={field} style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', fontSize: 12 }} onClick={e => e.stopPropagation()}>
                                  <input type="checkbox" checked={pdca[field]} onChange={e => handlePdcaChange(row.vozNum, field, e.target.checked)}
                                    style={{ accentColor: '#16A34A' }} />
                                  <span style={{ color: pdca[field] ? '#16A34A' : '#94A3B8', fontWeight: 600 }}>{label}</span>
                                </label>
                              ))}
                            </div>
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

        <div style={{ textAlign: 'center', padding: '20px 0 40px', color: '#475569', fontSize: 12 }}>
          {filteredRows.length} de {totalDefectTypes} voces · Bancos controlados: {bancosControlados.toLocaleString()} · WCM Pilar Calidad
        </div>
      </div>
    </div>
  );
}

function Detail({ label, value, mono, highlight }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: '#64748B', textTransform: 'uppercase', letterSpacing: 1 }}>{label}</div>
      <div style={{ fontWeight: 600, color: highlight ? '#F59E0B' : '#F8FAFC', fontFamily: mono ? "'IBM Plex Mono',monospace" : 'inherit', fontSize: mono ? 12 : 13 }}>{value}</div>
    </div>
  );
}
