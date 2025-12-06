﻿// game.js - 推箱子游戏主逻辑

// ============== 音效管理器 ==============
class SoundManager {
    constructor() {
        this.sounds = {};
        this.enabled = true;
        this.initSounds();
    }
    
    initSounds() {
        // 创建音效
        this.sounds = {
            move: this.createMoveSound(),
            push: this.createPushSound(),
            win: this.createWinSound(),
            undo: this.createUndoSound(),
            reset: this.createResetSound()
        };
    }
    
    createMoveSound() {
        return this.createBeep(800, 0.05);
    }
    
    createPushSound() {
        return this.createBeep(400, 0.1);
    }
    
    createWinSound() {
        const context = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator1 = context.createOscillator();
        const oscillator2 = context.createOscillator();
        const gainNode = context.createGain();
        
        oscillator1.connect(gainNode);
        oscillator2.connect(gainNode);
        gainNode.connect(context.destination);
        
        oscillator1.frequency.value = 523.25; // C5
        oscillator2.frequency.value = 659.25; // E5
        gainNode.gain.value = 0.1;
        
        const startTime = context.currentTime;
        oscillator1.start(startTime);
        oscillator2.start(startTime);
        
        oscillator1.stop(startTime + 0.3);
        oscillator2.stop(startTime + 0.3);
        
        return { oscillator1, oscillator2, gainNode, context };
    }
    
    createUndoSound() {
        return this.createBeep(300, 0.08);
    }
    
    createResetSound() {
        return this.createBeep(200, 0.15);
    }
    
    createBeep(frequency, duration) {
        const context = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = context.createOscillator();
        const gainNode = context.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(context.destination);
        
        oscillator.frequency.value = frequency;
        gainNode.gain.value = 0.1;
        
        const startTime = context.currentTime;
        oscillator.start(startTime);
        
        // 淡出效果
        gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
        oscillator.stop(startTime + duration);
        
        return { oscillator, gainNode, context };
    }
    
    play(soundName) {
        if (!this.enabled) return;
        
        switch(soundName) {
            case 'move':
                this.createMoveSound();
                break;
            case 'push':
                this.createPushSound();
                break;
            case 'win':
                this.createWinSound();
                break;
            case 'undo':
                this.createUndoSound();
                break;
            case 'reset':
                this.createResetSound();
                break;
        }
    }
    
    toggle() {
        this.enabled = !this.enabled;
        return this.enabled;
    }
}

// 创建音效管理器实例
const soundManager = new SoundManager();

// ============== 游戏状态 ==============
let currentLevel = 0;
let steps = 0;
let gameState = [];
let playerPos = { x: 0, y: 0 };
let moveHistory = [];
const MAX_HISTORY = 20;

// 游戏统计数据
let gameStats = {
    bestSteps: Array(levels.length).fill(0),
    bestTime: Array(levels.length).fill(0),
    completed: Array(levels.length).fill(false)
};

// 计时器相关
let currentTimer = 0;
let timerInterval = null;
let isTimerRunning = false;

// 游戏元素定义：
// 0: 空地, 1: 墙, 2: 箱子, 3: 目标点, 4: 玩家, 5: 箱子在目标点, 6: 玩家在目标点

// ============== DOM元素 ==============
const gameBoard = document.getElementById('game-board');
const currentLevelElement = document.getElementById('current-level');
const totalLevelsElement = document.getElementById('total-levels');
const stepsElement = document.getElementById('steps');
const boxesElement = document.getElementById('boxes');
const resetBtn = document.getElementById('reset-btn');
const prevBtn = document.getElementById('prev-btn');
const nextBtn = document.getElementById('next-btn');
const undoBtn = document.getElementById('undo-btn');
const winModal = document.getElementById('win-modal');
const winLevelElement = document.getElementById('win-level');
const winStepsElement = document.getElementById('win-steps');
const winBoxesElement = document.getElementById('win-boxes');
const nextLevelBtn = document.getElementById('next-level-btn');
const closeModalBtn = document.getElementById('close-modal-btn');

// 键盘元素
const keyUp = document.getElementById('key-up');
const keyDown = document.getElementById('key-down');
const keyLeft = document.getElementById('key-left');
const keyRight = document.getElementById('key-right');

// 关卡选择器
const levelSelector = document.getElementById('level-selector');

// 音效按钮
const soundBtn = document.getElementById('sound-btn');

// ============== 游戏初始化 ==============
function initGame() {
    // 显示总关卡数
    totalLevelsElement.textContent = levels.length;
    
    // 加载游戏进度
    loadGameProgress();
    
    // 创建关卡选择器
    createLevelSelector();
    
    // 创建计时器显示
    createTimerDisplay();
    
    // 加载第一关
    loadLevel(currentLevel);
    
    // 初始化事件监听
    initEventListeners();
    
    // 创建进度显示
    updateProgressDisplay();
    
    // 更新音效按钮状态
    updateSoundButton();
    
    console.log("游戏初始化完成");
}

// ============== 创建关卡选择器 ==============
function createLevelSelector() {
    levelSelector.innerHTML = '';
    
    levels.forEach((level, index) => {
        const option = document.createElement('option');
        option.value = index;
        option.textContent = `${index + 1}. ${level.name}`;
        
        // 如果关卡已完成，添加标记
        if (gameStats.completed[index]) {
            option.textContent += ' ✓';
            option.style.color = '#4caf50';
        }
        
        levelSelector.appendChild(option);
    });
    
    levelSelector.value = currentLevel;
}

// ============== 创建计时器显示 ==============
function createTimerDisplay() {
    const timerContainer = document.createElement('div');
    timerContainer.className = 'timer-container';
    timerContainer.innerHTML = `
        <span class="info-label">时间:</span>
        <span class="timer" id="timer">00:00</span>
    `;
    
    // 插入到游戏信息区域
    const gameInfo = document.querySelector('.game-info');
    gameInfo.insertBefore(timerContainer, gameInfo.querySelector('.info-item'));
}

// ============== 计时器控制 ==============
function startTimer() {
    if (isTimerRunning) return;
    
    isTimerRunning = true;
    currentTimer = 0;
    updateTimerDisplay();
    
    timerInterval = setInterval(() => {
        currentTimer++;
        updateTimerDisplay();
    }, 1000);
}

function stopTimer() {
    isTimerRunning = false;
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
}

function resetTimer() {
    stopTimer();
    currentTimer = 0;
    updateTimerDisplay();
}

function updateTimerDisplay() {
    const minutes = Math.floor(currentTimer / 60);
    const seconds = currentTimer % 60;
    const timerElement = document.getElementById('timer');
    if (timerElement) {
        timerElement.textContent = 
            `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
}

// ============== 加载关卡 ==============
function loadLevel(levelIndex) {
    // 停止当前计时器
    stopTimer();
    
    currentLevel = levelIndex;
    currentLevelElement.textContent = currentLevel + 1;
    
    // 更新关卡选择器
    if (levelSelector) {
        levelSelector.value = currentLevel;
    }
    
    // 重置游戏状态
    const level = levels[levelIndex];
    gameState = JSON.parse(JSON.stringify(level.grid));
    
    // 重置步数
    steps = 0;
    stepsElement.textContent = steps;
    
    // 重置移动历史
    moveHistory = [];
    
    // 查找玩家位置
    findPlayerPosition();
    
    // 渲染游戏板
    renderGameBoard();
    
    // 更新UI
    updateUI();
    
    // 更新进度显示
    updateProgressDisplay();
    
    // 重置并开始计时
    resetTimer();
    startTimer();
    
    console.log(`加载关卡 ${currentLevel + 1}: ${level.name}`);
}

// ============== 查找玩家位置 ==============
function findPlayerPosition() {
    for (let y = 0; y < gameState.length; y++) {
        for (let x = 0; x < gameState[y].length; x++) {
            if (gameState[y][x] === 4 || gameState[y][x] === 6) {
                playerPos = { x, y };
                return;
            }
        }
    }
}

// ============== 渲染游戏板 ==============
function renderGameBoard() {
    gameBoard.innerHTML = '';
    
    const rows = gameState.length;
    const cols = gameState[0].length;
    
    // 设置网格布局
    gameBoard.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
    gameBoard.style.gridTemplateRows = `repeat(${rows}, 1fr)`;
    
    // 创建单元格
    for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
            const cell = document.createElement('div');
            cell.className = 'cell';
            cell.dataset.x = x;
            cell.dataset.y = y;
            
            const cellType = gameState[y][x];
            
            // 根据单元格类型设置图标和样式
            switch (cellType) {
                case 0: // 空地
                    break;
                case 1: // 墙
                    cell.classList.add('wall');
                    cell.innerHTML = '<i class="fas fa-border-all"></i>'; // 使用网格图标
                    break;
                case 2: // 箱子
                    cell.classList.add('box');
                    cell.innerHTML = '<i class="fas fa-cube"></i>'; // 使用方块图标
                    break;
                case 3: // 目标点
                    cell.classList.add('target');
                    cell.innerHTML = '<i class="fas fa-star"></i>'; // 使用星星图标
                    break;
                case 4: // 玩家
                    cell.classList.add('player');
                    cell.innerHTML = '<i class="fas fa-user"></i>'; // 使用用户图标
                    break;
                case 5: // 箱子在目标点上
                    cell.classList.add('box-on-target');
                    cell.innerHTML = '<i class="fas fa-check-square"></i>'; // 使用勾选方块图标
                    break;
                case 6: // 玩家在目标点上
                    cell.classList.add('player');
                    cell.classList.add('target');
                    cell.innerHTML = '<i class="fas fa-user-check"></i>'; // 使用勾选用户图标
                    break;
            }
            
            gameBoard.appendChild(cell);
        }
    }
}

// ============== 更新UI ==============
function updateUI() {
    // 计算箱子状态
    let totalBoxes = 0;
    let boxesOnTarget = 0;
    
    for (let y = 0; y < gameState.length; y++) {
        for (let x = 0; x < gameState[y].length; x++) {
            if (gameState[y][x] === 2) totalBoxes++;
            if (gameState[y][x] === 5) {
                totalBoxes++;
                boxesOnTarget++;
            }
        }
    }
    
    boxesElement.textContent = `${boxesOnTarget}/${totalBoxes}`;
}

// ============== 移动玩家 ==============
function movePlayer(dx, dy) {
    const newX = playerPos.x + dx;
    const newY = playerPos.y + dy;
    
    // 检查边界
    if (newX < 0 || newY < 0 || newY >= gameState.length || newX >= gameState[newY].length) {
        return false;
    }
    
    const targetCell = gameState[newY][newX];
    
    // 如果是墙，不能移动
    if (targetCell === 1) {
        return false;
    }
    
    let moved = false;
    
    // 如果是箱子，检查是否能推动
    if (targetCell === 2 || targetCell === 5) {
        const boxNewX = newX + dx;
        const boxNewY = newY + dy;
        
        // 检查箱子新位置
        if (boxNewX < 0 || boxNewY < 0 || 
            boxNewY >= gameState.length || 
            boxNewX >= gameState[boxNewY].length) {
            return false;
        }
        
        const boxTargetCell = gameState[boxNewY][boxNewX];
        
        // 箱子新位置必须是空地、目标点或玩家在目标点
        if (boxTargetCell !== 0 && boxTargetCell !== 3 && boxTargetCell !== 6) {
            return false;
        }
        
        // 保存状态到历史
        saveStateToHistory();
        
        // 移动箱子到新位置
        if (boxTargetCell === 0) {
            gameState[boxNewY][boxNewX] = 2; // 箱子移到空地
        } else if (boxTargetCell === 3 || boxTargetCell === 6) {
            gameState[boxNewY][boxNewX] = 5; // 箱子移到目标点
        }
        
        // 正确更新原箱子位置
        if (targetCell === 2) {
            // 箱子原来在空地上
            gameState[newY][newX] = 0;
        } else if (targetCell === 5) {
            // 箱子原来在目标点上
            gameState[newY][newX] = 3; // 恢复为目标点
        }
        
        moved = true;
        
        // 播放推动音效
        soundManager.play('push');
        
        console.log(`推动箱子: 从(${newX},${newY}) 到(${boxNewX},${boxNewY})`);
    }
    
    // 移动玩家
    if (moved || targetCell === 0 || targetCell === 3 || targetCell === 6) {
        if (!moved) {
            saveStateToHistory();
            // 播放移动音效
            soundManager.play('move');
        }
        
        // 更新原玩家位置
        const currentPlayerCell = gameState[playerPos.y][playerPos.x];
        if (currentPlayerCell === 4) {
            gameState[playerPos.y][playerPos.x] = 0; // 玩家原位置变为空地
        } else if (currentPlayerCell === 6) {
            gameState[playerPos.y][playerPos.x] = 3; // 玩家在目标点上离开，恢复为目标点
        }
        
        // 更新新玩家位置
        const newPositionCell = gameState[newY][newX];
        if (newPositionCell === 0 || newPositionCell === 2) {
            // 玩家移到空地或箱子原来的位置（箱子已移动，现在是空地）
            gameState[newY][newX] = 4;
        } else if (newPositionCell === 3) {
            // 玩家移到目标点
            gameState[newY][newX] = 6;
        } else if (newPositionCell === 5) {
            // 这种情况不应该发生，箱子已经移动了
            gameState[newY][newX] = 4;
        }
        
        playerPos.x = newX;
        playerPos.y = newY;
        
        // 增加步数
        steps++;
        stepsElement.textContent = steps;
        
        // 重新渲染
        renderGameBoard();
        updateUI();
        
        // 更新键盘高亮
        highlightKey(dx, dy);
        
        // 添加移动反馈动画
        showMoveFeedback(dx, dy);
        
        // 检查是否获胜
        if (checkWinCondition()) {
            stopTimer();
            saveLevelCompletion();
            showWinModal();
        }
        
        return true;
    }
    
    return false;
}

// ============== 移动反馈动画 ==============
function showMoveFeedback(dx, dy) {
    // 高亮移动方向
    highlightKey(dx, dy);
    
    // 给玩家添加动画
    const playerCell = document.querySelector(`.cell[data-x="${playerPos.x}"][data-y="${playerPos.y}"]`);
    if (playerCell) {
        playerCell.classList.add('move-success');
        setTimeout(() => {
            playerCell.classList.remove('move-success');
        }, 300);
    }
}

// ============== 游戏状态管理 ==============
function saveStateToHistory() {
    const state = {
        gameState: JSON.parse(JSON.stringify(gameState)),
        playerPos: { ...playerPos },
        steps: steps,
        timer: currentTimer
    };
    
    moveHistory.push(state);
    
    if (moveHistory.length > MAX_HISTORY) {
        moveHistory.shift();
    }
}

// 撤销上一步
function undoMove() {
    if (moveHistory.length === 0) {
        // 添加视觉反馈
        undoBtn.style.backgroundColor = '#ff4444';
        undoBtn.style.transform = 'translateX(-5px)';
        setTimeout(() => {
            undoBtn.style.backgroundColor = '';
            undoBtn.style.transform = '';
        }, 300);
        return;
    }
    
    const lastState = moveHistory.pop();
    gameState = lastState.gameState;
    playerPos = lastState.playerPos;
    steps = lastState.steps;
    currentTimer = lastState.timer || currentTimer;
    
    // 播放撤销音效
    soundManager.play('undo');
    
    stepsElement.textContent = steps;
    updateTimerDisplay();
    renderGameBoard();
    updateUI();
    
    console.log("撤销上一步操作");
}

// ============== 获胜条件检查 ==============
function checkWinCondition() {
    const level = levels[currentLevel];
    let targetsToCover = 0;
    let coveredTargets = 0;
    
    for (let y = 0; y < level.grid.length; y++) {
        for (let x = 0; x < level.grid[y].length; x++) {
            const originalCell = level.grid[y][x];
            const currentCell = gameState[y][x];
            
            // 统计需要覆盖的目标点
            if (originalCell === 3) {  // 原始是目标点
                targetsToCover++;
                if (currentCell === 5) {  // 现在箱子在目标点上
                    coveredTargets++;
                }
            }
            // 如果原始就是箱子在目标点上(5)，它已经完成了
            else if (originalCell === 5) {
                targetsToCover++;
                if (currentCell === 5) {  // 必须保持箱子在目标点上
                    coveredTargets++;
                }
            }
        }
    }
    
    console.log(`目标点覆盖: ${coveredTargets}/${targetsToCover}`);
    return coveredTargets === targetsToCover && targetsToCover > 0;
}

// ============== 键盘控制 ==============
function highlightKey(dx, dy) {
    // 移除所有高亮
    [keyUp, keyDown, keyLeft, keyRight].forEach(key => {
        key.classList.remove('active');
    });
    
    // 高亮对应的键
    if (dx === 0 && dy === -1) {
        keyUp.classList.add('active');
    } else if (dx === 0 && dy === 1) {
        keyDown.classList.add('active');
    } else if (dx === -1 && dy === 0) {
        keyLeft.classList.add('active');
    } else if (dx === 1 && dy === 0) {
        keyRight.classList.add('active');
    }
    
    // 0.3秒后取消高亮
    setTimeout(() => {
        [keyUp, keyDown, keyLeft, keyRight].forEach(key => {
            key.classList.remove('active');
        });
    }, 300);
}

// ============== 新增：进度显示 ==============
function updateProgressDisplay() {
    // 计算总体进度
    let completedLevels = gameStats.completed.filter(c => c).length;
    let totalLevels = levels.length;
    let progress = totalLevels > 0 ? (completedLevels / totalLevels) * 100 : 0;
    
    // 创建或更新进度条
    let progressContainer = document.querySelector('.progress-container');
    if (!progressContainer) {
        progressContainer = document.createElement('div');
        progressContainer.className = 'progress-container';
        
        // 插入到侧边栏底部
        const sidebar = document.querySelector('.game-sidebar');
        if (sidebar) {
            sidebar.appendChild(progressContainer);
        }
    }
    
    progressContainer.innerHTML = `
        <div class="progress-bar">
            <div class="progress-fill" style="width: ${progress}%"></div>
        </div>
        <div class="progress-text">
            进度: ${completedLevels}/${totalLevels} 关 (${Math.round(progress)}%)
        </div>
    `;
}

// ============== 保存关卡完成状态 ==============
function saveLevelCompletion() {
    // 标记关卡为已完成
    gameStats.completed[currentLevel] = true;
    
    // 更新最佳步数
    if (gameStats.bestSteps[currentLevel] === 0 || steps < gameStats.bestSteps[currentLevel]) {
        gameStats.bestSteps[currentLevel] = steps;
    }
    
    // 更新最佳时间
    if (gameStats.bestTime[currentLevel] === 0 || currentTimer < gameStats.bestTime[currentLevel]) {
        gameStats.bestTime[currentLevel] = currentTimer;
    }
    
    // 保存到 localStorage
    saveGameProgress();
    
    // 更新关卡选择器显示
    updateLevelSelector();
    
    // 更新进度显示
    updateProgressDisplay();
}

// ============== 更新关卡选择器 ==============
function updateLevelSelector() {
    const options = levelSelector.querySelectorAll('option');
    options.forEach((option, index) => {
        if (gameStats.completed[index]) {
            if (!option.textContent.includes('✓')) {
                option.textContent += ' ✓';
                option.style.color = '#4caf50';
            }
        }
    });
}

// ============== 通关弹窗 ==============
function showWinModal() {
    // 播放获胜音效
    soundManager.play('win');
    
    winLevelElement.textContent = currentLevel + 1;
    winStepsElement.textContent = steps;
    
    // 获取最佳记录
    const bestSteps = gameStats.bestSteps[currentLevel];
    const bestTime = gameStats.bestTime[currentLevel];
    
    // 计算时间显示
    const minutes = Math.floor(currentTimer / 60);
    const seconds = currentTimer % 60;
    const timeStr = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    
    // 计算最佳时间显示
    let bestTimeStr = '暂无';
    if (bestTime > 0) {
        const bestMinutes = Math.floor(bestTime / 60);
        const bestSeconds = bestTime % 60;
        bestTimeStr = `${bestMinutes.toString().padStart(2, '0')}:${bestSeconds.toString().padStart(2, '0')}`;
    }
    
    // 计算箱子
    let boxesOnTarget = 0;
    let totalBoxes = 0;
    for (let y = 0; y < gameState.length; y++) {
        for (let x = 0; x < gameState[y].length; x++) {
            if (gameState[y][x] === 2) totalBoxes++;
            if (gameState[y][x] === 5) {
                totalBoxes++;
                boxesOnTarget++;
            }
        }
    }
    
    winBoxesElement.textContent = `${boxesOnTarget}/${totalBoxes}`;
    
    // 更新模态框内容
    const winStats = document.querySelector('.win-stats');
    if (winStats) {
        winStats.innerHTML = `
            <p>步数: <span id="win-steps">${steps}</span> (最佳: ${bestSteps || '暂无'})</p>
            <p>时间: <span>${timeStr}</span> (最佳: ${bestTimeStr})</p>
            <p>箱子: <span id="win-boxes">${boxesOnTarget}/${totalBoxes}</span></p>
        `;
    }
    
    winModal.style.display = 'flex';
}

// 隐藏获胜模态框
function hideWinModal() {
    winModal.style.display = 'none';
}

// ============== 保存/加载游戏进度 ==============
function saveGameProgress() {
    const saveData = {
        stats: gameStats,
        lastLevel: currentLevel
    };
    try {
        localStorage.setItem('sokoban_save', JSON.stringify(saveData));
        console.log("游戏进度已保存");
    } catch (e) {
        console.error("保存游戏进度失败:", e);
    }
}

function loadGameProgress() {
    try {
        const saved = localStorage.getItem('sokoban_save');
        if (saved) {
            const saveData = JSON.parse(saved);
            if (saveData.stats) {
                // 确保数组长度匹配关卡数量
                gameStats.completed = saveData.stats.completed || Array(levels.length).fill(false);
                gameStats.bestSteps = saveData.stats.bestSteps || Array(levels.length).fill(0);
                gameStats.bestTime = saveData.stats.bestTime || Array(levels.length).fill(0);
                
                // 如果关卡数量变化，调整数组
                if (gameStats.completed.length !== levels.length) {
                    gameStats.completed = gameStats.completed.slice(0, levels.length);
                    gameStats.bestSteps = gameStats.bestSteps.slice(0, levels.length);
                    gameStats.bestTime = gameStats.bestTime.slice(0, levels.length);
                }
            }
            currentLevel = saveData.lastLevel || 0;
            console.log("游戏进度已加载");
        }
    } catch (e) {
        console.error("加载游戏进度失败:", e);
    }
}

// ============== 更新音效按钮状态 ==============
function updateSoundButton() {
    if (soundBtn) {
        const icon = soundBtn.querySelector('i');
        if (soundManager.enabled) {
            icon.className = 'fas fa-volume-up';
            soundBtn.title = '关闭音效';
        } else {
            icon.className = 'fas fa-volume-mute';
            soundBtn.title = '开启音效';
        }
    }
}

// ============== 关卡控制 ==============
// 重置当前关卡
function resetLevel() {
    saveStateToHistory();
    loadLevel(currentLevel);
    // 播放重置音效
    soundManager.play('reset');
    console.log("重置当前关卡");
}

// 上一关
function prevLevel() {
    if (currentLevel > 0) {
        loadLevel(currentLevel - 1);
    } else {
        alert('已经是第一关了！');
    }
}

// 下一关
function nextLevel() {
    if (currentLevel < levels.length - 1) {
        loadLevel(currentLevel + 1);
    } else {
        alert('🎉 恭喜你通关所有关卡！');
        winModal.style.display = 'none';
    }
}

// ============== 事件监听器 ==============
function initEventListeners() {
    // 键盘控制
    document.addEventListener('keydown', (e) => {
        let dx = 0, dy = 0;
        let moved = false;
        
        switch (e.key.toLowerCase()) {
            case 'arrowup':
            case 'w':
                dy = -1;
                moved = movePlayer(0, -1);
                break;
            case 'arrowdown':
            case 's':
                dy = 1;
                moved = movePlayer(0, 1);
                break;
            case 'arrowleft':
            case 'a':
                dx = -1;
                moved = movePlayer(-1, 0);
                break;
            case 'arrowright':
            case 'd':
                dx = 1;
                moved = movePlayer(1, 0);
                break;
            case 'r':
                resetLevel();
                return;
            case 'z':
                undoMove();
                return;
            case 'm': // M键切换音效
                soundManager.toggle();
                updateSoundButton();
                return;
        }
        
        if (moved) {
            e.preventDefault();
        }
    });
    
    // 按钮事件
    resetBtn.addEventListener('click', resetLevel);
    
    prevBtn.addEventListener('click', () => {
        if (currentLevel > 0) {
            loadLevel(currentLevel - 1);
        }
    });
    
    nextBtn.addEventListener('click', () => {
        if (currentLevel < levels.length - 1) {
            loadLevel(currentLevel + 1);
        }
    });
    
    undoBtn.addEventListener('click', undoMove);
    
    // 关卡选择器事件
    levelSelector.addEventListener('change', (e) => {
        const newLevel = parseInt(e.target.value);
        if (newLevel !== currentLevel) {
            loadLevel(newLevel);
        }
    });
    
    // 音效按钮事件
    if (soundBtn) {
        soundBtn.addEventListener('click', () => {
            const enabled = soundManager.toggle();
            updateSoundButton();
            
            // 播放测试音效
            if (enabled) {
                soundManager.play('move');
            }
        });
    }
    
    // 弹窗按钮事件
    nextLevelBtn.addEventListener('click', () => {
        hideWinModal();
        if (currentLevel < levels.length - 1) {
            loadLevel(currentLevel + 1);
        } else {
            alert('🎉 恭喜你通关所有关卡！');
        }
    });
    
    closeModalBtn.addEventListener('click', hideWinModal);
    
    // 点击模态框外部关闭
    winModal.addEventListener('click', (e) => {
        if (e.target === winModal) {
            hideWinModal();
        }
    });
}

// ============== 游戏验证（可选） ==============
function validateLevels() {
    console.log("=== 关卡验证 ===");
    let hasErrors = false;
    
    levels.forEach((level, index) => {
        let playerCount = 0;
        let boxCount = 0;
        let targetCount = 0;
        
        for (let y = 0; y < level.grid.length; y++) {
            for (let x = 0; x < level.grid[y].length; x++) {
                const cell = level.grid[y][x];
                if (cell === 4 || cell === 6) playerCount++;
                if (cell === 2 || cell === 5) boxCount++;
                if (cell === 3 || cell === 5 || cell === 6) targetCount++;
            }
        }
        
        let errors = [];
        if (playerCount !== 1) errors.push(`玩家数量：${playerCount}`);
        if (boxCount !== targetCount) errors.push(`箱子(${boxCount})≠目标点(${targetCount})`);
        
        if (errors.length > 0) {
            console.error(`❌ 第${index + 1}关 "${level.name}" 有问题：`, errors);
            hasErrors = true;
        } else {
            console.log(`✅ 第${index + 1}关 "${level.name}" 验证通过`);
        }
    });
    
    if (!hasErrors) {
        console.log("🎉 所有关卡验证通过！");
    }
}

// ============== 手机触摸控制 ==============
function initTouchControls() {
    const gameBoard = document.getElementById('game-board');
    let touchStartX = 0;
    let touchStartY = 0;
    
    // 记录触摸开始的点
    gameBoard.addEventListener('touchstart', function(event) {
        // 阻止触摸时屏幕滚动
        event.preventDefault();
        const touch = event.touches[0];
        touchStartX = touch.clientX;
        touchStartY = touch.clientY;
    }, { passive: false }); // 必须设置 passive: false 才能使用 preventDefault
    
    // 触摸结束时判断滑动方向
    gameBoard.addEventListener('touchend', function(event) {
        event.preventDefault();
        const touch = event.changedTouches[0];
        const touchEndX = touch.clientX;
        const touchEndY = touch.clientY;
        
        // 计算滑动距离
        const dx = touchEndX - touchStartX;
        const dy = touchEndY - touchStartY;
        
        // 定义一个最小滑动距离阈值（像素），避免误触
        const minSwipeDistance = 30;
        
        // 判断滑动方向（取绝对值最大的方向）
        if (Math.abs(dx) > Math.abs(dy)) {
            // 水平滑动
            if (Math.abs(dx) > minSwipeDistance) {
                if (dx > 0) {
                    movePlayer(1, 0); // 向右滑动
                } else {
                    movePlayer(-1, 0); // 向左滑动
                }
            }
        } else {
            // 垂直滑动
            if (Math.abs(dy) > minSwipeDistance) {
                if (dy > 0) {
                    movePlayer(0, 1); // 向下滑动
                } else {
                    movePlayer(0, -1); // 向上滑动
                }
            }
        }
        
        // 重置起点
        touchStartX = 0;
        touchStartY = 0;
    }, { passive: false });
}

// ============== 启动游戏 ==============
// 页面加载完成后初始化游戏
document.addEventListener('DOMContentLoaded', () => {
    // 可选：验证关卡设计
    validateLevels();
    
    initGame();

    // 初始化触摸控制
    initTouchControls();
    
    // 游戏提示
    setTimeout(() => {
        alert('欢迎来到推箱子游戏！\n\n🎮 控制方式：\n方向键或WASD - 移动玩家\nR键 - 重置当前关卡\nZ键 - 撤销上一步\nM键 - 切换音效\n\n🎯 游戏目标：\n把所有的📦箱子推到⭐目标点上\n\n新功能：\n1. 关卡选择器\n2. 计时功能\n3. 进度保存\n4. 最佳记录\n5. 音效系统\n\n祝您游戏愉快！');
    }, 500);
});
