// ==========================================
// 🚀 第一部分：核心變數、初始化與 Firebase 同步
// ==========================================

import { doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-firestore.js";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-auth.js";

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

let COLS = 10;
let ROWS = 7;
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
if (!gameState.farmTiles || gameState.farmTiles.length !== ROWS || gameState.farmTiles[0].length !== COLS) {
let newTiles = Array.from({length: ROWS}, () => Array.from({length: COLS}, () => ({ plant: false, type: null, progress: 0 })));
if (gameState.farmTiles && gameState.farmTiles.length > 0) {
for(let y = 0; y < Math.min(ROWS, gameState.farmTiles.length); y++) {
for(let x = 0; x < Math.min(COLS, gameState.farmTiles[y].length); x++) {
newTiles[y][x] = gameState.farmTiles[y][x];
}
}
}
gameState.farmTiles = newTiles;
saveGame();
}
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

const SEED_DATA = {
    carrot: { id: 'carrot', name: '🥕 胡蘿蔔', cost: 15, sellPrice: 30, unlockLv: 1, exp: 35, growthFactor: 1.0 },
    tomato: { id: 'tomato', name: '🍅 番茄', cost: 10, sellPrice: 25, unlockLv: 1, exp: 100, growthFactor: 0.5 },
    radish: { id: 'radish', name: '🥕 蘿蔔', cost: 12, sellPrice: 28, unlockLv: 1, exp: 300, growthFactor: 0.2 },
    beetroot: { id: 'beetroot', name: '🥔 甜菜根', cost: 18, sellPrice: 40, unlockLv: 1, exp: 45, growthFactor: 0.8 },
    cucumber: { id: 'cucumber', name: '🥒 黃瓜', cost: 20, sellPrice: 50, unlockLv: 1, exp: 60, growthFactor: 0.7 },
    onion: { id: 'onion', name: '🧅 洋蔥', cost: 22, sellPrice: 60, unlockLv: 1, exp: 80, growthFactor: 0.6 }
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
    // --- 1. 地形與底座 ---
    grass: 'assets/Terrain/Grass_Light.png', 
    soil: 'assets/Objects/GardenBed_Blank.png',
    grassTexture: 'assets/Grass_Texture.png', // 你的大草原背景
    grass_light: 'assets/Terrain/Grass_Light.png',
    grass_dark: 'assets/Terrain/Grass_Dark.png',
    soil: 'assets/Objects/GardenBed_Blank.png',
    fenceV: 'assets/Fences/Fence_Vertical.png', // ⭐️ 新加入的垂直柵欄  
    
    // --- 2. 農作物生長階段 (GardenBed) ---
    carrot_01: 'assets/Objects/GardenBed_Carrots_01.png', carrot_02: 'assets/Objects/GardenBed_Carrots_02.png',
    tomato_01: 'assets/Objects/GardenBed_Tomatoes_01.png', tomato_02: 'assets/Objects/GardenBed_Tomatoes_02.png',
    radish_01: 'assets/Objects/GardenBed_Radish_01.png', radish_02: 'assets/Objects/GardenBed_Radish_02.png',
    // 補齊缺少的三種作物生長圖 (需確認 Objects 資料夾內有這些檔案)
    beetroot_01: 'assets/Objects/GardenBed_Beetroot_01.png', beetroot_02: 'assets/Objects/GardenBed_Beetroot_02.png',
    cucumber_01: 'assets/Objects/GardenBed_Cucumbers_01.png', cucumber_02: 'assets/Objects/GardenBed_Cucumbers_02.png',
    onion_01: 'assets/Objects/GardenBed_Onions_01.png', onion_02: 'assets/Objects/GardenBed_Onions_02.png',

    // --- 3. 寵物角色 ---
    pig_Up: 'assets/Characters/Pig_Up.png', pig_Down: 'assets/Characters/Pig_Down.png', pig_Left: 'assets/Characters/Pig_Left.png', pig_Right: 'assets/Characters/Pig_Right.png', pig_Dead: 'assets/Characters/Pig_Dead.png',
    fox_Up: 'assets/Characters/Fox_Up.png', fox_Down: 'assets/Characters/Fox_Down.png', fox_Left: 'assets/Characters/Fox_Left.png', fox_Right: 'assets/Characters/Fox_Right.png', fox_Dead: 'assets/Characters/Fox_Dead.png',
    cat_Up: 'assets/Characters/Cat_Up.png', cat_Down: 'assets/Characters/Cat_Down.png', cat_Left: 'assets/Characters/Cat_Left.png', cat_Right: 'assets/Characters/Cat_Right.png', cat_Dead: 'assets/Characters/Cat_Dead.png',

    // --- 4. 柵欄系列 ---
    fenceTL: 'assets/Fences/Fence_Corner_Top_Left.png',
    fenceTR: 'assets/Fences/Fence_Corner_Top_Right.png',
    fenceBL: 'assets/Fences/Fence_Corner_Bottom_Left.png',
    fenceBR: 'assets/Fences/Fence_Corner_Bottom_Right.png',
    fenceH: 'assets/Fences/Fence_Horizontal.png', 
    
    // --- 5. 雲朵特效 ---
    cloud: 'assets/Backgrounds/Cloud.png', // ⚠️ 注意你的檔名是 Cloud 還是 cloud
    
    // --- 6. 單獨的作物圖示 (供介面或背包使用) ---
    cropCarrot: 'assets/Objects/Carrot.png',   
    cropTomato: 'assets/Objects/Tomato.png',   
    cropRadish: 'assets/Objects/Radish.png',   
    cropBeetroot: 'assets/Objects/Beetroot.png', 
    cropCucumber: 'assets/Objects/Cucumber.png', 
    cropOnion: 'assets/Objects/Onion.png', 
    
    // Terrain 系列
    grass_light: 'assets/Terrain/Grass_Light.png',
    grass_dark: 'assets/Terrain/Grass_Dark.png',
    soil: 'assets/Objects/GardenBed_Blank.png',
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
    TILE_SIZE = Math.floor(Math.min(canvas.width / COLS, (canvas.height - 110) / ROWS));
    offsetX = Math.floor((canvas.width - (TILE_SIZE * COLS)) / 2);
    offsetY = Math.floor((canvas.height - (TILE_SIZE * ROWS)) / 2);
}
window.addEventListener('resize', resize);



// --- 雲端同步函數 ---
// === 究極版：無敵雲端儲存 (破解 Nested Array 限制) ===
async function syncSaveToCloud() {
    if (window.auth && window.auth.currentUser) {
        try {
            console.log("⬆️ 開始嘗試上傳存檔到 Firebase...");
            const userRef = doc(window.db, "users", window.auth.currentUser.uid);
            
            // ⭐️ 終極打包魔法：把整個存檔壓縮成單一字串，讓 Firebase 無話可說！
            const saveObject = {
                gameData: JSON.stringify(gameState)
            };
            
            await setDoc(userRef, saveObject);
            console.log("✅ 雲端儲存成功！(破解陣列限制，資料已完美寫入)");
            
        } catch(e) { 
            console.error("❌ 雲端儲存失敗！兇手在這裡：", e); 
        }
    } else {
        console.log("⚠️ 嘗試存檔，但偵測不到已登入的玩家帳號。");
    }
}

// === 究極版：無敵雲端讀取 (自動解壓縮) ===
async function syncLoadFromCloud() {
    if (window.auth && window.auth.currentUser) {
        try {
            console.log("⬇️ 開始嘗試從 Firebase 下載存檔...");
            const userRef = doc(window.db, "users", window.auth.currentUser.uid);
            const docSnap = await getDoc(userRef);
            
            if (docSnap.exists()) {
                let cloudData = docSnap.data();
                
                // 將包裹解壓縮，倒回遊戲狀態中
                if (cloudData.gameData) {
                    Object.assign(gameState, JSON.parse(cloudData.gameData));
                } else {
                    // 相容舊資料的安全機制
                    Object.assign(gameState, cloudData);
                }
                
                updateUI();
                console.log("✅ 雲端讀取成功！進度已恢復。");
                return true;
            } else {
                console.log("⚠️ 雲端讀取完畢，但這是一個全新的帳號，雲端沒有舊進度。");
                return false;
            }
        } catch(e) { 
            console.error("❌ 雲端讀取失敗！兇手在這裡：", e); 
            return false;
        }
    }
    return false;
}


function saveGame() { 
    if (currentUser) {
        localStorage.setItem('vocabMaster_' + currentUser, JSON.stringify(gameState));
        syncSaveToCloud(); 
    }
}


// === 超順暢註冊 (拔除強制驗證，秒進遊戲取名) ===
async function register() {
    const email = document.getElementById('email-input').value.trim();
    const password = document.getElementById('password-input').value;
    const btn = document.getElementById('btn-register');

    if (!email || !password) return showToast("註冊需填寫 Email 與密碼！", "error");
    if (password.length < 6) return showToast("密碼太短囉，至少需要 6 個字元！", "error");

    btn.innerText = "註冊中..."; btn.disabled = true;

    try {
        await createUserWithEmailAndPassword(window.auth, email, password);

        // 註冊成功，直接存檔並記憶 Email，不把玩家踢出去了！
        await syncSaveToCloud();
        localStorage.setItem('last_email_vocablord', email);
        
        // 直接切換畫面到大廳
        document.getElementById('login-screen').classList.add('hidden');
        document.getElementById('world-map-screen').classList.remove('hidden');

        // 觸發新手命名彈窗
        document.getElementById('name-prompt-modal').classList.remove('hidden');

    } catch (error) {
        console.error(error);
        if (error.code === 'auth/email-already-in-use') showToast("註冊失敗：這個 Email 已經被註冊過囉！", "error");
        else showToast("註冊失敗，請檢查格式", "error");
    } finally {
        btn.innerText = "註冊"; btn.disabled = false;
    }
}

// === 超順暢登入 (拔除 emailVerified 檢查) ===
async function login() {
    const email = document.getElementById('email-input').value.trim();
    const password = document.getElementById('password-input').value;
    const btn = document.getElementById('btn-login');

    if (!email || !password) return showToast("請輸入 Email 與密碼！", "error");

    btn.innerText = "登入中..."; btn.disabled = true;

    try {
        await signInWithEmailAndPassword(window.auth, email, password);

        // ⭐️ 這裡已經把煩人的 !user.emailVerified 檢查刪掉了！直接放行！

        await syncLoadFromCloud();
        localStorage.setItem('last_email_vocablord', email);
        
        document.getElementById('login-screen').classList.add('hidden');
        document.getElementById('world-map-screen').classList.remove('hidden');

        // 檢查是不是沒取名的新手
        if (!gameState.playerName) {
            document.getElementById('name-prompt-modal').classList.remove('hidden');
        } else {
            currentUser = gameState.playerName;
            document.getElementById('hub-player-name').innerText = currentUser;
            showToast("登入成功！歡迎回來", "success");
            // ⭐️ 加在這裡：老玩家進大廳後，跳出 iOS 提示
            checkAndShowIOSPrompt();
        }
        
        checkDailyReset(); 
        document.getElementById('in-game-difficulty').value = gameState.difficulty;
        migrateGrid();
    } catch (error) {
        console.error(error);
        showToast("登入失敗：帳號或密碼錯誤", "error");
    } finally {
        btn.innerText = "登入"; btn.disabled = false;
    }
}

// === 新手命名確認動作 ===
function submitHeroName() {
    const newName = document.getElementById('new-hero-name-input').value.trim();
    if (!newName) return showToast("名字不能為空喔！", "error");

    // 把名字正式寫入遊戲狀態
    gameState.playerName = newName;
    currentUser = newName;

    // 更新大廳顯示並關閉視窗
    document.getElementById('hub-player-name').innerText = currentUser;
    document.getElementById('name-prompt-modal').classList.add('hidden');

    // 立刻存檔上傳雲端，以免重整後又被當成新手
    saveGame(); 
    showToast(`歡迎加入，勇者 ${currentUser}！`, "success");
    
    // ⭐️ 加在這裡：新手正式進大廳後，跳出 iOS 提示
    checkAndShowIOSPrompt();
}



function enterRealm(realmId) {
    if (realmId !== 'english') { showToast("🚧 此領域正在積極建設中，敬請期待！", "info"); return; }
    document.getElementById('world-map-screen').classList.add('hidden');
    document.getElementById('game-container').classList.remove('hidden');
    resize(); updateUI(); loadQuestion(); requestAnimationFrame(tick);
    if (window.innerWidth <= 1024) setTimeout(() => { switchTab('quiz'); }, 50);
}

function backToMap() {
    document.getElementById('game-container').classList.add('hidden');
    document.getElementById('world-map-screen').classList.remove('hidden');
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
    if (selector.value !== "1" && !gameState.isPro) { showPaywall("中高級單字庫為專業版專屬！"); selector.value = gameState.difficulty; return; }
    gameState.difficulty = selector.value; saveGame(); loadQuestion(); 
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

function getPetSize(lv) { return Math.min(TILE_SIZE * 1.5, TILE_SIZE * 0.8 + (lv - 1) * (TILE_SIZE * 0.05)); }
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
    if (typeof globalVocab === 'undefined') return;

    const displayContainer = document.getElementById('word-display').parentElement;
    const btnContainer = displayContainer.querySelector('div');
    if (btnContainer && btnContainer.style) btnContainer.style.display = 'flex';

    let pool = globalVocab.filter(v => !gameState.graduated[v.w]);
    
    if (gameState.difficulty !== "all") {
        let d = parseInt(gameState.difficulty);
        let filtered = pool.filter(v => v.lv === d || v.lv === d + 1);
        if (filtered.length >= 4) {
            pool = filtered;
        } else {
            showToast(`⚠️ 單字數量不足，已暫時混入其他等級！`, "info");
        }
    }
    if (pool.length < 4) pool = globalVocab; 

    pool.forEach(w => { if(typeof w.weight === 'undefined') w.weight = 10; });
    let totalWeight = pool.reduce((sum, word) => sum + word.weight, 0);
    let randomNum = Math.random() * totalWeight;
    for (let word of pool) { if (randomNum < word.weight) { currentWord = word; break; } randomNum -= word.weight; }
    if (!currentWord || !currentWord.w) currentWord = pool[Math.floor(Math.random() * pool.length)];
    
    document.getElementById('word-display').innerText = currentWord.w;
    
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
    document.getElementById('shield-prompt-msg').innerText = msg + "\n要立刻花費 💰1500 金幣發動【🛡️ 連勝保護傘】保住連勝嗎？";
}

function resolveShieldPrompt(buy) {
    document.getElementById('shield-prompt-modal').classList.add('hidden');
    if (buy && gameState.coins >= 1500) {
        gameState.coins -= 1500;
        showToast("🛡️ 成功購買並發動保護傘！連勝保住了！", "success");
    } else {
        gameState.combo = 0;
        showToast("❌ 連勝歸零", "error");
    }
    
    if (shieldPromptCallback) shieldPromptCallback();
    shieldPromptCallback = null;
}

// ✨ 核心重構：動態選項生成引擎
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

        let failSafe = 0; let usedWords = [currentWord.w];
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
        while(optsData.length < 4 && failSafe < 100) {
            let r = globalVocab[Math.floor(Math.random() * globalVocab.length)].c;
            if(!optsData.some(o => o.text === r) && r !== undefined) optsData.push({ text: r, isCorrect: false });
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
                b.style.backgroundColor = "#2ecc71"; b.style.color = "white"; b.style.borderColor = "#27ae60";

                gameState.combo = (gameState.combo || 0) + 1;
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
                    gameState.graduated[currentWord.w] = { w: currentWord.w, c: currentWord.c, lv: currentWord.lv };
                    showToast(`🎓 恭喜！[${currentWord.w}] 已畢業！`, "success");
                }

                let isCrit = Math.random() < 0.15; let actuallyGrew = false;
                gameState.farmTiles.forEach(r => r.forEach(t => { 
                    if(t.plant && t.progress < 100) { 
                        // ⭐️ 防呆：如果未來又找不到作物資料，預設生長係數為 1，防止遊戲當機
                        let factor = SEED_DATA[t.type] ? SEED_DATA[t.type].growthFactor : 1;
                        t.progress = Math.min(100, t.progress + (10 * factor * (isCrit ? 3 : 1))); 
                        actuallyGrew = true;
                    } 
                }));
                if (isCrit && actuallyGrew) showToast("⚡ 爆擊！作物瘋狂生長！", "success");
                saveGame(); updateUI();
                setTimeout(() => { 
                    if (gameState.combo > 0 && gameState.combo % 10 === 0) startFeverMode(); 
                    else loadQuestion(); 
                }, 400); 
            } else {
                b.style.backgroundColor = "#e74c3c"; b.style.color = "white"; b.style.borderColor = "#c0392b";
                let correctBtn = Array.from(grid.children).find(btn => btn.dataset.correct === "true");
                if (correctBtn) { correctBtn.style.backgroundColor = "#2ecc71"; correctBtn.style.color = "white"; correctBtn.style.borderColor = "#27ae60"; }

                let finalizeWrongAnswer = () => {
                    gameState.energy = Math.max(0, gameState.energy - 10); currentWord.weight += 10; 
                    gameState.wordStats[currentWord.w].wrong += 1; gameState.wordStats[currentWord.w].consecutive = 0; 
                    if (!gameState.mistakes[currentWord.w]) gameState.mistakes[currentWord.w] = { w: currentWord.w, c: currentWord.c, lv: currentWord.lv, count: 0 };
                    gameState.mistakes[currentWord.w].count += 1; saveGame(); updateUI();
                    
                    setTimeout(() => { 
                        if (Object.keys(gameState.mistakes).length >= 30) startForcedReview();
                        else loadQuestion(); 
                    }, 2000); 
                };

                if (gameState.inventory['shield'] > 0) {
                    gameState.inventory['shield']--;
                    showToast("🛡️ 保護傘發動！抵銷一次連勝中斷！", "info");
                    finalizeWrongAnswer(); 
                } else {
                    if (gameState.combo > 0 && gameState.coins >= 1500) {
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
    idkBtn.style.gridColumn = "span 2"; idkBtn.style.padding = "10px"; idkBtn.style.fontSize = "0.95em"; 
    idkBtn.style.backgroundColor = "#f8f9fa"; idkBtn.style.color = "#7f8c8d"; idkBtn.style.border = "2px dashed #bdc3c7"; 
    idkBtn.style.boxShadow = "none";
    idkBtn.addEventListener('click', () => {
        Array.from(grid.children).forEach(btn => btn.disabled = true);
        let correctBtn = Array.from(grid.children).find(btn => btn.dataset.correct === "true");
        if (correctBtn) { correctBtn.style.backgroundColor = "#2ecc71"; correctBtn.style.color = "white"; correctBtn.style.borderColor = "#27ae60"; }

        let finalizeIdkAnswer = () => {
            currentWord.weight += 10; 
            if (!gameState.wordStats[currentWord.w]) gameState.wordStats[currentWord.w] = { correct: 0, wrong: 0, consecutive: 0 };
            gameState.wordStats[currentWord.w].wrong += 1; gameState.wordStats[currentWord.w].consecutive = 0; 
            if (!gameState.mistakes[currentWord.w]) gameState.mistakes[currentWord.w] = { w: currentWord.w, c: currentWord.c, lv: currentWord.lv, count: 0 };
            gameState.mistakes[currentWord.w].count += 1; saveGame(); updateUI();

            setTimeout(() => { 
                if (Object.keys(gameState.mistakes).length >= 30) startForcedReview();
                else loadQuestion(); 
            }, 2000); 
        };

        if (gameState.inventory['shield'] > 0) {
            gameState.inventory['shield']--; showToast("💡 已標記！(🛡️保護傘抵銷連勝中斷)", "info");
            finalizeIdkAnswer();
        } else {
            if (gameState.combo > 0 && gameState.coins >= 1500) {
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
        b.style.padding = "18px 12px"; b.style.fontSize = "1.15em"; b.style.fontWeight = "bold"; 
        b.style.border = "2px solid #bdc3c7"; b.style.borderRadius = "14px"; b.style.cursor = "pointer"; b.style.backgroundColor = "white"; b.style.color = "#2c3e50";
        if (o === q.meaning) b.dataset.correct = "true"; 
        
        b.addEventListener('click', () => {
            clearInterval(feverTimer); Array.from(grid.children).forEach(btn => btn.disabled = true);
            if (!gameState.wordStats[wordKey]) gameState.wordStats[wordKey] = { correct: 0, wrong: 0, consecutive: 0 };

            if (o === q.meaning) {
                b.style.backgroundColor = "#2ecc71"; b.style.color = "white"; b.style.borderColor = "#27ae60"; showToast("✨ 狂熱成功！全農場作物大暴增！", "success");
                gameState.farmTiles.forEach(r => r.forEach(t => { if(t.plant && t.progress < 100) { t.progress = Math.min(100, t.progress + 50); } }));
                gameState.coins += 200; 
                gameState.wordStats[wordKey].correct += 1; gameState.wordStats[wordKey].consecutive += 1;
                if (gameState.wordStats[wordKey].consecutive >= 5) {
                    gameState.graduated[wordKey] = { w: wordKey, c: q.meaning, lv: 7 }; showToast(`🎓 恭喜！字根 [${q.root}] 已精通！`, "success");
                }
                saveGame(); updateUI(); setTimeout(endFeverMode, 1500);
            } else {
                b.style.backgroundColor = "#e74c3c"; b.style.color = "white"; b.style.borderColor = "#c0392b";
                let correctBtn = Array.from(grid.children).find(btn => btn.dataset.correct === "true");
                if (correctBtn) { correctBtn.style.backgroundColor = "#2ecc71"; correctBtn.style.color = "white"; correctBtn.style.borderColor = "#27ae60"; }
                
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

    const grid = document.getElementById('forced-options-grid'); grid.innerHTML = '';
    opts.sort(() => Math.random() - 0.5).forEach(o => {
        let btn = document.createElement('button');
        btn.innerText = o;
        btn.style.padding = "15px"; btn.style.fontSize = "1.1em"; btn.style.fontWeight = "bold"; btn.style.border = "2px solid #bdc3c7"; btn.style.borderRadius = "12px"; btn.style.backgroundColor = "white"; btn.style.cursor = "pointer"; btn.style.color = "#2c3e50";
        if (o === currentForcedWord.c) btn.dataset.correct = "true";

        btn.addEventListener('click', () => {
            Array.from(grid.children).forEach(b => b.disabled = true);
            if (o === currentForcedWord.c) {
                btn.style.backgroundColor = "#2ecc71"; btn.style.color = "white"; btn.style.borderColor = "#27ae60"; forcedReviewQueue.shift(); 
                if (gameState.mistakes[currentForcedWord.w]) {
                    gameState.mistakes[currentForcedWord.w].count--;
                    if (gameState.mistakes[currentForcedWord.w].count <= 0) delete gameState.mistakes[currentForcedWord.w];
                }
                saveGame(); setTimeout(loadForcedReviewQuestion, 500); 
            } else {
                btn.style.backgroundColor = "#e74c3c"; btn.style.color = "white"; btn.style.borderColor = "#c0392b";
                let correctBtn = Array.from(grid.children).find(b => b.dataset.correct === "true");
                if (correctBtn) { correctBtn.style.backgroundColor = "#2ecc71"; correctBtn.style.color = "white"; correctBtn.style.borderColor = "#27ae60"; }
                showToast("❌ 答錯了！請記住正確的中文意思。", "error"); let w = forcedReviewQueue.shift(); forcedReviewQueue.push(w); 
                
                let nextBtn = document.createElement('button'); nextBtn.id = 'forced-next-btn'; nextBtn.innerText = "記住了，下一題 ➔"; nextBtn.style.marginTop = "20px"; nextBtn.style.padding = "15px"; nextBtn.style.fontSize = "1.2em"; nextBtn.style.fontWeight = "bold"; nextBtn.style.backgroundColor = "#34495e"; nextBtn.style.color = "white"; nextBtn.style.border = "none"; nextBtn.style.borderRadius = "12px"; nextBtn.style.cursor = "pointer"; nextBtn.style.width = "100%"; nextBtn.style.boxShadow = "0 5px 0 #2c3e50";
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

function openReviewArea() { document.getElementById('review-screen').classList.remove('hidden'); renderReviewList(); }
function closeReviewArea() { document.getElementById('review-screen').classList.add('hidden'); }

// ✨ 核心重構：錯題本動態按鈕
function renderReviewList() {
    const list = document.getElementById('review-list');
    let mistakesArr = Object.values(gameState.mistakes);
    if (mistakesArr.length === 0) { list.innerHTML = "<div class='empty-review'>🎉 錯題本是空的！</div>"; return; }

    let grouped = {}; mistakesArr.forEach(m => { let lv = m.lv || 1; if (!grouped[lv]) grouped[lv] = []; grouped[lv].push(m); });

    list.innerHTML = "";
    Object.keys(grouped).sort((a, b) => a - b).forEach(lv => {
        grouped[lv].sort((a, b) => b.count - a.count); 
        
        let header = document.createElement('h3');
        header.className = 'review-lv-header';
        if(lv == 7) { header.style.background = "#c0392b"; header.style.color = "white"; header.innerText = "🔥 狂熱字源學 (字根)"; }
        else { header.innerText = `Level ${lv} 單字`; }
        list.appendChild(header);

        grouped[lv].forEach(m => {
            let itemDiv = document.createElement('div');
            itemDiv.className = 'review-item';
            
            let infoDiv = document.createElement('div');
            infoDiv.className = 'review-word-info';
            infoDiv.innerHTML = `<div class="review-word">${m.w} <span class="error-count-badge">錯了 ${m.count} 次</span></div><div class="review-mean">${m.c}</div>`;
            
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
    if (gameState.mistakes[wk]) {
        delete gameState.mistakes[wk]; gameState.coins += 50; gameState.energy = Math.min(100, gameState.energy + 50);
        gameState.inventory['radish'] = (gameState.inventory['radish'] || 0) + 1; saveGame(); updateUI(); renderReviewList();
        showToast(`✨ 恭喜克服 [${wk}]！獲得獎勵！`, "success");
    }
}

function openGraduatedArea() { document.getElementById('graduated-screen').classList.remove('hidden'); renderGraduatedList(); }
function closeGraduatedArea() { document.getElementById('graduated-screen').classList.add('hidden'); }

// ✨ 核心重構：畢業圖鑑動態按鈕
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

    if (statsArr.length === 0) { list.style.display = "block"; list.innerHTML = "<div class='empty-review'>還沒有解鎖任何圖鑑喔！<br>快去答題收集星星吧！🌟</div>"; return; }
    
    list.style.display = "block"; let grouped = {};
    statsArr.forEach(item => { if (!grouped[item.lv]) grouped[item.lv] = []; grouped[item.lv].push(item); });

    Object.keys(grouped).sort((a, b) => a - b).forEach(lv => {
        grouped[lv].sort((a, b) => b.cons - a.cons);
        
        let header = document.createElement('h3');
        header.className = 'review-lv-header';
        if(lv == 7) { header.style.background = "linear-gradient(90deg, #c0392b, #e74c3c)"; header.style.color = "white"; header.style.borderLeft = "5px solid #f1c40f"; header.innerText = "🔥 狂熱字源學 (精通)"; }
        else { header.style.background = "linear-gradient(90deg, #d35400, #e67e22)"; header.style.color = "white"; header.style.borderLeft = "5px solid #f1c40f"; header.innerText = `Level ${lv} 單字圖鑑`; }
        list.appendChild(header);

        let gridDiv = document.createElement('div');
        gridDiv.style.display = "grid"; gridDiv.style.gridTemplateColumns = "1fr 1fr"; gridDiv.style.gap = "15px"; gridDiv.style.paddingBottom = "20px"; gridDiv.style.paddingTop = "10px";

        grouped[lv].forEach(item => {
            let starHTML = ""; let bgStyle = ""; let borderColor = "";
            if (item.cons >= 5) { starHTML = "🥇 金星 (畢業)"; bgStyle = "#fffbea"; borderColor = "#f1c40f"; }
            else if (item.cons >= 3) { starHTML = "🥈 銀星"; bgStyle = "#f8f9fa"; borderColor = "#bdc3c7"; }
            else { starHTML = "🥉 銅星"; bgStyle = "#fdf2e9"; borderColor = "#e67e22"; }

            let card = document.createElement('div');
            card.style.background = bgStyle; card.style.border = `2px solid ${borderColor}`; card.style.padding = "15px 10px"; card.style.borderRadius = "16px"; card.style.boxShadow = "0 4px 10px rgba(0,0,0,0.1)"; card.style.display = "flex"; card.style.flexDirection = "column"; card.style.justifyContent = "space-between"; card.style.alignItems = "center"; card.style.textAlign = "center"; card.style.position = "relative"; card.style.marginTop = "5px";
            
            card.innerHTML = `
                <div style="position: absolute; top: -12px; left: -5px; background: #34495e; color: white; font-size: 0.75em; font-weight: bold; padding: 4px 10px; border-radius: 10px; border: 2px solid ${borderColor}; box-shadow: 0 2px 4px rgba(0,0,0,0.2);">${lv == 7 ? '字根' : 'Lv.' + item.lv}</div>
                <div style="margin-top: 8px;"><div style="font-size: 1.3em; font-weight: 900; color: #2c3e50; margin-bottom: 5px; word-break: break-word;">${item.w}</div><div style="font-size: 0.85em; color: #7f8c8d; font-weight: bold; margin-bottom: 10px; line-height: 1.3;">${item.meaning}</div></div>
                <div style="width: 100%;"><div style="font-size: 0.85em; font-weight: bold; padding: 4px; border-radius: 8px; background: white; border: 1px dashed ${borderColor}; color: #333; margin-bottom: 8px;">${starHTML}</div></div>
            `;

            if (item.isGrad) {
                let btn = document.createElement('button');
                btn.innerText = '🔄 召回重練';
                btn.style.width = "100%"; btn.style.background = "#e74c3c"; btn.style.color = "white"; btn.style.border = "none"; btn.style.padding = "8px"; btn.style.borderRadius = "10px"; btn.style.fontWeight = "bold"; btn.style.cursor = "pointer"; btn.style.fontSize = "0.85em"; btn.style.boxShadow = "0 3px 0 #c0392b"; btn.style.transition = "0.1s";
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
        delete gameState.graduated[wk]; if (gameState.wordStats[wk]) { gameState.wordStats[wk].consecutive = 0; }
        saveGame(); renderGraduatedList(); showToast(`🔄 記憶消退！[${wk}] 已重新加入題庫！`, "info");
    }
}

// 農場渲染與邏輯
function moveAllPets() {
    gameState.petsOwned.forEach(pid => {
        let p = activePets[pid]; let stat = gameState.petStats[pid]; let speed = getPetSpeed(stat.lv);
        if (gameState.energy >= 90) speed *= 3.0; 
        if (gameState.energy <= 0) { p.dir = 'Dead'; return; }
        if (p.state === 'idle') { p.timer--; if (p.timer <= 0) { p.targetX = Math.random()*(COLS-1); p.targetY = Math.random()*(ROWS-1); p.state = 'walk'; } } 
        else {
            let dx = p.targetX - p.x, dy = p.targetY - p.y, dist = Math.sqrt(dx*dx + dy*dy);
            if (dist > speed) { p.x += (dx/dist)*speed; p.y += (dy/dist)*speed; p.dir = Math.abs(dx)>Math.abs(dy)?(dx>0?'Right':'Left'):(dy>0?'Down':'Up'); checkPetCollision(p); } 
            else { p.state = 'idle'; p.timer = Math.random()*80+30; }
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
                // ⭐️ 動態抓取資料庫的 Emoji，防止寫死造成錯誤
                let plantEmoji = SEED_DATA[t.type] ? SEED_DATA[t.type].name.split(' ')[0] : '🌱';
                t.type = null;
                showFloatingText(`+1 ${plantEmoji}`, "#2ecc71"); 
            }
        }
    }
}

// === 2. 遊戲迴圈 ===
function tick() {
    gameState.energy = Math.max(0, gameState.energy - 0.04);
    moveAllPets();
    draw();
    updateUI();
    requestAnimationFrame(tick);
}

// === 2. 繪製邏輯：精準對齊交界線 (完整版) ===
function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const VERTICAL_STEP = TILE_SIZE * 0.6; 
    const OFFSET_Y_FIX = 0; // ⭐️ 與 handleInteraction 同步下壓 8 像素
    
    const totalFarmWidth = COLS * TILE_SIZE;
    const totalFarmHeight = (ROWS - 1) * VERTICAL_STEP + TILE_SIZE;

    const offsetX = (canvas.width - totalFarmWidth) / 2;
    const offsetY = (canvas.height - totalFarmHeight) / 2;

    // 逐行繪製 (Z-Order 排序)
    gameState.farmTiles.forEach((row, y) => {
        row.forEach((tile, x) => {
            let px = offsetX + x * TILE_SIZE;
            let py = offsetY + y * VERTICAL_STEP;

            // A. 繪製棋盤草地 (底層背景不偏移)
            let grassImg = (x + y) % 2 === 0 ? images.grass_light : images.grass_dark;
            if (grassImg && grassImg.isLoaded) {
                ctx.drawImage(grassImg, px, py, TILE_SIZE, TILE_SIZE);
            }

            // B. 繪製泥土 (GardenBed_Blank)
            // 將泥土向下移動 OFFSET_Y_FIX，使其對齊草地底線
            if (images.soil && images.soil.isLoaded) {
                ctx.drawImage(images.soil, px, py + OFFSET_Y_FIX, TILE_SIZE, TILE_SIZE);
            }

            // C. 繪製柵欄
            const isBorder = (y === 0 || y === ROWS - 1 || x === 0 || x === COLS - 1);
            if (isBorder) {
                let fenceImg = null;
                if (y === 0 && x === 0) fenceImg = images.fenceTL;
                else if (y === 0 && x === COLS - 1) fenceImg = images.fenceTR;
                else if (y === ROWS - 1 && x === 0) fenceImg = images.fenceBL;
                else if (y === ROWS - 1 && x === COLS - 1) fenceImg = images.fenceBR;
                else if (y === 0 || y === ROWS - 1) fenceImg = images.fenceH;
                else if (x === 0 || x === COLS - 1) fenceImg = images.fenceV;

                if (fenceImg && fenceImg.isLoaded) {
                    // 柵欄比泥土稍微高出一點點產生深度感 (OFFSET_Y_FIX - 5)
                    ctx.drawImage(fenceImg, px, py + OFFSET_Y_FIX - 10, TILE_SIZE, TILE_SIZE);
                }
            } else {
                // D. 繪製植物
                if (tile.plant) {
                    let k = tile.progress >= 100 ? tile.type + '_02' : tile.type + '_01';
                    if (images[k] && images[k].isLoaded) {
                    ctx.drawImage(images[k], px, py + OFFSET_Y_FIX - 5, TILE_SIZE, TILE_SIZE);
                    }
                    
                    // 進度條同步偏移
                    if (tile.progress < 100) {
                        ctx.fillStyle = (gameState.energy >= 90) ? "#f1c40f" : "#4caf50";
                        ctx.fillRect(px + TILE_SIZE * 0.15, py + OFFSET_Y_FIX + TILE_SIZE * 0.8, (tile.progress / 100) * (TILE_SIZE * 0.7), TILE_SIZE * 0.08);
                    }
                }
            }
        });
    });

    // E. 繪製寵物
    let sortedPets = [...gameState.petsOwned];
    sortedPets.sort((a, b) => activePets[a].y - activePets[b].y); 
    sortedPets.forEach(petId => {
        let p = activePets[petId]; 
        let pSize = getPetSize(gameState.petStats[petId].lv);
        let drawX = offsetX + p.x * TILE_SIZE;
        let drawY = offsetY + p.y * VERTICAL_STEP + OFFSET_Y_FIX; // ⭐️ 對齊泥土高度
        
        let imgKey = petId + "_" + p.dir;
        if (images[imgKey] && images[imgKey].isLoaded) {
            ctx.drawImage(images[imgKey], drawX - (pSize - TILE_SIZE) / 2, drawY - (pSize - TILE_SIZE), pSize, pSize);
        } else {
            ctx.font = (pSize / 1.5) + "px Arial"; 
            ctx.textAlign = "center"; ctx.textBaseline = "middle"; 
            ctx.fillText(petId === 'cat' ? "🐱" : (petId === 'fox' ? "🦊" : "🐷"), drawX + TILE_SIZE / 2, drawY + TILE_SIZE / 2); 
        }
    });
}


// === 4. 餵食邏輯 ===
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
function sellPlant(type) { if (gameState.inventory[type] > 0) { gameState.inventory[type]--; gameState.coins += SEED_DATA[type].sellPrice; updateUI(); saveGame(); togglePanel('inventory'); } }
function sellAllOf(type) { let count = gameState.inventory[type] || 0; if (count > 0) { gameState.coins += count * SEED_DATA[type].sellPrice; gameState.inventory[type] = 0; updateUI(); saveGame(); togglePanel('inventory'); } }

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

function autoPlant() {
    let cost = SEED_DATA[gameState.currentSeed].cost; let emptyTiles = [];
    for(let y=0; y<ROWS; y++) { for(let x=0; x<COLS; x++) { if(!gameState.farmTiles[y][x].plant) emptyTiles.push({x: x, y: y}); } }
    emptyTiles.sort(() => Math.random() - 0.5);
    let count = 0;
    for(let i=0; i<emptyTiles.length; i++) {
        if (gameState.coins >= cost) { gameState.coins -= cost; let t = gameState.farmTiles[emptyTiles[i].y][emptyTiles[i].x]; t.plant = true; t.type = gameState.currentSeed; t.progress = 0; count++; } 
        else break; 
    }
    if(count > 0) { updateUI(); saveGame(); showToast(`🌱 成功一鍵播種了 ${count} 個 ${SEED_DATA[gameState.currentSeed].name}！`, "success"); } 
    else if (gameState.coins < cost) { showToast(`💰 金幣不足！每個需要 ${cost} 金幣。`, "error"); } 
    else showToast("🌱 農場客滿，沒有空地囉！", "info"); 
}

function equipSeed(type) { gameState.currentSeed = type; saveGame(); updateUI(); togglePanel('shop'); }
function switchPet(petId) { gameState.currentPet = petId; updateUI(); togglePanel(); saveGame(); }
function buyPet(petId) {
    if (petId === 'cat' && !gameState.isPro) { showPaywall("解鎖最強寵物「比比拉布」是專業版專屬福利喔！"); togglePanel(); return; }
    let cost = PET_DATA[petId].cost;
    if (gameState.coins >= cost) { gameState.coins -= cost; gameState.petsOwned.push(petId); switchPet(petId); loadQuestion(); } 
    else showToast(`金幣不足！需要 💰${cost}`, "error"); 
}

// ✨ 核心重構：面板動態按鈕 (背包、商城、寵物)
function togglePanel(type) {
    const p = document.getElementById('floating-panel');
    const panelBody = document.getElementById('panel-body');
    if (!type) { p.classList.add('hidden'); return; }
    p.classList.remove('hidden');
    panelBody.innerHTML = ''; // 先清空

    if (type === 'inventory') {
        const pTitle = document.getElementById('panel-title'); if(pTitle) pTitle.innerText = '背包：' + PET_DATA[gameState.currentPet].title;
        
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

    } else if (type === 'shop') {
        const pTitle = document.getElementById('panel-title'); if(pTitle) pTitle.innerText = '農場商城';
        
        let title1 = document.createElement('h4'); title1.style = "margin: 0 0 10px 0; color: #8e44ad; border-bottom: 2px solid #eee; padding-bottom: 5px;"; title1.innerText = "🎁 幸運盲盒"; panelBody.appendChild(title1);
        let gachaDiv = document.createElement('div'); gachaDiv.className = 'shop-item'; gachaDiv.style = "background: #fdf2e9; border: 2px dashed #e67e22; margin-bottom: 15px; padding: 15px; border-radius: 12px;";
        gachaDiv.innerHTML = `<span style="font-weight: bold; color: #d35400;">神祕金蛋 (💰5000)<br><small style="color:#7f8c8d;">機率抽出大獎、道具或傳說卷軸！</small></span>`;
        let gachaBtn = document.createElement('button'); gachaBtn.innerText = "試試手氣"; gachaBtn.style = "background: linear-gradient(135deg, #e67e22, #d35400); color: white; font-weight: bold; border: none; padding: 10px 20px; border-radius: 20px; cursor: pointer; box-shadow: 0 4px 0 #a04000, 0 5px 10px rgba(0,0,0,0.2); transition: 0.1s;";
        gachaBtn.addEventListener('click', drawGacha); gachaDiv.appendChild(gachaBtn); panelBody.appendChild(gachaDiv);

        let title2 = document.createElement('h4'); title2.style = "margin: 0 0 10px 0; color: #2980b9; border-bottom: 2px solid #eee; padding-bottom: 5px;"; title2.innerText = "✨ 魔法道具"; panelBody.appendChild(title2);
        let shieldDiv = document.createElement('div'); shieldDiv.className = 'shop-item'; shieldDiv.style.marginBottom = "15px";
        shieldDiv.innerHTML = `<span>🛡️ 連勝保護傘 (💰1500)<br><small style="color:#7f8c8d;">答錯時免除一次連勝歸零</small></span>`;
        let shieldBtn = document.createElement('button'); shieldBtn.innerText = "購買"; shieldBtn.style = "background: #3498db; color: white;";
        shieldBtn.addEventListener('click', () => buyItem('shield', 1500)); shieldDiv.appendChild(shieldBtn); panelBody.appendChild(shieldDiv);

        let title3 = document.createElement('h4'); title3.style = "margin: 0 0 10px 0; color: #27ae60; border-bottom: 2px solid #eee; padding-bottom: 5px;"; title3.innerText = "🌱 種子包"; panelBody.appendChild(title3);
        let plantBtn = document.createElement('button'); plantBtn.innerText = "🌱 一鍵播種"; plantBtn.style = "width:100%; margin-bottom:10px; background:#27ae60; padding:10px; border-radius:8px; color:white; font-weight:bold; cursor:pointer; border:none;";
        plantBtn.addEventListener('click', autoPlant); panelBody.appendChild(plantBtn);
        
        for (let key in SEED_DATA) {
            let seed = SEED_DATA[key]; let isUnlocked = gameState.petStats.pig.lv >= seed.unlockLv; 
            let btnBg = !isUnlocked ? '#bdc3c7' : (gameState.currentSeed === key ? '#f1c40f' : '#3498db');
            let btnColor = (gameState.currentSeed === key) ? '#d35400' : 'white';
            let btnText = isUnlocked ? (gameState.currentSeed === key ? '✔ 裝備中' : '裝備') : '🔒 未解鎖';
            let extraStyle = gameState.currentSeed === key ? 'box-shadow: 0 0 12px rgba(241, 196, 15, 0.8); transform: scale(1.05); border: 2px solid #e67e22;' : '';
            
            let seedDiv = document.createElement('div'); seedDiv.className = 'shop-item'; seedDiv.style.padding = "10px 0";
            seedDiv.innerHTML = `<span>${seed.name} (💰${seed.cost}) <br><small style="color:#7f8c8d;">${isUnlocked ? '已解鎖' : `神豬 Lv.${seed.unlockLv} 解鎖`}</small></span>`;
            let seedBtn = document.createElement('button'); seedBtn.innerText = btnText; seedBtn.style = `background: ${btnBg}; color: ${btnColor}; transition: 0.2s; ${extraStyle}`;
            if(!isUnlocked) seedBtn.disabled = true;
            seedBtn.addEventListener('click', () => equipSeed(seed.id));
            seedDiv.appendChild(seedBtn); panelBody.appendChild(seedDiv);
        }

    } else if (type === 'pet') {
        const pTitle = document.getElementById('panel-title'); if(pTitle) pTitle.innerText = '寵物招募';
        for (let key in PET_DATA) {
            let pData = PET_DATA[key]; let isOwned = gameState.petsOwned.includes(key); let isCurrent = gameState.currentPet === key;
            let petDiv = document.createElement('div'); petDiv.className = 'shop-item'; petDiv.style.background = isOwned ? (isCurrent ? '#e8f5e9' : 'transparent') : '#fdf2e9';
            petDiv.innerHTML = `<span style="font-weight:bold;">${pData.title} <br><small>${isOwned ? 'Lv.' + gameState.petStats[key].lv : pData.desc}</small></span>`;
            let btn = document.createElement('button'); 
            
            if (isOwned) {
                btn.innerText = isCurrent ? '指定' : '選擇'; btn.style.background = isCurrent ? '#999' : '#3498db';
                if(isCurrent) btn.disabled = true;
                btn.addEventListener('click', () => switchPet(key));
            } else {
                btn.innerText = (key === 'cat' && !gameState.isPro) ? "🔒 PRO專屬" : `💰${pData.cost}`;
                btn.style.background = (key === 'cat' && !gameState.isPro) ? "#95a5a6" : "#e74c3c";
                btn.addEventListener('click', () => buyPet(key));
            }
            petDiv.appendChild(btn); panelBody.appendChild(petDiv);
        }
    }
}

function buyItem(itemKey, cost) {
    if (gameState.coins >= cost) { gameState.coins -= cost; gameState.inventory[itemKey] = (gameState.inventory[itemKey] || 0) + 1; saveGame(); updateUI(); showToast(`🛍️ 購買成功！已放入背包。`, "success"); } 
    else showToast("💰 金幣不足！", "error");
}

function usePotion() {
    if (!gameState.inventory['potion'] || gameState.inventory['potion'] <= 0) return;
    let grewSomething = false;
    gameState.farmTiles.forEach(r => r.forEach(t => { if(t.plant && t.progress < 100) { t.progress = 100; grewSomething = true; } }));
    if (grewSomething) { gameState.inventory['potion']--; saveGame(); updateUI(); togglePanel('inventory'); showToast("✨ 魔法生效！全農場作物瞬間成熟！", "success"); } 
    else showToast("🌱 目前沒有需要催熟的作物喔！", "info");
}

function drawGacha() {
    let cost = 5000;
    if (gameState.coins < cost) return showToast("💰 金幣不足！", "error");
    gameState.coins -= cost; saveGame(); updateUI(); togglePanel(); 
    const modal = document.getElementById('gacha-modal'); const anim = document.getElementById('gacha-animation'); const resultBox = document.getElementById('gacha-result-box');
    modal.classList.remove('hidden'); anim.style.display = 'block'; anim.classList.add('gacha-shaking'); resultBox.classList.add('hidden'); resultBox.classList.remove('gacha-pop');

    setTimeout(() => {
        anim.style.display = 'none'; anim.classList.remove('gacha-shaking'); resultBox.classList.remove('hidden'); resultBox.classList.add('gacha-pop'); 
        
        let r = Math.random(); let icon = ""; let title = ""; let desc = "";
        if (r < 0.02) { gameState.inventory['renameScroll'] = (gameState.inventory['renameScroll'] || 0) + 1; icon = "📜"; title = "🎉 歐皇降臨！"; desc = "極稀有！抽中【傳說改名卷軸】！"; } 
        else if (r < 0.07) { gameState.coins += 10000; icon = "💰"; title = "財神爺保佑！"; desc = "爆富！抽中 10,000 金幣大賞！"; } 
        else if (r < 0.22) { gameState.coins += 3000; icon = "💵"; title = "差一點回本！"; desc = "獲得 3,000 金幣。"; } 
        else if (r < 0.50) { gameState.coins += 2000; icon = "🪙"; title = "虧本了！"; desc = "只獲得 2,000 金幣。"; } 
        else if (r < 0.65) { gameState.inventory['potion'] = (gameState.inventory['potion'] || 0) + 1; icon = "🧪"; title = "✨ 還算實用"; desc = "獲得【催熟藥水 x1】。"; } 
        else if (r < 0.80) { gameState.inventory['shield'] = (gameState.inventory['shield'] || 0) + 1; icon = "🛡️"; title = "有備無患"; desc = "獲得【連勝保護傘 x1】。"; } 
        else { gameState.inventory['radish'] = (gameState.inventory['radish'] || 0) + 3; icon = "🧅"; title = "銘謝惠顧"; desc = "獲得【甜菜種子 x3】當作安慰獎。"; }
        
        document.getElementById('gacha-title').innerText = title; document.getElementById('gacha-item-icon').innerText = icon; document.getElementById('gacha-desc').innerText = desc;
        saveGame(); updateUI();
    }, 500);
}

function closeGacha() { document.getElementById('gacha-modal').classList.add('hidden'); togglePanel('shop'); }

function useRenameScroll() {
    if (!gameState.inventory['renameScroll'] || gameState.inventory['renameScroll'] <= 0) return;
    let target = prompt("請輸入數字選擇要改名的對象：\n[1] 勇者姓名 (你自己)\n[2] 目前的寵物");
    if (target === "1") {
        let newName = prompt("請輸入新的勇者姓名：");
        if (newName && newName.trim()) {
            let oldName = currentUser; currentUser = newName.trim();
            let oldData = localStorage.getItem('vocabMaster_' + oldName);
            if(oldData) { localStorage.setItem('vocabMaster_' + currentUser, oldData); localStorage.removeItem('vocabMaster_' + oldName); }
            localStorage.setItem('last_user_vocablord', currentUser);
            gameState.inventory['renameScroll']--; saveGame(); updateUI(); togglePanel('inventory'); showToast("✨ 命運已改寫！勇者姓名已變更！", "success");
        }
    } else if (target === "2") {
        let newPetName = prompt("請輸入寵物的新名字：");
        if (newPetName && newPetName.trim()) {
            let cp = gameState.currentPet; gameState.petStats[cp].customName = newPetName.trim();
            gameState.inventory['renameScroll']--; saveGame(); updateUI(); togglePanel('inventory'); showToast("✨ 契約已重鑄！寵物姓名已變更！", "success");
        }
    } else { showToast("取消改名。", "info"); }
}

function updateUI() {
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
}

function switchTab(tabName) {
    if (window.innerWidth > 1024) return; 
    const sidebar = document.getElementById('sidebar'); const farm = document.getElementById('farm-viewport');
    const quizBtn = document.getElementById('nav-quiz-btn'); const farmBtn = document.getElementById('nav-farm-btn');
    if (tabName === 'quiz') { if(sidebar) sidebar.classList.remove('mobile-hidden'); if(farm) farm.classList.add('mobile-hidden'); if(quizBtn) quizBtn.classList.add('active'); if(farmBtn) farmBtn.classList.remove('active'); } 
    else if (tabName === 'farm') { if(sidebar) sidebar.classList.add('mobile-hidden'); if(farm) farm.classList.remove('mobile-hidden'); if(quizBtn) quizBtn.classList.remove('active'); if(farmBtn) farmBtn.classList.add('active'); setTimeout(resize, 50); }
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

// ✨ 核心重構：每日任務動態按鈕
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

function speakCurrentWord(speedMode = 'normal') {
    let displayElement = document.getElementById('word-display'); if (!displayElement) return;
    let rawText = displayElement.innerText; if (rawText === "Ready?" || rawText.trim() === "") return;
    let cleanWord = rawText.split('/')[0].split('(')[0].trim();
    if (!('speechSynthesis' in window)) return showToast("⚠️ 您的瀏覽器不支援發音", "error");
    window.speechSynthesis.cancel();
    setTimeout(() => {
        let utterance = new SpeechSynthesisUtterance(cleanWord); utterance.lang = 'en-US';
        if (speedMode === 'slow') { utterance.rate = 0.4; utterance.pitch = 1.0; } else { utterance.rate = 0.85; utterance.pitch = 1.1; }
        let voices = window.speechSynthesis.getVoices();
        let bestVoice = voices.find(v => v.name.includes('Google US English') || v.name.includes('Samantha') || v.name.includes('Aria')) || voices.find(v => v.lang.includes('en-US'));
        if (bestVoice) utterance.voice = bestVoice; window.speechSynthesis.speak(utterance);
    }, 50);
}
if ('speechSynthesis' in window) { window.speechSynthesis.onvoiceschanged = () => { console.log("🔊 系統語音包已就緒"); }; }

function showFloatingText(text, color = "#f1c40f") {
    const floatEl = document.createElement('div'); floatEl.className = 'floating-text'; floatEl.innerText = text; floatEl.style.color = color;
    floatEl.style.left = '50%'; floatEl.style.top = '40%'; floatEl.style.transform = 'translate(-50%, -50%)';
    document.body.appendChild(floatEl); setTimeout(() => { floatEl.remove(); }, 2500);
}

// 預先載入圖片

loadAssets();

// === 🍎 召喚 iOS 安裝提示 (延遲 1 秒，等大廳載入完畢) ===
function checkAndShowIOSPrompt() {
    const isIos = /iphone|ipad|ipod/.test(window.navigator.userAgent.toLowerCase());
    const isStandalone = window.navigator.standalone === true; 

    if (isIos && !isStandalone) {
        setTimeout(() => {
            document.getElementById('ios-install-modal').classList.remove('hidden');
        }, 1000);
    }
}

// ==========================================
// 🚀 統一百格事件綁定區與系統初始化
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
    // 1. 替換成記憶 Email (如果玩家未登入，預先填好 Email)
    const lastEmail = localStorage.getItem('last_email_vocablord');
    const emailInput = document.getElementById('email-input');
    if (lastEmail && emailInput) { 
        emailInput.value = lastEmail; 
    }

    // 2. 懸浮面板初始化 
    const panel = document.getElementById('floating-panel');
    if (panel) { 
        document.body.appendChild(panel); 
        panel.style.position = 'fixed'; 
        panel.style.zIndex = '9999'; 
    }
    
    // 3. 初始化存檔計時器 
    setInterval(saveGame, 5000);

    // ==========================================
    // 按鈕與互動事件綁定
    // ==========================================
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
    document.getElementById('btn-speak-normal')?.addEventListener('click', () => speakCurrentWord('normal'));
    document.getElementById('btn-speak-slow')?.addEventListener('click', () => speakCurrentWord('slow'));
    document.getElementById('pro-upgrade-btn')?.addEventListener('click', () => showPaywall('解鎖完整 7000 單字庫與 VIP 寵物招募權限！'));
    document.getElementById('btn-back-to-map')?.addEventListener('click', backToMap);
    document.getElementById('btn-toggle-inventory')?.addEventListener('click', () => togglePanel('inventory'));
    document.getElementById('btn-toggle-shop')?.addEventListener('click', () => togglePanel('shop'));
    document.getElementById('btn-auto-harvest')?.addEventListener('click', autoHarvest);
    document.getElementById('nav-quiz-btn')?.addEventListener('click', () => switchTab('quiz'));
    document.getElementById('nav-farm-btn')?.addEventListener('click', () => switchTab('farm'));
    document.getElementById('btn-close-panel')?.addEventListener('click', () => togglePanel());
    document.getElementById('btn-close-review')?.addEventListener('click', closeReviewArea);
    document.getElementById('btn-close-graduated')?.addEventListener('click', closeGraduatedArea);
    document.getElementById('btn-close-daily-task-modal')?.addEventListener('click', () => document.getElementById('daily-task-modal').classList.add('hidden'));
    document.getElementById('btn-close-gacha')?.addEventListener('click', closeGacha);
    document.getElementById('btn-close-tutorial-x')?.addEventListener('click', closeTutorial);
    document.getElementById('btn-close-tutorial-ok')?.addEventListener('click', closeTutorial);
    document.getElementById('btn-close-paywall')?.addEventListener('click', closePaywall);
    document.getElementById('btn-close-coming-soon-x')?.addEventListener('click', closeComingSoon);
    document.getElementById('btn-close-coming-soon-ok')?.addEventListener('click', closeComingSoon);
    document.getElementById('btn-close-rest-reminder')?.addEventListener('click', () => document.getElementById('rest-reminder-modal').classList.add('hidden'));
    document.getElementById('btn-verify-license')?.addEventListener('click', verifyLicenseKey);
    document.getElementById('btn-shield-false')?.addEventListener('click', () => resolveShieldPrompt(false));
    document.getElementById('btn-shield-true')?.addEventListener('click', () => resolveShieldPrompt(true));

    // ==========================================
    // 領主選單與子功能綁定
    // ==========================================
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

    // ==========================================
    // 攔截一鍵播種，改成開啟種子選擇面板
    // ==========================================
    const autoPlantBtn = document.getElementById('btn-auto-plant');
    if (autoPlantBtn) {
        const newPlantBtn = autoPlantBtn.cloneNode(true);
        autoPlantBtn.parentNode.replaceChild(newPlantBtn, autoPlantBtn);
        newPlantBtn.addEventListener('click', () => {
            document.getElementById('seed-select-modal').classList.remove('hidden');
        });
    }
}); // DOMContentLoaded 結束


// ==========================================
// 全域函數：一鍵播種邏輯
// ==========================================
window.confirmAutoPlant = function(seedType) {

     // 1. 防呆：如果網格沒初始化，先初始化
    if (!gameState.farmTiles || gameState.farmTiles.length === 0) {
        migrateGrid();
    }

    document.getElementById('seed-select-modal').classList.add('hidden');
    const seedPrices = { 'tomato': 10, 'radish': 12, 'carrot': 15, 'beetroot': 18, 'cucumber': 20, 'onion': 22 };
    const cost = seedPrices[seedType] || 10; 

    let plantedCount = 0;
    
    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            const isFenceArea = (r === 0 || r === ROWS - 1 || c === 0 || c === COLS - 1);
            if (isFenceArea) continue;

            let tile = gameState.farmTiles[r][c];
            if (!tile.plant && gameState.coins >= cost) {
                gameState.coins -= cost;
                tile.plant = true; 
                tile.type = seedType;
                tile.progress = 0;
                plantedCount++;
            }
        }
    }
    
    if (plantedCount > 0) {
        showToast(`成功播種 ${plantedCount} 塊地！花費 ${plantedCount * cost} 金幣`, "success");
        updateUI();
        saveGame();
    } else {
        showToast("金幣不足或沒有空地可以播種了！", "error");
    }
};
// ⚠️ 貼到這裡為止，底下千萬不要再有任何符號或括號了！

window.auth.onAuthStateChanged(async (user) => {
    if (user) {
        await syncLoadFromCloud();
        migrateGrid();
        updateUI();
    }
});
// 在 script.js 最底部或初始化區
migrateGrid();
resize(); // 確保計算出正確的 TILE_SIZE
updateUI();