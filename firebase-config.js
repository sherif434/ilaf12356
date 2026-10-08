import { initializeApp } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyDaJ9_shSd3i9CYM_mIp4B6Jga_N4W6Ce4",
  authDomain: "morocan-shop.firebaseapp.com",
  projectId: "morocan-shop",
  storageBucket: "morocan-shop.firebasestorage.app",
  messagingSenderId: "142322301906",
  appId: "1:142322301906:web:95e6619b64e4e7ff46e60b",
  measurementId: "G-496TVVGK2Z"
};

const firebaseApp = initializeApp(firebaseConfig);
export const firebaseAuth = getAuth(firebaseApp);
export default firebaseApp;
