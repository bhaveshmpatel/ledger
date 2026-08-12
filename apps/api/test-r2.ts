import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const client = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID as string,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY as string,
  },
});

async function run() {
  try {
    const command = new PutObjectCommand({
      Bucket: process.env.R2_BUCKET,
      Key: "test.jpg",
      ContentType: "image/jpeg",
    });
    const url = await getSignedUrl(client, command, { expiresIn: 60 });
    console.log("Presigned URL:", url);

    const res = await fetch(url, {
      method: "PUT",
      headers: { "Content-Type": "image/jpeg" },
      body: "test content"
    });
    console.log("Upload Status:", res.status, res.statusText);
  } catch (e) {
    console.error(e);
  }
}
run();
