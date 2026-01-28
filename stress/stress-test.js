#!/usr/bin/env node

/**
 * AIFilms Synchronization Stress Test
 *
 * Tests: 1 control panel + 10 voting screens
 * Validates: All voting screens stay synchronized with control panel
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:8080';
const NUM_VOTERS = 10;
const REEL_CHANGE_DELAY = 3000; // 3 seconds between reel changes
const LOG_DIR = path.join(__dirname, 'stress-test-logs');

// Ensure log directory exists
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const logFile = path.join(LOG_DIR, `stress-test-${timestamp}.log`);
const syncLogFile = path.join(LOG_DIR, `sync-state-${timestamp}.json`);

let syncStates = {
  controlPanel: { currentReel: 0, timestamp: Date.now() },
  voters: {}
};

function log(message, type = 'INFO') {
  const entry = `[${new Date().toISOString()}] [${type}] ${message}`;
  console.log(entry);
  fs.appendFileSync(logFile, entry + '\n');
}

function saveSyncState() {
  fs.writeFileSync(syncLogFile, JSON.stringify(syncStates, null, 2));
}

function runBrowserCommand(session, command, description) {
  return new Promise((resolve, reject) => {
    log(`[${session}] Running: ${command}`, 'CMD');

    const proc = spawn('agent-browser', ['--session', session, ...command.split(' ')], {
      shell: true
    });

    let output = '';
    let error = '';

    proc.stdout.on('data', (data) => {
      output += data.toString();
    });

    proc.stderr.on('data', (data) => {
      error += data.toString();
    });

    proc.on('close', (code) => {
      if (code === 0) {
        log(`[${session}] ✓ ${description}`, 'SUCCESS');
        resolve(output);
      } else {
        log(`[${session}] ✗ ${description} (code: ${code})`, 'ERROR');
        if (error) log(`[${session}] Error: ${error}`, 'ERROR');
        reject(new Error(`Command failed with code ${code}`));
      }
    });

    setTimeout(() => {
      log(`[${session}] Command timeout: ${command}`, 'WARN');
      proc.kill();
      reject(new Error('Command timeout'));
    }, 30000); // 30 second timeout
  });
}

async function getCurrentReel(session) {
  try {
    const output = await runBrowserCommand(
      session,
      'get text "#reelCounter"',
      'Get current reel counter'
    );

    // Parse "Reel X of 10" to get X
    const match = output.match(/Reel (\d+) of/);
    if (match) {
      return parseInt(match[1]);
    }
    return null;
  } catch (err) {
    log(`[${session}] Failed to get current reel: ${err.message}`, 'ERROR');
    return null;
  }
}

async function checkConnectionStatus(session) {
  try {
    const output = await runBrowserCommand(
      session,
      'get attr "#connectionIndicator" "class"',
      'Check connection indicator'
    );

    if (output.includes('disconnected')) return 'disconnected';
    if (output.includes('reconnecting')) return 'reconnecting';
    return 'connected';
  } catch (err) {
    log(`[${session}] Failed to check connection: ${err.message}`, 'ERROR');
    return 'unknown';
  }
}

async function initControlPanel() {
  const session = 'control-panel';
  log(`Initializing control panel...`, 'INIT');

  try {
    await runBrowserCommand(session, `open ${BASE_URL}/control.html`, 'Open control panel');
    await runBrowserCommand(session, 'wait 3000', 'Wait for page load');

    // Take screenshot
    await runBrowserCommand(
      session,
      `screenshot ${LOG_DIR}/control-panel-init.png`,
      'Screenshot control panel'
    );

    log(`Control panel initialized`, 'SUCCESS');
    return session;
  } catch (err) {
    log(`Failed to initialize control panel: ${err.message}`, 'ERROR');
    throw err;
  }
}

async function initVoter(voterId) {
  const session = `voter-${voterId}`;
  log(`Initializing voter ${voterId}...`, 'INIT');

  try {
    await runBrowserCommand(session, `open ${BASE_URL}/vote.html`, 'Open voting page');
    await runBrowserCommand(session, 'wait 3000', 'Wait for page load');

    syncStates.voters[voterId] = {
      currentReel: 0,
      connectionStatus: 'unknown',
      lastUpdate: Date.now()
    };

    log(`Voter ${voterId} initialized`, 'SUCCESS');
    return session;
  } catch (err) {
    log(`Failed to initialize voter ${voterId}: ${err.message}`, 'ERROR');
    throw err;
  }
}

async function navigateToNextReel(controlSession) {
  log(`Navigating to next reel...`, 'ACTION');

  try {
    // Click next button
    await runBrowserCommand(controlSession, 'click "#nextBtn"', 'Click next button');
    await runBrowserCommand(controlSession, 'wait 1000', 'Wait for animation');

    // Get current reel number
    const reelNum = await getCurrentReel(controlSession);
    if (reelNum !== null) {
      syncStates.controlPanel.currentReel = reelNum;
      syncStates.controlPanel.timestamp = Date.now();
      log(`Control panel now on reel ${reelNum}`, 'INFO');
    }

    saveSyncState();
    return reelNum;
  } catch (err) {
    log(`Failed to navigate: ${err.message}`, 'ERROR');
    return null;
  }
}

async function checkVoterSync(voterId, expectedReel) {
  const session = `voter-${voterId}`;

  try {
    const currentReel = await getCurrentReel(session);
    const connectionStatus = await checkConnectionStatus(session);

    syncStates.voters[voterId] = {
      currentReel,
      connectionStatus,
      lastUpdate: Date.now(),
      expectedReel,
      inSync: currentReel === expectedReel
    };

    if (currentReel !== expectedReel) {
      log(`❌ DESYNC: Voter ${voterId} on reel ${currentReel}, expected ${expectedReel}`, 'DESYNC');

      // Take screenshot of desync
      await runBrowserCommand(
        session,
        `screenshot ${LOG_DIR}/desync-voter-${voterId}-reel-${currentReel}.png`,
        'Screenshot desync'
      );
    } else {
      log(`✓ Voter ${voterId} in sync (reel ${currentReel})`, 'SYNC');
    }

    if (connectionStatus !== 'connected') {
      log(`⚠ Voter ${voterId} connection status: ${connectionStatus}`, 'WARN');
    }

    saveSyncState();
    return currentReel === expectedReel;
  } catch (err) {
    log(`Failed to check voter ${voterId}: ${err.message}`, 'ERROR');
    return false;
  }
}

async function runStressTest() {
  log('='.repeat(80), 'INFO');
  log('AIFilms Synchronization Stress Test Starting', 'INFO');
  log('='.repeat(80), 'INFO');
  log(`Control Panel: 1 instance`, 'INFO');
  log(`Voting Screens: ${NUM_VOTERS} instances`, 'INFO');
  log(`Test Duration: ~${(10 * REEL_CHANGE_DELAY) / 1000} seconds`, 'INFO');
  log(`Log File: ${logFile}`, 'INFO');
  log(`Sync State: ${syncLogFile}`, 'INFO');
  log('='.repeat(80), 'INFO');

  try {
    // Step 1: Initialize control panel
    log('\n--- STEP 1: Initialize Control Panel ---', 'SECTION');
    const controlSession = await initControlPanel();

    // Step 2: Initialize all voters in parallel
    log('\n--- STEP 2: Initialize Voting Screens (Parallel) ---', 'SECTION');
    const voterPromises = [];
    for (let i = 1; i <= NUM_VOTERS; i++) {
      voterPromises.push(initVoter(i));
    }
    await Promise.all(voterPromises);
    log(`All ${NUM_VOTERS} voting screens initialized`, 'SUCCESS');

    // Step 3: Wait for WebSocket connections
    log('\n--- STEP 3: Wait for WebSocket Connections ---', 'SECTION');
    await new Promise(resolve => setTimeout(resolve, 5000));
    log('Connection stabilization complete', 'INFO');

    // Step 4: Navigate through reels and check sync
    log('\n--- STEP 4: Navigate Through Reels (Stress Test) ---', 'SECTION');

    for (let reelNum = 1; reelNum <= 10; reelNum++) {
      log(`\n>>> Testing Reel ${reelNum} <<<`, 'SECTION');

      // Navigate control panel
      if (reelNum > 1) {
        await navigateToNextReel(controlSession);
      } else {
        // First reel - just record state
        syncStates.controlPanel.currentReel = 1;
        syncStates.controlPanel.timestamp = Date.now();
      }

      // Wait for propagation
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Check all voters in parallel
      log(`Checking sync state of all ${NUM_VOTERS} voters...`, 'INFO');
      const syncChecks = [];
      for (let i = 1; i <= NUM_VOTERS; i++) {
        syncChecks.push(checkVoterSync(i, reelNum));
      }
      const results = await Promise.all(syncChecks);

      const inSync = results.filter(r => r).length;
      const outOfSync = results.filter(r => !r).length;

      log(`\n📊 Sync Results for Reel ${reelNum}:`, 'SUMMARY');
      log(`   ✓ In Sync: ${inSync}/${NUM_VOTERS}`, 'SUMMARY');
      log(`   ✗ Out of Sync: ${outOfSync}/${NUM_VOTERS}`, 'SUMMARY');

      if (outOfSync > 0) {
        log(`   ⚠ ${(outOfSync / NUM_VOTERS * 100).toFixed(1)}% desync rate`, 'WARN');
      }

      // Wait before next reel
      if (reelNum < 10) {
        log(`Waiting ${REEL_CHANGE_DELAY}ms before next reel...`, 'INFO');
        await new Promise(resolve => setTimeout(resolve, REEL_CHANGE_DELAY));
      }
    }

    // Step 5: Generate final report
    log('\n--- STEP 5: Generate Final Report ---', 'SECTION');
    await generateReport();

    log('\n' + '='.repeat(80), 'INFO');
    log('Stress Test Complete!', 'SUCCESS');
    log('='.repeat(80), 'INFO');

  } catch (err) {
    log(`\nStress test failed: ${err.message}`, 'ERROR');
    log(err.stack, 'ERROR');
  } finally {
    // Cleanup: Close all browsers
    log('\nClosing all browser sessions...', 'INFO');
    try {
      spawn('agent-browser', ['--session', 'control-panel', 'close']);
      for (let i = 1; i <= NUM_VOTERS; i++) {
        spawn('agent-browser', ['--session', `voter-${i}`, 'close']);
      }
    } catch (err) {
      log(`Cleanup warning: ${err.message}`, 'WARN');
    }
  }
}

async function generateReport() {
  const report = {
    timestamp: new Date().toISOString(),
    testConfig: {
      numVoters: NUM_VOTERS,
      reelChangeDelay: REEL_CHANGE_DELAY,
      totalReels: 10
    },
    summary: {
      totalChecks: 0,
      successfulSyncs: 0,
      desyncEvents: 0,
      connectionIssues: 0
    },
    desyncDetails: []
  };

  // Analyze sync states
  for (const [voterId, state] of Object.entries(syncStates.voters)) {
    if (state.inSync !== undefined) {
      report.summary.totalChecks++;
      if (state.inSync) {
        report.summary.successfulSyncs++;
      } else {
        report.summary.desyncEvents++;
        report.desyncDetails.push({
          voterId,
          expectedReel: state.expectedReel,
          actualReel: state.currentReel,
          timestamp: state.lastUpdate
        });
      }

      if (state.connectionStatus !== 'connected') {
        report.summary.connectionIssues++;
      }
    }
  }

  report.summary.syncRate = (report.summary.successfulSyncs / report.summary.totalChecks * 100).toFixed(2) + '%';
  report.summary.desyncRate = (report.summary.desyncEvents / report.summary.totalChecks * 100).toFixed(2) + '%';

  const reportFile = path.join(LOG_DIR, `final-report-${timestamp}.json`);
  fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));

  log('\n📈 FINAL REPORT:', 'SUMMARY');
  log(`   Total Sync Checks: ${report.summary.totalChecks}`, 'SUMMARY');
  log(`   Successful Syncs: ${report.summary.successfulSyncs}`, 'SUMMARY');
  log(`   Desync Events: ${report.summary.desyncEvents}`, 'SUMMARY');
  log(`   Connection Issues: ${report.summary.connectionIssues}`, 'SUMMARY');
  log(`   Sync Rate: ${report.summary.syncRate}`, 'SUMMARY');
  log(`   Desync Rate: ${report.summary.desyncRate}`, 'SUMMARY');
  log(`\n   Full Report: ${reportFile}`, 'INFO');

  return report;
}

// Run the test
runStressTest().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
