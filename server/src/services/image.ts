import { db, schema } from "../db/index.js";
import { AppError } from "../lib/errors.js";
import sharp from "sharp";
import fs from "fs";
import path from "path";

interface UploadResult {
  id: string;
  url: string;
  width: number;
  height: number;
  r2Key: string;
}

// 실제 운영 환경에서는 Cloudflare R2 SDK 사용
// 여기서는 로컬 개발용 더미 구현 + R2 업로드 함수 스켈레톤 제공
export async function uploadImage(
  file: Express.Multer.File,
): Promise<UploadResult> {
  // 1. 이미지 검증
  const image = sharp(file.buffer);
  const metadata = await image.metadata();

  if (!metadata || !metadata.width || !metadata.height) {
    throw new AppError(400, "유효하지 않은 이미지입니다.");
  }

  // 2. 최대 크기 제한 (가로/세로 최대 2000px, 용량 5MB)
  if (file.size > 5 * 1024 * 1024) {
    throw new AppError(400, "이미지 크기는 5MB를 초과할 수 없습니다.");
  }

  if (metadata.width > 2000 || metadata.height > 2000) {
    // resize: 최대 1920px, 비율 유지
    await image.resize(1920, 1920, {
      fit: "inside",
      withoutEnlargement: true,
    });
  }

  // 3. 포맷 변환 및 압축
  let format = "jpeg";
  let ext = "jpg";
  if (metadata.format === "png") {
    format = "png";
    ext = "png";
  } else if (metadata.format === "webp") {
    format = "webp";
    ext = "webp";
  }

  const processedBuffer = await image
    .toFormat(format as any, {
      quality: format === "jpeg" ? 85 : format === "png" ? 80 : 85,
      progressive: format === "jpeg",
    })
    .toBuffer();

  // 4. 고유 키 생성
  const r2Key = `post-images/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`;

  // 5. R2 업로드 (실제 R2 SDK 호출)
  // Cloudflare R2에 업로드하는 예시 함수
  const uploadUrl = await uploadToR2(processedBuffer, r2Key, {
    contentType: `image/${ext === "jpg" ? "jpeg" : ext}`,
  });

  if (!uploadUrl) {
    throw new AppError(500, "이미지 저장에 실패했습니다.");
  }

  const finalUrl = `${process.env.R2_ENDPOINT}/cps2/${r2Key}`;

  // 6. DB 저장용 메타데이터 생성
  const id = crypto.randomUUID();

  return {
    id,
    url: finalUrl,
    width: metadata.width,
    height: metadata.height,
    r2Key,
  };
}

// R2 업로드 함수 (실제 구현 예시)
async function uploadToR2(
  buffer: Buffer,
  key: string,
  options: { contentType: string },
): Promise<string | null> {
  // @aws-sdk/client-s3 사용 예시 (주석)
  /*
  import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

  const r2 = new S3Client({
    region: "auto",
    endpoint: process.env.R2_ENDPOINT!,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  });

  await r2.send(new PutObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME!,
    Key: key,
    Body: buffer,
    ContentType: options.contentType,
    CacheControl: "public, max-age=31536000",
  }));

  return `https://${process.env.R2_BUCKET_NAME}.${process.env.R2_ENDPOINT!.replace("https://", "")}/${key}`;
  */

  // 개발 환경에서는 로컬 파일로 저장 (실제 R2 연결 없을 때)
  if (process.env.NODE_ENV !== "production") {
    const uploadsDir = path.join(process.cwd(), "..", "uploads");
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const localPath = path.join(uploadsDir, key);
    fs.writeFileSync(localPath, buffer);

    const port = process.env.PORT || "3001";
    return `http://localhost:${port}/uploads/${key}`;
  }

  return null;
}

// 이미지 삭제
export async function deleteImage(r2Key: string): Promise<void> {
  // R2에서 삭제
  // @aws-sdk/client-s3 사용
  /*
  import { S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3";

  const r2 = new S3Client({
    region: "auto",
    endpoint: process.env.R2_ENDPOINT!,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  });

  await r2.send(new DeleteObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME!,
    Key: r2Key,
  }));
  */

  // 개발 환경에서 로컬 파일 삭제
  if (process.env.NODE_ENV !== "production") {
    const uploadsDir = path.join(process.cwd(), "..", "uploads");
    const localPath = path.join(uploadsDir, r2Key);
    if (fs.existsSync(localPath)) {
      fs.unlinkSync(localPath);
    }
  }
}
