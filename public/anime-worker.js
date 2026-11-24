'use strict';
// Runs AnimeGAN (Hayao / Studio Ghibli style) through onnxruntime-web off the main thread (same engine/version as the original anime-window.html).
const ORT_BASE = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.18.0/dist/';
importScripts(ORT_BASE + 'ort.webgpu.min.js');
ort.env.wasm.wasmPaths = ORT_BASE;
ort.env.wasm.numThreads = 1;

const NW = 672, NH = 504; // generator_hayao.onnx: fixed 672x504 (WxH)
let session = null, inName = '', outName = '';

async function infer(rgba) {
  const px = NW * NH, data = new Float32Array(3 * px);
  for (let i = 0; i < px; i++) {
    data[i] = rgba[i * 4] / 127.5 - 1;
    data[px + i] = rgba[i * 4 + 1] / 127.5 - 1;
    data[2 * px + i] = rgba[i * 4 + 2] / 127.5 - 1;
  }
  const out = await session.run({ [inName]: new ort.Tensor('float32', data, [1, 3, NH, NW]) });
  const y = out[outName].data;
  const img = new Uint8ClampedArray(4 * px);
  for (let i = 0; i < px; i++) {
    img[i * 4] = (y[i] * 0.5 + 0.5) * 255;
    img[i * 4 + 1] = (y[px + i] * 0.5 + 0.5) * 255;
    img[i * 4 + 2] = (y[2 * px + i] * 0.5 + 0.5) * 255;
    img[i * 4 + 3] = 255;
  }
  return img;
}

self.onmessage = async (e) => {
  const m = e.data;
  try {
    if (m.type === 'load') {
      const buf = await (await fetch(m.model)).arrayBuffer();
      let lastErr = null;
      for (const ep of ['webgpu', 'wasm']) {
        try { session = await ort.InferenceSession.create(buf, { executionProviders: [ep] }); break; }
        catch (err) { lastErr = err; }
      }
      if (!session) throw lastErr;
      inName = session.inputNames[0];
      outName = session.outputNames[0];
      await infer(new Uint8ClampedArray(4 * NW * NH)); // warm-up compiles the GPU kernels
      self.postMessage({ type: 'ready' });
    } else if (m.type === 'run') {
      const img = await infer(new Uint8ClampedArray(m.rgba));
      self.postMessage({ type: 'result', rgba: img.buffer }, [img.buffer]);
    }
  } catch (err) {
    self.postMessage({ type: 'error', message: String((err && err.message) || err) });
  }
};
