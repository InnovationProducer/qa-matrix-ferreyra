import { createClient } from '@supabase/supabase-js';

// Configure these in Netlify environment variables or .env.local
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const supabase = (SUPABASE_URL && SUPABASE_ANON_KEY)
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

export const isSupabaseConfigured = () => !!supabase;

// ═══════════════════════════════════════════════════════════════
// GIRO CRUD
// ═══════════════════════════════════════════════════════════════

export async function saveGiro(giroData) {
  if (!supabase) return localSaveGiro(giroData);
  const { data, error } = await supabase
    .from('giros')
    .insert({
      name: giroData.name,
      date: giroData.date,
      bancos_controlados: giroData.bancosControlados,
      total_records: giroData.totalRecords,
      total_defects: giroData.totalDefects,
      total_defect_types: giroData.totalDefectTypes,
      summary: giroData.summary,
      qa_rows: giroData.qaRows,
      format: giroData.format,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function loadGiros() {
  if (!supabase) return localLoadGiros();
  const { data, error } = await supabase
    .from('giros')
    .select('id, name, date, bancos_controlados, total_records, total_defects, total_defect_types, summary')
    .order('date', { ascending: false });
  if (error) throw error;
  return data;
}

export async function loadGiro(id) {
  if (!supabase) return localLoadGiro(id);
  const { data, error } = await supabase.from('giros').select('*').eq('id', id).single();
  if (error) throw error;
  return data;
}

// ═══════════════════════════════════════════════════════════════
// PDCA CRUD
// ═══════════════════════════════════════════════════════════════

export async function savePdca(giroId, vozNum, pdcaData) {
  if (!supabase) return localSavePdca(giroId, vozNum, pdcaData);
  const { data, error } = await supabase
    .from('pdca')
    .upsert({
      giro_id: giroId,
      voz_num: vozNum,
      responsable: pdcaData.responsable,
      plan: pdcaData.plan,
      do_step: pdcaData.do_step,
      check: pdcaData.check,
      act: pdcaData.act,
      comments: pdcaData.comments,
    }, { onConflict: 'giro_id,voz_num' })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function loadPdcas(giroId) {
  if (!supabase) return localLoadPdcas(giroId);
  const { data, error } = await supabase.from('pdca').select('*').eq('giro_id', giroId);
  if (error) throw error;
  const map = {};
  for (const p of data) map[p.voz_num] = p;
  return map;
}

// ═══════════════════════════════════════════════════════════════
// LOCAL STORAGE FALLBACK (when Supabase is not configured)
// ═══════════════════════════════════════════════════════════════

function localSaveGiro(giroData) {
  const giros = JSON.parse(localStorage.getItem('qa_giros') || '[]');
  const id = Date.now().toString();
  const entry = { id, ...giroData, created_at: new Date().toISOString() };
  giros.unshift(entry);
  localStorage.setItem('qa_giros', JSON.stringify(giros));
  return entry;
}

function localLoadGiros() {
  return JSON.parse(localStorage.getItem('qa_giros') || '[]').map(g => ({
    id: g.id, name: g.name, date: g.date,
    bancos_controlados: g.bancosControlados,
    total_records: g.totalRecords, total_defects: g.totalDefects,
    total_defect_types: g.totalDefectTypes, summary: g.summary,
  }));
}

function localLoadGiro(id) {
  const giros = JSON.parse(localStorage.getItem('qa_giros') || '[]');
  return giros.find(g => g.id === id) || null;
}

function localSavePdca(giroId, vozNum, pdcaData) {
  const key = `qa_pdca_${giroId}`;
  const map = JSON.parse(localStorage.getItem(key) || '{}');
  map[vozNum] = { ...pdcaData, giro_id: giroId, voz_num: vozNum };
  localStorage.setItem(key, JSON.stringify(map));
  return map[vozNum];
}

function localLoadPdcas(giroId) {
  return JSON.parse(localStorage.getItem(`qa_pdca_${giroId}`) || '{}');
}
