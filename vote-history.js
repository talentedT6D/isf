/**
 * AIFilms Vote History Component
 * Shows user's voting history across reels in the current category
 * Collapsible UI with voted/missed status
 */

class VoteHistory {
  constructor(voteStore, reels) {
    this.voteStore = voteStore;
    this.reels = reels;
    this.currentReelId = null;
    this.isExpanded = false;
    this.cachedHistory = null;
  }

  setCurrentReel(reelId) {
    if (this.currentReelId !== reelId) {
      // Clear cache when reel changes
      this.cachedHistory = null;
    }
    this.currentReelId = reelId;
  }

  async fetchHistory() {
    // Return cached data if available and current reel hasn't changed
    if (this.cachedHistory && this.cachedHistory.currentReelId === this.currentReelId) {
      return this.cachedHistory.data;
    }

    const history = [];

    // Find current reel index first
    const currentIndex = this.reels.findIndex(r => r.id === this.currentReelId);

    // Only fetch votes for reels up to current (not all 50)
    const reelsToFetch = currentIndex >= 0
      ? this.reels.slice(0, currentIndex + 1)
      : this.reels;

    // Batch fetch votes only for visible reels
    for (const reel of reelsToFetch) {
      const vote = await this.voteStore.getMyVote(reel.id);
      history.push({
        reel: reel,
        voted: vote !== null,
        score: vote,
        isCurrent: reel.id === this.currentReelId
      });
    }

    // Cache the results
    this.cachedHistory = {
      currentReelId: this.currentReelId,
      data: history
    };

    return history;
  }

  async render(containerId) {
    this.lastContainerId = containerId;
    const container = document.getElementById(containerId);
    if (!container) return;

    const history = await this.fetchHistory();
    const votedCount = history.filter(h => h.voted).length;

    // Find current reel index
    const currentIndex = history.findIndex(h => h.isCurrent);

    // Only count PAST reels as missed (before current reel)
    // If current reel not found (currentIndex = -1), don't count any missed
    const missedCount = currentIndex >= 0
      ? history.filter((h, idx) => {
          return !h.voted && !h.isCurrent && idx < currentIndex;
        }).length
      : 0;

    // Only show reels up to and including current reel (not future reels)
    const visibleHistory = currentIndex >= 0 ? history.slice(0, currentIndex + 1) : [];

    container.innerHTML = `
      <button class="history-toggle" onclick="voteHistory.toggle()">
        <span class="toggle-text">${this.isExpanded ? '▼' : '▶'} Vote History</span>
        <span class="toggle-stats">${votedCount} voted${missedCount > 0 ? ' · ' + missedCount + ' missed' : ''}</span>
      </button>

      <div class="history-list" style="display: ${this.isExpanded ? 'block' : 'none'}">
        ${visibleHistory.map(item => this.renderItem(item)).join('')}
      </div>
    `;
  }

  renderItem(item) {
    const { reel, voted, score, isCurrent } = item;

    let statusClass = 'missed';
    let statusText = 'Missed';
    let scoreDisplay = '—';

    if (isCurrent) {
      statusClass = 'current';
      statusText = 'Voting Now';
      scoreDisplay = voted ? score : '—';
    } else if (voted) {
      statusClass = 'voted';
      statusText = '✓ Voted';
      scoreDisplay = score;
    }

    return `
      <div class="history-item ${statusClass}">
        <div class="history-number">${reel.number}</div>
        <div class="history-info">
          <div class="history-name">${reel.contestant}</div>
          <div class="history-category">${reel.category}</div>
        </div>
        <div class="history-score ${statusClass}">
          <span class="score-value">${scoreDisplay}</span>
          <span class="score-label">${statusText}</span>
        </div>
      </div>
    `;
  }

  toggle() {
    this.isExpanded = !this.isExpanded;

    const container = document.getElementById(this.lastContainerId);
    if (!container) return;

    // Just toggle visibility without re-rendering
    const toggleBtn = container.querySelector('.history-toggle .toggle-text');
    const historyList = container.querySelector('.history-list');

    if (toggleBtn) {
      toggleBtn.textContent = `${this.isExpanded ? '▼' : '▶'} Vote History`;
    }

    if (historyList) {
      historyList.style.display = this.isExpanded ? 'block' : 'none';
    }
  }

  async refresh() {
    // Clear cache to force re-fetch
    this.cachedHistory = null;
    if (this.lastContainerId) {
      await this.render(this.lastContainerId);
    }
  }
}

window.VoteHistory = VoteHistory;
