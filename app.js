const $ = (id) => document.getElementById(id);

let otherLines = [];
let preservedServerGuid = '';
let currentFileBase = 'DedicatedServer';

function setStatus(msg, isWarn) {
  const el = $('status');
  el.textContent = msg || '';
  el.classList.toggle('warn', !!isWarn);
}

function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function fieldIds() {
  return {
    ownerId: 'fOwnerId',
    serverName: 'fServerName',
    defaultWorldName: 'fDefaultWorldName',
    adminPassword: 'fAdminPassword',
    worldPassword: 'fWorldPassword',
  };
}

function getFormValues() {
  const ids = fieldIds();
  const values = {};
  for (const field of Object.keys(ids)) values[field] = $(ids[field]).value;
  values.serverGuid = preservedServerGuid;
  return values;
}

function setFormValues(values) {
  const ids = fieldIds();
  for (const field of Object.keys(ids)) $(ids[field]).value = values[field] || '';
  preservedServerGuid = values.serverGuid || '';
  renderGuidNote();
}

function renderGuidNote() {
  const el = $('guidNote');
  if (preservedServerGuid) {
    el.textContent = `A ServerGuid (${preservedServerGuid}) was found in your uploaded file and will be kept as-is. Do not change this yourself.`;
  } else {
    el.textContent = 'No ServerGuid was found. Leaving it out is fine — the server generates one automatically the first time it runs.';
  }
}

function renderOtherLines() {
  const card = $('otherCard');
  if (!otherLines.length) {
    card.style.display = 'none';
    return;
  }
  card.style.display = '';
  $('otherList').innerHTML = otherLines.map((l) => `<li><code>${escapeHtml(l.key)}=${escapeHtml(l.value)}</code></li>`).join('');
}

function renderWarnings(warnings) {
  const card = $('warningsCard');
  if (!warnings || !warnings.length) {
    card.style.display = 'none';
    return;
  }
  card.style.display = '';
  $('warningsList').innerHTML = warnings.map((w) => `<li>${escapeHtml(w)}</li>`).join('');
}

async function handleFile(file) {
  currentFileBase = (file.name || 'DedicatedServer').replace(/\.ini$/i, '');
  setStatus('Reading file…');
  try {
    const text = await file.text();
    const parsed = DragonwildsConfig.parseIniText(text);
    otherLines = parsed.otherLines;
    setFormValues(parsed.values);
    renderOtherLines();
    renderWarnings(parsed.warnings);
    $('formCard').style.display = '';
    setStatus(`Loaded ${file.name}. Edit the fields below, then export.`);
  } catch (err) {
    setStatus((err && err.message) || String(err), true);
  }
}

function validateAndMaybeWarn() {
  const values = getFormValues();
  const missing = DragonwildsConfig.missingMandatoryFields(values);
  const el = $('mandatoryWarning');
  if (missing.length) {
    const labels = missing.map((f) => DragonwildsConfig.FIELD_LABELS[f]).join(', ');
    el.textContent = `Missing required field(s): ${labels}. The dedicated server will not start without these.`;
    el.style.display = 'block';
  } else {
    el.style.display = 'none';
  }
  return missing.length === 0;
}

function download(filename, content, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function exportIni() {
  validateAndMaybeWarn();
  const values = getFormValues();
  const text = DragonwildsConfig.serializeConfig(values, otherLines);
  download(`${currentFileBase || 'DedicatedServer'}.ini`, text, 'text/plain');
}

function bindDrop() {
  const dz = $('dropzone');
  const input = $('fileInput');
  const setDrag = (on) => dz.classList.toggle('drag', on);
  ['dragenter', 'dragover'].forEach((ev) => dz.addEventListener(ev, (e) => { e.preventDefault(); setDrag(true); }));
  ['dragleave', 'drop'].forEach((ev) => dz.addEventListener(ev, (e) => { e.preventDefault(); setDrag(false); }));
  dz.addEventListener('drop', (e) => {
    const file = e.dataTransfer.files && e.dataTransfer.files[0];
    if (file) handleFile(file);
  });
  dz.addEventListener('click', () => input.click());
  dz.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); }
  });
  input.addEventListener('change', () => {
    if (input.files && input.files[0]) handleFile(input.files[0]);
    input.value = '';
  });
}

function startFresh() {
  otherLines = [];
  setFormValues(DragonwildsConfig.emptyValues());
  renderOtherLines();
  renderWarnings([]);
  $('formCard').style.display = '';
  $('fname').textContent = '';
  setStatus('Starting a new config from scratch. Fill in the fields below.');
}

function togglePasswordVisibility(inputId, btn) {
  const input = $(inputId);
  const showing = input.type === 'text';
  input.type = showing ? 'password' : 'text';
  btn.textContent = showing ? 'Show' : 'Hide';
}

bindDrop();
$('startFreshBtn').addEventListener('click', startFresh);
$('exportBtn').addEventListener('click', exportIni);
document.querySelectorAll('[data-toggle-password]').forEach((btn) => {
  btn.addEventListener('click', () => togglePasswordVisibility(btn.getAttribute('data-toggle-password'), btn));
});
document.querySelectorAll('#formCard input').forEach((input) => {
  input.addEventListener('input', validateAndMaybeWarn);
});
