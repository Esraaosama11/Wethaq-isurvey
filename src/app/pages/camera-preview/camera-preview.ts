import { 
  Component, 
  ViewChild, 
  ElementRef, 
  OnDestroy,
  AfterViewInit
} from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-camera-preview',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './camera-preview.html',
  styleUrl: './camera-preview.css',
})
export class CameraPreview implements AfterViewInit, OnDestroy {

  @ViewChild('videoElement') videoElement!: ElementRef<HTMLVideoElement>;
  
  isActive = false;
  private stream: MediaStream | null = null;

  async ngAfterViewInit(): Promise<void> {
    await this.startCamera();
  }

  private async startCamera(): Promise<void> {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: true
      });

      this.isActive = true;

       setTimeout(() => {
        if (this.videoElement?.nativeElement) {
          this.videoElement.nativeElement.srcObject = this.stream;
        }
      }, 100);

    } catch (err: any) {
      if (err.name === 'NotAllowedError') {
        alert('يرجى السماح بالوصول للكاميرا');
      } else {
        alert('حدث خطأ: ' + err.message);
      }
    }
  }

  private stopCamera(): void {
    this.stream?.getTracks().forEach(track => track.stop());
    this.stream = null;
    this.isActive = false;
  }

  ngOnDestroy(): void {
    this.stopCamera();
  }
}