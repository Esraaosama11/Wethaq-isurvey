import { Routes } from '@angular/router';
import { CarDetection } from './pages/car-detection/car-detection';
import { CameraPreview } from './pages/camera-preview/camera-preview';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'car-detection',
    pathMatch: 'full'
  },
  {
    path: 'car-detection',
    component: CarDetection
  },
  {
    path: 'camera-preview',
    component: CameraPreview
  }
];