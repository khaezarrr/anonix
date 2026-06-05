// Constants
export const ICE_CFG = {
  iceServers:[
    {urls:'stun:stun.l.google.com:19302'},
    {urls:'stun:stun1.l.google.com:19302'},
    {urls:'stun:stun.cloudflare.com:3478'},
    {urls:['turn:a.relay.metered.ca:80',
           'turn:a.relay.metered.ca:80?transport=tcp',
           'turn:a.relay.metered.ca:443',
           'turns:a.relay.metered.ca:443?transport=tcp'],
     username:'openrelayproject',
     credential:'openrelayproject'},
    {urls:['turn:relay1.expressturn.com:3478',
           'turn:relay1.expressturn.com:3478?transport=tcp'],
     username:'efUN6OFR7JN4HPWMLD',
     credential:'xBPBvnxQvF7kJMCA'}
  ],
  iceCandidatePoolSize:10
};

export const MAX_FILE = 50 * 1024 * 1024;
export const CHUNK = 16 * 1024;
export const CODE_EXPIRE_MS = 5 * 60 * 1000;

// Global State
export let state = {
  pc: null,
  dc: null,
  myCode: '',
  isHost: false,
  roomRef: null,
  typingTimer: null,
  typingTimeout: null,
  pendingFile: null,
  joinTimeoutId: null,
  incoming: {},
  pendingHostIce: [],
  remoteDescSet: false,
  codeTimerInterval: null,
  codeExpiresAt: 0,
  pendingReply: null,
  msgMap: {},
  lastSentMsgIds: [],
  statsPollId: null
};

export function updateState(newData) {
  state = { ...state, ...newData };
}
