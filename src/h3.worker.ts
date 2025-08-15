/// <reference lib="webworker" />
import * as h3 from 'h3-js';
import {Feature, MapData} from './app/core/services/map/map.service';

console.log('Init Worker');

addEventListener('error', (e) => {
  console.error('Worker internal error:', e);
});

addEventListener('message', async ({ data }) => {
  const { geo, resolution } = data;

  try {
    const features = (geo as MapData).features;
    features.forEach(feature => {
      const rings = feature.geometry.coordinates;
      rings.forEach((polygon) => {
        const cellIds = h3.polygonToCellsExperimental(polygon, resolution, h3.POLYGON_TO_CELLS_FLAGS.containmentOverlapping);

        cellIds.forEach(cellId => {
          const boundary = h3.cellToBoundary(cellId);
          const paths = boundary.map(([lat, lng]) => ({lat, lng}));

          if (JSON.stringify(paths[0]) !== JSON.stringify(paths[paths.length - 1])) {
            paths.push(paths[0])
          }

          postMessage({ paths: paths, color: feature.properties.COLOR_HEX, isClose: false });
        });
      })
    })

    postMessage({ isClose: true })
  } catch (e: any) {
    postMessage({ error: e.message || e.toString() });
  }
});
