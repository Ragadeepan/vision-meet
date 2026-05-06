const admin = require("firebase-admin");

let firebaseAdminApp = null;

const getFirebaseAdminApp = () => {
  if (firebaseAdminApp) {
    return firebaseAdminApp;
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;

  if (!projectId) {
    return null;
  }

  firebaseAdminApp = admin.apps.length
    ? admin.app()
    : admin.initializeApp({
        projectId
      });

  return firebaseAdminApp;
};

const verifyFirebaseToken = async (token) => {
  const app = getFirebaseAdminApp();
  if (!app) {
    return null;
  }

  return admin.auth(app).verifyIdToken(token);
};

module.exports = { verifyFirebaseToken };
