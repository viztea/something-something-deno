export interface Interval {
    start: (duration: number, callback: () => void) => number;
    stop: () => void;
}

export function interval(): Interval {
    let id: number;
    return {
        start: (duration, callback) => id = setInterval(callback, duration),
        stop: () => clearInterval(id),
    };
}
