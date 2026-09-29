import type { ShapeBounds, ZoneShape } from "../types/ticket.types";

type ArcShape = Extract<ZoneShape, { kind: "arc" }>;

export interface Point {
  x: number;
  y: number;
}

export interface SeatPosition extends Point {
  row: number; // 0 = fila mas cercana al centro del arco
  number: number; // 1..seatsPerRow
  rotation: number;
}

const SEAT_ANGLE_MARGIN = 0.04; // margen a cada lado del arco, como fraccion del angulo total
const SEAT_MIN_PITCH = 14; // distancia minima entre centros de asientos (unidades del viewBox)

const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
const round = (value: number) => Math.round(value * 100) / 100;

export function pointOnCircle(cx: number, cy: number, radius: number, angle: number): Point {
  const radians = toRadians(angle);
  return { x: round(cx + radius * Math.cos(radians)), y: round(cy + radius * Math.sin(radians)) };
}

function arcPath(shape: ArcShape): string {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle } = shape;
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
  const outerStart = pointOnCircle(cx, cy, outerRadius, startAngle);
  const outerEnd = pointOnCircle(cx, cy, outerRadius, endAngle);
  const innerEnd = pointOnCircle(cx, cy, innerRadius, endAngle);
  const innerStart = pointOnCircle(cx, cy, innerRadius, startAngle);
  return [
    `M ${outerStart.x} ${outerStart.y}`,
    `A ${outerRadius} ${outerRadius} 0 ${largeArc} 1 ${outerEnd.x} ${outerEnd.y}`,
    `L ${innerEnd.x} ${innerEnd.y}`,
    `A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${innerStart.x} ${innerStart.y}`,
    "Z",
  ].join(" ");
}

function rectPath({
  x,
  y,
  width,
  height,
  radius = 0,
}: Extract<ZoneShape, { kind: "rect" }>): string {
  const r = Math.min(radius, width / 2, height / 2);
  return [
    `M ${x + r} ${y}`,
    `H ${x + width - r}`,
    `Q ${x + width} ${y} ${x + width} ${y + r}`,
    `V ${y + height - r}`,
    `Q ${x + width} ${y + height} ${x + width - r} ${y + height}`,
    `H ${x + r}`,
    `Q ${x} ${y + height} ${x} ${y + height - r}`,
    `V ${y + r}`,
    `Q ${x} ${y} ${x + r} ${y}`,
    "Z",
  ].join(" ");
}

// Atributo "d" del <path> de la zona.
export function getShapePath(shape: ZoneShape): string {
  return shape.kind === "arc" ? arcPath(shape) : rectPath(shape);
}

// Punto para la etiqueta de la zona.
export function getShapeCenter(shape: ZoneShape): Point {
  if (shape.kind === "rect") {
    return { x: shape.x + shape.width / 2, y: shape.y + shape.height / 2 };
  }
  const angle = (shape.startAngle + shape.endAngle) / 2;
  return pointOnCircle(shape.cx, shape.cy, (shape.innerRadius + shape.outerRadius) / 2, angle);
}

export function getShapeBounds(shape: ZoneShape): ShapeBounds {
  if (shape.kind === "rect") {
    return { x: shape.x, y: shape.y, width: shape.width, height: shape.height };
  }
  const points: Point[] = [];
  const steps = Math.max(8, Math.ceil(shape.endAngle - shape.startAngle));
  for (let step = 0; step <= steps; step += 1) {
    const angle = shape.startAngle + ((shape.endAngle - shape.startAngle) * step) / steps;
    points.push(pointOnCircle(shape.cx, shape.cy, shape.innerRadius, angle));
    points.push(pointOnCircle(shape.cx, shape.cy, shape.outerRadius, angle));
  }
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  return { x: minX, y: minY, width: Math.max(...xs) - minX, height: Math.max(...ys) - minY };
}

// Posiciones de asientos: en arcos, filas = radios (de adentro hacia afuera) y asientos repartidos
// en el angulo; las filas interiores (arco mas corto) llevan menos asientos, como en un teatro real.
// En rectangulos, grilla de arriba hacia abajo.
export function layoutSeats(shape: ZoneShape, rows: number, seatsPerRow: number): SeatPosition[] {
  const positions: SeatPosition[] = [];
  for (let row = 0; row < rows; row += 1) {
    if (shape.kind === "rect") {
      for (let seat = 0; seat < seatsPerRow; seat += 1) {
        positions.push({
          row,
          number: seat + 1,
          x: round(shape.x + ((seat + 0.5) * shape.width) / seatsPerRow),
          y: round(shape.y + ((row + 0.5) * shape.height) / rows),
          rotation: 0,
        });
      }
      continue;
    }
    const span = shape.endAngle - shape.startAngle;
    const margin = span * SEAT_ANGLE_MARGIN;
    const usableSpan = span - 2 * margin;
    const radius =
      shape.innerRadius + ((row + 0.5) * (shape.outerRadius - shape.innerRadius)) / rows;
    const arcLength = radius * toRadians(usableSpan);
    const seatsInRow = Math.max(1, Math.min(seatsPerRow, Math.floor(arcLength / SEAT_MIN_PITCH)));
    for (let seat = 0; seat < seatsInRow; seat += 1) {
      const angle = shape.startAngle + margin + ((seat + 0.5) * usableSpan) / seatsInRow;
      positions.push({
        row,
        number: seat + 1,
        ...pointOnCircle(shape.cx, shape.cy, radius, angle),
        rotation: round(angle + 90),
      });
    }
  }
  return positions;
}
