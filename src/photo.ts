export async function preparePatientPhoto(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('请选择照片文件');
  if (file.size > 12 * 1024 * 1024) throw new Error('原始照片不能超过 12MB');
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const value = new Image();
      value.onload = () => resolve(value);
      value.onerror = () => reject(new Error('照片读取失败'));
      value.src = objectUrl;
    });
    const size = 512;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('浏览器无法处理照片');
    const sourceSize = Math.min(image.naturalWidth, image.naturalHeight);
    const sourceX = (image.naturalWidth - sourceSize) / 2;
    const sourceY = (image.naturalHeight - sourceSize) / 2;
    context.fillStyle = '#edf7f2';
    context.fillRect(0, 0, size, size);
    context.drawImage(image, sourceX, sourceY, sourceSize, sourceSize, 0, 0, size, size);
    return canvas.toDataURL('image/webp', .84);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
