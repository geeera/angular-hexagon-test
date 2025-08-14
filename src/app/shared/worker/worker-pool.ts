export interface HexWorkerResult {
  cellIds: string[],
  fromCache: boolean,
  polygonColor: string
}

interface Queue {
  data: any;
  resolve: Function;
  reject: Function
}

export class WorkerPool {
  private workers: Worker[] = [];
  private queues: Queue[] = [];
  private busyWorkers: Set<Worker> = new Set();

  constructor() {
    // console.log('Worker Pool Init');
   this.initWorkers()
  }

  initWorkers(): void {
    const workerSize = Math.max(
      2,
      navigator.hardwareConcurrency ? Math.min(4, navigator.hardwareConcurrency - 1) : 2
    )
    for (let i = 0; i < workerSize; i++) {
      // console.log('Before worker creation');
      const worker = new Worker(new URL('../../../h3.worker.ts', import.meta.url), { type: 'module' });

      worker.onmessage = (e) => {
        // console.log('on message', e)
        this.handleResult(worker, e.data)
      };
      worker.onerror = (e) => this.handleErrorResult(worker, e);

      this.workers.push(worker);
    }
  }

  private handleResult(worker: Worker, data: any) {
    // console.log('handleResult')
    this.busyWorkers.delete(worker);
    const currentTask = this.queues[this.queues.length - 1];
    currentTask?.resolve(data);
    const task = this.queues.shift();
    if (task) {
      this.runTask(worker, task, true);
    } else {
      this.cleanup(worker)
    }
  }

  private handleErrorResult(worker: Worker, e: any) {
    // console.log('handleErrorResult', e)
    const task = this.queues.shift();
    if (task) {
      task.reject(e);
    }
    this.cleanup(worker);
  }

  cleanup(worker: Worker) {
    // console.log('Cleanup');
    this.busyWorkers.delete(worker);
    const next = this.queues.shift();
    if (next) this.runTask(worker, next);
  };

  cleanupAllWorkers() {
    this.busyWorkers.clear();
    this.queues.forEach(q => q.resolve(null))
    this.queues = [];
  }

  private runTask(worker: Worker, task: { data: any; resolve: Function; reject: Function }, fromQueses = false ) {
    // console.log('Run task', worker)
    const { data, resolve, reject } = task;
    this.busyWorkers.add(worker);
    if (!fromQueses) {
      this.queues.push(task);
    }
    worker.postMessage(data);
  }

  run<T, D>(data: D): Promise<T> {
    // console.log('Run')
    return new Promise((resolve, reject) => {
      const freeWorker = this.workers.find(w => !this.busyWorkers.has(w));
      if (freeWorker) {
        this.runTask(freeWorker, { data, resolve, reject });
      } else {
        this.queues.push({ data, resolve, reject });
      }
    });
  }

  destroyWorkers() {
    this.workers.forEach((worker) => {
      worker.onmessage = null;
      worker.onerror = null;
      worker.terminate();
    })
    this.workers = [];
  }
}
