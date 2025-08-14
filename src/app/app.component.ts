import {AfterViewInit, Component} from '@angular/core';
import {environment} from '../environments/environment';
import {MapComponent} from './shared/modules/map/map.component';

@Component({
  selector: 'app-root',
  imports: [
    MapComponent
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent {

}
