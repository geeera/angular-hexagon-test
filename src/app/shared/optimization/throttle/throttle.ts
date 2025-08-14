export function throttle<T extends (...args: any[]) => void>(fn: T, limit: number) {
  let inThrottle = false;
  return function (this: ThisParameterType<T>, ...args: Parameters<T>): ReturnType<T> | void {
    if (!inThrottle) {
      inThrottle = true;
      const result = fn.apply(this, args);
      setTimeout(() => (inThrottle = false), limit);
      return result;
    }
  };
}
