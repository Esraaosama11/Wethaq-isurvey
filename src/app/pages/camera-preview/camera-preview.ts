import {
  Component,
  ViewChild,
  ElementRef,
  OnDestroy,
  AfterViewInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';

interface ServerMessage {
  status?: string;
  message?: string;
  ar_message?: string;
  phase?: string;
  captured_side?: string;
  roof?: string;
  vin?: string;
  odometer_reading?: string;
}

@Component({
  selector: 'app-camera-preview',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './camera-preview.html',
  styleUrl: './camera-preview.css',
})
export class CameraPreview implements AfterViewInit, OnDestroy {

  @ViewChild('videoElement') videoElement!: ElementRef<HTMLVideoElement>;

  // ── Camera state ──────────────────────────────────────────────────────────
  isActive    = false;
  isSending   = false;
  private stream: MediaStream | null = null;
  private canvas = document.createElement('canvas');
  private isCapturing = false;

  // ── Orientation ───────────────────────────────────────────────────────────
  isPortrait = window.innerHeight > window.innerWidth;
  private onResize = () => {
    this.isPortrait = window.innerHeight > window.innerWidth;
  };

  // ── WebSocket ─────────────────────────────────────────────────────────────
  private readonly SERVER_URL = 'ws://196.219.114.138:8080/ws/validate';
  private readonly userCarId  = 1;
  private socket: WebSocket | null = null;
  private frameInterval: any = null;
  private frameCount = 0;

  // ── Progress ──────────────────────────────────────────────────────────────
  progress       = 0;
  targetProgress = 0;
  private progressTimer: any = null;

  // ── Inspection state ──────────────────────────────────────────────────────
  isConnected         = false;
  arMessage           = 'اضغط لبدأ المعاينه';
  status              = 'INITIAL';
  currentPhase        = '';
  capturedSides: string[] = [];
  roofCaptured        = false;
  vinNumber           = '';
  odometerReading     = '';
  showCompletionModal = false;

  // ── TTS ───────────────────────────────────────────────────────────────────
  private synth = window.speechSynthesis;
  private lastSpokenMessage = '';

  readonly sides = [
    { key: 'front', label: 'الأمامي' },
    { key: 'right', label: 'الأيمن'  },
    { key: 'rear',  label: 'الخلفي'  },
    { key: 'left',  label: 'الأيسر'  },
  ];

  get allSidesCaptured(): boolean {
    return ['front', 'right', 'rear', 'left'].every(s => this.capturedSides.includes(s));
  }

  isSideCaptured(side: string): boolean {
    return this.capturedSides.includes(side);
  }

  constructor(private http: HttpClient) {}

  // ── Lifecycle ─────────────────────────────────────────────────────────────
  async ngAfterViewInit(): Promise<void> {
    window.addEventListener('resize', this.onResize);
    await this.startCamera();
  }

  ngOnDestroy(): void {
    window.removeEventListener('resize', this.onResize);
    this.stopCamera();
    this.synth.cancel();
  }

  // ── Camera ────────────────────────────────────────────────────────────────
  private async startCamera(): Promise<void> {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false,
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
    this.stopInspection();
    this.stream?.getTracks().forEach(track => track.stop());
    this.stream = null;
    this.isActive = false;
  }

  // ── Inspection start / stop ───────────────────────────────────────────────
  startInspection(): void {
    if (this.isSending || !this.stream) return;

    this.progress       = 0;
    this.targetProgress = 0;

    const uri = `${this.SERVER_URL}/${this.userCarId}`;
    this.socket = new WebSocket(uri);

    this.socket.onopen = () => {
      this.isConnected = true;
      this.isSending   = true;
      this.arMessage   = 'جارٍ الاتصال…';
      this.frameInterval = setInterval(() => this.captureAndSendFrame(), 1200);
    };

    this.socket.onmessage = (event) => this.handleServerMessage(event.data);

    this.socket.onerror = (err) => {
      console.error('WS error', err);
      this.stopInspection();
    };

    this.socket.onclose = () => {
      if (this.isConnected) this.stopInspection();
    };
  }

  stopInspection(): void {
    clearInterval(this.frameInterval);
    clearInterval(this.progressTimer);
    this.frameInterval      = null;
    this.progressTimer      = null;
    this.socket?.close();
    this.socket             = null;
    this.isSending          = false;
    this.isConnected        = false;
    this.progress           = 0;
    this.targetProgress     = 0;
    this.capturedSides      = [];
    this.roofCaptured       = false;
    this.vinNumber          = '';
    this.odometerReading    = '';
    this.currentPhase       = '';
    this.status             = 'INITIAL';
    this.arMessage          = 'اضغط لبدأ المعاينه';
    this.frameCount         = 0;
  }

  // ── Frame capture ─────────────────────────────────────────────────────────
  private captureAndSendFrame(): void {
    const video = this.videoElement?.nativeElement;
    if (!video || this.isCapturing || video.readyState < 2) return;

    this.isCapturing = true;

    this.canvas.width  = video.videoWidth;
    this.canvas.height = video.videoHeight;
    this.canvas.getContext('2d')?.drawImage(video, 0, 0);

    this.canvas.toBlob((blob) => {
      if (!blob) { this.isCapturing = false; return; }

      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = (reader.result as string).split(',')[1];
        const msg = JSON.stringify({
          type: 'frame',
          data: base64,
          frame_number: this.frameCount,
        });
        try { this.socket?.send(msg); } catch {}
        this.frameCount++;
        this.isCapturing = false;
      };
      reader.readAsDataURL(blob);

    }, 'image/jpeg', 0.8);
  }

  // ── Message handler ───────────────────────────────────────────────────────
  private handleServerMessage(raw: string): void {
    try {
      const msg: ServerMessage = JSON.parse(raw);
      console.log('📥 Server:', msg);

      if (msg.ar_message?.trim()) this.speak(msg.ar_message);

      if (msg.status)     this.status       = msg.status;
      if (msg.ar_message) this.arMessage    = msg.ar_message;
      if (msg.phase)      this.currentPhase = msg.phase;

      if (msg.captured_side && !this.capturedSides.includes(msg.captured_side)) {
        this.capturedSides = [...this.capturedSides, msg.captured_side];
      }

      if (msg.phase === 'roof' && msg.status === 'CAPTURED') this.roofCaptured = true;
      if (msg.vin?.trim())              this.vinNumber       = msg.vin;
      if (msg.odometer_reading?.trim()) this.odometerReading = msg.odometer_reading;

      if (this.currentPhase === 'complete') {
        this.processByFlag();
        this.showCompletionModal = true;
        this.stopInspection();
        return;
      }

      const newTarget = this.calculateProgress();
      if (newTarget > this.targetProgress) {
        this.targetProgress = newTarget;
        this.animateProgress();
      }
    } catch (e) {
      console.error('Parse error', e);
    }
  }

  // ── TTS ───────────────────────────────────────────────────────────────────
  private speak(text: string): void {
    if (!text || text === this.lastSpokenMessage) return;
    this.lastSpokenMessage = text;
    this.synth.cancel();
    const utt = new SpeechSynthesisUtterance(text);
    utt.lang = 'ar-EG';
    utt.rate = 0.9;
    this.synth.speak(utt);
  }

  // ── Progress ──────────────────────────────────────────────────────────────
  private calculateProgress(): number {
    let p = 0;
    if (this.capturedSides.includes('front')) p += 15;
    if (this.capturedSides.includes('left'))  p += 15;
    if (this.capturedSides.includes('rear'))  p += 15;
    if (this.capturedSides.includes('right')) p += 15;
    if (this.roofCaptured)                    p += 10;
    if (this.vinNumber)                       p += 15;
    if (this.odometerReading)                 p += 15;
    return Math.min(p, 100);
  }

  private animateProgress(): void {
    clearInterval(this.progressTimer);
    this.progressTimer = setInterval(() => {
      if (this.progress >= this.targetProgress) {
        clearInterval(this.progressTimer);
        this.progressTimer = null;
      } else {
        this.progress++;
      }
    }, 30);
  }

  // ── API ───────────────────────────────────────────────────────────────────
  private processByFlag(): void {
    const url = `/api/VideoDetection/ProcessByFlag?userCarId=${this.userCarId}&flag=1`;
    this.http.post(url, null, { headers: { Accept: 'application/json' } }).subscribe({
      next:  (res) => console.log('ProcessByFlag:', res),
      error: (err) => console.error('ProcessByFlag error:', err),
    });
  }

  // ── Modal ─────────────────────────────────────────────────────────────────
  closeModalAndContinue(): void {
    this.showCompletionModal = false;
    // this.router.navigate(['/payment-success']);
  }
}