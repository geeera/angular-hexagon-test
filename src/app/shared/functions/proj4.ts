import proj4 from 'proj4';

const epsg3857 = 'EPSG:3857';
const epsg4326 = 'EPSG:4326';

export function convertToEPSG4326(coords: any, fromType?: string) {
  return proj4(fromType || epsg3857, epsg4326, coords);
}

export function convertToEPSG3857(coords: any, fromType?: string) {
  return proj4(fromType ||  epsg4326, epsg3857, coords);
}
