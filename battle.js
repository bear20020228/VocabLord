// ==========================================
// ⚔️ 史詩戰鬥系統 (battle.js)
// ==========================================

const battleVocab = [
    { w: 'luggage', c: '行李', ety: '來自代表「用力拖拉」的單音節動詞。旅行時必須一直用力拖拉的東西。' },
    { w: 'cabin', c: '小木屋 / 機艙', ety: '諧音法：雪地裡車子「卡冰」動不了時，最需要去哪避寒？' },
    { w: 'customs', c: '海關', ety: '由「習俗」演變而來。帶著各地的習俗過境，都要被查。' },
    { w: 'obsess', c: '著迷 / 困擾', ety: '字根 ob (對面) + sess (坐)。念頭一直「坐在你對面」盯著你。' },
    { w: 'distinguish', c: '區分', ety: '字根 dis (分開) + sting (刺)。用針把東西「刺開、挑出來」。' }
];

// 你可以把檔名換成你實際上傳的圖片檔名
const stages = [
    { name: "迷霧森林", bg: "assets/bg_forest.jpg", boss: "森林石魔", sprite: "assets/monster_yeti.png", hp: 5 },
    { name: "古老遺跡", bg: "assets/bg_ruins.jpg", boss: "遠古守衛", sprite: "assets/monster_yeti.png", hp: 8 },
    { name: "深淵王座", bg: "assets/bg_castle.jpg", boss: "魔王幻影", sprite: "assets/monster_yeti.png", hp: 12 }
];

let currentStageLevel = 0;
let bossMaxHp = 5;
let currentBossHp = 5;
let currentWord = null;
let hintStage = 0;

// 寵物技能 CD 系統
const MAX_CD = 3;
let currentCd = MAX_CD;

// --- 綁定進入與離開戰鬥 ---
// 請在你的 script.js 裡面，把漩渦點擊事件改成呼叫 startTosBattle()
window.startTosBattle = function() {
    document.getElementById('rpg-battle-screen').classList.remove('hidden');
    loadStage(0);
};

document.getElementById('btn-flee-rpg').addEventListener('click', () => {
    document.getElementById('rpg-battle-screen').classList.add('hidden');
});

// --- 戰鬥核心邏輯 ---
function loadStage(level) {
    if (level >= stages.length) {
        alert("🎉 恭喜通關所有層數！");
        document.getElementById('rpg-battle-screen').classList.add('hidden');
        return;
    }
    
    currentStageLevel = level;
    let stageData = stages[level];
    
    document.querySelector('.rpg-stage-info').innerText = `字源深淵 - ${stageData.name}`;
    document.getElementById('rpg-stage').style.backgroundImage = `url('${stageData.bg}')`;
    document.getElementById('rpg-enemy-name').innerText = stageData.boss;
    document.getElementById('rpg-enemy-sprite').src = stageData.sprite;
    
    bossMaxHp = stageData.hp;
    currentBossHp = bossMaxHp;
    
    // 重置技能 CD
    currentCd = MAX_CD;
    updateSkillUI();
    updateHpUI();
    loadQuestion();
}

function updateHpUI() {
    let fill = document.getElementById('rpg-enemy-hp-fill');
    let text = document.getElementById('rpg-hp-text');
    fill.style.width = (currentBossHp / bossMaxHp * 100) + "%";
    text.innerText = `${currentBossHp} / ${bossMaxHp}`;
}

function updateSkillUI() {
    let skillBtn = document.getElementById('rpg-skill-btn');
    let cdText = document.getElementById('rpg-skill-cd');
    let skillName = document.getElementById('rpg-skill-name');
    
    if (currentCd <= 0) {
        skillBtn.classList.add('skill-ready');
        cdText.innerText = "READY";
        skillName.innerText = "🌟 絕招就緒！點擊頭像施放！";
        skillName.style.color = "#2ecc71";
    } else {
        skillBtn.classList.remove('skill-ready');
        cdText.innerText = `CD: ${currentCd}`;
        skillName.innerText = "寵物技能：蓄力中";
        skillName.style.color = "#f1c40f";
    }
}

function loadQuestion() {
    currentWord = battleVocab[Math.floor(Math.random() * battleVocab.length)];
    
    document.getElementById('rpg-word-meaning').innerText = currentWord.c;
    document.getElementById('rpg-word-hint').innerHTML = `💡 提示：${currentWord.ety}`;
    
    hintStage = 0;
    document.getElementById('rpg-word-hint').classList.add('hidden');
    
    let helpBtn = document.getElementById('rpg-btn-help');
    helpBtn.innerText = "💡 討救兵";
    helpBtn.style.background = "#34495e";
    
    let inputEl = document.getElementById('rpg-spell-input');
    inputEl.placeholder = currentWord.w.split('').map(() => '_').join(' ');
    inputEl.value = '';
    inputEl.disabled = false;
    inputEl.focus();
}

// --- 攻擊判定 ---
function processAttack(damage, isSkill = false) {
    let boss = document.getElementById('rpg-enemy-sprite');
    let fx = document.getElementById('rpg-fx-layer');
    let inputEl = document.getElementById('rpg-spell-input');
    
    // 播放特效 (如果是技能，放魔法陣；如果是普攻，放斬擊)
    fx.classList.remove('hidden');
    fx.style.backgroundImage = isSkill ? "url('assets/skill_magic_circle.png')" : "url('assets/skill_slash.png')";
    
    // 讓特效閃爍一下
    fx.style.animation = "slashAnim 0.5s ease-out forwards";
    setTimeout(() => { fx.style.animation = ""; fx.classList.add('hidden'); }, 500);

    boss.classList.add('monster-hurt');
    setTimeout(() => boss.classList.remove('monster-hurt'), 400);

    currentBossHp -= damage;
    if (currentBossHp < 0) currentBossHp = 0;
    updateHpUI();

    inputEl.style.borderColor = "#2ecc71";
    inputEl.disabled = true;

    if (currentBossHp <= 0) {
        setTimeout(() => loadStage(currentStageLevel + 1), 1000);
    } else {
        setTimeout(loadQuestion, 800);
    }
}

document.getElementById('rpg-btn-attack').addEventListener('click', () => {
    let inputEl = document.getElementById('rpg-spell-input');
    if (inputEl.disabled) return;
    
    let userAnswer = inputEl.value.trim().toLowerCase();
    
    if (userAnswer === currentWord.w.toLowerCase()) {
        // 答對了，扣減 CD
        if (currentCd > 0) {
            currentCd--;
            updateSkillUI();
        }
        processAttack(1, false);
    } else {
        // 答錯震動
        inputEl.style.animation = "monsterShake 0.3s both";
        inputEl.style.borderColor = "#e74c3c";
        setTimeout(() => { inputEl.style.animation = ""; }, 300);
    }
});

document.getElementById('rpg-spell-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') document.getElementById('rpg-btn-attack').click();
});

// --- 點擊頭像放絕招 ---
document.getElementById('rpg-skill-btn').addEventListener('click', () => {
    if (currentCd <= 0) {
        // 施放絕招：造成 3 點大傷害，不用打字直接換題！
        document.getElementById('rpg-spell-input').value = "🔥 魔法爆發 🔥";
        processAttack(3, true);
        
        // 重新計算 CD
        currentCd = MAX_CD;
        updateSkillUI();
    }
});

// --- 討救兵機制 ---
document.getElementById('rpg-btn-help').addEventListener('click', () => {
    let inputEl = document.getElementById('rpg-spell-input');
    let helpBtn = document.getElementById('rpg-btn-help');
    
    if (hintStage === 0) {
        document.getElementById('rpg-word-hint').classList.remove('hidden');
        helpBtn.innerText = "🏳️ 看答案";
        helpBtn.style.background = "#e74c3c";
        hintStage = 1;
        inputEl.focus();
    } else {
        inputEl.value = currentWord.w;
        inputEl.disabled = true;
        setTimeout(loadQuestion, 1500);
    }
});

// 在 CSS 補上特效動畫
const style = document.createElement('style');
style.innerHTML = `@keyframes slashAnim { 0% { transform: translate(-50%, -50%) scale(0.5); opacity: 1; } 100% { transform: translate(-50%, -50%) scale(1.5); opacity: 0; } }`;
document.head.appendChild(style);