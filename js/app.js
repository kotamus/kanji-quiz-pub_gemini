// Game State
const GameState = {
    gems: 0,
    gold: 0,
    playerHp: 100,
    maxPlayerHp: 100,
    enemyHp: 100,
    maxEnemyHp: 100,
    currentGrade: 1,
    currentMode: 'reading',
    questions: [],
    questionIndex: 0,
    score: 0,
    combo: 0,
    isMuted: false
};

// Databases
let kanjiDatabase = {};
let allKanjiByGrade = {};

// Audio
const correctSound = new Audio('wav/correct.mp3');
correctSound.volume = 0.5;
const wrongSound = new Audio('wav/wrong.mp3');
wrongSound.volume = 0.5;
const winSound = new Audio('wav/win.mp3');
winSound.volume = 0.5;

function playSound(sound) {
    if (!GameState.isMuted) {
        sound.currentTime = 0;
        sound.play().catch(e => console.log('Audio play failed', e));
    }
}

// Scene Manager
const SceneManager = {
    showScene: function (sceneId) {
        document.querySelectorAll('.scene').forEach(scene => {
            scene.classList.remove('active');
        });
        const target = document.getElementById(sceneId);
        if (target) target.classList.add('active');

        const header = document.getElementById('gameHeader');
        if (sceneId === 'title-scene') {
            header.style.display = 'none';
        } else {
            header.style.display = 'flex';
            updateCurrencyDisplay();
        }
    },

    showTitle: function () {
        this.showScene('title-scene');
    },

    showMap: function () {
        this.showScene('map-scene');
    },

    startLevel: function (grade) {
        GameState.currentGrade = grade;
        startBattle(grade);
    }
};

// UI Updates
function updateCurrencyDisplay() {
    document.getElementById('gemCount').textContent = GameState.gems;
    document.getElementById('goldCount').textContent = GameState.gold;
}

function updateBattleUI() {
    const playerPct = (GameState.playerHp / GameState.maxPlayerHp) * 100;
    const enemyPct = (GameState.enemyHp / GameState.maxEnemyHp) * 100;

    document.getElementById('playerHpBar').style.width = `${Math.max(0, playerPct)}%`;
    document.getElementById('enemyHpBar').style.width = `${Math.max(0, enemyPct)}%`;
}

// Battle Logic
function startBattle(grade) {
    GameState.playerHp = GameState.maxPlayerHp;
    GameState.enemyHp = GameState.maxEnemyHp;
    GameState.score = 0;
    GameState.combo = 0;
    GameState.questionIndex = 0;

    updateBattleUI();
    SceneManager.showScene('battle-scene');

    loadKanjiData(grade).then(gradeData => {
        if (!gradeData) {
            alert('データの読み込みに失敗しました');
            SceneManager.showMap();
            return;
        }

        GameState.questions = generateQuestions(gradeData, grade, GameState.currentMode);

        if (GameState.questions.length === 0) {
            alert('問題が生成できませんでした');
            SceneManager.showMap();
            return;
        }

        GameState.maxEnemyHp = GameState.questions.length * 20;
        GameState.enemyHp = GameState.maxEnemyHp;

        showQuestion();
    });
}

function showQuestion() {
    updateBattleUI();

    // Check Win/Loss before showing question? 
    // Usually handled in nextQuestion, but safe check here.
    if (GameState.playerHp <= 0 || GameState.enemyHp <= 0) {
        // Should have triggered result
        return;
    }

    const q = GameState.questions[GameState.questionIndex];
    if (!q) {
        showResult(true);
        return;
    }

    document.getElementById('questionCounter').textContent = `${GameState.questionIndex + 1} / ${GameState.questions.length}`;

    const enemyChar = document.getElementById('enemyCharacter');
    if (q.type === 'reading') {
        enemyChar.textContent = q.word;

        // Dynamically adjust font size for length
        if (q.word.length >= 3) {
            enemyChar.style.fontSize = '30px';
        } else if (q.word.length >= 2) {
            enemyChar.style.fontSize = '40px';
        } else {
            enemyChar.style.fontSize = '60px';
        }

        document.getElementById('questionText').textContent = q.word;
        document.getElementById('readingText').textContent = '読み方は？';
        if (q.hint) document.getElementById('readingText').textContent += ` (${q.hint})`;

        setupReadingChoices(q);
        document.getElementById('writingSection').style.display = 'none';
        document.getElementById('choices').style.display = 'grid';
    } else {
        enemyChar.textContent = '？';
        enemyChar.style.fontSize = '60px'; // Reset for single char placeholder
        document.getElementById('questionText').textContent = '書き取り';
        document.getElementById('readingText').textContent = '';

        setupWritingTest(q);
        document.getElementById('writingSection').style.display = 'block';
        document.getElementById('choices').style.display = 'none';
    }
}

function setupReadingChoices(question) {
    const container = document.getElementById('choices');
    container.innerHTML = '';
    question.choices.forEach(choice => {
        const btn = document.createElement('button');
        btn.className = 'choice-btn';
        btn.textContent = choice;
        btn.onclick = () => checkAnswer(choice, question.correctAnswer, btn);
        container.appendChild(btn);
    });
}

function setupWritingTest(question) {
    document.getElementById('writingDisplay').textContent = question.reading;
    document.getElementById('writingHint').textContent = question.hint ? `ヒント: ${question.hint}` : '';
    document.getElementById('writingHint').style.display = question.hint ? 'block' : 'none';

    document.getElementById('answerDisplay').textContent = question.word;
    document.getElementById('answerDisplay').style.display = 'none';
    document.getElementById('selfCheckButtons').style.display = 'none';
    document.getElementById('selfCheckInstruction').style.display = 'none';
    document.querySelector('.show-answer-btn').style.display = 'inline-block';
}

function checkAnswer(playerAnswer, correctAnswer, btnElement) {
    document.querySelectorAll('.choice-btn').forEach(b => b.disabled = true);

    const isCorrect = (playerAnswer === correctAnswer);

    if (isCorrect) {
        if (btnElement) btnElement.classList.add('correct');
        handleCorrect();
    } else {
        if (btnElement) btnElement.classList.add('incorrect');
        // Show correct answer if reading
        document.querySelectorAll('.choice-btn').forEach(b => {
            if (b.textContent === correctAnswer) b.classList.add('correct');
        });
        handleIncorrect();
    }
}

function showAnswer() {
    document.getElementById('answerDisplay').style.display = 'block';
    document.querySelector('.show-answer-btn').style.display = 'none';
    document.getElementById('selfCheckButtons').style.display = 'grid';
    document.getElementById('selfCheckInstruction').style.display = 'block';
}

function selfCheck(isCorrect) {
    document.querySelectorAll('.check-btn').forEach(b => b.disabled = true);
    if (isCorrect) handleCorrect();
    else handleIncorrect();
}

function handleCorrect() {
    playSound(correctSound);
    GameState.score++;
    GameState.combo++;

    // Trigger visual battle sequence
    triggerAttackAnimation(() => {
        // Callback after animation hits
        const damage = 20 + (GameState.combo * 2);
        GameState.enemyHp = Math.max(0, GameState.enemyHp - damage);

        // Enemy Shake/Damage Visual
        const enemyChar = document.getElementById('enemyCharacter');
        enemyChar.classList.add('shake');
        setTimeout(() => enemyChar.classList.remove('shake'), 500);

        // Update UI
        updateBattleUI();

        // Player Happy Visual
        const playerImg = document.getElementById('battlePlayerImg');
        const originalSrc = playerImg.src;
        playerImg.src = 'images/mascot_correct.png';

        // Next Question Delay
        setTimeout(() => {
            playerImg.src = 'images/mascot_normal.png';
            nextQuestion();
        }, 1000);
    });
}

function triggerAttackAnimation(onHitCallback) {
    const playerImg = document.getElementById('battlePlayerImg');
    const enemyChar = document.getElementById('enemyCharacter');
    const battleScene = document.getElementById('battle-scene');

    // Create Effect Container if not exists
    let container = document.getElementById('effectLayer');
    if (!container) {
        container = document.createElement('div');
        container.id = 'effectLayer';
        container.className = 'battle-effect-container';
        battleScene.appendChild(container);
    }

    // Get Coordinates
    const playerRect = playerImg.getBoundingClientRect();
    const enemyRect = enemyChar.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect(); // relative to viewport

    // Start Position (Player Center) relative to container/scene
    const startX = (playerRect.left + playerRect.width / 2) - containerRect.left;
    const startY = (playerRect.top + playerRect.height / 2) - containerRect.top;

    // End Position (Enemy Center)
    const endX = (enemyRect.left + enemyRect.width / 2) - containerRect.left;
    const endY = (enemyRect.top + enemyRect.height / 2) - containerRect.top;

    // Create Projectile
    const ball = document.createElement('div');
    ball.className = 'energy-ball';
    ball.style.setProperty('--startX', `${startX}px`);
    ball.style.setProperty('--startY', `${startY}px`);
    ball.style.setProperty('--endX', `${endX}px`);
    ball.style.setProperty('--endY', `${endY}px`);

    // Animation
    ball.style.animation = 'shootEnergy 0.2s forwards ease-in';
    container.appendChild(ball);

    // Timeline
    setTimeout(() => {
        // Hit!
        ball.remove();

        // Create Explosion
        const impact = document.createElement('div');
        impact.className = 'impact-effect';
        impact.style.left = `${endX}px`;
        impact.style.top = `${endY}px`;
        impact.style.animation = 'impactExplode 0.4s forwards';
        container.appendChild(impact);

        setTimeout(() => impact.remove(), 400);

        // Logic Callback
        if (onHitCallback) onHitCallback();

    }, 200); // Sync with animation duration
}

function handleIncorrect() {
    playSound(wrongSound);
    GameState.combo = 0;

    const damage = 20; // 5 mistakes = dead
    GameState.playerHp = Math.max(0, GameState.playerHp - damage);

    const playerImg = document.getElementById('battlePlayerImg');
    // Shake + Red Flash
    playerImg.classList.add('shake');
    playerImg.classList.add('damage-flash');

    setTimeout(() => {
        playerImg.classList.remove('shake');
        playerImg.classList.remove('damage-flash');
    }, 500);

    playerImg.src = 'images/mascot_incorrect.png';

    // Update UI
    updateBattleUI();

    setTimeout(() => {
        playerImg.src = 'images/mascot_normal.png';
        nextQuestion();
    }, 1500);
}

function nextQuestion() {
    if (GameState.playerHp <= 0) {
        showResult(false);
        return;
    }

    GameState.questionIndex++;
    if (GameState.enemyHp <= 0 || GameState.questionIndex >= GameState.questions.length) {
        showResult(true);
    } else {
        showQuestion();
    }
}

function showResult(isWin) {
    SceneManager.showScene('result-scene');
    const scoreDiv = document.getElementById('score');

    // Clear previous effects if any
    const existingConfetti = document.querySelectorAll('.confetti');
    existingConfetti.forEach(c => c.remove());

    if (isWin) {
        playSound(winSound);
        const goldReward = 50 + (GameState.score * 5);
        const gemReward = 2;
        GameState.gold += goldReward;
        GameState.gems += gemReward;

        scoreDiv.innerHTML = `
            <div class="result-title">Victory!</div>
            <p style="font-size: 20px;">ステージクリア！</p>
            <div class="result-rewards">
                <p>スコア: <strong>${GameState.score}</strong> (Combo Max: ${GameState.combo})</p>
                <p style="color: #FFD166; font-weight: bold; margin-top: 10px;">
                    💰 +${goldReward}G &nbsp;&nbsp; 💎 +${gemReward}
                </p>
            </div>
        `;
        startConfetti();
    } else {
        scoreDiv.innerHTML = `
             <div class="result-lose-title">Defeat...</div>
            <p>次はがんばろう！</p>
            <p>スコア: ${GameState.score}</p>
        `;
    }
    updateCurrencyDisplay();
}

function startConfetti() {
    const colors = ['#EF476F', '#FFD166', '#06D6A0', '#118AB2'];
    const container = document.getElementById('result-scene');

    for (let i = 0; i < 50; i++) {
        const confetti = document.createElement('div');
        confetti.className = 'confetti';
        confetti.style.left = Math.random() * 100 + '%';
        confetti.style.top = -10 + 'px';
        confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
        confetti.style.animationDuration = (Math.random() * 2 + 2) + 's';
        confetti.style.animationDelay = (Math.random() * 2) + 's';
        container.appendChild(confetti);
    }
}

function restart() {
    startBattle(GameState.currentGrade);
}

// RESTORED LOGIC FROM ORIGINAL

function isKanji(char) {
    return (char >= '\u4e00' && char <= '\u9faf') || (char >= '\u3400' && char <= '\u4dbf');
}

function isHiragana(char) {
    return char >= '\u3040' && char <= '\u309F';
}

function isKatakana(char) {
    return char >= '\u30A0' && char <= '\u30FF';
}

function updateAllKanjiList(grade, kanjiList) {
    if (!allKanjiByGrade[grade]) {
        allKanjiByGrade[grade] = [];
    }
    allKanjiByGrade[grade] = [];
    for (let g = 1; g <= grade; g++) {
        if (kanjiDatabase[g] && kanjiDatabase[g].kanjiList) {
            allKanjiByGrade[grade] = allKanjiByGrade[grade].concat(kanjiDatabase[g].kanjiList);
        }
    }
}

function isKanjiLearned(kanji, grade) {
    return allKanjiByGrade[grade] && allKanjiByGrade[grade].indexOf(kanji) !== -1;
}

function adjustWordForGrade(text, grade) {
    if (!text) return '';
    let result = '';
    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        if (isKanji(char)) {
            if (isKanjiLearned(char, grade)) {
                result += char;
            } else {
                result += '？'; // Mask unknown kanji in hints
            }
        } else {
            result += char;
        }
    }
    return result;
}

function generateQuestions(gradeData, grade, mode) {
    const questions = [];
    const currentGradeQuestions = [];
    if (kanjiDatabase[grade] && kanjiDatabase[grade].questions) {
        kanjiDatabase[grade].questions.forEach(function (q) {
            if (q.type === 'both' || q.type === mode) {
                currentGradeQuestions.push(q);
            }
        });
    }

    const availableQuestions = currentGradeQuestions.filter(function (q) {
        const targetGradeKanji = kanjiDatabase[grade] ? kanjiDatabase[grade].kanjiList : [];
        let hasTargetGradeKanji = false;
        for (let char of q.word) {
            if (isKanji(char) && targetGradeKanji.indexOf(char) !== -1) {
                hasTargetGradeKanji = true;
                break;
            }
        }
        if (!hasTargetGradeKanji && targetGradeKanji.length > 0) hasTargetGradeKanji = true;
        return hasTargetGradeKanji;
    });

    const shuffled = availableQuestions.sort(function () { return Math.random() - 0.5; });
    const selected = shuffled.slice(0, Math.min(10, shuffled.length));

    selected.forEach(function (q) {
        const adjustedHint = adjustWordForGrade(q.hint, grade);
        if (mode === 'reading') {
            questions.push({
                type: 'reading',
                word: q.word,
                reading: q.reading,
                hint: adjustedHint,
                correctAnswer: q.reading,
                choices: generateChoices(q.reading, 'reading')
            });
        } else {
            questions.push({
                type: 'writing',
                word: q.word,
                reading: q.reading,
                hint: adjustedHint
            });
        }
    });

    return questions;
}

function generateChoices(correct, type) {
    const choices = [correct];
    const dummyOptions = ['あさ', 'ひる', 'よる', 'そら', 'うみ', 'やま', 'かわ', 'もり', 'はな', 'つち', 'かぜ', 'あめ', 'ゆき'];
    while (choices.length < 4) {
        const dummy = dummyOptions[Math.floor(Math.random() * dummyOptions.length)];
        if (!choices.includes(dummy)) choices.push(dummy);
    }
    return choices.sort(() => 0.5 - Math.random());
}

function loadKanjiData(grade) {
    // 1. Check Memory
    if (kanjiDatabase[grade] && kanjiDatabase[grade].questions && kanjiDatabase[grade].questions.length > 0) {
        return Promise.resolve(kanjiDatabase[grade]);
    }

    // 2. Check Global Window Object (if loaded via script tag)
    const globalName = 'grade' + grade + 'Data';
    if (window[globalName]) {
        kanjiDatabase[grade] = window[globalName];
        updateAllKanjiList(grade, kanjiDatabase[grade].kanjiList);
        return Promise.resolve(kanjiDatabase[grade]);
    }

    // 3. Fallback: Fetch (for development server, won't work on file://)
    return fetch(`./js/grade${grade}.js`)
        .then(response => {
            if (!response.ok) throw new Error('Network response was not ok');
            return response.text();
        })
        .then(text => {
            // Dangerous eval, but standard for legacy script loading if fetched text
            // Better to just rely on script tags for this specific app structure
            // Just return null for now as we expect script tags
            return null;
        })
        .catch(e => {
            console.warn('Fetch failed:', e);
            return null;
        });
}

// End of helper functions

// Settings Functions
function toggleSettings() {
    const modal = document.getElementById('settingsModal');
    if (modal.style.display === 'none' || !modal.style.display) {
        modal.style.display = 'flex';
    } else {
        modal.style.display = 'none';
    }
}

function toggleSound() {
    GameState.isMuted = !GameState.isMuted;
    const status = document.getElementById('soundStatus');
    const icon = document.getElementById('soundIcon');

    if (GameState.isMuted) {
        status.textContent = 'OFF';
        icon.textContent = '🔇';
    } else {
        status.textContent = 'ON';
        icon.textContent = '🔊';
    }
}

// Modal Functions (Keep these as they are used in HTML)
function showConfirmModal() {
    if (confirm('クイズを中断してマップに戻りますか？')) {
        SceneManager.showMap();
    }
}

// Admin Functions (Simplified stub)
function showAdminPanel() {
    document.getElementById('adminPanel').style.display = 'flex';
}
function hideAdminPanel() {
    document.getElementById('adminPanel').style.display = 'none';
}
function showAdminTab() { }
function showQuestionList() { }
function addQuestion() { }
function importQuestions() { }
function exportQuestions() { }
function loadFromLocalStorage() { }

// Init
window.addEventListener('DOMContentLoaded', function () {
    initializeSampleData();
    SceneManager.showScene('title-scene');
});

function initializeSampleData() {
    for (let i = 1; i <= 6; i++) {
        const globalName = 'grade' + i + 'Data';
        if (window[globalName]) {
            kanjiDatabase[i] = window[globalName];
            if (kanjiDatabase[i].kanjiList) {
                updateAllKanjiList(i, kanjiDatabase[i].kanjiList);
            }
        } else {
            kanjiDatabase[i] = {};
        }
    }
}
