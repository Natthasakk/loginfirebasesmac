import React, { useState } from 'react';
import { Lock, User, Database, ArrowRight, AlertCircle, LogOut, UserCircle, Loader2, RefreshCw } from 'lucide-react';

// ------------------------------------------------------------------
// 1. นำเข้า Firebase จากไฟล์ firebase.js
// ------------------------------------------------------------------
import { auth, db, firebaseConfig } from './firebase';
import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import { collection, query, where, getDocs, doc, updateDoc } from "firebase/firestore";

export default function App() {
  const [view, setView] = useState('login'); 
  const [loading, setLoading] = useState(false);     
  const [dataLoading, setDataLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  
  const [user, setUser] = useState(null);
  const [sheetData, setSheetData] = useState([]);
  const [filterStatus, setFilterStatus] = useState('ทั้งหมด');

  // กรองข้อมูลสินค้าตามสถานะที่เลือกใน Dropdown ด้านบน
  const filteredProducts = sheetData.filter(item => {
    if (filterStatus === 'ทั้งหมด') return true;
    return (item.status === filterStatus || item.สถานะ === filterStatus);
  });

  // ฟังก์ชัน Login
  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (!auth) {
      setError('⚠️ Firebase ไม่สามารถเริ่มต้นได้ กรุณาตรวจสอบ API Key');
      setLoading(false);
      return;
    }

    try {
      const emailToUse = username.includes('@') ? username : `${username}@test.com`;
      const userCredential = await signInWithEmailAndPassword(auth, emailToUse, password);
      const firebaseUser = userCredential.user;
      const displayUsername = firebaseUser.email.split('@')[0];

      const userData = { 
        name: displayUsername, 
        username: displayUsername, 
        email: firebaseUser.email 
      };
      
      setUser(userData);
      setDataLoading(true); 
      setView('dashboard');
      fetchData(userData.username); 

    } catch (err) {
      console.error("Login error:", err);
      setError('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
    } finally {
      setLoading(false);
    }
  };

  // ฟังก์ชันดึงข้อมูล
  const fetchData = async (currentUsername) => {
    const userToFetch = currentUsername || user?.username;
    if (!userToFetch || !db) return;

    setDataLoading(true); 
    try {
      const q = query(
        collection(db, "data"), 
        where("username", "==", userToFetch)
      );
      const querySnapshot = await getDocs(q);
      const fetchedData = [];
      querySnapshot.forEach((doc) => {
        fetchedData.push({ id: doc.id, ...doc.data() });
      });
      setSheetData(fetchedData);
    } catch (err) {
      console.error("Failed to fetch data", err);
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

  // Helper จัดลำดับคอลัมน์
  const getProductColumns = () => {
    if (sheetData.length === 0) return [];
    
    const allKeysSet = new Set();
    sheetData.forEach(row => {
      Object.keys(row).forEach(key => allKeysSet.add(key));
    });
    const allKeys = Array.from(allKeysSet);

    const filteredKeys = allKeys.filter(key => 
      key.toLowerCase() !== 'id' && 
      key !== 'uploaded_at' && 
      key !== 'file_url' &&
      key !== 'username'
    );

    const preferredOrder = ['ชื่อ-สกุล', 'ชื่อสกุล(ผู้รับ)', 'ความเกี่ยวข้อง', 'สถานะ', 'status'];
    
    return filteredKeys.sort((a, b) => {
      const indexA = preferredOrder.indexOf(a);
      const indexB = preferredOrder.indexOf(b);
      if (indexA !== -1 && indexB !== -1) return indexA - indexB;
      if (indexA !== -1) return -1;
      if (indexB !== -1) return 1;
      return a.localeCompare(b);
    });
  };

  // ✅ รายการสถานะที่มีให้เลือกใน Dropdown
  const statusOptions = ["รอดำเนินการ", "กำลังตรวจสอบ", "สำเร็จ", "ยกเลิก"];

  if (view === 'login') {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-4 font-sans text-slate-900">
        <div className="w-full max-w-sm">
          <div className="text-center mb-10">
            <div className="mx-auto bg-emerald-50 w-16 h-16 rounded-2xl flex items-center justify-center mb-6 border border-emerald-100 shadow-sm">
              <Database className="text-emerald-600 w-8 h-8" />
            </div>
            <h2 className="text-2xl font-semibold tracking-tight text-slate-800">เข้าใช้งานระบบ</h2>
            <p className="text-slate-400 text-sm mt-2">กรอกข้อมูลเพื่อเข้าสู่ Dashboard ของคุณ</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            {error && (
              <div className="bg-red-50/50 border border-red-100 text-red-600 px-4 py-3 rounded-xl flex items-center gap-3 text-sm animate-in fade-in duration-300">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <span>{error}</span>
              </div>
            )}
            
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-500 ml-1">ชื่อผู้ใช้งาน</label>
                <div className="relative">
                  <User className="absolute left-3.5 top-3.5 text-slate-300 w-4 h-4" />
                  <input
                    type="text"
                    required
                    placeholder="Username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-50 focus:border-emerald-200 outline-none transition-all placeholder:text-slate-300 text-sm"
                  />
                </div>
              </div>
              
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-500 ml-1">รหัสผ่าน</label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-3.5 text-slate-300 w-4 h-4" />
                  <input
                    type="password"
                    required
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-50 focus:border-emerald-200 outline-none transition-all placeholder:text-slate-300 text-sm"
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !auth}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-3.5 rounded-xl shadow-sm shadow-emerald-200 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed mt-2"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" /> 
              ) : (
                <>
                  เข้าสู่ระบบ <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
          
          <p className="text-center text-slate-400 text-xs mt-10">
            &copy; {new Date().getFullYear()} MySystem. All rights reserved.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white font-sans text-slate-900 pb-20">
      <nav className="bg-white/80 backdrop-blur-md sticky top-0 z-20 border-b border-slate-50">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex justify-between h-20">
            <div className="flex items-center gap-3">
              <div className="bg-emerald-600 p-2 rounded-xl">
                <Database className="text-white w-5 h-5" />
              </div>
              <span className="font-semibold text-slate-800 text-lg tracking-tight">MySystem</span>
            </div>
            <div className="flex items-center gap-6">
              <div className="hidden sm:flex items-center gap-2.5 text-sm text-slate-500 bg-emerald-50/50 px-4 py-2 rounded-full border border-emerald-100">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                <span className="font-medium text-emerald-800">{user?.username}</span>
              </div>
              <button
                onClick={handleLogout}
                className="text-slate-400 hover:text-rose-500 transition-colors p-2 rounded-xl hover:bg-rose-50"
                title="ออกจากระบบ"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-6 py-12 space-y-12">
        
        {/* === Header Section === */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-1">
            <h1 className="text-4xl font-bold tracking-tight text-slate-900">Dashboard</h1>
            <p className="text-slate-400 font-medium">จัดการและติดตามสถานะข้อมูลของคุณ</p>
          </div>
          
          <div className="flex items-center gap-3">
            <button 
              onClick={() => fetchData(user?.username)}
              disabled={dataLoading}
              className="flex-1 md:flex-none text-sm font-semibold text-emerald-700 bg-emerald-50 px-6 py-3 rounded-xl border border-emerald-100 hover:bg-emerald-100 transition-all flex items-center justify-center gap-2 active:scale-[0.98]"
            >
               {dataLoading ? <Loader2 className="w-4 h-4 animate-spin text-emerald-400" /> : <RefreshCw className="w-4 h-4" />}
               รีเฟรชข้อมูล
            </button>
          </div>
        </div>

        {/* === Data Table Section === */}
        <section className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-50 rounded-lg">
                <Database className="w-5 h-5 text-emerald-500" />
              </div>
              <h3 className="text-xl font-bold text-slate-800">รายการข้อมูลในระบบ</h3>
            </div>
            
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">สถานะ</span>
              <select 
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="bg-slate-50 border border-slate-100 rounded-xl px-4 py-2 text-sm font-medium focus:ring-4 focus:ring-emerald-50/50 outline-none transition-all cursor-pointer hover:bg-slate-100"
              >
                <option value="ทั้งหมด">แสดงทั้งหมด</option>
                {statusOptions.map(opt => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </div>
          </div>
          
          <div className="bg-white rounded-3xl overflow-hidden border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.02)]">
            {dataLoading ? (
              <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                 <Loader2 className="w-10 h-10 animate-spin text-emerald-100 mb-4" />
                 <p className="text-sm font-medium">กำลังโหลดข้อมูล...</p>
              </div>
            ) : filteredProducts.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-50">
                  <thead>
                    <tr className="bg-slate-50/50">
                      {getProductColumns().map((header, idx) => (
                        <th key={idx} className="px-8 py-5 text-left text-[11px] font-bold text-slate-400 uppercase tracking-[0.15em]">
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {filteredProducts.map((row, idx) => (
                      <tr key={idx} className="group hover:bg-emerald-50/10 transition-colors">
                        {getProductColumns().map((key, cellIdx) => (
                          <td key={cellIdx} className="px-8 py-6 whitespace-nowrap text-sm text-slate-600 font-medium">
                            {key === 'สถานะ' || key === 'status' ? (
                              <span className={`inline-flex items-center px-3 py-1 rounded-full text-[11px] font-bold tracking-wider uppercase ${
                                row[key] === 'สำเร็จ' ? 'bg-emerald-50 text-emerald-600' :
                                row[key] === 'กำลังตรวจสอบ' ? 'bg-amber-50 text-amber-600' :
                                row[key] === 'ยกเลิก' ? 'bg-rose-50 text-rose-600' :
                                'bg-slate-100 text-slate-500'
                              }`}>
                                {row[key] || "รอดำเนินการ"}
                              </span>
                            ) : (
                              row[key] || "—"
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="py-24 text-center">
                <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Database className="w-10 h-10 text-slate-200" />
                </div>
                <p className="text-slate-400 font-medium text-lg">ไม่พบข้อมูลที่ค้นหา</p>
                <button 
                  onClick={() => setFilterStatus('ทั้งหมด')}
                  className="mt-4 text-emerald-600 font-semibold text-sm hover:underline"
                >
                  ล้างตัวกรองทั้งหมด
                </button>
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}