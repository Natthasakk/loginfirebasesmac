import React, { useState, useEffect } from 'react';
import { Lock, User, Database, ArrowRight, Table, AlertCircle, LogOut, UserCircle, Loader2, RefreshCw } from 'lucide-react';

// ------------------------------------------------------------------
// 1. นำเข้า Firebase SDK
// ------------------------------------------------------------------
import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { getFirestore, collection, query, where, getDocs } from "firebase/firestore";

// ==========================================
// ⚠️ ส่วนที่ต้องแก้ไข (FIREBASE CONFIGURATION) ⚠️
// ==========================================
// นำค่า firebaseConfig ที่ได้จาก Firebase Console มาวางตรงนี้
const firebaseConfig = {
  apiKey: "AIzaSyDrJK-b9BepfVJyFbuEjcXEq_pbNVGWizo",
  authDomain: "loginfirebasesmac.firebaseapp.com",
  projectId: "loginfirebasesmac",
  storageBucket: "loginfirebasesmac.firebasestorage.app",
  messagingSenderId: "981441935732",
  appId: "1:981441935732:web:d105a96938175b73ffd421",
  measurementId: "G-F3Q9F390WV"
};
// ==========================================

// 2. เริ่มต้นใช้งาน Firebase
// เช็คว่าใส่ Config หรือยัง เพื่อกัน Error หน้าขาว
let auth, db;
try {
  if (firebaseConfig.apiKey && firebaseConfig.apiKey !== "AIzaSy...") {
    const app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
  }
} catch (e) {
  console.error("Firebase Init Error:", e);
}

export default function App() {
  const [view, setView] = useState('login'); 
  const [loading, setLoading] = useState(false);     
  const [dataLoading, setDataLoading] = useState(false); 
  const [error, setError] = useState('');
  
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  
  const [user, setUser] = useState(null);
  const [sheetData, setSheetData] = useState([]);

  // ฟังก์ชัน Login ด้วย Firebase
  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (!auth) {
      setError('⚠️ ยังไม่ได้ใส่ Firebase Config ในโค้ด (ดูบรรทัดที่ 15)');
      setLoading(false);
      return;
    }

    try {
      // แปลง Username เป็น Email (เพราะ Firebase บังคับใช้อีเมล)
      // สมมติว่า User พิมพ์แค่ "admin" เราจะเติม "@test.com" ให้เองอัตโนมัติ
      // หรือถ้าเขาพิมพ์อีเมลมาเต็มๆ ก็ใช้ได้เลย
      const emailToUse = username.includes('@') ? username : `${username}@test.com`;

      const userCredential = await signInWithEmailAndPassword(auth, emailToUse, password);
      const firebaseUser = userCredential.user;
      
      // ดึงชื่อ Username หน้า @ มาแสดง
      const displayUsername = firebaseUser.email.split('@')[0];

      const userData = { 
        name: displayUsername, 
        username: displayUsername, // ใช้ชื่อนี้ไป query ข้อมูล
        email: firebaseUser.email 
      };
      
      setUser(userData);
      
      // สั่งให้หมุนรอก่อนเปลี่ยนหน้า
      setDataLoading(true); 
      setView('dashboard');
      
      // ดึงข้อมูล
      fetchData(userData.username); 

    } catch (err) {
      console.error(err);
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
        setError('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
      } else {
        setError(`เกิดข้อผิดพลาด: ${err.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  // ฟังก์ชันดึงข้อมูลจาก Firestore
  const fetchData = async (currentUsername) => {
    const userToFetch = currentUsername || user?.username;
    if (!userToFetch || !db) return;

    setDataLoading(true); 
    
    try {
      // Query ข้อมูลจาก Collection "data" ที่มี field "username" ตรงกับคนล็อกอิน
      const q = query(
        collection(db, "data"), 
        where("username", "==", userToFetch)
      );

      const querySnapshot = await getDocs(q);
      
      const fetchedData = [];
      querySnapshot.forEach((doc) => {
        // นำข้อมูลออกมา และแถม ID ของเอกสารไปด้วย (เผื่อใช้)
        fetchedData.push({ id: doc.id, ...doc.data() });
      });

      setSheetData(fetchedData);

    } catch (err) {
      console.error("Failed to fetch data", err);
      // กรณี ErrorPermission (มักเกิดจากลืมตั้ง Rules หรือ Index)
      if (err.code === 'permission-denied') {
        alert("Permission Denied: ตรวจสอบ Firestore Rules ใน Console");
      }
    } finally {
      setDataLoading(false); 
    }
  };

  const handleLogout = async () => {
    if (auth) await signOut(auth);
    setUser(null);
    setSheetData([]);
    setUsername('');
    setPassword('');
    setView('login');
  };

  // ✅ Helper ฟังก์ชันสำหรับจัดการคอลัมน์ (ซ่อน id และเรียง username ไว้หน้า)
  const getVisibleColumns = () => {
    if (sheetData.length === 0) return [];
    
    // 1. ดึงคีย์ทั้งหมดออกมา
    const allKeys = Object.keys(sheetData[0]);
    
    // 2. กรอง 'id' ออก (ไม่ว่าจะ id เล็กหรือใหญ่)
    const filteredKeys = allKeys.filter(key => key.toLowerCase() !== 'id');

    // 3. ถ้ามีคอลัมน์ 'username' ให้ย้ายมาไว้ตัวแรกสุด
    if (filteredKeys.includes('username')) {
      const otherKeys = filteredKeys.filter(key => key !== 'username');
      return ['username', ...otherKeys];
    }

    return filteredKeys;
  };

  // ---------------- UI Components ----------------

  if (view === 'login') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 to-red-100 flex items-center justify-center p-4 font-sans">
        <div className="bg-white w-full max-w-md rounded-2xl shadow-xl overflow-hidden">
          <div className="bg-orange-600 p-6 text-center">
            <div className="mx-auto bg-white/20 w-16 h-16 rounded-full flex items-center justify-center mb-4 backdrop-blur-sm">
              <Database className="text-white w-8 h-8" />
            </div>
            <h2 className="text-2xl font-bold text-white">ระบบสมาชิก Firebase</h2>
            <p className="text-orange-100 text-sm mt-1">รวดเร็ว ปลอดภัย รองรับผู้ใช้ไม่จำกัด</p>
          </div>

          <form onSubmit={handleLogin} className="p-8 space-y-6">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg flex flex-col gap-1 text-sm">
                <div className="flex items-center gap-2 font-semibold">
                  <AlertCircle className="w-5 h-5" />
                  เข้าสู่ระบบไม่ได้
                </div>
                <span className="text-xs opacity-90">{error}</span>
              </div>
            )}
            
            {(!firebaseConfig.apiKey || firebaseConfig.apiKey === "AIzaSy...") && (
               <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded-lg text-sm text-center animate-pulse">
                 <b>Developer Alert:</b><br/>
                 กรุณาใส่ Firebase Config ในไฟล์ App.jsx (บรรทัดที่ 15)
               </div>
            )}

            <div className="space-y-4 pt-2">
              <div className="relative">
                <User className="absolute left-3 top-3 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  required
                  placeholder="Username (เช่น admin)"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all"
                />
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-3 text-gray-400 w-5 h-5" />
                <input
                  type="password"
                  required
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all"
                />
              </div>
              <p className="text-xs text-gray-400 text-center">
                *ระบบจะเติม @test.com ให้ username อัตโนมัติ (Mock Email)
              </p>
            </div>

            <button
              type="submit"
              disabled={loading || !auth}
              className="w-full bg-orange-600 hover:bg-orange-700 text-white font-semibold py-3 rounded-lg shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" /> 
                  กำลังตรวจสอบ...
                </>
              ) : (
                <>
                  เข้าสู่ระบบ <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center gap-2">
              <div className="bg-orange-600 p-1.5 rounded-lg">
                <Database className="text-white w-5 h-5" />
              </div>
              <span className="font-bold text-gray-800 text-lg hidden sm:block">Firebase System</span>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-sm text-gray-600 bg-gray-100 px-3 py-1.5 rounded-full border border-gray-200">
                <UserCircle className="w-4 h-4 text-orange-500" />
                <span className="hidden sm:inline">ผู้ใช้: </span>
                <b className="text-orange-700">{user?.username}</b>
              </div>
              <button
                onClick={handleLogout}
                className="text-gray-500 hover:text-red-600 transition-colors p-2"
                title="ออกจากระบบ"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">ข้อมูลส่วนตัวของคุณ (Firestore)</h1>
            <p className="text-gray-500 mt-1 text-sm">
              ดึงข้อมูลจาก Collection "data" ที่ username = <b>{user?.username}</b>
            </p>
          </div>
          <button 
            onClick={() => fetchData(user?.username)}
            disabled={dataLoading}
            className="text-sm text-orange-600 hover:text-orange-800 font-medium bg-white px-4 py-2 rounded-lg border border-gray-200 shadow-sm hover:bg-gray-50 transition-all flex items-center gap-2"
          >
             {dataLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
             รีเฟรชข้อมูล
          </button>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden min-h-[300px]">
          {dataLoading ? (
            <div className="flex flex-col items-center justify-center h-[300px] text-gray-500">
               <Loader2 className="w-10 h-10 animate-spin text-orange-600 mb-3" />
               <p className="font-medium">กำลังโหลดข้อมูลจาก Firebase...</p>
            </div>
          ) : sheetData.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    {/* ✅ ใช้ getVisibleColumns() แทน Object.keys() */}
                    {getVisibleColumns().map((header, idx) => (
                      <th key={idx} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {sheetData.map((row, idx) => (
                    <tr key={idx} className="hover:bg-gray-50 transition-colors">
                      {/* ✅ ใช้ getVisibleColumns() เพื่อให้ข้อมูลตรงกับหัวข้อ */}
                      {getVisibleColumns().map((key, cellIdx) => (
                        <td key={cellIdx} className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                          {typeof row[key] === 'object' ? JSON.stringify(row[key]) : row[key]}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full p-12 text-center text-gray-400">
              <Table className="w-16 h-16 mb-4 opacity-20" />
              <p className="text-lg font-medium text-gray-500">ไม่พบข้อมูลของคุณ</p>
              <div className="text-sm mt-3 bg-gray-50 p-4 rounded-lg max-w-md mx-auto text-left">
                <p className="font-semibold text-gray-700 mb-1">สิ่งที่ต้องตรวจสอบใน Firestore:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Collection ชื่อ <code>data</code> หรือไม่?</li>
                  <li>มี Field ชื่อ <code>username</code> ที่ค่าตรงกับ <b>"{user?.username}"</b> หรือไม่?</li>
                  <li>ถ้าเพิ่งสร้าง Database อย่าลืมเลือก <b>"Start in test mode"</b> (หรือแก้ Rules ให้ read ได้)</li>
                </ul>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}