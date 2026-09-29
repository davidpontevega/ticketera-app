import { cn } from "@/lib/utils";

export interface DecorativeQrProps {
  seed: string;
  className?: string;
}

const SIZE = 21;
const FINDER_SIZE = 7;
const FINDER_ORIGINS = [
  [0, 0],
  [0, SIZE - FINDER_SIZE],
  [SIZE - FINDER_SIZE, 0],
] as const;

function seededRandom(seed: string): () => number {
  let state = [...seed].reduce((acc, char) => (acc * 31 + char.charCodeAt(0)) >>> 0, 7) || 1;
  return () => {
    state = (state * 9301 + 49297) % 233280;
    return state / 233280;
  };
}

// null = modulo libre (lo decide el random); true/false = parte de una marca de esquina.
function finderCell(row: number, col: number): boolean | null {
  for (const [originRow, originCol] of FINDER_ORIGINS) {
    const r = row - originRow;
    const c = col - originCol;
    if (r >= -1 && r <= FINDER_SIZE && c >= -1 && c <= FINDER_SIZE) {
      const inside = r >= 0 && r < FINDER_SIZE && c >= 0 && c < FINDER_SIZE;
      const ring = r === 0 || r === FINDER_SIZE - 1 || c === 0 || c === FINDER_SIZE - 1;
      const core = r >= 2 && r <= 4 && c >= 2 && c <= 4;
      return inside && (ring || core);
    }
  }
  return null;
}

// Patron con forma de QR (21x21 con las tres marcas de esquina). Decorativo: no es un QR escaneable.
export function DecorativeQr({ seed, className }: DecorativeQrProps) {
  const random = seededRandom(seed);
  const cells: [number, number][] = [];
  for (let row = 0; row < SIZE; row += 1) {
    for (let col = 0; col < SIZE; col += 1) {
      const finder = finderCell(row, col);
      if (finder ?? random() > 0.52) cells.push([row, col]);
    }
  }

  return (
    <svg
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      aria-hidden
      shapeRendering="crispEdges"
      className={cn("bg-white", className)}
    >
      {cells.map(([row, col]) => (
        <rect
          key={`${row}-${col}`}
          x={col}
          y={row}
          width={1}
          height={1}
          className="fill-foreground"
        />
      ))}
    </svg>
  );
}
