/// <reference types="@types/google.maps" />
import {
  AfterViewInit,
  Component,
  ElementRef,
  inject,
  OnDestroy,
  ViewChild,
} from '@angular/core';
import {environment} from '../../../../environments/environment';

import centroid from '@turf/centroid';
import {MapData, MapService} from '../../../core/services/map/map.service';
import {
  debounceTime,
  filter,
  firstValueFrom,
  startWith,
  Subject,
  switchMap,
  takeUntil,
  tap
} from 'rxjs';
import { HexWorkerResult, WorkerPool } from '../../worker/worker-pool';

const DEFAULT_ZOOM = 6;
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
  private pool: WorkerPool = new WorkerPool(1);
  private _destroy$: Subject<void> = new Subject();
  @ViewChild('mapContainer', { static: false }) mapContainer!: ElementRef;

  private map!: google.maps.Map;
  private hexPolygons: google.maps.Polygon[] = [];

  private currentResolution: number = this.getResolutionForZoom(DEFAULT_ZOOM);

  ngAfterViewInit() {
    this.loadGoogleMapsApiScript(environment.googleMapsApiKey, async () => {
      const geojsonData = await firstValueFrom(this.mapService.loadPolygonData());
      const core = this.initMap(geojsonData);
      core.subs.zoomChanged$.pipe(
        startWith(null),
        takeUntil(this._destroy$),
        filter(() => {
          const resolution = this.getResolutionForZoom(this.map.getZoom() || DEFAULT_ZOOM);
          return resolution === this.currentResolution;
        }),
        tap(() => {
          this.currentResolution = this.getResolutionForZoom(this.map.getZoom() || DEFAULT_ZOOM);
          this.clearHexPolygons();
          this.pool.cleanupAllWorkers();
        }),
        debounceTime(300),
        switchMap(() => {
          const resolution = this.getResolutionForZoom(this.map.getZoom() || DEFAULT_ZOOM);
          return this.pool.run$(geojsonData, resolution).pipe(
            tap((result) => {
              if (result) {
                this.drawHexes(result as HexWorkerResult);
              }
            })
          );
        }),
      ).subscribe()
    });
  }

  private getResolutionForZoom(zoom: number): number {
    return zoomToResolution[zoom]
  }

  drawHexes(data: HexWorkerResult) {
    if (data.paths?.length) {
      const polygon = new google.maps.Polygon({
        paths: data.paths,
        strokeColor: `#${data.color}`,
        strokeWeight: 1,
        fillColor: `#${data.color}`,
        fillOpacity: 0.5,
        map: this.map,
      });
      this.hexPolygons.push(polygon);
    }
  }

  initMap(data: MapData): any {
    console.log('Initializing Map...');
    if ('google' in window) {
      // @ts-ignore
      const feature = centroid(data);
      const [lat, lng] = feature.geometry.coordinates;
      const center = {
        lat: lat,
        lng: lng,
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

      const zoomChanged$ = new Subject<void>();
      zoomChanged$.next(); // handle initial render
      this.map.addListener('zoom_changed', () => {
        zoomChanged$.next();

        return () => {
          zoomChanged$.complete();
        }
      })

      return {
        map: this.map,
        subs: {
          zoomChanged$: zoomChanged$.asObservable()
        }
      }
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
    if (this._destroy$) {
      this._destroy$.next();
      this._destroy$.complete();
      console.log('destroySub$');
    }

    this.clearHexPolygons();
    this.pool.destroyWorkers();
  }
}
