/**
 * AudioWorklet that forwards microphone frames to the main thread.
 * Runs on the audio thread; kept tiny on purpose.
 */
class RecorderProcessor extends AudioWorkletProcessor {
  /** @param {Float32Array[][]} inputs */
  process(inputs) {
    const channel = inputs[0]?.[0];
    if (channel) {
      this.port.postMessage(channel.slice(0));
    }
    return true;
  }
}

registerProcessor('mm-recorder', RecorderProcessor);
