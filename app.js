// Default Data
const DEFAULT_DATA = [
    { id: 1, japanese: "これはペンです。", english: "This is a pen." },
    { id: 2, japanese: "その駅へはどう行けばいいですか？", english: "How can I get to the station?" },
    { id: 3, japanese: "彼はテニスをするのが好きです。", english: "He likes playing tennis." },
    { id: 4, japanese: "明日晴れたら、ピクニックに行きましょう。", english: "If it is sunny tomorrow, let's go on a picnic." },
    { id: 5, japanese: "私はそのニュースを聞いて驚いた。", english: "I was surprised to hear the news." }
];

// State
let appData = [];
let currentIndex = 0;
let currentMode = 'question'; // 'question', 'hint', 'answer'
let isRandom = false;
let studySeconds = 0;
let timerInterval = null;
let questionCount = 0;
let revealedIndices = new Set();

// DOM Elements
const japaneseText = document.getElementById('japanese-text');
const englishText = document.getElementById('english-text');
const hintBtn = document.getElementById('hint-btn');
const answerBtn = document.getElementById('answer-btn');
const nextBtn = document.getElementById('next-btn');
const settingsBtn = document.getElementById('settings-btn');
const settingsModal = document.getElementById('settings-modal');
const closeSettingsBtn = document.getElementById('close-settings');
const saveDataBtn = document.getElementById('save-data-btn');
const csvInput = document.getElementById('csv-input');
const csvFileInput = document.getElementById('csv-file');
const randomOrderCheck = document.getElementById('random-order-check');
const flashcard = document.getElementById('flashcard');
const timerDisplay = document.getElementById('study-timer');
const timerToggleBtn = document.getElementById('timer-toggle-btn');
const timerResetBtn = document.getElementById('timer-reset-btn');
const timerIconPlay = document.getElementById('timer-icon-play');
const timerIconPause = document.getElementById('timer-icon-pause');
const questionCounterDisplay = document.getElementById('question-counter');
const counterResetBtn = document.getElementById('counter-reset-btn');
const speakBtn = document.getElementById('speak-btn');

// Initialization
function init() {
    loadData();
    showCard(currentIndex);
    setupEventListeners();
    startTimer();
    updateQuestionCounter();
}

// Timer Logic
function startTimer() {
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        studySeconds++;
        updateTimerDisplay();
    }, 1000);
    updateTimerIcons(true);
}

function stopTimer() {
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = null;
    updateTimerIcons(false);
}

function resetTimer() {
    stopTimer();
    studySeconds = 0;
    updateTimerDisplay();
}

function toggleTimer() {
    if (timerInterval) {
        stopTimer();
    } else {
        startTimer();
    }
}

function updateTimerIcons(isPlaying) {
    if (isPlaying) {
        timerIconPlay.classList.add('hidden');
        timerIconPause.classList.remove('hidden');
    } else {
        timerIconPlay.classList.remove('hidden');
        timerIconPause.classList.add('hidden');
    }
}

function updateTimerDisplay() {
    const minutes = Math.floor(studySeconds / 60);
    const seconds = studySeconds % 60;
    timerDisplay.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

// Counter Logic
function updateQuestionCounter() {
    if (questionCounterDisplay) {
        questionCounterDisplay.textContent = questionCount;
    }
}

function resetCounter() {
    questionCount = 0;
    updateQuestionCounter();
}

// Data Management
function loadData() {
    const storedData = localStorage.getItem('instantEnglishData');
    if (storedData) {
        appData = JSON.parse(storedData);
    } else {
        appData = DEFAULT_DATA;
    }
    // Load Settings
    const storedRandom = localStorage.getItem('instantEnglishRandom');
    isRandom = storedRandom === 'true';
    if (randomOrderCheck) randomOrderCheck.checked = isRandom;
}

function saveData(csvText) {
    const lines = csvText.trim().split('\n');
    const newData = lines.map((line, index) => {
        // Parse CSV line respecting quotes
        const parts = [];
        let current = '';
        let inQuote = false;

        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"') {
                inQuote = !inQuote;
                current += char;
            } else if (char === ',' && !inQuote) {
                parts.push(current);
                current = '';
            } else {
                current += char;
            }
        }
        parts.push(current);

        const cleanParts = parts.map(part => {
            let p = part.trim();
            if (p.startsWith('"') && p.endsWith('"')) {
                return p.slice(1, -1).replace(/""/g, '"');
            }
            return p;
        });

        if (cleanParts.length >= 2) {
            return {
                id: index + 1,
                japanese: cleanParts[0],
                english: cleanParts.slice(1).join(',')
            };
        }
        return null;
    }).filter(item => item !== null);

    if (newData.length > 0) {
        appData = newData;
        localStorage.setItem('instantEnglishData', JSON.stringify(appData));
        currentIndex = 0;
        showCard(currentIndex);
        toggleModal(false);
        alert('Data saved!');
    } else {
        alert('Invalid CSV format.');
    }
}

// UI Logic
function showCard(index) {
    if (appData.length === 0) return;

    // Reset State
    currentMode = 'question';
    const item = appData[index];

    // Animate Out
    flashcard.classList.remove('fade-in');
    void flashcard.offsetWidth; // trigger reflow
    flashcard.classList.add('fade-in');

    japaneseText.textContent = item.japanese;
    englishText.textContent = item.english; // Content is there, but hidden by CSS

    // Reset Visuals
    englishText.className = 'text-display blur-text';
    englishText.innerHTML = item.english;

    // Reset Hint State
    revealedIndices.clear();

    // Reset Buttons
    hintBtn.classList.remove('hidden');
    answerBtn.classList.remove('hidden');
    nextBtn.classList.add('hidden');
    speakBtn.classList.add('hidden');
}

function showHint() {
    currentMode = 'hint';
    const item = appData[currentIndex];
    const words = item.english.split(' ');
    const totalWords = words.length;

    // Count how many words are currently revealed
    const revealedCount = revealedIndices.size;

    // Determine target percentage based on current progress
    let targetPercentage;
    if (revealedCount === 0) {
        targetPercentage = 0.33; // First click: 33%
    } else if (revealedCount < totalWords * 0.66) {
        targetPercentage = 0.66; // Second click: 66%
    } else {
        // Third click or more: show answer
        showAnswer();
        return;
    }

    // Calculate target number of words to reveal
    const targetCount = Math.ceil(totalWords * targetPercentage);

    // Find hidden indices
    const hiddenIndices = [];
    for (let i = 0; i < totalWords; i++) {
        if (!revealedIndices.has(i)) {
            hiddenIndices.push(i);
        }
    }

    // Reveal random words until we reach the target count
    const wordsToReveal = targetCount - revealedCount;
    for (let i = 0; i < wordsToReveal && hiddenIndices.length > 0; i++) {
        const randomIndex = Math.floor(Math.random() * hiddenIndices.length);
        const wordIndex = hiddenIndices[randomIndex];
        revealedIndices.add(wordIndex);
        hiddenIndices.splice(randomIndex, 1);
    }

    // Render text
    const html = words.map((word, i) => {
        if (revealedIndices.has(i)) {
            return word;
        } else {
            return `<span style="filter: blur(5px); opacity: 0.6;">${word}</span>`;
        }
    }).join(' ');

    englishText.innerHTML = html;
    englishText.classList.remove('blur-text');
}

function showAnswer() {
    currentMode = 'answer';
    const item = appData[currentIndex];
    englishText.textContent = item.english;
    englishText.className = 'text-display'; // Remove all blurs

    // Switch Buttons
    hintBtn.classList.add('hidden');
    answerBtn.classList.add('hidden');
    nextBtn.classList.remove('hidden');
    speakBtn.classList.remove('hidden'); // Show speak button

    // Increment counter
    questionCount++;
    updateQuestionCounter();
}

function nextCard() {
    if (isRandom) {
        let nextIndex = Math.floor(Math.random() * appData.length);
        if (appData.length > 1 && nextIndex === currentIndex) {
            nextIndex = (nextIndex + 1) % appData.length;
        }
        currentIndex = nextIndex;
    } else {
        currentIndex = (currentIndex + 1) % appData.length;
    }
    showCard(currentIndex);
}

// Text-to-Speech Function
function speakEnglish() {
    const item = appData[currentIndex];
    if (!item || !item.english) return;

    // Cancel any ongoing speech
    if (window.speechSynthesis.speaking) {
        window.speechSynthesis.cancel();
    }

    // Create speech synthesis utterance
    const utterance = new SpeechSynthesisUtterance(item.english);
    utterance.lang = 'en-US'; // English
    utterance.rate = 0.9; // Slightly slower for learning
    utterance.pitch = 1.0;

    // Speak
    window.speechSynthesis.speak(utterance);
}

// Event Listeners
function setupEventListeners() {
    hintBtn.addEventListener('click', showHint);
    answerBtn.addEventListener('click', showAnswer);
    nextBtn.addEventListener('click', nextCard);

    settingsBtn.addEventListener('click', () => {
        // Pre-fill textarea with current CSV (Escaped)
        const csv = appData.map(item => {
            const toCSV = (text) => {
                if (text.includes(',') || text.includes('"') || text.includes('\n')) {
                    return `"${text.replace(/"/g, '""')}"`;
                }
                return text;
            };
            return `${toCSV(item.japanese)},${toCSV(item.english)}`;
        }).join('\n');
        csvInput.value = csv;
        toggleModal(true);
    });

    closeSettingsBtn.addEventListener('click', () => toggleModal(false));

    saveDataBtn.addEventListener('click', () => {
        saveData(csvInput.value);
    });

    csvFileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            csvInput.value = event.target.result;
        };
        reader.readAsText(file);
    });

    randomOrderCheck.addEventListener('change', (e) => {
        isRandom = e.target.checked;
        localStorage.setItem('instantEnglishRandom', isRandom);
    });

    timerToggleBtn.addEventListener('click', toggleTimer);
    if (timerResetBtn) timerResetBtn.addEventListener('click', resetTimer);
    if (counterResetBtn) counterResetBtn.addEventListener('click', resetCounter);
    if (speakBtn) speakBtn.addEventListener('click', speakEnglish);

    // Close modal on outside click
    settingsModal.addEventListener('click', (e) => {
        if (e.target === settingsModal) toggleModal(false);
    });
}

function toggleModal(show) {
    if (show) {
        settingsModal.classList.remove('hidden');
    } else {
        settingsModal.classList.add('hidden');
    }
}

// Start
init();
