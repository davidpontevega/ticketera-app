import "server-only";
import { randomUUID } from "node:crypto";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

const s3 = new S3Client({ region: process.env.AWS_REGION });

const DATA_URL_PATTERN = /^data:image\/(jpeg|png);base64,(.+)$/;

// Sube un data URL de imagen a S3 bajo media/<folder>/ y devuelve su URL publica (CloudFront /media/*).
// Cualquier otro valor (URL ya subida, unsplash, "") se devuelve tal cual.
// ponytail: no borra la imagen anterior al reemplazarla; agregar DeleteObject si el bucket crece.
export async function uploadDataUrlImage(value: string, folder: string): Promise<string> {
  const match = DATA_URL_PATTERN.exec(value);
  if (!match) return value;
  const [, type, base64] = match;
  const name = `${folder}/${randomUUID()}.${type === "jpeg" ? "jpg" : "png"}`;
  await s3.send(
    new PutObjectCommand({
      Bucket: process.env.S3_MEDIA_BUCKET,
      Key: `media/${name}`,
      Body: Buffer.from(base64, "base64"),
      ContentType: `image/${type}`,
      CacheControl: "public, max-age=31536000, immutable",
    }),
  );
  return `${process.env.NEXT_PUBLIC_MEDIA_URL}/${name}`;
}
