import { state, updateState, ICE_CFG, CODE_EXPIRE_MS } from './state.js';
import * as ui from './ui.js';
import * as utils from './utils.js';

// Global access for HTML onclick handlers
window.goCreate = () => ui.show('s-create');
window.goJoin = () => {
  ui.show('s-join');
  setTimeout(() => {
    const el = document.getElementById('join-input');
    if (el) el.focus();
  }, 100);
};
window.showHome = () => {
  leaveChat();
  ui.show('s-home');
};
window.createRoom = createRoom;
window.joinRoom = joinRoom;
window.sendMsg = sendMsg;
window.copyCode = copyCode;
window.toggleConnPanel = ui.toggleConnPanel;
window.cancelReply = cancelReply;
window.cancelFile = cancelFile;
window.onFileSelect = onFileSelect;
window.autoResize = utils.autoResize;
window.onTextInput = onTextInput;
window.shareCode = shareCode;
window.closeLightbox = () => {
  document.getElementById('lightbox').classList.remove('show');
  document.getElementById('lightbox-img').src = '';
};

// Initialization
window.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(location.search);
  const jc = params.get('join');
  if (jc) {
    window.goJoin();
    const input = document.getElementById('join-input');
    if (input) input.value = jc.toUpperCase().slice(0, 6);
  }
});

async function createRoom() {
  const btn = document.getElementById('create-btn');
  btn.disabled = true; btn.textContent = 'Membuat room...'; ui.clearErr('create-err');
  try {
    const myCode = utils.genCode();
    updateState({ myCode, isHost: true, roomRef: window.db.ref('rooms/' + myCode) });
    await state.roomRef.remove();
    
    const pc = new RTCPeerConnection(ICE_CFG);
    updateState({ pc });
    
    const dc = pc.createDataChannel('chat', { ordered: true });
    updateState({ dc });
    setupDC();

    pc.onicecandidate = (e) => {
      if (e.candidate) state.roomRef.child('hostIce').push(e.candidate.toJSON());
    };

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await state.roomRef.child('offer').set({ type: offer.type, sdp: offer.sdp });
    await state.roomRef.child('createdAt').set(Date.now());

    state.roomRef.child('answer').on('value', async (snap) => {
      if (!snap.val() || !state.pc) return;
      if (state.pc.signalingState === 'have-local-offer') {
        try {
          await state.pc.setRemoteDescription(new RTCSessionDescription(snap.val()));
          for (const ice of state.pendingHostIce) {
            try { await state.pc.addIceCandidate(new RTCIceCandidate(ice)); } catch (e) {}
          }
          updateState({ pendingHostIce: [] });
        } catch (e) {}
      }
    });

    state.roomRef.child('joinIce').on('child_added', async (snap) => {
      if (!snap.val() || !state.pc) return;
      if (state.pc.remoteDescription) {
        try { await state.pc.addIceCandidate(new RTCIceCandidate(snap.val())); } catch (e) {}
      } else {
        state.pendingHostIce.push(snap.val());
      }
    });

    ui.show('s-chat');
    ui.renderCode(state.myCode);
    document.getElementById('header-code').textContent = state.myCode;
    ui.setStatus('waiting', 'Menunggu lawan bicara...');
    
    if (window.QRCode) {
      const canvas = document.getElementById('qr-canvas');
      const url = location.origin + location.pathname + '?join=' + state.myCode;
      window.QRCode.toCanvas(canvas, url, { width: 96, margin: 1 }, () => {});
      document.getElementById('qr-wrap').style.display = 'flex';
    }
    document.getElementById('share-row').style.display = 'flex';
    
    const expiresAt = Date.now() + CODE_EXPIRE_MS;
    await state.roomRef.child('expiresAt').set(expiresAt);
    startCodeTimer(expiresAt);
  } catch (e) {
    ui.showErr('create-err', e.message || 'Gagal membuat room.');
    cleanupPeer();
  }
  btn.disabled = false; btn.textContent = 'Generate Kode & Mulai';
}

async function joinRoom() {
  const inputEl = document.getElementById('join-input');
  const input = inputEl.value.trim().toUpperCase();
  if (!input) { ui.showErr('join-err', 'Masukkan kode terlebih dahulu.'); return; }
  const btn = document.getElementById('join-btn');
  btn.disabled = true; btn.textContent = 'Menghubungkan...'; ui.clearErr('join-err');
  try {
    ui.showOverlay('Mencari room...');
    const offerSnap = await window.db.ref('rooms/' + input + '/offer').once('value');
    if (!offerSnap.val()) {
      ui.hideOverlay(); ui.showErr('join-err', 'Kode tidak ditemukan atau host offline.');
      btn.disabled = false; btn.textContent = 'Bergabung'; return;
    }
    const expSnap = await window.db.ref('rooms/' + input + '/expiresAt').once('value');
    if (expSnap.val() && Date.now() > expSnap.val()) {
      ui.hideOverlay(); ui.showErr('join-err', 'Kode sudah expired.');
      btn.disabled = false; btn.textContent = 'Bergabung'; return;
    }

    updateState({ myCode: input, isHost: false, remoteDescSet: false, pendingHostIce: [], roomRef: window.db.ref('rooms/' + input) });
    const pc = new RTCPeerConnection(ICE_CFG);
    updateState({ pc });

    pc.ondatachannel = (e) => {
      updateState({ dc: e.channel });
      setupDC();
    };
    pc.onicecandidate = (e) => {
      if (e.candidate) state.roomRef.child('joinIce').push(e.candidate.toJSON());
    };

    state.roomRef.child('hostIce').on('child_added', async (snap) => {
      if (!snap.val() || !state.pc) return;
      if (state.remoteDescSet) {
        try { await state.pc.addIceCandidate(new RTCIceCandidate(snap.val())); } catch (e) {}
      } else {
        state.pendingHostIce.push(snap.val());
      }
    });

    await state.pc.setRemoteDescription(new RTCSessionDescription(offerSnap.val()));
    updateState({ remoteDescSet: true });
    for (const ice of state.pendingHostIce) {
      try { await state.pc.addIceCandidate(new RTCIceCandidate(ice)); } catch (e) {}
    }
    updateState({ pendingHostIce: [] });

    const answer = await state.pc.createAnswer();
    await state.pc.setLocalDescription(answer);
    await state.roomRef.child('answer').set({ type: answer.type, sdp: answer.sdp });
    
    ui.showOverlay('Menghubungkan...');
    const joinTimeoutId = setTimeout(() => {
      ui.hideOverlay(); ui.showErr('join-err', 'Gagal terhubung (90s).');
      cleanupPeer(); btn.disabled = false; btn.textContent = 'Bergabung';
    }, 90000);
    updateState({ joinTimeoutId });
    window._joinBtn = btn;
  } catch (e) {
    ui.hideOverlay(); ui.showErr('join-err', e.message || 'Gagal bergabung.');
    cleanupPeer(); btn.disabled = false; btn.textContent = 'Bergabung';
  }
}

function setupDC() {
  state.dc.onopen = () => {
    if (state.joinTimeoutId) { clearTimeout(state.joinTimeoutId); updateState({ joinTimeoutId: null }); }
    if (window._joinBtn) { window._joinBtn.disabled = false; window._joinBtn.textContent = 'Bergabung'; window._joinBtn = null; }
    stopCodeTimer(); ui.hideOverlay();
    ui.setStatus('connected', 'Terhubung');
    ui.enableInput();
    startStatsPoll();
    if (!state.isHost) {
      ui.show('s-chat');
      document.getElementById('header-code').textContent = state.myCode;
      ui.renderCode(state.myCode);
      document.getElementById('empty-state').style.display = 'none';
    } else {
      document.getElementById('empty-state').style.display = 'none';
    }
    setTimeout(() => { if (state.roomRef) state.roomRef.remove(); }, 3000);
  };
  state.dc.onclose = () => {
    ui.setStatus('left', 'Lawan bicara keluar');
    stopStatsPoll(); ui.disableInput();
  };
  state.dc.onmessage = (e) => {
    try { onData(JSON.parse(e.data)); } catch (err) {}
  };
}

function onData(d) {
  if (d.type === 'msg') {
    appendMsg(d.text, false, d.time, d.id, d.replyTo);
  } else if (d.type === 'typing') {
    document.getElementById('typing-row').style.display = '';
    utils.scrollBottom();
    clearTimeout(state.typingTimeout);
    updateState({ typingTimeout: setTimeout(() => document.getElementById('typing-row').style.display = 'none', 2500) });
  } else if (d.type === 'stop-typing') {
    document.getElementById('typing-row').style.display = 'none';
  }
}

function sendMsg() {
  const ta = document.getElementById('msg-input');
  const txt = ta.value.trim();
  if (!txt || !state.dc) return;
  const t = utils.now();
  const id = 'm' + Date.now() + Math.random().toString(36).slice(2, 5);
  state.dc.send(JSON.stringify({ type: 'msg', text: txt, time: t, id: id, replyTo: state.pendingReply }));
  appendMsg(txt, true, t, id, state.pendingReply);
  cancelReply();
  ta.value = ''; utils.autoResize(ta);
}

function appendMsg(txt, me, time, id, replyTo) {
  const msgs = document.getElementById('msgs');
  if (!msgs) return;
  const div = document.createElement('div');
  div.className = 'msg-outer ' + (me ? 'me' : 'other');
  div.innerHTML = `
    <div class="msg-row ${me ? 'me' : 'other'}">
      <div class="bubble ${me ? 'me' : 'other'}">
        <div class="bubble-txt">${utils.escHtml(txt)}</div>
        <div class="bubble-meta">
          <span class="bubble-time">${time}</span>
        </div>
      </div>
    </div>
  `;
  msgs.appendChild(div);
  utils.scrollBottom();
}

function onTextInput() {
  if (!state.dc || state.dc.readyState !== 'open') return;
  clearTimeout(state.typingTimer);
  state.dc.send(JSON.stringify({ type: 'typing' }));
  updateState({ typingTimer: setTimeout(() => state.dc.send(JSON.stringify({ type: 'stop-typing' })), 2000) });
}

function startCodeTimer(expiresAt) {
  updateState({ codeExpiresAt: expiresAt });
  const wrap = document.getElementById('code-timer-wrap');
  wrap.style.display = 'flex';
  const tick = () => {
    const remaining = state.codeExpiresAt - Date.now();
    if (remaining <= 0) {
      stopCodeTimer();
      if (!state.dc || state.dc.readyState !== 'open') {
        cleanupPeer();
        document.getElementById('expired-overlay').classList.add('show');
        ui.setStatus('left', 'Kode expired');
      }
      return;
    }
    const mins = Math.floor(remaining / 60000);
    const secs = Math.floor((remaining % 60000) / 1000);
    document.getElementById('code-timer-txt').textContent = mins + ':' + (secs < 10 ? '0' : '') + secs;
    document.getElementById('code-timer-bar').style.width = (remaining / CODE_EXPIRE_MS * 100) + '%';
  };
  tick();
  updateState({ codeTimerInterval: setInterval(tick, 1000) });
}

function stopCodeTimer() {
  if (state.codeTimerInterval) { clearInterval(state.codeTimerInterval); updateState({ codeTimerInterval: null }); }
  document.getElementById('code-timer-wrap').style.display = 'none';
}

function cleanupPeer() {
  if (state.dc) { try { state.dc.close(); } catch (e) {} updateState({ dc: null }); }
  if (state.pc) { try { state.pc.close(); } catch (e) {} updateState({ pc: null }); }
  if (state.roomRef) { try { state.roomRef.off(); state.roomRef.remove(); } catch (e) {} updateState({ roomRef: null }); }
  stopStatsPoll();
}

function leaveChat() {
  cleanupPeer(); stopCodeTimer();
  updateState({ myCode: '', isHost: false, pendingReply: null, msgMap: {}, lastSentMsgIds: [] });
  document.getElementById('msgs').innerHTML = '';
  document.getElementById('header-code').textContent = '--';
  ui.disableInput();
}

function startStatsPoll() {
  stopStatsPoll();
  const poll = setInterval(() => {
    if (!state.pc) return;
    state.pc.getStats().then(stats => {
      let mode = '—', lat = '—';
      stats.forEach(r => {
        if (r.type === 'candidate-pair' && r.state === 'succeeded' && r.nominated) {
          if (r.currentRoundTripTime !== undefined) lat = Math.round(r.currentRoundTripTime * 1000) + 'ms';
        }
      });
      document.getElementById('cp-latency').textContent = lat;
    });
  }, 3000);
  updateState({ statsPollId: poll });
}

function stopStatsPoll() {
  if (state.statsPollId) { clearInterval(state.statsPollId); updateState({ statsPollId: null }); }
}

function copyCode() {
  navigator.clipboard.writeText(state.myCode).catch(() => {});
  const hint = document.getElementById('copy-hint');
  const icon = document.getElementById('copy-icon');
  if (hint) hint.textContent = 'Kode disalin!';
  if (icon) icon.textContent = 'OK';
  setTimeout(() => {
    if (hint) hint.textContent = 'Ketuk untuk salin';
    if (icon) icon.textContent = '⎘';
  }, 2000);
}

function cancelReply() { updateState({ pendingReply: null }); document.getElementById('reply-preview').classList.remove('show'); }
function cancelFile() { updateState({ pendingFile: null }); document.getElementById('preview-bar').classList.remove('show'); }
function onFileSelect(e) { /* Simplified for now */ }
function shareCode() {
  const url = location.origin + location.pathname + '?join=' + state.myCode;
  if (navigator.share) navigator.share({ title: 'ANONIX Chat', text: 'Gabung room ANONIX dengan kode: ' + state.myCode, url }).catch(() => {});
  else copyCode();
}
