(function () {
  const rp = (window.ratpack = window.ratpack || {});

  const createQueue = (maxConcurrent) => {
    const limit = Math.max(1, maxConcurrent || 1);
    const pending = [];
    let active = 0;

    const drain = () => {
      while (active < limit && pending.length > 0) {
        const task = pending.shift();
        active++;
        task().finally(() => {
          active--;
          drain();
        });
      }
    };

    const add = (fn) =>
      new Promise((resolve, reject) => {
        const run = () =>
          Promise.resolve()
            .then(() => fn())
            .then(resolve, reject);
        pending.push(run);
        drain();
      });

    return {
      add,
      get size() {
        return pending.length;
      },
      get active() {
        return active;
      },
    };
  };

  const defaultMax = (rp && rp.config && rp.config.maxConcurrentFetches) || 3;
  const defaultQueue = createQueue(defaultMax);

  rp.throttle = { createQueue, defaultQueue };
})();