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
    radish: { id: 'radish', name: '🧅 甜菜', cost: 800, sellPrice: 1200, unlockLv: 10, exp: 300, growthFactor: 0.2 }
};

// ==========================================
// 🔥 字源學題庫與狂熱模式變數 🔥
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
});

function showTutorial() { document.getElementById('tutorial-modal').classList.remove('hidden'); }
function closeTutorial() { document.getElementById('tutorial-modal').classList.add('hidden'); }
function showComingSoon() { document.getElementById('coming-soon-modal').classList.remove('hidden'); }
function closeComingSoon() { document.getElementById('coming-soon-modal').classList.add('hidden'); }

function login() {
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
    gameState.combo = 0; // 登入時重置連勝
    
    migrateGrid(); 
    document.getElementById('in-game-difficulty').value = gameState.difficulty;
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('game-container').classList.remove('hidden');
    
    resize(); updateUI(); loadQuestion(); requestAnimationFrame(tick);
    if (window.innerWidth <= 1024) setTimeout(() => { switchTab('quiz'); }, 50);
}

function saveGame() { if (currentUser) localStorage.setItem('vocabMaster_' + currentUser, JSON.stringify(gameState)); }
setInterval(saveGame, 5000); 

function showPaywall(msg) { 
    document.getElementById('paywall-msg').innerText = msg; 
    document.getElementById('paywall-modal').classList.remove('hidden'); 
}
function closePaywall() { document.getElementById('paywall-modal').classList.add('hidden'); }

async function verifyLicenseKey() {
    const key = document.getElementById('license-input').value.replace(/\s+/g, '').toUpperCase();
    if (key === "PRO123") { // 開發測試用快捷鍵
        gameState.isPro = true; saveGame(); updateUI(); closePaywall(); 
        showToast("🎉 測試金鑰驗證成功！", "success"); 
    } else {
        showToast("⚠️ 驗證失敗：無效金鑰", "error"); 
    }
}

function changeDifficulty() { 
    const selector = document.getElementById('in-game-difficulty');
    if (selector.value !== "1" && !gameState.isPro) { showPaywall("中高級單字庫為專業版專屬！"); selector.value = gameState.difficulty; return; }
    gameState.difficulty = selector.value; saveGame(); loadQuestion(); 
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
// 🔥 核心答題邏輯 (已補回並升級狂熱機制)
// ==========================================
function loadQuestion() {
    if (typeof globalVocab === 'undefined') return;

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
    if (!currentWord.w) currentWord = pool[Math.floor(Math.random() * pool.length)];
    
    document.getElementById('word-display').innerText = currentWord.w;
    document.getElementById('reward-hint').innerText = `答對獎勵：💰 ${getCoinReward(currentWord.lv)}`;
    
    const grid = document.getElementById('options-grid'); 
    grid.innerHTML = '';
    
    let opts = [currentWord.c];
    let failSafe = 0;
    while(opts.length < 4 && failSafe < 100) {
        let r = globalVocab[Math.floor(Math.random() * globalVocab.length)].c;
        if(!opts.includes(r) && r !== undefined) opts.push(r);
        failSafe++;
    }
    
    opts.sort(() => Math.random() - 0.5).forEach(o => {
        const b = document.createElement('button'); 
        b.innerText = o;
        if (o === currentWord.c) b.dataset.correct = "true";

        b.onclick = () => {
            Array.from(grid.children).forEach(btn => btn.disabled = true);
            if (!gameState.wordStats[currentWord.w]) { gameState.wordStats[currentWord.w] = { correct: 0, wrong: 0, consecutive: 0 }; }

            if(o === currentWord.c) {
                b.style.backgroundColor = "#2ecc71"; b.style.color = "white"; b.style.borderColor = "#27ae60";

                gameState.coins += getCoinReward(currentWord.lv); 
                gameState.energy = Math.min(100, gameState.energy + 30);
                currentWord.weight = Math.max(1, currentWord.weight - 3); 
                gameState.wordStats[currentWord.w].correct += 1;
                gameState.wordStats[currentWord.w].consecutive += 1;
                
                // 🔥 連勝計算
                gameState.combo = (gameState.combo || 0) + 1;

                // 👑 終局神物：高級難度 50 連勝掉落改名卷軸
                if (gameState.combo === 50 && gameState.difficulty === "5") {
                    gameState.inventory['renameScroll'] = (gameState.inventory['renameScroll'] || 0) + 1;
                    showToast("🏆 神之領域！高級單字 50 連勝，獲得【傳說改名卷軸】！", "success");
                }

                if (gameState.wordStats[currentWord.w].consecutive >= 5) {
                    gameState.graduated[currentWord.w] = { w: currentWord.w, c: currentWord.c, lv: currentWord.lv };
                    showToast(`🎓 恭喜！[${currentWord.w}] 已畢業！`, "success");
                }

                saveGame(); updateUI();
                
                // 🔥 每 10 連勝觸發狂熱模式
                setTimeout(() => { 
                    if (gameState.combo > 0 && gameState.combo % 10 === 0) startFeverMode();
                    else loadQuestion(); 
                }, 400); 
            } else {
                b.style.backgroundColor = "#e74c3c"; b.style.color = "white"; b.style.borderColor = "#c0392b";
                let correctBtn = Array.from(grid.children).find(btn => btn.dataset.correct === "true");
                if (correctBtn) { correctBtn.style.backgroundColor = "#2ecc71"; correctBtn.style.color = "white"; correctBtn.style.borderColor = "#27ae60"; }

                showToast("❌ 答錯囉！連勝歸零", "error");
                gameState.energy = Math.max(0, gameState.energy - 10); 
                gameState.combo = 0; // 🔥 連勝歸零
                currentWord.weight += 10; 
                gameState.wordStats[currentWord.w].wrong += 1;
                gameState.wordStats[currentWord.w].consecutive = 0; 

                if (!gameState.mistakes[currentWord.w]) { gameState.mistakes[currentWord.w] = { w: currentWord.w, c: currentWord.c, lv: currentWord.lv, count: 0 }; }
                gameState.mistakes[currentWord.w].count += 1; 
                saveGame(); updateUI();
                
                setTimeout(() => { 
                    if (Object.keys(gameState.mistakes).length >= 30) startForcedReview();
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

        showToast("💡 已標記！連勝歸零", "info");
        gameState.combo = 0; // 🔥 連勝歸零
        currentWord.weight += 10; 
        if (!gameState.wordStats[currentWord.w]) { gameState.wordStats[currentWord.w] = { correct: 0, wrong: 0, consecutive: 0 }; }
        gameState.wordStats[currentWord.w].wrong += 1;
        gameState.wordStats[currentWord.w].consecutive = 0; 
        if (!gameState.mistakes[currentWord.w]) { gameState.mistakes[currentWord.w] = { w: currentWord.w, c: currentWord.c, lv: currentWord.lv, count: 0 }; }
        gameState.mistakes[currentWord.w].count += 1; 
        saveGame(); updateUI();

        setTimeout(() => { 
            if (Object.keys(gameState.mistakes).length >= 30) startForcedReview();
            else loadQuestion(); 
        }, 2000); 
    };
    grid.appendChild(idkBtn);
}

// ==========================================
// 🔥 狂熱模式主程式 (10秒爆發挑戰)
// ==========================================
function startFeverMode() {
    isFeverMode = true;
    let timeLeft = 10;
    
    const sidebar = document.getElementById('sidebar');
    if (sidebar) {
        sidebar.style.border = "5px solid #e74c3c";
        sidebar.style.boxShadow = "inset 0 0 30px rgba(231, 76, 60, 0.4)";
    }
    
    const wordDisplay = document.getElementById('word-display');
    const rewardHint = document.getElementById('reward-hint');
    const grid = document.getElementById('options-grid');
    
    let q = ETYMOLOGY_DATA[Math.floor(Math.random() * ETYMOLOGY_DATA.length)];
    
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
        
        b.onclick = () => {
            clearInterval(feverTimer); 
            Array.from(grid.children).forEach(btn => btn.disabled = true);
            
            if (o === q.meaning) {
                b.style.backgroundColor = "#2ecc71"; b.style.color = "white"; b.style.borderColor = "#27ae60";
                showToast("✨ 狂熱成功！全農場作物暴增 50% 生長度！", "success");
                
                gameState.farmTiles.forEach(r => r.forEach(t => { 
                    if(t.plant && t.progress < 100) { t.progress = Math.min(100, t.progress + 50); } 
                }));
                gameState.coins += 200; 
            } else {
                b.style.backgroundColor = "#e74c3c"; b.style.color = "white"; b.style.borderColor = "#c0392b";
                showToast("❌ 狂熱失敗！", "error");
                gameState.combo = 0; 
            }
            saveGame(); updateUI();
            setTimeout(endFeverMode, 1500);
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
// 🔥 功能面板與圖鑑
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
        html += `<h3 class="review-lv-header">Level ${lv} 單字</h3>`;
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
            let wordObj = globalVocab.find(v => v.w === w);
            let lv = wordObj ? wordObj.lv : (isGrad ? isGrad.lv : 1);
            let meaning = wordObj ? wordObj.c : (isGrad ? isGrad.c : "???");
            return { w, cons, lv, meaning, isGrad };
        });

    if (statsArr.length === 0) { 
        list.style.display = "block";
        list.innerHTML = "<div class='empty-review'>還沒有解鎖任何單字圖鑑喔！<br>快去答題收集星星吧！🌟</div>"; 
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
        html += `<h3 class="review-lv-header" style="background: linear-gradient(90deg, #d35400, #e67e22); color: white; border-left: 5px solid #f1c40f;">Level ${lv} 單字圖鑑</h3>`;
        html += `<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; padding-bottom: 20px; padding-top: 10px;">`;

        grouped[lv].forEach(item => {
            let starHTML = ""; let bgStyle = ""; let borderColor = "";
            if (item.cons >= 5) { starHTML = "🥇 金星 (畢業)"; bgStyle = "#fffbea"; borderColor = "#f1c40f"; }
            else if (item.cons >= 3) { starHTML = "🥈 銀星"; bgStyle = "#f8f9fa"; borderColor = "#bdc3c7"; }
            else { starHTML = "🥉 銅星"; bgStyle = "#fdf2e9"; borderColor = "#e67e22"; }

            html += `
            <div style="background: ${bgStyle}; border: 2px solid ${borderColor}; padding: 15px 10px; border-radius: 16px; box-shadow: 0 4px 10px rgba(0,0,0,0.1); display: flex; flex-direction: column; justify-content: space-between; align-items: center; text-align: center; position: relative; margin-top: 5px;">
                <div style="position: absolute; top: -12px; left: -5px; background: #34495e; color: white; font-size: 0.75em; font-weight: bold; padding: 4px 10px; border-radius: 10px; border: 2px solid ${borderColor}; box-shadow: 0 2px 4px rgba(0,0,0,0.2);">Lv.${item.lv}</div>
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
        showToast(`🔄 記憶消退！[${wk}] 已重新加入日常題庫！`, "info");
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
            let b = (gameState.energy >= 90)?1.5:0.5;
            if (t.progress < 100) { t.progress += b; } 
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
        // 📜 渲染改名卷軸
        if (gameState.inventory['renameScroll'] > 0) {
            hasItem = true;
            invHTML += `<div class="shop-item" style="flex-wrap: wrap; margin-bottom: 10px; padding-bottom: 15px; border-bottom: 2px solid #f1c40f;">
                <span style="width: 100%; font-weight: 900; margin-bottom: 10px; display: block; font-size: 1.1em; color: #8e44ad;">📜 傳說改名卷軸 x ${gameState.inventory['renameScroll']}</span>
                <button onclick="useRenameScroll()" style="width:100%; background:linear-gradient(135deg, #9b59b6, #8e44ad); box-shadow: 0 4px 0 #732d91;">✨ 改變命運 (使用)</button>
            </div>`;
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
        const pTitle = document.getElementById('panel-title'); if(pTitle) pTitle.innerText = '種子商城';
        let shopHTML = `<div style="margin-bottom:10px; border-bottom: 2px solid #eee; padding-bottom: 10px;"><button onclick="autoPlant()" style="width:100%; background:#27ae60; padding:12px; border-radius:8px; color:white; font-weight:bold; cursor:pointer; border:none; font-size:1em;">🌱 一鍵播種</button></div>`;
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
            // 轉移存檔
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
loadAssets();