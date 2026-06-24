import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';

export interface GuideItem {
  icon: string;
  title: string;
  subtitle: string;
}

@Component({
  selector: 'app-car-detection',
  imports: [CommonModule, RouterModule],
  templateUrl: './car-detection.html',
  styleUrl: './car-detection.css',
})
export class CarDetection {
  
}