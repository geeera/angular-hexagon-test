/// <reference types="@types/google.maps" />
import {
  AfterViewInit,
  Component,
  ElementRef,
  inject,
  OnDestroy,
  OnInit,
  ViewChild,
} from '@angular/core';
import {environment} from '../../../../environments/environment';

import centroid from '@turf/centroid';
import {Feature, MapData, MapService} from '../../../core/services/map/map.service';
import {firstValueFrom} from 'rxjs';
import * as h3 from 'h3-js'
import { HexWorkerResult, WorkerPool } from '../../worker/worker-pool';
import {IndexDB} from '../../../core/store/index-db';

const DEFAULT_ZOOM = 7;
const MAX_DEFAULT_ZOOM = 16;

const zoomToResolution: { [zoom: number]: number } = {
  0: 0,
  1: 1,
  2: 2,
  3: 2,
  4: 3,
  5: 3,
  6: 4,
  7: 4,
  8: 5,
  9: 5,
  10: 6,
  11: 6,
  12: 7,
  13: 7,
  14: 8,
  15: 9,
  16: 10,
  17: 11,
  18: 12,
  19: 13,
  20: 14
};

@Component({
  selector: 'hx-map',
  imports: [],
  templateUrl: './map.component.html',
  styleUrl: './map.component.scss',
  standalone: true
})
export class MapComponent implements AfterViewInit, OnDestroy {
  private mapService = inject(MapService);
  private indexDB = inject(IndexDB);
  private pool: WorkerPool = new WorkerPool();
  @ViewChild('mapContainer', { static: false }) mapContainer!: ElementRef;

  private map!: google.maps.Map;
  private hexPolygons: google.maps.Polygon[] = [];

  private currentZoom = DEFAULT_ZOOM;
  // private currentMapBounds: LatLngBounds | undefined;
  private currentResolution: number = this.getResolutionForZoom(DEFAULT_ZOOM);

  ngAfterViewInit() {
    this.loadGoogleMapsApiScript(environment.googleMapsApiKey, async () => {
      const geojsonData = await firstValueFrom(this.mapService.loadPolygonData());
      this.initMap(geojsonData);
    });
  }

  private getResolutionForZoom(zoom: number): number {
    return zoomToResolution[zoom]
  }

  async updateHexagons(map: google.maps.Map, features: Feature[], resolution: number) {
    if (!map) {
      return
    }
    this.clearHexPolygons();
    // const bounds = map.getBounds();
    // const ne = bounds?.getNorthEast();
    // const sw = bounds?.getSouthWest();

    // const visibleFeatures = features.filter(f => {
    //   return this.mapService.updatedCoords(f.geometry.coordinates, ([lat, lng]) => {
    //     if (sw && ne) {
    //       return lat >= sw.lat() && lat <= ne.lat() && lng >= sw.lng() && lng <= ne.lng()
    //     }
    //     return true
    //   })
    //   }
    // );

    for (const feature of features) {
      const cacheKey = `feature-${feature.id}-${resolution}`;
      const cached = await firstValueFrom(this.indexDB.getFromDB$(cacheKey));
      if (cached) {
        this.drawHexes(cached);
        continue;
      }

      const result: HexWorkerResult = await this.pool.run({
        ringSet: feature.geometry.coordinates,
        resolution,
        polygonColor: feature.properties.COLOR_HEX
      });

      this.drawHexes(result);
      await firstValueFrom(this.indexDB.setToDB$(cacheKey, result));
    }
  }

  drawHexes(data: HexWorkerResult) {
    if (data.cellIds?.length) {
      const cellIds: string[] = data.cellIds;
      this.renderHexagons(cellIds, (polygonPath) => {
        const polygon = new google.maps.Polygon({
          paths: polygonPath,
          strokeColor: data.polygonColor ? `#${data.polygonColor}` : '#FF0000',
          strokeWeight: 1,
          fillColor: data.polygonColor ? `#${data.polygonColor}` : '#FFAAAA',
          fillOpacity: 0.5,
          map: this.map,
        });
        this.hexPolygons.push(polygon);
      });
    }
  }

  renderHexagons(cellIds: string[], func: (path: { lat: number, lng: number }[]) => void) {
    if (!cellIds?.length) {
      return;
    }

    cellIds.forEach(cellId => {
      const boundary = h3.cellToBoundary(cellId);
      const path = boundary.map(([lat, lng]) => ({lat, lng}));

      func(path);
    });
  }

  initMap(data: MapData) {
    console.log('Initializing Map...');
    if ('google' in window) {
      // @ts-ignore
      const feature = centroid(data);
      const center = {
        lat: feature.geometry.coordinates[0],
        lng: feature.geometry.coordinates[1],
      }
      console.log('Center', center)
      this.map = new google.maps.Map(this.mapContainer.nativeElement, {
        center: center,
        zoom: DEFAULT_ZOOM,
        maxZoom: MAX_DEFAULT_ZOOM,
        streetViewControl: false,
        mapTypeControl: false,
        fullscreenControl: false,
        noClear: false
      });

      const resolution = this.getResolutionForZoom(this.map?.getZoom() || DEFAULT_ZOOM)

      this.updateHexagons(this.map, data.features, resolution);

      this.map.addListener('zoom_changed', () => {
        const zoom = this.map?.getZoom() || DEFAULT_ZOOM;
        const updatedResolution = this.getResolutionForZoom(zoom)
        const isResolutionChanged = this.currentResolution !== updatedResolution
        if (zoom !== this.currentZoom && isResolutionChanged) {
          this.currentZoom = zoom;
          this.currentResolution = updatedResolution;

          this.updateHexagons(this.map, data.features, updatedResolution);
        }
      });

      // const throttledUpdatedHexagons = throttle(this.updateHexagons.bind(this), 500);
      // this.currentMapBounds = this.map.getBounds();
      //
      // this.map.addListener("bounds_changed", () => {
      //   const updatedMapBounds = this.map.getBounds();
      //   if (this.currentMapBounds && JSON.stringify(this.currentMapBounds) !== JSON.stringify(updatedMapBounds)) {
      //     console.log('bounds_changed');
      //     const zoom = this.map?.getZoom() || DEFAULT_ZOOM;
      //     const updatedResolution = this.getResolutionForZoom(zoom)
      //     throttledUpdatedHexagons(this.map, data.features, updatedResolution);
      //     this.currentMapBounds = updatedMapBounds;
      //   }
      // });
    }
  }

  private loadGoogleMapsApiScript(apiKey: string, onLoad: () => void) {
    if (!(window as any).google) {
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}`;
      script.async = true;
      script.defer = true;
      script.onload = onLoad;
      document.body.appendChild(script);
    } else {
      onLoad();
    }
  }

  clearHexPolygons() {
    this.hexPolygons.forEach(p => p.setMap(null));
    this.hexPolygons = [];
  }

  ngOnDestroy() {
    this.clearHexPolygons();
    this.pool.destroyWorkers();
    this.indexDB.closeDB();
  }
}
