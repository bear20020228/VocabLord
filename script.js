const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

let COLS = 10;
let ROWS = 7;
let TILE_SIZE = 64; 
let offsetX = 0;
let offsetY = 0;

let currentUser = "";
let gameState = {
    coins: 100, energy: 100,
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

function migrateGrid() {
    if (!gameState.farmTiles || gameState.farmTiles.length !== ROWS || gameState.farmTiles[0].length !== COLS) {
        let refundAmount = 0;
        
        if (gameState.farmTiles && gameState.farmTiles.length > 0) {
            for (let y = 0; y < gameState.farmTiles.length; y++) {
                for (let x = 0; x < gameState.farmTiles[y].length; x++) {
                    if (gameState.farmTiles[y][x] && gameState.farmTiles[y][x].plant && (x >= COLS || y >= ROWS)) {
                        let pType = gameState.farmTiles[y][x].type;
                        refundAmount += SEED_DATA[pType].cost; 
                    }
                }
            }
        }
        
        if (refundAmount > 0) {
            gameState.coins += refundAmount;
            setTimeout(() => {
                let msgEl = document.getElementById('marquee-msg');
                if(msgEl) msgEl.innerText = `🔄 農場升級：系統已自動為您退回超出邊界的種子費用 💰${refundAmount}！`;
            }, 1000);
        }

        let newTiles = Array.from({length: ROWS}, () => Array.from({length: COLS}, () => ({ plant: false, type: null, progress: 0 })));
        if (gameState.farmTiles && gameState.farmTiles.length > 0) {
            for(let y = 0; y < Math.min(ROWS, gameState.farmTiles.length); y++) {
                for(let x = 0; x < Math.min(COLS, gameState.farmTiles[y].length); x++) {
                    newTiles[y][x] = gameState.farmTiles[y][x];
                }
            }
        }
        
        Object.keys(activePets).forEach(pid => {
            if (activePets[pid].x >= COLS) activePets[pid].x = COLS - 1;
            if (activePets[pid].y >= ROWS) activePets[pid].y = ROWS - 1;
            activePets[pid].targetX = activePets[pid].x;
            activePets[pid].targetY = activePets[pid].y;
        });

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
    if (!currentUser) return alert("請輸入名字");
    localStorage.setItem('last_user_vocablord', currentUser);
    
    const saved = localStorage.getItem('vocabMaster_' + currentUser);
    if (saved) {
        try {
            let oldState = JSON.parse(saved);
            Object.assign(gameState, oldState);
            if (oldState.petStats && oldState.petStats.dog) { gameState.petStats.fox = oldState.petStats.dog; delete gameState.petStats.dog; }
            if (gameState.currentPet === 'dog') gameState.currentPet = 'fox';
            gameState.wordStats = oldState.wordStats || {};
            gameState.graduated = oldState.graduated || {};
        } catch(e) { console.error("存檔讀取失敗，載入預設值"); }
    }
    
    migrateGrid(); 
    
    const diffSelector = document.getElementById('in-game-difficulty');
    if(diffSelector) diffSelector.value = gameState.difficulty;
    
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('game-container').classList.remove('hidden');
    
    if (typeof globalVocab === 'undefined') { alert("找不到單字庫 (vocab.js)！請確認檔案是否存在。"); return; }
    
    resize(); updateUI(); loadQuestion(); requestAnimationFrame(tick);


}

function saveGame() { if (currentUser) localStorage.setItem('vocabMaster_' + currentUser, JSON.stringify(gameState)); }
setInterval(saveGame, 5000); 

function showPaywall(msg) { 
    const msgEl = document.getElementById('paywall-msg');
    if(msgEl) msgEl.innerText = msg; 
    document.getElementById('paywall-modal').classList.remove('hidden'); 
}
function closePaywall() { 
    document.getElementById('paywall-modal').classList.add('hidden'); 
    const inputEl = document.getElementById('license-input');
    if(inputEl) inputEl.value = ""; 
}

async function verifyLicenseKey() {
    const inputElem = document.getElementById('license-input');
    const btnElem = document.querySelector('.unlock-btn');
    const key = inputElem.value.replace(/\s+/g, '').toUpperCase();
    if (!key) return alert("請輸入金鑰！");
    const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxJm3AvAS-vwd841tmJVwPMt7VT9ufh_maHenZGTj_XVQ10gRNskiA6k2ptJiekNgp_/exec"; 
    btnElem.innerText = "⏳ 雲端連線驗證中..."; btnElem.disabled = true;
    try {
        const response = await fetch(`${SCRIPT_URL}?key=${key}&user=${currentUser}`);
        const data = await response.json();
        if (data.success) { 
            gameState.isPro = true; saveGame(); updateUI(); closePaywall(); 
            alert("🎉 金鑰驗證成功！您已解鎖專業版！"); 
        } else { 
            let msg = data.message;
            if (msg.includes("使用") || msg.includes("綁定")) {
                msg = "⚠️ 驗證失敗：此金鑰無效或已被其他帳號綁定使用！";
            }
            alert(msg); 
        }
    } catch (error) { alert("連線驗證失敗。"); } finally { btnElem.innerText = "驗證並解鎖"; btnElem.disabled = false; }
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

function loadQuestion() {
    if (typeof globalVocab === 'undefined') return;

    let pool = globalVocab.filter(v => !gameState.graduated[v.w]);
    if (gameState.difficulty !== "all") {
        let d = parseInt(gameState.difficulty);
        pool = pool.filter(v => v.lv >= d && v.lv <= d + 1);
    }
    
    if (pool.length < 4) {
        let msgEl = document.getElementById('marquee-msg');
        if(msgEl) msgEl.innerText = `🏆 太神啦！這個難度的單字你已經全部畢業了！系統將為你抓取複習題庫。`;
        pool = globalVocab.filter(v => v.lv >= parseInt(gameState.difficulty) && v.lv <= parseInt(gameState.difficulty) + 1);
        if (pool.length < 4) pool = globalVocab; 
    }

    pool.forEach(w => { if(typeof w.weight === 'undefined') w.weight = 10; });

    let totalWeight = pool.reduce((sum, word) => sum + word.weight, 0);
    let randomNum = Math.random() * totalWeight;
    for (let word of pool) { if (randomNum < word.weight) { currentWord = word; break; } randomNum -= word.weight; }
    if (!currentWord.w) currentWord = pool[Math.floor(Math.random() * pool.length)];
    
    const wordDisplay = document.getElementById('word-display');
    if(wordDisplay) wordDisplay.innerText = currentWord.w;
    
    const rewardHint = document.getElementById('reward-hint');
    if(rewardHint) rewardHint.innerText = `答對獎勵：💰 ${getCoinReward(currentWord.lv)}`;
    
    const grid = document.getElementById('options-grid'); 
    if(grid) {
        grid.innerHTML = '';
        let opts = [currentWord.c];
        let failSafe = 0;
        while(opts.length < 4 && failSafe < 100) {
            let r = globalVocab[Math.floor(Math.random() * globalVocab.length)].c;
            if(!opts.includes(r) && r !== undefined) opts.push(r);
            failSafe++;
        }
        
        opts.sort(() => Math.random() - 0.5).forEach(o => {
            const b = document.createElement('button'); b.innerText = o;
            b.onclick = () => {
                if (!gameState.wordStats[currentWord.w]) { gameState.wordStats[currentWord.w] = { correct: 0, wrong: 0, consecutive: 0 }; }

                if(o === currentWord.c) {
                    gameState.coins += getCoinReward(currentWord.lv); 
                    gameState.energy = Math.min(100, gameState.energy + 30);
                    currentWord.weight = Math.max(1, currentWord.weight - 3); 
                    
                    gameState.wordStats[currentWord.w].correct += 1;
                    gameState.wordStats[currentWord.w].consecutive += 1;

                    if (gameState.wordStats[currentWord.w].consecutive >= 5) {
                        gameState.graduated[currentWord.w] = { w: currentWord.w, c: currentWord.c, lv: currentWord.lv };
                        let msgEl2 = document.getElementById('marquee-msg');
                        if(msgEl2) msgEl2.innerText = `🎓 恭喜！單字 [${currentWord.w}] 連續答對 5 次，已移至「已畢業單字區」！`;
                    }

                    gameState.farmTiles.forEach(r => r.forEach(t => { if(t.plant) { let f = SEED_DATA[t.type].growthFactor || 1; t.progress = Math.min(100, t.progress + (15 * f)); } }));
                    saveGame(); loadQuestion();
                } else {
                    gameState.energy = Math.max(0, gameState.energy - 10); 
                    currentWord.weight += 10; 
                    
                    gameState.wordStats[currentWord.w].wrong += 1;
                    gameState.wordStats[currentWord.w].consecutive = 0; 

                    if (!gameState.mistakes[currentWord.w]) { gameState.mistakes[currentWord.w] = { w: currentWord.w, c: currentWord.c, lv: currentWord.lv, count: 0 }; }
                    gameState.mistakes[currentWord.w].count += 1; saveGame(); loadQuestion();
                }
            };
            grid.appendChild(b);
        });
    }
}

function openReviewArea() { document.getElementById('review-screen').classList.remove('hidden'); renderReviewList(); }
function closeReviewArea() { document.getElementById('review-screen').classList.add('hidden'); }
// 🔥 錯題本智慧分級顯示 🔥
function renderReviewList() {
    const list = document.getElementById('review-list');
    let mistakesArr = Object.values(gameState.mistakes);
    if (mistakesArr.length === 0) { list.innerHTML = "<div class='empty-review'>🎉 錯題本是空的！</div>"; return; }

    // 依據單字等級 (Lv) 進行分組
    let grouped = {};
    mistakesArr.forEach(m => {
        let lv = m.lv || 1;
        if (!grouped[lv]) grouped[lv] = [];
        grouped[lv].push(m);
    });

    let html = "";
    // 依等級 1 -> 6 排序輸出
    Object.keys(grouped).sort((a, b) => a - b).forEach(lv => {
        grouped[lv].sort((a, b) => b.count - a.count); // 同等級內依錯誤次數排序
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
        let msgEl = document.getElementById('marquee-msg');
        if(msgEl) msgEl.innerText = `✨ 恭喜克服 [${wk}]！獲得獎勵！`;
    }
}

function openGraduatedArea() { document.getElementById('graduated-screen').classList.remove('hidden'); renderGraduatedList(); }
function closeGraduatedArea() { document.getElementById('graduated-screen').classList.add('hidden'); }
function renderGraduatedList() {
    const list = document.getElementById('graduated-list');
    let arr = Object.values(gameState.graduated);
    if (arr.length === 0) { list.innerHTML = "<div class='empty-review'>還沒有畢業的單字喔！<br>連續答對同一個單字 5 次即可畢業！</div>"; return; }
    
    list.innerHTML = arr.map(m => `
        <div class="review-item graduated-item">
            <div class="review-word-info">
                <div class="review-word">${m.w} <span style="font-size: 0.6em; background: #3498db; color: white; padding: 2px 6px; border-radius: 4px; margin-left: 5px;">Lv.${m.lv || '?'}</span> <span class="success-badge">連對 5 次</span></div>
                <div class="review-mean">${m.c}</div>
            </div>
            <button class="revive-btn" onclick="reviveWord('${encodeURIComponent(m.w)}')">🔄 召回</button>
        </div>`).join('');
}
function reviveWord(sw) {
    let wk = decodeURIComponent(sw);
    if (gameState.graduated[wk]) {
        delete gameState.graduated[wk]; 
        if (gameState.wordStats[wk]) { gameState.wordStats[wk].consecutive = 0; }
        saveGame(); renderGraduatedList();
        let msgEl = document.getElementById('marquee-msg');
        if(msgEl) msgEl.innerText = `🔄 單字 [${wk}] 已重新加入題庫池中！`;
    }
}

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
            else { gameState.inventory[t.type] = (gameState.inventory[t.type] || 0) + 1; t.plant = false; t.type = null; t.progress = 0; }
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
    
    let farmWidth = COLS * TILE_SIZE;
    let farmHeight = ROWS * TILE_SIZE;

    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
    ctx.shadowBlur = 15;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 10;
    ctx.fillStyle = '#2d5a27'; 
    ctx.fillRect(offsetX - 2, offsetY - 2, farmWidth + 4, farmHeight + 4);
    ctx.restore();

    gameState.farmTiles.forEach((row, y) => row.forEach((tile, x) => {
        let px = offsetX + x * TILE_SIZE;
        let py = offsetY + y * TILE_SIZE;
        
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
        let p = activePets[petId];
        let pSize = getPetSize(gameState.petStats[petId].lv);
        let drawX = offsetX + p.x * TILE_SIZE;
        let drawY = offsetY + p.y * TILE_SIZE;
        let imgKey = petId + "_" + p.dir;
        if(images[imgKey] && images[imgKey].isLoaded) {
            ctx.drawImage(images[imgKey], drawX - (pSize - TILE_SIZE)/2, drawY - (pSize - TILE_SIZE), pSize, pSize);
        } else {
            ctx.font = (pSize/1.5) + "px Arial"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
            let emoji = petId === 'cat' ? "🐱" : (petId === 'fox' ? "🦊" : "🐷");
            ctx.fillText(emoji, drawX + TILE_SIZE/2, drawY + TILE_SIZE/2);
        }
    });
}

// 🔥 全新智慧餵食引擎 (支援單一與一鍵全餵) 🔥
function processFeeding(type, amount) {
    let cp = gameState.currentPet;
    let stat = gameState.petStats[cp];
    let count = gameState.inventory[type] || 0;
    amount = Math.min(amount, count); // 確保餵食數量不超過背包擁有數

    if (amount > 0) {
        gameState.inventory[type] -= amount;
        stat.exp += SEED_DATA[type].exp * amount;
        // 餵食也可恢復活力，每吃一個恢復 10 點
        gameState.energy = Math.min(100, gameState.energy + (10 * amount));

        // 精確的升級計算器 (可處理瞬間獲得巨量經驗連升好幾級的情況)
        while (stat.exp >= stat.lv * 100) {
            stat.exp -= stat.lv * 100;
            stat.lv++;
            gameState.energy = 100; // 升級瞬間回滿活力
        }

        updateUI(); 
        saveGame(); 
        togglePanel('inventory'); // 重新渲染背包畫面
    }
}

// 餵 1 個
function feedPig(type) { processFeeding(type, 1); }

// 一鍵全餵 (把該作物全部餵掉)
function feedAllOf(type) { processFeeding(type, gameState.inventory[type] || 0); }

function sellPlant(type) {
    if (gameState.inventory[type] > 0) {
        gameState.inventory[type]--;
        gameState.coins += SEED_DATA[type].sellPrice;
        updateUI(); saveGame(); togglePanel('inventory'); 
    }
}

function sellAllOf(type) {
    let count = gameState.inventory[type] || 0;
    if (count > 0) {
        gameState.coins += count * SEED_DATA[type].sellPrice;
        gameState.inventory[type] = 0;
        updateUI(); saveGame(); togglePanel('inventory'); 
    }
}

function autoHarvest() {
    let count = 0;
    gameState.farmTiles.forEach(r => r.forEach(t => {
        if(t.plant && t.progress >= 100) {
            gameState.inventory[t.type] = (gameState.inventory[t.type] || 0) + 1;
            t.plant = false; t.type = null; t.progress = 0;
            count++;
        }
    }));
    
    let msgEl = document.getElementById('marquee-msg');
    if(count > 0) { 
        updateUI(); saveGame(); 
        if(msgEl) msgEl.innerText = `🚜 成功一鍵收成了 ${count} 個作物！請到背包查看。`;
        const p = document.getElementById('floating-panel');
        if(!p.classList.contains('hidden') && document.getElementById('panel-title').innerText.includes('背包')) { togglePanel('inventory'); }
    } else {
        if(msgEl) msgEl.innerText = `🚜 目前農場裡沒有成熟的作物可以收成喔！`;
    }
}

function autoPlant() {
    let cost = SEED_DATA[currentSeed].cost;
    let emptyTiles = [];
    for(let y=0; y<ROWS; y++) {
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
            t.plant = true; t.type = currentSeed; t.progress = 0;
            count++;
        } else { break; }
    }
    
    let msgEl = document.getElementById('marquee-msg');
    if(count > 0) { 
        updateUI(); saveGame(); 
        if(msgEl) msgEl.innerText = `🌱 成功一鍵播種了 ${count} 個 ${SEED_DATA[currentSeed].name}！`;
    } else if (gameState.coins < cost) {
        if(msgEl) msgEl.innerText = `💰 金幣不足！裝備的 ${SEED_DATA[currentSeed].name} 每個需要 ${cost} 金幣。`;
    } else {
        if(msgEl) msgEl.innerText = `🌱 農場已經客滿，沒有空地可以播種囉！`;
    }
}

function equipSeed(type) { currentSeed = type; updateUI(); togglePanel('shop'); }
function switchPet(petId) { gameState.currentPet = petId; updateUI(); togglePanel(); saveGame(); }

function buyPet(petId) {
    if (petId === 'cat' && !gameState.isPro) {
        showPaywall("解鎖最強寵物「比比拉布」是專業版專屬福利喔！");
        togglePanel(); 
        return;
    }
    let cost = PET_DATA[petId].cost;
    if (gameState.coins >= cost) {
        gameState.coins -= cost;
        gameState.petsOwned.push(petId);
        switchPet(petId); loadQuestion(); 
    } else {
        alert("金幣不足！需要 💰" + cost);
    }
}

// 🔥 背包面板加入「全餵」按鈕與 2x2 網格排版 🔥
function togglePanel(type) {
    const p = document.getElementById('floating-panel');
    if (!type) { p.classList.add('hidden'); return; }
    p.classList.remove('hidden');
    if (type === 'inventory') {
        const pTitle = document.getElementById('panel-title');
        if(pTitle) pTitle.innerText = '背包：' + PET_DATA[gameState.currentPet].title;
        let invHTML = `<div style="display:flex; gap:10px; margin-bottom:10px; border-bottom: 2px solid #eee; padding-bottom: 10px;">
            <button onclick="autoHarvest()" style="flex:1; background:#9b59b6; padding:10px; border-radius:8px; color:white; font-weight:bold; cursor:pointer; border:none;">🚜 一鍵收成</button>
        </div>`;
        let hasItem = false;
        for (let key in SEED_DATA) {
            let count = gameState.inventory[key] || 0;
            if (count > 0) { 
                hasItem = true;
                invHTML += `<div class="shop-item" style="flex-wrap: wrap; margin-bottom: 10px; padding-bottom: 15px; border-bottom: 1px dashed #ccc;">
                    <span style="width: 100%; font-weight: bold; margin-bottom: 10px; display: block; font-size: 1.1em; color: #2c3e50;">${SEED_DATA[key].name} x ${count}</span>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; width: 100%;">
                        <button onclick="feedPig('${key}')" style="background:#8bc34a;">餵 1</button>
                        <button onclick="feedAllOf('${key}')" style="background:#27ae60;">全餵</button>
                        <button onclick="sellPlant('${key}')" style="background:#f39c12;">賣 1</button>
                        <button onclick="sellAllOf('${key}')" style="background:#e74c3c;">全賣</button>
                    </div>
                </div>`;
            }
        }
        document.getElementById('panel-body').innerHTML = hasItem ? invHTML : invHTML + "<p style='text-align:center; color:#777; margin-top:20px;'>背包空空的</p>";
} else if (type === 'shop') {
        const pTitle = document.getElementById('panel-title');
        if(pTitle) pTitle.innerText = '種子商城';
        let shopHTML = `<div style="margin-bottom:10px; border-bottom: 2px solid #eee; padding-bottom: 10px;">
            <button onclick="autoPlant()" style="width:100%; background:#27ae60; padding:12px; border-radius:8px; color:white; font-weight:bold; cursor:pointer; border:none; font-size:1em;">🌱 一鍵播種</button>
        </div>`;
        for (let key in SEED_DATA) {
            let seed = SEED_DATA[key];
            let isUnlocked = gameState.petStats.pig.lv >= seed.unlockLv; 
            
            // 🔥 視覺設計師優化：動態按鈕狀態配色 🔥
            let btnBg = !isUnlocked ? '#bdc3c7' : (currentSeed === key ? '#f1c40f' : '#3498db');
            let btnColor = (currentSeed === key) ? '#d35400' : 'white';
            let btnText = isUnlocked ? (currentSeed === key ? '✔ 裝備中' : '裝備') : '🔒 未解鎖';
            let extraStyle = currentSeed === key ? 'box-shadow: 0 0 12px rgba(241, 196, 15, 0.8); transform: scale(1.05); border: 2px solid #e67e22;' : '';

            shopHTML += `<div class="shop-item" style="padding: 10px 0;">
                <span>${seed.name} (💰${seed.cost}) <br><small style="color:#7f8c8d;">${isUnlocked ? '已解鎖' : `神豬 Lv.${seed.unlockLv} 解鎖`}</small></span>
                <button onclick="equipSeed('${seed.id}')" ${!isUnlocked?'disabled':''} style="background: ${btnBg}; color: ${btnColor}; transition: 0.2s; ${extraStyle}">${btnText}</button>
            </div>`;
        }
        document.getElementById('panel-body').innerHTML = shopHTML;
    } else if (type === 'pet') {
        const pTitle = document.getElementById('panel-title');
        if(pTitle) pTitle.innerText = '寵物招募';
        let petHTML = "";
        for (let key in PET_DATA) {
            let pData = PET_DATA[key];
            let isOwned = gameState.petsOwned.includes(key);
            let isCurrent = gameState.currentPet === key;
            if (isOwned) {
                petHTML += `<div class="shop-item" style="background: ${isCurrent ? '#e8f5e9' : 'transparent'};"><span style="font-weight:bold;">${pData.title} <br><small>Lv.${gameState.petStats[key].lv}</small></span><button onclick="switchPet('${key}')" ${isCurrent?'disabled':''} style="background: ${isCurrent ? '#999' : '#3498db'}">${isCurrent ? '指定' : '選擇'}</button></div>`;
            } else {
                let costText = (key === 'cat' && !gameState.isPro) ? "🔒 PRO專屬" : `💰${pData.cost}`;
                let btnColor = (key === 'cat' && !gameState.isPro) ? "#95a5a6" : "#e74c3c";
                petHTML += `<div class="shop-item" style="background: #fdf2e9;"><span style="font-weight:bold;">${pData.title} <br><small>${pData.desc}</small></span><button onclick="buyPet('${key}')" style="background: ${btnColor}">${costText}</button></div>`;
            }
        }
        document.getElementById('panel-body').innerHTML = petHTML;
    }
}

function updateUI() {
    const coinEl = document.getElementById('coin-count');
    if(coinEl) coinEl.innerText = Math.floor(gameState.coins);
    
    const proBadge = document.getElementById('pro-badge');
    if (gameState.isPro) { 
        document.body.classList.add('is-pro');
        if (proBadge) proBadge.classList.remove('hidden'); 
    } else { 
        document.body.classList.remove('is-pro');
        if (proBadge) proBadge.classList.add('hidden'); 
    }
    
    let energyFill = document.getElementById('energy-fill');
    if(energyFill) {
        energyFill.style.width = gameState.energy + "%";
        if (gameState.energy >= 90) { 
            energyFill.style.background = "#f1c40f"; 
            energyFill.style.boxShadow = "0 0 10px #f1c40f"; 
        } else { 
            energyFill.style.background = "#e67e22"; 
            energyFill.style.boxShadow = "none"; 
        }
    }
    
    const energyNum = document.getElementById('energy-num');
    if (energyNum) energyNum.innerText = Math.floor(gameState.energy);
    
    let cp = gameState.currentPet;
    let stat = gameState.petStats[cp];
    
    const expFill = document.getElementById('exp-fill');
    if(expFill) expFill.style.width = (stat.exp / (stat.lv * 100) * 100) + "%";
    
    const pigLv = document.getElementById('pig-lv');
    if(pigLv) pigLv.innerText = stat.lv;
    
    const playerName = document.getElementById('player-name-display');
    if(playerName) playerName.innerText = currentUser + " 的 " + PET_DATA[cp].title;
    
    let petImgKey = cp + "_Down";
    if (!images[petImgKey] || !images[petImgKey].isLoaded) petImgKey = "pig_Down";
    
    const pigImg = document.getElementById('pig-img');
    if (pigImg && images[petImgKey] && images[petImgKey].isLoaded) { 
        pigImg.src = images[petImgKey].src; 
        pigImg.style.display = 'block'; 
    }

// ==========================================
// 🔥 遊戲內建懸浮通知 (取代醜陋的 alert) 🔥
// ==========================================
function showToast(msg, type = 'info') {
    let toast = document.getElementById('game-toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'game-toast';
        document.body.appendChild(toast);
    }
    toast.innerText = msg;
    // 重置 class 並加上對應的顏色
    toast.className = `toast-show toast-${type}`;
    
    // 2.5 秒後自動消失
    setTimeout(() => {
        toast.classList.remove('toast-show');
    }, 2500);
}

// 覆寫買寵物、驗證碼的 alert (讓全遊戲統一)
window.alert = function(msg) { showToast(msg, 'info'); };

// ==========================================
// 🔥 地獄特訓關卡 (視覺回饋升級版) 🔥
// ==========================================
const REVIEW_THRESHOLD = 30; // 30 題觸發
let forcedReviewQueue = [];
let currentForcedWord = null;

function checkForcedReview() {
    let mistakeCount = Object.keys(gameState.mistakes).length;
    if (mistakeCount >= REVIEW_THRESHOLD) {
        startForcedReview();
    }
}

const originalLoadQuestion = loadQuestion;
loadQuestion = function() {
    originalLoadQuestion();
    checkForcedReview();
};

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
        saveGame();
        updateUI();
        return;
    }

    currentForcedWord = forcedReviewQueue[0];
    document.getElementById('forced-word-display').innerText = currentForcedWord.w;
    document.getElementById('forced-progress').innerText = `剩餘：${forcedReviewQueue.length} 題`;

    // 清除可能殘留的「下一題」按鈕
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
        btn.style.padding = "15px";
        btn.style.fontSize = "1.1em";
        btn.style.fontWeight = "bold";
        btn.style.border = "2px solid #bdc3c7";
        btn.style.borderRadius = "12px";
        btn.style.backgroundColor = "white";
        btn.style.cursor = "pointer";
        btn.style.transition = "0.2s";
        btn.style.color = "#2c3e50";
        
        if (o === currentForcedWord.c) {
            btn.dataset.correct = "true";
        }

        btn.onclick = () => {
            Array.from(grid.children).forEach(b => b.disabled = true);

            if (o === currentForcedWord.c) {
                // 答對了：亮綠燈，給予 0.5 秒成就感後自動換下一題 (保持流暢節奏)
                btn.style.backgroundColor = "#2ecc71";
                btn.style.color = "white";
                btn.style.borderColor = "#27ae60";
                
                forcedReviewQueue.shift(); 
                if (gameState.mistakes[currentForcedWord.w]) {
                    gameState.mistakes[currentForcedWord.w].count--;
                    if (gameState.mistakes[currentForcedWord.w].count <= 0) {
                        delete gameState.mistakes[currentForcedWord.w];
                    }
                }
                saveGame();
                setTimeout(() => { loadForcedReviewQuestion(); }, 500); 
                
            } else {
                // 答錯了：亮紅燈，顯示正確答案
                btn.style.backgroundColor = "#e74c3c";
                btn.style.color = "white";
                btn.style.borderColor = "#c0392b";

                let correctBtn = Array.from(grid.children).find(b => b.dataset.correct === "true");
                if (correctBtn) {
                    correctBtn.style.backgroundColor = "#2ecc71";
                    correctBtn.style.color = "white";
                    correctBtn.style.borderColor = "#27ae60";
                }

                const modalBox = document.querySelector('#forced-review-modal > div');
                modalBox.classList.add('shake-animation');
                setTimeout(() => modalBox.classList.remove('shake-animation'), 500);

                showToast("❌ 答錯了！請記住正確的中文意思。", "error");
                
                let w = forcedReviewQueue.shift();
                forcedReviewQueue.push(w); // 塞回最後面
                
                // 🔥 視覺設計師優化：動態生成「下一題」按鈕，讓學生自己決定何時跳轉 🔥
                let nextBtn = document.createElement('button');
                nextBtn.id = 'forced-next-btn';
                nextBtn.innerText = "記住了，下一題 ➔";
                nextBtn.style.marginTop = "20px";
                nextBtn.style.padding = "15px";
                nextBtn.style.fontSize = "1.2em";
                nextBtn.style.fontWeight = "bold";
                nextBtn.style.backgroundColor = "#34495e";
                nextBtn.style.color = "white";
                nextBtn.style.border = "none";
                nextBtn.style.borderRadius = "12px";
                nextBtn.style.cursor = "pointer";
                nextBtn.style.width = "100%";
                nextBtn.style.boxShadow = "0 5px 0 #2c3e50";
                nextBtn.style.transition = "0.1s";
                
                nextBtn.onmousedown = () => { 
                    nextBtn.style.transform = "translateY(5px)"; 
                    nextBtn.style.boxShadow = "none"; 
                };
                nextBtn.onclick = () => {
                    loadForcedReviewQuestion(); // 玩家點擊後才載入下一題
                };
                
                // 把按鈕加到考卷面板的最後面
                grid.parentElement.appendChild(nextBtn);
            }
        };
        grid.appendChild(btn);
    });
}
}

loadAssets();