/**
 * AIFilms Real-time Sync Module v2.0
 *
 * Features:
 * - Supabase Database for persistent votes (600 concurrent users)
 * - Supabase Realtime for cross-device sync
 * - Device tracking and presence for accurate device count
 * - Real-time vote aggregation via database triggers
 */

const SYNC_MODE = 'supabase';

// Supabase config
const SUPABASE_URL = 'https://rtnsbmoatuocymrsdorj.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ0bnNibW9hdHVvY3ltcnNkb3JqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc4NjA5NzQsImV4cCI6MjA4MzQzNjk3NH0.-uKLv5sBlUWB19LmA_UH5eMPenkmD1xsIBP43i0BK8U';

// R2 Video CDN
const R2_BASE = 'https://pub-80916ecd31064b1bb21b62cf3490e8a3.r2.dev';

// Reel data
const MOCK_REELS = [
  { id: 'reel-1', number: 1, contestant: 'Arjun Mehta', category: 'Dance', duration: 45, thumbnail: 'user', videoUrl: `${R2_BASE}/reel-01.mp4` },
  { id: 'reel-2', number: 2, contestant: 'Priya Sharma', category: 'Comedy', duration: 30, thumbnail: 'user', videoUrl: `${R2_BASE}/reel-02.mp4` },
  { id: 'reel-3', number: 3, contestant: 'Rahul Verma', category: 'Music', duration: 60, thumbnail: 'user', videoUrl: `${R2_BASE}/reel-03.mp4` },
  { id: 'reel-4', number: 4, contestant: 'Ananya Patel', category: 'Dance', duration: 40, thumbnail: 'user', videoUrl: `${R2_BASE}/reel-04.mp4` },
  { id: 'reel-5', number: 5, contestant: 'Vikram Singh', category: 'Drama', duration: 55, thumbnail: 'user', videoUrl: `${R2_BASE}/reel-05.mp4` },
  { id: 'reel-6', number: 6, contestant: 'Neha Gupta', category: 'Comedy', duration: 35, thumbnail: 'user', videoUrl: `${R2_BASE}/reel-06.mp4` },
  { id: 'reel-7', number: 7, contestant: 'Aditya Kumar', category: 'Music', duration: 50, thumbnail: 'user', videoUrl: `${R2_BASE}/reel-07.mp4` },
  { id: 'reel-8', number: 8, contestant: 'Kavya Nair', category: 'Dance', duration: 45, thumbnail: 'user', videoUrl: `${R2_BASE}/reel-08.mp4` },
  { id: 'reel-9', number: 9, contestant: 'Rohan Joshi', category: 'Comedy', duration: 40, thumbnail: 'user', videoUrl: `${R2_BASE}/reel-09.mp4` },
  { id: 'reel-10', number: 10, contestant: 'Simran Kaur', category: 'Drama', duration: 60, thumbnail: 'user', videoUrl: `${R2_BASE}/reel-10.mp4` },
];

// ============================================
// DEVICE MANAGER - Unique device tracking
// ============================================

class DeviceManager {
  constructor() {
    this.deviceId = this.getOrCreateDeviceId();
    this.deviceType = this.detectDeviceType();
    this.voterId = null; // UUID from Supabase voters table
  }

  getOrCreateDeviceId() {
    let id = localStorage.getItem('aifilms-device-id');
    if (!id) {
      // Generate unique device ID
      id = 'device-' + this.generateUUID();
      localStorage.setItem('aifilms-device-id', id);
    }
    return id;
  }

  generateUUID() {
    if (crypto.randomUUID) {
      return crypto.randomUUID();
    }
    // Fallback for older browsers
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  detectDeviceType() {
    const ua = navigator.userAgent.toLowerCase();
    if (/mobile|android|iphone|ipad|ipod|blackberry|windows phone/.test(ua)) {
      if (/tablet|ipad/.test(ua)) return 'tablet';
      return 'mobile';
    }
    return 'desktop';
  }

  async registerWithSupabase(supabase, isJudge = false, judgeName = null) {
    try {
      const { data, error } = await supabase
        .from('voters')
        .upsert({
          device_id: this.deviceId,
          device_type: this.deviceType,
          is_judge: isJudge,
          judge_name: judgeName,
          last_seen_at: new Date().toISOString()
        }, {
          onConflict: 'device_id'
        })
        .select()
        .single();

      if (error) {
        console.error('Error registering device:', error);
        return null;
      }

      this.voterId = data.id;
      localStorage.setItem('aifilms-voter-id', data.id);
      return data;
    } catch (err) {
      console.error('Device registration failed:', err);
      return null;
    }
  }

  getVoterId() {
    return this.voterId || localStorage.getItem('aifilms-voter-id');
  }
}

// ============================================
// SUPABASE SYNC - Real-time + Database
// ============================================

class SupabaseSync {
  constructor() {
    this.listeners = new Map();
    this.currentState = { reelIndex: 0, status: 'waiting' };
    this.channel = null;
    this.presenceChannel = null;
    this.supabase = null;
    this.isConnected = false;
    this.pendingBroadcasts = [];
    this.connectedDevices = 0;
    this.init();
  }

  async init() {
    try {
      // Dynamically load Supabase client
      const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
      this.supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

      // Main broadcast channel for reel changes and votes
      this.channel = this.supabase.channel('live-event', {
        config: { broadcast: { self: true } }
      });

      this.channel
        .on('broadcast', { event: 'reel-change' }, ({ payload }) => {
          this.currentState = { ...this.currentState, ...payload };
          if (this.listeners.has('reel-change')) {
            this.listeners.get('reel-change').forEach(cb => cb(payload));
          }
        })
        .on('broadcast', { event: 'vote' }, ({ payload }) => {
          if (this.listeners.has('vote')) {
            this.listeners.get('vote').forEach(cb => cb(payload));
          }
        })
        .on('broadcast', { event: 'state-request' }, ({ payload }) => {
          // Control panel responds to state requests
          if (this.pageType === 'control' && this.listeners.has('state-request')) {
            this.listeners.get('state-request').forEach(cb => cb(payload));
          }
        })
        .on('broadcast', { event: 'state-sync' }, ({ payload }) => {
          // Clients receive state sync from control panel
          console.log('Received state sync:', payload);
          this.currentState = { ...this.currentState, ...payload };
          if (this.listeners.has('state-sync')) {
            this.listeners.get('state-sync').forEach(cb => cb(payload));
          }
        })
        .subscribe((status) => {
          console.log('Supabase channel status:', status);
          if (status === 'SUBSCRIBED') {
            this.isConnected = true;
            // Send pending broadcasts
            this.pendingBroadcasts.forEach(({ type, payload }) => {
              this._sendBroadcast(type, payload);
            });
            this.pendingBroadcasts = [];

            // Request current state if not control panel
            if (this.pageType !== 'control') {
              console.log('Requesting current state from control panel...');
              setTimeout(() => {
                this._sendBroadcast('state-request', {
                  requesterId: window.AIFilms?.deviceManager?.deviceId || 'unknown',
                  timestamp: Date.now()
                });
              }, 500); // Small delay to ensure control panel is ready
            }

            if (this.listeners.has('connected')) {
              this.listeners.get('connected').forEach(cb => cb());
            }
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
            console.warn('Channel connection issue:', status);
            this.isConnected = false;
            if (this.listeners.has('disconnected')) {
              this.listeners.get('disconnected').forEach(cb => cb(status));
            }
          }
        });

      // Presence channel for tracking connected devices
      this.presenceChannel = this.supabase.channel('presence:voters');
      this.pageType = this.detectPageType();

      this.presenceChannel
        .on('presence', { event: 'sync' }, () => {
          const state = this.presenceChannel.presenceState();
          // Count only non-control devices (audience, judge, results)
          let count = 0;
          Object.values(state).forEach(presences => {
            presences.forEach(p => {
              if (p.page_type !== 'control') {
                count++;
              }
            });
          });
          this.connectedDevices = count;

          if (this.listeners.has('presence-update')) {
            this.listeners.get('presence-update').forEach(cb => cb(this.connectedDevices));
          }
        })
        .on('presence', { event: 'join' }, ({ key, newPresences }) => {
          console.log('Device joined:', key, newPresences);
        })
        .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
          console.log('Device left:', key);
        })
        .subscribe(async (status) => {
          if (status === 'SUBSCRIBED') {
            const deviceId = window.AIFilms?.deviceManager?.deviceId || 'unknown';
            await this.presenceChannel.track({
              device_id: deviceId,
              page_type: this.pageType,
              joined_at: new Date().toISOString()
            });
          }
        });

    } catch (err) {
      console.error('Failed to initialize Supabase:', err);
    }
  }

  _sendBroadcast(type, payload) {
    if (this.channel) {
      this.channel.send({
        type: 'broadcast',
        event: type,
        payload
      });
    }
  }

  broadcast(type, payload) {
    this.currentState = { ...this.currentState, ...payload };

    if (this.isConnected && this.channel) {
      this._sendBroadcast(type, payload);
    } else {
      this.pendingBroadcasts.push({ type, payload });
    }
  }

  on(type, callback) {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, []);
    }
    this.listeners.get(type).push(callback);
  }

  off(type, callback) {
    if (this.listeners.has(type)) {
      const callbacks = this.listeners.get(type);
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  getState() {
    return this.currentState;
  }

  getCurrentReel() {
    const state = this.getState();
    return MOCK_REELS[state.reelIndex] || MOCK_REELS[0];
  }

  getConnectedDevices() {
    return this.connectedDevices;
  }

  onDeviceCountChange(callback) {
    this.on('presence-update', callback);
    // Also call immediately with current count
    if (this.connectedDevices > 0) {
      callback(this.connectedDevices);
    }
  }

  getSupabase() {
    return this.supabase;
  }

  detectPageType() {
    const path = window.location.pathname.toLowerCase();
    if (path.includes('control')) return 'control';
    if (path.includes('judge')) return 'judge';
    if (path.includes('results')) return 'results';
    if (path.includes('vote')) return 'audience';
    return 'audience'; // Default
  }
}

// ============================================
// VOTE STORE - Supabase-backed voting
// ============================================

class VoteStore {
  constructor(sync, deviceManager) {
    this.sync = sync;
    this.deviceManager = deviceManager;
    this.localCache = new Map(); // Cache for quick lookups
  }

  async saveVote(reelId, score, voterType = 'audience') {
    const supabase = this.sync.getSupabase();
    if (!supabase) {
      console.error('Supabase not initialized');
      return null;
    }

    const voterId = this.deviceManager.getVoterId();
    if (!voterId) {
      console.error('Voter not registered');
      return null;
    }

    try {
      const { data, error } = await supabase
        .from('votes')
        .upsert({
          reel_id: reelId,
          voter_id: voterId,
          score: score,
          voter_type: voterType,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'reel_id,voter_id'
        })
        .select()
        .single();

      if (error) {
        console.error('Error saving vote:', error);
        return null;
      }

      // Update local cache
      this.localCache.set(`${reelId}-${voterId}`, { score, voterType });

      // Broadcast vote for real-time updates
      this.sync.broadcast('vote', {
        reelId,
        score,
        voterType,
        voterId
      });

      return data;
    } catch (err) {
      console.error('Vote save failed:', err);
      return null;
    }
  }

  async getMyVote(reelId) {
    const voterId = this.deviceManager.getVoterId();
    if (!voterId) return null;

    // Check local cache first
    const cached = this.localCache.get(`${reelId}-${voterId}`);
    if (cached) return cached.score;

    const supabase = this.sync.getSupabase();
    if (!supabase) return null;

    try {
      const { data, error } = await supabase
        .from('votes')
        .select('score')
        .eq('reel_id', reelId)
        .eq('voter_id', voterId)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows
        console.error('Error getting vote:', error);
        return null;
      }

      if (data) {
        this.localCache.set(`${reelId}-${voterId}`, { score: data.score });
        return data.score;
      }

      return null;
    } catch (err) {
      console.error('Get vote failed:', err);
      return null;
    }
  }

  async hasVoted(reelId) {
    const vote = await this.getMyVote(reelId);
    return vote !== null;
  }

  async getReelStats(reelId) {
    const supabase = this.sync.getSupabase();
    if (!supabase) {
      return {
        audienceCount: 0,
        judgeCount: 0,
        audienceAvg: 0,
        judgeAvg: 0,
        finalScore: 0,
        totalVotes: 0
      };
    }

    try {
      const { data, error } = await supabase
        .from('vote_aggregates')
        .select('*')
        .eq('reel_id', reelId)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error getting stats:', error);
      }

      if (data) {
        return {
          audienceCount: data.audience_count || 0,
          judgeCount: data.judge_count || 0,
          audienceAvg: parseFloat(data.audience_average) || 0,
          judgeAvg: parseFloat(data.judge_average) || 0,
          finalScore: parseFloat(data.final_score) || 0,
          totalVotes: (data.audience_count || 0) + (data.judge_count || 0)
        };
      }

      return {
        audienceCount: 0,
        judgeCount: 0,
        audienceAvg: 0,
        judgeAvg: 0,
        finalScore: 0,
        totalVotes: 0
      };
    } catch (err) {
      console.error('Get stats failed:', err);
      return {
        audienceCount: 0,
        judgeCount: 0,
        audienceAvg: 0,
        judgeAvg: 0,
        finalScore: 0,
        totalVotes: 0
      };
    }
  }

  async getAllStats() {
    const supabase = this.sync.getSupabase();
    if (!supabase) return [];

    try {
      const { data: aggregates, error } = await supabase
        .from('vote_aggregates')
        .select('*')
        .order('final_score', { ascending: false });

      if (error) {
        console.error('Error getting all stats:', error);
        return [];
      }

      // Merge with reel data
      return MOCK_REELS.map(reel => {
        const agg = aggregates?.find(a => a.reel_id === reel.id) || {};
        return {
          ...reel,
          stats: {
            audienceCount: agg.audience_count || 0,
            judgeCount: agg.judge_count || 0,
            audienceAvg: parseFloat(agg.audience_average) || 0,
            judgeAvg: parseFloat(agg.judge_average) || 0,
            finalScore: parseFloat(agg.final_score) || 0,
            totalVotes: (agg.audience_count || 0) + (agg.judge_count || 0)
          }
        };
      }).sort((a, b) => b.stats.finalScore - a.stats.finalScore);
    } catch (err) {
      console.error('Get all stats failed:', err);
      return [];
    }
  }

  async clearAll() {
    const supabase = this.sync.getSupabase();
    if (!supabase) return;

    try {
      // Only clear votes (aggregates will be recalculated by triggers)
      await supabase.from('votes').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('vote_aggregates').delete().neq('reel_id', '');
      this.localCache.clear();
      console.log('All votes cleared');
    } catch (err) {
      console.error('Clear failed:', err);
    }
  }
}

// ============================================
// LOCAL SYNC (Fallback for testing)
// ============================================

class LocalSync {
  constructor() {
    this.channel = new BroadcastChannel('aifilms-live');
    this.listeners = new Map();
    this.currentState = this.loadState();
    this.connectedDevices = 1;

    this.channel.onmessage = (event) => {
      const { type, payload } = event.data;
      this.currentState = { ...this.currentState, ...payload };
      this.saveState();

      if (this.listeners.has(type)) {
        this.listeners.get(type).forEach(callback => callback(payload));
      }
    };
  }

  loadState() {
    try {
      const saved = localStorage.getItem('aifilms-state');
      return saved ? JSON.parse(saved) : { reelIndex: 0, status: 'waiting' };
    } catch {
      return { reelIndex: 0, status: 'waiting' };
    }
  }

  saveState() {
    localStorage.setItem('aifilms-state', JSON.stringify(this.currentState));
  }

  broadcast(type, payload) {
    this.currentState = { ...this.currentState, ...payload };
    this.saveState();
    this.channel.postMessage({ type, payload });

    if (this.listeners.has(type)) {
      this.listeners.get(type).forEach(callback => callback(payload));
    }
  }

  on(type, callback) {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, []);
    }
    this.listeners.get(type).push(callback);
  }

  getState() {
    return this.currentState;
  }

  getCurrentReel() {
    const state = this.getState();
    return MOCK_REELS[state.reelIndex] || MOCK_REELS[0];
  }

  getConnectedDevices() {
    return this.connectedDevices;
  }

  getSupabase() {
    return null;
  }
}

// ============================================
// LOCAL VOTE STORE (Fallback)
// ============================================

class LocalVoteStore {
  constructor() {
    this.storageKey = 'aifilms-votes';
  }

  getVotes() {
    try {
      const saved = localStorage.getItem(this.storageKey);
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  }

  async saveVote(reelId, score, voterType = 'audience') {
    const votes = this.getVotes();
    const voterId = localStorage.getItem('aifilms-voter-id') || 'local-voter';

    if (!votes[reelId]) {
      votes[reelId] = [];
    }

    const existingIndex = votes[reelId].findIndex(v => v.voterId === voterId);
    const voteData = { voterId, score, voterType, timestamp: Date.now() };

    if (existingIndex >= 0) {
      votes[reelId][existingIndex] = voteData;
    } else {
      votes[reelId].push(voteData);
    }

    localStorage.setItem(this.storageKey, JSON.stringify(votes));
    return voteData;
  }

  async getMyVote(reelId) {
    const votes = this.getVotes();
    const voterId = localStorage.getItem('aifilms-voter-id') || 'local-voter';
    const vote = (votes[reelId] || []).find(v => v.voterId === voterId);
    return vote ? vote.score : null;
  }

  async hasVoted(reelId) {
    const vote = await this.getMyVote(reelId);
    return vote !== null;
  }

  async getReelStats(reelId) {
    const votes = this.getVotes();
    const reelVotes = votes[reelId] || [];

    const audienceVotes = reelVotes.filter(v => v.voterType === 'audience');
    const judgeVotes = reelVotes.filter(v => v.voterType === 'judge');

    const avgAudience = audienceVotes.length > 0
      ? audienceVotes.reduce((sum, v) => sum + v.score, 0) / audienceVotes.length
      : 0;

    const avgJudge = judgeVotes.length > 0
      ? judgeVotes.reduce((sum, v) => sum + v.score, 0) / judgeVotes.length
      : 0;

    let finalScore = 0;
    if (judgeVotes.length > 0 && audienceVotes.length > 0) {
      finalScore = (avgJudge * 10 * 0.6) + (avgAudience * 0.4);
    } else if (judgeVotes.length > 0) {
      finalScore = avgJudge * 10;
    } else if (audienceVotes.length > 0) {
      finalScore = avgAudience;
    }

    return {
      audienceCount: audienceVotes.length,
      judgeCount: judgeVotes.length,
      audienceAvg: avgAudience,
      judgeAvg: avgJudge,
      finalScore,
      totalVotes: reelVotes.length
    };
  }

  async getAllStats() {
    const results = [];
    for (const reel of MOCK_REELS) {
      const stats = await this.getReelStats(reel.id);
      results.push({ ...reel, stats });
    }
    return results.sort((a, b) => b.stats.finalScore - a.stats.finalScore);
  }

  async clearAll() {
    localStorage.removeItem(this.storageKey);
  }
}

// ============================================
// EXPORTS
// ============================================

if (!window.AIFilms) {
  const deviceManager = new DeviceManager();
  const syncInstance = SYNC_MODE === 'supabase' ? new SupabaseSync() : new LocalSync();
  const voteStoreInstance = SYNC_MODE === 'supabase'
    ? new VoteStore(syncInstance, deviceManager)
    : new LocalVoteStore();

  window.AIFilms = {
    sync: syncInstance,
    voteStore: voteStoreInstance,
    deviceManager: deviceManager,
    MOCK_REELS,
    SYNC_MODE,
    ready: SYNC_MODE === 'local'
  };

  // For Supabase, register device and mark ready after connection
  if (SYNC_MODE === 'supabase') {
    syncInstance.on('connected', async () => {
      // Register this device
      await deviceManager.registerWithSupabase(syncInstance.getSupabase());
      window.AIFilms.ready = true;
      window.dispatchEvent(new Event('aifilms-ready'));
    });
  }
}
