/* Pure run-clock state machine. No DOM or storage writes. */
const RUN_CAPTURE = (() => {
  const STATES = Object.freeze(['idle','warmup','feeding','paused','post_feed','stopped']);
  const ACTIONS = Object.freeze(['start_run','start_feed','pause','resume','feed_exhausted','stop_run','reset']);
  const clone = value => JSON.parse(JSON.stringify(value));
  const finite = value => typeof value === 'number' && Number.isFinite(value);
  const roundMin = ms => +(Math.max(0, ms) / 60000).toFixed(3);
  const iso = ms => new Date(ms).toISOString();

  function fresh() {
    return {
      version: 3,
      status: 'idle',
      runStartedAt_ms: null,
      feedStartedAt_ms: null,
      feedEndedAt_ms: null,
      stoppedAt_ms: null,
      lastTransitionAt_ms: null,
      activeFeeding_ms: 0,
      pumpOn_ms: 0,
      interruption_ms: 0,
      postFeed_ms: 0,
      stoppedFromStatus: null,
      transitions: [],
      provenance: 'timer_state_machine',
    };
  }

  function normalize(value, now = Date.now()) {
    if (finite(value) && value > 0) {
      return {
        ...fresh(), status:'feeding', runStartedAt_ms:value, feedStartedAt_ms:value,
        lastTransitionAt_ms:value, provenance:'legacy_timer_start_only',
        transitions:[{action:'start_feed',at:iso(value),runElapsed_min:0,provenance:'legacy_timer_start_only'}],
      };
    }
    if (!value || typeof value !== 'object') return fresh();
    const out = {...fresh(), ...clone(value)};
    if (!STATES.includes(out.status)) out.status = 'idle';
    for (const key of ['runStartedAt_ms','feedStartedAt_ms','feedEndedAt_ms','stoppedAt_ms','lastTransitionAt_ms']) {
      if (!finite(out[key])) out[key] = null;
    }
    for (const key of ['activeFeeding_ms','pumpOn_ms','interruption_ms','postFeed_ms']) {
      if (!finite(out[key]) || out[key] < 0) out[key] = 0;
    }
    out.transitions = Array.isArray(out.transitions) ? out.transitions.slice(-500) : [];
    if (out.status !== 'idle' && out.lastTransitionAt_ms == null) out.lastTransitionAt_ms = out.runStartedAt_ms || now;
    return out;
  }

  function accrued(value, now = Date.now()) {
    const out = normalize(value, now);
    if (['idle','stopped'].includes(out.status) || out.lastTransitionAt_ms == null) return out;
    const delta = Math.max(0, now - out.lastTransitionAt_ms);
    if (out.status === 'feeding') {
      out.activeFeeding_ms += delta;
      out.pumpOn_ms += delta;
    } else if (out.status === 'paused') out.interruption_ms += delta;
    else if (out.status === 'post_feed') out.postFeed_ms += delta;
    out.lastTransitionAt_ms = now;
    return out;
  }

  function snapshot(value, now = Date.now()) {
    const state = accrued(value, now);
    const end = state.stoppedAt_ms || (state.runStartedAt_ms == null ? null : now);
    const runElapsed = state.runStartedAt_ms == null || end == null ? null : roundMin(end - state.runStartedAt_ms);
    const activeComplete = state.feedStartedAt_ms != null && state.feedEndedAt_ms != null && ['post_feed','stopped'].includes(state.status);
    const warmupEnd = state.feedStartedAt_ms ?? end;
    const feedEnd = state.feedEndedAt_ms ?? (state.feedStartedAt_ms == null ? null : end);
    const warmupElapsed = state.runStartedAt_ms == null || warmupEnd == null ? null : roundMin(warmupEnd - state.runStartedAt_ms);
    const feedingElapsed = state.feedStartedAt_ms == null || feedEnd == null ? null : roundMin(feedEnd - state.feedStartedAt_ms);
    const phaseName = phase(state);
    const phaseElapsed = phaseName === 'warmup'
      ? warmupElapsed
      : (phaseName === 'feeding' ? feedingElapsed : (state.feedEndedAt_ms == null ? null : roundMin(state.postFeed_ms)));
    return {
      status: state.status,
      runElapsed_min: runElapsed,
      warmupElapsed_min: warmupElapsed,
      feedingElapsed_min: feedingElapsed,
      currentPhase: phaseName,
      currentPhaseElapsed_min: phaseElapsed,
      pumpOnElapsed_min: state.feedStartedAt_ms == null ? null : roundMin(state.pumpOn_ms),
      activeFeeding_min: state.feedStartedAt_ms == null ? null : roundMin(state.activeFeeding_ms),
      activeFeedingComplete: activeComplete,
      interruptionTotal_min: state.feedStartedAt_ms == null ? null : roundMin(state.interruption_ms),
      postFeedObservation_min: state.feedEndedAt_ms == null ? null : roundMin(state.postFeed_ms),
      runStartedAt: state.runStartedAt_ms == null ? null : iso(state.runStartedAt_ms),
      feedStartedAt: state.feedStartedAt_ms == null ? null : iso(state.feedStartedAt_ms),
      feedEndedAt: state.feedEndedAt_ms == null ? null : iso(state.feedEndedAt_ms),
      runStoppedAt: state.stoppedAt_ms == null ? null : iso(state.stoppedAt_ms),
      provenance: state.provenance || 'timer_state_machine',
      transitions: clone(state.transitions),
    };
  }

  function transition(value, action, now = Date.now()) {
    if (!ACTIONS.includes(action)) throw new Error('timer action ไม่รองรับ');
    if (action === 'reset') return fresh();
    let state = accrued(value, now);
    const allowed = {
      start_run: ['idle'], start_feed: ['idle','warmup'], pause: ['feeding'], resume: ['paused'],
      feed_exhausted: ['feeding','paused'], stop_run: ['warmup','feeding','paused','post_feed'],
    };
    if (!allowed[action].includes(state.status)) throw new Error(`ทำ ${action} ไม่ได้ขณะสถานะ ${state.status}`);
    if (action === 'start_run') {
      state = fresh();
      state.status = 'warmup';
      state.runStartedAt_ms = now;
    } else if (action === 'start_feed') {
      const runStartedAt = state.status === 'warmup' && state.runStartedAt_ms != null ? state.runStartedAt_ms : now;
      const transitions = state.status === 'warmup' ? state.transitions.slice() : [];
      state = fresh();
      state.status = 'feeding';
      state.runStartedAt_ms = runStartedAt;
      state.feedStartedAt_ms = now;
      state.transitions = transitions;
    } else if (action === 'pause') state.status = 'paused';
    else if (action === 'resume') state.status = 'feeding';
    else if (action === 'feed_exhausted') {
      state.status = 'post_feed';
      state.feedEndedAt_ms = now;
    } else if (action === 'stop_run') {
      state.stoppedFromStatus = state.status;
      if (state.feedStartedAt_ms != null && state.feedEndedAt_ms == null) state.feedEndedAt_ms = now;
      state.status = 'stopped';
      state.stoppedAt_ms = now;
    }
    state.lastTransitionAt_ms = now;
    const snap = snapshot(state, now);
    state.transitions.push({action,at:iso(now),runElapsed_min:snap.runElapsed_min,provenance:'timer_state_machine'});
    return state;
  }

  function phase(value) {
    const normalized = normalize(value);
    const status = normalized.status;
    if (status === 'stopped') {
      if (normalized.stoppedFromStatus === 'warmup') return 'warmup';
      if (['feeding','paused'].includes(normalized.stoppedFromStatus)) return 'feeding';
      return 'post_feed';
    }
    return status === 'feeding' || status === 'paused' ? 'feeding' : status === 'post_feed' || status === 'stopped' ? 'post_feed' : 'warmup';
  }

  // One save instant, using the SAME accrued state as the run clock. Point metadata
  // keeps milliseconds; legacy minute is only a display/export compatibility field.
  function captureMeasurement(value, {tin_C, tout_C, feedMass_g = null, segmentId = null,
    interruptionEventId = null, override = null} = {}, now = Date.now()) {
    if (!finite(now) || !finite(tin_C) || !finite(tout_C)) throw Error('ต้องกรอก Tin และ Tout ให้ครบ');
    if (tin_C < 20 || tin_C > 220 || tout_C < 20 || tout_C > 160) throw Error('ตรวจช่วง Tin 20–220°C และ Tout 20–160°C');
    if (feedMass_g !== null && (!finite(feedMass_g) || feedMass_g < 0)) throw Error('มวลต้องเป็นค่าตัวเลขตั้งแต่ 0 ขึ้นไป หรือเว้นว่าง');
    const state = accrued(value, now), currentPhase = phase(state);
    const end = state.stoppedAt_ms ?? (state.runStartedAt_ms == null ? null : now);
    const runMs = end == null ? null : Math.max(0, end - state.runStartedAt_ms);
    const phaseMs = currentPhase === 'warmup'
      ? (end == null ? null : Math.max(0, (state.feedStartedAt_ms ?? end) - state.runStartedAt_ms))
      : currentPhase === 'feeding'
        ? (state.feedStartedAt_ms == null ? null : Math.max(0, (state.feedEndedAt_ms ?? end) - state.feedStartedAt_ms))
        : (state.feedEndedAt_ms == null ? null : state.postFeed_ms);
    const systemTiming = {capturedAt_ms:now, recordedAt:iso(now), clockVersion:state.version,
      clockStatus:state.status, phase:currentPhase, segmentId:segmentId || null,
      runElapsed_ms:runMs, phaseElapsed_ms:phaseMs,
      activeFeedingElapsed_ms:state.feedStartedAt_ms == null ? null : state.activeFeeding_ms,
      interruptionTotal_ms:state.feedStartedAt_ms == null ? null : state.interruption_ms,
      postFeedObservation_ms:state.feedEndedAt_ms == null ? null : state.postFeed_ms,
      interruptionState:state.status === 'paused' ? 'active' : 'inactive',
      interruptionEventId:interruptionEventId || null, provenance:state.provenance};
    if (!override && (state.status === 'idle' || phaseMs == null)) throw Error('เริ่มนาฬิการันก่อน หรือเลือกกรอกย้อนหลังพร้อมเหตุผล');
    if (override && (!['warmup','feeding','post_feed'].includes(override.phase) ||
      !finite(override.phaseElapsed_min) || override.phaseElapsed_min < 0 || !String(override.reason || '').trim())) {
      throw Error('กรอกย้อนหลังต้องระบุช่วง เวลา และเหตุผล');
    }
    const selectedPhase = override ? override.phase : currentPhase;
    const selectedSegment = override ? (override.segmentId || null) : (segmentId || null);
    if (selectedPhase === 'feeding' && !selectedSegment) throw Error('จุด Feeding ต้องมี Segment ที่ระบุได้');
    const phaseMin = override ? override.phaseElapsed_min : phaseMs / 60000;
    const minutes = ms => ms == null ? null : ms / 60000;
    return {captureVersion:1, recordedAt:iso(now), phase:selectedPhase, segmentId:selectedSegment,
      minute:+phaseMin.toFixed(2), phaseElapsed_min:phaseMin,
      runElapsed_min:override ? null : minutes(runMs),
      activeFeedingElapsed_min:override ? null : minutes(systemTiming.activeFeedingElapsed_ms),
      interruptionState:override ? 'unknown' : systemTiming.interruptionState,
      interruptionEventId:override ? null : systemTiming.interruptionEventId,
      clockStatus:override ? null : state.status, timingProvenance:override ? 'operator_override' : state.provenance,
      measurementProvenance:'operator_entered_measurement', systemTiming,
      timeOverride:override ? {phase:override.phase, phaseElapsed_min:override.phaseElapsed_min,
        segmentId:selectedSegment, reason:String(override.reason).trim(), recordedAt:iso(now)} : null,
      tin_C, tout_C, feedMass_g};
  }

  function submissionGuard(windowMs = 750) {
    let last = null;
    return Object.freeze({
      isDuplicate(key, now) { return !!last && last.key === key && now - last.at >= 0 && now - last.at < windowMs; },
      accept(key, now) { last = {key, at:now}; },
    });
  }

  return Object.freeze({STATES,ACTIONS,fresh,normalize,accrued,snapshot,transition,phase,captureMeasurement,submissionGuard});
})();
if (typeof module !== 'undefined') module.exports = RUN_CAPTURE;
