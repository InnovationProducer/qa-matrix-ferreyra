import { createClient } from '@supabase/supabase-js';

const URL = import.meta.env.VITE_SUPABASE_URL;
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(URL, KEY);

// ── Defectos ──
export async function fetchDefectos() {
  const { data, error } = await supabase.from('defectos').select('*').order('nombre');
  if (error) throw error;
  return data;
}

export async function upsertDefecto(defecto) {
  const { data, error } = await supabase.from('defectos')
    .upsert({ nombre: defecto.nombre, severidad: defecto.severidad, costo_interno: defecto.costo_interno, costo_externo: defecto.costo_externo, updated_at: new Date().toISOString() }, { onConflict: 'nombre' })
    .select().single();
  if (error) throw error;
  return data;
}

export async function deleteDefecto(id) {
  const { error } = await supabase.from('defectos').delete().eq('id', id);
  if (error) throw error;
}

export async function bulkUpsertDefectos(defectos) {
  const { data, error } = await supabase.from('defectos')
    .upsert(defectos.map(d => ({ nombre: d.nombre, severidad: d.severidad, costo_interno: d.costo_interno, costo_externo: d.costo_externo, updated_at: new Date().toISOString() })), { onConflict: 'nombre' })
    .select();
  if (error) throw error;
  return data;
}

// ── Giros ──
export async function saveGiro(giroData) {
  const { data, error } = await supabase.from('giros')
    .insert({ name: giroData.name, date: giroData.date, bancos_controlados: giroData.bancosControlados, total_records: giroData.totalRecords, total_defects: giroData.totalDefects, total_defect_types: giroData.totalDefectTypes, summary: giroData.summary, qa_rows: giroData.qaRows, format: giroData.format })
    .select().single();
  if (error) throw error;
  return data;
}

export async function fetchGiros() {
  const { data, error } = await supabase.from('giros').select('id, name, date, bancos_controlados, total_defects, total_defect_types, summary').order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function fetchGiro(id) {
  const { data, error } = await supabase.from('giros').select('*').eq('id', id).single();
  if (error) throw error;
  return data;
}

export async function updateGiroRows(giroId, qaRows, summary) {
  const { error } = await supabase.from('giros').update({ qa_rows: qaRows, summary, total_defect_types: qaRows.length }).eq('id', giroId);
  if (error) throw error;
}

// ── PDCA ──
export async function savePdca(giroId, vozNum, pdcaData) {
  const { data, error } = await supabase.from('pdca')
    .upsert({ giro_id: giroId, voz_num: vozNum, responsable: pdcaData.responsable, plan: pdcaData.plan, do_step: pdcaData.do_step, check: pdcaData.check, act: pdcaData.act, comments: pdcaData.comments, updated_at: new Date().toISOString() }, { onConflict: 'giro_id,voz_num' })
    .select().single();
  if (error) throw error;
  return data;
}

export async function fetchPdcas(giroId) {
  const { data, error } = await supabase.from('pdca').select('*').eq('giro_id', giroId);
  if (error) throw error;
  const map = {};
  for (const p of data) map[p.voz_num] = p;
  return map;
}

// ── Unificaciones ──
export async function saveUnificacion(giroId, vozDestino, vozOrigen) {
  const { error } = await supabase.from('unificaciones').upsert({ giro_id: giroId, voz_destino: vozDestino, voz_origen: vozOrigen }, { onConflict: 'giro_id,voz_origen' });
  if (error) throw error;
}

// ── Delete Giro ──
export async function deleteGiro(id) {
  const { error } = await supabase.from('giros').delete().eq('id', id);
  if (error) throw error;
}

// ── Auth ──
export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getSession() {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export function onAuthChange(callback) {
  return supabase.auth.onAuthStateChange((_event, session) => callback(session));
}
