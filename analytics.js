// Analytics Dashboard JavaScript

document.addEventListener('DOMContentLoaded', () => {
    loadAnalytics();
    
    // Clear data button
    const clearBtn = document.getElementById('clear-data-btn');
    clearBtn.addEventListener('click', () => {
        if (confirm('Are you sure you want to clear all analytics data? This action cannot be undone.')) {
            localStorage.removeItem('quizSessions');
            localStorage.removeItem('currentSession');
            loadAnalytics();
        }
    });
});

function loadAnalytics() {
    const currentSession = JSON.parse(localStorage.getItem('currentSession') || 'null');
    const allSessions = JSON.parse(localStorage.getItem('quizSessions') || '[]');

    // Display current session
    displayCurrentSession(currentSession);

    // Display all sessions
    displayAllSessions(allSessions);

    // Display summary statistics
    displaySummaryStats(allSessions);
}

function displayCurrentSession(session) {
    const container = document.getElementById('current-session-content');
    
    if (!session) {
        container.innerHTML = '<p class="no-data">No current session data available.</p>';
        return;
    }

    container.innerHTML = `<div class="session-card">${createSessionCard(session, true)}</div>`;
}

function displayAllSessions(sessions) {
    const container = document.getElementById('sessions-list');
    
    if (sessions.length === 0) {
        container.innerHTML = '<p class="no-data">No previous sessions found.</p>';
        return;
    }

    // Sort sessions by date (newest first)
    sessions.sort((a, b) => new Date(b.startTime) - new Date(a.startTime));

    // Remove current session from all sessions if it exists
    const currentSessionId = JSON.parse(localStorage.getItem('currentSession') || 'null')?.sessionId;
    const otherSessions = sessions.filter(s => s.sessionId !== currentSessionId);

    if (otherSessions.length === 0) {
        container.innerHTML = '<p class="no-data">No other previous sessions found.</p>';
        return;
    }

    container.innerHTML = otherSessions.map(session => 
        `<div class="session-card">${createSessionCard(session, false)}</div>`
    ).join('');
}

function createSessionCard(session, isCurrent) {
    const startDate = new Date(session.startTime);
    const endDate = session.endTime ? new Date(session.endTime) : null;
    const duration = formatDuration(session.totalDuration);
    const avgTime = formatTime(session.averageResponseTime);
    const totalQuestions = session.questions.length;
    const answeredQuestions = session.questions.filter(q => q.answered).length;
    const correctCount = session.correctAnswers || 0;
    const incorrectCount = session.incorrectAnswers || 0;
    const accuracy = answeredQuestions > 0 
        ? Math.round((correctCount / answeredQuestions) * 100) 
        : 0;

    let questionsHTML = '';
    if (session.questions && session.questions.length > 0) {
        questionsHTML = `
            <div class="questions-breakdown">
                <h3>Question Breakdown</h3>
                ${session.questions.map((q, index) => {
                    const status = q.correct === true ? 'correct' : q.correct === false ? 'incorrect' : '';
                    const statusText = q.correct === true ? '✓ Correct' : q.correct === false ? '✗ Incorrect' : 'Not Answered';
                    const time = q.responseTime ? formatTime(q.responseTime) : 'N/A';
                    
                    return `
                        <div class="question-item ${status}">
                            <div class="question-text">Q${index + 1}: ${truncateText(q.question, 100)}</div>
                            <div class="question-details">
                                <span class="question-time">⏱️ ${time}</span>
                                <span class="question-status ${status}">${statusText}</span>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    }

    return `
        <div class="session-header">
            <div>
                <div class="session-title">${session.pdfName || 'Untitled Session'}</div>
                <div class="session-date">${formatDate(startDate)}${endDate ? ' - ' + formatDate(endDate) : ''}</div>
            </div>
        </div>
        <div class="session-metrics">
            <div class="metric-item">
                <div class="metric-label">Total Duration</div>
                <div class="metric-value">${duration}</div>
            </div>
            <div class="metric-item">
                <div class="metric-label">Average Response Time</div>
                <div class="metric-value">${avgTime}</div>
            </div>
            <div class="metric-item">
                <div class="metric-label">Total Questions</div>
                <div class="metric-value">${totalQuestions}</div>
            </div>
            <div class="metric-item">
                <div class="metric-label">Answered</div>
                <div class="metric-value">${answeredQuestions}</div>
            </div>
            <div class="metric-item">
                <div class="metric-label">Correct Answers</div>
                <div class="metric-value success">${correctCount}</div>
            </div>
            <div class="metric-item">
                <div class="metric-label">Incorrect Answers</div>
                <div class="metric-value error">${incorrectCount}</div>
            </div>
            <div class="metric-item">
                <div class="metric-label">Accuracy</div>
                <div class="metric-value ${accuracy >= 70 ? 'success' : accuracy >= 50 ? '' : 'error'}">${accuracy}%</div>
            </div>
        </div>
        ${questionsHTML}
    `;
}

function displaySummaryStats(sessions) {
    if (sessions.length === 0) {
        document.getElementById('total-sessions').textContent = '0';
        document.getElementById('total-time').textContent = '0h 0m';
        document.getElementById('total-correct').textContent = '0';
        document.getElementById('avg-accuracy').textContent = '0%';
        return;
    }

    const totalSessions = sessions.length;
    const totalTime = sessions.reduce((sum, s) => sum + (s.totalDuration || 0), 0);
    const totalCorrect = sessions.reduce((sum, s) => sum + (s.correctAnswers || 0), 0);
    const totalIncorrect = sessions.reduce((sum, s) => sum + (s.incorrectAnswers || 0), 0);
    const totalAnswered = totalCorrect + totalIncorrect;
    const avgAccuracy = totalAnswered > 0 ? Math.round((totalCorrect / totalAnswered) * 100) : 0;

    document.getElementById('total-sessions').textContent = totalSessions;
    document.getElementById('total-time').textContent = formatDuration(totalTime);
    document.getElementById('total-correct').textContent = totalCorrect;
    document.getElementById('avg-accuracy').textContent = avgAccuracy + '%';
}

function formatDuration(ms) {
    if (!ms) return '0m';
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
        return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
        return `${minutes}m ${seconds % 60}s`;
    } else {
        return `${seconds}s`;
    }
}

function formatTime(ms) {
    if (!ms) return '0s';
    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) {
        return `${seconds}s`;
    } else {
        const minutes = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${minutes}m ${secs}s`;
    }
}

function formatDate(date) {
    if (!date) return 'N/A';
    const d = new Date(date);
    return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function truncateText(text, maxLength) {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
}

