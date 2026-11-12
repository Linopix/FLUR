import jsQR from "jsqr";

type Frame = {
  width: number;
  height: number;
  sx: number;
  sy: number;
  sw: number;
  sh: number;
};

function decode(bitmap: ImageBitmap, frame: Frame): string | null {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(frame.width));
  canvas.height = Math.max(1, Math.round(frame.height));
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(bitmap, frame.sx, frame.sy, frame.sw, frame.sh, 0, 0, canvas.width, canvas.height);
  const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
  return jsQR(image.data, image.width, image.height, { inversionAttempts: "attemptBoth" })?.data ?? null;
}

/** Reads the text inside a photographed WebUntis QR code. */
export async function readQrFromFile(file: File): Promise<string | null> {
  const bitmap = await createImageBitmap(file);
  try {
    const maxSide = 1400;
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const crop = 0.72;
    const cw = bitmap.width * crop;
    const ch = bitmap.height * crop;
    const frames: Frame[] = [
      {
        width: bitmap.width * scale,
        height: bitmap.height * scale,
        sx: 0,
        sy: 0,
        sw: bitmap.width,
        sh: bitmap.height,
      },
      {
        width: cw * scale,
        height: ch * scale,
        sx: (bitmap.width - cw) / 2,
        sy: (bitmap.height - ch) / 2,
        sw: cw,
        sh: ch,
      },
    ];
    for (const frame of frames) {
      const text = decode(bitmap, frame);
      if (text) return text;
    }
    return null;
  } finally {
    bitmap.close();
  }
}
