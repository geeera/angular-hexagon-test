/// <reference lib="webworker" />
import * as h3 from 'h3-js';
import {Feature} from './app/core/services/map/map.service';

console.log('Init Worker');

addEventListener('error', (e) => {
  console.error('Worker internal error:', e);
});

addEventListener('message', async ({ data }) => {
  const { ringSet, resolution, polygonColor } = data;

  try {
    const allCellIds: string[] = [];
    const rings = ringSet as Feature['geometry']['coordinates'];
    rings.forEach((polygon) => {
      const cellIds = h3.polygonToCellsExperimental(polygon, resolution, h3.POLYGON_TO_CELLS_FLAGS.containmentOverlappingBbox);
      allCellIds.push(...cellIds);
    })


    // const uniqueCellIds = Array.from(new Set(allCellIds));
    const result = {
      cellIds: allCellIds,
      fromCache: false,
      polygonColor: polygonColor
    }
    postMessage(result);
  } catch (e: any) {
    postMessage({ error: e.message || e.toString() });
  }
});
