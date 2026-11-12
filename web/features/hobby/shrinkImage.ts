// Stage 21: make a picture small enough to send quickly, in the browser, before uploading.
//
// Phone photos are often 4000 × 3000 and 3–6 MB. A chat shows them at most ~400 px wide, so we draw them
// onto a canvas at most 1600 px on the long side and save that as WebP (or JPEG where the browser can't
// make WebP, e.g. older Safari). A 4 MB photo becomes ~200–300 KB. GIFs are sent as they are, to keep
// the animation. The API still checks every file itself (api/src/hobby/images.ts).

export const MAX_SIDE = 1600;
export const MAX_MB = 5;

export async function shrinkImage(file: Blob, name = "picture"): Promise<{ blob: Blob; name: string }> {
  if (file.type === "image/gif") return { blob: file, name: withExt(name, "gif") };

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" }); // phone photos: keep them upright
  } catch {
    return { blob: file, name }; // the browser can't read it; the API will say whether it's a picture
  }
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  // Already small: send it as it is (screenshots stay sharp as PNG)
  if (scale === 1 && file.size < 700_000 && /^image\/(jpeg|png|webp)$/.test(file.type)) {
    bitmap.close();
    return { blob: file, name };
  }

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#fff"; // JPEG has no transparency: transparent parts become white, not black
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  const webp = await toBlob(canvas, "image/webp", 0.85);
  if (webp?.type === "image/webp") return { blob: webp, name: withExt(name, "webp") };
  const jpeg = await toBlob(canvas, "image/jpeg", 0.85);
  return jpeg ? { blob: jpeg, name: withExt(name, "jpg") } : { blob: file, name };
}

const toBlob = (canvas: HTMLCanvasElement, type: string, quality: number) => new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
const withExt = (name: string, ext: string) => `${name.replace(/\.[^.]+$/, "") || "picture"}.${ext}`;

// The first picture in a paste or a drop, if any
export function pictureFrom(data: DataTransfer | null): File | null {
  if (!data) return null;
  for (const file of Array.from(data.files)) if (file.type.startsWith("image/")) return file;
  for (const item of Array.from(data.items ?? [])) {
    if (item.kind === "file" && item.type.startsWith("image/")) return item.getAsFile();
  }
  return null;
}
