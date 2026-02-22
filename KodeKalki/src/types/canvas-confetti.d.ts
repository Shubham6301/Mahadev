declare module 'canvas-confetti' {
  interface ConfettiOptions {
    particleCount?: number;
    angle?: number;
    spread?: number;
    startVelocity?: number;
    decay?: number;
    gravity?: number;
    drift?: number;
    flat?: boolean;
    ticks?: number;
    origin?: { x?: number; y?: number };
    colors?: string[];
    shapes?: ('square' | 'circle')[];
    zIndex?: number;
    disableForReducedMotion?: boolean;
  }

  type ConfettiFunction = (options?: ConfettiOptions) => void;

  const confetti: ConfettiFunction & {
    create: (canvas: HTMLCanvasElement, options?: { resize?: boolean; useWorker?: boolean }) => ConfettiFunction;
  };

  export default confetti;
}