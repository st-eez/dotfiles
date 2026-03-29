/**
 * Playwright video commands — record browser sessions as video files.
 *
 * video-start: Create a new browser context with video recording enabled.
 * video-stop:  Close the recording context and return the video file path.
 *
 * Note: Playwright requires video recording to be set at context creation time,
 * so video-start creates a new context (preserving cookies) and video-stop
 * closes it to finalize the video file.
 */

import type { BrowserManager } from '../core/browser-manager';
import * as path from 'path';

const VIDEO_DIR = path.join(process.env.HOME || '/tmp', '.steez', 'browse', 'videos');

let isRecording = false;

export async function handleVideoCommand(
  command: string,
  args: string[],
  browserManager: BrowserManager,
): Promise<string> {
  if (command === 'video-start') {
    if (isRecording) {
      return JSON.stringify({ error: 'Already recording. Run video-stop first.' });
    }

    const context = browserManager.getContext();
    if (!context) {
      return JSON.stringify({ error: 'No browser context available. Run a goto command first.' });
    }

    // Playwright requires recordVideo at context creation — we need to recreate the context.
    // For now, return a structured message indicating the limitation.
    // Full implementation will use browserManager.recreateContext() with video options.
    const fs = require('fs');
    fs.mkdirSync(VIDEO_DIR, { recursive: true });

    const videoDir = args[0] || VIDEO_DIR;

    try {
      await browserManager.recreateContextWithVideo(videoDir);
      isRecording = true;
      return JSON.stringify({
        recording: true,
        videoDir,
        message: 'Video recording started. Run video-stop to save.',
      });
    } catch (err: any) {
      return JSON.stringify({
        error: `Failed to start video recording: ${err.message}`,
        hint: 'Video requires recreating the browser context. Cookies are preserved.',
      });
    }
  }

  if (command === 'video-stop') {
    if (!isRecording) {
      return JSON.stringify({ error: 'Not recording. Run video-start first.' });
    }

    try {
      const videoPath = await browserManager.stopVideoRecording();
      isRecording = false;
      return JSON.stringify({
        recording: false,
        path: videoPath,
        message: `Video saved to ${videoPath}`,
      });
    } catch (err: any) {
      isRecording = false;
      return JSON.stringify({ error: `Failed to stop video: ${err.message}` });
    }
  }

  return JSON.stringify({ error: `Unknown video command: ${command}` });
}
