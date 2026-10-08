/** Runs at most `limit` async jobs at a time, the rest in FIFO order. */
export function createScheduler(limit: number) {
  let running = 0
  const queue: (() => void)[] = []
  const next = () => {
    running--
    queue.shift()?.()
  }
  return {
    run<T>(job: () => Promise<T>): Promise<T> {
      return new Promise<T>((resolve, reject) => {
        const start = () => {
          running++
          job().then(resolve, reject).finally(next)
        }
        if (running < limit) start()
        else queue.push(start)
      })
    },
    get running() {
      return running
    },
    get queued() {
      return queue.length
    },
  }
}
