import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import process from "node:process";
import { requireAdmin } from "./clinic-auth.server";

const LOGICAL_BUCKETS = new Set(["photos", "documents"]);

let client: S3Client | undefined;

function getS3Client() {
  if (!client) {
    const endpoint = process.env.S3_ENDPOINT;
    const region = process.env.S3_REGION || "ru-1";
    const accessKeyId = process.env.S3_ACCESS_KEY_ID;
    const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;
    if (!endpoint || !accessKeyId || !secretAccessKey) {
      throw new Error("S3_ENDPOINT, S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY are required");
    }
    client = new S3Client({
      endpoint,
      region,
      forcePathStyle: true,
      credentials: { accessKeyId, secretAccessKey },
    });
  }
  return client;
}

function getPhysicalBucket() {
  const bucket = process.env.S3_BUCKET;
  if (!bucket) throw new Error("S3_BUCKET is required");
  return bucket;
}

export function publicObjectUrl(logicalBucket: string, path: string) {
  assertBucket(logicalBucket);
  return `/api/clinic/storage/object/${encodeURIComponent(logicalBucket)}/${path
    .split("/")
    .map(encodeURIComponent)
    .join("/")}`;
}

export async function uploadObject(request: Request) {
  await requireAdmin(request);
  const form = await request.formData();
  const logicalBucket = String(form.get("bucket") || "");
  const path = sanitizePath(String(form.get("path") || ""));
  const file = form.get("file");
  assertBucket(logicalBucket);
  if (!path) throw new Error("Storage path is required");
  if (!(file instanceof File)) throw new Error("File is required");

  const bytes = new Uint8Array(await file.arrayBuffer());
  await getS3Client().send(
    new PutObjectCommand({
      Bucket: getPhysicalBucket(),
      Key: `${logicalBucket}/${path}`,
      Body: bytes,
      ContentType: String(form.get("contentType") || file.type || "application/octet-stream"),
    }),
  );
  return { path, publicUrl: publicObjectUrl(logicalBucket, path) };
}

export async function deleteObjects(request: Request) {
  await requireAdmin(request);
  const body = (await request.json()) as { bucket?: string; paths?: string[] };
  const logicalBucket = String(body.bucket || "");
  assertBucket(logicalBucket);
  const paths = Array.isArray(body.paths) ? body.paths.map((path) => sanitizePath(path)) : [];
  await Promise.all(
    paths
      .filter(Boolean)
      .map((path) =>
        getS3Client().send(
          new DeleteObjectCommand({ Bucket: getPhysicalBucket(), Key: `${logicalBucket}/${path}` }),
        ),
      ),
  );
  return { ok: true };
}

export async function getObjectResponse(logicalBucket: string, rawPath: string) {
  assertBucket(logicalBucket);
  const path = sanitizePath(rawPath);
  const result = await getS3Client().send(
    new GetObjectCommand({ Bucket: getPhysicalBucket(), Key: `${logicalBucket}/${path}` }),
  );
  const body = await result.Body?.transformToByteArray();
  if (!body) return new Response("Not found", { status: 404 });
  return new Response(body, {
    headers: {
      "content-type": result.ContentType || "application/octet-stream",
      "cache-control": "public, max-age=31536000, immutable",
    },
  });
}

function assertBucket(bucket: string) {
  if (!LOGICAL_BUCKETS.has(bucket)) throw new Error(`Storage bucket is not allowed: ${bucket}`);
}

function sanitizePath(value: string) {
  return value
    .split("/")
    .filter(Boolean)
    .map((part) => part.replace(/[^a-zA-Z0-9._-]+/g, "_"))
    .join("/");
}
