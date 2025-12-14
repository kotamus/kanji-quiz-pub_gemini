// Global Variables
let kanjiDatabase = {};
let currentGrade = null;
let currentMode = null;
let currentQuestions = [];
let currentQuestionIndex = 0;
let score = 0;
let combo = 0;
let allKanjiByGrade = {};
let modalCallback = null;

// Audio Files
let correctSound = new Audio('wav/correct.mp3');
correctSound.volume = 0.5;
let wrongSound = new Audio('wav/wrong.mp3');
wrongSound.volume = 0.5;
let winSound = new Audio('wav/win.mp3');
winSound.volume = 0.5;

// Custom Modal Functions
function showModal(message, onOK, onCancel) {
    document.getElementById('modalMessage').textContent = message;
    document.getElementById('modalOverlay').style.display = 'flex';
    modalCallback = { onOK, onCancel };
}

function hideModal() {
    document.getElementById('modalOverlay').style.display = 'none';
    if (modalCallback && modalCallback.onCancel) {
        modalCallback.onCancel();
    }
    modalCallback = null;
}

function handleModalOK() {
    document.getElementById('modalOverlay').style.display = 'none';
    if (modalCallback && modalCallback.onOK) {
        modalCallback.onOK();
    }
    modalCallback = null;
}

// Confirmation Modal
function showConfirmModal() {
    showModal(
        'クイズを中断してトップに戻りますか？\n現在の進捗は失われます。',
        function () { backToMenu(); },
        null
    );
}

// Error Message
function showErrorMessage(message) {
    showModal(
        message,
        function () { backToMenu(); },
        null
    );
}

// Mascot Elements
const mascotImg = document.getElementById('mascotImg');

function setMascot(state) {
    if (!mascotImg) return;
    mascotImg.classList.remove('jump');

    switch (state) {
        case 'correct':
            mascotImg.src = 'images/mascot_correct.png';
            mascotImg.classList.add('jump');
            break;
        case 'incorrect':
            mascotImg.src = 'images/mascot_incorrect.png';
            break;
        case 'normal':
        default:
            mascotImg.src = 'images/mascot_normal.png';
            break;
    }
}

function showComboEffect(count) {
    const display = document.getElementById('comboDisplay');
    display.textContent = count + ' コンボ！';
    display.classList.remove('show');
    // Reflow to restart animation
    void display.offsetWidth;
    display.classList.add('show');
}

// Return to Top Menu
function backToMenu() {
    setMascot('normal');
    // Hide all screens
    document.getElementById('result').style.display = 'none';
    document.getElementById('loader').style.display = 'none';
    document.getElementById('quizContainer').style.display = 'none';
    document.getElementById('modeSelector').style.display = 'none';

    // Show grade selector
    document.getElementById('gradeSelector').style.display = 'block';

    // Reset buttons
    document.querySelectorAll('.grade-btn').forEach(function (btn) {
        btn.classList.remove('active');
    });
    document.querySelectorAll('.mode-btn').forEach(function (btn) {
        btn.classList.remove('active');
    });

    currentGrade = null;
    currentMode = null;
    currentQuestions = [];
    currentQuestionIndex = 0;
    score = 0;
}

// Show Answer
function showAnswer() {
    document.getElementById('answerDisplay').style.display = 'block';

    // Show self-check buttons and instruction
    document.getElementById('selfCheckButtons').style.display = 'grid';
    document.getElementById('selfCheckInstruction').style.display = 'block';

    // Hide show answer button to avoid confusion? Or keep it? 
    // Usually keep it is fine, but maybe disable it.
    document.querySelector('.show-answer-btn').style.display = 'none';
}

// Self Check
function selfCheck(isCorrect) {
    // Disable buttons
    document.querySelectorAll('.check-btn').forEach(function (btn) {
        btn.disabled = true;
    });

    if (isCorrect) {
        score++;
        combo++;
        correctSound.play();
        setMascot('correct');
        if (combo > 1) {
            showComboEffect(combo);
        }
    } else {
        combo = 0;
        wrongSound.play();
        setMascot('incorrect');
    }

    setTimeout(function () {
        setMascot('normal');
        currentQuestionIndex++;
        if (currentQuestionIndex < currentQuestions.length) {
            showQuestion();
        } else {
            showResult();
        }
    }, 1000);
}

// Restart
function restart() {
    document.getElementById('result').style.display = 'none';
    document.getElementById('loader').style.display = 'none';
    document.getElementById('quizContainer').style.display = 'none';

    currentQuestionIndex = 0;
    score = 0;

    startQuiz();
}

// Initialize Sample Data
function initializeSampleData() {
    // データは window.grade1Data などにロードされています
    // ここでは初期化処理は不要ですが、kanjiDatabaseへのマッピングを行います
    for (let i = 1; i <= 6; i++) {
        const globalName = 'grade' + i + 'Data';
        if (window[globalName]) {
            kanjiDatabase[i] = window[globalName];
            // 全漢字リストの更新
            if (kanjiDatabase[i].kanjiList) {
                updateAllKanjiList(i, kanjiDatabase[i].kanjiList);
            }
        } else {
            // データがない場合は空オブジェクト(後でfetchするかもだが、file:プロトコルでは無理)
            kanjiDatabase[i] = {};
        }
    }
}

// Load Kanji Data
function loadKanjiData(grade) {
    // キャッシュまたはメモリにあるか確認
    if (kanjiDatabase[grade] && kanjiDatabase[grade].questions && kanjiDatabase[grade].questions.length > 0) {
        return Promise.resolve(kanjiDatabase[grade]);
    }

    // windowオブジェクトから確認 (JSファイルとしてロードされている場合)
    const globalName = 'grade' + grade + 'Data';
    if (window[globalName]) {
        kanjiDatabase[grade] = window[globalName];
        updateAllKanjiList(grade, kanjiDatabase[grade].kanjiList);
        return Promise.resolve(kanjiDatabase[grade]);
    }

    // フェッチ (サーバー環境用、またはローカルファイルのフォールバック)

    // Local file handling
    if (window.location.protocol === 'file:') {
        return loadEmbeddedKanjiData(grade);
    }

    // Fetch from JSON
    return fetch('./data/grade' + grade + '.json') // Fixed path to relative
        .then(function (response) {
            if (!response.ok) {
                throw new Error('データファイルが見つかりません');
            }
            return response.json();
        })
        .then(function (data) {
            kanjiDatabase[grade] = data;
            updateAllKanjiList(grade, data.kanjiList);
            return data;
        })
        .catch(function (error) {
            console.warn('データ読み込みエラー (fetch失敗):', error);
            // エラー時でも、空のデータよりはマシな場合の処理があればここに
            // ここではエラーを再送出せず、nullを返すべきか？
            // startQuizでエラーハンドリングしていないので、ここで何とかする
            // しかし、window[globalName]で見つからなかった時点で厳しい
            return null;
        });
}

function loadEmbeddedKanjiData(grade) {
    return new Promise(function (resolve, reject) {
        if (kanjiDatabase[grade]) {
            updateAllKanjiList(grade, kanjiDatabase[grade].kanjiList);
            resolve(kanjiDatabase[grade]);
        } else {
            // Try to load from localStorage if not in memory? 
            // Or just reject.
            reject(new Error('学年データが見つかりません'));
        }
    });
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

function adjustWord(word, grade) {
    let adjusted = '';
    for (let i = 0; i < word.length; i++) {
        const char = word[i];
        if (isKanjiLearned(char, grade) || isHiragana(char) || isKatakana(char)) {
            adjusted += char;
        } else {
            adjusted += '？';
        }
    }
    return adjusted;
}

function adjustWordForGrade(text, grade) {
    if (!text) return '';

    const kanjiToHiragana = {
        '勉強': 'べんきょう', '運動': 'うんどう', '動物': 'どうぶつ', '植物': 'しょくぶつ',
        '建物': 'たてもの', '食物': 'しょくもつ', '物語': 'ものがたり', '図書': 'としょ',
        '音楽': 'おんがく', '美術': 'びじゅつ', '体育': 'たいいく', '理科': 'りか',
        '社会': 'しゃかい', '算数': 'さんすう', '国語': 'こくご', '英語': 'えいご',
        '歴史': 'れきし', '地理': 'ちり', '科学': 'かがく', '自然': 'しぜん',
        '環境': 'かんきょう', '文化': 'ぶんか', '経済': 'けいざい', '政治': 'せいじ',
        '健康': 'けんこう', '安全': 'あんぜん', '平和': 'へいわ', '幸福': 'こうふく',
        '希望': 'きぼう', '努力': 'どりょく', '協力': 'きょうりょく', '友情': 'ゆうじょう',
        '信頼': 'しんらい', '尊敬': 'そんけい'
    };

    let adjusted = text;
    for (let compound in kanjiToHiragana) {
        adjusted = adjusted.replace(new RegExp(compound, 'g'), kanjiToHiragana[compound]);
    }

    let result = '';
    for (let i = 0; i < adjusted.length; i++) {
        const char = adjusted[i];
        if (isKanji(char)) {
            if (isKanjiLearned(char, grade)) {
                result += char;
            } else {
                result += getKanjiReading(char) || char;
            }
        } else {
            result += char;
        }
    }
    return result;
}

function getKanjiReading(kanji) {
    const readings = {
        '教': 'おし', '授': 'じゅ', '業': 'ぎょう', '課': 'か', '題': 'だい',
        '問': 'もん', '答': 'こた', '解': 'かい', '説': 'せつ', '明': 'めい',
        '理': 'り', '由': 'ゆう', '原': 'げん', '因': 'いん', '結': 'けつ',
        '果': 'か', '効': 'こう', '影': 'えい', '響': 'きょう', '関': 'かん',
        '係': 'けい', '連': 'れん', '絡': 'らく', '接': 'せつ', '触': 'しょく',
        '感': 'かん', '想': 'そう', '思': 'おも', '考': 'かんが', '判': 'はん',
        '断': 'だん', '決': 'き', '定': 'てい', '確': 'たし', '認': 'みと',
        '証': 'しょう', '実': 'じつ', '際': 'さい', '場': 'ば', '合': 'あい',
        '状': 'じょう', '況': 'きょう', '情': 'じょう', '報': 'ほう', '知': 'し',
        '識': 'しき', '技': 'ぎ', '術': 'じゅつ', '能': 'のう', '力': 'りき',
        '才': 'さい', '特': 'とく', '別': 'べつ', '個': 'こ', '性': 'せい',
        '格': 'かく', '質': 'しつ', '量': 'りょう', '数': 'すう', '値': 'ち',
        '価': 'か', '費': 'ひ', '用': 'よう', '利': 'り', '益': 'えき',
        '損': 'そん', '害': 'がい', '危': 'き', '険': 'けん', '注': 'ちゅう',
        '意': 'い', '集': 'しゅう', '中': 'ちゅう', '心': 'しん', '配': 'はい',
        '慮': 'りょ'
    };
    return readings[kanji] || null;
}

function isHiragana(char) {
    return char >= '\u3040' && char <= '\u309F';
}

function isKatakana(char) {
    return char >= '\u30A0' && char <= '\u30FF';
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

        if (!hasTargetGradeKanji && targetGradeKanji.length > 0) {
            hasTargetGradeKanji = true;
        }
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
    let dummyOptions = [];
    if (type === 'reading') {
        dummyOptions = ['あさ', 'ひる', 'よる', 'そら', 'うみ', 'やま', 'かわ', 'もり', 'はな', 'つち', 'かぜ', 'あめ', 'ゆき', 'くも', 'いけ', 'たに'];
    }
    while (choices.length < 4) {
        const dummy = dummyOptions[Math.floor(Math.random() * dummyOptions.length)];
        if (choices.indexOf(dummy) === -1) {
            choices.push(dummy);
        }
    }
    return choices.sort(function () { return Math.random() - 0.5; });
}

// Event Listeners
document.querySelectorAll('.grade-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
        currentGrade = parseInt(this.dataset.grade);
        document.querySelectorAll('.grade-btn').forEach(function (b) { b.classList.remove('active'); });
        this.classList.add('active');
        document.getElementById('gradeSelector').style.display = 'none';
        document.getElementById('modeSelector').style.display = 'block';
    });
});

document.querySelectorAll('.mode-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
        currentMode = this.dataset.mode;
        document.querySelectorAll('.mode-btn').forEach(function (b) { b.classList.remove('active'); });
        this.classList.add('active');
        startQuiz();
    });
});

function startQuiz() {
    document.getElementById('modeSelector').style.display = 'none';
    document.getElementById('loader').style.display = 'block';

    loadKanjiData(currentGrade).then(function (gradeData) {
        if (!gradeData) {
            showErrorMessage('この学年のデータはまだ準備中です。');
            return;
        }
        currentQuestions = generateQuestions(gradeData, currentGrade, currentMode);
        if (currentQuestions.length === 0) {
            showErrorMessage('問題を生成できませんでした。');
            return;
        }
        currentQuestionIndex = 0;
        score = 0;
        combo = 0;
        document.getElementById('loader').style.display = 'none';
        document.getElementById('quizContainer').style.display = 'block';
        showQuestion();
    });
}

function showQuestion() {
    setMascot('normal');
    const question = currentQuestions[currentQuestionIndex];
    document.getElementById('questionCounter').textContent = (currentQuestionIndex + 1) + ' / ' + currentQuestions.length;

    if (currentMode === 'reading') {
        document.getElementById('questionText').style.display = 'block';
        document.getElementById('questionText').textContent = question.word;
        document.getElementById('readingText').style.display = 'block';
        document.getElementById('readingText').textContent = 'この漢字の読み方は？';
        if (question.hint) {
            document.getElementById('readingText').textContent += ' （ヒント: ' + question.hint + '）';
        }
        document.getElementById('writingSection').style.display = 'none';
        document.getElementById('choices').style.display = 'grid';

        const choicesContainer = document.getElementById('choices');
        choicesContainer.innerHTML = '';
        question.choices.forEach(function (choice) {
            const btn = document.createElement('button');
            btn.className = 'choice-btn';
            btn.textContent = choice;
            btn.onclick = function () { checkAnswer(choice, btn); };
            choicesContainer.appendChild(btn);
        });
    } else {
        document.getElementById('questionText').style.display = 'none';
        document.getElementById('readingText').style.display = 'none';
        document.getElementById('choices').style.display = 'none';
        document.getElementById('writingSection').style.display = 'block';
        document.getElementById('writingDisplay').textContent = question.reading;
        if (question.hint) {
            document.getElementById('writingHint').textContent = 'ヒント: ' + question.hint;
            document.getElementById('writingHint').style.display = 'block';
        } else {
            document.getElementById('writingHint').style.display = 'none';
        }
        document.getElementById('answerDisplay').textContent = question.word;
        document.getElementById('answerDisplay').style.display = 'none';

        // Hide self-check initially
        document.getElementById('selfCheckButtons').style.display = 'none';
        document.getElementById('selfCheckInstruction').style.display = 'none';
        document.querySelector('.show-answer-btn').style.display = 'inline-block'; // Ensure show button is visible

        document.querySelectorAll('.check-btn').forEach(function (btn) { btn.disabled = false; });
    }
    const progress = ((currentQuestionIndex + 1) / currentQuestions.length) * 100;
    document.getElementById('progressBar').style.width = progress + '%';
}

function checkAnswer(answer, btn) {
    const question = currentQuestions[currentQuestionIndex];
    const buttons = document.querySelectorAll('.choice-btn');
    buttons.forEach(function (b) { b.style.pointerEvents = 'none'; b.disabled = true; });

    if (answer === question.correctAnswer) {
        btn.classList.add('correct');
        score++;
        combo++;
        correctSound.play();
        setMascot('correct');
        if (combo > 1) {
            showComboEffect(combo);
        }
    } else {
        btn.classList.add('incorrect');
        combo = 0;
        wrongSound.play();
        setMascot('incorrect');
        buttons.forEach(function (b) {
            if (b.textContent === question.correctAnswer) {
                b.classList.add('correct');
            }
        });
    }
    setTimeout(function () {
        setMascot('normal');
        currentQuestionIndex++;
        if (currentQuestionIndex < currentQuestions.length) {
            showQuestion();
        } else {
            showResult();
        }
    }, 1500);
}

function showResult() {
    document.getElementById('quizContainer').style.display = 'none';
    document.getElementById('result').style.display = 'block';

    const percentage = Math.round((score / currentQuestions.length) * 100);
    let message = score + ' / ' + currentQuestions.length + ' (' + percentage + '%)';
    if (percentage === 100) { message += '\n🎉 完璧です！'; winSound.play(); }
    else if (percentage >= 80) { message += '\n😊 よくできました！'; }
    else if (percentage >= 60) { message += '\n🙂 がんばりました！'; }
    else { message += '\n💪 もう一度挑戦しよう！'; }
    document.getElementById('score').innerHTML = message.replace(/\n/g, '<br>');
}

// Admin Panel Functions
function showAdminPanel() {
    const passcode = prompt('管理者パスコードを入力してください:');
    if (passcode !== '0123') { alert('パスコードが間違っています。'); return; }
    document.getElementById('adminPanel').style.display = 'flex';
    showQuestionList();
}

function hideAdminPanel() {
    document.getElementById('adminPanel').style.display = 'none';
}

function showAdminTab(tabName) {
    document.querySelectorAll('.admin-content').forEach(function (content) { content.style.display = 'none'; });
    document.querySelectorAll('.admin-tab').forEach(function (tab) { tab.classList.remove('active'); });
    document.getElementById('admin' + tabName.charAt(0).toUpperCase() + tabName.slice(1)).style.display = 'block';
    // Note: event.target likely won't work here if called programmatically, but mostly it's onclick
    // We can find the button by onclick text or pass element if needed.
    // For now simple implementation.
    const tabs = document.querySelectorAll('.admin-tab');
    if (tabName === 'add') tabs[0].classList.add('active');
    if (tabName === 'view') tabs[1].classList.add('active');
    if (tabName === 'import') tabs[2].classList.add('active');

    if (tabName === 'view') { showQuestionList(); }
}

function addQuestion() {
    const grade = parseInt(document.getElementById('addGrade').value);
    const word = document.getElementById('addWord').value.trim();
    const reading = document.getElementById('addReading').value.trim();
    const hint = document.getElementById('addHint').value.trim();
    const type = document.getElementById('addType').value;
    const difficulty = parseInt(document.getElementById('addDifficulty').value);

    // Validation
    if (!word || !reading || !hint) {
        showAddResult('すべての項目を入力してください。', 'error');
        return;
    }

    const newQuestion = { type, word, reading, hint, difficulty };

    // Init DB if empty
    if (!kanjiDatabase[grade]) {
        kanjiDatabase[grade] = { grade: grade, kanjiList: [], questions: [] };
    }

    kanjiDatabase[grade].questions.push(newQuestion);

    // Update kanji list
    for (let char of word) {
        if (isKanji(char) && kanjiDatabase[grade].kanjiList.indexOf(char) === -1) {
            kanjiDatabase[grade].kanjiList.push(char);
        }
    }

    // Clear form
    document.getElementById('addWord').value = '';
    document.getElementById('addReading').value = '';
    document.getElementById('addHint').value = '';

    showAddResult('問題を追加しました！', 'success');
    saveToLocalStorage(grade);
}

function showAddResult(message, type) {
    const resultDiv = document.getElementById('addResult');
    resultDiv.textContent = message;
    resultDiv.className = 'add-result ' + type;
    resultDiv.style.display = 'block';
    setTimeout(function () { resultDiv.style.display = 'none'; }, 3000);
}

function showQuestionList() {
    const grade = parseInt(document.getElementById('viewGrade').value);
    const listDiv = document.getElementById('questionList');

    if (!kanjiDatabase[grade] || !kanjiDatabase[grade].questions) {
        listDiv.innerHTML = '<p>この学年の問題データがありません。</p>';
        return;
    }

    const questions = kanjiDatabase[grade].questions;
    if (questions.length === 0) {
        listDiv.innerHTML = '<p>まだ問題が登録されていません。</p>';
        return;
    }

    let html = '<h3>' + grade + '年生の問題一覧 (' + questions.length + '問)</h3>';
    questions.forEach(function (q) {
        html += '<div class="question-item">';
        html += '<h4>' + q.word + ' (' + q.reading + ')</h4>';
        html += '<p><strong>ヒント:</strong> ' + q.hint + '</p>';
        html += '<p><strong>タイプ:</strong> ' + getTypeText(q.type) + ' | ';
        html += '<strong>難易度:</strong> ' + getDifficultyText(q.difficulty) + '</p>';
        html += '</div>';
    });
    listDiv.innerHTML = html;
}

function getTypeText(type) {
    switch (type) {
        case 'both': return '読み・書き両方';
        case 'reading': return '読みテストのみ';
        case 'writing': return '書きテストのみ';
        default: return '不明';
    }
}

function getDifficultyText(difficulty) {
    switch (difficulty) {
        case 1: return '簡単';
        case 2: return '普通';
        case 3: return '難しい';
        default: return '普通';
    }
}

function importQuestions() {
    const data = document.getElementById('importData').value.trim();
    if (!data) { showImportResult('JSONデータを入力してください。', 'error'); return; }

    try {
        const jsonData = JSON.parse(data);
        if (!jsonData.grade || !jsonData.questions) { throw new Error('正しいフォーマットではありません'); }
        const grade = jsonData.grade;

        if (!kanjiDatabase[grade]) { kanjiDatabase[grade] = { grade: grade, kanjiList: [], questions: [] }; }

        jsonData.questions.forEach(function (q) { kanjiDatabase[grade].questions.push(q); });

        if (jsonData.kanjiList) {
            jsonData.kanjiList.forEach(function (kanji) {
                if (kanjiDatabase[grade].kanjiList.indexOf(kanji) === -1) {
                    kanjiDatabase[grade].kanjiList.push(kanji);
                }
            });
        }

        saveToLocalStorage(grade);
        showImportResult(jsonData.questions.length + '問を取り込みました。', 'success');
        document.getElementById('importData').value = '';
    } catch (error) {
        showImportResult('JSONデータの形式が正しくありません: ' + error.message, 'error');
    }
}

function showImportResult(message, type) {
    const resultDiv = document.getElementById('importResult');
    resultDiv.textContent = message;
    resultDiv.className = 'import-result ' + type;
    resultDiv.style.display = 'block';
    setTimeout(function () { resultDiv.style.display = 'none'; }, 5000);
}

function exportQuestions() {
    const grade = parseInt(document.getElementById('exportGrade').value);
    const exportArea = document.getElementById('exportData');
    if (!kanjiDatabase[grade] || !kanjiDatabase[grade].questions) {
        exportArea.value = '{"error": "この学年のデータがありません"}';
        return;
    }
    const exportData = {
        grade: grade,
        totalKanji: kanjiDatabase[grade].kanjiList ? kanjiDatabase[grade].kanjiList.length : 0,
        kanjiList: kanjiDatabase[grade].kanjiList || [],
        questions: kanjiDatabase[grade].questions
    };
    exportArea.value = JSON.stringify(exportData, null, 2);
}

function isKanji(char) {
    return (char >= '\u4e00' && char <= '\u9faf') || (char >= '\u3400' && char <= '\u4dbf');
}

function saveToLocalStorage(grade) {
    try {
        localStorage.setItem('kanjiQuiz_grade' + grade, JSON.stringify(kanjiDatabase[grade]));
    } catch (error) {
        console.warn('ローカルストレージへの保存に失敗しました:', error);
    }
}

function loadFromLocalStorage() {
    for (let grade = 1; grade <= 6; grade++) {
        try {
            const stored = localStorage.getItem('kanjiQuiz_grade' + grade);
            if (stored) {
                const data = JSON.parse(stored);
                // Merge data
                if (kanjiDatabase[grade]) {
                    data.questions.forEach(function (q) {
                        const exists = kanjiDatabase[grade].questions.some(function (existing) {
                            return existing.word === q.word && existing.reading === q.reading;
                        });
                        if (!exists) {
                            kanjiDatabase[grade].questions.push(q);
                        }
                    });
                    // Merge kanji list too
                    if (data.kanjiList) {
                        data.kanjiList.forEach(function (k) {
                            if (kanjiDatabase[grade].kanjiList.indexOf(k) === -1) {
                                kanjiDatabase[grade].kanjiList.push(k);
                            }
                        });
                    }
                } else {
                    kanjiDatabase[grade] = data;
                }
            }
        } catch (error) {
            console.warn('学年' + grade + 'のデータ読み込みに失敗:', error);
        }
    }
}

document.getElementById('modalOverlay').addEventListener('click', function (e) {
    if (e.target === this) {
        hideModal();
    }
});

// PWA Service Worker Registration
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(function () {
        // SW registration failed
    });
}

// Initialization
window.addEventListener('DOMContentLoaded', function () {
    initializeSampleData();
    loadFromLocalStorage(); // FIX: Load data from local storage
});
