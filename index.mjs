import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";

const app = express();
app.use(cors());
app.use(bodyParser.json({ limit: "200mb" })); // allow large base64 files

// S3 config
const s3 = new S3Client({
  region: process.env.AWS_S3_REGION,
  credentials: {
    accessKeyId: process.env.AWS_S3_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_S3_SECRET_ACCESS_KEY,
  },
});

const BUCKET = process.env.AWS_S3_BUCKET_NAME;

// ✅ Upload endpoint (base64)
app.post("/upload", async (req, res) => {
  try {
    const { fileName, fileType, domainId, fileBase64 } = req.body;
    if (!fileName || !fileType || !domainId || !fileBase64) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const dateFolder = new Date().toISOString().split("T")[0];
    const formattedFileName = fileName.replace(/[^a-zA-Z0-9.]/g, "_");
    const s3Key = `${domainId}/${dateFolder}/${formattedFileName}`;

    const buffer = Buffer.from(fileBase64, "base64");

    const uploadParams = {
      Bucket: BUCKET,
      Key: s3Key,
      Body: buffer,
      ContentType: fileType,
      ContentDisposition: "attachment",
    };

    await s3.send(new PutObjectCommand(uploadParams));

    const resolvedRegion = await s3.config.region();
    const fileUrl = `https://${BUCKET}.s3.${resolvedRegion}.amazonaws.com/${s3Key}`;

    return res.json({ success: true, fileUrl, s3Key });
  } catch (err) {
    console.error("Upload error:", err);
    return res.status(500).json({ error: "Upload failed", details: err.message });
  }
});

// ✅ Delete endpoint
app.delete("/upload", async (req, res) => {
  try {
    const s3Key = req.query.s3Key;
    if (!s3Key) return res.status(400).json({ error: "Missing s3Key" });

    const deleteParams = {
      Bucket: BUCKET,
      Key: s3Key,
    };

    await s3.send(new DeleteObjectCommand(deleteParams));
    return res.json({ success: true });
  } catch (err) {
    console.error("Delete error:", err);
    return res.status(500).json({ error: "Delete failed", details: err.message });
  }
});


// 🟢 Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Upload server running on http://localhost:${PORT}`);
});
