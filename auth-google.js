/**
 * AIFilms Google OAuth Authentication Module
 * MANDATORY login - users must sign in with Google before voting
 */

class GoogleAuthManager {
  constructor(supabase, deviceManager) {
    this.supabase = supabase;
    this.deviceManager = deviceManager;
    this.currentUser = null;
    this.isAuthenticated = false;
  }

  async init() {
    // Check for existing session
    const { data: { session } } = await this.supabase.auth.getSession();

    if (session) {
      console.log('✅ Existing session found:', session.user.email);
      this.currentUser = session.user;
      this.isAuthenticated = true;
      await this.registerAndLinkUser(session.user);
      this.hideLoginScreen();
      this.updateUI(); // Update button after session restore
      return true;
    }

    // Listen for auth changes
    this.supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('🔄 Auth state changed:', event);

      if (session) {
        this.currentUser = session.user;
        this.isAuthenticated = true;
        await this.registerAndLinkUser(session.user);
        this.hideLoginScreen();
        this.updateUI(); // Update button after sign in
      } else {
        this.currentUser = null;
        this.isAuthenticated = false;
        this.showLoginScreen();
        this.updateUI(); // Reset button on sign out
      }
    });

    // No session - show login screen
    this.showLoginScreen();
    return false;
  }

  async registerAndLinkUser(user) {
    console.log('🔐 Registering user with Supabase:', user.email);

    try {
      // Ensure device is registered first
      let voterId = this.deviceManager.getVoterId();

      if (!voterId) {
        console.log('📝 No voter ID found, registering new device...');

        // Register new voter
        const voterData = await this.deviceManager.registerWithSupabase(
          this.supabase,
          false, // is_judge
          null   // judge_name
        );

        if (!voterData) {
          console.error('❌ Device registration failed!');
          throw new Error('Failed to register device with database');
        }

        voterId = voterData.id;
        console.log('✅ Device registered with voter ID:', voterId);
      } else {
        console.log('✅ Existing voter ID found:', voterId);
      }

      // Verify voterId is set in deviceManager
      this.deviceManager.voterId = voterId;
      localStorage.setItem('aifilms-voter-id', voterId);

      // Link email to voter record with email_verified flag
      console.log('🔗 Linking email to voter record...');

      // First check if email already linked
      const { data: existingVoter } = await this.supabase
        .from('voters')
        .select('email, auth_user_id')
        .eq('id', voterId)
        .single();

      if (existingVoter?.email === user.email) {
        console.log('✅ Email already linked - skipping update');
        console.log('✅ Authentication complete - ready to vote!');
        return existingVoter;
      }

      // Update email if not already set
      const linkResult = await this.supabase
        .from('voters')
        .update({
          email: user.email,
          email_verified: true, // Google OAuth emails are verified
          auth_user_id: user.id,
          last_seen_at: new Date().toISOString()
        })
        .eq('id', voterId)
        .select()
        .single();

      if (linkResult.error) {
        console.error('❌ Email linking failed:', linkResult.error);
        // Don't throw - email conflict is OK, continue anyway
        console.log('⚠️ Continuing despite email link error...');
      } else {
        console.log('✅ User linked to device successfully:', linkResult.data);
      }

      console.log('✅ Authentication complete - ready to vote!');
      return linkResult.data || existingVoter;
    } catch (err) {
      console.error('❌ Registration/linking error:', err);
      this.showError('Failed to complete sign-in. Please refresh and try again.');
      throw err;
    }
  }

  async signInWithGoogle() {
    try {
      const { data, error } = await this.supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: 'https://isfreels.vercel.app/vote.html',
          queryParams: {
            access_type: 'offline',
            prompt: 'consent'
          }
        }
      });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Google sign-in error:', error);
      this.showError('Failed to sign in with Google. Please try again.');
      throw error;
    }
  }

  async signOut() {
    await this.supabase.auth.signOut();
    this.currentUser = null;
    this.isAuthenticated = false;
    this.showLoginScreen();
  }

  showLoginScreen() {
    let loginScreen = document.getElementById('mandatory-login-screen');

    if (!loginScreen) {
      loginScreen = document.createElement('div');
      loginScreen.id = 'mandatory-login-screen';
      loginScreen.innerHTML = `
        <div class="login-screen-backdrop"></div>
        <div class="login-screen-content">
          <div class="login-logo">
            <img src="ISF%20logos_2.png" alt="ISF Logo" onerror="this.style.display='none'">
          </div>

          <h1>Sign In Required</h1>
          <p class="login-subtitle">Sign in with Google to participate in voting</p>

          <button id="googleSignInBtn" class="google-signin-btn">
            <svg width="20" height="20" viewBox="0 0 48 48">
              <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
              <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
              <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
              <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
            </svg>
            Sign in with Google
          </button>

          <div id="loginError" class="login-error"></div>

          <p class="login-note">
            📧 We collect your email and name for event management purposes only.
          </p>
        </div>
      `;

      document.body.appendChild(loginScreen);

      // Add event listener
      document.getElementById('googleSignInBtn').addEventListener('click', () => {
        this.signInWithGoogle();
      });
    }

    loginScreen.style.display = 'flex';
  }

  hideLoginScreen() {
    const loginScreen = document.getElementById('mandatory-login-screen');
    if (loginScreen) {
      loginScreen.style.display = 'none';
    }
  }

  showError(message) {
    const errorDiv = document.getElementById('loginError');
    if (errorDiv) {
      errorDiv.textContent = message;
      errorDiv.style.display = 'block';
    }
  }

  updateUI() {
    const btn = document.getElementById('authBtn');
    if (!btn) {
      console.warn('⚠️ Auth button not found in DOM');
      return;
    }

    if (this.currentUser) {
      // Hide the button completely after login - it's not needed
      btn.style.display = 'none';
      console.log('✅ Auth button hidden - user logged in:', this.currentUser.email);
    } else {
      // Show button when not logged in (but this should never happen since login is mandatory)
      btn.style.display = 'block';
      btn.textContent = 'Sign In';
      btn.style.background = 'rgba(255, 255, 255, 0.1)';
      btn.onclick = null;
    }
  }

  canVote() {
    const hasAuth = this.isAuthenticated;
    const hasVoterId = this.deviceManager.getVoterId() !== null;

    if (!hasAuth) {
      console.warn('⚠️ Cannot vote: User not authenticated');
    }
    if (!hasVoterId) {
      console.warn('⚠️ Cannot vote: No voter ID found');
    }

    return hasAuth && hasVoterId;
  }

  getUser() {
    return this.currentUser;
  }

  async verifySetup() {
    const voterId = this.deviceManager.getVoterId();
    if (!voterId) {
      console.error('❌ Voter ID is null - setup incomplete!');
      return false;
    }

    // Verify voter exists in database
    const { data, error } = await this.supabase
      .from('voters')
      .select('id, email, auth_user_id, email_verified')
      .eq('id', voterId)
      .single();

    if (error || !data) {
      console.error('❌ Voter not found in database:', error);
      return false;
    }

    console.log('✅ Voter verified in database:', data);
    return true;
  }
}

window.GoogleAuthManager = GoogleAuthManager;
