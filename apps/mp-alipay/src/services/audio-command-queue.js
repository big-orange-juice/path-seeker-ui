const { Subject, defer, EMPTY, concatMap, tap, catchError, finalize } = require('../shared/rxjs');

function createCommandQueue(cancelled) {
  const events = new Subject(), jobs = new Set();
  let closed = false;
  const subscription = events.pipe(concatMap(job => defer(() => Promise.resolve().then(job.run)).pipe(
    tap({ next: job.resolve, error: job.reject }), catchError(() => EMPTY), finalize(() => jobs.delete(job))
  ))).subscribe();
  return {
    enqueue(run) {
      if (closed) return Promise.reject(cancelled());
      return new Promise((resolve, reject) => { const job = { run, resolve, reject }; jobs.add(job); events.next(job); });
    },
    close() {
      closed = true;
      jobs.forEach(job => job.reject(cancelled())); jobs.clear();
      subscription.unsubscribe(); events.complete();
    }
  };
}
module.exports = { createCommandQueue };
