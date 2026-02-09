/**
 * AIFilms Magic Link Authentication Module
 * Integrates Supabase Auth with existing device-based system
 */

class AuthManager {
  constructor(supabase, deviceManager) {
    this.supabase = supabase;
    this.deviceManager = deviceManager;
    this.currentUser = null;
  }

  async init() {
    const { data: { session } } = await this.supabase.auth.getSession();

    if (session) {
      this.currentUser = session.user;
      await this.linkAuthToDevice(session.user);
    }

    this.supabase.auth.onAuthStateChange(async (event, session) => {
      if (session) {
        this.currentUser = session.user;
        await this.linkAuthToDevice(session.user);
      } else {
        this.currentUser = null;
      }
      this.updateUI();
    });
  }

  async linkAuthToDevice(user) {
    const voterId = this.deviceManager.getVoterId();
    if (!voterId) return;

    await this.supabase
      .from('voters')
      .update({
        email: user.email,
        email_verified: user.email_confirmed_at !== null,
        auth_user_id: user.id,
        last_seen_at: new Date().toISOString()
      })
      .eq('id', voterId);
  }

  async signInWithMagicLink(email) {
    const { data, error } = await this.supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: window.location.origin + '/vote.html'
      }
    });

    if (error) throw error;
    return data;
  }

  async signOut() {
    await this.supabase.auth.signOut();
    this.currentUser = null;
    this.updateUI();
  }

  showAuthModal() {
    const modal = document.createElement('div');
    modal.id = 'auth-modal';
    modal.innerHTML = `
      <div class="auth-modal-backdrop" onclick="this.parentElement.remove()"></div>
      <div class="auth-modal-content">
        <button class="auth-close" onclick="this.closest('#auth-modal').remove()">×</button>

        <h2>Save Your Progress</h2>
        <p>Sign in to keep your votes safe across devices</p>

        <form id="magicLinkForm">
          <input type="email" id="authEmail" placeholder="your@email.com" required>
          <button type="submit">Send Magic Link</button>
        </form>

        <div id="authStatus"></div>
      </div>
    `;

    document.body.appendChild(modal);

    const form = document.getElementById('magicLinkForm');
    const emailInput = document.getElementById('authEmail');
    const status = document.getElementById('authStatus');

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = emailInput.value;

      try {
        status.textContent = 'Sending magic link...';
        status.className = 'auth-status info';

        await this.signInWithMagicLink(email);

        status.textContent = '✓ Check your email! Click the link to sign in.';
        status.className = 'auth-status success';

        setTimeout(() => modal.remove(), 3000);
      } catch (error) {
        status.textContent = '✗ Error: ' + error.message;
        status.className = 'auth-status error';
      }
    });
  }

  updateUI() {
    const btn = document.getElementById('authBtn');
    if (!btn) return;

    if (this.currentUser) {
      btn.textContent = this.currentUser.email.split('@')[0];
      btn.onclick = () => this.signOut();
    } else {
      btn.textContent = 'Sign In';
      btn.onclick = () => this.showAuthModal();
    }
  }
}

window.AuthManager = AuthManager;
