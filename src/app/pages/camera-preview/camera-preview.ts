import { 
  Component, 
  ViewChild, 
  ElementRef, 
  OnDestroy,
  AfterViewInit
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';

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
  isSending = false;
  private stream: MediaStream | null = null;
  private frameInterval: any = null;
  private canvas = document.createElement('canvas');

  constructor(private http: HttpClient) {}

  async ngAfterViewInit(): Promise<void> {
    await this.startCamera();
  }

  private async startCamera(): Promise<void> {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false  // ← مفيش صوت
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

  startInspection(): void {
    if (this.isSending) return;
    this.isSending = true;

    // بعت frame كل ثانية
    this.frameInterval = setInterval(() => {
      this.captureAndSendFrame();
    }, 1000);
  }

  stopInspection(): void {
    clearInterval(this.frameInterval);
    this.frameInterval = null;
    this.isSending = false;
  }

  private captureAndSendFrame(): void {
    const video = this.videoElement?.nativeElement;
    if (!video) return;

    // ارسم الـ frame على canvas
    this.canvas.width = video.videoWidth;
    this.canvas.height = video.videoHeight;
    const ctx = this.canvas.getContext('2d');
    ctx?.drawImage(video, 0, 0);

    // حوّل لـ blob وابعت
    this.canvas.toBlob((blob) => {
      if (!blob) return;

      const formData = new FormData();
      formData.append('frame', blob, 'frame.jpg');

      this.http.post('YOUR_ENDPOINT_HERE', formData).subscribe({
        next: (res) => console.log('Frame sent:', res),
        error: (err) => console.error('Error sending frame:', err)
      });

    }, 'image/jpeg', 0.8); // جودة 80%
  }

  private stopCamera(): void {
    this.stopInspection();
    this.stream?.getTracks().forEach(track => track.stop());
    this.stream = null;
    this.isActive = false;
  }

  ngOnDestroy(): void {
    this.stopCamera();
  }
}