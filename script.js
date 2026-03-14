const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

let COLS = 10;
let ROWS = 7;
let TILE_SIZE = 64; 
let offsetX = 0;
let offsetY = 0;

let currentUser = "";
let gameState = {
    coins: 100, energy: 100, combo: 0,
    inventory: { carrot: 0, tomato: 0, radish: 0 },
    farmTiles: [], difficulty: "1", currentPet: "pig", 
    petsOwned: ["pig"], 
    petStats: { pig: { lv: 1, exp: 0 }, fox: { lv: 1, exp: 0 }, cat: { lv: 1, exp: 0 } },
    isPro: false,
    mistakes: {},
    wordStats: {}, 
    graduated: {}  
};

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
    carrot: { id: 'carrot', name: '🥕 蘿蔔', cost: 20, sellPrice: 35, unlockLv: 1, exp: 35, growthFactor: 1.0 },
    tomato: { id: 'tomato', name: '🍅 番茄', cost: 150, sellPrice: 250, unlockLv: 5, exp: 100, growthFactor: 0.5 },
    radish: { id: 'radish', name: '🧅 甜菜', cost: 800, sellPrice: 300, unlockLv: 10, exp: 300, growthFactor: 0.2 }
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
let isEnEnMode = false; // 是否開啟英英字典模式
let feverTimer = null;

let currentSeed = 'carrot';
let currentWord = {};

const assets = {
    grass: 'assets/Terrain/Grass_Light.png', soil: 'assets/Objects/GardenBed_Blank.png',
    carrot_01: 'assets/Objects/GardenBed_Carrots_01.png', carrot_02: 'assets/Objects/GardenBed_Carrots_02.png',
    tomato_01: 'assets/Objects/GardenBed_Tomatoes_01.png', tomato_02: 'assets/Objects/GardenBed_Tomatoes_02.png',
    radish_01: 'assets/Objects/GardenBed_Radish_01.png', radish_02: 'assets/Objects/GardenBed_Radish_02.png',
    pig_Up: 'assets/Characters/Pig_Up.png', pig_Down: 'assets/Characters/Pig_Down.png', pig_Left: 'assets/Characters/Pig_Left.png', pig_Right: 'assets/Characters/Pig_Right.png', pig_Dead: 'assets/Characters/Pig_Dead.png',
    fox_Up: 'assets/Characters/Fox_Up.png', fox_Down: 'assets/Characters/Fox_Down.png', fox_Left: 'assets/Characters/Fox_Left.png', fox_Right: 'assets/Characters/Fox_Right.png', fox_Dead: 'assets/Characters/Fox_Dead.png',
    cat_Up: 'assets/Characters/Cat_Up.png', cat_Down: 'assets/Characters/Cat_Down.png', cat_Left: 'assets/Characters/Cat_Left.png', cat_Right: 'assets/Characters/Cat_Right.png', cat_Dead: 'assets/Characters/Cat_Dead.png'
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

function resize() {
    const rect = canvas.parentElement.getBoundingClientRect();
    canvas.width = rect.width; 
    canvas.height = rect.height;
    TILE_SIZE = Math.floor(Math.min(canvas.width / COLS, (canvas.height - 110) / ROWS));
    offsetX = Math.floor((canvas.width - (TILE_SIZE * COLS)) / 2);
    offsetY = Math.floor((canvas.height - (TILE_SIZE * ROWS)) / 2);
}
window.addEventListener('resize', resize);

document.addEventListener("DOMContentLoaded", () => {
    const lastUser = localStorage.getItem('last_user_vocablord');
    if (lastUser) { document.getElementById('username-input').value = lastUser; }
    
    const panel = document.getElementById('floating-panel');
    if (panel) {
        document.body.appendChild(panel);
        panel.style.position = 'fixed';
        panel.style.zIndex = '9999';
    }
});

function showTutorial() { document.getElementById('tutorial-modal').classList.remove('hidden'); }
function closeTutorial() { document.getElementById('tutorial-modal').classList.add('hidden'); }
function showComingSoon() { document.getElementById('coming-soon-modal').classList.remove('hidden'); }
function closeComingSoon() { document.getElementById('coming-soon-modal').classList.add('hidden'); }

function login() {
    if ('speechSynthesis' in window) {
        let silentUtterance = new SpeechSynthesisUtterance('');
        window.speechSynthesis.speak(silentUtterance);
    }
    currentUser = document.getElementById('username-input').value.trim();
    if (!currentUser) return showToast("請輸入勇者姓名！", "error");
    localStorage.setItem('last_user_vocablord', currentUser);
    
    const saved = localStorage.getItem('vocabMaster_' + currentUser);
    if (saved) {
        try {
            let oldState = JSON.parse(saved);
            Object.assign(gameState, oldState);
        } catch(e) {}
    }
    gameState.combo = 0; 
    
    migrateGrid(); 
    checkDailyReset(); // 🔥 檢查是否為新的一天，重置每日任務 
    document.getElementById('in-game-difficulty').value = gameState.difficulty;
    
    // 隱藏登入，顯示大廳
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('world-map-screen').classList.remove('hidden');
    document.getElementById('hub-player-name').innerText = currentUser; // 顯示玩家名稱
}

// ==========================================
// 🌍 大廳與關卡切換邏輯
// ==========================================
function enterRealm(realmId) {
    if (realmId !== 'english') {
        showToast("🚧 此領域正在積極建設中，敬請期待！", "info");
        return;
    }
    
    // 進入英文農場
    document.getElementById('world-map-screen').classList.add('hidden');
    document.getElementById('game-container').classList.remove('hidden');
    
    resize(); updateUI(); loadQuestion(); requestAnimationFrame(tick);
    if (window.innerWidth <= 1024) setTimeout(() => { switchTab('quiz'); }, 50);
}

function backToMap() {
    // 從農場退回大廳
    document.getElementById('game-container').classList.add('hidden');
    document.getElementById('world-map-screen').classList.remove('hidden');
}

function saveGame() { if (currentUser) localStorage.setItem('vocabMaster_' + currentUser, JSON.stringify(gameState)); }
setInterval(saveGame, 5000); 

function showPaywall(msg) { 
    document.getElementById('paywall-msg').innerText = msg; 
    document.getElementById('paywall-modal').classList.remove('hidden'); 
}
function closePaywall() { document.getElementById('paywall-modal').classList.add('hidden'); }

// ==========================================
// 💎 專業版金鑰雲端驗證系統
// ==========================================
async function verifyLicenseKey() {
    const inputElem = document.getElementById('license-input');
    const btnElem = document.querySelector('#paywall-modal .unlock-btn');
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
            if (msg.includes("使用") || msg.includes("綁定")) {
                msg = "⚠️ 驗證失敗：此金鑰無效或已被綁定！";
            }
            showToast(msg, "error"); 
        }
    } catch (error) { 
        showToast("連線驗證失敗，請檢查網路。", "error"); 
    } finally { 
        btnElem.innerText = "驗證並解鎖"; btnElem.disabled = false; 
    }
}


// ==========================================
// 📖 英英字典菁英模式邏輯
// ==========================================
function toggleEnEnMode() {
    isEnEnMode = document.getElementById('en-en-mode-toggle').checked;
    
    if (isEnEnMode) {
        showToast("🔥 進入菁英英英模式！答對金幣加倍！載入需稍候...", "info");
    } else {
        showToast("切換回標準中文模式。", "info");
    }
    loadQuestion(); // 切換模式後立刻重新載入題目
}

// 🌐 呼叫免費外部字典 API 獲取英文解釋
async function fetchEnglishDefinition(word) {
    try {
        // 清洗單字，去掉括號和多餘的空白
        let cleanWord = word.split('/')[0].split('(')[0].trim().toLowerCase();
        
        const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${cleanWord}`);
        if (!response.ok) return null; // 找不到字就回傳 null
        
        const data = await response.json();
        
        // 嘗試抓取第一個意義的定義
        if (data && data[0] && data[0].meanings && data[0].meanings[0] && data[0].meanings[0].definitions && data[0].meanings[0].definitions[0]) {
            let def = data[0].meanings[0].definitions[0].definition;
            // 避免解釋太長撐爆按鈕，截斷並加上...
            return def.length > 70 ? def.substring(0, 67) + "..." : def;
        }
        return null;
    } catch (e) {
        console.error("字典 API 請求失敗", e);
        return null;
    }
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
// 🔥 核心答題邏輯 (升級非同步選項引擎)
// ==========================================
function loadQuestion() {
    if (typeof globalVocab === 'undefined') return;

    const displayContainer = document.getElementById('word-display').parentElement;
    const btnContainer = displayContainer.querySelector('div');
    if (btnContainer && btnContainer.style) btnContainer.style.display = 'flex';

    let pool = globalVocab.filter(v => !gameState.graduated[v.w]);
    if (gameState.difficulty !== "all") {
        let d = parseInt(gameState.difficulty);
        pool = pool.filter(v => v.lv >= d && v.lv <= d + 1);
    }
    if (pool.length < 4) {
        pool = globalVocab.filter(v => v.lv >= parseInt(gameState.difficulty) && v.lv <= parseInt(gameState.difficulty) + 1);
        if (pool.length < 4) pool = globalVocab; 
    }

    pool.forEach(w => { if(typeof w.weight === 'undefined') w.weight = 10; });
    let totalWeight = pool.reduce((sum, word) => sum + word.weight, 0);
    let randomNum = Math.random() * totalWeight;
    for (let word of pool) { if (randomNum < word.weight) { currentWord = word; break; } randomNum -= word.weight; }
    if (!currentWord || !currentWord.w) currentWord = pool[Math.floor(Math.random() * pool.length)];
    
    document.getElementById('word-display').innerText = currentWord.w;
    
    // 結算獎勵顯示 (英英模式 x2)
    let baseReward = getCoinReward(currentWord.lv);
    document.getElementById('reward-hint').innerText = `答對獎勵：💰 ${isEnEnMode ? baseReward * 2 : baseReward}`;
    
    const grid = document.getElementById('options-grid'); 
    grid.innerHTML = '';
    
    // 🔥 呼叫非同步生成引擎
    generateOptionsAsync(grid, baseReward);
}

// ==========================================
// 🎲 動態選項生成引擎 (處理中/英雙語邏輯)
// ==========================================
async function generateOptionsAsync(grid, baseReward) {
    let optsData = []; 
    
    if (isEnEnMode) {
        grid.innerHTML = '<div style="grid-column: span 2; text-align: center; padding: 20px; color: #7f8c8d; font-weight: bold;">🌐 正在連線字典 API 抓取英文解釋...</div>';
        let correctDef = await fetchEnglishDefinition(currentWord.w);
        if (!correctDef) {
            showToast(`⚠️ 字典找不到 "${currentWord.w}"，此題暫時顯示中文`, "error");
            optsData.push({ text: currentWord.c, isCorrect: true });
        } else {
            optsData.push({ text: correctDef, isCorrect: true });
        }

        let failSafe = 0; let usedWords = [currentWord.w];
        while(optsData.length < 4 && failSafe < 50) {
            let randomWordObj = globalVocab[Math.floor(Math.random() * globalVocab.length)];
            if (!usedWords.includes(randomWordObj.w) && randomWordObj.c) {
                usedWords.push(randomWordObj.w);
                let wrongDef = await fetchEnglishDefinition(randomWordObj.w);
                if (wrongDef && !optsData.some(o => o.text === wrongDef)) {
                    optsData.push({ text: wrongDef, isCorrect: false });
                } else if (!optsData.some(o => o.text === randomWordObj.c)) {
                    optsData.push({ text: randomWordObj.c, isCorrect: false });
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
        if (isEnEnMode && o.text.length > 20) {
            b.style.fontSize = "0.8em"; b.style.padding = "10px"; b.style.lineHeight = "1.3";
        }
        if (o.isCorrect) b.dataset.correct = "true";

        b.onclick = () => {
            Array.from(grid.children).forEach(btn => btn.disabled = true);
            if (!gameState.wordStats[currentWord.w]) gameState.wordStats[currentWord.w] = { correct: 0, wrong: 0, consecutive: 0 };

            if(o.isCorrect) { 
                b.style.backgroundColor = "#2ecc71"; b.style.color = "white"; b.style.borderColor = "#27ae60";

                gameState.combo = (gameState.combo || 0) + 1;
                let comboMultiplier = Math.min(2.0, 1.0 + Math.floor(gameState.combo / 5) * 0.1);
                let finalReward = Math.floor((isEnEnMode ? baseReward * 2 : baseReward) * comboMultiplier);
                
                gameState.coins += finalReward; 
                gameState.energy = Math.min(100, gameState.energy + 30);
                currentWord.weight = Math.max(1, currentWord.weight - 3); 
                gameState.wordStats[currentWord.w].correct += 1;
                gameState.wordStats[currentWord.w].consecutive += 1;
                
                if (typeof updateDailyTask === 'function') {
                    updateDailyTask('correct50', 1, false); 
                    updateDailyTask('combo15', gameState.combo, true); 
                }

                if (typeof showFloatingText === 'function') {
                    if (comboMultiplier > 1.0) showFloatingText(`+${finalReward} 💰 (Combo x${comboMultiplier.toFixed(1)})`, "#f1c40f");
                    else showFloatingText(`+${finalReward} 💰`, "#2ecc71");
                }

                if (gameState.combo === 50 && gameState.difficulty === "5") {
                    gameState.inventory['renameScroll'] = (gameState.inventory['renameScroll'] || 0) + 1;
                    showToast("🏆 神之領域！高級單字 50 連勝，獲得【傳說改名卷軸】！", "success");
                }
                if (gameState.wordStats[currentWord.w].consecutive >= 5) {
                    gameState.graduated[currentWord.w] = { w: currentWord.w, c: currentWord.c, lv: currentWord.lv };
                    showToast(`🎓 恭喜！[${currentWord.w}] 已畢業！`, "success");
                }

                let isCrit = Math.random() < 0.15; 
                let actuallyGrew = false;
                gameState.farmTiles.forEach(r => r.forEach(t => { 
                    if(t.plant && t.progress < 100) { 
                        t.progress = Math.min(100, t.progress + (10 * (SEED_DATA[t.type].growthFactor || 1) * (isCrit ? 3 : 1))); 
                        actuallyGrew = true;
                    } 
                }));
                if (isCrit && actuallyGrew) showToast("⚡ 爆擊！作物瘋狂生長！", "success");

                saveGame(); updateUI();
                setTimeout(() => { 
                    if (gameState.combo > 0 && gameState.combo % 10 === 0) {
                        if (typeof startFeverMode === 'function') startFeverMode(); else loadQuestion();
                    } else loadQuestion(); 
                }, 400); 
            } else {
                b.style.backgroundColor = "#e74c3c"; b.style.color = "white"; b.style.borderColor = "#c0392b";
                let correctBtn = Array.from(grid.children).find(btn => btn.dataset.correct === "true");
                if (correctBtn) { correctBtn.style.backgroundColor = "#2ecc71"; correctBtn.style.color = "white"; correctBtn.style.borderColor = "#27ae60"; }

                if (gameState.inventory['shield'] > 0) {
                    gameState.inventory['shield']--;
                    showToast("🛡️ 保護傘發動！抵銷一次連勝中斷！", "info");
                } else {
                    gameState.combo = 0; 
                    showToast("❌ 答錯囉！連勝歸零", "error");
                    setTimeout(() => {
                        if(confirm("連勝被中斷了！😭\n要花費 💰1500 金幣立刻購買一把【🛡️ 連勝保護傘】以備下次使用嗎？")) {
                            if (gameState.coins >= 1500) {
                                gameState.coins -= 1500; gameState.inventory['shield'] = (gameState.inventory['shield'] || 0) + 1;
                                saveGame(); updateUI(); showToast("🛍️ 購買成功！保護傘已放入背包。", "success");
                            } else showToast("💰 金幣不足，購買失敗！", "error");
                        }
                    }, 400);
                }
                gameState.energy = Math.max(0, gameState.energy - 10); 
                currentWord.weight += 10; 
                gameState.wordStats[currentWord.w].wrong += 1;
                gameState.wordStats[currentWord.w].consecutive = 0; 

                if (!gameState.mistakes[currentWord.w]) gameState.mistakes[currentWord.w] = { w: currentWord.w, c: currentWord.c, lv: currentWord.lv, count: 0 };
                gameState.mistakes[currentWord.w].count += 1; 
                saveGame(); updateUI();
                
                setTimeout(() => { 
                    if (typeof startForcedReview === 'function' && Object.keys(gameState.mistakes).length >= 30) startForcedReview();
                    else loadQuestion(); 
                }, 2000); 
            }
        };
        grid.appendChild(b);
    });

    let idkBtn = document.createElement('button');
    idkBtn.innerText = "👀 我不會 (看答案)";
    idkBtn.style.gridColumn = "span 2"; idkBtn.style.padding = "10px"; idkBtn.style.fontSize = "0.95em"; 
    idkBtn.style.backgroundColor = "#f8f9fa"; idkBtn.style.color = "#7f8c8d"; idkBtn.style.border = "2px dashed #bdc3c7"; 
    idkBtn.style.boxShadow = "none";
    idkBtn.onclick = () => {
        Array.from(grid.children).forEach(btn => btn.disabled = true);
        let correctBtn = Array.from(grid.children).find(btn => btn.dataset.correct === "true");
        if (correctBtn) { correctBtn.style.backgroundColor = "#2ecc71"; correctBtn.style.color = "white"; correctBtn.style.borderColor = "#27ae60"; }

        if (gameState.inventory['shield'] > 0) {
            gameState.inventory['shield']--; showToast("💡 已標記！(🛡️保護傘抵銷連勝中斷)", "info");
        } else {
            showToast("💡 已標記！連勝歸零", "info"); gameState.combo = 0; 
        }
        currentWord.weight += 10; 
        if (!gameState.wordStats[currentWord.w]) gameState.wordStats[currentWord.w] = { correct: 0, wrong: 0, consecutive: 0 };
        gameState.wordStats[currentWord.w].wrong += 1; gameState.wordStats[currentWord.w].consecutive = 0; 
        if (!gameState.mistakes[currentWord.w]) gameState.mistakes[currentWord.w] = { w: currentWord.w, c: currentWord.c, lv: currentWord.lv, count: 0 };
        gameState.mistakes[currentWord.w].count += 1; 
        saveGame(); updateUI();

        setTimeout(() => { 
            if (typeof startForcedReview === 'function' && Object.keys(gameState.mistakes).length >= 30) startForcedReview();
            else loadQuestion(); 
        }, 2000); 
    };
    grid.appendChild(idkBtn);
}

// ==========================================
// 🔥 狂熱模式主程式 (新增字根圖鑑與訂正)
// ==========================================
function startFeverMode() {
    isFeverMode = true;
    let timeLeft = 10;
    
    // 隱藏發音按鈕
    const displayContainer = document.getElementById('word-display').parentElement;
    const btnContainer = displayContainer.querySelector('div');
    if (btnContainer) btnContainer.style.display = 'none';

    const sidebar = document.getElementById('sidebar');
    if (sidebar) {
        sidebar.style.border = "5px solid #e74c3c";
        sidebar.style.boxShadow = "inset 0 0 30px rgba(231, 76, 60, 0.4)";
    }
    
    const wordDisplay = document.getElementById('word-display');
    const rewardHint = document.getElementById('reward-hint');
    const grid = document.getElementById('options-grid');
    
    // 過濾出還沒畢業的字根，如果全畢業了就重新開放全部
    let availableRoots = ETYMOLOGY_DATA.filter(q => !gameState.graduated[`${q.root} (字根)`]);
    if (availableRoots.length === 0) availableRoots = ETYMOLOGY_DATA;
    let q = availableRoots[Math.floor(Math.random() * availableRoots.length)];
    let wordKey = `${q.root} (字根)`; 
    
    wordDisplay.innerHTML = `<span style="color:#e74c3c; font-size: 0.8em;">🔥 狂熱挑戰！</span><br><span style="font-size:0.5em; color:#7f8c8d;">字根 / 字首：</span><br>${q.root}`;
    rewardHint.innerHTML = `⏳ 剩餘：<span style="color:#e74c3c; font-size:1.5em; font-weight:900;">${timeLeft}</span> 秒`;
    
    let opts = [q.meaning, ...q.options];
    opts.sort(() => Math.random() - 0.5);
    
    grid.innerHTML = '';
    opts.forEach(o => {
        const b = document.createElement('button');
        b.innerText = o;
        b.style.padding = "18px 12px"; b.style.fontSize = "1.15em"; b.style.fontWeight = "bold"; 
        b.style.border = "2px solid #bdc3c7"; b.style.borderRadius = "14px"; b.style.cursor = "pointer";
        b.style.backgroundColor = "white"; b.style.color = "#2c3e50";
        if (o === q.meaning) b.dataset.correct = "true"; 
        
        b.onclick = () => {
            clearInterval(feverTimer); 
            Array.from(grid.children).forEach(btn => btn.disabled = true);
            
            if (!gameState.wordStats[wordKey]) gameState.wordStats[wordKey] = { correct: 0, wrong: 0, consecutive: 0 };

            if (o === q.meaning) {
                b.style.backgroundColor = "#2ecc71"; b.style.color = "white"; b.style.borderColor = "#27ae60";
                showToast("✨ 狂熱成功！全農場作物大暴增！", "success");
                
                gameState.farmTiles.forEach(r => r.forEach(t => { 
                    if(t.plant && t.progress < 100) { t.progress = Math.min(100, t.progress + 50); } 
                }));
                gameState.coins += 200; 
                
                // 記錄字根精通
                gameState.wordStats[wordKey].correct += 1;
                gameState.wordStats[wordKey].consecutive += 1;
                if (gameState.wordStats[wordKey].consecutive >= 5) {
                    gameState.graduated[wordKey] = { w: wordKey, c: q.meaning, lv: 7 };
                    showToast(`🎓 恭喜！字根 [${q.root}] 已精通！`, "success");
                }
                saveGame(); updateUI();
                setTimeout(endFeverMode, 1500);
            } else {
                b.style.backgroundColor = "#e74c3c"; b.style.color = "white"; b.style.borderColor = "#c0392b";
                let correctBtn = Array.from(grid.children).find(btn => btn.dataset.correct === "true");
                if (correctBtn) { correctBtn.style.backgroundColor = "#2ecc71"; correctBtn.style.color = "white"; correctBtn.style.borderColor = "#27ae60"; }
                
                showToast("❌ 狂熱失敗！已加入錯題本", "error");
                gameState.combo = 0; 
                
                // 記錄字根錯誤並加入錯題本 (Lv 7)
                gameState.wordStats[wordKey].wrong += 1;
                gameState.wordStats[wordKey].consecutive = 0;
                if (!gameState.mistakes[wordKey]) { gameState.mistakes[wordKey] = { w: wordKey, c: q.meaning, lv: 7, count: 0 }; }
                gameState.mistakes[wordKey].count += 1; 
                
                saveGame(); updateUI();
                setTimeout(endFeverMode, 2000); // 延長停留時間，讓學生訂正看清楚答案
            }
        };
        grid.appendChild(b);
    });
    
    feverTimer = setInterval(() => {
        timeLeft--;
        rewardHint.innerHTML = `⏳ 剩餘：<span style="color:#e74c3c; font-size:1.5em; font-weight:900;">${timeLeft}</span> 秒`;
        if (timeLeft <= 0) {
            clearInterval(feverTimer);
            Array.from(grid.children).forEach(btn => btn.disabled = true);
            showToast("⏳ 時間到！狂熱失敗", "info");
            gameState.combo = 0; 
            updateUI();
            setTimeout(endFeverMode, 1500);
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

// ==========================================
// 🔥 地獄特訓關卡 
// ==========================================
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
        gameState.coins += 500;
        gameState.energy = 100;
        saveGame(); updateUI(); loadQuestion(); 
        return;
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
        btn.style.padding = "15px"; btn.style.fontSize = "1.1em"; btn.style.fontWeight = "bold";
        btn.style.border = "2px solid #bdc3c7"; btn.style.borderRadius = "12px"; btn.style.backgroundColor = "white"; btn.style.cursor = "pointer"; btn.style.color = "#2c3e50";
        if (o === currentForcedWord.c) btn.dataset.correct = "true";

        btn.onclick = () => {
            Array.from(grid.children).forEach(b => b.disabled = true);
            if (o === currentForcedWord.c) {
                btn.style.backgroundColor = "#2ecc71"; btn.style.color = "white"; btn.style.borderColor = "#27ae60";
                forcedReviewQueue.shift(); 
                if (gameState.mistakes[currentForcedWord.w]) {
                    gameState.mistakes[currentForcedWord.w].count--;
                    if (gameState.mistakes[currentForcedWord.w].count <= 0) delete gameState.mistakes[currentForcedWord.w];
                }
                saveGame(); setTimeout(loadForcedReviewQuestion, 500); 
            } else {
                btn.style.backgroundColor = "#e74c3c"; btn.style.color = "white"; btn.style.borderColor = "#c0392b";
                let correctBtn = Array.from(grid.children).find(b => b.dataset.correct === "true");
                if (correctBtn) { correctBtn.style.backgroundColor = "#2ecc71"; correctBtn.style.color = "white"; correctBtn.style.borderColor = "#27ae60"; }
                showToast("❌ 答錯了！請記住正確的中文意思。", "error");
                let w = forcedReviewQueue.shift(); forcedReviewQueue.push(w); 
                
                let nextBtn = document.createElement('button');
                nextBtn.id = 'forced-next-btn'; nextBtn.innerText = "記住了，下一題 ➔";
                nextBtn.style.marginTop = "20px"; nextBtn.style.padding = "15px"; nextBtn.style.fontSize = "1.2em"; nextBtn.style.fontWeight = "bold"; nextBtn.style.backgroundColor = "#34495e"; nextBtn.style.color = "white"; nextBtn.style.border = "none"; nextBtn.style.borderRadius = "12px"; nextBtn.style.cursor = "pointer"; nextBtn.style.width = "100%"; nextBtn.style.boxShadow = "0 5px 0 #2c3e50";
                nextBtn.onclick = loadForcedReviewQuestion;
                grid.parentElement.appendChild(nextBtn);
            }
        };
        grid.appendChild(btn);
    });
}

// ==========================================
// 🔥 功能面板與圖鑑 (升級支援 Lv7 字根)
// ==========================================
function openReviewArea() { document.getElementById('review-screen').classList.remove('hidden'); renderReviewList(); }
function closeReviewArea() { document.getElementById('review-screen').classList.add('hidden'); }
function renderReviewList() {
    const list = document.getElementById('review-list');
    let mistakesArr = Object.values(gameState.mistakes);
    if (mistakesArr.length === 0) { list.innerHTML = "<div class='empty-review'>🎉 錯題本是空的！</div>"; return; }

    let grouped = {};
    mistakesArr.forEach(m => { let lv = m.lv || 1; if (!grouped[lv]) grouped[lv] = []; grouped[lv].push(m); });

    let html = "";
    Object.keys(grouped).sort((a, b) => a - b).forEach(lv => {
        grouped[lv].sort((a, b) => b.count - a.count); 
        let headerHTML = lv == 7 
            ? `<h3 class="review-lv-header" style="background: #c0392b; color: white;">🔥 狂熱字源學 (字根)</h3>`
            : `<h3 class="review-lv-header">Level ${lv} 單字</h3>`;
        html += headerHTML;
        
        html += grouped[lv].map(m => `
            <div class="review-item">
                <div class="review-word-info">
                    <div class="review-word">${m.w} <span class="error-count-badge">錯了 ${m.count} 次</span></div>
                    <div class="review-mean">${m.c}</div>
                </div>
                <button class="master-btn" onclick="masterWord('${encodeURIComponent(m.w)}')">✅ 複習</button>
            </div>`).join('');
    });
    list.innerHTML = html;
}
function masterWord(sw) {
    let wk = decodeURIComponent(sw);
    if (gameState.mistakes[wk]) {
        delete gameState.mistakes[wk];
        gameState.coins += 50; gameState.energy = Math.min(100, gameState.energy + 50);
        gameState.inventory['radish'] = (gameState.inventory['radish'] || 0) + 1; 
        saveGame(); updateUI(); renderReviewList();
        showToast(`✨ 恭喜克服 [${wk}]！獲得獎勵！`, "success");
    }
}

function openGraduatedArea() { document.getElementById('graduated-screen').classList.remove('hidden'); renderGraduatedList(); }
function closeGraduatedArea() { document.getElementById('graduated-screen').classList.add('hidden'); }
function renderGraduatedList() {
    const list = document.getElementById('graduated-list');
    
    let statsArr = Object.entries(gameState.wordStats)
        .filter(([w, data]) => data.consecutive > 0 || gameState.graduated[w])
        .map(([w, data]) => {
            let isGrad = gameState.graduated[w];
            let cons = isGrad ? 5 : data.consecutive;
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
    let html = "";

    let grouped = {};
    statsArr.forEach(item => {
        if (!grouped[item.lv]) grouped[item.lv] = [];
        grouped[item.lv].push(item);
    });

    Object.keys(grouped).sort((a, b) => a - b).forEach(lv => {
        grouped[lv].sort((a, b) => b.cons - a.cons);
        let headerHTML = lv == 7
            ? `<h3 class="review-lv-header" style="background: linear-gradient(90deg, #c0392b, #e74c3c); color: white; border-left: 5px solid #f1c40f;">🔥 狂熱字源學 (精通)</h3>`
            : `<h3 class="review-lv-header" style="background: linear-gradient(90deg, #d35400, #e67e22); color: white; border-left: 5px solid #f1c40f;">Level ${lv} 單字圖鑑</h3>`;
        html += headerHTML;
        
        html += `<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; padding-bottom: 20px; padding-top: 10px;">`;

        grouped[lv].forEach(item => {
            let starHTML = ""; let bgStyle = ""; let borderColor = "";
            if (item.cons >= 5) { starHTML = "🥇 金星 (畢業)"; bgStyle = "#fffbea"; borderColor = "#f1c40f"; }
            else if (item.cons >= 3) { starHTML = "🥈 銀星"; bgStyle = "#f8f9fa"; borderColor = "#bdc3c7"; }
            else { starHTML = "🥉 銅星"; bgStyle = "#fdf2e9"; borderColor = "#e67e22"; }

            html += `
            <div style="background: ${bgStyle}; border: 2px solid ${borderColor}; padding: 15px 10px; border-radius: 16px; box-shadow: 0 4px 10px rgba(0,0,0,0.1); display: flex; flex-direction: column; justify-content: space-between; align-items: center; text-align: center; position: relative; margin-top: 5px;">
                <div style="position: absolute; top: -12px; left: -5px; background: #34495e; color: white; font-size: 0.75em; font-weight: bold; padding: 4px 10px; border-radius: 10px; border: 2px solid ${borderColor}; box-shadow: 0 2px 4px rgba(0,0,0,0.2);">${lv == 7 ? '字根' : 'Lv.' + item.lv}</div>
                <div style="margin-top: 8px;">
                    <div style="font-size: 1.3em; font-weight: 900; color: #2c3e50; margin-bottom: 5px; word-break: break-word;">${item.w}</div>
                    <div style="font-size: 0.85em; color: #7f8c8d; font-weight: bold; margin-bottom: 10px; line-height: 1.3;">${item.meaning}</div>
                </div>
                <div style="width: 100%;">
                    <div style="font-size: 0.85em; font-weight: bold; padding: 4px; border-radius: 8px; background: white; border: 1px dashed ${borderColor}; color: #333; margin-bottom: 8px;">${starHTML}</div>
                    ${item.isGrad ? `<button onclick="reviveWord('${encodeURIComponent(item.w)}')" style="width: 100%; background: #e74c3c; color: white; border: none; padding: 8px; border-radius: 10px; font-weight: bold; cursor: pointer; font-size: 0.85em; box-shadow: 0 3px 0 #c0392b; transition: 0.1s;">🔄 召回重練</button>` : ''}
                </div>
            </div>`;
        });
        html += `</div>`; 
    });
    list.innerHTML = html;
}

function reviveWord(sw) {
    let wk = decodeURIComponent(sw);
    if (gameState.graduated[wk]) {
        delete gameState.graduated[wk]; 
        if (gameState.wordStats[wk]) { gameState.wordStats[wk].consecutive = 0; }
        saveGame(); renderGraduatedList();
        showToast(`🔄 記憶消退！[${wk}] 已重新加入題庫！`, "info");
    }
}

// ==========================================
// 🔥 農場邏輯與寵物
// ==========================================
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
            // ⚖️ 數值平衡：大幅削弱寵物催熟能力 (原本 0.5~1.5 改為 0.1~0.3)
            let b = (gameState.energy >= 90) ? 0.3 : 0.1;
            
            if (t.progress < 100) { 
                t.progress += b; 
            } else if (t.progress >= 100) {
                // 🚜 寵物自動收成功能
                gameState.inventory[t.type] = (gameState.inventory[t.type] || 0) + 1;
                t.plant = false; t.type = null; t.progress = 0;
                let plantEmoji = t.type === 'radish' ? '🧅' : (t.type === 'tomato' ? '🍅' : '🥕');
                showFloatingText(`+1 ${plantEmoji}`, "#2ecc71"); // 收成也會飄字
            }
        }
    }
}

function handleInteraction(e) {
    e.preventDefault(); const rect = canvas.getBoundingClientRect();
    const cx = e.touches ? e.touches[0].clientX : e.clientX, cy = e.touches ? e.touches[0].clientY : e.clientY;
    const x = Math.floor((cx - rect.left - offsetX) / TILE_SIZE);
    const y = Math.floor((cy - rect.top - offsetY) / TILE_SIZE);
    
    if(x>=0 && x<COLS && y>=0 && y<ROWS && gameState.farmTiles[y] && gameState.farmTiles[y][x]) {
        let t = gameState.farmTiles[y][x];
        if (t.plant && t.progress >= 100) { gameState.inventory[t.type] = (gameState.inventory[t.type]||0)+1; t.plant = false; t.type = null; t.progress = 0; } 
        else if (!t.plant && gameState.coins >= SEED_DATA[currentSeed].cost) { gameState.coins -= SEED_DATA[currentSeed].cost; t.plant = true; t.type = currentSeed; t.progress = 0; }
        updateUI(); saveGame();
    }
}
canvas.addEventListener('mousedown', handleInteraction); canvas.addEventListener('touchstart', handleInteraction, {passive: false});

function tick() { gameState.energy = Math.max(0, gameState.energy - 0.04); moveAllPets(); draw(); updateUI(); requestAnimationFrame(tick); }

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    let farmWidth = COLS * TILE_SIZE, farmHeight = ROWS * TILE_SIZE;

    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.4)'; ctx.shadowBlur = 15; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 10;
    ctx.fillStyle = '#2d5a27'; ctx.fillRect(offsetX - 2, offsetY - 2, farmWidth + 4, farmHeight + 4);
    ctx.restore();

    gameState.farmTiles.forEach((row, y) => row.forEach((tile, x) => {
        let px = offsetX + x * TILE_SIZE, py = offsetY + y * TILE_SIZE;
        if(images.grass && images.grass.isLoaded) ctx.drawImage(images.grass, px, py, TILE_SIZE, TILE_SIZE);
        if(images.soil && images.soil.isLoaded) ctx.drawImage(images.soil, px, py, TILE_SIZE, TILE_SIZE);
        
        if(tile.plant) {
            let k = tile.progress >= 100 ? tile.type+'_02' : tile.type+'_01';
            if(images[k] && images[k].isLoaded) ctx.drawImage(images[k], px, py, TILE_SIZE, TILE_SIZE);
            if(tile.progress < 100) { 
                ctx.fillStyle = gameState.energy >= 90 ? "#f1c40f" : "#4caf50";
                ctx.fillRect(px + TILE_SIZE*0.15, py + TILE_SIZE*0.8, (tile.progress/100)*(TILE_SIZE*0.7), TILE_SIZE*0.08);
            }
        }
    }));

    let sortedPets = [...gameState.petsOwned];
    sortedPets.sort((a, b) => activePets[a].y - activePets[b].y); 
    sortedPets.forEach(petId => {
        let p = activePets[petId]; let pSize = getPetSize(gameState.petStats[petId].lv);
        let drawX = offsetX + p.x * TILE_SIZE, drawY = offsetY + p.y * TILE_SIZE;
        let imgKey = petId + "_" + p.dir;
        if(images[imgKey] && images[imgKey].isLoaded) ctx.drawImage(images[imgKey], drawX - (pSize - TILE_SIZE)/2, drawY - (pSize - TILE_SIZE), pSize, pSize);
        else { ctx.font = (pSize/1.5) + "px Arial"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(petId === 'cat' ? "🐱" : (petId === 'fox' ? "🦊" : "🐷"), drawX + TILE_SIZE/2, drawY + TILE_SIZE/2); }
    });
}

function processFeeding(type, amount) {
    let cp = gameState.currentPet; let stat = gameState.petStats[cp]; let count = gameState.inventory[type] || 0;
    amount = Math.min(amount, count); 
    if (amount > 0) {
        gameState.inventory[type] -= amount;
        stat.exp += SEED_DATA[type].exp * amount;
        gameState.energy = Math.min(100, gameState.energy + (10 * amount));

        let getRequiredExp = (lv) => Math.floor(100 * Math.pow(1.15, lv - 1));

        while (stat.exp >= getRequiredExp(stat.lv)) {
            if (!gameState.isPro && stat.lv >= 15) {
                stat.exp = getRequiredExp(15); showPaywall("免費版寵物最高 15 級！\n升級專業版解鎖無上限等級與黃金作物！"); break; 
            }
            stat.exp -= getRequiredExp(stat.lv); stat.lv++; gameState.energy = 100; 
            showToast(`🎉 寵物升級到 Lv.${stat.lv}！`, "success");
        }
        updateUI(); saveGame(); togglePanel('inventory'); 
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
        const p = document.getElementById('floating-panel');
        if(!p.classList.contains('hidden') && document.getElementById('panel-title').innerText.includes('背包')) togglePanel('inventory'); 
    } else showToast("🚜 目前沒有成熟的作物可以收成喔！", "info"); 
}

function autoPlant() {
    let cost = SEED_DATA[currentSeed].cost; let emptyTiles = [];
    for(let y=0; y<ROWS; y++) { for(let x=0; x<COLS; x++) { if(!gameState.farmTiles[y][x].plant) emptyTiles.push({x: x, y: y}); } }
    emptyTiles.sort(() => Math.random() - 0.5);
    let count = 0;
    for(let i=0; i<emptyTiles.length; i++) {
        if (gameState.coins >= cost) { gameState.coins -= cost; let t = gameState.farmTiles[emptyTiles[i].y][emptyTiles[i].x]; t.plant = true; t.type = currentSeed; t.progress = 0; count++; } 
        else break; 
    }
    if(count > 0) { updateUI(); saveGame(); showToast(`🌱 成功一鍵播種了 ${count} 個 ${SEED_DATA[currentSeed].name}！`, "success"); } 
    else if (gameState.coins < cost) { showToast(`💰 金幣不足！每個需要 ${cost} 金幣。`, "error"); } 
    else showToast("🌱 農場客滿，沒有空地囉！", "info"); 
}

function equipSeed(type) { currentSeed = type; updateUI(); togglePanel('shop'); }
function switchPet(petId) { gameState.currentPet = petId; updateUI(); togglePanel(); saveGame(); }
function buyPet(petId) {
    if (petId === 'cat' && !gameState.isPro) { showPaywall("解鎖最強寵物「比比拉布」是專業版專屬福利喔！"); togglePanel(); return; }
    let cost = PET_DATA[petId].cost;
    if (gameState.coins >= cost) { gameState.coins -= cost; gameState.petsOwned.push(petId); switchPet(petId); loadQuestion(); } 
    else showToast(`金幣不足！需要 💰${cost}`, "error"); 
}

function togglePanel(type) {
    const p = document.getElementById('floating-panel');
    if (!type) { p.classList.add('hidden'); return; }
    p.classList.remove('hidden');
    if (type === 'inventory') {
        const pTitle = document.getElementById('panel-title'); if(pTitle) pTitle.innerText = '背包：' + PET_DATA[gameState.currentPet].title;
        let invHTML = `<div style="display:flex; gap:10px; margin-bottom:10px; border-bottom: 2px solid #eee; padding-bottom: 10px;"><button onclick="autoHarvest()" style="flex:1; background:#9b59b6; padding:10px; border-radius:8px; color:white; font-weight:bold; cursor:pointer; border:none;">🚜 一鍵收成</button></div>`;
        let hasItem = false;
        // 📜 渲染特殊道具
        if (gameState.inventory['renameScroll'] > 0) {
            hasItem = true;
            invHTML += `<div class="shop-item" style="flex-wrap: wrap; margin-bottom: 10px; padding-bottom: 15px; border-bottom: 2px solid #f1c40f;"><span style="width: 100%; font-weight: 900; margin-bottom: 10px; display: block; font-size: 1.1em; color: #8e44ad;">📜 傳說改名卷軸 x ${gameState.inventory['renameScroll']}</span><button onclick="useRenameScroll()" style="width:100%; background:linear-gradient(135deg, #9b59b6, #8e44ad); box-shadow: 0 4px 0 #732d91; color: white; border: none; padding: 10px; border-radius: 8px; cursor: pointer; font-weight: bold;">✨ 改變命運 (使用)</button></div>`;
        }
        if (gameState.inventory['potion'] > 0) {
            hasItem = true;
            invHTML += `<div class="shop-item" style="flex-wrap: wrap; margin-bottom: 10px; padding-bottom: 15px; border-bottom: 2px dashed #2ecc71;"><span style="width: 100%; font-weight: bold; margin-bottom: 10px; display: block; font-size: 1.1em; color: #27ae60;">🧪 催熟藥水 x ${gameState.inventory['potion']}</span><button onclick="usePotion()" style="width:100%; background:#2ecc71; color: white; border: none; padding: 10px; border-radius: 8px; cursor: pointer; font-weight: bold; box-shadow: 0 4px 0 #27ae60;">✨ 對全農場使用</button></div>`;
        }
        if (gameState.inventory['shield'] > 0) {
            hasItem = true;
            invHTML += `<div class="shop-item" style="background: #e8f8f5; border: 2px solid #1abc9c; margin-bottom: 10px;"><span style="font-weight: bold; color: #16a085;">🛡️ 連勝保護傘 x ${gameState.inventory['shield']}<br><small style="color:#7f8c8d;">(答錯時自動消耗)</small></span></div>`;
        }
        for (let key in SEED_DATA) {
            let count = gameState.inventory[key] || 0;
            if (count > 0) { 
                hasItem = true;
                invHTML += `<div class="shop-item" style="flex-wrap: wrap; margin-bottom: 10px; padding-bottom: 15px; border-bottom: 1px dashed #ccc;"><span style="width: 100%; font-weight: bold; margin-bottom: 10px; display: block; font-size: 1.1em; color: #2c3e50;">${SEED_DATA[key].name} x ${count}</span><div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; width: 100%;"><button onclick="feedPig('${key}')" style="background:#8bc34a;">餵 1</button><button onclick="feedAllOf('${key}')" style="background:#27ae60;">全餵</button><button onclick="sellPlant('${key}')" style="background:#f39c12;">賣 1</button><button onclick="sellAllOf('${key}')" style="background:#e74c3c;">全賣</button></div></div>`;
            }
        }
        document.getElementById('panel-body').innerHTML = hasItem ? invHTML : invHTML + "<p style='text-align:center; color:#777; margin-top:20px;'>背包空空的</p>";
    } else if (type === 'shop') {
        const pTitle = document.getElementById('panel-title'); 
        if(pTitle) pTitle.innerText = '農場商城';
        
        // 1. 盲盒轉蛋區 (美化按鈕樣式)
        let shopHTML = `<h4 style="margin: 0 0 10px 0; color: #8e44ad; border-bottom: 2px solid #eee; padding-bottom: 5px;">🎁 幸運盲盒</h4>`;
        shopHTML += `
            <div class="shop-item" style="background: #fdf2e9; border: 2px dashed #e67e22; margin-bottom: 15px; padding: 15px; border-radius: 12px;">
                <span style="font-weight: bold; color: #d35400;">神祕金蛋 (💰5000)<br><small style="color:#7f8c8d;">機率抽出大獎、道具或傳說卷軸！</small></span>
                <button onclick="drawGacha()" style="background: linear-gradient(135deg, #e67e22, #d35400); color: white; font-weight: bold; border: none; padding: 10px 20px; border-radius: 20px; cursor: pointer; box-shadow: 0 4px 0 #a04000, 0 5px 10px rgba(0,0,0,0.2); transition: 0.1s;">試試手氣</button>
            </div>`;
        
        // 2. 魔法道具區 (🛡️ 藥水已被移除，僅剩保護傘)
        shopHTML += `<h4 style="margin: 0 0 10px 0; color: #2980b9; border-bottom: 2px solid #eee; padding-bottom: 5px;">✨ 魔法道具</h4>`;
        shopHTML += `<div class="shop-item" style="margin-bottom: 15px;"><span>🛡️ 連勝保護傘 (💰1500)<br><small style="color:#7f8c8d;">答錯時免除一次連勝歸零</small></span><button onclick="buyItem('shield', 1500)" style="background: #3498db; color: white;">購買</button></div>`;

        // 3. 種子區
        shopHTML += `<h4 style="margin: 0 0 10px 0; color: #27ae60; border-bottom: 2px solid #eee; padding-bottom: 5px;">🌱 種子包</h4>`;
        shopHTML += `<div style="margin-bottom:10px;"><button onclick="autoPlant()" style="width:100%; background:#27ae60; padding:10px; border-radius:8px; color:white; font-weight:bold; cursor:pointer; border:none;">🌱 一鍵播種</button></div>`;
        
        for (let key in SEED_DATA) {
            let seed = SEED_DATA[key]; let isUnlocked = gameState.petStats.pig.lv >= seed.unlockLv; 
            let btnBg = !isUnlocked ? '#bdc3c7' : (currentSeed === key ? '#f1c40f' : '#3498db');
            let btnColor = (currentSeed === key) ? '#d35400' : 'white';
            let btnText = isUnlocked ? (currentSeed === key ? '✔ 裝備中' : '裝備') : '🔒 未解鎖';
            let extraStyle = currentSeed === key ? 'box-shadow: 0 0 12px rgba(241, 196, 15, 0.8); transform: scale(1.05); border: 2px solid #e67e22;' : '';
            shopHTML += `<div class="shop-item" style="padding: 10px 0;"><span>${seed.name} (💰${seed.cost}) <br><small style="color:#7f8c8d;">${isUnlocked ? '已解鎖' : `神豬 Lv.${seed.unlockLv} 解鎖`}</small></span><button onclick="equipSeed('${seed.id}')" ${!isUnlocked?'disabled':''} style="background: ${btnBg}; color: ${btnColor}; transition: 0.2s; ${extraStyle}">${btnText}</button></div>`;
        }
        document.getElementById('panel-body').innerHTML = shopHTML;
    } else if (type === 'pet') {
        const pTitle = document.getElementById('panel-title'); if(pTitle) pTitle.innerText = '寵物招募';
        let petHTML = "";
        for (let key in PET_DATA) {
            let pData = PET_DATA[key]; let isOwned = gameState.petsOwned.includes(key); let isCurrent = gameState.currentPet === key;
            if (isOwned) petHTML += `<div class="shop-item" style="background: ${isCurrent ? '#e8f5e9' : 'transparent'};"><span style="font-weight:bold;">${pData.title} <br><small>Lv.${gameState.petStats[key].lv}</small></span><button onclick="switchPet('${key}')" ${isCurrent?'disabled':''} style="background: ${isCurrent ? '#999' : '#3498db'}">${isCurrent ? '指定' : '選擇'}</button></div>`;
            else petHTML += `<div class="shop-item" style="background: #fdf2e9;"><span style="font-weight:bold;">${pData.title} <br><small>${pData.desc}</small></span><button onclick="buyPet('${key}')" style="background: ${(key === 'cat' && !gameState.isPro) ? "#95a5a6" : "#e74c3c"}">${(key === 'cat' && !gameState.isPro) ? "🔒 PRO專屬" : `💰${pData.cost}`}</button></div>`;
        }
        document.getElementById('panel-body').innerHTML = petHTML;
    }
}
// ==========================================
// 🎁 道具購買與盲盒轉蛋邏輯
// ==========================================
function buyItem(itemKey, cost) {
    if (gameState.coins >= cost) {
        gameState.coins -= cost;
        gameState.inventory[itemKey] = (gameState.inventory[itemKey] || 0) + 1;
        saveGame(); updateUI();
        showToast(`🛍️ 購買成功！已放入背包。`, "success");
    } else {
        showToast("💰 金幣不足！", "error");
    }
}

function usePotion() {
    if (!gameState.inventory['potion'] || gameState.inventory['potion'] <= 0) return;
    let grewSomething = false;
    gameState.farmTiles.forEach(r => r.forEach(t => { 
        if(t.plant && t.progress < 100) { t.progress = 100; grewSomething = true; } 
    }));
    if (grewSomething) {
        gameState.inventory['potion']--;
        saveGame(); updateUI(); togglePanel('inventory');
        showToast("✨ 魔法生效！全農場作物瞬間成熟！", "success");
    } else {
        showToast("🌱 目前沒有需要催熟的作物喔！", "info");
    }
}

function drawGacha() {
    let cost = 5000;
    if (gameState.coins < cost) return showToast("💰 金幣不足！", "error");
    
    gameState.coins -= cost;
    saveGame(); updateUI();
    
    togglePanel(); 
    const modal = document.getElementById('gacha-modal');
    const anim = document.getElementById('gacha-animation');
    const resultBox = document.getElementById('gacha-result-box');
    
    modal.classList.remove('hidden');
    anim.style.display = 'block';
    anim.classList.add('gacha-shaking');
    resultBox.classList.add('hidden');
    resultBox.classList.remove('gacha-pop');

    // ⚡ 縮短懸念：從 1.5 秒改為 0.5 秒，讓玩家可以快速連抽
    setTimeout(() => {
        anim.style.display = 'none';
        anim.classList.remove('gacha-shaking');
        resultBox.classList.remove('hidden');
        resultBox.classList.add('gacha-pop'); 
        
        let r = Math.random();
        let icon = ""; let title = ""; let desc = "";
        
        // ⚖️ 盲盒金幣回收機制：加入大量「虧錢」的獎勵
        if (r < 0.02) {
            gameState.inventory['renameScroll'] = (gameState.inventory['renameScroll'] || 0) + 1;
            icon = "📜"; title = "🎉 歐皇降臨！"; desc = "極稀有！抽中【傳說改名卷軸】！";
        } else if (r < 0.07) {
            gameState.coins += 10000; // 5% 機率大賺
            icon = "💰"; title = "財神爺保佑！"; desc = "爆富！抽中 10,000 金幣大賞！";
        } else if (r < 0.22) {
            gameState.coins += 3000; // 15% 機率小虧 (花5000拿3000)
            icon = "💵"; title = "差一點回本！"; desc = "獲得 3,000 金幣。";
        } else if (r < 0.50) {
            gameState.coins += 2000; // 28% 機率大虧 (花5000拿2000)
            icon = "🪙"; title = "虧本了！"; desc = "只獲得 2,000 金幣。";
        } else if (r < 0.65) {
            gameState.inventory['potion'] = (gameState.inventory['potion'] || 0) + 1; // 藥水變 1 罐
            icon = "🧪"; title = "✨ 還算實用"; desc = "獲得【催熟藥水 x1】。";
        } else if (r < 0.80) {
            gameState.inventory['shield'] = (gameState.inventory['shield'] || 0) + 1; // 保護傘變 1 把
            icon = "🛡️"; title = "有備無患"; desc = "獲得【連勝保護傘 x1】。";
        } else {
            gameState.inventory['radish'] = (gameState.inventory['radish'] || 0) + 3; // 20% 安慰獎
            icon = "🧅"; title = "銘謝惠顧"; desc = "獲得【甜菜種子 x3】當作安慰獎。";
        }
        
        document.getElementById('gacha-title').innerText = title;
        document.getElementById('gacha-item-icon').innerText = icon;
        document.getElementById('gacha-desc').innerText = desc;
        
        saveGame(); updateUI();
    }, 500);
}

function closeGacha() {
    document.getElementById('gacha-modal').classList.add('hidden');
    togglePanel('shop'); 
}

// ==========================================
// 👑 傳說改名卷軸使用邏輯
// ==========================================
function useRenameScroll() {
    if (!gameState.inventory['renameScroll'] || gameState.inventory['renameScroll'] <= 0) return;
    
    let target = prompt("請輸入數字選擇要改名的對象：\n[1] 勇者姓名 (你自己)\n[2] 目前的寵物");
    if (target === "1") {
        let newName = prompt("請輸入新的勇者姓名：");
        if (newName && newName.trim()) {
            let oldName = currentUser;
            currentUser = newName.trim();
            let oldData = localStorage.getItem('vocabMaster_' + oldName);
            if(oldData) {
                localStorage.setItem('vocabMaster_' + currentUser, oldData);
                localStorage.removeItem('vocabMaster_' + oldName);
            }
            localStorage.setItem('last_user_vocablord', currentUser);
            gameState.inventory['renameScroll']--;
            saveGame(); updateUI(); togglePanel('inventory');
            showToast("✨ 命運已改寫！勇者姓名已變更！", "success");
        }
    } else if (target === "2") {
        let newPetName = prompt("請輸入寵物的新名字：");
        if (newPetName && newPetName.trim()) {
            let cp = gameState.currentPet;
            gameState.petStats[cp].customName = newPetName.trim();
            gameState.inventory['renameScroll']--;
            saveGame(); updateUI(); togglePanel('inventory');
            showToast("✨ 契約已重鑄！寵物姓名已變更！", "success");
        }
    } else {
        showToast("取消改名。", "info");
    }
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
    const expFill = document.getElementById('exp-fill');
    let reqExp = Math.floor(100 * Math.pow(1.15, stat.lv - 1));
    if(expFill) expFill.style.width = (stat.exp / reqExp * 100) + "%";
    const pigLv = document.getElementById('pig-lv'); if(pigLv) pigLv.innerText = stat.lv;
    const playerName = document.getElementById('player-name-display'); 
    if(playerName) playerName.innerText = currentUser + " 的 " + (stat.customName || PET_DATA[cp].title);
    
    let petImgKey = cp + "_Down"; if (!images[petImgKey] || !images[petImgKey].isLoaded) petImgKey = "pig_Down";
    const pigImg = document.getElementById('pig-img'); if (pigImg && images[petImgKey] && images[petImgKey].isLoaded) { pigImg.src = images[petImgKey].src; pigImg.style.display = 'block'; }
}

function switchTab(tabName) {
    if (window.innerWidth > 1024) return; 
    const sidebar = document.getElementById('sidebar'); const farm = document.getElementById('farm-viewport');
    const quizBtn = document.getElementById('nav-quiz-btn'); const farmBtn = document.getElementById('nav-farm-btn');

    if (tabName === 'quiz') {
        if(sidebar) sidebar.classList.remove('mobile-hidden'); if(farm) farm.classList.add('mobile-hidden');
        if(quizBtn) quizBtn.classList.add('active'); if(farmBtn) farmBtn.classList.remove('active');
    } else if (tabName === 'farm') {
        if(sidebar) sidebar.classList.add('mobile-hidden'); if(farm) farm.classList.remove('mobile-hidden');
        if(quizBtn) quizBtn.classList.remove('active'); if(farmBtn) farmBtn.classList.add('active');
        setTimeout(resize, 50);
    }
}

// ==========================================
// 📜 每日懸賞系統 (Daily Quests)
// ==========================================
const DAILY_TASKS_CONFIG = [
    { id: 'login', desc: '📅 每日登入簽到', goal: 1, reward: 50 },
    { id: 'correct50', desc: '📝 本日累積答對 50 題', goal: 50, reward: 300 },
    { id: 'combo15', desc: '🔥 達成一次 15 連勝', goal: 15, reward: 200 }
];

function checkDailyReset() {
    let today = new Date().toLocaleDateString();
    if (gameState.lastLoginDate !== today) {
        gameState.lastLoginDate = today;
        gameState.dailyProgress = { login: 1, correct50: 0, combo15: 0 };
        gameState.dailyClaimed = { login: false, correct50: false, combo15: false };
        saveGame();
        setTimeout(() => showToast("🌅 新的一天開始了！每日任務已刷新！", "success"), 1000);
    }
}

function updateDailyTask(taskId, amount = 1, isAbsolute = false) {
    if (!gameState.dailyProgress) return;
    if (isAbsolute) {
        if (amount > gameState.dailyProgress[taskId]) gameState.dailyProgress[taskId] = amount;
    } else {
        gameState.dailyProgress[taskId] += amount;
    }
    saveGame();
}

function openDailyTasks() {
    const list = document.getElementById('daily-task-list');
    list.innerHTML = '';
    
    DAILY_TASKS_CONFIG.forEach(task => {
        let current = gameState.dailyProgress[task.id] || 0;
        let isComplete = current >= task.goal;
        let isClaimed = gameState.dailyClaimed[task.id];
        
        let btnHTML = "";
        if (isClaimed) {
            btnHTML = `<button disabled style="background: #bdc3c7; color: white; border: none; padding: 8px 15px; border-radius: 8px; font-weight: bold; cursor: not-allowed;">已領取</button>`;
        } else if (isComplete) {
            btnHTML = `<button onclick="claimDailyTask('${task.id}', ${task.reward})" style="background: #f1c40f; color: #d35400; border: none; padding: 8px 15px; border-radius: 8px; font-weight: bold; cursor: pointer; box-shadow: 0 3px 0 #e67e22; animation: pulse 1s infinite;">領 💰${task.reward}</button>`;
        } else {
            btnHTML = `<span style="color: #7f8c8d; font-weight: bold;">${current} / ${task.goal}</span>`;
        }

        list.innerHTML += `
            <div style="display: flex; justify-content: space-between; align-items: center; background: #f8f9fa; padding: 15px; border-radius: 12px; border: 2px solid ${isComplete && !isClaimed ? '#f1c40f' : '#ecf0f1'};">
                <div style="text-align: left;">
                    <div style="font-weight: bold; color: #2c3e50; font-size: 1.1em;">${task.desc}</div>
                    <div style="font-size: 0.85em; color: #e67e22; margin-top: 4px;">獎勵：💰 ${task.reward}</div>
                </div>
                <div>${btnHTML}</div>
            </div>
        `;
    });
    
    document.getElementById('daily-task-modal').classList.remove('hidden');
}

function claimDailyTask(taskId, reward) {
    gameState.dailyClaimed[taskId] = true;
    gameState.coins += reward;
    saveGame();
    updateUI();
    openDailyTasks(); // 重新渲染畫面
    showToast(`🎉 任務完成！獲得 💰 ${reward} 金幣！`, "success");
}

// ==========================================
// 🔊 單字發音系統 (終極穩定 + 系統相容版)
// ==========================================
function speakCurrentWord(speedMode = 'normal') {
    let displayElement = document.getElementById('word-display');
    if (!displayElement) return;
    
    let rawText = displayElement.innerText;
    if (rawText === "Ready?" || rawText.trim() === "") return;

    let cleanWord = rawText.split('/')[0].split('(')[0].trim();
    
    if (!('speechSynthesis' in window)) {
        return showToast("⚠️ 您的瀏覽器不支援發音", "error");
    }

    window.speechSynthesis.cancel();

    setTimeout(() => {
        let utterance = new SpeechSynthesisUtterance(cleanWord);
        utterance.lang = 'en-US';

        if (speedMode === 'slow') {
            utterance.rate = 0.4; 
            utterance.pitch = 1.0;
        } else {
            utterance.rate = 0.85; 
            utterance.pitch = 1.1; 
        }

        let voices = window.speechSynthesis.getVoices();
        let bestVoice = voices.find(v => 
            v.name.includes('Google US English') || 
            v.name.includes('Samantha') || 
            v.name.includes('Aria')
        ) || voices.find(v => v.lang.includes('en-US'));

        if (bestVoice) utterance.voice = bestVoice;

        window.speechSynthesis.speak(utterance);
    }, 50);
}

if ('speechSynthesis' in window) {
    window.speechSynthesis.onvoiceschanged = () => {
        console.log("🔊 系統語音包已就緒");
    };
}

// ==========================================
// 💥 RPG 飄字特效引擎
// ==========================================
function showFloatingText(text, color = "#f1c40f") {
    const floatEl = document.createElement('div');
    floatEl.className = 'floating-text';
    floatEl.innerText = text;
    floatEl.style.color = color;
    
    // 設定在畫面正中央偏上產生
    floatEl.style.left = '50%';
    floatEl.style.top = '40%';
    floatEl.style.transform = 'translate(-50%, -50%)';
    
    document.body.appendChild(floatEl);
    
    // 2.5秒動畫結束後自動清理垃圾
    setTimeout(() => {
        floatEl.remove();
    }, 2500);
}
loadAssets();