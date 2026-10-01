// Runs the Kokoro neural text-to-speech model off the main thread, so generating a word
// never freezes typing or animations. Started by neural-voice.js as a module worker.
//
// The engine and its WebAssembly runtime come from jsDelivr at a pinned version; the model
// (~90 MB, 8-bit) comes from Hugging Face on first use and is then kept by the browser.
// A worker has no access to the page, so none of the app's saved API keys are reachable here.
import { KokoroTTS } from "https://cdn.jsdelivr.net/npm/kokoro-js@1.2.1/dist/kokoro.web.js";

const MODEL_ID = "onnx-community/Kokoro-82M-v1.0-ONNX";

let loading = null;

function load() {
  loading ||= KokoroTTS.from_pretrained(MODEL_ID, {
    dtype: "q8",
    device: "wasm",
    progress_callback: (p) => {
      if (p.status === "progress") postMessage({ type: "progress", file: p.file, loaded: p.loaded, total: p.total });
    },
  }).catch((err) => {
    loading = null; // allow a retry after a failed or interrupted download
    throw err;
  });
  return loading;
}

const messageOf = (err) => (err && err.message) || String(err);

self.onmessage = async ({ data }) => {
  if (data.type === "load") {
    try {
      await load();
      postMessage({ type: "ready" });
    } catch (err) {
      postMessage({ type: "error", message: messageOf(err) });
    }
  } else if (data.type === "generate") {
    try {
      const tts = await load();
      const audio = await tts.generate(data.text, { voice: data.voice, speed: data.speed });
      const samples = audio.audio;
      postMessage({ type: "audio", id: data.id, samples, rate: audio.sampling_rate }, [samples.buffer]);
    } catch (err) {
      postMessage({ type: "error", id: data.id, message: messageOf(err) });
    }
  }
};
