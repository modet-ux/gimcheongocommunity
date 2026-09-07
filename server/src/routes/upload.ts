import { Router, Request, Response, NextFunction } from "express";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs/promises";
import sharp from "sharp";
import { v4 as uuidv4 } from "uuid";
import { Buffer as NodeBuffer } from "buffer";
import { db, schema } from "../db/index.js";
import { eq } from "drizzle-orm";
import { AppError } from "../lib/errors.js";
import { requireAuth, AuthenticatedRequest } from "../lib/auth.js";
import { config } from "dotenv";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

config();

const router = Router();

// --------------------------- 설정 ---------------------------
const SERVER_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const UPLOAD_DIR = path.join(SERVER_ROOT, "uploads");
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

// 업로드 디렉토리 확보
async function ensureUploadDir() {
  try {
    await fs.access(UPLOAD_DIR);
  } catch {
    await fs.mkdir(UPLOAD_DIR, { recursive: true });
  }
}
ensureUploadDir();

// --------------------------- multer 설정 ---------------------------
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter(_req, file, cb) {
    if (ALLOWED_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new AppError(400, "지원하지 않는 이미지 형식입니다."));
    }
  },
}).array("images", 10); // 최대 10장

// --------------------------- Sharp 이미지 가공 ---------------------------
interface ProcessedImage {
  buffer: Buffer;
  width: number;
  height: number;
  format: string;
}

async function processImage(buffer: Buffer): Promise<ProcessedImage> {
  const img = sharp(buffer);
  const metadata = await img.metadata();

  if (!metadata.width || !metadata.height) {
    throw new AppError(400, "이미지 정보를 읽을 수 없습니다.");
  }

  // 최대 크기: 너비/높이 중 긴 쪽이 1600px를 넘지 않도록 축소
  const MAX_DIM = 1600;
  let { width, height } = metadata;
  if (width > MAX_DIM || height > MAX_DIM) {
    const ratio = Math.min(MAX_DIM / width, MAX_DIM / height);
    width = Math.round(width * ratio);
    height = Math.round(height * ratio);
  }

  // 출력 포맷: WebP 권장, JPEG/PNG/ GIF는 그대로 변환
  const inputFormat = (metadata.format ?? "").toLowerCase();
  let outputFormat: string;
  if (inputFormat === "webp") outputFormat = "webp";
  else if (inputFormat === "jpeg" || inputFormat === "jpg") outputFormat = "jpeg";
  else if (inputFormat === "png") outputFormat = "png";
  else if (inputFormat === "gif") outputFormat = "gif";
  else outputFormat = "webp";

  const optimized = await img
    .resize(width, height, { fit: "inside", withoutEnlargement: true })
    .toFormat(outputFormat as any, {
      quality: outputFormat === "webp" ? 80 : 85,
      progressive: outputFormat === "jpeg",
    })
    .toBuffer();

  return {
    buffer: optimized,
    width,
    height,
    format: outputFormat,
  };
}

// --------------------------- R2 업로드 (설정 시) / 로컬 fallback ---------------------------
async function storeImage(processed: ProcessedImage, postId: string, filename: string): Promise<{ url: string; r2Key: string }> {
  const r2Endpoint = process.env.R2_ENDPOINT;
  const r2KeyId = process.env.R2_ACCESS_KEY_ID;
  const r2Secret = process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_BUCKET_NAME;

  // R2 설정이 모두 있으면 AWS S3 호환 API로 실제 업로드
  if (process.env.R2_UPLOAD_ENABLED === "true" && r2Endpoint && r2KeyId && r2Secret && bucket) {
    const key = `posts/${postId}/${filename}`;
    const client = new S3Client({
      region: "auto",
      endpoint: r2Endpoint,
      forcePathStyle: true,
      credentials: { accessKeyId: r2KeyId, secretAccessKey: r2Secret },
    });
    try {
      await client.send(new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: processed.buffer,
        ContentType: `image/${processed.format}`,
        CacheControl: "public, max-age=31536000, immutable",
      }));
      const publicBase = process.env.R2_PUBLIC_URL || `${r2Endpoint}/${bucket}`;
      return { url: `${publicBase.replace(/\/$/, "")}/${key}`, r2Key: key };
    } catch (error) {
      console.error("R2 이미지 업로드 실패:", error);
      throw new AppError(502, "이미지 저장소에 업로드하지 못했습니다.");
    }
  }

  // 로컬 저장 (개발/테스트 fallback)
  const localFilename = `${uuidv4()}.${processed.format}`;
  const localPath = path.join(UPLOAD_DIR, localFilename);
  await fs.writeFile(localPath, processed.buffer);
  const url = `/uploads/${localFilename}`;
  return { url, r2Key: localFilename };
}

// --------------------------- 라우트 ---------------------------
// POST /api/uploads/profile-image - 프로필 이미지 업로드
router.post("/profile-image", requireAuth, async (req: AuthenticatedRequest, res, next) => {
  upload(req, res, async (err) => {
    if (err) return next(err);
    try {
      const file = (req.files as Express.Multer.File[] | undefined)?.[0];
      if (!file) return next(new AppError(400, "이미지가 없습니다."));
      const processed = await processImage(file.buffer);
      const filename = `${uuidv4()}.${processed.format}`;
      const stored = await storeImage(processed, `profiles/${req.userId}`, filename);
      res.json({ url: stored.url });
    } catch (error) { next(error); }
  });
});

// POST /api/uploads/images - 이미지 업로드
router.post("/images", requireAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    upload(req, res, async (err) => {
      if (err) {
        next(err);
        return;
      }

      const files = req.files as Express.Multer.File[];
      if (!files || files.length === 0) {
        next(new AppError(400, "이미지가 없습니다."));
        return;
      }

      const postId = req.body.postId;
      if (!postId) {
        next(new AppError(400, "postId가 필요합니다."));
        return;
      }

      // 게시글이 실제로 존재하는지 확인 (작성자 검증은 게시글 라우트에서 처리)
      const post = await db.query.posts.findFirst({
        where: eq(schema.posts.id, postId),
      });
      if (!post) {
        next(new AppError(404, "게시글을 찾을 수 없습니다."));
        return;
      }

      let results;
      try {
        results = await Promise.all(
          files.map(async (file) => {
          const processed = await processImage(file.buffer);
          const filename = `${uuidv4()}.${processed.format}`;
          const { url, r2Key } = await storeImage(processed, postId, filename);

          const imageId = uuidv4();
          await db.insert(schema.postImages).values({
            id: imageId,
            postId,
            r2Key,
            url,
            width: processed.width,
            height: processed.height,
          });

          return { id: imageId, url, width: processed.width, height: processed.height };
        })
        );
      } catch (error) {
        next(error);
        return;
      }

      res.json({ uploaded: results });
    });
  } catch (err) {
    next(err);
  }
});

// 업로드 상태 확인 (건강 진단용)
router.get("/health", (_req, res) => {
  res.json({ uploadDir: UPLOAD_DIR, maxFileSize: MAX_FILE_SIZE });
});

export default router;
