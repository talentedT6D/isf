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

// ============================================
// FETCH REELS FROM DATABASE
// ============================================

async function fetchReels(supabase) {
  try {
    const { data, error } = await supabase
      .from('reels')
      .select('*')
      .eq('is_active', true)
      .order('category')
      .order('reel_number');

    if (error || !data) {
      console.error('Failed to fetch reels:', error);
      return [];
    }

    return data.map(function(r) {
      return {
        id: r.id,
        number: r.reel_number,
        contestant: r.contestant_name,
        category: r.category,
        duration: r.duration_seconds,
        thumbnail: r.thumbnail_icon,
        videoUrl: r.video_url
      };
    });
  } catch (err) {
    console.error('Fetch reels error:', err);
    return [];
  }
}

function deriveCategories(reels) {
  var cats = [];
  reels.forEach(function(r) {
    if (cats.indexOf(r.category) === -1) cats.push(r.category);
  });
  return cats;
}

// ============================================
// DEVICE MANAGER - Unique device tracking
// ============================================

class DeviceManager {
  constructor() {
    this.deviceId = this.getOrCreateDeviceId();
    this.deviceType = this.detectDeviceType();
    this.voterId = localStorage.getItem('aifilms-voter-id') || null; // Load from localStorage
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

  async registerWithSupabase(supabase, isJudge = false, judgeName = null, name = null, tokenId = null) {
    try {
      const payload = {
        device_id: this.deviceId,
        device_type: this.deviceType,
        is_judge: isJudge,
        judge_name: judgeName,
        last_seen_at: new Date().toISOString()
      };
      if (name) payload.name = name;
      if (tokenId) payload.token_id = tokenId;

      const { data, error } = await supabase
        .from('voters')
        .upsert(payload, {
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

  async linkEmail(supabase, email, authUserId) {
    if (!this.voterId) return null;

    try {
      const { data, error } = await supabase
        .from('voters')
        .update({
          email: email,
          auth_user_id: authUserId,
          last_seen_at: new Date().toISOString()
        })
        .eq('id', this.voterId)
        .select()
        .single();

      if (error) {
        console.error('Error linking email:', error);
        return null;
      }

      return data;
    } catch (err) {
      console.error('Email link failed:', err);
      return null;
    }
  }

  async recoverFromEmail(supabase, email) {
    try {
      // Find voter by email
      const { data, error } = await supabase
        .from('voters')
        .select('*')
        .eq('email', email)
        .single();

      if (error || !data) {
        console.error('No voter found with email:', email);
        return null;
      }

      // Update local storage with recovered voter
      this.voterId = data.id;
      localStorage.setItem('aifilms-voter-id', data.id);
      localStorage.setItem('aifilms-device-id', this.deviceId);

      return data;
    } catch (err) {
      console.error('Recovery failed:', err);
      return null;
    }
  }
}

// ============================================
// TOKEN AUTH MANAGER - Token-based access control
// ============================================

class TokenAuthManager {
  constructor(deviceManager) {
    this.deviceManager = deviceManager;
    this._authenticated = false;
    this._tokenData = null;
  }

  async validateToken(supabase, tokenString) {
    if (!supabase) return { valid: false, error: 'Not connected to server' };
    if (!tokenString || !tokenString.trim()) return { valid: false, error: 'Please enter a token' };

    try {
      const trimmed = tokenString.trim().toUpperCase();
      console.log('Validating token:', trimmed);

      // Add timeout to prevent hanging
      const timeout = new Promise(function(resolve) {
        setTimeout(function() { resolve({ data: null, error: { message: 'Request timed out' } }); }, 8000);
      });

      const query = supabase
        .from('tokens')
        .select('*')
        .eq('token', trimmed)
        .single();

      const { data, error } = await Promise.race([query, timeout]);
      console.log('Token query result:', { found: !!data, error: error?.message });

      if (error || !data) return { valid: false, error: 'Invalid token' };

      const currentDeviceId = this.deviceManager.deviceId;

      // Token already used on a different device
      if (data.is_used && data.device_id && data.device_id !== currentDeviceId) {
        return { valid: false, error: 'Token already used on another device' };
      }

      // Bind token to device on first use
      if (!data.is_used) {
        await supabase
          .from('tokens')
          .update({
            is_used: true,
            device_id: currentDeviceId,
            used_at: new Date().toISOString()
          })
          .eq('id', data.id);
      }

      // Register voter with name from token
      const voterData = await this.deviceManager.registerWithSupabase(
        supabase,
        data.token_type === 'judge',
        data.token_type === 'judge' ? data.person_name : null,
        data.person_name,
        data.id
      );

      if (voterData) {
        // Link voter to token
        await supabase
          .from('tokens')
          .update({ voter_id: voterData.id })
          .eq('id', data.id);
      }

      this._authenticated = true;
      this._tokenData = data;

      // Store in localStorage for session persistence
      localStorage.setItem('aifilms-token', trimmed);
      localStorage.setItem('aifilms-token-data', JSON.stringify(data));

      return { valid: true, tokenData: data };
    } catch (err) {
      console.error('Token validation failed:', err);
      return { valid: false, error: 'Validation error' };
    }
  }

  async restoreSession(supabase) {
    const savedToken = localStorage.getItem('aifilms-token');
    if (!savedToken) return false;

    const result = await this.validateToken(supabase, savedToken);
    return result.valid;
  }

  isAuthenticated() { return this._authenticated; }
  getTokenData() { return this._tokenData; }
  getPersonName() { return this._tokenData?.person_name || null; }
  getCategory() { return this._tokenData?.category || null; }
  getTokenType() { return this._tokenData?.token_type || null; }

  logout() {
    this._authenticated = false;
    this._tokenData = null;
    localStorage.removeItem('aifilms-token');
    localStorage.removeItem('aifilms-token-data');
  }
}

// ============================================
// SUPABASE SYNC - Real-time + Database
// ============================================

class SupabaseSync {
  constructor() {
    this.listeners = new Map();
    this.currentState = { reelId: null, status: 'waiting' };
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
        .on('broadcast', { event: 'category-change' }, ({ payload }) => {
          console.log('Category changed:', payload.category);
          if (this.listeners.has('category-change')) {
            this.listeners.get('category-change').forEach(cb => cb(payload));
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
    const reels = window.AIFilms ? window.AIFilms.reels : [];
    if (state.reelId) {
      return reels.find(r => r.id === state.reelId) || reels[0] || null;
    }
    return reels[0] || null;
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

  async saveVote(reelId, score, voterType = 'audience', voterName = null, category = null) {
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
      const payload = {
        reel_id: reelId,
        voter_id: voterId,
        score: score,
        voter_type: voterType,
        updated_at: new Date().toISOString()
      };
      if (voterName) payload.voter_name = voterName;
      if (category) payload.category = category;

      const { data, error } = await supabase
        .from('votes')
        .upsert(payload, {
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
        .maybeSingle();

      if (error) {
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
        .maybeSingle();

      if (error) {
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

  async getAllStats(categoryFilter = null) {
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

      // Merge with reel data, optionally filter by category
      let reels = window.AIFilms ? window.AIFilms.reels : [];
      if (categoryFilter) {
        reels = reels.filter(r => r.category === categoryFilter);
      }

      return reels.map(reel => {
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
      return saved ? JSON.parse(saved) : { reelId: null, status: 'waiting' };
    } catch {
      return { reelId: null, status: 'waiting' };
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
    const reels = window.AIFilms ? window.AIFilms.reels : [];
    if (state.reelId) {
      return reels.find(r => r.id === state.reelId) || reels[0] || null;
    }
    return reels[0] || null;
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
      finalScore = (avgJudge * 0.5) + (avgAudience * 0.5);
    } else if (judgeVotes.length > 0) {
      finalScore = avgJudge;
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
    const reels = window.AIFilms ? window.AIFilms.reels : [];
    const results = [];
    for (const reel of reels) {
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
  const tokenAuth = new TokenAuthManager(deviceManager);
  const syncInstance = SYNC_MODE === 'supabase' ? new SupabaseSync() : new LocalSync();
  const voteStoreInstance = SYNC_MODE === 'supabase'
    ? new VoteStore(syncInstance, deviceManager)
    : new LocalVoteStore();

  window.AIFilms = {
    sync: syncInstance,
    voteStore: voteStoreInstance,
    deviceManager: deviceManager,
    tokenAuth: tokenAuth,
    reels: [],
    categories: [],
    SYNC_MODE,
    ready: SYNC_MODE === 'local',
    findReel: function(reelId) {
      return window.AIFilms.reels.find(function(r) { return r.id === reelId; }) || null;
    }
  };

  // For Supabase, register device, fetch reels, and mark ready after connection
  if (SYNC_MODE === 'supabase') {
    syncInstance.on('connected', async () => {
      // Register this device
      await deviceManager.registerWithSupabase(syncInstance.getSupabase());
      // Try to restore token session
      await tokenAuth.restoreSession(syncInstance.getSupabase());
      // Fetch reels from database
      const reels = await fetchReels(syncInstance.getSupabase());
      window.AIFilms.reels = reels;
      window.AIFilms.categories = deriveCategories(reels);
      console.log('Loaded', reels.length, 'reels in', window.AIFilms.categories.length, 'categories');
      window.AIFilms.ready = true;
      window.dispatchEvent(new Event('aifilms-ready'));
    });
  }
}
