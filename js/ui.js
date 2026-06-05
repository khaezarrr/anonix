import { state, updateState } from './state.js';

export function show(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const target = document.getElementById(id);
  if (target) target.classList.add('active');
}

export function setStatus(stateType, label) {
  const d = document.getElementById('status-dot');
  const t = document.getElementById('status-txt');
  if (d && t) {
    d.className = 'dot' + (stateType === 'connected' ? '' : stateType === 'left' ? ' danger' : ' warn');
    t.textContent = label;
  }
}

export function showErr(id, m) {
  const el = document.getElementById(id);
  if (el) {
    el.textContent = m;
    el.classList.add('show');
  }
}

export function clearErr(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove('show');
}

export function renderCode(code) {
  const el = document.getElementById('big-code');
  if (el) {
    el.innerHTML = code.split('').map(c => `<span class="big-code-char">${c}</span>`).join('');
  }
}

export function showOverlay(m) {
  const txt = document.getElementById('overlay-txt');
  const overlay = document.getElementById('overlay');
  if (txt && overlay) {
    txt.textContent = m;
    overlay.classList.add('show');
  }
}

export function hideOverlay() {
  const overlay = document.getElementById('overlay');
  if (overlay) overlay.classList.remove('show');
}

export function enableInput() {
  const ta = document.getElementById('msg-input');
  const btn = document.getElementById('attach-btn');
  if (ta) { ta.disabled = false; ta.placeholder = 'Ketik pesan...'; }
  if (btn) btn.disabled = false;
}

export function disableInput() {
  const ta = document.getElementById('msg-input');
  const sendBtn = document.getElementById('send-btn');
  const attachBtn = document.getElementById('attach-btn');
  if (ta) { ta.disabled = true; ta.placeholder = 'Menunggu lawan bicara...'; }
  if (sendBtn) sendBtn.disabled = true;
  if (attachBtn) attachBtn.disabled = true;
}

export function toggleConnPanel() {
  const panel = document.getElementById('conn-panel');
  const chevron = document.getElementById('conn-chevron');
  if (panel && chevron) {
    panel.classList.toggle('open');
    chevron.classList.toggle('open');
  }
}
