import {inject, Injectable} from '@angular/core';
// import data from '../../../../../data/data.json';
import {map} from 'rxjs';
import {HttpClient} from '@angular/common/http';
import { convertToEPSG4326 } from '../../../shared/functions/proj4';

export interface Feature {
  type: string,
  id?: string,
  properties: { COLOR_HEX: string, ID: number },
  geometry: {
    type: 'MultiPolygon' | 'Polygon',
    crs: {
      type: string,
      properties: {
        name: "urn:ogc:def:crs:EPSG::3857"
      }
    },
    coordinates: number[][][][]
  }
}

export interface MapData {
  type: string,
  features: Feature[]
}

@Injectable({
  providedIn: 'root'
})
export class MapService {
  private http = inject(HttpClient);

  constructor() { }

  loadPolygonData() {
    const dataFromGitHub$ = this.http.get<MapData>('https://raw.githubusercontent.com/gis-point/angular-hexagon-test/refs/heads/main/data.json')
    return dataFromGitHub$.pipe(
      map((data) => {
        const features = data.features
        const updatedFeatures = features.map((feature: Feature, idx) => {
          const coordinatesType = feature.geometry.crs.properties.name
          const validCoordinates = this.convertCoordsNested(feature.geometry.coordinates, coordinatesType);
          return {
            ...feature,
            id: `feature-${idx}`,
            geometry: {
              ...feature.geometry,
              coordinates: validCoordinates,
            }
          }
        });
        return {
          ...data,
          features: updatedFeatures
        }
      })
    )
  }

  private convertCoordsNested(coords: any, fromType?: string): any {
    return this.updatedCoords(coords, (nestedCoords: [number, number]) => {
      const [lat, lng] = nestedCoords;
      return convertToEPSG4326([lng, lat], fromType);
    })
  }

  updatedCoords(coords: any, fc: (v: any) => void) {
    if (Array.isArray(coords) && coords.length === 2 && typeof coords[0] === "number" && typeof coords[1] === "number") {
      return fc(coords);
    }

    if (Array.isArray(coords)) {
      return coords.map(c => this.convertCoordsNested(c));
    }

    return coords;
  }
}
