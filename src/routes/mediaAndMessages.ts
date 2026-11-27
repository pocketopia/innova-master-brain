import crypto from "crypto";
import express, { Request, Response } from "express";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

const router = express.Router();

async function resolveActiveStorageBucket(): Promise<any | null> {
  const projectId = (process.env.FIREBASE_PROJECT_ID || "innova-ecosystem").trim().replace(/^['"]+|['"]+$/g, "");
  const candidates = [
    process.env.FIREBASE_STORAGE_BUCKET,
    `${projectId}.firebasestorage.app`,
    `${projectId}.appspot.com`,
  ].filter(Boolean) as string[];

  for (const bName of candidates) {
    try {
      const b = getStorage().bucket(bName.trim().replace(/^['"]+|['"]+$/g, ""));
      const [exists] = await b.exists();
      if (exists) return b;
    } catch {}
  }
  return null;
}

/**
 * POST /api/media/init
 * Initializes a real binary upload session (supports multi-chunk MP4/MOV/JPG/WebGL files)
 */
router.post("/media/init", async (req: Request, res: Response) => {
  try {
    const fileName = String(req.body?.fileName || "master.mp4").replace(/[^a-zA-Z0-9._-]/g, "_");
    const contentType = String(req.body?.contentType || "video/mp4");
    const totalBytes = Number(req.body?.totalBytes || 0);
    const totalChunks = Number(req.body?.totalChunks || 1);
    const tenant = String(req.body?.tenant || "StreamShare").replace(/[^a-zA-Z0-9]/g, "");

    const assetId = `${tenant.toLowerCase()}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const extMatch = fileName.match(/\.[a-zA-Z0-9]{2,5}$/);
    const ext = extMatch ? extMatch[0].toLowerCase() : (contentType.includes("image") ? ".jpg" : ".mp4");

    const bucket = await resolveActiveStorageBucket();
    if (bucket) {
      const objectPath = `uploads/${tenant}/${assetId}_${fileName}`;
      const downloadToken = crypto.randomUUID();
      const file = bucket.file(objectPath);
      const [uploadUrl] = await file.getSignedUrl({
        version: "v4",
        action: "write",
        expires: Date.now() + 4 * 60 * 60 * 1000,
        contentType,
      });
      const encodedPath = objectPath.split("/").map((seg) => encodeURIComponent(seg)).join("/");
      const permanentUrl = `https://storage.googleapis.com/${bucket.name}/${encodedPath}`;
      res.json({
        mode: "gcs_signed",
        assetId,
        objectPath,
        downloadToken,
        uploadUrl,
        publicUrl: permanentUrl,
      });
      return;
    }

    const db = getFirestore();
    await db.collection("ecosystem_media_assets").doc(assetId).set({
      assetId,
      fileName,
      ext,
      contentType,
      totalBytes,
      totalChunks,
      uploadedChunks: 0,
      tenant,
      status: "uploading",
      createdAt: new Date().toISOString(),
    });

    const hostProto = req.headers["x-forwarded-proto"] || req.protocol || "https";
    const hostName = req.headers["x-forwarded-host"] || req.get("host") || "innova-master-brain-api.onrender.com";
    const streamUrl = `${hostProto}://${hostName}/api/media/stream/${assetId}${ext}`;

    res.json({
      mode: "chunked_cloud",
      assetId,
      chunkSizeLimit: 700000,
      publicUrl: streamUrl,
    });
  } catch (err: any) {
    console.error("[MEDIA INIT ERROR]", err);
    res.status(500).json({ error: "Failed initializing cloud media upload", message: err?.message });
  }
});

/**
 * POST /api/media/chunk
 * Receives a real binary base64 chunk (<= 700 KB raw) and stores in Firestore
 */
router.post("/media/chunk", async (req: Request, res: Response) => {
  try {
    const assetId = String(req.body?.assetId || "").trim();
    const chunkIndex = Number(req.body?.chunkIndex ?? -1);
    const dataB64 = String(req.body?.dataB64 || "");
    const isFinal = Boolean(req.body?.isFinal);

    if (!assetId || chunkIndex < 0 || !dataB64) {
      res.status(400).json({ error: "assetId, chunkIndex, and dataB64 are required" });
      return;
    }

    const db = getFirestore();
    const chunkBuf = Buffer.from(dataB64, "base64");
    const paddedIdx = String(chunkIndex).padStart(5, "0");

    await db
      .collection("ecosystem_media_assets")
      .doc(assetId)
      .collection("chunks")
      .doc(paddedIdx)
      .set({
        chunkIndex,
        byteLength: chunkBuf.length,
        bytes: chunkBuf,
      });

    if (isFinal) {
      await db.collection("ecosystem_media_assets").doc(assetId).set(
        { status: "ready", completedAt: new Date().toISOString() },
        { merge: true }
      );
    }

    res.json({ success: true, assetId, chunkIndex, receivedBytes: chunkBuf.length });
  } catch (err: any) {
    console.error("[MEDIA CHUNK ERROR]", err);
    res.status(500).json({ error: "Failed storing media chunk", message: err?.message });
  }
});

/**
 * GET /api/media/stream/:assetWithExt
 * Streams stored video/image with full HTTP 206 Partial Content Range support for HTML5 <video> & Fire TV!
 */
const memoryMediaCache = new Map<string, { buf: Buffer; contentType: string; cachedAt: number }>();

router.get("/media/stream/:assetWithExt", async (req: Request, res: Response) => {
  try {
    const rawParam = String(req.params.assetWithExt || "");
    const assetId = rawParam.replace(/\.[a-zA-Z0-9]{2,5}$/, "");

    let entry = memoryMediaCache.get(assetId);
    if (!entry) {
      const db = getFirestore();
      const metaSnap = await db.collection("ecosystem_media_assets").doc(assetId).get();
      if (!metaSnap.exists) {
        res.status(404).send("Media asset not found");
        return;
      }
      const meta = metaSnap.data()!;
      const chunksSnap = await db
        .collection("ecosystem_media_assets")
        .doc(assetId)
        .collection("chunks")
        .orderBy("chunkIndex", "asc")
        .get();

      const buffers: Buffer[] = [];
      chunksSnap.forEach((doc) => {
        const d = doc.data();
        if (d.bytes) {
          buffers.push(Buffer.isBuffer(d.bytes) ? d.bytes : Buffer.from(d.bytes.toUint8Array ? d.bytes.toUint8Array() : d.bytes));
        }
      });

      const fullBuf = Buffer.concat(buffers);
      entry = {
        buf: fullBuf,
        contentType: meta.contentType || "video/mp4",
        cachedAt: Date.now(),
      };
      if (memoryMediaCache.size >= 12) {
        const oldestKey = memoryMediaCache.keys().next().value;
        if (oldestKey) memoryMediaCache.delete(oldestKey);
      }
      memoryMediaCache.set(assetId, entry);
    }

    const total = entry.buf.length;
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Accept-Ranges", "bytes");
    res.setHeader("Content-Type", entry.contentType);
    res.setHeader("Cache-Control", "public, max-age=86400");

    const range = req.headers.range;
    if (range) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? Math.min(total - 1, parseInt(parts[1], 10)) : total - 1;
      if (start >= total || isNaN(start)) {
        res.status(416).setHeader("Content-Range", `bytes */${total}`).end();
        return;
      }
      const chunkSize = end - start + 1;
      res.writeHead(206, {
        "Content-Range": `bytes ${start}-${end}/${total}`,
        "Content-Length": chunkSize,
      });
      res.end(entry.buf.subarray(start, end + 1));
      return;
    }

    res.setHeader("Content-Length", total);
    res.status(200).end(entry.buf);
  } catch (err: any) {
    console.error("[MEDIA STREAM ERROR]", err);
    res.status(500).send("Media stream error");
  }
});

/**
 * GET /api/messages
 * Fetches real Firestore messages across 'dashboard' or 'platform_live' (Golden StreamShare Live)
 */
router.get("/messages", async (req: Request, res: Response) => {
  try {
    const rawHandle = String(req.query.handle || req.headers["x-user-name"] || "").trim().toUpperCase();
    const handle = rawHandle ? (rawHandle.startsWith("@") ? rawHandle : `@${rawHandle}`) : "";
    const channelFilter = String(req.query.channel || "").trim();
    const projectIdFilter = String(req.query.projectId || "").trim();

    const db = getFirestore();
    const snap = await db.collection("ecosystem_messages").orderBy("createdAtIso", "asc").limit(250).get();

    const list = snap.docs
      .map((d) => ({ id: d.id, ...d.data() } as any))
      .filter((m) => {
        if (channelFilter && m.channel !== channelFilter) return false;
        if (projectIdFilter && m.projectId !== projectIdFilter) return false;
        if (handle && handle !== "@TICKER" && handle !== "@ADMIN") {
          return (
            String(m.from || "").toUpperCase() === handle ||
            String(m.to || "").toUpperCase() === handle ||
            String(m.to || "").toUpperCase() === "@ALL"
          );
        }
        return true;
      });

    res.json({ messages: list });
  } catch (err: any) {
    console.error("[MESSAGES GET ERROR]", err);
    res.json({ messages: [] });
  }
});

/**
 * POST /api/messages
 * Persists a real message in Firestore across 'dashboard' or 'platform_live'
 */
router.post("/messages", async (req: Request, res: Response) => {
  try {
    const norm = (h: string) => {
      const c = String(h || "").trim().toUpperCase().replace(/^@+/, "");
      return c ? `@${c}` : "@CLIENT";
    };
    const from = norm(req.body?.from || String(req.headers["x-user-name"] || "@CLIENT"));
    const to = norm(req.body?.to || "@TICKER");
    const content = String(req.body?.content || req.body?.text || "").trim();
    const rawCh = String(req.body?.channel || "dashboard");
    const channel = rawCh === "platform_live" ? "platform_live" : (rawCh === "telegram" ? "telegram" : "dashboard");
    const projectId = String(req.body?.projectId || "");
    const projectTitle = String(req.body?.projectTitle || "StreamShare Delivery");
    const timecode = String(req.body?.timecode || "");

    if (!content) {
      res.status(400).json({ error: "Message content cannot be empty" });
      return;
    }

    const id = String(req.body?.id || `msg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`);
    const nowIso = new Date().toISOString();
    const docData = {
      id,
      tenant: "StreamShare",
      channel,
      from,
      to,
      content,
      projectId,
      projectTitle,
      timecode,
      isRead: false,
      createdAtIso: nowIso,
      timestamp: nowIso,
    };

    const db = getFirestore();
    await db.collection("ecosystem_messages").doc(id).set(docData);
    res.status(201).json({ success: true, message: docData });
  } catch (err: any) {
    console.error("[MESSAGES POST ERROR]", err);
    res.status(500).json({ error: "Failed saving message" });
  }
});


router.post("/media/finalize", async (req: Request, res: Response) => {
  try {
    const objectPath = String(req.body?.objectPath || "").trim();
    if (!objectPath) {
      res.status(400).json({ error: "objectPath required" });
      return;
    }
    const bucket = await resolveActiveStorageBucket();
    if (!bucket) {
      res.status(503).json({ error: "Storage bucket unavailable" });
      return;
    }
    const file = bucket.file(objectPath);
    await file.makePublic().catch(() => {});
    await file.setMetadata({
      cacheControl: "public, max-age=31536000",
    }).catch(() => {});
    const encodedPath = objectPath.split("/").map((seg) => encodeURIComponent(seg)).join("/");
    const permanentUrl = `https://storage.googleapis.com/${bucket.name}/${encodedPath}`;
    res.json({ success: true, publicUrl: permanentUrl });
  } catch (err: any) {
    console.error("[MEDIA FINALIZE ERROR]", err);
    res.status(500).json({ error: "Failed finalizing cloud object metadata", message: err?.message });
  }
});


router.patch("/messages/:id/read", async (req: Request, res: Response) => {
  try {
    const db = getFirestore();
    const msgId = String(req.params.id || "").trim();
    if (!msgId) {
      res.status(400).json({ error: "Message ID required" });
      return;
    }
    await db.collection("ecosystem_messages").doc(msgId).set({ isRead: true }, { merge: true });
    res.json({ success: true, id: msgId });
  } catch (err: any) {
    res.status(500).json({ error: "Failed marking message read", message: err?.message });
  }
});

export default router;
