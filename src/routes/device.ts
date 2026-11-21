import express, { Request, Response } from "express";
import crypto from "crypto";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

const router = express.Router();

function formatUserCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let raw = "";
  const bytes = crypto.randomBytes(8);
  for (let i = 0; i < 8; i++) {
    raw += chars[bytes[i] % chars.length];
  }
  return `${raw.slice(0, 4)}-${raw.slice(4, 8)}`;
}

// POST /api/device/authorize — TV requests pairing code
router.post("/authorize", async (req: Request, res: Response) => {
  try {
    const clientId = String(req.body?.clientId || "innova-tv").trim();
    const clientName = String(req.body?.clientName || "Innova Smart TV").trim();
    const deviceCode = `dc_${crypto.randomBytes(18).toString("hex")}`;
    const userCode = formatUserCode();
    const now = Date.now();
    const expiresAt = now + 15 * 60 * 1000;

    const db = getFirestore();
    await db.collection("tv_device_sessions").doc(deviceCode).set({
      deviceCode,
      userCode,
      clientId,
      clientName,
      status: "pending",
      userName: null,
      walletAddress: null,
      accessToken: null,
      createdAt: new Date(now).toISOString(),
      expiresAt,
    });

    res.status(200).json({
      device_code: deviceCode,
      user_code: userCode,
      verification_uri: "https://innova-universal-dashboard.vercel.app/?activate=" + encodeURIComponent(userCode),
      expires_in: 900,
      interval: 4,
    });
  } catch (error) {
    console.error("[TV DEVICE AUTH] authorize error:", error);
    res.status(500).json({ error: "Failed to create TV device authorization code" });
  }
});

// GET /api/device/status/:userCode — Dashboard checks TV pairing code before user clicks Authorize
router.get("/status/:userCode", async (req: Request, res: Response) => {
  try {
    const rawCode = String(req.params.userCode || "").trim().toUpperCase();
    const clean = rawCode.replace(/[^A-Z0-9]/g, "");
    const formatted = clean.length === 8 ? `${clean.slice(0, 4)}-${clean.slice(4, 8)}` : rawCode;

    const db = getFirestore();
    const snap = await db
      .collection("tv_device_sessions")
      .where("userCode", "==", formatted)
      .limit(1)
      .get();

    if (snap.empty) {
      res.status(404).json({ error: "Invalid or expired TV pairing code" });
      return;
    }

    const data = snap.docs[0].data();
    if (Date.now() > Number(data.expiresAt || 0)) {
      res.status(410).json({ error: "TV pairing code has expired. Generate a new code on your TV." });
      return;
    }

    res.json({
      user_code: data.userCode,
      client_id: data.clientId,
      client_name: data.clientName,
      status: data.status,
      expires_in: Math.max(0, Math.floor((Number(data.expiresAt) - Date.now()) / 1000)),
    });
  } catch (error) {
    console.error("[TV DEVICE AUTH] status error:", error);
    res.status(500).json({ error: "Failed checking TV device code" });
  }
});

// POST /api/device/authorize-user — Dashboard user approves or denies TV pairing
router.post("/authorize-user", async (req: Request, res: Response) => {
  try {
    const rawCode = String(req.body?.userCode || "").trim().toUpperCase();
    const clean = rawCode.replace(/[^A-Z0-9]/g, "");
    const formatted = clean.length === 8 ? `${clean.slice(0, 4)}-${clean.slice(4, 8)}` : rawCode;
    const rawUser = String(req.body?.userId || req.body?.userName || "").trim();
    const action = String(req.body?.action || "authorize").toLowerCase();
    const walletAddress = String(req.body?.walletAddress || "").trim().toLowerCase();

    if (!formatted || !rawUser) {
      res.status(400).json({ error: "userCode and authenticated @USER.NAME are required" });
      return;
    }

    const formattedHandle = rawUser.startsWith("@") ? rawUser.toUpperCase() : `@${rawUser.toUpperCase()}`;
    const db = getFirestore();
    const snap = await db
      .collection("tv_device_sessions")
      .where("userCode", "==", formatted)
      .limit(1)
      .get();

    if (snap.empty) {
      res.status(404).json({ error: "TV pairing session not found" });
      return;
    }

    const docRef = snap.docs[0].ref;
    const session = snap.docs[0].data();

    if (Date.now() > Number(session.expiresAt || 0)) {
      res.status(410).json({ error: "TV pairing code expired" });
      return;
    }

    if (action === "deny") {
      await docRef.update({ status: "denied", updatedAt: new Date().toISOString() });
      res.json({ success: true, status: "denied" });
      return;
    }

    const accessToken = `rc_tv_${crypto.randomBytes(24).toString("hex")}`;
    await docRef.update({
      status: "authorized",
      userName: formattedHandle,
      walletAddress: walletAddress || null,
      accessToken,
      authorizedAt: new Date().toISOString(),
    });

    res.json({
      success: true,
      status: "authorized",
      device_name: session.clientName,
      userName: formattedHandle,
    });
  } catch (error) {
    console.error("[TV DEVICE AUTH] authorize-user error:", error);
    res.status(500).json({ error: "Failed authorizing TV device" });
  }
});

// POST /api/device/token — TV polls for access token
router.post("/token", async (req: Request, res: Response) => {
  try {
    const deviceCode = String(req.body?.device_code || req.body?.deviceCode || "").trim();
    if (!deviceCode) {
      res.status(400).json({ error: "invalid_grant", error_description: "device_code is required" });
      return;
    }

    const db = getFirestore();
    const docSnap = await db.collection("tv_device_sessions").doc(deviceCode).get();
    if (!docSnap.exists) {
      res.status(400).json({ error: "invalid_grant", error_description: "Unknown device_code" });
      return;
    }

    const data = docSnap.data()!;
    if (Date.now() > Number(data.expiresAt || 0)) {
      res.status(400).json({ error: "expired_device_code", error_description: "Device code expired" });
      return;
    }

    if (data.status === "denied") {
      res.status(400).json({ error: "access_denied", error_description: "User denied authorization" });
      return;
    }

    if (data.status !== "authorized" || !data.accessToken) {
      res.status(400).json({ error: "authorization_pending", error_description: "Waiting for user authorization" });
      return;
    }

    res.json({
      access_token: data.accessToken,
      token_type: "Bearer",
      expires_in: 2592000,
      userName: data.userName,
      walletAddress: data.walletAddress || "",
    });
  } catch (error) {
    console.error("[TV DEVICE AUTH] token poll error:", error);
    res.status(500).json({ error: "server_error" });
  }
});

// POST /api/device/upload-url — V4 Signed Cloud Storage Upload URL for large MP4s, Posters & HTML5 Games
router.post("/upload-url", async (req: Request, res: Response) => {
  try {
    const fileName = String(req.body?.fileName || "asset.mp4").replace(/[^a-zA-Z0-9._-]/g, "_");
    const contentType = String(req.body?.contentType || "video/mp4");
    const tenant = String(req.body?.tenant || "StreamShare").replace(/[^a-zA-Z0-9]/g, "");
    const projectId = (process.env.FIREBASE_PROJECT_ID || "innova-ecosystem").trim().replace(/^['"]+|['"]+$/g, "");
    const candidates = [
      process.env.FIREBASE_STORAGE_BUCKET,
      `${projectId}.firebasestorage.app`,
      `${projectId}.appspot.com`,
    ].filter(Boolean) as string[];

    let activeBucket: any = null;
    for (const bName of candidates) {
      try {
        const b = getStorage().bucket(bName.trim().replace(/^['"]+|['"]+$/g, ""));
        const [exists] = await b.exists();
        if (exists) {
          activeBucket = b;
          break;
        }
      } catch {}
    }

    if (!activeBucket) {
      res.status(503).json({
        error: "STORAGE_BUCKET_NOT_INITIALIZED",
        message: "Enable Firebase Storage in Firebase Console -> innova-ecosystem -> Storage -> Get started, or provide a direct HTTPS stream URL.",
      });
      return;
    }

    const objectPath = `uploads/${tenant}/${Date.now()}_${fileName}`;
    const file = activeBucket.file(objectPath);

    const [uploadUrl] = await file.getSignedUrl({
      version: "v4",
      action: "write",
      expires: Date.now() + 30 * 60 * 1000,
      contentType,
    });

    const [readUrl] = await file.getSignedUrl({
      version: "v4",
      action: "read",
      expires: Date.now() + 7 * 24 * 60 * 60 * 1000,
    });

    const encodedPath = encodeURIComponent(objectPath);
    const firebasePublicUrl = `https://firebasestorage.googleapis.com/v0/b/${activeBucket.name}/o/${encodedPath}?alt=media`;

    res.json({
      uploadUrl,
      publicUrl: firebasePublicUrl,
      signedReadUrl: readUrl,
      objectPath,
      bucket: activeBucket.name,
    });
  } catch (error) {
    console.error("[MEDIA UPLOAD URL] error:", error);
    res.status(500).json({ error: "Failed generating signed upload URL" });
  }
});

export default router;
