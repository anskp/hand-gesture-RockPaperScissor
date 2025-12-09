import { GestureRecognizer, FilesetResolver } from '@mediapipe/tasks-vision';
import { Gesture } from '../types';

class VisionService {
  private gestureRecognizer: GestureRecognizer | null = null;
  private runningMode: 'VIDEO' = 'VIDEO';

  public async initialize() {
    if (this.gestureRecognizer) return;

    console.log("Initializing MediaPipe Vision Service...");

    const vision = await FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm"
    );

    this.gestureRecognizer = await GestureRecognizer.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: "https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task",
        // Explicitly using CPU to match the XNNPACK log and ensure stability. 
        // This prevents GPU context loss or fallback delays on some devices.
        delegate: "CPU" 
      },
      runningMode: this.runningMode
    });
    console.log("MediaPipe Gesture Recognizer initialized successfully");
  }

  public detect(video: HTMLVideoElement): { gesture: Gesture, confidence: number } {
    if (!this.gestureRecognizer) return { gesture: Gesture.NONE, confidence: 0 };
    if (video.currentTime === 0) return { gesture: Gesture.NONE, confidence: 0 };

    try {
        // Use performance.now() for monotonic increasing timestamps
        const result = this.gestureRecognizer.recognizeForVideo(video, performance.now());

        if (result.gestures.length > 0) {
            const topGesture = result.gestures[0][0];
            const categoryName = topGesture.categoryName;
            const score = topGesture.score;

            if (categoryName === 'Closed_Fist') return { gesture: Gesture.ROCK, confidence: score };
            if (categoryName === 'Open_Palm') return { gesture: Gesture.PAPER, confidence: score };
            if (categoryName === 'Victory') return { gesture: Gesture.SCISSORS, confidence: score };
            
            return { gesture: Gesture.NONE, confidence: score };
        }
    } catch (e) {
        console.warn("Detection error:", e);
    }

    return { gesture: Gesture.NONE, confidence: 0 };
  }
}

export const visionService = new VisionService();
