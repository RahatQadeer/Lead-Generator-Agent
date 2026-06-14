export type Vec3 = [number, number, number];

export const MIN_ROT_X = -35;
export const MAX_ROT_X = 35;

export function fibonacciSphere(count: number): Vec3[] {
  const points: Vec3[] = [];
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));

  for (let i = 0; i < count; i++) {
    const y = 1 - (i / Math.max(count - 1, 1)) * 2;
    const radiusAtY = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = goldenAngle * i;
    points.push([
      Math.cos(theta) * radiusAtY,
      y,
      Math.sin(theta) * radiusAtY,
    ]);
  }

  return points;
}

export function buildGeodesicWireframe(subdivisions = 2) {
  const phi = (1 + Math.sqrt(5)) / 2;
  const verts: Vec3[] = [
    [-1, phi, 0],
    [1, phi, 0],
    [-1, -phi, 0],
    [1, -phi, 0],
    [0, -1, phi],
    [0, 1, phi],
    [0, -1, -phi],
    [0, 1, -phi],
    [phi, 0, -1],
    [phi, 0, 1],
    [-phi, 0, -1],
    [-phi, 0, 1],
  ].map(([x, y, z]) => {
    const len = Math.hypot(x, y, z);
    return [x / len, y / len, z / len] as Vec3;
  });

  const faces = [
    [0, 11, 5],
    [0, 5, 1],
    [0, 1, 7],
    [0, 7, 10],
    [0, 10, 11],
    [1, 5, 9],
    [5, 11, 4],
    [11, 10, 2],
    [10, 7, 6],
    [7, 1, 8],
    [3, 9, 4],
    [3, 4, 2],
    [3, 2, 6],
    [3, 6, 8],
    [3, 8, 9],
    [4, 9, 5],
    [2, 4, 11],
    [6, 2, 10],
    [8, 6, 7],
    [9, 8, 1],
  ];

  const cache = new Map<string, number>();

  const midpoint = (a: number, b: number) => {
    const key = a < b ? `${a}-${b}` : `${b}-${a}`;
    if (cache.has(key)) return cache.get(key)!;

    const va = verts[a];
    const vb = verts[b];
    const x = (va[0] + vb[0]) / 2;
    const y = (va[1] + vb[1]) / 2;
    const z = (va[2] + vb[2]) / 2;
    const len = Math.hypot(x, y, z);
    const index = verts.length;
    verts.push([x / len, y / len, z / len]);
    cache.set(key, index);
    return index;
  };

  let currentFaces = faces;
  for (let s = 0; s < subdivisions; s++) {
    const next: number[][] = [];
    for (const [a, b, c] of currentFaces) {
      const ab = midpoint(a, b);
      const bc = midpoint(b, c);
      const ca = midpoint(c, a);
      next.push([a, ab, ca], [b, bc, ab], [c, ca, bc], [ab, bc, ca]);
    }
    currentFaces = next;
  }

  const edgeSet = new Set<string>();
  const edges: [number, number][] = [];

  for (const [a, b, c] of currentFaces) {
    for (const [i, j] of [
      [a, b],
      [b, c],
      [c, a],
    ] as [number, number][]) {
      const key = i < j ? `${i}-${j}` : `${j}-${i}`;
      if (!edgeSet.has(key)) {
        edgeSet.add(key);
        edges.push([i, j]);
      }
    }
  }

  return { verts, edges };
}

export type SphereGraphSize = "sm" | "md" | "lg" | "xl";

export function getSphereRadius(
  containerWidth: number,
  size: SphereGraphSize = "sm"
) {
  if (size === "xl") {
    return Math.max(130, Math.min(220, Math.floor(containerWidth / 2) - 8));
  }
  if (size === "lg") {
    return Math.max(72, Math.min(112, Math.floor(containerWidth / 2) - 16));
  }
  if (size === "md") {
    return Math.max(58, Math.min(90, Math.floor(containerWidth / 2) - 14));
  }
  return Math.max(40, Math.min(56, Math.floor(containerWidth / 2) - 10));
}

export function clampRotX(value: number) {
  return Math.max(MIN_ROT_X, Math.min(MAX_ROT_X, value));
}

export function projectPoint(
  point: Vec3,
  radius: number,
  rotXDeg: number,
  rotYDeg: number
) {
  const x0 = point[0] * radius;
  const y0 = point[1] * radius;
  const z0 = point[2] * radius;

  const rotY = (rotYDeg * Math.PI) / 180;
  const rotX = (rotXDeg * Math.PI) / 180;
  const cosY = Math.cos(rotY);
  const sinY = Math.sin(rotY);
  const cosX = Math.cos(rotX);
  const sinX = Math.sin(rotX);

  const x1 = x0 * cosY + z0 * sinY;
  const z1 = -x0 * sinY + z0 * cosY;
  const y1 = y0;

  const y2 = y1 * cosX - z1 * sinX;
  const z2 = y1 * sinX + z1 * cosX;

  return { x: x1, y: y2, z: z2 };
}

export function depthFromZ(z: number, radius: number) {
  return Math.max(0, Math.min(1, (z + radius) / (2 * radius)));
}
