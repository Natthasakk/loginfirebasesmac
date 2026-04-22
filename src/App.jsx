import React, { useState } from 'react';
import { Lock, User, Database, ArrowRight, AlertCircle, LogOut, UserCircle, Loader2, RefreshCw, UploadCloud, FileText, Calendar, Trash2 } from 'lucide-react';

// ------------------------------------------------------------------
// 1. นำเข้า Firebase จากไฟล์ firebase.js
// ------------------------------------------------------------------
import { auth, db, storage, firebaseConfig } from './firebase';
import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import { collection, query, where, getDocs, addDoc, deleteDoc, doc, updateDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";

export default function App() {
  const [view, setView] = useState('login'); 
  const [loading, setLoading] = useState(false);     
  const [dataLoading, setDataLoading] = useState(false);
  const [uploading, setUploading] = useState(false); 
  const [error, setError] = useState('');
  
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  
  const [user, setUser] = useState(null);
  const [sheetData, setSheetData] = useState([]);
  const [filterStatus, setFilterStatus] = useState('ทั้งหมด');

  // --- แยกข้อมูลสินค้า และ ไฟล์อัปโหลด ออกจากกัน ---
  const products = sheetData.filter(item => !item.file_url); 
  const uploads = sheetData.filter(item => item.file_url);   

  // กรองข้อมูลสินค้าตามสถานะที่เลือกใน Dropdown ด้านบน
  const filteredProducts = products.filter(item => {
    if (filterStatus === 'ทั้งหมด') return true;
    return (item.status === filterStatus || item.สถานะ === filterStatus);
  });

  // ฟังก์ชัน Login
  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (!auth) {
      setError('⚠️ Firebase ไม่สามารถเริ่มต้นได้ กรุณาตรวจสอบ API Key ในไฟล์ .env');
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
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
        setError('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
      } else if (err.code === 'auth/invalid-api-key') {
        setError('API Key ไม่ถูกต้อง กรุณาตรวจสอบไฟล์ .env');
      } else if (err.code === 'auth/network-request-failed') {
        setError('การเชื่อมต่อเครือข่ายล้มเหลว กรุณาตรวจสอบอินเทอร์เน็ต');
      } else {
        setError(`เกิดข้อผิดพลาด: ${err.message} (${err.code})`);
      }
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

  // ฟังก์ชันอัปเดตข้อมูล (แก้ไขฟิลด์ใน Firestore)
  const handleUpdateData = async (docId, field, newValue) => {
    if (!db) return;
    try {
      const docRef = doc(db, "data", docId);
      await updateDoc(docRef, { [field]: newValue });
      // อัปเดต state ทันทีเพื่อความลื่นไหล
      setSheetData(prev => prev.map(item => item.id === docId ? { ...item, [field]: newValue } : item));
    } catch (err) {
      console.error("Update failed", err);
      alert("ไม่สามารถอัปเดตข้อมูลได้: " + err.message);
    }
  };

  // ฟังก์ชันอัปโหลดไฟล์
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (uploads.length >= 1) {
      alert("คุณสามารถอัปโหลดได้เพียง 1 ไฟล์เท่านั้น\nกรุณาลบไฟล์เดิมออกก่อน");
      e.target.value = null; 
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert("ไฟล์ขนาดใหญ่เกินไป (จำกัด 5MB)");
      e.target.value = null;
      return;
    }

    setUploading(true);
    try {
      const storageRef = ref(storage, `uploads/${user.username}/${Date.now()}_${file.name}`);
      const snapshot = await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(snapshot.ref);

      await addDoc(collection(db, "data"), {
        username: user.username,
        product: file.name, 
        status: "uploaded",
        file_url: downloadURL,
        uploaded_at: new Date().toISOString()
      });

      alert("✅ อัปโหลดสำเร็จ!");
      fetchData(user.username); 

    } catch (err) {
      console.error("Upload failed", err);
      alert("การอัปโหลดล้มเหลว: " + err.message);
    } finally {
      setUploading(false);
      e.target.value = null; 
    }
  };

  // ฟังก์ชันลบไฟล์
  const handleDeleteFile = async (docId, fileUrl) => {
    if (!window.confirm("คุณต้องการลบไฟล์นี้ใช่หรือไม่?")) return;

    setDataLoading(true);
    try {
      if (fileUrl) {
        try {
          const fileRef = ref(storage, fileUrl);
          await deleteObject(fileRef);
        } catch (storageErr) {
          console.warn("ไม่สามารถลบไฟล์จาก Storage ได้", storageErr);
        }
      }

      await deleteDoc(doc(db, "data", docId));

      alert("ลบไฟล์เรียบร้อยแล้ว");
      fetchData(user.username); 

    } catch (err) {
      console.error("Delete failed", err);
      alert("เกิดข้อผิดพลาดในการลบ: " + err.message);
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

  // Helper จัดลำดับคอลัมน์ (สำหรับตารางสินค้า)
  const getProductColumns = () => {
    if (products.length === 0) return [];
    
    const allKeysSet = new Set();
    products.forEach(row => {
      Object.keys(row).forEach(key => allKeysSet.add(key));
    });
    const allKeys = Array.from(allKeysSet);

    const filteredKeys = allKeys.filter(key => 
      key.toLowerCase() !== 'id' && 
      key !== 'uploaded_at' && 
      key !== 'file_url'
    );

    const preferredOrder = ['username', 'ชื่อ-สกุล', 'ชื่อสกุล(ผู้รับ)', 'ความเกี่ยวข้อง', 'สถานะ', 'status'];
    
    return filteredKeys.sort((a, b) => {
      const indexA = preferredOrder.indexOf(a);
      const indexB = preferredOrder.indexOf(b);
      if (indexA !== -1 && indexB !== -1) return indexA - indexB;
      if (indexA !== -1) return -1;
      if (indexB !== -1) return 1;
      return a.localeCompare(b);
    });
  };

  const formatDate = (isoString) => {
    if (!isoString) return "-";
    const date = new Date(isoString);
    return date.toLocaleDateString('th-TH', {
      day: '2-digit', month: 'short', year: '2-digit',
      hour: '2-digit', minute: '2-digit'
    });
  };

  // ✅ Helper ตัดชื่อไฟล์ให้สั้นลง (แสดงหัว...ท้าย)
  const truncateFileName = (name, maxLength = 25) => {
    if (!name) return "";
    if (name.length <= maxLength) return name;
    
    // พยายามแยกนามสกุลไฟล์
    const lastDotIndex = name.lastIndexOf('.');
    if (lastDotIndex === -1) return name.substring(0, maxLength) + "..."; // ไม่มีนามสกุล

    const extension = name.substring(lastDotIndex); // .pdf, .png
    const nameWithoutExt = name.substring(0, lastDotIndex);
    
    const keepLength = maxLength - 3 - extension.length; // 3 คือจุด ...
    
    if (keepLength < 1) return name.substring(0, maxLength) + "...";
    
    return `${nameWithoutExt.substring(0, keepLength)}...${extension}`;
  };

  // ---------------- UI Components ----------------

  // ✅ รายการสถานะที่มีให้เลือกใน Dropdown
  const statusOptions = ["รอดำเนินการ", "กำลังตรวจสอบ", "สำเร็จ", "ยกเลิก"];

  if (view === 'login') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-blue-100 flex items-center justify-center p-4 font-sans">
        <div className="bg-white w-full max-w-md rounded-2xl shadow-xl overflow-hidden">
          <div className="bg-indigo-600 p-6 text-center">
            <div className="mx-auto bg-white/20 w-16 h-16 rounded-full flex items-center justify-center mb-4 backdrop-blur-sm">
              <Database className="text-white w-8 h-8" />
            </div>
            <h2 className="text-2xl font-bold text-white">ระบบสมาชิก</h2>
            <p className="text-indigo-100 text-sm mt-1">Firebase + Google Sheets</p>
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
                 กรุณาใส่ Firebase Config ในไฟล์ App.jsx
               </div>
            )}

            <div className="space-y-4 pt-2">
              <div className="relative">
                <User className="absolute left-3 top-3 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  required
                  placeholder="Username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
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
                  className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !auth}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 rounded-lg shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
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
    <div className="min-h-screen bg-gray-50 font-sans pb-10">
      <nav className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center gap-2">
              <div className="bg-indigo-600 p-1.5 rounded-lg">
                <Database className="text-white w-5 h-5" />
              </div>
              <span className="font-bold text-gray-800 text-lg sm:block">MySystem</span>
            </div>
            <div className="flex items-center gap-2 sm:gap-4">
              <div className="flex items-center gap-1 sm:gap-2 text-sm text-gray-600 bg-gray-100 px-2 sm:px-3 py-1.5 rounded-full border border-gray-200">
                <UserCircle className="w-4 h-4 text-indigo-500" />
                <span className="hidden xs:inline">ผู้ใช้: </span>
                <b className="text-indigo-700 truncate max-w-[80px] sm:max-w-none">{user?.username}</b>
              </div>
              <button
                onClick={handleLogout}
                className="text-gray-500 hover:text-red-600 transition-colors p-2 rounded-lg hover:bg-red-50"
                title="ออกจากระบบ"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6 sm:space-y-8">
        
        {/* === ส่วนหัวและปุ่มควบคุม === */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
            <p className="text-gray-500 mt-1 text-sm">
              จัดการข้อมูลและเอกสารของคุณ
            </p>
          </div>
          
          <div className="flex gap-2">
            <button 
              onClick={() => fetchData(user?.username)}
              disabled={dataLoading}
              className="flex-1 sm:flex-none text-sm text-indigo-600 hover:text-indigo-800 font-medium bg-white px-4 py-2.5 rounded-xl border border-gray-200 shadow-sm hover:bg-gray-50 transition-all flex items-center justify-center gap-2 active:scale-95"
            >
               {dataLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
               รีเฟรช
            </button>
          </div>
        </div>

        {/* === ตารางที่ 1: ข้อมูลสินค้า === */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 bg-gray-50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Database className="w-5 h-5 text-gray-400" />
              <h3 className="font-semibold text-gray-700">รายการข้อมูล (Data)</h3>
            </div>
            
            {/* ✅ Dropdown สำหรับกรองข้อมูล (ย้ายขึ้นมาไว้ด้านบน) */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500 font-medium">กรองตามสถานะ:</span>
              <select 
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all cursor-pointer shadow-sm hover:border-indigo-300"
              >
                <option value="ทั้งหมด">ทั้งหมด</option>
                {statusOptions.map(opt => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </div>
          </div>
          
          {dataLoading ? (
            <div className="flex flex-col items-center justify-center h-[200px] text-gray-500">
               <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mb-2" />
               <p className="text-sm">กำลังโหลดข้อมูล...</p>
            </div>
          ) : filteredProducts.length > 0 ? (
            <>
              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-white">
                    <tr>
                      {getProductColumns().map((header, idx) => (
                        <th key={idx} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50">
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredProducts.map((row, idx) => (
                      <tr key={idx} className="hover:bg-gray-50 transition-colors">
                        {getProductColumns().map((key, cellIdx) => (
                          <td key={cellIdx} className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                            {key === 'สถานะ' || key === 'status' ? (
                              <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                                row[key] === 'สำเร็จ' ? 'bg-green-100 text-green-700' :
                                row[key] === 'กำลังตรวจสอบ' ? 'bg-blue-100 text-blue-700' :
                                row[key] === 'ยกเลิก' ? 'bg-red-100 text-red-700' :
                                'bg-yellow-100 text-yellow-700'
                              }`}>
                                {row[key] || "รอดำเนินการ"}
                              </span>
                            ) : (
                              typeof row[key] === 'object' ? JSON.stringify(row[key]) : (row[key] || "-")
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card View */}
              <div className="md:hidden divide-y divide-gray-100">
                {filteredProducts.map((row, idx) => (
                  <div key={idx} className="p-5 space-y-3 bg-white active:bg-gray-50 transition-colors">
                    {getProductColumns().map((key, cellIdx) => (
                      <div key={cellIdx} className="flex flex-col">
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">{key}</span>
                        {key === 'สถานะ' || key === 'status' ? (
                          <div className="mt-1">
                            <span className={`px-2.5 py-1 rounded-full text-xs font-medium inline-block ${
                              row[key] === 'สำเร็จ' ? 'bg-green-100 text-green-700' :
                              row[key] === 'กำลังตรวจสอบ' ? 'bg-blue-100 text-blue-700' :
                              row[key] === 'ยกเลิก' ? 'bg-red-100 text-red-700' :
                              'bg-yellow-100 text-yellow-700'
                            }`}>
                              {row[key] || "รอดำเนินการ"}
                            </span>
                          </div>
                        ) : (
                          <span className="text-sm text-gray-800 font-medium">
                            {typeof row[key] === 'object' ? JSON.stringify(row[key]) : (row[key] || "-")}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="p-10 text-center text-gray-400 text-sm">
              ไม่พบข้อมูลรายการที่ตรงตามเงื่อนไข
            </div>
          )}
        </div>

        {/* === ตารางที่ 2: เอกสารที่อัปโหลด === */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 bg-indigo-50 flex flex-col xs:flex-row items-start xs:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-500" />
                <h3 className="font-semibold text-indigo-900">เอกสารที่อัปโหลด</h3>
            </div>
            
            <label className={`
                w-full xs:w-auto flex items-center justify-center gap-2 px-4 py-2 rounded-xl border shadow-sm transition-all cursor-pointer text-sm font-medium active:scale-95
                ${uploading ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed' : 
                  (uploads.length >= 1 ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed' : 'bg-indigo-600 text-white border-indigo-600 hover:bg-indigo-700')}
            `}
            onClick={(e) => {
              if (uploads.length >= 1) {
                e.preventDefault();
                alert("คุณมีเอกสารแล้ว 1 ไฟล์ กรุณาลบไฟล์เดิมก่อนอัปโหลดใหม่");
              }
            }}
            >
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UploadCloud className="w-4 h-4" />}
              <span>{uploading ? 'กำลังอัป...' : (uploads.length >= 1 ? 'ครบจำนวนแล้ว' : 'อัปโหลดเอกสาร')}</span>
              <input 
                type="file" 
                className="hidden" 
                onChange={handleFileUpload} 
                disabled={uploading || uploads.length >= 1}
              />
            </label>
          </div>

          {dataLoading ? (
            <div className="flex flex-col items-center justify-center h-[150px] text-gray-500">
               <Loader2 className="w-6 h-6 animate-spin text-indigo-600 mb-2" />
            </div>
          ) : uploads.length > 0 ? (
            <>
              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-white">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50 w-1/2">ชื่อเอกสาร</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50">วันที่อัปโหลด</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50 text-right">จัดการ</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {uploads.map((file, idx) => (
                      <tr key={idx} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900" title={file.product}>
                          {truncateFileName(file.product || "ไม่มีชื่อ")}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-gray-400" />
                            {formatDate(file.uploaded_at)}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right space-x-2">
                          <a 
                            href={file.file_url} 
                            target="_blank" 
                            rel="noreferrer" 
                            className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-800 font-medium border border-indigo-200 bg-indigo-50 px-3 py-1.5 rounded-lg transition-all"
                          >
                            <FileText className="w-4 h-4" /> เปิดดู
                          </a>
                          <button 
                            onClick={() => handleDeleteFile(file.id, file.file_url)}
                            className="inline-flex items-center gap-1 text-red-600 hover:text-red-800 font-medium border border-red-200 bg-red-50 px-3 py-1.5 rounded-lg transition-all"
                          >
                            <Trash2 className="w-4 h-4" /> ลบ
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card View */}
              <div className="md:hidden divide-y divide-gray-100">
                {uploads.map((file, idx) => (
                  <div key={idx} className="p-5 space-y-4 bg-white">
                    <div className="flex flex-col">
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">ชื่อเอกสาร</span>
                      <span className="text-sm font-semibold text-gray-900 break-words line-clamp-2 leading-relaxed">
                        {file.product || "ไม่มีชื่อ"}
                      </span>
                    </div>
                    
                    <div className="flex items-center justify-between items-end pt-1">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">วันที่อัปโหลด</span>
                        <span className="text-xs text-gray-600 flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {formatDate(file.uploaded_at)}
                        </span>
                      </div>
                      
                      <div className="flex gap-2">
                        <a 
                          href={file.file_url} 
                          target="_blank" 
                          rel="noreferrer" 
                          className="p-2.5 text-indigo-600 border border-indigo-100 bg-indigo-50 rounded-xl active:scale-90 transition-transform"
                          title="เปิดดู"
                        >
                          <FileText className="w-6 h-6" />
                        </a>
                        <button 
                          onClick={() => handleDeleteFile(file.id, file.file_url)}
                          className="p-2.5 text-red-600 border border-red-100 bg-red-50 rounded-xl active:scale-90 transition-transform"
                          title="ลบ"
                        >
                          <Trash2 className="w-6 h-6" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="p-10 text-center text-gray-400 text-sm">
              <UploadCloud className="w-10 h-10 mx-auto mb-2 opacity-20" />
              ยังไม่มีเอกสารที่อัปโหลด
            </div>
          )}
        </div>

      </main>
    </div>
  );
}