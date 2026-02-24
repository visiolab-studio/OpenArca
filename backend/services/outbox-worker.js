const db = require("../db");
const {
  outboxWorkerPollMs,
  outboxWorkerBatchSize,
  outboxWorkerMaxAttempts,
  outboxWorkerProcessingTimeoutMs,
  outboxWorkerRetryBaseMs,
  outboxWorkerRetryMaxMs,
  outboxWorkerAlertPendingThreshold,
  outboxWorkerAlertOldestPendingAgeSeconds,
  outboxWorkerAlertStuckProcessingThreshold,
  outboxWorkerAlertFailedThreshold
} = require("../config");

function normalizeStringError(error) {
  if (!error) return "unknown_error";
  if (typeof error === "string" && error.trim()) return error.trim().slice(0, 1000);
  if (error && typeof error.message === "string" && error.message.trim()) {
    return error.message.trim().slice(0, 1000);
  }
  return "unknown_error";
}

function getRetryDelayMs({ attempt, retryBaseMs, retryMaxMs }) {
  const safeAttempt = Math.max(1, Number(attempt) || 1);
  const exponential = retryBaseMs * Math.pow(2, safeAttempt - 1);
  return Math.min(retryMaxMs, exponential);
}

function addMillisecondsToIso(isoValue, milliseconds) {
  const baseMs = Date.parse(isoValue);
  if (!Number.isFinite(baseMs)) {
    return new Date(Date.now() + milliseconds).toISOString();
  }
  return new Date(baseMs + milliseconds).toISOString();
}

function isThresholdExceeded(metric, threshold) {
  const safeMetric = Number(metric) || 0;
  const safeThreshold = Number(threshold) || 0;
  if (safeThreshold <= 0) {
    return false;
  }
  return safeMetric >= safeThreshold;
}

function createOutboxWorkerService(options = {}) {
  const database = options.db || db;
  const logger = options.logger || console;
  const nowProvider = options.nowProvider || (() => new Date().toISOString());
  const processEvent =
    typeof options.processEvent === "function"
      ? options.processEvent
      : () => ({ delivered: false, reason: "handler_not_configured" });
  const pollMs = Math.max(1000, Number(options.pollMs) || outboxWorkerPollMs);
  const batchSize = Math.max(1, Math.min(100, Number(options.batchSize) || outboxWorkerBatchSize));
  const maxAttempts = Math.max(1, Number(options.maxAttempts) || outboxWorkerMaxAttempts);
  const processingTimeoutMs = Math.max(
    1000,
    Number(options.processingTimeoutMs) || outboxWorkerProcessingTimeoutMs
  );
  const retryBaseMs = Math.max(500, Number(options.retryBaseMs) || outboxWorkerRetryBaseMs);
  const retryMaxMs = Math.max(retryBaseMs, Number(options.retryMaxMs) || outboxWorkerRetryMaxMs);
  const alertPendingThreshold = Math.max(
    0,
    Number(options.alertPendingThreshold ?? outboxWorkerAlertPendingThreshold) || 0
  );
  const alertOldestPendingAgeSeconds = Math.max(
    0,
    Number(options.alertOldestPendingAgeSeconds ?? outboxWorkerAlertOldestPendingAgeSeconds) || 0
  );
  const alertStuckProcessingThreshold = Math.max(
    0,
    Number(options.alertStuckProcessingThreshold ?? outboxWorkerAlertStuckProcessingThreshold) || 0
  );
  const alertFailedThreshold = Math.max(
    0,
    Number(options.alertFailedThreshold ?? outboxWorkerAlertFailedThreshold) || 0
  );

  const runtime = {
    timer: null,
    inProgress: false,
    metrics: {
      ticks_total: 0,
      processed_total: 0,
      succeeded_total: 0,
      retried_total: 0,
      dead_letter_total: 0,
      recovered_stuck_total: 0,
      last_tick_at: null,
      last_error: null
    }
  };

  const selectDuePending = database.prepare(
    `SELECT
       o.id,
       o.event_id,
       o.event_name,
       o.payload_json,
       o.attempts,
       o.next_attempt_at,
       e.aggregate_type,
       e.aggregate_id,
       e.actor_user_id,
       e.source
     FROM event_outbox o
     JOIN domain_events e ON e.id = o.event_id
     WHERE o.status = 'pending'
       AND datetime(o.next_attempt_at) <= datetime(?)
     ORDER BY datetime(o.created_at) ASC
     LIMIT ?`
  );

  const lockAsProcessing = database.prepare(
    `UPDATE event_outbox
     SET status = 'processing',
         updated_at = datetime('now')
     WHERE id = ?
       AND status = 'pending'`
  );

  const recoverStuckProcessing = database.prepare(
    `UPDATE event_outbox
     SET status = 'pending',
         next_attempt_at = ?,
         updated_at = datetime('now')
     WHERE status = 'processing'
       AND datetime(updated_at) <= datetime(?)`
  );

  const markAsSent = database.prepare(
    `UPDATE event_outbox
     SET status = 'sent',
         processed_at = datetime('now'),
         last_error = NULL,
         updated_at = datetime('now')
     WHERE id = ?`
  );

  const markAsRetryPending = database.prepare(
    `UPDATE event_outbox
     SET status = 'pending',
         attempts = ?,
         next_attempt_at = ?,
         last_error = ?,
         updated_at = datetime('now')
     WHERE id = ?`
  );

  const markAsFailed = database.prepare(
    `UPDATE event_outbox
     SET status = 'failed',
         attempts = ?,
         next_attempt_at = ?,
         last_error = ?,
         updated_at = datetime('now')
     WHERE id = ?`
  );

  const claimDueEntries = database.transaction((nowIso) => {
    const entries = selectDuePending.all(nowIso, batchSize);
    const claimed = [];

    for (const entry of entries) {
      const lock = lockAsProcessing.run(entry.id);
      if (lock.changes === 1) {
        claimed.push(entry);
      }
    }

    return claimed;
  });

  const recoverStuckEntries = database.transaction((nowIso) => {
    const staleThresholdIso = addMillisecondsToIso(nowIso, -processingTimeoutMs);
    const result = recoverStuckProcessing.run(nowIso, staleThresholdIso);
    return Number(result?.changes) || 0;
  });

  function getQueueStats() {
    const rows = database
      .prepare(
        `SELECT status, COUNT(*) AS count
         FROM event_outbox
         GROUP BY status`
      )
      .all();

    const byStatus = {};
    for (const row of rows) {
      byStatus[String(row.status || "")] = Number(row.count) || 0;
    }

    const nowIso = nowProvider();
    const dueNowRow = database
      .prepare(
        `SELECT COUNT(*) AS count
         FROM event_outbox
         WHERE status = 'pending'
           AND datetime(next_attempt_at) <= datetime(?)`
      )
      .get(nowIso);

    const oldestPendingRow = database
      .prepare(
        `SELECT created_at
         FROM event_outbox
         WHERE status = 'pending'
         ORDER BY datetime(created_at) ASC
         LIMIT 1`
      )
      .get();

    const staleThresholdIso = addMillisecondsToIso(nowIso, -processingTimeoutMs);
    const stuckProcessingRow = database
      .prepare(
        `SELECT COUNT(*) AS count
         FROM event_outbox
         WHERE status = 'processing'
           AND datetime(updated_at) <= datetime(?)`
      )
      .get(staleThresholdIso);

    const totalRow = database.prepare("SELECT COUNT(*) AS count FROM event_outbox").get();
    const nowMs = Date.parse(nowIso);
    const oldestPendingMs = Date.parse(String(oldestPendingRow?.created_at || ""));
    const oldestPendingAgeSeconds =
      Number.isFinite(nowMs) && Number.isFinite(oldestPendingMs)
        ? Math.max(0, Math.floor((nowMs - oldestPendingMs) / 1000))
        : 0;

    return {
      total: Number(totalRow?.count) || 0,
      due_now: Number(dueNowRow?.count) || 0,
      oldest_pending_age_seconds: oldestPendingAgeSeconds,
      stuck_processing: Number(stuckProcessingRow?.count) || 0,
      pending: Number(byStatus.pending) || 0,
      processing: Number(byStatus.processing) || 0,
      sent: Number(byStatus.sent) || 0,
      failed: Number(byStatus.failed) || 0
    };
  }

  function getRuntimeMetrics() {
    return {
      is_running: runtime.timer != null,
      ...runtime.metrics
    };
  }

  function getHealthSnapshot(queue) {
    const flags = {
      pending_backlog_high: isThresholdExceeded(queue.pending, alertPendingThreshold),
      pending_age_high: isThresholdExceeded(
        queue.oldest_pending_age_seconds,
        alertOldestPendingAgeSeconds
      ),
      stuck_processing_high: isThresholdExceeded(
        queue.stuck_processing,
        alertStuckProcessingThreshold
      ),
      failed_items_high: isThresholdExceeded(queue.failed, alertFailedThreshold)
    };

    const warnings = Object.entries(flags)
      .filter(([, value]) => value)
      .map(([key]) => key);

    return {
      status: warnings.length > 0 ? "warning" : "ok",
      warning_count: warnings.length,
      warnings,
      flags,
      thresholds: {
        pending: alertPendingThreshold,
        oldest_pending_age_seconds: alertOldestPendingAgeSeconds,
        stuck_processing: alertStuckProcessingThreshold,
        failed: alertFailedThreshold
      }
    };
  }

  function runOnce() {
    if (runtime.inProgress) {
      return {
        skipped: true,
        reason: "tick_already_in_progress"
      };
    }

    runtime.inProgress = true;
    runtime.metrics.ticks_total += 1;
    runtime.metrics.last_tick_at = nowProvider();

    const summary = {
      recovered_stuck: 0,
      claimed: 0,
      succeeded: 0,
      retried: 0,
      dead_lettered: 0
    };

    try {
      const nowIso = nowProvider();
      const recoveredStuck = recoverStuckEntries(nowIso);
      summary.recovered_stuck = recoveredStuck;
      runtime.metrics.recovered_stuck_total += recoveredStuck;
      const claimed = claimDueEntries(nowIso);
      summary.claimed = claimed.length;

      for (const entry of claimed) {
        try {
          processEvent({
            outbox_id: entry.id,
            event_id: entry.event_id,
            event_name: entry.event_name,
            payload_json: entry.payload_json,
            aggregate_type: entry.aggregate_type,
            aggregate_id: entry.aggregate_id,
            actor_user_id: entry.actor_user_id,
            source: entry.source
          });

          markAsSent.run(entry.id);
          runtime.metrics.processed_total += 1;
          runtime.metrics.succeeded_total += 1;
          summary.succeeded += 1;
        } catch (error) {
          const errorMessage = normalizeStringError(error);
          const nextAttempts = (Number(entry.attempts) || 0) + 1;

          runtime.metrics.processed_total += 1;
          runtime.metrics.last_error = errorMessage;

          if (nextAttempts >= maxAttempts) {
            markAsFailed.run(nextAttempts, nowProvider(), errorMessage, entry.id);
            runtime.metrics.dead_letter_total += 1;
            summary.dead_lettered += 1;
            logger.warn?.(`[outbox-worker] moved event to dead-letter`, {
              outbox_id: entry.id,
              event_name: entry.event_name,
              attempts: nextAttempts,
              error: errorMessage
            });
            continue;
          }

          const retryDelayMs = getRetryDelayMs({
            attempt: nextAttempts,
            retryBaseMs,
            retryMaxMs
          });
          const nextAttemptAt = addMillisecondsToIso(nowProvider(), retryDelayMs);
          markAsRetryPending.run(nextAttempts, nextAttemptAt, errorMessage, entry.id);
          runtime.metrics.retried_total += 1;
          summary.retried += 1;
        }
      }

      return summary;
    } finally {
      runtime.inProgress = false;
    }
  }

  function start() {
    if (runtime.timer) {
      return false;
    }

    runtime.timer = setInterval(() => {
      try {
        runOnce();
      } catch (error) {
        runtime.metrics.last_error = normalizeStringError(error);
        logger.error?.("[outbox-worker] tick failed", error);
      }
    }, pollMs);

    if (typeof runtime.timer.unref === "function") {
      runtime.timer.unref();
    }

    return true;
  }

  function stop() {
    if (!runtime.timer) {
      return false;
    }

    clearInterval(runtime.timer);
    runtime.timer = null;
    return true;
  }

  return {
    runOnce,
    start,
    stop,
    getStats() {
      const queue = getQueueStats();
      return {
        generated_at: nowProvider(),
        queue,
        health: getHealthSnapshot(queue),
        runtime: getRuntimeMetrics(),
        config: {
          poll_ms: pollMs,
          batch_size: batchSize,
          max_attempts: maxAttempts,
          processing_timeout_ms: processingTimeoutMs,
          alert_pending_threshold: alertPendingThreshold,
          alert_oldest_pending_age_seconds: alertOldestPendingAgeSeconds,
          alert_stuck_processing_threshold: alertStuckProcessingThreshold,
          alert_failed_threshold: alertFailedThreshold,
          retry_base_ms: retryBaseMs,
          retry_max_ms: retryMaxMs
        }
      };
    }
  };
}

const outboxWorkerService = createOutboxWorkerService();

module.exports = {
  createOutboxWorkerService,
  outboxWorkerService
};
