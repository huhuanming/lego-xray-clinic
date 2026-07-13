import http from 'node:http';
import { createReadStream, existsSync, readFileSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { db, patientFromRow, photosDir, transaction } from './db.mjs';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const distDir = path.join(rootDir, 'dist');
const port = Number(process.env.PORT || 8787);

const patientSelect = `
  SELECT p.*,
    (SELECT COUNT(*) FROM visits v WHERE v.patient_id = p.id) AS visit_count,
    (SELECT COUNT(*) FROM follow_ups f WHERE f.patient_id = p.id AND f.status = 'pending') AS pending_follow_ups
  FROM patients p
`;

function json(res, status, body) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
  });
  res.end(JSON.stringify(body));
}

function fail(res, status, message) {
  json(res, status, { error: message });
}

async function bodyJson(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 8 * 1024 * 1024) throw new Error('请求内容太大');
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

function cleanName(value) {
  const name = String(value || '').trim().slice(0, 24);
  if (!name) throw new Error('患者名字不能为空');
  return name;
}

function cleanAge(value) {
  const age = Number(value);
  if (!Number.isInteger(age) || age < 1 || age > 99) throw new Error('年龄需要在 1 到 99 岁之间');
  return age;
}

function savePhoto(dataUrl, oldPath = '') {
  if (!dataUrl) return oldPath || '';
  const match = /^data:image\/(webp|png|jpeg);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!match) throw new Error('照片格式不支持');
  const bytes = Buffer.from(match[2], 'base64');
  if (bytes.length > 5 * 1024 * 1024) throw new Error('照片不能超过 5MB');
  const extension = match[1] === 'jpeg' ? 'jpg' : match[1];
  const filename = `${randomUUID()}.${extension}`;
  const target = path.join(photosDir, filename);
  writeFileSync(target, bytes);
  if (oldPath && existsSync(oldPath)) {
    try { unlinkSync(oldPath); } catch {}
  }
  return target;
}

function listPatients() {
  return db.prepare(`${patientSelect} ORDER BY p.updated_at DESC`).all().map(patientFromRow);
}

function getPatient(id) {
  return patientFromRow(db.prepare(`${patientSelect} WHERE p.id = ?`).get(id));
}

function mapResult(row) {
  let expanded = {};
  try { expanded = row.result_json ? JSON.parse(row.result_json) : {}; } catch {}
  return { ...expanded, id: row.department_id, name: row.name, summary: row.summary, detail: row.detail, score: row.score, sticker: row.sticker };
}

function getHistory(patientId) {
  const visits = db.prepare('SELECT * FROM visits WHERE patient_id = ? ORDER BY completed_at DESC').all(patientId).map((visit) => ({
    id: visit.id,
    journeyToken: visit.journey_token,
    symptoms: JSON.parse(visit.symptoms_json),
    overallScore: visit.overall_score,
    diagnosisCode: visit.diagnosis_code,
    startedAt: visit.started_at,
    completedAt: visit.completed_at,
    results: db.prepare('SELECT * FROM department_results WHERE visit_id = ? ORDER BY rowid').all(visit.id).map(mapResult),
  }));
  const followUps = db.prepare('SELECT * FROM follow_ups WHERE patient_id = ? ORDER BY due_at').all(patientId).map((row) => ({
    id: row.id, visitId: row.visit_id, sequence: row.sequence, type: row.type, dueAt: row.due_at, status: row.status,
    energyLevel: row.energy_level, mood: row.mood, note: row.note, reward: row.reward, completedAt: row.completed_at,
  }));
  const rewards = db.prepare('SELECT * FROM rewards WHERE patient_id = ? ORDER BY earned_at DESC').all(patientId).map((row) => ({ id: row.id, code: row.code, name: row.name, earnedAt: row.earned_at }));
  return { visits, followUps, rewards };
}

function addDays(iso, days) {
  const value = new Date(iso);
  value.setDate(value.getDate() + days);
  return value.toISOString();
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') return json(res, 204, {});
  const url = new URL(req.url, `http://${req.headers.host || '127.0.0.1'}`);
  const pathname = decodeURIComponent(url.pathname);
  try {
    if (pathname === '/api/health' && req.method === 'GET') return json(res, 200, { ok: true, database: 'sqlite', time: new Date().toISOString() });
    if (pathname === '/api/bootstrap' && req.method === 'GET') return json(res, 200, { patients: listPatients(), time: new Date().toISOString() });

    if (pathname === '/api/patients' && req.method === 'POST') {
      const body = await bodyJson(req);
      const now = new Date().toISOString();
      const id = randomUUID();
      const photoPath = savePhoto(body.photoDataUrl);
      db.prepare('INSERT INTO patients (id,name,age,photo_path,photo_background,created_at,updated_at) VALUES (?,?,?,?,?,?,?)')
        .run(id, cleanName(body.name), cleanAge(body.age), photoPath || null, String(body.photoBackground || 'rainbow'), now, now);
      return json(res, 201, getPatient(id));
    }

    const patientMatch = /^\/api\/patients\/([^/]+)$/.exec(pathname);
    if (patientMatch && req.method === 'PATCH') {
      const id = patientMatch[1];
      const current = db.prepare('SELECT * FROM patients WHERE id = ?').get(id);
      if (!current) return fail(res, 404, '找不到患者');
      const body = await bodyJson(req);
      const photoPath = savePhoto(body.photoDataUrl, current.photo_path || '');
      db.prepare('UPDATE patients SET name=?, age=?, photo_path=?, photo_background=?, updated_at=? WHERE id=?')
        .run(cleanName(body.name ?? current.name), cleanAge(body.age ?? current.age), photoPath || null, String(body.photoBackground ?? current.photo_background), new Date().toISOString(), id);
      return json(res, 200, getPatient(id));
    }
    if (patientMatch && req.method === 'DELETE') {
      const current = db.prepare('SELECT photo_path FROM patients WHERE id = ?').get(patientMatch[1]);
      if (!current) return fail(res, 404, '找不到患者');
      db.prepare('DELETE FROM patients WHERE id = ?').run(patientMatch[1]);
      if (current.photo_path && existsSync(current.photo_path)) { try { unlinkSync(current.photo_path); } catch {} }
      return json(res, 200, { ok: true });
    }

    const journeyMatch = /^\/api\/patients\/([^/]+)\/journey$/.exec(pathname);
    if (journeyMatch && req.method === 'GET') {
      const row = db.prepare('SELECT journey_json FROM journey_states WHERE patient_id = ?').get(journeyMatch[1]);
      return json(res, 200, { journey: row ? JSON.parse(row.journey_json) : null });
    }
    if (journeyMatch && req.method === 'PUT') {
      const body = await bodyJson(req);
      const now = new Date().toISOString();
      db.prepare(`INSERT INTO journey_states(patient_id,journey_json,updated_at) VALUES(?,?,?)
        ON CONFLICT(patient_id) DO UPDATE SET journey_json=excluded.journey_json, updated_at=excluded.updated_at`)
        .run(journeyMatch[1], JSON.stringify(body.journey), now);
      return json(res, 200, { ok: true, updatedAt: now });
    }

    const historyMatch = /^\/api\/patients\/([^/]+)\/history$/.exec(pathname);
    if (historyMatch && req.method === 'GET') {
      if (!getPatient(historyMatch[1])) return fail(res, 404, '找不到患者');
      return json(res, 200, getHistory(historyMatch[1]));
    }

    if (pathname === '/api/migrate' && req.method === 'POST') {
      const existing = db.prepare("SELECT value FROM app_meta WHERE key='localStorageMigrated'").get();
      if (existing) return json(res, 200, { migrated: false, patients: listPatients() });
      const body = await bodyJson(req);
      const old = body.journey;
      if (!old?.patient?.name) {
        db.prepare("INSERT OR REPLACE INTO app_meta(key,value) VALUES('localStorageMigrated',?)").run(new Date().toISOString());
        return json(res, 200, { migrated: false, patients: listPatients() });
      }
      const now = new Date().toISOString();
      const patientId = randomUUID();
      transaction(() => {
        db.prepare('INSERT INTO patients (id,name,age,photo_background,created_at,updated_at,total_stickers) VALUES (?,?,?,?,?,?,?)')
          .run(patientId, cleanName(old.patient.name), cleanAge(old.patient.age || 6), 'rainbow', now, now, old.results?.length || 0);
        const migratedJourney = { ...old, patient: { ...old.patient, id: patientId, photoUrl: '', photoBackground: 'rainbow' }, journeyToken: old.journeyToken || randomUUID() };
        db.prepare('INSERT INTO journey_states(patient_id,journey_json,updated_at) VALUES(?,?,?)').run(patientId, JSON.stringify(migratedJourney), now);
        db.prepare("INSERT OR REPLACE INTO app_meta(key,value) VALUES('localStorageMigrated',?)").run(now);
      });
      return json(res, 200, { migrated: true, patients: listPatients(), selectedPatientId: patientId });
    }

    if (pathname === '/api/visits' && req.method === 'POST') {
      const body = await bodyJson(req);
      const patient = getPatient(body.patientId);
      if (!patient) return fail(res, 404, '找不到患者');
      const existing = db.prepare('SELECT id FROM visits WHERE journey_token = ?').get(body.journeyToken);
      if (existing) return json(res, 200, { archived: false, visitId: existing.id, ...getHistory(body.patientId) });
      const now = new Date().toISOString();
      const visitId = randomUUID();
      const results = Array.isArray(body.results) ? body.results : [];
      const score = results.length ? Math.round(results.reduce((sum, item) => sum + Number(item.score || 0), 0) / results.length) : 100;
      transaction(() => {
        db.prepare('INSERT INTO visits(id,journey_token,patient_id,symptoms_json,overall_score,diagnosis_code,started_at,completed_at) VALUES(?,?,?,?,?,?,?,?)')
          .run(visitId, body.journeyToken || randomUUID(), body.patientId, JSON.stringify(body.symptoms || []), score, body.diagnosisCode || '', body.startedAt || now, now);
        const insertResult = db.prepare('INSERT INTO department_results(id,visit_id,department_id,name,summary,detail,score,sticker,result_json) VALUES(?,?,?,?,?,?,?,?,?)');
        const insertReward = db.prepare('INSERT OR IGNORE INTO rewards(id,patient_id,source_id,code,name,earned_at) VALUES(?,?,?,?,?,?)');
        for (const result of results) {
          insertResult.run(randomUUID(), visitId, result.id, result.name, result.summary, result.detail, Number(result.score), result.sticker, JSON.stringify(result));
          insertReward.run(randomUUID(), body.patientId, `${visitId}:${result.id}`, `dept-${result.id}`, result.sticker, now);
        }
        const followUpPlan = [
          [1, 'energy_check', '能量观察记录星'],
          [3, 'recovery_challenge', '亲子恢复记录章'],
          [7, 'final_review', '完全康复纪念章'],
        ];
        const insertFollow = db.prepare('INSERT INTO follow_ups(id,visit_id,patient_id,sequence,type,due_at,reward) VALUES(?,?,?,?,?,?,?)');
        for (const [day, type, reward] of followUpPlan) insertFollow.run(randomUUID(), visitId, body.patientId, day, type, addDays(now, day), reward);
        db.prepare('UPDATE patients SET last_visit_at=?, updated_at=?, total_stickers=total_stickers+? WHERE id=?').run(now, now, results.length, body.patientId);
      });
      return json(res, 201, { archived: true, visitId, ...getHistory(body.patientId), patient: getPatient(body.patientId) });
    }

    const followMatch = /^\/api\/follow-ups\/([^/]+)\/complete$/.exec(pathname);
    if (followMatch && req.method === 'POST') {
      const body = await bodyJson(req);
      const row = db.prepare('SELECT * FROM follow_ups WHERE id = ?').get(followMatch[1]);
      if (!row) return fail(res, 404, '找不到回访任务');
      if (row.status !== 'completed') {
        const now = new Date().toISOString();
        transaction(() => {
          db.prepare("UPDATE follow_ups SET status='completed',energy_level=?,mood=?,note=?,completed_at=? WHERE id=?")
            .run(Number(body.energyLevel || 100), String(body.mood || '😄'), String(body.note || ''), now, row.id);
          db.prepare('INSERT OR IGNORE INTO rewards(id,patient_id,source_id,code,name,earned_at) VALUES(?,?,?,?,?,?)')
            .run(randomUUID(), row.patient_id, row.id, `followup-${row.sequence}`, row.reward, now);
          db.prepare('UPDATE patients SET total_stickers=total_stickers+1,updated_at=? WHERE id=?').run(now, row.patient_id);
        });
      }
      return json(res, 200, { ok: true, ...getHistory(row.patient_id), patient: getPatient(row.patient_id) });
    }

    if (pathname.startsWith('/photos/') && req.method === 'GET') {
      const file = path.join(photosDir, path.basename(pathname));
      if (!existsSync(file)) return fail(res, 404, '照片不存在');
      const ext = path.extname(file).slice(1);
      res.writeHead(200, { 'Content-Type': ext === 'jpg' ? 'image/jpeg' : `image/${ext}`, 'Cache-Control': 'public, max-age=31536000, immutable' });
      return createReadStream(file).pipe(res);
    }

    if (pathname.startsWith('/api/')) return fail(res, 404, '接口不存在');

    const requested = pathname === '/' ? 'index.html' : pathname.slice(1);
    const file = path.join(distDir, requested);
    if (existsSync(file) && statSync(file).isFile()) {
      const ext = path.extname(file);
      const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp' };
      res.writeHead(200, { 'Content-Type': types[ext] || 'application/octet-stream' });
      return createReadStream(file).pipe(res);
    }
    const index = path.join(distDir, 'index.html');
    if (existsSync(index)) { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); return res.end(readFileSync(index)); }
    return fail(res, 404, '请先运行 npm run build');
  } catch (error) {
    console.error(error);
    return fail(res, 400, error instanceof Error ? error.message : '请求失败');
  }
});

server.listen(port, '127.0.0.1', () => console.log(`SQLite clinic server: http://127.0.0.1:${port}`));
