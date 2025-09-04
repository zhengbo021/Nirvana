declare global {
  function get<T>(serviceClass: new (...args: any[]) => T): T;
  function comment(runner: () => void): void;
}
export {};
