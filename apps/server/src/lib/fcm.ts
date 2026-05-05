import admin from 'firebase-admin';

let initialized = false;

function normalizePrivateKey(rawKey: string) {
  return rawKey.replace(/\\n/g, '\n');
}

export function isFcmConfigured() {
  return !!(
    process.env.FCM_PROJECT_ID &&
    process.env.FCM_CLIENT_EMAIL &&
    process.env.FCM_PRIVATE_KEY
  );
}

export function getFirebaseApp() {
  if (!isFcmConfigured()) {
    throw new Error('FCM is not configured');
  }

  if (!initialized) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FCM_PROJECT_ID,
        clientEmail: process.env.FCM_CLIENT_EMAIL,
        privateKey: normalizePrivateKey(process.env.FCM_PRIVATE_KEY!),
      }),
    });
    initialized = true;
  }

  return admin.app();
}

export async function sendDataNotification(params: {
  token: string;
  title: string;
  body: string;
  data?: Record<string, string>;
}) {
  const app = getFirebaseApp();
  const messaging = app.messaging();
  return messaging.send({
    token: params.token,
    notification: {
      title: params.title,
      body: params.body,
    },
    data: params.data ?? {},
    android: {
      priority: 'high',
      notification: {
        sound: 'default',
      },
    },
  });
}

