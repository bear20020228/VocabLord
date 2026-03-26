// ==========================================
// 🚀 第一部分：核心變數、初始化與 Firebase 同步
// ==========================================

import { doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-firestore.js";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-auth.js";

// --- [新增] 美化版確認彈窗 ---
function showBeautifulConfirmModal(message, callback) {
    const overlay = document.createElement('div');
    overlay.id = 'custom-confirm-overlay';
    overlay.style = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0,0,0,0.7); display: flex; justify-content: center; align-items: center;
        z-index: 10000; opacity: 0; transition: opacity 0.2s;
    `;

    const modal = document.createElement('div');
    modal.style = `
        background: white; padding: 25px; border-radius: 20px;
        width: 320px; text-align: center; box-shadow: 0 10px 30px rgba(0,0,0,0.3);
        transform: translateY(20px); transition: transform 0.2s;
    `;

    modal.innerHTML = `
        <h3 style="margin-top:0; color: #2c3e50;">確認複習</h3>
        <p style="color: #7f8c8d; line-height: 1.5;">${message}</p>
        <div style="display: flex; gap: 10px; margin-top: 20px;">
            <button id="confirm-cancel" style="flex:1; padding: 12px; border-radius: 10px; border: 2px solid #bdc3c7; background: white; font-weight: bold; cursor: pointer;">取消</button>
            <button id="confirm-ok" style="flex:1; padding: 12px; border-radius: 10px; border: none; background: #3498db; color: white; font-weight: bold; cursor: pointer; box-shadow: 0 4px 0 #2980b9;">確定</button>
        </div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    // 動態效果
    setTimeout(() => {
        overlay.style.opacity = '1';
        modal.style.transform = 'translateY(0)';
    }, 10);

    const close = (result) => {
        overlay.style.opacity = '0';
        modal.style.transform = 'translateY(20px)';
        setTimeout(() => {
            overlay.remove();
            callback(result);
        }, 200);
    };

    document.getElementById('confirm-ok').onclick = () => close(true);
    document.getElementById('confirm-cancel').onclick = () => close(false);
}


const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// 替換原本的 let COLS = 10; let ROWS = 10;
let COLS = window.innerWidth <= 1024 ? 8 : 10;
let ROWS = window.innerWidth <= 1024 ? 12 : 10;
let TILE_SIZE = 64;
let offsetX = 0;
let offsetY = 0;
// 🌤️ 雲朵系統參數
let clouds = [
    { x: 10, y: 30, speed: 0.2, scale: 1 },
    { x: 200, y: 10, speed: 0.15, scale: 0.8 },
    { x: -50, y: 60, speed: 0.25, scale: 1.2 }
];

let currentUser = "";
let gameState = {
    coins: 100, energy: 100, combo: 0,
    currentRealm: 'english', // <--- 加在這裡
    inventory: { carrot: 0, tomato: 0, radish: 0 },
    farmTiles: [], difficulty: "1", currentPet: "pig", 
    currentSeed: "carrot", 
    petsOwned: ["pig"], 
    petStats: { pig: { lv: 1, exp: 0 }, fox: { lv: 1, exp: 0 }, cat: { lv: 1, exp: 0 } },
    isPro: false,
    mistakes: {},
    wordStats: {}, 
    graduated: {}  
};

function migrateGrid() {
    // 1. 原本的農場網格存檔修復
    if (!gameState.farmTiles || gameState.farmTiles.length !== ROWS || !gameState.farmTiles[0] || gameState.farmTiles[0].length !== COLS) {
        let newTiles = Array.from({length: ROWS}, () => Array.from({length: COLS}, () => ({ plant: false, type: null, progress: 0 })));
        if (gameState.farmTiles && gameState.farmTiles.length > 0) {
            for(let y = 0; y < Math.min(ROWS, gameState.farmTiles.length); y++) {
                for(let x = 0; x < Math.min(COLS, gameState.farmTiles[y].length); x++) {
                    newTiles[y][x] = gameState.farmTiles[y][x];
                }
            }
        }
        gameState.farmTiles = newTiles;
    }

    // 🌟 2. [新增] 寵物存檔防呆與自動修復
    if (!gameState.petStats) gameState.petStats = { pig: { lv: 1, exp: 0 } };
    if (!gameState.petsOwned) gameState.petsOwned = ['pig'];
    if (!gameState.currentPet) gameState.currentPet = 'pig';
    
    // 確保所有擁有的寵物，都一定有對應的等級 (lv) 和經驗值 (exp) 資料
    gameState.petsOwned.forEach(pid => {
        if (!gameState.petStats[pid]) {
            gameState.petStats[pid] = { lv: 1, exp: 0 };
        }
    });
    
    // 確保目前裝備的寵物是合法的
    if (!gameState.petStats[gameState.currentPet]) {
        gameState.currentPet = 'pig';
    }

    saveGame();
}
migrateGrid();

let activePets = {
    pig: { x: 4, y: 3, targetX: 4, targetY: 3, state: 'idle', timer: 0, dir: 'Down' },
    fox: { x: 7, y: 4, targetX: 7, targetY: 4, state: 'idle', timer: 0, dir: 'Down' },
    cat: { x: 2, y: 2, targetX: 2, targetY: 2, state: 'idle', timer: 0, dir: 'Down' }
};

const PET_DATA = {
    pig: { id: 'pig', title: '神豬', cost: 0, desc: '預設擁有' },
    fox: { id: 'fox', title: '我的刀盾', cost: 15000, desc: '需 💰15,000' },
    cat: { id: 'cat', title: '比比拉布', cost: 50000, desc: '💰50,000 (Pro解鎖)' } 
};


// 🛍️ 道具與卷軸資料 (抽卡使用)
const ITEM_DATA = {
    'renameScroll': { name: '傳說改名卷軸', icon: '📜' },
    'potion': { name: '催熟藥水', icon: '🧪' },
    'shield': { name: '連勝保護傘', icon: '🛡️' }
};

const SEED_DATA = {
    carrot: { id: 'carrot', name: '胡蘿蔔', cost: 50, sellPrice: 100, unlockLv: 1, exp: 35, growthFactor: 1.0 },
    tomato: { id: 'tomato', name: '番茄', cost: 80, sellPrice: 200, unlockLv: 5, exp: 100, growthFactor: 0.7 },
    radish: { id: 'radish', name: '蘿蔔', cost: 100, sellPrice: 250, unlockLv: 1, exp: 300, growthFactor: 0.6 },
    beetroot: { id: 'beetroot', name: '甜菜根', cost: 300, sellPrice: 650, unlockLv: 1, exp: 45, growthFactor: 0.5 },
    cucumber: { id: 'cucumber', name: '黃瓜', cost: 800, sellPrice: 1600, unlockLv: 1, exp: 60, growthFactor: 0.3 },
    onion: { id: 'onion', name: '洋蔥', cost: 1500, sellPrice: 3000, unlockLv: 1, exp: 80, growthFactor: 0.2 }
};

// ==========================================
// 🔥 狂熱模式變數與題庫
// ==========================================
const ETYMOLOGY_DATA = [
    { root: "dict", meaning: "說 / 言語", options: ["聽 / 聲音", "看 / 視覺", "走 / 移動"] },
    { root: "vis / vid", meaning: "看 / 視覺", options: ["聽 / 聲音", "說 / 言語", "做 / 製造"] },
    { root: "aud", meaning: "聽 / 聲音", options: ["看 / 視覺", "感覺 / 心理", "走 / 移動"] },
    { root: "ped / pod", meaning: "腳 / 走", options: ["手 / 抓", "頭 / 腦", "心 / 感情"] },
    { root: "spect", meaning: "看 / 觀察", options: ["說 / 演講", "寫 / 紀錄", "聽 / 聲音"] },
    { root: "scrib / script", meaning: "寫 / 紀錄", options: ["讀 / 閱讀", "看 / 觀察", "走 / 移動"] },
    { root: "port", meaning: "拿 / 運送", options: ["放 / 停止", "拉 / 拖", "推 / 壓"] },
    { root: "tract", meaning: "拉 / 拖", options: ["推 / 壓", "拿 / 運送", "放 / 停止"] },
    { root: "fac / fect", meaning: "做 / 製造", options: ["看 / 視覺", "聽 / 聲音", "說 / 言語"] },
    { root: "ject", meaning: "投 / 擲", options: ["抓 / 握", "推 / 壓", "拉 / 拖"] }
];
let isFeverMode = false;
let isEnEnMode = false;
let isSynonymMode = false; 
let feverTimer = null;
let currentWord = {};

const assets = {
    carrot_01: 'assets/Objects/GardenBed_Carrots_01.png', carrot_02: 'assets/Objects/GardenBed_Carrots_02.png',
    tomato_01: 'assets/Objects/GardenBed_Tomatoes_01.png', tomato_02: 'assets/Objects/GardenBed_Tomatoes_02.png',
    radish_01: 'assets/Objects/GardenBed_Radish_01.png', radish_02: 'assets/Objects/GardenBed_Radish_02.png',
    beetroot_01: 'assets/Objects/GardenBed_Beetroot_01.png', beetroot_02: 'assets/Objects/GardenBed_Beetroot_02.png',
    cucumber_01: 'assets/Objects/GardenBed_Cucumbers_01.png', cucumber_02: 'assets/Objects/GardenBed_Cucumbers_02.png',
    onion_01: 'assets/Objects/GardenBed_Onions_01.png', onion_02: 'assets/Objects/GardenBed_Onions_02.png',

    pig_Up: 'assets/Characters/Pig_Up.png', pig_Down: 'assets/Characters/Pig_Down.png', pig_Left: 'assets/Characters/Pig_Left.png', pig_Right: 'assets/Characters/Pig_Right.png', pig_Dead: 'assets/Characters/Pig_Dead.png',
    fox_Up: 'assets/Characters/Fox_Up.png', fox_Down: 'assets/Characters/Fox_Down.png', fox_Left: 'assets/Characters/Fox_Left.png', fox_Right: 'assets/Characters/Fox_Right.png', fox_Dead: 'assets/Characters/Fox_Dead.png',
    cat_Up: 'assets/Characters/Cat_Up.png', cat_Down: 'assets/Characters/Cat_Down.png', cat_Left: 'assets/Characters/Cat_Left.png', cat_Right: 'assets/Characters/Cat_Right.png', cat_Dead: 'assets/Characters/Cat_Dead.png',

    fenceTL: 'assets/Fences/Fence_Corner_Top_Left.png', fenceTR: 'assets/Fences/Fence_Corner_Top_Right.png',
    fenceBL: 'assets/Fences/Fence_Corner_Bottom_Left.png', fenceBR: 'assets/Fences/Fence_Corner_Bottom_Right.png',
    fenceH: 'assets/Fences/Fence_Horizontal.png', 
    cloud: 'assets/Backgrounds/Cloud.png', 
    
    cropCarrot: 'assets/Objects/Carrot.png', cropTomato: 'assets/Objects/Tomato.png',   
    cropRadish: 'assets/Objects/Radish.png', cropBeetroot: 'assets/Objects/Beetroot.png', 
    cropCucumber: 'assets/Objects/Cucumber.png', cropOnion: 'assets/Objects/Onion.png', 
    
    grass_light: 'assets/Terrain/Ground_03.png',
    grass_dark: 'assets/Terrain/Ground_05.png',
    soil: 'assets/Objects/GardenBed_Blank@2x.png',
};

const images = {};
function loadAssets() {
    Object.keys(assets).forEach(k => {
        images[k] = new Image(); images[k].src = assets[k];
        images[k].onload = () => { images[k].isLoaded = true; };
        images[k].onerror = () => { images[k].isLoaded = false; };
    });
}

function showToast(msg, type = 'info') {
    let toast = document.getElementById('game-toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'game-toast';
        document.body.appendChild(toast);
    }
    toast.innerText = msg;
    toast.className = `toast-show toast-${type}`;
    setTimeout(() => { toast.classList.remove('toast-show'); }, 2500);
}

function resize() {
    const rect = canvas.parentElement.getBoundingClientRect();
    canvas.width = rect.width; 
    canvas.height = rect.height;

    const STEP_RATIO = 0.7; 

    // 🌟 防呆：確保 TILE_SIZE 絕對不會是 0 或負數，保底 10px
    let calculatedSize = Math.floor(Math.min(
        canvas.width / COLS, 
        (canvas.height - 160) / ((ROWS - 1) * STEP_RATIO + 1)
    ));
    TILE_SIZE = Math.max(10, calculatedSize); 

    const gridW = COLS * TILE_SIZE;
    const gridH = ((ROWS - 1) * (TILE_SIZE * STEP_RATIO)) + TILE_SIZE;

    offsetX = Math.floor((canvas.width - gridW) / 2);
    offsetY = Math.floor((canvas.height - gridH) / 2);
}
window.addEventListener('resize', resize);

async function syncSaveToCloud() {
    if (window.auth && window.auth.currentUser) {
        try {
            const userRef = doc(window.db, "users", window.auth.currentUser.uid);
            const saveObject = { gameData: JSON.stringify(gameState) };
            await setDoc(userRef, saveObject);
        } catch(e) { console.error("❌ 雲端儲存失敗", e); }
    }
}

async function syncLoadFromCloud() {
    if (window.auth && window.auth.currentUser) {
        try {
            const userRef = doc(window.db, "users", window.auth.currentUser.uid);
            const docSnap = await getDoc(userRef);
            if (docSnap.exists()) {
                let cloudData = docSnap.data();
                if (cloudData.gameData) { Object.assign(gameState, JSON.parse(cloudData.gameData)); } 
                else { Object.assign(gameState, cloudData); }
                updateUI();
                return true;
            } else { return false; }
        } catch(e) { return false; }
    }
    return false;
}

let cloudSyncTimer = null;

function saveGame() { 
    if (window.auth && window.auth.currentUser) {
        // 1. 每次動作都即時存入本地端 (不用錢，隨便存)
        localStorage.setItem('vocabMaster_' + window.auth.currentUser.uid, JSON.stringify(gameState));
        
        // 2. 觸發雲端同步排程 (防抖機制)
        scheduleCloudSync();
    }
}

// 防抖：當玩家連續瘋狂點擊(答題/收成)時，計時器會一直被重置，
// 直到玩家停下手部動作 15 秒後，才會真正發送 1 次雲端寫入。
function scheduleCloudSync() {
    if (cloudSyncTimer) clearTimeout(cloudSyncTimer);
    cloudSyncTimer = setTimeout(() => {
        syncSaveToCloud();
        console.log("☁️ 背景已同步至 Firebase");
    }, 15000); // 15秒延遲，你可以依需求調整為 30000 (30秒)
}

function resetGameState() {
    gameState = {
        coins: 100, energy: 100, combo: 0,
        inventory: { carrot: 0, tomato: 0, radish: 0 },
        farmTiles: Array.from({length: ROWS}, () => Array.from({length: COLS}, () => ({ plant: false, type: null, progress: 0 }))),
        difficulty: "1", currentPet: "pig", 
        currentSeed: "carrot", 
        petsOwned: ["pig"], 
        petStats: { pig: { lv: 1, exp: 0 }, fox: { lv: 1, exp: 0 }, cat: { lv: 1, exp: 0 } },
        isPro: false, 
        mistakes: {},    // 這是原本的英文錯題
        mistakesTw: {},  // ✨ [新增] 這是台語專用的錯題本
        wordStats: {}, graduated: {},
        playerName: "" 
    };
    currentUser = "";
}

// 尋找 window.auth.onAuthStateChanged
window.auth.onAuthStateChanged(async (user) => {
    if (user) {
        // ✨ 這裡才是 user 真正存在的地方
        console.log("登入成功，正在載入用戶資料:", user.uid);
        
        // 1. 先重置狀態，避免殘留
        resetGameState(); 

        // 2. 優先嘗試從雲端同步
        const hasCloudData = await syncLoadFromCloud();
        
        // 3. 如果雲端沒資料，才抓本地對應該 UID 的資料
        if (!hasCloudData) {
            const localData = localStorage.getItem('vocabMaster_' + user.uid);
            if (localData) {
                Object.assign(gameState, JSON.parse(localData));
                console.log("已載入本地帳號存檔");
            }
        }

        migrateGrid();
        updateUI();
        loadQuestion(); // 確保進入後立刻加載正確題庫
    } else {
        // 沒人登入時清空資料
        resetGameState();
        console.log("目前無人登入");
    }
});

async function register() {
    const email = document.getElementById('email-input').value.trim();
    const password = document.getElementById('password-input').value;
    const btn = document.getElementById('btn-register');

    if (!email || !password) return showToast("註冊需填寫 Email 與密碼！", "error");
    if (password.length < 6) return showToast("密碼太短囉，至少需要 6 個字元！", "error");

    btn.innerText = "註冊中..."; btn.disabled = true;

    try {
        await createUserWithEmailAndPassword(window.auth, email, password);
        await syncSaveToCloud();
        localStorage.setItem('last_email_vocablord', email);
        
        document.getElementById('login-screen').classList.add('hidden');
        document.getElementById('world-map-screen').classList.remove('hidden');
        document.getElementById('name-prompt-modal').classList.remove('hidden');
        document.getElementById('newebpay-footer').style.display = 'none'; // 👈 加在這裡

    } catch (error) {
        if (error.code === 'auth/email-already-in-use') showToast("註冊失敗：這個 Email 已經被註冊過囉！", "error");
        else showToast("註冊失敗，請檢查格式", "error");
    } finally {
        btn.innerText = "註冊"; btn.disabled = false;
    }
}

async function login() {
    const email = document.getElementById('email-input').value.trim();
    const password = document.getElementById('password-input').value;
    const btn = document.getElementById('btn-login');

    if (!email || !password) return showToast("請輸入 Email 與密碼！", "error");

    btn.innerText = "登入中..."; btn.disabled = true;

    try {
        await signInWithEmailAndPassword(window.auth, email, password);
        await syncLoadFromCloud();
        localStorage.setItem('last_email_vocablord', email);
        
        document.getElementById('login-screen').classList.add('hidden');
        document.getElementById('world-map-screen').classList.remove('hidden');
        document.getElementById('newebpay-footer').style.display = 'none'; // 👈 加在這裡

        if (!gameState.playerName) {
            document.getElementById('name-prompt-modal').classList.remove('hidden');
        } else {
            currentUser = gameState.playerName;
            document.getElementById('hub-player-name').innerText = currentUser;
            showToast("登入成功！歡迎回來", "success");
            checkAndShowIOSPrompt();
        }
        
        checkDailyReset(); 
        document.getElementById('in-game-difficulty').value = gameState.difficulty;
        migrateGrid();
    } catch (error) {
        showToast("登入失敗：密碼錯誤！若為新玩家請按右邊的「註冊」", "error");
    } finally {
        btn.innerText = "登入"; btn.disabled = false;
    }
}

// 🔥 確保函數綁定在 window 上，HTML 才能直接呼叫
window.resetPassword = async function() {
    console.log("【測試】忘記密碼按鈕已被點擊！"); // 按 F12 可以在 Console 看到這行
    
    const email = document.getElementById('email-input').value.trim();
    if (!email) return showToast("⚠️ 請先在上方輸入你的 Email，再點擊忘記密碼！", "error");

    try {

        // 👇 加上這行，強制告訴 Firebase 寄送繁體中文信件
        window.auth.languageCode = 'zh-TW';
        await sendPasswordResetEmail(window.auth, email);
        showToast("📧 已寄出重設密碼信！請去信箱收信。", "success");
    } catch (error) {
        console.error("重設密碼錯誤:", error);
        
        // 判斷錯誤類型給予更精準的提示
        if (error.code === 'auth/user-not-found') {
            showToast("發送失敗：找不到此 Email，請確認是否已註冊！", "error");
        } else if (error.code === 'auth/invalid-email') {
            showToast("發送失敗：Email 格式錯誤！", "error");
        } else {
            showToast("發送失敗，請稍後再試", "error");
        }
    }
};

function submitHeroName() {
    const newName = document.getElementById('new-hero-name-input').value.trim();
    if (!newName) return showToast("名字不能為空喔！", "error");

    gameState.playerName = newName;
    currentUser = newName;

    document.getElementById('hub-player-name').innerText = currentUser;
    document.getElementById('name-prompt-modal').classList.add('hidden');

    saveGame(); 
    showToast(`歡迎加入，勇者 ${currentUser}！`, "success");
    checkAndShowIOSPrompt();
}

function enterRealm(realmId) {
    if (realmId !== 'english' && realmId !== 'taiwanese') { showToast("🚧 此領域正在積極建設中，敬請期待！", "info"); return; }
    document.getElementById('world-map-screen').classList.add('hidden');
    document.getElementById('game-container').classList.remove('hidden');
    
    resize(); 
    updateUI(); 
    
    // 🌟 關鍵修改 1：先把農場動畫啟動！確保畫面不會因為題目當機而變白畫面
    requestAnimationFrame(tick); 
    
    // 🌟 關鍵修改 2：加上防呆保護網
    try {
        loadQuestion(); 
    } catch (e) {
        console.error("🚨 題目載入崩潰：", e);
        document.getElementById('word-display').innerHTML = "<span style='color:red; font-size:0.6em;'>⚠️ 題庫載入異常</span>";
    }
    
    if (window.innerWidth <= 1024) setTimeout(() => { switchTab('quiz'); }, 50);
}

function backToMap() {
    document.getElementById('game-container').classList.add('hidden');
    document.getElementById('world-map-screen').classList.remove('hidden');
    document.getElementById('main-menu-modal').classList.add('hidden'); // ✨ 加入這行：關閉領主選單
}

function showTutorial() { document.getElementById('tutorial-modal').classList.remove('hidden'); }
function closeTutorial() { document.getElementById('tutorial-modal').classList.add('hidden'); }
function showComingSoon() { document.getElementById('coming-soon-modal').classList.remove('hidden'); }
function closeComingSoon() { document.getElementById('coming-soon-modal').classList.add('hidden'); }
function showPaywall(msg) { document.getElementById('paywall-msg').innerText = msg; document.getElementById('paywall-modal').classList.remove('hidden'); }
function closePaywall() { document.getElementById('paywall-modal').classList.add('hidden'); }

async function verifyLicenseKey() {
    const inputElem = document.getElementById('license-input');
    const btnElem = document.getElementById('btn-verify-license');
    const key = inputElem.value.replace(/\s+/g, '').toUpperCase();
    if (!key) return showToast("請輸入金鑰！", "error");
    
    if (key === "PRO123") {
        gameState.isPro = true; saveGame(); updateUI(); closePaywall(); 
        return showToast("🎉 測試金鑰驗證成功！", "success"); 
    }

    const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxJm3AvAS-vwd841tmJVwPMt7VT9ufh_maHenZGTj_XVQ10gRNskiA6k2ptJiekNgp_/exec"; 
    btnElem.innerText = "⏳ 雲端連線驗證中..."; btnElem.disabled = true;
    try {
        const response = await fetch(`${SCRIPT_URL}?key=${key}&user=${currentUser}`);
        const data = await response.json();
        if (data.success) { 
            gameState.isPro = true; saveGame(); updateUI(); closePaywall(); 
            showToast("🎉 金鑰驗證成功！您已解鎖專業版！", "success"); 
        } else { 
            let msg = data.message;
            if (msg.includes("使用") || msg.includes("綁定")) msg = "⚠️ 驗證失敗：此金鑰無效或已被綁定！";
            showToast(msg, "error"); 
        }
    } catch (error) { showToast("連線驗證失敗，請檢查網路。", "error"); } 
    finally { btnElem.innerText = "驗證並解鎖"; btnElem.disabled = false; }
}

function changeDifficulty() { 
    const selector = document.getElementById('in-game-difficulty');
    const advancedModes = document.getElementById('en-advanced-modes'); // 👈 抓取我們剛剛命名的區塊
    
    if (selector.value === "tw") {
        gameState.currentRealm = 'taiwanese';
        if (advancedModes) advancedModes.style.display = 'none'; // 台語模式隱藏進階按鈕
    } else {
        gameState.currentRealm = 'english';
        if (advancedModes) advancedModes.style.display = 'flex'; // 英文模式顯示按鈕
        
        if (selector.value !== "1" && !gameState.isPro) { 
            showPaywall("中高級單字庫為專業版專屬！"); 
            selector.value = gameState.difficulty; 
            return; 
        }
    }
    gameState.difficulty = selector.value; 
    saveGame(); 
    loadQuestion(); 
}

function toggleEnEnMode() {
    isEnEnMode = document.getElementById('en-en-mode-toggle').checked;
    if (isEnEnMode) {
        isSynonymMode = false;
        document.getElementById('synonym-mode-toggle').checked = false;
        showToast("🔥 進入菁英英英模式！答對金幣加倍！載入需稍候...", "info");
    } else showToast("切換回標準中文模式。", "info");
    loadQuestion();
}

function toggleSynonymMode() {
    isSynonymMode = document.getElementById('synonym-mode-toggle').checked;
    if (isSynonymMode) {
        isEnEnMode = false;
        document.getElementById('en-en-mode-toggle').checked = false;
        showToast("🔗 進入同義字挑戰模式！找出意思相近的字！", "info");
    }
    loadQuestion();
}

async function fetchEnglishDefinition(wordObj) {
    if (wordObj.en) return wordObj.en; 
    try {
        let cleanWord = wordObj.w.split('/')[0].split('(')[0].trim().toLowerCase();
        const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${cleanWord}`);
        if (!response.ok) return null; 
        const data = await response.json();
        let allDefs = [];
        data[0].meanings.forEach(m => m.definitions.forEach(d => allDefs.push(d.definition)));
        let filteredDefs = allDefs.filter(def => !def.toLowerCase().includes(cleanWord) && def.length > 5);
        let finalDef = filteredDefs.length > 0 ? filteredDefs[0] : allDefs[0];
        if (finalDef) return finalDef.length > 150 ? finalDef.substring(0, 147) + "..." : finalDef;
        return null;
    } catch (e) { return null; }
}

async function fetchSynonyms(wordObj) {
    if (wordObj.syn) return wordObj.syn; 
    try {
        let cleanWord = wordObj.w.split('/')[0].split('(')[0].trim().toLowerCase();
        const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${cleanWord}`);
        if (!response.ok) return null;
        const data = await response.json();
        let allSyns = [];
        data[0].meanings.forEach(m => {
            if (m.synonyms) allSyns.push(...m.synonyms);
            m.definitions.forEach(d => { if (d.synonyms) allSyns.push(...d.synonyms); });
        });
        let uniqueSyns = [...new Set(allSyns)].filter(s => s.toLowerCase() !== cleanWord);
        if (uniqueSyns.length > 0) return uniqueSyns.sort(() => Math.random() - 0.5).slice(0, 2).join(', ');
        return null;
    } catch (e) { return null; }
}

function getPetSize(lv) { 
    let base = TILE_SIZE * 1.2; 
    return Math.min(TILE_SIZE * 1.8, base + (lv - 1) * (TILE_SIZE * 0.05)); 
}
function getPetSpeed(lv) { return Math.min(0.08, 0.02 + (lv - 1) * 0.002); }

function getCoinReward(wordLv) {
    let base = (wordLv || 1) * 10;
    gameState.petsOwned.forEach(id => {
        let lv = gameState.petStats[id].lv;
        if (id === 'pig') base += (lv - 1) * 2;
        if (id === 'fox') base += 10 + (lv - 1) * 4;
        if (id === 'cat') base += 20 + (lv - 1) * 6;
    });
    return base;
}

// ==========================================
// 🚀 第二部分：核心答題邏輯、狂熱模式與地獄特訓
// ==========================================

function loadQuestion() {
    // 🌟 關鍵修改 3：使用 typeof 和 window. 安全檢查，防止找不到題庫時當機
    let activePool = [];
    if (gameState.currentRealm === 'taiwanese') {
        activePool = (typeof window.twVocab !== 'undefined') ? window.twVocab : [];
    } else {
        activePool = (typeof globalVocab !== 'undefined') ? globalVocab : [];
    }

    // 防呆：如果題庫沒抓到，提早結束，避免後續運算當機
    if (!activePool || activePool.length === 0) {
        console.error("🚨 找不到題庫資料！請檢查 vocab.js 或 tw_vocab.js。");
        document.getElementById('word-display').innerHTML = "<span style='color:red; font-size:0.6em;'>題庫遺失</span>";
        return; 
    }
    const displayContainer = document.getElementById('word-display').parentElement;
    const btnContainer = displayContainer.querySelector('div');
    if (btnContainer && btnContainer.style) btnContainer.style.display = 'flex';

    // 2. 過濾已畢業單字
    let pool = activePool.filter(v => !gameState.graduated[v.w]);
    
    // 3. 難度篩選：只有在「英文領域」才執行原本的難度過濾
    if (gameState.currentRealm === 'english' && gameState.difficulty !== "all") {
        let d = parseInt(gameState.difficulty);
        let filtered = pool.filter(v => v.lv === d || v.lv === d + 1);
        if (filtered.length >= 4) {
            pool = filtered;
        } else {
            showToast(`⚠️ 單字數量不足，已暫時混入其他等級！`, "info");
        }
    }

    // 防呆：如果 pool 太小，就直接用該領域的全題庫
    if (pool.length < 4) pool = activePool; 

    // 4. 隨機選題邏輯 (保持不變)
    pool.forEach(w => { if(typeof w.weight === 'undefined') w.weight = 10; });
    let totalWeight = pool.reduce((sum, word) => sum + word.weight, 0);
    let randomNum = Math.random() * totalWeight;
    for (let word of pool) { if (randomNum < word.weight) { currentWord = word; break; } randomNum -= word.weight; }
    if (!currentWord || !currentWord.w) currentWord = pool[Math.floor(Math.random() * pool.length)];
    
    // 5. [新增] 題目顯示：如果是台文，額外顯示縮小的拼音
    const wordDisplay = document.getElementById('word-display');
    if (gameState.currentRealm === 'taiwanese') {
        // 使用 innerHTML 來插入換行與拼音標籤
        wordDisplay.innerHTML = `${currentWord.w}<br><span style="font-size: 0.5em; color: #7f8c8d; font-weight: bold;">${currentWord.p}</span>`;
    } else {
        wordDisplay.innerText = currentWord.w;
    }
    
    // 6. 獎勵與選項生成
    let baseReward = getCoinReward(currentWord.lv);
    let modeActive = isEnEnMode || isSynonymMode;
    document.getElementById('reward-hint').innerText = `答對獎勵：💰 ${modeActive ? baseReward * 2 : baseReward}`;
    
    const grid = document.getElementById('options-grid'); 
    grid.innerHTML = '';
    
    generateOptionsAsync(grid, baseReward);
}

let shieldPromptCallback = null;

function showShieldPromptModal(type, callback) {
    shieldPromptCallback = callback; 
    document.getElementById('shield-prompt-modal').classList.remove('hidden');
    let msg = type === "wrong" 
        ? `❌ 答錯了！你的 ${gameState.combo} 連勝即將中斷！` 
        : `👀 已標記！你的 ${gameState.combo} 連勝即將中斷！`;
    document.getElementById('shield-prompt-msg').innerText = msg + "\n要立刻花費 💰15000 金幣發動【🛡️ 連勝保護傘】保住連勝嗎？";
}

function resolveShieldPrompt(buy) {
    document.getElementById('shield-prompt-modal').classList.add('hidden');
    if (buy && gameState.coins >= 15000) {
        gameState.coins -= 15000;
        showToast("🛡️ 成功購買並發動保護傘！連勝保住了！", "success");
    } else {
        gameState.combo = 0;
        showToast("❌ 連勝歸零", "error");
    }
    
    if (shieldPromptCallback) shieldPromptCallback();
    shieldPromptCallback = null;
}

async function generateOptionsAsync(grid, baseReward) {
    let optsData = []; 
    const modeActive = isEnEnMode || isSynonymMode;
    
    if (modeActive) {
        grid.innerHTML = `<div style="grid-column: span 2; text-align: center; padding: 20px; color: #7f8c8d; font-weight: bold;">🌐 正在連線字典庫抓取${isSynonymMode ? '同義字' : '解釋'}...</div>`;
        
        let correctHint = isSynonymMode ? await fetchSynonyms(currentWord) : await fetchEnglishDefinition(currentWord);
        let fallbackUsed = false;

        if (!correctHint) {
            optsData.push({ text: currentWord.c, isCorrect: true });
            fallbackUsed = true;
        } else {
            optsData.push({ text: correctHint, isCorrect: true });
        }

        let failSafe = 0; 
        
        let usedWords = [currentWord.w];
        let chineseCount = fallbackUsed ? 1 : 0; 

        while(optsData.length < 4 && failSafe < 40) {
            let randomWordObj = globalVocab[Math.floor(Math.random() * globalVocab.length)];
            if (!usedWords.includes(randomWordObj.w) && randomWordObj.c) {
                usedWords.push(randomWordObj.w);
                
                if (fallbackUsed && chineseCount < 2) {
                    if (!optsData.some(o => o.text === randomWordObj.c)) {
                        optsData.push({ text: randomWordObj.c, isCorrect: false });
                        chineseCount++;
                    }
                } else {
                    let wrongHint = isSynonymMode ? await fetchSynonyms(randomWordObj) : await fetchEnglishDefinition(randomWordObj);
                    
                    if (wrongHint && !optsData.some(o => o.text === wrongHint)) {
                        optsData.push({ text: wrongHint, isCorrect: false });
                    } else if (!optsData.some(o => o.text === randomWordObj.c)) {
                        optsData.push({ text: randomWordObj.c, isCorrect: false });
                        chineseCount++;
                    }
                }
            }
            failSafe++;
        }
        grid.innerHTML = ''; 
    } else {
        optsData.push({ text: currentWord.c, isCorrect: true });
        let failSafe = 0;
        
        // 🌟 關鍵修改 4：確認目前到底要從哪個題庫抓錯誤選項
        const poolForWrongAnswers = (gameState.currentRealm === 'taiwanese') 
            ? (typeof window.twVocab !== 'undefined' ? window.twVocab : []) 
            : (typeof globalVocab !== 'undefined' ? globalVocab : []);

        while(optsData.length < 4 && failSafe < 100) {
            let randomWordObj = poolForWrongAnswers[Math.floor(Math.random() * poolForWrongAnswers.length)];
            
            if (randomWordObj && randomWordObj.c) {
                let r = randomWordObj.c;
                if(!optsData.some(o => o.text === r)) {
                    optsData.push({ text: r, isCorrect: false });
                }
            }
            failSafe++;
        }
    }

    optsData.sort(() => Math.random() - 0.5).forEach(o => {
        const b = document.createElement('button'); 
        b.innerText = o.text;
        
        if (modeActive) {
            b.style.fontSize = "0.95em"; b.style.padding = "12px 15px"; b.style.lineHeight = "1.4";
            b.style.whiteSpace = "normal"; b.style.wordBreak = "break-word"; b.style.minHeight = "60px";
        }
        
        if (o.isCorrect) b.dataset.correct = "true";
        
   b.addEventListener('click', () => {
            Array.from(grid.children).forEach(btn => btn.disabled = true);
            if (!gameState.wordStats[currentWord.w]) gameState.wordStats[currentWord.w] = { correct: 0, wrong: 0, consecutive: 0 };

            if(o.isCorrect) { 
                // 改用 CSS class，移除原本一長串的 style
                b.classList.add('quiz-btn-correct');

                gameState.combo = (gameState.combo || 0) + 1;
                // 👇 新增這段：30連勝的專業版推銷
                if (!gameState.isPro && gameState.combo === 30 && gameState.difficulty === "1") {
                    setTimeout(() => {
                        showPaywall("🔥 太神啦！\n你已經連續答對 30 題了！\n現在的L1、L2國中單字對你來說根本小菜一碟。\n\n要不要升級專業版，立刻解鎖 L3、L4 高中單字，讓自己的實力更上一層樓？");
                    }, 500); // 延遲半秒，讓玩家先看到答對特效再跳彈窗
                }
                // 👆 新增結束
                
                let comboMultiplier = Math.min(2.0, 1.0 + Math.floor(gameState.combo / 5) * 0.1);
                let finalReward = Math.floor((modeActive ? baseReward * 2 : baseReward) * comboMultiplier);
                
                gameState.coins += finalReward; 
                gameState.energy = Math.min(100, gameState.energy + 30);
                currentWord.weight = Math.max(1, currentWord.weight - 3); 
                gameState.wordStats[currentWord.w].correct += 1;
                gameState.wordStats[currentWord.w].consecutive += 1;
                
                updateDailyTask('correct50', 1, false); updateDailyTask('combo15', gameState.combo, true); 

                if (comboMultiplier > 1.0) showFloatingText(`+${finalReward} 💰 (Combo x${comboMultiplier.toFixed(1)})`, "#f1c40f");
                else showFloatingText(`+${finalReward} 💰`, "#2ecc71");

                if (gameState.combo > 0 && gameState.combo % 50 === 0 && (gameState.difficulty === "5" || gameState.difficulty === "all")) {
                    gameState.inventory['renameScroll'] = (gameState.inventory['renameScroll'] || 0) + 1;
                    showToast(`🏆 神之領域！達成 ${gameState.combo} 連勝，獲得【傳說改名卷軸】！`, "success");
                }
                
                if (gameState.wordStats[currentWord.w].consecutive >= 5) {
                    let isChroma = gameState.wordStats[currentWord.w].isRecalled === true;
                    gameState.graduated[currentWord.w] = { 
                        w: currentWord.w, c: currentWord.c, lv: currentWord.lv, chroma: isChroma 
                    };
                    if (isChroma) {
                        showToast(`🌟 突破極限！[${currentWord.w}] 畢業並解鎖【✨炫彩卡✨】！`, "success");
                    } else {
                        showToast(`🎓 恭喜！[${currentWord.w}] 已畢業！`, "success");
                    }
                }

                let isCrit = Math.random() < 0.15; let actuallyGrew = false;
                gameState.farmTiles.forEach(r => r.forEach(t => { 
                    if(t.plant && t.progress < 100) { 
                        let factor = SEED_DATA[t.type] ? SEED_DATA[t.type].growthFactor : 1;
                        t.progress = Math.min(100, t.progress + (10 * factor * (isCrit ? 3 : 1))); 
                        actuallyGrew = true;
                    } 
                }));
                if (isCrit && actuallyGrew) showToast("⚡ 爆擊！作物瘋狂生長！", "success");
                saveGame(); updateUI();
                setTimeout(() => { 
                    // ✨ 加上判斷，只有英文模式才觸發字根狂熱
                    if (gameState.combo > 0 && gameState.combo % 10 === 0 && gameState.currentRealm !== 'taiwanese') startFeverMode(); 
                    else loadQuestion(); 
                }, 400);
            } else {
                // 答錯的處理，改用 CSS class
                b.classList.add('quiz-btn-wrong');
                let correctBtn = Array.from(grid.children).find(btn => btn.dataset.correct === "true");
                if (correctBtn) { correctBtn.classList.add('quiz-btn-correct'); }

                let finalizeWrongAnswer = () => {
                    gameState.energy = Math.max(0, gameState.energy - 10);
                    currentWord.weight += 10;
                    gameState.wordStats[currentWord.w].wrong += 1;
                    gameState.wordStats[currentWord.w].consecutive = 0;

                    // ✨ 關鍵分類邏輯
                    const isTw = (gameState.currentRealm === 'taiwanese');
                    const mistakePool = isTw ? gameState.mistakesTw : gameState.mistakes;

                    if (!mistakePool[currentWord.w]) {
                        mistakePool[currentWord.w] = { 
                            w: currentWord.w, 
                            c: currentWord.c, 
                            lv: currentWord.lv || 1, 
                            p: currentWord.p || "", // 台文多存一個拼音
                            count: 0 
                        };
                    }
                    mistakePool[currentWord.w].count += 1;

                    saveGame();
                    updateUI();

                    setTimeout(() => {
                        // 判斷是否需要強制複習 (這裡你可以決定要看哪一區的錯題數)
                        if (Object.keys(gameState.mistakes).length >= 30 || Object.keys(gameState.mistakesTw).length >= 30) {
                            startForcedReview();
                        } else {
                            loadQuestion();
                        }
                    }, 2000);
                };

                if (gameState.inventory['shield'] > 0) {
                    gameState.inventory['shield']--;
                    showToast("🛡️ 保護傘發動！抵銷一次連勝中斷！", "info");
                    finalizeWrongAnswer(); 
                } else {
                    if (gameState.combo > 0 && gameState.coins >= 15000) {
                        showShieldPromptModal("wrong", finalizeWrongAnswer); 
                    } else {
                        gameState.combo = 0; showToast("❌ 答錯囉！連勝歸零", "error");
                        finalizeWrongAnswer();
                    }
                }
            }
        });
        grid.appendChild(b);
    });

    let idkBtn = document.createElement('button');
    idkBtn.innerText = "👀 我不會 (看答案)";
    // 改用 CSS class，讓程式碼更乾淨
    idkBtn.className = "quiz-btn-idk";
    
    idkBtn.addEventListener('click', () => {
        Array.from(grid.children).forEach(btn => btn.disabled = true);
        let correctBtn = Array.from(grid.children).find(btn => btn.dataset.correct === "true");
        
        // 這裡也換成剛剛設定好的答對綠色 class，取代原本又臭又長的 style
        if (correctBtn) { correctBtn.classList.add('quiz-btn-correct'); }

        let finalizeIdkAnswer = () => {
            currentWord.weight += 10; 
            if (!gameState.wordStats[currentWord.w]) gameState.wordStats[currentWord.w] = { correct: 0, wrong: 0, consecutive: 0 };
            gameState.wordStats[currentWord.w].wrong += 1; gameState.wordStats[currentWord.w].consecutive = 0; 
            
            // ✨ 修復：台文與英文錯題本徹底分流
            const isTw = (gameState.currentRealm === 'taiwanese');
            const mistakePool = isTw ? gameState.mistakesTw : gameState.mistakes;

            if (!mistakePool[currentWord.w]) {
                mistakePool[currentWord.w] = { 
                    w: currentWord.w, c: currentWord.c, lv: currentWord.lv || 1, p: currentWord.p || "", count: 0 
                };
            }
            mistakePool[currentWord.w].count += 1; 
            
            saveGame(); updateUI();

            setTimeout(() => { 
                if (Object.keys(gameState.mistakes).length >= 30 || Object.keys(gameState.mistakesTw).length >= 30) {
                    startForcedReview();
                } else {
                    loadQuestion(); 
                }
            }, 2000); 
        };

        if (gameState.inventory['shield'] > 0) {
            gameState.inventory['shield']--; showToast("💡 已標記！(🛡️保護傘抵銷連勝中斷)", "info");
            finalizeIdkAnswer();
        } else {
            if (gameState.combo > 0 && gameState.coins >= 15000) {
                showShieldPromptModal("idk", finalizeIdkAnswer);
            } else { 
                gameState.combo = 0; showToast("💡 已標記！連勝歸零", "info"); 
                finalizeIdkAnswer();
            }
        }
    });
    grid.appendChild(idkBtn);
}

// ✨ 核心重構：狂熱模式
// ✨ 核心重構：狂熱模式
function startFeverMode() {
    isFeverMode = true;
    let timeLeft = 10;
    
    const displayContainer = document.getElementById('word-display').parentElement;
    const btnContainer = displayContainer.querySelector('div');
    if (btnContainer) btnContainer.style.display = 'none';

    const sidebar = document.getElementById('sidebar');
    if (sidebar) { sidebar.style.border = "5px solid #e74c3c"; sidebar.style.boxShadow = "inset 0 0 30px rgba(231, 76, 60, 0.4)"; }
    
    const wordDisplay = document.getElementById('word-display'); const rewardHint = document.getElementById('reward-hint'); const grid = document.getElementById('options-grid');
    
    let availableRoots = ETYMOLOGY_DATA.filter(q => !gameState.graduated[`${q.root} (字根)`]);
    if (availableRoots.length === 0) availableRoots = ETYMOLOGY_DATA;
    let q = availableRoots[Math.floor(Math.random() * availableRoots.length)];
    let wordKey = `${q.root} (字根)`; 
    
    wordDisplay.innerHTML = `<span style="color:#e74c3c; font-size: 0.8em;">🔥 狂熱挑戰！</span><br><span style="font-size:0.5em; color:#7f8c8d;">字根 / 字首：</span><br>${q.root}`;
    rewardHint.innerHTML = `⏳ 剩餘：<span style="color:#e74c3c; font-size:1.5em; font-weight:900;">${timeLeft}</span> 秒`;
    
    let opts = [q.meaning, ...q.options]; opts.sort(() => Math.random() - 0.5);
    
    grid.innerHTML = '';
    opts.forEach(o => {
        const b = document.createElement('button');
        b.innerText = o;
        
        // ✨ 改用剛剛寫好的 CSS class
        b.className = "special-quiz-btn"; 
        if (o === q.meaning) b.dataset.correct = "true"; 
        
        b.addEventListener('click', () => {
            clearInterval(feverTimer); Array.from(grid.children).forEach(btn => btn.disabled = true);
            if (!gameState.wordStats[wordKey]) gameState.wordStats[wordKey] = { correct: 0, wrong: 0, consecutive: 0 };

            if (o === q.meaning) {
                // ✨ 答對：套用綠色 class
                b.classList.add('quiz-btn-correct'); 
                
                showToast("✨ 狂熱成功！全農場作物大暴增！", "success");
                gameState.farmTiles.forEach(r => r.forEach(t => { if(t.plant && t.progress < 100) { t.progress = Math.min(100, t.progress + 20); } }));
                gameState.coins += 200; 
                gameState.wordStats[wordKey].correct += 1; gameState.wordStats[wordKey].consecutive += 1;
                if (gameState.wordStats[wordKey].consecutive >= 5) {
                    gameState.graduated[wordKey] = { w: wordKey, c: q.meaning, lv: 7 }; showToast(`🎓 恭喜！字根 [${q.root}] 已精通！`, "success");
                }
                saveGame(); updateUI(); setTimeout(endFeverMode, 1500);
            } else {
                // ✨ 答錯：套用紅色 class
                b.classList.add('quiz-btn-wrong');
                let correctBtn = Array.from(grid.children).find(btn => btn.dataset.correct === "true");
                if (correctBtn) { correctBtn.classList.add('quiz-btn-correct'); }
                
                showToast("❌ 狂熱失敗！已加入錯題本", "error"); gameState.combo = 0; 
                gameState.wordStats[wordKey].wrong += 1; gameState.wordStats[wordKey].consecutive = 0;
                if (!gameState.mistakes[wordKey]) { gameState.mistakes[wordKey] = { w: wordKey, c: q.meaning, lv: 7, count: 0 }; }
                gameState.mistakes[wordKey].count += 1; saveGame(); updateUI(); setTimeout(endFeverMode, 2000); 
            }
        });
        grid.appendChild(b);
    });
    
    feverTimer = setInterval(() => {
        timeLeft--; rewardHint.innerHTML = `⏳ 剩餘：<span style="color:#e74c3c; font-size:1.5em; font-weight:900;">${timeLeft}</span> 秒`;
        if (timeLeft <= 0) {
            clearInterval(feverTimer); Array.from(grid.children).forEach(btn => btn.disabled = true);
            showToast("⏳ 時間到！狂熱失敗", "info"); gameState.combo = 0; updateUI(); setTimeout(endFeverMode, 1500);
        }
    }, 1000);
}

function endFeverMode() {
    isFeverMode = false;
    const sidebar = document.getElementById('sidebar');
    if (sidebar) {
        sidebar.style.boxShadow = "none";
        if (window.innerWidth > 1024) sidebar.style.border = "none", sidebar.style.borderRight = "5px solid #5d4037"; 
        else sidebar.style.border = "none", sidebar.style.borderBottom = "4px solid #5d4037"; 
    }
    loadQuestion(); 
}

// ✨ 核心重構：地獄特訓
let forcedReviewQueue = [];
let currentForcedWord = null;

function startForcedReview() {
    forcedReviewQueue = Object.values(gameState.mistakes).sort(() => Math.random() - 0.5);
    document.getElementById('forced-review-modal').classList.remove('hidden');
    loadForcedReviewQuestion();
}

function loadForcedReviewQuestion() {
    if (forcedReviewQueue.length === 0) {
        document.getElementById('forced-review-modal').classList.add('hidden');
        showToast("🎉 特訓完成！獲得 💰500 獎勵金與滿滿活力！", "success");
        gameState.coins += 500; gameState.energy = 100; saveGame(); updateUI(); loadQuestion(); return;
    }

    currentForcedWord = forcedReviewQueue[0];
    document.getElementById('forced-word-display').innerText = currentForcedWord.w;
    document.getElementById('forced-progress').innerText = `剩餘：${forcedReviewQueue.length} 題`;

    let existingNextBtn = document.getElementById('forced-next-btn');
    if (existingNextBtn) existingNextBtn.remove();

    let opts = [currentForcedWord.c];
    let failSafe = 0;
    while(opts.length < 4 && failSafe < 100) {
        let r = globalVocab[Math.floor(Math.random() * globalVocab.length)].c;
        if(!opts.includes(r) && r !== undefined) opts.push(r);
        failSafe++;
    }

    const grid = document.getElementById('forced-options-grid'); 
    grid.innerHTML = '';
    
    opts.sort(() => Math.random() - 0.5).forEach(o => {
        let btn = document.createElement('button');
        btn.innerText = o;
        
        // ✨ 改用 CSS class
        btn.className = "special-quiz-btn"; 
        if (o === currentForcedWord.c) btn.dataset.correct = "true";

        btn.addEventListener('click', () => {
            Array.from(grid.children).forEach(b => b.disabled = true);
            
            if (o === currentForcedWord.c) {
                // ✨ 答對：套用綠色 class
                btn.classList.add('quiz-btn-correct'); 
                
                forcedReviewQueue.shift(); 
                if (gameState.mistakes[currentForcedWord.w]) {
                    gameState.mistakes[currentForcedWord.w].count--;
                    if (gameState.mistakes[currentForcedWord.w].count <= 0) delete gameState.mistakes[currentForcedWord.w];
                }
                saveGame(); 
                setTimeout(loadForcedReviewQuestion, 500); 
            } else {
                // ✨ 答錯：套用紅色 class
                btn.classList.add('quiz-btn-wrong');
                let correctBtn = Array.from(grid.children).find(b => b.dataset.correct === "true");
                if (correctBtn) { correctBtn.classList.add('quiz-btn-correct'); }
                
                showToast("❌ 答錯了！請記住正確的中文意思。", "error"); 
                let w = forcedReviewQueue.shift(); 
                forcedReviewQueue.push(w); 
                
                let nextBtn = document.createElement('button'); 
                nextBtn.id = 'forced-next-btn'; 
                nextBtn.innerText = "記住了，下一題 ➔"; 
                // ✨ 下一題按鈕也改用 class
                nextBtn.className = "forced-next-btn"; 
                nextBtn.addEventListener('click', loadForcedReviewQuestion); 
                grid.parentElement.appendChild(nextBtn);
            }
        });
        grid.appendChild(btn);
    });
}

// ==========================================
// 🚀 第三部分：面板、農場動畫與統一百格事件綁定
// ==========================================
let currentReviewTab = 'english'; // 預設顯示英文

function openReviewArea() {
    // 開啟時，自動根據目前的遊戲領域決定預設顯示哪一邊
    currentReviewTab = (gameState.currentRealm === 'taiwanese') ? 'taiwanese' : 'english';
    document.getElementById('review-screen').classList.remove('hidden');
    renderReviewList();
}function closeReviewArea() { document.getElementById('review-screen').classList.add('hidden'); }

// 確保這行在函式外，用來紀錄目前看哪一頁

function renderReviewList() {
    const list = document.getElementById('review-list');
    
    // 1. 決定抓哪一區的資料
    const mistakesArr = (currentReviewTab === 'taiwanese') 
        ? Object.values(gameState.mistakesTw || {}) 
        : Object.values(gameState.mistakes || {});

    // 2. 建立標籤按鈕 (改用 ID 標註，拿掉 onclick)
    let tabHtml = `
        <div style="display: flex; gap: 10px; margin-bottom: 20px;">
            <button id="btn-review-en" style="flex: 1; padding: 12px; border-radius: 12px; border: none; font-weight: bold; cursor: pointer; transition: 0.2s;
                background: ${currentReviewTab === 'english' ? '#3498db' : '#ecf0f1'};
                color: ${currentReviewTab === 'english' ? 'white' : '#7f8c8d'};
                box-shadow: ${currentReviewTab === 'english' ? '0 4px 0 #2980b9' : 'none'};">
                🔤 英文錯題
            </button>
            <button id="btn-review-tw" style="flex: 1; padding: 12px; border-radius: 12px; border: none; font-weight: bold; cursor: pointer; transition: 0.2s;
                background: ${currentReviewTab === 'taiwanese' ? '#27ae60' : '#ecf0f1'};
                color: ${currentReviewTab === 'taiwanese' ? 'white' : '#7f8c8d'};
                box-shadow: ${currentReviewTab === 'taiwanese' ? '0 4px 0 #219150' : 'none'};">
                🏮 台文錯題
            </button>
        </div>
    `;

    // 3. 空白檢查
    if (mistakesArr.length === 0) { 
        list.innerHTML = tabHtml + `<div class='empty-review'>🎉 ${currentReviewTab === 'taiwanese' ? '台文' : '英文'}錯題本是空的！</div>`; 
        
        // --- 即使是空的也要綁定切換按鈕，不然切不回去 ---
        setupTabButtons();
        return; 
    }

    // 4. 分級顯示邏輯
    let grouped = {}; 
    mistakesArr.forEach(m => { 
        let lv = m.lv || 1; 
        if (!grouped[lv]) grouped[lv] = []; 
        grouped[lv].push(m); 
    });

    list.innerHTML = tabHtml;

    // ✨ 核心修復：建立一個小函式來處理按鈕綁定
    function setupTabButtons() {
        const enBtn = document.getElementById('btn-review-en');
        const twBtn = document.getElementById('btn-review-tw');
        
        if (enBtn) enBtn.onclick = () => { currentReviewTab = 'english'; renderReviewList(); };
        if (twBtn) twBtn.onclick = () => { currentReviewTab = 'taiwanese'; renderReviewList(); };
    }

    // 執行按鈕綁定
    setupTabButtons();

    // 5. 渲染列表
    Object.keys(grouped).sort((a, b) => a - b).forEach(lv => {
        grouped[lv].sort((a, b) => b.count - a.count); 
        
        let header = document.createElement('h3');
        header.className = 'review-lv-header';
        header.style.background = (currentReviewTab === 'taiwanese') ? "#27ae60" : "#2980b9";
        header.style.color = "white";
        header.innerText = (lv == 7) ? "🔥 狂熱字源學 (字根)" : `${currentReviewTab === 'taiwanese' ? '台文' : 'Level'} ${lv} 錯題`;
        list.appendChild(header);

        grouped[lv].forEach(m => {
            let itemDiv = document.createElement('div');
            itemDiv.className = 'review-item';
            
            let infoDiv = document.createElement('div');
            infoDiv.className = 'review-word-info';
            
            let wordDisplay = (currentReviewTab === 'taiwanese' && m.p) 
                ? `${m.w} <span style="font-size:0.85em; color:#7f8c8d; font-weight:bold;">(${m.p})</span>` 
                : m.w;

            infoDiv.innerHTML = `
                <div class="review-word">${wordDisplay} <span class="error-count-badge">錯了 ${m.count} 次</span></div>
                <div class="review-mean">${m.c}</div>
            `;
            
            let btn = document.createElement('button');
            btn.className = 'master-btn';
            btn.innerText = '✅ 複習';
            btn.addEventListener('click', () => masterWord(m.w));
            
            itemDiv.appendChild(infoDiv);
            itemDiv.appendChild(btn);
            list.appendChild(itemDiv);
        });
    });
}

function masterWord(wk) {
    // --- 關鍵修正：替換掉標準提示窗，使用美化後的彈窗 ---
    // 這是專業做法，能讓你的應用程序擁有統一且美觀的 UI 風格     
    showBeautifulConfirmModal(`確定複習完 [${wk}] 了嗎？`, (confirmed) => {
        if (!confirmed) return; // 用戶點擊取消或關閉彈窗，就提早結束

        // ... 接下來是你原本的 grouped 邏輯 ...
        // 根據當前分頁決定刪除哪一區
        const targetPool = (currentReviewTab === 'taiwanese') ? gameState.mistakesTw : gameState.mistakes;

        if (targetPool && targetPool[wk]) {
            delete targetPool[wk]; 
            
            // 獎勵發放
            gameState.coins += 50; 
            gameState.energy = Math.min(100, gameState.energy + 50);
            gameState.inventory['radish'] = (gameState.inventory['radish'] || 0) + 1; 
            
            // 累計複習次數
            gameState.reviewClearCount = (gameState.reviewClearCount || 0) + 1;

            saveGame(); 
            updateUI(); 
            renderReviewList(); // 即時更新列表
            
            showToast(`✨ 恭喜克服 [${wk}]！`, "success");

            // 特訓觸發
            if (gameState.reviewClearCount % 10 === 0) {
                setTimeout(startHeavenTraining, 800);
            }
        }
    });
}

function openGraduatedArea() { document.getElementById('graduated-screen').classList.remove('hidden'); renderGraduatedList(); }
function closeGraduatedArea() { document.getElementById('graduated-screen').classList.add('hidden'); }

function renderGraduatedList() {
    const list = document.getElementById('graduated-list');
    list.innerHTML = '';
    
    let statsArr = Object.entries(gameState.wordStats)
        .filter(([w, data]) => data.consecutive > 0 || gameState.graduated[w])
        .map(([w, data]) => {
            let isGrad = gameState.graduated[w]; let cons = isGrad ? 5 : data.consecutive;
            let wordObj = typeof globalVocab !== 'undefined' ? globalVocab.find(v => v.w === w) : null;
            let lv = wordObj ? wordObj.lv : (isGrad ? isGrad.lv : (w.includes('字根') ? 7 : 1));
            let meaning = wordObj ? wordObj.c : (isGrad ? isGrad.c : "???");
            return { w, cons, lv, meaning, isGrad };
        });

    if (statsArr.length === 0) { 
        list.style.display = "block"; 
        list.innerHTML = "<div class='empty-review'>還沒有解鎖任何圖鑑喔！<br>快去答題收集星星吧！🌟</div>"; 
        return; 
    }
    
    list.style.display = "block"; 
    let grouped = {};
    statsArr.forEach(item => { if (!grouped[item.lv]) grouped[item.lv] = []; grouped[item.lv].push(item); });

    Object.keys(grouped).sort((a, b) => a - b).forEach(lv => {
        grouped[lv].sort((a, b) => b.cons - a.cons);
        
        let header = document.createElement('h3');
        header.className = 'review-lv-header';
        if(lv == 7) { 
            header.style.background = "linear-gradient(90deg, #c0392b, #e74c3c)"; 
            header.style.color = "white"; 
            header.style.borderLeft = "5px solid #f1c40f"; 
            header.innerText = "🔥 狂熱字源學 (精通)"; 
        } else { 
            header.style.background = "linear-gradient(90deg, #d35400, #e67e22)"; 
            header.style.color = "white"; 
            header.style.borderLeft = "5px solid #f1c40f"; 
            header.innerText = `Level ${lv} 單字圖鑑`; 
        }
        list.appendChild(header);

        let gridDiv = document.createElement('div');
        gridDiv.className = 'graduated-grid'; // ✨ 改用 CSS class

        grouped[lv].forEach(item => {
            let starHTML = ""; let bgStyle = ""; let borderColor = "";
            
            // 1. 判斷是否為炫彩卡，並動態設定對應的卡片顏色
            let isChroma = item.isGrad && item.isGrad.chroma;

            if (isChroma) { 
                starHTML = "✨ 炫彩金星 (超凡)"; bgStyle = "#fffbea"; borderColor = "#f1c40f"; 
            } else if (item.cons >= 5) { 
                starHTML = "🥇 金星 (畢業)"; bgStyle = "#fffbea"; borderColor = "#f1c40f"; 
            } else if (item.cons >= 3) { 
                starHTML = "🥈 銀星"; bgStyle = "#f8f9fa"; borderColor = "#bdc3c7"; 
            } else { 
                starHTML = "🥉 銅星"; bgStyle = "#fdf2e9"; borderColor = "#e67e22"; 
            }

            let card = document.createElement('div');
            card.className = 'graduated-card'; // ✨ 改用 CSS class
            if (isChroma) card.classList.add('chroma-card');
            
            card.style.background = bgStyle; 
            card.style.border = `2px solid ${borderColor}`;

            // ✨ HTML 結構徹底清理，排版樣式全部交給 CSS classes
            card.innerHTML = `
                <div class="graduated-lv-badge" style="border: 2px solid ${borderColor};">${lv == 7 ? '字根' : 'Lv.' + item.lv}</div>
                <div style="margin-top: 8px;">
                    <div class="graduated-word ${isChroma ? 'dex-word-title' : ''}">${item.w}</div>
                    <div class="graduated-meaning">${item.meaning}</div>
                </div>
                <div style="width: 100%;">
                    <div class="graduated-star-badge" style="border: 1px dashed ${borderColor};">${starHTML}</div>
                </div>
            `;

            if (item.isGrad) {
                let btn = document.createElement('button');
                btn.innerText = '🔄 召回重練';
                btn.className = 'btn-revive'; // ✨ 改用 CSS class
                btn.addEventListener('click', () => reviveWord(item.w));
                card.querySelector('div:last-child').appendChild(btn);
            }
            gridDiv.appendChild(card);
        });
        list.appendChild(gridDiv);
    });
}

function reviveWord(wk) {
    if (gameState.graduated[wk]) {
        delete gameState.graduated[wk]; 
        if (gameState.wordStats[wk]) { 
            gameState.wordStats[wk].consecutive = 0; 
            gameState.wordStats[wk].isRecalled = true; // 🌟 標記為召回重練
        }
        saveGame(); renderGraduatedList(); showToast(`🔄 記憶消退！[${wk}] 已重新加入題庫！`, "info");
    }
}
function moveAllPets() {
    // 🌟 終極防呆：過濾掉存檔裡未知的「幽靈寵物」，只允許活著的寵物移動
    const validPets = gameState.petsOwned.filter(pid => activePets[pid]);

    validPets.forEach(pid => {
        let p = activePets[pid]; 
        let stat = gameState.petStats[pid] || { lv: 1, exp: 0 }; // 確保 stat 有預設值
        let speed = getPetSpeed(stat.lv);
        
        if (gameState.energy >= 90) speed *= 3.0; 
        
        // ✨ 如果開啟兒童模式，動物沒體力時只會趴下睡覺 (Down)
        if (gameState.energy <= 0) { p.dir = gameState.kidsMode ? 'Down' : 'Dead'; return; }
        
        if (p.state === 'idle') {
             p.timer--;
             if (p.timer <= 0) { 
                p.targetX = Math.random()*(COLS-1); 
                p.targetY = Math.random()*(ROWS-1); 
                p.state = 'walk'; 
             } 
        } else {
            let dx = p.targetX - p.x, dy = p.targetY - p.y, dist = Math.sqrt(dx*dx + dy*dy);
            if (dist > speed) { 
                p.x += (dx/dist)*speed; 
                p.y += (dy/dist)*speed; 
                p.dir = Math.abs(dx)>Math.abs(dy) ? (dx>0 ? 'Right' : 'Left') : (dy>0 ? 'Down' : 'Up'); 
                checkPetCollision(p); 
            } else { 
                p.state = 'idle'; 
                p.timer = Math.random()*80+30; 
            }
        }
    });
}
function checkPetCollision(p) {
    let tx = Math.floor(p.x + 0.5), ty = Math.floor(p.y + 0.5);
    if(tx>=0 && tx<COLS && ty>=0 && ty<ROWS && gameState.farmTiles[ty] && gameState.farmTiles[ty][tx]) {
        let t = gameState.farmTiles[ty][tx];
        if (t.plant) {
            let b = (gameState.energy >= 90) ? 0.3 : 0.1;
            if (t.progress < 100) { t.progress += b; } 
            else if (t.progress >= 100) {
                gameState.inventory[t.type] = (gameState.inventory[t.type] || 0) + 1;
                t.plant = false; t.progress = 0;
                let plantEmoji = SEED_DATA[t.type] ? SEED_DATA[t.type].name.split(' ')[0] : '🌱';
                t.type = null;
                showFloatingText(`+1 ${plantEmoji}`, "#2ecc71"); 
            }
        }
    }
}

function tick() {
    // 🌟 關鍵保護網：確保動畫迴圈「永遠不死」
    try {
        gameState.energy = Math.max(0, gameState.energy - 0.04);
        moveAllPets();
        
        // 只有在畫布有實際長寬時才進行繪圖
        if (canvas.width > 0 && canvas.height > 0) {
            draw();
        }
        updateUI();
    } catch (e) {
        console.error("🚨 農場渲染發生異常，但已成功攔截：", e);
    }
    
    // 把這行放在外面，保證無論如何都會繼續呼叫自己
    requestAnimationFrame(tick);
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const STEP_RATIO = 0.6;
    const VERTICAL_STEP = TILE_SIZE * STEP_RATIO;
    const OBJECT_Y_OFFSET = TILE_SIZE * -0.4;

    gameState.farmTiles.forEach((row, y) => {
        row.forEach((tile, x) => {
            let px = offsetX + x * TILE_SIZE;
            let py = offsetY + y * VERTICAL_STEP;
            let grassImg = (x + y) % 2 === 0 ? images.grass_light : images.grass_dark;
            
            if (grassImg && grassImg.isLoaded) {
                ctx.drawImage(grassImg, px, py, TILE_SIZE, TILE_SIZE);
            }
        });
    });

    gameState.farmTiles.forEach((row, y) => {
        if (y % 2 === 0) return; 

        row.forEach((tile, x) => {
            let px = offsetX + x * TILE_SIZE;
            let py = offsetY + y * VERTICAL_STEP + OBJECT_Y_OFFSET;
            if (y === ROWS - 1) { py -= TILE_SIZE * -0.03; }

            if (images.soil && images.soil.isLoaded) {
                ctx.drawImage(images.soil, px, py, TILE_SIZE, TILE_SIZE);
            }

            if (tile.plant) {
                let k = tile.progress >= 100 ? tile.type + '_02' : tile.type + '_01';
                if (images[k] && images[k].isLoaded) {
                    ctx.drawImage(images[k], px, py, TILE_SIZE, TILE_SIZE);
                }
                
                if (tile.progress < 100) {
                    ctx.fillStyle = "rgba(0,0,0,0.3)";
                    ctx.fillRect(px + TILE_SIZE*0.2, py + TILE_SIZE*0.82, TILE_SIZE*0.6, TILE_SIZE*0.06);
                    ctx.fillStyle = "#2ecc71";
                    ctx.fillRect(px + TILE_SIZE*0.2, py + TILE_SIZE*0.82, (tile.progress/100) * TILE_SIZE*0.6, TILE_SIZE*0.06);
                }
            }
        });
    });

    // 🌟 終極防呆：只畫出真的存在於 activePets 裡的寵物
    let validPets = [...gameState.petsOwned].filter(pid => activePets[pid]);
    let sortedPets = validPets.sort((a, b) => activePets[a].y - activePets[b].y);
    
    sortedPets.forEach(petId => {
        let p = activePets[petId];
        let stat = gameState.petStats[petId] || { lv: 1 }; // 防呆
        let pSize = getPetSize(stat.lv);
        let drawX = offsetX + p.x * TILE_SIZE;
        let drawY = offsetY + p.y * VERTICAL_STEP + OBJECT_Y_OFFSET;
        
        let imgKey = petId + "_" + p.dir;
        if (images[imgKey] && images[imgKey].isLoaded) {
            ctx.drawImage(images[imgKey], drawX - (pSize - TILE_SIZE)/2, drawY - (pSize - TILE_SIZE), pSize, pSize);
        }
    });
}

function processFeeding(type, amount) {
    let cp = gameState.currentPet; 
    let stat = gameState.petStats[cp]; 
    let count = gameState.inventory[type] || 0;
    amount = Math.min(amount, count); 
    if (amount > 0) {
        gameState.inventory[type] -= amount; 
        stat.exp += SEED_DATA[type].exp * amount; 
        gameState.energy = Math.min(100, gameState.energy + (10 * amount));
        
        let getRequiredExp = (lv) => Math.floor(100 * Math.pow(1.15, lv - 1));
        while (stat.exp >= getRequiredExp(stat.lv)) {
            if (!gameState.isPro && stat.lv >= 15) { 
                stat.exp = getRequiredExp(15); 
                showPaywall("免費版寵物最高 15 級！\n升級專業版解鎖無上限等級與黃金作物！"); 
                break; 
            }
            stat.exp -= getRequiredExp(stat.lv); 
            stat.lv++; 
            gameState.energy = 100; 
            showToast(`🎉 寵物升級到 Lv.${stat.lv}！`, "success");
        }
        updateUI(); 
        saveGame(); 
        togglePanel('inventory'); 
    }
}

function feedPig(type) { processFeeding(type, 1); }
function feedAllOf(type) { processFeeding(type, gameState.inventory[type] || 0); }
// 💰 單筆賣出作物
function sellPlant(type) { 
    if (gameState.inventory[type] > 0) { 
        gameState.inventory[type]--; // 扣除背包道具
        gameState.coins += SEED_DATA[type].sellPrice; // 增加金幣
        
        saveGame(); 
        updateUI(); 
        togglePanel('inventory'); // 刷新背包面板
    } 
}

// 💰 一鍵賣出全部同類作物
function sellAllOf(type) { 
    let count = gameState.inventory[type] || 0; 
    
    if (count > 0) { 
        gameState.coins += count * SEED_DATA[type].sellPrice; // 計算總收益
        gameState.inventory[type] = 0; // 清空該作物庫存
        
        saveGame(); 
        updateUI(); 
        togglePanel('inventory'); // 刷新背包面板
    } 
}
function autoHarvest() {
    let count = 0;
    gameState.farmTiles.forEach(r => r.forEach(t => {
        if(t.plant && t.progress >= 100) { gameState.inventory[t.type] = (gameState.inventory[t.type] || 0) + 1; t.plant = false; t.type = null; t.progress = 0; count++; }
    }));
    if(count > 0) { 
        updateUI(); saveGame(); showToast(`🚜 成功一鍵收成了 ${count} 個作物！`, "success");
        const p = document.getElementById('floating-panel'); if(!p.classList.contains('hidden') && document.getElementById('panel-title').innerText.includes('背包')) togglePanel('inventory'); 
    } else showToast("🚜 目前沒有成熟的作物可以收成喔！", "info"); 
}

// 🌟 修復版一鍵播種：直接使用當前裝備的種子種滿
function autoPlant() {
    let cost = SEED_DATA[gameState.currentSeed].cost; 
    let emptyTiles = [];
    
    for(let y=0; y<ROWS; y++) { 
        if (y % 2 === 0) continue; // 確保只種在有泥土的行數，避免錯位
        for(let x=0; x<COLS; x++) { 
            if(!gameState.farmTiles[y][x].plant) emptyTiles.push({x: x, y: y}); 
        } 
    }
    
    emptyTiles.sort(() => Math.random() - 0.5);
    let count = 0;
    
    for(let i=0; i<emptyTiles.length; i++) {
        if (gameState.coins >= cost) { 
            gameState.coins -= cost; 
            let t = gameState.farmTiles[emptyTiles[i].y][emptyTiles[i].x]; 
            t.plant = true; 
            t.type = gameState.currentSeed; 
            t.progress = 0; 
            count++; 
        } else {
            break; 
        }
    }
    
    if(count > 0) { 
        updateUI(); saveGame(); 
        showToast(`🌱 成功一鍵播種了 ${count} 個 ${SEED_DATA[gameState.currentSeed].name}！`, "success"); 
    } else if (gameState.coins < cost) { 
        showToast(`💰 金幣不足！每個需要 ${cost} 金幣。`, "error"); 
    } else {
        showToast("🌱 農場客滿，沒有空地囉！", "info"); 
    }
}

function equipSeed(type) { gameState.currentSeed = type; saveGame(); updateUI(); togglePanel('shop'); }
function switchPet(petId) { gameState.currentPet = petId; updateUI(); togglePanel(); saveGame(); }
// 🐾 購買或切換寵物
function buyPet(petId) {
    // 1. 專業版權限檢查
    if (petId === 'cat' && !gameState.isPro) { 
        showPaywall("解鎖最強寵物「比比拉布」是專業版專屬福利喔！"); 
        togglePanel(); 
        return; 
    }
    
    let cost = PET_DATA[petId].cost;
    
    // 2. 扣款與發放邏輯
    if (gameState.coins >= cost) { 
        gameState.coins -= cost; // 扣錢
        gameState.petsOwned.push(petId); // 獲得寵物
        
        switchPet(petId); 
        loadQuestion(); 
        showToast(`🎉 成功招募 ${PET_DATA[petId].title}！`, "success");
    } else {
        showToast(`💰 金幣不足！需要 ${cost}`, "error"); 
    }
}

// 🎛️ 面板總管：負責控制開關與指派任務
function togglePanel(type) {
    const p = document.getElementById('floating-panel');
    const panelBody = document.getElementById('panel-body');
    if (!type) { p.classList.add('hidden'); return; }
    
    p.classList.remove('hidden');
    panelBody.innerHTML = ''; 

    if (type === 'inventory') {
        renderInventoryPanel(panelBody);
    } else if (type === 'shop') {
        renderShopPanel(panelBody);
    } else if (type === 'pet') {
        renderPetPanel(panelBody);
    }
}

// 🎒 專屬渲染：背包面板
function renderInventoryPanel(panelBody) {
    const pTitle = document.getElementById('panel-title'); 
    if(pTitle) pTitle.innerText = '背包：' + PET_DATA[gameState.currentPet].title;
    
    let harvestBtn = document.createElement('button');
    harvestBtn.innerText = '🚜 一鍵收成';
    harvestBtn.style = "width:100%; margin-bottom:10px; background:#9b59b6; padding:10px; border-radius:8px; color:white; font-weight:bold; cursor:pointer; border:none;";
    harvestBtn.addEventListener('click', autoHarvest);
    panelBody.appendChild(harvestBtn);
    
    let hasItem = false;
    
    if (gameState.inventory['renameScroll'] > 0) {
        hasItem = true;
        let div = document.createElement('div'); div.className = 'shop-item'; div.style = "flex-wrap: wrap; margin-bottom: 10px; padding-bottom: 15px; border-bottom: 2px solid #f1c40f;";
        div.innerHTML = `<span style="width: 100%; font-weight: 900; margin-bottom: 10px; display: block; font-size: 1.1em; color: #8e44ad;">📜 傳說改名卷軸 x ${gameState.inventory['renameScroll']}</span>`;
        let btn = document.createElement('button'); btn.innerText = '✨ 改變命運 (使用)'; btn.style = "width:100%; background:linear-gradient(135deg, #9b59b6, #8e44ad); box-shadow: 0 4px 0 #732d91; color: white; border: none; padding: 10px; border-radius: 8px; cursor: pointer; font-weight: bold;";
        btn.addEventListener('click', useRenameScroll);
        div.appendChild(btn); panelBody.appendChild(div);
    }
    
    if (gameState.inventory['potion'] > 0) {
        hasItem = true;
        let div = document.createElement('div'); div.className = 'shop-item'; div.style = "flex-wrap: wrap; margin-bottom: 10px; padding-bottom: 15px; border-bottom: 2px dashed #2ecc71;";
        div.innerHTML = `<span style="width: 100%; font-weight: bold; margin-bottom: 10px; display: block; font-size: 1.1em; color: #27ae60;">🧪 催熟藥水 x ${gameState.inventory['potion']}</span>`;
        let btn = document.createElement('button'); btn.innerText = '✨ 對全農場使用'; btn.style = "width:100%; background:#2ecc71; color: white; border: none; padding: 10px; border-radius: 8px; cursor: pointer; font-weight: bold; box-shadow: 0 4px 0 #27ae60;";
        btn.addEventListener('click', usePotion);
        div.appendChild(btn); panelBody.appendChild(div);
    }
    
    if (gameState.inventory['shield'] > 0) {
        hasItem = true;
        let div = document.createElement('div'); div.className = 'shop-item'; div.style = "background: #e8f8f5; border: 2px solid #1abc9c; margin-bottom: 10px;";
        div.innerHTML = `<span style="font-weight: bold; color: #16a085;">🛡️ 連勝保護傘 x ${gameState.inventory['shield']}<br><small style="color:#7f8c8d;">(答錯時自動消耗)</small></span>`;
        panelBody.appendChild(div);
    }
    
    for (let key in SEED_DATA) {
        let count = gameState.inventory[key] || 0;
        if (count > 0) { 
            hasItem = true;
            let div = document.createElement('div'); div.className = 'shop-item'; div.style = "flex-wrap: wrap; margin-bottom: 10px; padding-bottom: 15px; border-bottom: 1px dashed #ccc;";
            div.innerHTML = `<span style="width: 100%; font-weight: bold; margin-bottom: 10px; display: block; font-size: 1.1em; color: #2c3e50;">${SEED_DATA[key].name} x ${count}</span>`;
            
            let btnGroup = document.createElement('div'); btnGroup.style = "display: grid; grid-template-columns: 1fr 1fr; gap: 8px; width: 100%;";
            
            let b1 = document.createElement('button'); b1.innerText = '餵 1'; b1.style.background = '#8bc34a'; b1.addEventListener('click', () => feedPig(key));
            let b2 = document.createElement('button'); b2.innerText = '全餵'; b2.style.background = '#27ae60'; b2.addEventListener('click', () => feedAllOf(key));
            let b3 = document.createElement('button'); b3.innerText = '賣 1'; b3.style.background = '#f39c12'; b3.addEventListener('click', () => sellPlant(key));
            let b4 = document.createElement('button'); b4.innerText = '全賣'; b4.style.background = '#e74c3c'; b4.addEventListener('click', () => sellAllOf(key));
            
            btnGroup.append(b1, b2, b3, b4); div.appendChild(btnGroup); panelBody.appendChild(div);
        }
    }
    
    if(!hasItem) panelBody.innerHTML += "<p style='text-align:center; color:#777; margin-top:20px;'>背包空空的</p>";
}

// 🛒 專屬渲染：商城面板
// 🛒 專屬渲染：商城面板 (✨ 清除醜蛋圖片版 ✨)
function renderShopPanel(panelBody) {
    const pTitle = document.getElementById('panel-title'); 
    if(pTitle) pTitle.innerText = '領主商城';
    
    let title1 = document.createElement('h4'); 
    title1.style = "margin: 0 0 10px 0; color: #d35400; border-bottom: 2px solid #eee;"; 
    title1.innerText = "✨ 傳說金蛋 (神秘大獎、寵物等你抽)"; 
    panelBody.appendChild(title1);

    let gachaDiv = document.createElement('div'); 
    gachaDiv.className = 'shop-item'; 
    // 重新排版：移除 column，縮小內距，讓按鈕看起來更整潔
    gachaDiv.style = "background:#fff8e1; border:2px solid #f1c40f; padding:15px; border-radius:12px; box-shadow: 0 4px 15px rgba(241, 196, 15, 0.2);";
    
    // 💡 核心：將原本的 <img> 標籤移除，只保留按鈕區塊
    gachaDiv.innerHTML = `
        <div style="display:flex; gap:12px; width:100%; justify-content: center;">
            <button onclick="drawGacha(1)" style="flex:1; max-width: 150px; background:linear-gradient(135deg, #f39c12, #e67e22); color:white; border-radius:10px; padding:12px; border:none; font-weight:bold; cursor:pointer; box-shadow: 0 4px 0 #d35400; transition: 0.1s;">單抽 💰5000</button>
            <button onclick="drawGacha(10)" style="flex:1; max-width: 150px; background:linear-gradient(135deg, #e67e22, #d35400); color:white; border-radius:10px; padding:12px; border:none; font-weight:bold; cursor:pointer; box-shadow: 0 4px 0 #c0392b; transition: 0.1s;">十抽 💰45000</button>
        </div>
    `;
    
    // 幫按鈕加上點擊效果 (向下按)
    gachaDiv.querySelectorAll('button').forEach(btn => {
        btn.addEventListener('mousedown', () => { btn.style.transform = 'translateY(4px)'; btn.style.boxShadow = 'none'; });
        btn.addEventListener('mouseup', () => { btn.style.transform = 'translateY(0)'; btn.style.boxShadow = btn.innerText.includes('十抽') ? '0 4px 0 #c0392b' : '0 4px 0 #d35400'; });
    });

    panelBody.appendChild(gachaDiv);

    // 道具區塊 (保持不變)
    let title2 = document.createElement('h4'); 
    title2.style = "margin: 20px 0 10px 0; color: #2980b9; border-bottom: 2px solid #eee;"; 
    title2.innerText = "🛠️ 實用道具"; 
    panelBody.appendChild(title2);

    let shieldDiv = document.createElement('div'); shieldDiv.className = 'shop-item'; shieldDiv.style.marginBottom = "15px";
    shieldDiv.innerHTML = `<span>🛡️ 連勝保護傘 (💰15000)<br><small style="color:#7f8c8d;">答錯時免除一次連勝歸零</small></span>`;
    let shieldBtn = document.createElement('button'); shieldBtn.innerText = "購買"; shieldBtn.style = "background: #3498db; color: white;";
    shieldBtn.addEventListener('click', () => buyItem('shield', 15000)); 
    shieldDiv.appendChild(shieldBtn); 
    panelBody.appendChild(shieldDiv);
}

// 🐾 專屬渲染：寵物招募面板
function renderPetPanel(panelBody) {
    const pTitle = document.getElementById('panel-title'); 
    if(pTitle) pTitle.innerText = '寵物招募';
    
    for (let key in PET_DATA) {
        let pData = PET_DATA[key]; 
        let isOwned = gameState.petsOwned.includes(key); 
        let isCurrent = gameState.currentPet === key;
        
        let petDiv = document.createElement('div'); 
        petDiv.className = 'shop-item'; 
        petDiv.style.background = isOwned ? (isCurrent ? '#e8f5e9' : 'transparent') : '#fdf2e9';
        petDiv.innerHTML = `<span style="font-weight:bold;">${pData.title} <br><small>${isOwned ? 'Lv.' + gameState.petStats[key].lv : pData.desc}</small></span>`;
        
        let btn = document.createElement('button'); 
        if (isOwned) {
            btn.innerText = isCurrent ? '指定' : '選擇'; 
            btn.style.background = isCurrent ? '#999' : '#3498db';
            if(isCurrent) btn.disabled = true;
            btn.addEventListener('click', () => switchPet(key));
        } else {
            btn.innerText = (key === 'cat' && !gameState.isPro) ? "🔒 PRO專屬" : `💰${pData.cost}`;
            btn.style.background = (key === 'cat' && !gameState.isPro) ? "#95a5a6" : "#e74c3c";
            btn.addEventListener('click', () => buyPet(key));
        }
        petDiv.appendChild(btn); 
        panelBody.appendChild(petDiv);
    }
}

// 🛒 購買一般道具
function buyItem(itemKey, cost) {
    if (gameState.coins >= cost) { 
        gameState.coins -= cost; // 扣錢
        gameState.inventory[itemKey] = (gameState.inventory[itemKey] || 0) + 1; // 放入背包
        
        saveGame(); 
        updateUI(); 
        showToast(`🛍️ 購買成功！已放入背包。`, "success"); 
    } else {
        showToast("💰 金幣不足！", "error");
    }
}

function usePotion() {
    if (!gameState.inventory['potion'] || gameState.inventory['potion'] <= 0) return;
    let grewSomething = false;
    gameState.farmTiles.forEach(r => r.forEach(t => { if(t.plant && t.progress < 100) { t.progress = 100; grewSomething = true; } }));
    if (grewSomething) { gameState.inventory['potion']--; saveGame(); updateUI(); togglePanel('inventory'); showToast("✨ 魔法生效！全農場作物瞬間成熟！", "success"); } 
    else showToast("🌱 目前沒有需要催熟的作物喔！", "info");
}

window.closeGacha = function() {
    document.getElementById('gacha-modal').classList.add('hidden');
    if (typeof togglePanel === 'function') togglePanel('shop'); 
};

// ================= ✨ 核心重構：十連抽金蛋發慌爆炸動畫 (Emoji & ID 分離版) ✨ =================

window.drawGacha = function(count) {
    const cost = (count === 10) ? 45000 : 5000;
    if (gameState.coins < cost) return showToast("💰 金幣不足！", "error");
    
    // 1. 扣除金幣
    gameState.coins -= cost;
    saveGame(); 
    updateUI(); 
    if (typeof togglePanel === 'function') togglePanel(); // 關閉商城面板

    // 2. 準備抽卡結果 (✨ 完全保留你的機率邏輯 ✨)
    let results = [];
    for(let i=0; i<count; i++) {
        let r = Math.random();
        // 0.2%：極致稀有 (UR) - 改名卷軸
        if (r < 0.0005)      results.push({name: "改名卷軸", icon: "📜", type: "item", key: "renameScroll"}); 
        // 2%：高級道具 (SSR) - 藥水
        else if (r < 0.022)  results.push({name: "催熟藥水", icon: "🧪", type: "item", key: "potion"});       
        // 7%：實用道具 (SR) - 保護傘
        else if (r < 0.042)  results.push({name: "保護傘", icon: "🛡️", type: "item", key: "shield"});       
        // 3%：大獎金 (1萬) - 翻倍
        else if (r < 0.122)  results.push({name: "1萬金幣", icon: "💰", type: "coin", val: 10000});          
        // 10%：保本獎 (5千) - 平手
        else if (r < 0.222)  results.push({name: "5千金幣", icon: "💵", type: "coin", val: 5000});           
        // 35%：小虧獎 (1千)
        else if (r < 0.572)  results.push({name: "1千金幣", icon: "🪙", type: "coin", val: 1000});           
        // 42.8%：血虧獎 (200) - 增加挫折感
        else                 results.push({name: "200金幣", icon: "🙉", type: "coin", val: 200});            
    }

    // 3. 🌟 金蛋發慌並變大爆炸的動畫序列 🌟
    
    // a) 創建全螢幕的黑色半透明動畫層
    const animOverlay = document.createElement('div');
    animOverlay.id = 'gacha-animation-overlay';
    animOverlay.style = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.8); z-index:18000; display:flex; justify-content:center; align-items:center; opacity:0; transition:opacity 0.3s;";
    document.body.appendChild(animOverlay);
    
    // 淡入動畫層
    setTimeout(() => { animOverlay.style.opacity = '1'; }, 10);

    // b) 放入一顆金蛋
    const goldenEgg = document.createElement('img');
    goldenEgg.src = 'assets/golden_egg.png'; // 這裡維持金蛋圖片
    goldenEgg.style = "width: 150px; transform-origin: center;";
    animOverlay.appendChild(goldenEgg);

    // c) 觸發發慌變大動畫
    setTimeout(() => {
        goldenEgg.classList.add('egg-panic-grow');
    }, 100);

    // d) 2.8秒後金蛋爆炸，閃光並顯示結果
    setTimeout(() => {
        // e) 閃光特效
        const flashOverlay = document.createElement('div');
        flashOverlay.className = 'gacha-explosion-overlay gacha-flash-effect';
        document.body.appendChild(flashOverlay);

        // f) 移除金蛋動畫層
        animOverlay.remove();
        
        // g) 🌟 顯示全新的、分離結構的結算視窗 🌟
        const modalBg = document.getElementById('gacha-modal');
        const resultModal = document.getElementById('gacha-result-modal');
        const resultGrid = document.getElementById('gacha-results-grid');
        
        modalBg.classList.remove('hidden'); 
        resultModal.classList.remove('hidden'); 
        resultGrid.innerHTML = ''; 

        // h) 渲染放大的 Emoji 獎勵結果
        results.forEach(res => {
            const itemDiv = document.createElement('div');
            itemDiv.className = 'gacha-result-item';
            // 將圖片換成放大的 Emoji
            itemDiv.style = "text-align:center; padding:15px 5px; background:#f9f9f9; border-radius:12px; border: 2px solid #eee;";
            
            // 特殊高光：如果是 UR 改名卷軸，給個金色閃耀框
            if (res.key === 'renameScroll') {
                itemDiv.style.background = "#fffbea";
                itemDiv.style.borderColor = "#f1c40f";
            }

            // HTML 結構徹底清理，排版樣式全部交給 CSS classes
            itemDiv.innerHTML = `<div style="font-size:3em; line-height:1.2; margin-bottom:5px; text-shadow: 0 4px 10px rgba(0,0,0,0.1);">${res.icon}</div><div style="font-size:0.9em; font-weight:bold; color:#2c3e50;">${res.name}</div>`;
            resultGrid.appendChild(itemDiv);

            // 發放金幣或道具到背包
            if(res.type === "coin") gameState.coins += res.val;
            else if(res.type === "item") {
                gameState.inventory[res.key] = (gameState.inventory[res.key] || 0) + 1;
            }
        });

        saveGame(); 
        updateUI();

        // j) 移除閃光層
        setTimeout(() => { flashOverlay.remove(); }, 300);

    }, 2800); 
};

function useRenameScroll() {
    if (!gameState.inventory['renameScroll'] || gameState.inventory['renameScroll'] <= 0) return;
    let target = prompt("請輸入數字選擇要改名的對象：\n[1] 勇者姓名 (你自己)\n[2] 目前的寵物");
    
    if (target === "1") {
        let newName = prompt("請輸入新的勇者姓名：");
        if (newName && newName.trim()) {
            // 關鍵修復：必須同步更新 gameState 裡的名字，不然重整就沒了
            gameState.playerName = newName.trim();
            currentUser = gameState.playerName;
            
            document.getElementById('hub-player-name').innerText = currentUser;
            gameState.inventory['renameScroll']--; 
            saveGame(); 
            updateUI(); 
            togglePanel('inventory'); 
            showToast("✨ 命運已改寫！勇者姓名已變更！", "success");
        }
    } else if (target === "2") {
        let newPetName = prompt("請輸入寵物的新名字：");
        if (newPetName && newPetName.trim()) {
            let cp = gameState.currentPet; 
            gameState.petStats[cp].customName = newPetName.trim();
            gameState.inventory['renameScroll']--; 
            saveGame(); 
            updateUI(); 
            togglePanel('inventory'); 
            showToast("✨ 契約已重鑄！寵物姓名已變更！", "success");
        }
    }
}

function updateUI() {
    const kidsToggle = document.getElementById('kids-mode-toggle'); 
    if (kidsToggle) {
        kidsToggle.checked = !!gameState.kidsMode;
        // 根據狀態設定 body 的 class
        if (gameState.kidsMode) document.body.classList.add('kids-mode-active');
        else document.body.classList.remove('kids-mode-active');
    }



    const coinEl = document.getElementById('coin-count'); if(coinEl) coinEl.innerText = Math.floor(gameState.coins);
    const proBadge = document.getElementById('pro-badge');
    if (gameState.isPro) { document.body.classList.add('is-pro'); if (proBadge) proBadge.classList.remove('hidden'); } 
    else { document.body.classList.remove('is-pro'); if (proBadge) proBadge.classList.add('hidden'); }
    
    let energyFill = document.getElementById('energy-fill');
    if(energyFill) {
        energyFill.style.width = gameState.energy + "%";
        if (gameState.energy >= 90) { energyFill.style.background = "#f1c40f"; energyFill.style.boxShadow = "0 0 10px #f1c40f"; } 
        else { energyFill.style.background = "#e67e22"; energyFill.style.boxShadow = "none"; }
    }
    const energyNum = document.getElementById('energy-num'); if (energyNum) energyNum.innerText = Math.floor(gameState.energy);
    
    const comboBadge = document.getElementById('combo-badge'); const comboCount = document.getElementById('combo-count');
    if (gameState.combo >= 3) { if (comboBadge) comboBadge.classList.remove('hidden'); if (comboCount) comboCount.innerText = gameState.combo; } 
    else { if (comboBadge) comboBadge.classList.add('hidden'); }

    let cp = gameState.currentPet; let stat = gameState.petStats[cp];
    const expFill = document.getElementById('exp-fill'); let reqExp = Math.floor(100 * Math.pow(1.15, stat.lv - 1));
    if(expFill) expFill.style.width = (stat.exp / reqExp * 100) + "%";
    const pigLv = document.getElementById('pig-lv'); if(pigLv) pigLv.innerText = stat.lv;
    const playerName = document.getElementById('player-name-display'); if(playerName) playerName.innerText = currentUser + " 的 " + (stat.customName || PET_DATA[cp].title);
    
    let petImgKey = cp + "_Down"; if (!images[petImgKey] || !images[petImgKey].isLoaded) petImgKey = "pig_Down";
    const pigImg = document.getElementById('pig-img'); if (pigImg && images[petImgKey] && images[petImgKey].isLoaded) { pigImg.src = images[petImgKey].src; pigImg.style.display = 'block'; }

    // 🌟 關鍵修復：確保每次更新 UI 時，左下角裝備按鈕都會被畫出來！
    if (typeof window.renderSeedSelectorBtn === 'function') {
        window.renderSeedSelectorBtn();
    }
}

function switchTab(tabName) {
    if (window.innerWidth > 1024) return; 
    const sidebar = document.getElementById('sidebar'); 
    const farm = document.getElementById('farm-viewport');
    const quizBtn = document.getElementById('nav-quiz-btn'); 
    const farmBtn = document.getElementById('nav-farm-btn');
    
    if (tabName === 'quiz') { 
        if(sidebar) sidebar.classList.remove('mobile-hidden'); 
        if(farm) farm.classList.add('mobile-hidden'); 
        if(quizBtn) quizBtn.classList.add('active'); 
        if(farmBtn) farmBtn.classList.remove('active'); 
    } 
    else if (tabName === 'farm') { 
        if(sidebar) sidebar.classList.add('mobile-hidden'); 
        if(farm) farm.classList.remove('mobile-hidden'); 
        if(quizBtn) quizBtn.classList.remove('active'); 
        if(farmBtn) farmBtn.classList.add('active'); 
        
        // 🌟 雙重觸發機制：確保手機切換畫面時，一定能重新撐開畫布
        requestAnimationFrame(() => {
            resize();
            setTimeout(resize, 100);
        });
    }
}

const DAILY_TASKS_CONFIG = [
    { id: 'login', desc: '📅 每日登入簽到', goal: 1, reward: 50 },
    { id: 'correct50', desc: '📝 本日累積答對 50 題', goal: 50, reward: 300 },
    { id: 'combo15', desc: '🔥 達成一次 15 連勝', goal: 15, reward: 200 }
];

function checkDailyReset() {
    let today = new Date().toLocaleDateString();
    if (gameState.lastLoginDate !== today) {
        gameState.lastLoginDate = today; gameState.dailyProgress = { login: 1, correct50: 0, combo15: 0 }; gameState.dailyClaimed = { login: false, correct50: false, combo15: false };
        saveGame(); setTimeout(() => showToast("🌅 新的一天開始了！每日任務已刷新！", "success"), 1000);
    }
}

function updateDailyTask(taskId, amount = 1, isAbsolute = false) {
    if (!gameState.dailyProgress) return;
    if (isAbsolute) { if (amount > gameState.dailyProgress[taskId]) gameState.dailyProgress[taskId] = amount; } else { gameState.dailyProgress[taskId] += amount; }
    saveGame();
}

function openDailyTasks() {
    const list = document.getElementById('daily-task-list'); list.innerHTML = '';
    DAILY_TASKS_CONFIG.forEach(task => {
        let current = gameState.dailyProgress[task.id] || 0; let isComplete = current >= task.goal; let isClaimed = gameState.dailyClaimed[task.id];
        
        let taskDiv = document.createElement('div');
        taskDiv.style = `display: flex; justify-content: space-between; align-items: center; background: #f8f9fa; padding: 15px; border-radius: 12px; border: 2px solid ${isComplete && !isClaimed ? '#f1c40f' : '#ecf0f1'};`;
        taskDiv.innerHTML = `<div style="text-align: left;"><div style="font-weight: bold; color: #2c3e50; font-size: 1.1em;">${task.desc}</div><div style="font-size: 0.85em; color: #e67e22; margin-top: 4px;">獎勵：💰 ${task.reward}</div></div>`;
        
        let actionDiv = document.createElement('div');
        if (isClaimed) { 
            let btn = document.createElement('button'); btn.disabled = true; btn.innerText = "已領取"; btn.style = "background: #bdc3c7; color: white; border: none; padding: 8px 15px; border-radius: 8px; font-weight: bold; cursor: not-allowed;";
            actionDiv.appendChild(btn);
        } else if (isComplete) { 
            let btn = document.createElement('button'); btn.innerText = `領 💰${task.reward}`; btn.style = "background: #f1c40f; color: #d35400; border: none; padding: 8px 15px; border-radius: 8px; font-weight: bold; cursor: pointer; box-shadow: 0 3px 0 #e67e22; animation: pulse 1s infinite;";
            btn.addEventListener('click', () => claimDailyTask(task.id, task.reward));
            actionDiv.appendChild(btn);
        } else { 
            actionDiv.innerHTML = `<span style="color: #7f8c8d; font-weight: bold;">${current} / ${task.goal}</span>`; 
        }
        taskDiv.appendChild(actionDiv); list.appendChild(taskDiv);
    });
    document.getElementById('daily-task-modal').classList.remove('hidden');
}

function claimDailyTask(taskId, reward) {
    gameState.dailyClaimed[taskId] = true; gameState.coins += reward; saveGame(); updateUI(); openDailyTasks(); showToast(`🎉 任務完成！獲得 💰 ${reward} 金幣！`, "success");
}

let activeAudio = null; 
let isSpeaking = false; // 🔒 新增鎖定，防止重複觸發

function speakCurrentWord(speedMode = 'normal') {
    if (!currentWord || isSpeaking) return; 
    
    // 鎖定 300ms，避免按一下觸發兩次
    isSpeaking = true;
    setTimeout(() => { isSpeaking = false; }, 300);

    // --- 1. 本土台語模式 ---
    if (gameState.currentRealm === 'taiwanese' && currentWord.audio) {
        const audioId = currentWord.audio; 
        const folderNum = Math.floor(parseInt(audioId) / 1000);
        const audioUrl = `./assets/audio/${folderNum}/${audioId}(1).mp3`;
        
        if (activeAudio) { activeAudio.pause(); activeAudio = null; }

        setTimeout(() => {
            activeAudio = new Audio(audioUrl);
            activeAudio.playbackRate = (speedMode === 'slow') ? 0.6 : 1.0;
            activeAudio.play().catch(e => {
                const fallbackUrl = `./assets/audio/${folderNum}/${audioId}.mp3`;
                activeAudio = new Audio(fallbackUrl);
                if (speedMode === 'slow') activeAudio.playbackRate = 0.6;
                activeAudio.play().catch(err => console.log("台語音檔載入失敗"));
            });
        }, 50); 
        return; 
    }

    // --- 2. 英文農場模式 ---
    const wordDisplay = document.getElementById('word-display');
    if (!wordDisplay) return;

    // 🏆 超強力過濾：把 [n.] (v.) / 換行 通通切掉，只唸英文單字
    const cleanWord = wordDisplay.innerText
        .replace(/\[.*?\]/g, '')  
        .replace(/\(.*?\)/g, '')  
        .replace(/（.*?）/g, '')   
        .split('\n')[0]           
        .split('/')[0]            
        .trim();
    
    if (!('speechSynthesis' in window)) return;
    
    // 徹底清除之前的語音排隊
    window.speechSynthesis.cancel();
    
    setTimeout(() => {
        const utterance = new SpeechSynthesisUtterance(cleanWord);
        utterance.lang = 'en-US';
        utterance.rate = (speedMode === 'slow') ? 0.45 : 0.85; // 稍微調快一點點慢速
        
        const voices = window.speechSynthesis.getVoices();
        const bestVoice = voices.find(v => v.name.includes('Google US English') || v.name.includes('Samantha')) || voices.find(v => v.lang.includes('en-US'));
        if (bestVoice) utterance.voice = bestVoice;
        
        window.speechSynthesis.speak(utterance);
    }, 50);
}
if ('speechSynthesis' in window) { window.speechSynthesis.onvoiceschanged = () => { console.log("🔊 系統語音包已就緒"); }; }

function showFloatingText(text, color = "#f1c40f") {
    const floatEl = document.createElement('div'); floatEl.className = 'floating-text'; floatEl.innerText = text; floatEl.style.color = color;
    floatEl.style.left = '50%'; floatEl.style.top = '40%'; floatEl.style.transform = 'translate(-50%, -50%)';
    document.body.appendChild(floatEl); setTimeout(() => { floatEl.remove(); }, 2500);
}

loadAssets();

function checkAndShowIOSPrompt() {
    const isIos = /iphone|ipad|ipod/.test(window.navigator.userAgent.toLowerCase());
    const isStandalone = window.navigator.standalone === true; 

    if (isIos && !isStandalone) {
        setTimeout(() => {
            document.getElementById('ios-install-modal').classList.remove('hidden');
        }, 1000);
    }
}

document.addEventListener("DOMContentLoaded", () => {
    const lastEmail = localStorage.getItem('last_email_vocablord');
    const emailInput = document.getElementById('email-input');
    if (lastEmail && emailInput) { 
        emailInput.value = lastEmail; 
    }

    // ❌ 刪除這行致命的 5 秒狂存設定
    // setInterval(saveGame, 5000);

    // ✅ 改成這樣：每 30 秒只存「本地端」，完全不消耗 Firebase 流量
    setInterval(() => {
        if (window.auth && window.auth.currentUser) {
            localStorage.setItem('vocabMaster_' + window.auth.currentUser.uid, JSON.stringify(gameState));
            console.log("💾 遊戲已自動保存在本地端");
        }
    }, 30000);

    // --- 新增：選項卡切換監聽器 ---
    // 這能確保在介面加載完成後，準確地為按鈕綁定事件
    const btnSwitchEnglish = document.getElementById('btn-switch-english');
    const btnSwitchTaiwanese = document.getElementById('btn-switch-taiwanese');

    if (btnSwitchEnglish && btnSwitchTaiwanese) {
        btnSwitchEnglish.addEventListener('click', () => {
            if (window.currentReviewTab !== 'english') {
                window.currentReviewTab = 'english';
                renderReviewList();
                updateUI(); 
            }
        });

        btnSwitchTaiwanese.addEventListener('click', () => {
            if (window.currentReviewTab !== 'taiwanese') {
                window.currentReviewTab = 'taiwanese';
                renderReviewList();
                updateUI(); 
            }
        });
    }

    // ... 下面的 addEventListener 維持原樣不變 ...



    document.getElementById('btn-login')?.addEventListener('click', login);
    document.getElementById('btn-register')?.addEventListener('click', register);
    document.getElementById('btn-submit-hero-name')?.addEventListener('click', submitHeroName);
    document.getElementById('btn-open-tutorial')?.addEventListener('click', showTutorial);
    document.getElementById('btn-open-coming-soon')?.addEventListener('click', showComingSoon);
    document.getElementById('realm-english')?.addEventListener('click', () => enterRealm('english'));
    document.getElementById('realm-taiwanese')?.addEventListener('click', () => enterRealm('taiwanese'));
    document.getElementById('realm-medical')?.addEventListener('click', () => enterRealm('medical'));
    document.getElementById('avatar-toggle-pet')?.addEventListener('click', () => togglePanel('pet'));
    document.getElementById('in-game-difficulty')?.addEventListener('change', changeDifficulty);
    document.getElementById('en-en-mode-toggle')?.addEventListener('change', toggleEnEnMode);
    document.getElementById('synonym-mode-toggle')?.addEventListener('change', toggleSynonymMode);


 // --- 找到這段並替換掉 ---
document.getElementById('btn-speak-normal')?.addEventListener('click', () => {
    speakCurrentWord('normal'); // 不要再這裡寫判斷了，統一交給 function 處理
});

document.getElementById('btn-speak-slow')?.addEventListener('click', () => {
    speakCurrentWord('slow');
});


document.getElementById('btn-speak-slow')?.addEventListener('click', () => speakCurrentWord('slow'));
    document.getElementById('pro-upgrade-btn')?.addEventListener('click', () => showPaywall('解鎖完整 7000 單字庫與 VIP 寵物招募權限！'));
    document.getElementById('btn-back-to-map')?.addEventListener('click', backToMap);
    document.getElementById('btn-toggle-inventory')?.addEventListener('click', () => togglePanel('inventory'));
    document.getElementById('btn-toggle-shop')?.addEventListener('click', () => togglePanel('shop'));
    
    // 綁定一鍵播種與收成按鈕
    document.getElementById('btn-auto-harvest')?.addEventListener('click', autoHarvest);
    document.getElementById('btn-auto-plant')?.addEventListener('click', autoPlant);
    
    document.getElementById('nav-quiz-btn')?.addEventListener('click', () => switchTab('quiz'));
    document.getElementById('nav-farm-btn')?.addEventListener('click', () => switchTab('farm'));
    document.getElementById('btn-close-panel')?.addEventListener('click', () => togglePanel());
    document.getElementById('btn-close-review')?.addEventListener('click', closeReviewArea);
    document.getElementById('btn-close-graduated')?.addEventListener('click', closeGraduatedArea);
    document.getElementById('btn-close-daily-task-modal')?.addEventListener('click', () => document.getElementById('daily-task-modal').classList.add('hidden'));
    document.getElementById('btn-close-tutorial-x')?.addEventListener('click', closeTutorial);
    document.getElementById('btn-close-tutorial-ok')?.addEventListener('click', closeTutorial);
    document.getElementById('btn-close-paywall')?.addEventListener('click', closePaywall);
    document.getElementById('btn-close-coming-soon-x')?.addEventListener('click', closeComingSoon);
    document.getElementById('btn-close-coming-soon-ok')?.addEventListener('click', closeComingSoon);
    document.getElementById('btn-close-rest-reminder')?.addEventListener('click', () => document.getElementById('rest-reminder-modal').classList.add('hidden'));
    document.getElementById('btn-verify-license')?.addEventListener('click', verifyLicenseKey);
    document.getElementById('btn-shield-false')?.addEventListener('click', () => resolveShieldPrompt(false));
    document.getElementById('btn-shield-true')?.addEventListener('click', () => resolveShieldPrompt(true));

    document.getElementById('btn-open-main-menu')?.addEventListener('click', () => {
        document.getElementById('main-menu-modal').classList.remove('hidden');
    });
    document.getElementById('btn-menu-daily')?.addEventListener('click', () => {
        document.getElementById('main-menu-modal').classList.add('hidden');
        openDailyTasks();
    });
    document.getElementById('btn-menu-dex')?.addEventListener('click', () => {
        document.getElementById('main-menu-modal').classList.add('hidden');
        openGraduatedArea();
    });
    document.getElementById('btn-menu-review')?.addEventListener('click', () => {
        document.getElementById('main-menu-modal').classList.add('hidden');
        openReviewArea();
    });
    document.getElementById('btn-menu-shop')?.addEventListener('click', () => {
        document.getElementById('main-menu-modal').classList.add('hidden');
        togglePanel('shop');
    });

    // 農場手動點擊種植與收成邏輯
    canvas.addEventListener('click', (e) => {
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;

        const clickX = (e.clientX - rect.left) * scaleX;
        const clickY = (e.clientY - rect.top) * scaleY;

        const STEP_RATIO = 0.6;
        const VERTICAL_STEP = TILE_SIZE * STEP_RATIO;
        const OBJECT_Y_OFFSET = TILE_SIZE * -0.4;

        for (let y = 0; y < ROWS; y++) {
            if (y % 2 === 0) continue; // 只偵測有泥土的排數
            for (let x = 0; x < COLS; x++) {
                let px = offsetX + x * TILE_SIZE;
                let py = offsetY + y * VERTICAL_STEP + OBJECT_Y_OFFSET;
                if (y === ROWS - 1) py -= TILE_SIZE * -0.03;

                // 檢查是否點擊在該格子的範圍內
                if (clickX >= px && clickX <= px + TILE_SIZE &&
                    clickY >= py && clickY <= py + TILE_SIZE) {

                    let tile = gameState.farmTiles[y][x];

                    if (tile.plant && tile.progress >= 100) {
                        // 收成
                        gameState.inventory[tile.type] = (gameState.inventory[tile.type] || 0) + 1;
                        showFloatingText(`+1`, "#2ecc71");
                        tile.plant = false;
                        tile.type = null;
                        tile.progress = 0;
                        saveGame();
                        updateUI();
                    } else if (!tile.plant) {
                        // 種植
                        let cost = SEED_DATA[gameState.currentSeed].cost;
                        if (gameState.coins >= cost) {
                            gameState.coins -= cost;
                            tile.plant = true;
                            tile.type = gameState.currentSeed;
                            tile.progress = 0;
                            showFloatingText(`-💰${cost}`, "#e74c3c");
                            saveGame();
                            updateUI();
                        } else {
                            showToast("💰 金幣不足！", "error");
                        }
                    } else {
                        // 成長中
                        showToast(`🌱 還在長大中喔... (${Math.floor(tile.progress)}%)`, "info");
                    }
                    return; // 找到對應格子後就提早結束迴圈
                }
            }
        }
    });
}); 

document.getElementById('btn-menu-redeem')?.addEventListener('click', () => {
        document.getElementById('main-menu-modal').classList.add('hidden'); // 先關掉選單
        let code = prompt("請輸入兌換碼：");
        
        if (code === "test999") {
            gameState.coins += 9999999;
            saveGame();
            updateUI();
            showToast("🎉 測試代碼生效！獲得 9,999,999 金幣！", "success");
        } else if (code) {
            showToast("❌ 兌換碼無效或已過期", "error");
        }
    });

// ==========================================
// 🎒 左下角動態裝備按鈕與選擇邏輯
// ==========================================
window.renderSeedSelectorBtn = function() {
    let container = document.getElementById('seed-selection-bar');
    if (!container) return;

    // 將種子 ID 對應到 Emoji，避免顯示過長的中文字
    const emojiMap = { carrot: '🥕', tomato: '🍅', radish: '🎍', beetroot: '🥗', cucumber: '🥒', onion: '🧅' };
    const emoji = emojiMap[gameState.currentSeed] || '🌱';

    // 關鍵修復：檢查現在按鈕上的 emoji 是否已經正確，如果是就跳出，避免每秒被重建 60 次
    let currentSpan = container.querySelector('span');
    if (currentSpan && currentSpan.innerText === emoji) {
        return; 
    }

    container.innerHTML = `
        <button class="seed-main-btn" onclick="document.getElementById('seed-select-modal').classList.remove('hidden')">
            <span style="font-size: 26px; margin-bottom: 2px; line-height: 1;">${emoji}</span>
            <span style="font-size: 11px; font-weight: 900; color: white; background: rgba(0,0,0,0.4); padding: 3px 8px; border-radius: 10px; line-height: 1;">切換</span>
        </button>
    `;
};

// 點選彈窗裡的種子 -> 變更裝備
window.selectEquipSeed = function(seedType) {
    gameState.currentSeed = seedType;
    saveGame();
    document.getElementById('seed-select-modal').classList.add('hidden');
    
    const seedInfo = SEED_DATA[seedType];
    showToast(`🎒 已切換裝備：${seedInfo.name}！\n(點擊一鍵播種即可種下)`, "success");
    
    // 立即更新左下角的圖示
    if (typeof renderSeedSelectorBtn === 'function') renderSeedSelectorBtn();
};

// 綁定到 updateUI，確保每次畫面更新時按鈕圖示都正確
const originalUpdateUI = updateUI;
window.updateUI = function() {
    originalUpdateUI();
    if (typeof renderSeedSelectorBtn === 'function') renderSeedSelectorBtn();
};

window.auth.onAuthStateChanged(async (user) => {
    if (user) {
        await syncLoadFromCloud();
        migrateGrid();
        updateUI();
    }
});




// ================= 天堂複習訓練 (台/英 雙語系分離版) =================
function startHeavenTraining() {
    forcedReviewQueue = [];
    
    // ✨ 1. 判斷當前領域，決定要抽哪一個題庫
    const activePool = (gameState.currentRealm === 'taiwanese') ? twVocab : globalVocab;
    
    // 找出符合難度的單字，如果是台語就全抓 (因為台語目前可能沒有嚴格分難度)
    let pool = activePool.filter(v => gameState.currentRealm === 'taiwanese' || v.lv == gameState.difficulty || v.lv == 1).sort(() => Math.random() - 0.5);
    for(let i=0; i<3; i++) if(pool[i]) forcedReviewQueue.push(pool[i]); // 抽3題防作弊
    
    let modal = document.getElementById('forced-review-modal');
    modal.classList.remove('hidden');
    modal.style.background = "rgba(241, 196, 15, 0.95)"; // 天堂金黃色背景
    
    let content = modal.querySelector('.modal-content'); content.style.borderColor = "#f39c12";
    let title = content.querySelector('div'); title.style.background = "#f39c12"; title.innerText = "😇 天堂訓練 😇 (你真的學會了嗎？)";
    document.getElementById('forced-progress').style.color = "#d35400";
    document.getElementById('forced-word-display').style.color = "#e67e22";
    
    loadHeavenReviewQuestion();
}

function loadHeavenReviewQuestion() {
    if (forcedReviewQueue.length === 0) {
        document.getElementById('forced-review-modal').classList.add('hidden');
        // 恢復地獄特訓原本的紅色樣式
        let modal = document.getElementById('forced-review-modal');
        modal.style.background = "rgba(192, 57, 43, 0.95)";
        modal.querySelector('.modal-content').style.borderColor = "#c0392b";
        let title = modal.querySelector('div'); title.style.background = "#e74c3c"; title.innerText = "🚨 錯題達到 30 題！觸發地獄特訓 🚨";
        document.getElementById('forced-progress').style.color = "#e74c3c";
        document.getElementById('forced-word-display').style.color = "#c0392b";
        
        showToast("🎉 通過天堂試煉！看來你真的有認真複習！獲得 💰1000 獎勵金！", "success");
        gameState.coins += 1000; saveGame(); updateUI(); return;
    }

    // ✨ 2. 判斷當前領域 (用來產生錯誤選項)
    const activePool = (gameState.currentRealm === 'taiwanese') ? twVocab : globalVocab;

    currentForcedWord = forcedReviewQueue[0];
    
    // ✨ 3. 如果是台語，顯示拼音
    const wordDisplay = document.getElementById('forced-word-display');
    if (gameState.currentRealm === 'taiwanese' && currentForcedWord.p) {
        wordDisplay.innerHTML = `${currentForcedWord.w}<br><span style="font-size: 0.5em; color: #d35400;">${currentForcedWord.p}</span>`;
    } else {
        wordDisplay.innerText = currentForcedWord.w;
    }
    
    document.getElementById('forced-progress').innerText = `剩餘：${forcedReviewQueue.length} 題`;
    let existingNextBtn = document.getElementById('forced-next-btn'); if (existingNextBtn) existingNextBtn.remove();

    let opts = [currentForcedWord.c];
    let failSafe = 0;
    while(opts.length < 4 && failSafe < 100) {
        let r = activePool[Math.floor(Math.random() * activePool.length)].c;
        if(!opts.includes(r) && r !== undefined) opts.push(r); failSafe++;
    }

    const grid = document.getElementById('forced-options-grid'); grid.innerHTML = '';
    opts.sort(() => Math.random() - 0.5).forEach(o => {
        let btn = document.createElement('button'); btn.innerText = o;
        btn.style.padding = "15px"; btn.style.fontSize = "1.1em"; btn.style.fontWeight = "bold"; btn.style.border = "2px solid #bdc3c7"; btn.style.borderRadius = "12px"; btn.style.backgroundColor = "white"; btn.style.cursor = "pointer"; btn.style.color = "#2c3e50";
        if (o === currentForcedWord.c) btn.dataset.correct = "true";

        btn.addEventListener('click', () => {
            Array.from(grid.children).forEach(b => b.disabled = true);
            if (o === currentForcedWord.c) {
                btn.style.backgroundColor = "#2ecc71"; btn.style.color = "white"; btn.style.borderColor = "#27ae60"; 
                forcedReviewQueue.shift(); setTimeout(loadHeavenReviewQuestion, 500); 
            } else {
                btn.style.backgroundColor = "#e74c3c"; btn.style.color = "white"; btn.style.borderColor = "#c0392b";
                let correctBtn = Array.from(grid.children).find(b => b.dataset.correct === "true");
                if (correctBtn) { correctBtn.style.backgroundColor = "#2ecc71"; correctBtn.style.color = "white"; correctBtn.style.borderColor = "#27ae60"; }
                showToast("❌ 亂按被抓到了！請確實記住意思喔！", "error"); 
                let w = forcedReviewQueue.shift(); forcedReviewQueue.push(w); 
                let nextBtn = document.createElement('button'); nextBtn.id = 'forced-next-btn'; nextBtn.innerText = "記住了，下一題 ➔"; nextBtn.style.marginTop = "20px"; nextBtn.style.padding = "15px"; nextBtn.style.fontSize = "1.2em"; nextBtn.style.fontWeight = "bold"; nextBtn.style.backgroundColor = "#f39c12"; nextBtn.style.color = "white"; nextBtn.style.border = "none"; nextBtn.style.borderRadius = "12px"; nextBtn.style.cursor = "pointer"; nextBtn.style.width = "100%"; nextBtn.style.boxShadow = "0 5px 0 #d35400";
                nextBtn.addEventListener('click', loadHeavenReviewQuestion); grid.parentElement.appendChild(nextBtn);
            }
        });
        grid.appendChild(btn);
    });
}

// 綁定兒童模式開關 (包含控制 CSS)
document.getElementById('kids-mode-toggle')?.addEventListener('change', (e) => {
    gameState.kidsMode = e.target.checked;
    if (gameState.kidsMode) {
        document.body.classList.add('kids-mode-active');
    } else {
        document.body.classList.remove('kids-mode-active');
    }
    saveGame();
});


migrateGrid();
resize(); 
updateUI();





// ==========================================
// 🛡️ 關閉網頁前的最終保命存檔
// ==========================================
window.addEventListener('beforeunload', (event) => {
    if (window.auth && window.auth.currentUser) {
        // 玩家關閉視窗時，強制發送最後一次雲端同步
        syncSaveToCloud();
    }
});