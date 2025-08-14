/// <reference lib="webworker" />
import * as h3 from 'h3-js';

console.log('Init Worker');

addEventListener('error', (e) => {
  console.error('Worker internal error:', e);
});

addEventListener('message', async ({ data }) => {
  const { ringSet, resolution, polygonColor } = data;

  try {
    const allCellIds: string[] = [];

    ringSet.forEach((polygon: number[][]) => {
      const cellIds = h3.polygonToCellsExperimental(polygon, resolution, h3.POLYGON_TO_CELLS_FLAGS.containmentOverlapping);
      allCellIds.push(...cellIds);
    })

    const uniqueCellIds = Array.from(new Set(allCellIds));
    const result = {
      cellIds: uniqueCellIds,
      fromCache: false,
      polygonColor: polygonColor
    }
    postMessage(result);
  } catch (e: any) {
    postMessage({ error: e.message || e.toString() });
  }
});

function traverseCoordinates(coords: any[], callback: (ring: [number, number][]) => void) {
  if (!Array.isArray(coords)) return;

  if (typeof coords[0] === 'number') {
    return;
  }

  if (typeof coords[0][0] === 'number') {
    callback(coords as [number, number][]);
  } else {
    coords.forEach(c => traverseCoordinates(c, callback));
  }
}
