// Global state
let flashcards = [];
let currentCardIndex = 0;
let isFlipped = false;
let quizStartTime = null;
let questionStartTime = null;
let performanceData = {
    sessionId: null,
    pdfName: '',
    startTime: null,
    endTime: null,
    totalDuration: 0,
    questions: [],
    averageResponseTime: 0,
    correctAnswers: 0,
    incorrectAnswers: 0
};

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
});

function initializeApp() {
    // Welcome screen
    const welcomeScreen = document.getElementById('welcome-screen');
    const mainApp = document.getElementById('main-app');
    const startBtn = document.getElementById('start-btn');

    startBtn.addEventListener('click', () => {
        welcomeScreen.classList.add('hidden');
        mainApp.classList.remove('hidden');
    });

    // PDF upload
    const pdfInput = document.getElementById('pdf-input');
    const fileLabel = document.querySelector('.file-label');
    const newDeckBtn = document.getElementById('new-deck-btn');
    
    pdfInput.addEventListener('change', handlePDFUpload);
    newDeckBtn.addEventListener('click', resetApp);
    
    // Flashcard controls
    const prevBtn = document.getElementById('prev-btn');
    const nextBtn = document.getElementById('next-btn');
    const showAnswerBtn = document.getElementById('show-answer-btn');
    const flashcard = document.getElementById('flashcard');
    const knewItBtn = document.getElementById('knew-it-btn');
    const didntKnowBtn = document.getElementById('didnt-know-btn');
    const finishQuizBtn = document.getElementById('finish-quiz-btn');

    prevBtn.addEventListener('click', () => navigateCard(-1));
    nextBtn.addEventListener('click', () => navigateCard(1));
    showAnswerBtn.addEventListener('click', toggleAnswer);
    flashcard.addEventListener('click', () => {
        if (!isFlipped) {
            toggleAnswer();
        }
    });
    knewItBtn.addEventListener('click', () => recordResponse(true));
    didntKnowBtn.addEventListener('click', () => recordResponse(false));
    finishQuizBtn.addEventListener('click', finishQuiz);

    // Load analytics data if available
    loadAnalyticsData();
}

// PDF Upload Handler
async function handlePDFUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    // Request file permission (File API handles this automatically)
    if (!file.type.includes('pdf')) {
        alert('Please upload a PDF file.');
        return;
    }

    const uploadSection = document.getElementById('upload-section');
    const uploadProgress = document.getElementById('upload-progress');
    const flashcardSection = document.getElementById('flashcard-section');

    // Show progress
    uploadProgress.classList.remove('hidden');
    
    try {
        // Extract text from PDF
        const text = await extractTextFromPDF(file);
        
        // Generate flashcards
        flashcards = await generateFlashcards(text);
        
        if (flashcards.length < 8) {
            alert(`Only generated ${flashcards.length} flashcards. Please ensure your PDF has sufficient content.`);
        }

        // Initialize performance tracking
        performanceData.sessionId = Date.now().toString();
        performanceData.pdfName = file.name;
        performanceData.startTime = new Date().toISOString();
        quizStartTime = Date.now();
        questionStartTime = Date.now();

        // Initialize question tracking
        flashcards.forEach((card, index) => {
            performanceData.questions.push({
                questionIndex: index,
                question: card.question,
                responseTime: 0,
                answered: false,
                correct: null
            });
        });

        // Hide upload section, show flashcard section
        uploadProgress.classList.add('hidden');
        uploadSection.classList.add('hidden');
        flashcardSection.classList.remove('hidden');

        // Display first card
        currentCardIndex = 0;
        displayCard();
        
        // Update deck title
        document.getElementById('deck-title').textContent = `Studying: ${file.name}`;

    } catch (error) {
        console.error('Error processing PDF:', error);
        alert('Error processing PDF. Please try again with a different file.');
        uploadProgress.classList.add('hidden');
    }
}

// Extract text from PDF using pdf.js
async function extractTextFromPDF(file) {
    return new Promise((resolve, reject) => {
        const fileReader = new FileReader();
        
        fileReader.onload = async function(event) {
            try {
                const typedArray = new Uint8Array(event.target.result);
                
                // Set up pdf.js worker
                pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
                
                const pdf = await pdfjsLib.getDocument({ data: typedArray }).promise;
                let fullText = '';

                // Extract text from all pages
                for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
                    const page = await pdf.getPage(pageNum);
                    const textContent = await page.getTextContent();
                    const pageText = textContent.items.map(item => item.str).join(' ');
                    fullText += pageText + '\n';
                }

                if (fullText.trim().length === 0) {
                    reject(new Error('No text content found in PDF'));
                } else {
                    resolve(fullText);
                }
            } catch (error) {
                reject(error);
            }
        };

        fileReader.onerror = reject;
        fileReader.readAsArrayBuffer(file);
    });
}

// Generate flashcards from text
async function generateFlashcards(text) {
    // Clean and process text
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 20);
    
    if (sentences.length < 8) {
        // If not enough sentences, split by paragraphs or create questions from chunks
        const paragraphs = text.split(/\n\n+/).filter(p => p.trim().length > 50);
        return generateFromParagraphs(paragraphs);
    }

    const flashcards = [];
    const targetCount = Math.min(12, Math.max(8, Math.floor(sentences.length / 3)));
    
    // Generate questions using various strategies
    const strategies = [
        generateDefinitionQuestions,
        generateConceptQuestions,
        generateDetailQuestions,
        generateSummaryQuestions
    ];

    let strategyIndex = 0;
    const usedSentences = new Set();

    while (flashcards.length < targetCount && sentences.length > 0) {
        const strategy = strategies[strategyIndex % strategies.length];
        const card = strategy(sentences, usedSentences, text);
        
        if (card && !flashcards.some(c => c.question === card.question)) {
            flashcards.push(card);
        }
        
        strategyIndex++;
        
        // Safety break
        if (strategyIndex > targetCount * 3) break;
    }

    // If we don't have enough, generate more from remaining content
    while (flashcards.length < 8 && sentences.length > 0) {
        const remainingSentences = sentences.filter((_, i) => !usedSentences.has(i));
        if (remainingSentences.length === 0) break;
        
        const randomIndex = Math.floor(Math.random() * remainingSentences.length);
        const sentence = remainingSentences[randomIndex].trim();
        
        if (sentence.length > 30) {
            flashcards.push({
                question: `What is the main point about: "${sentence.substring(0, 100)}..."?`,
                answer: sentence
            });
            usedSentences.add(sentences.indexOf(sentence));
        }
    }

    return flashcards.slice(0, Math.min(12, flashcards.length));
}

function generateFromParagraphs(paragraphs) {
    const flashcards = [];
    const targetCount = Math.min(12, Math.max(8, paragraphs.length));
    
    for (let i = 0; i < Math.min(targetCount, paragraphs.length); i++) {
        const para = paragraphs[i].trim();
        if (para.length > 50) {
            const sentences = para.split(/[.!?]+/).filter(s => s.trim().length > 10);
            if (sentences.length >= 2) {
                flashcards.push({
                    question: `What does the following text discuss: "${sentences[0].substring(0, 150)}..."?`,
                    answer: sentences.slice(0, 3).join('. ').trim()
                });
            } else {
                flashcards.push({
                    question: `Summarize the key information about: "${para.substring(0, 100)}..."?`,
                    answer: para.substring(0, 300)
                });
            }
        }
    }
    
    return flashcards;
}

function generateDefinitionQuestions(sentences, usedSentences, fullText) {
    for (let i = 0; i < sentences.length; i++) {
        if (usedSentences.has(i)) continue;
        
        const sentence = sentences[i].trim();
        const words = sentence.match(/\b[A-Z][a-z]+\b/g); // Find capitalized words (likely proper nouns/concepts)
        
        if (words && words.length > 0 && sentence.length > 40) {
            const concept = words[0];
            usedSentences.add(i);
            return {
                question: `What is ${concept}?`,
                answer: sentence
            };
        }
    }
    return null;
}

function generateConceptQuestions(sentences, usedSentences, fullText) {
    for (let i = 0; i < sentences.length; i++) {
        if (usedSentences.has(i)) continue;
        
        const sentence = sentences[i].trim();
        if (sentence.length > 60 && sentence.length < 200) {
            const keyPhrase = extractKeyPhrase(sentence);
            if (keyPhrase) {
                usedSentences.add(i);
                return {
                    question: `Explain: ${keyPhrase}`,
                    answer: sentence
                };
            }
        }
    }
    return null;
}

function generateDetailQuestions(sentences, usedSentences, fullText) {
    for (let i = 0; i < sentences.length; i++) {
        if (usedSentences.has(i)) continue;
        
        const sentence = sentences[i].trim();
        if (sentence.length > 50) {
            const question = sentence.substring(0, sentence.length / 2) + '...?';
            usedSentences.add(i);
            return {
                question: `Complete the following: ${question}`,
                answer: sentence
            };
        }
    }
    return null;
}

function generateSummaryQuestions(sentences, usedSentences, fullText) {
    // Find a cluster of related sentences
    for (let i = 0; i < sentences.length - 2; i++) {
        if (usedSentences.has(i) || usedSentences.has(i + 1) || usedSentences.has(i + 2)) continue;
        
        const cluster = [sentences[i], sentences[i + 1], sentences[i + 2]]
            .filter(s => s.trim().length > 30);
        
        if (cluster.length >= 2) {
            const topic = extractTopic(cluster[0]);
            usedSentences.add(i);
            usedSentences.add(i + 1);
            if (i + 2 < sentences.length) usedSentences.add(i + 2);
            
            return {
                question: `What are the key points about ${topic}?`,
                answer: cluster.join('. ').trim()
            };
        }
    }
    return null;
}

function extractKeyPhrase(sentence) {
    // Extract a meaningful phrase (first 5-8 words)
    const words = sentence.split(/\s+/).slice(0, 8);
    return words.join(' ');
}

function extractTopic(sentence) {
    // Extract topic (first capitalized word or first few words)
    const match = sentence.match(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b/);
    return match ? match[1] : sentence.split(/\s+/).slice(0, 3).join(' ');
}

// Display current card
function displayCard() {
    if (flashcards.length === 0) return;

    const card = flashcards[currentCardIndex];
    document.getElementById('question-text').textContent = card.question;
    document.getElementById('answer-text').textContent = card.answer;
    document.getElementById('current-card').textContent = currentCardIndex + 1;
    document.getElementById('total-cards').textContent = flashcards.length;

    // Reset flip state
    isFlipped = false;
    document.getElementById('flashcard').classList.remove('flipped');
    document.getElementById('show-answer-btn').textContent = 'Show Answer';
    document.getElementById('response-buttons').classList.add('hidden');

    // Update navigation buttons
    document.getElementById('prev-btn').disabled = currentCardIndex === 0;
    document.getElementById('next-btn').disabled = currentCardIndex === flashcards.length - 1;

    // Reset question start time
    questionStartTime = Date.now();
}

// Navigate between cards
function navigateCard(direction) {
    const newIndex = currentCardIndex + direction;
    if (newIndex >= 0 && newIndex < flashcards.length) {
        // Record time for current question if answered
        if (isFlipped && performanceData.questions[currentCardIndex].answered) {
            performanceData.questions[currentCardIndex].responseTime = Date.now() - questionStartTime;
        }
        
        currentCardIndex = newIndex;
        displayCard();
    }
}

// Toggle answer visibility
function toggleAnswer() {
    isFlipped = !isFlipped;
    const flashcard = document.getElementById('flashcard');
    const showAnswerBtn = document.getElementById('show-answer-btn');
    const responseButtons = document.getElementById('response-buttons');

    if (isFlipped) {
        flashcard.classList.add('flipped');
        showAnswerBtn.textContent = 'Hide Answer';
        responseButtons.classList.remove('hidden');
    } else {
        flashcard.classList.remove('flipped');
        showAnswerBtn.textContent = 'Show Answer';
        responseButtons.classList.add('hidden');
    }
}

// Record user response
function recordResponse(knewIt) {
    const questionData = performanceData.questions[currentCardIndex];
    const responseTime = Date.now() - questionStartTime;

    questionData.answered = true;
    questionData.responseTime = responseTime;
    questionData.correct = knewIt;

    if (knewIt) {
        performanceData.correctAnswers++;
    } else {
        performanceData.incorrectAnswers++;
    }

    // Move to next card automatically
    if (currentCardIndex < flashcards.length - 1) {
        setTimeout(() => {
            navigateCard(1);
        }, 500);
    } else {
        // Last card - show finish option
        document.getElementById('response-buttons').classList.add('hidden');
    }
}

// Finish quiz
function finishQuiz() {
    // Record final times
    performanceData.endTime = new Date().toISOString();
    performanceData.totalDuration = Date.now() - quizStartTime;

    // Calculate average response time
    const answeredQuestions = performanceData.questions.filter(q => q.answered);
    if (answeredQuestions.length > 0) {
        const totalResponseTime = answeredQuestions.reduce((sum, q) => sum + q.responseTime, 0);
        performanceData.averageResponseTime = Math.round(totalResponseTime / answeredQuestions.length);
    }

    // Save to localStorage
    savePerformanceData();

    // Redirect to analytics page
    window.location.href = 'analytics.html';
}

// Save performance data
function savePerformanceData() {
    let allSessions = JSON.parse(localStorage.getItem('quizSessions') || '[]');
    allSessions.push(performanceData);
    localStorage.setItem('quizSessions', JSON.stringify(allSessions));
    localStorage.setItem('currentSession', JSON.stringify(performanceData));
}

// Reset app to initial state
function resetApp() {
    if (confirm('Are you sure you want to start a new deck? Current progress will be saved.')) {
        // Save current session if in progress
        if (flashcards.length > 0 && quizStartTime) {
            performanceData.endTime = new Date().toISOString();
            performanceData.totalDuration = Date.now() - quizStartTime;
            savePerformanceData();
        }

        // Reset state
        flashcards = [];
        currentCardIndex = 0;
        isFlipped = false;
        quizStartTime = null;
        questionStartTime = null;
        performanceData = {
            sessionId: null,
            pdfName: '',
            startTime: null,
            endTime: null,
            totalDuration: 0,
            questions: [],
            averageResponseTime: 0,
            correctAnswers: 0,
            incorrectAnswers: 0
        };

        // Reset UI
        document.getElementById('upload-section').classList.remove('hidden');
        document.getElementById('flashcard-section').classList.add('hidden');
        document.getElementById('pdf-input').value = '';
        document.getElementById('deck-title').textContent = 'Your Study Deck';
    }
}

// Load analytics data (for display on main page if needed)
function loadAnalyticsData() {
    const sessions = JSON.parse(localStorage.getItem('quizSessions') || '[]');
    // Could display summary here if needed
}

