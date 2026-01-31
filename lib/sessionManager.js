const fs = require('fs');
const path = require('path');
const { app } = require('electron');

const SESSION_FILE = path.join(app.getPath('userData'), 'session.json');

/**
 * Get the list of previously opened file paths (legacy)
 * @returns {string[]} Array of file paths
 */
function getSession() {
    try {
        if (fs.existsSync(SESSION_FILE)) {
            const data = fs.readFileSync(SESSION_FILE, 'utf-8');
            const session = JSON.parse(data);
            return session.openFiles || [];
        }
    } catch (err) {
        console.error('Failed to read session:', err);
    }
    return [];
}

/**
 * Save the list of open file paths (legacy)
 * @param {string[]} filePaths - Array of file paths to persist
 */
function saveSession(filePaths) {
    try {
        const session = {
            openFiles: filePaths,
            savedAt: new Date().toISOString()
        };
        fs.writeFileSync(SESSION_FILE, JSON.stringify(session, null, 2));
    } catch (err) {
        console.error('Failed to save session:', err);
    }
}

/**
 * Get full session including tab content
 * @returns {Object} Complete session state
 */
function getFullSession() {
    try {
        if (fs.existsSync(SESSION_FILE)) {
            const data = fs.readFileSync(SESSION_FILE, 'utf-8');
            const session = JSON.parse(data);
            // Check if this is a full session (has tabs array)
            if (session.tabs) {
                return session;
            }
            // Legacy format - return empty to create new tabs
            return null;
        }
    } catch (err) {
        console.error('Failed to read full session:', err);
    }
    return null;
}

/**
 * Save full session including tab content, order, and active tab
 * @param {Object} sessionData - Full session data
 * @param {Array} sessionData.tabs - Array of tab states
 * @param {string[]} sessionData.tabOrder - Order of tab IDs
 * @param {string} sessionData.activeTabId - Currently active tab ID
 */
function saveFullSession(sessionData) {
    try {
        const session = {
            ...sessionData,
            savedAt: new Date().toISOString()
        };
        fs.writeFileSync(SESSION_FILE, JSON.stringify(session, null, 2));
    } catch (err) {
        console.error('Failed to save full session:', err);
    }
}

/**
     * Save a single tab's content to the session (efficient for auto-save)
     * @param {Object} tabData - Single tab data to update
     */
function saveTabContent(tabData) {
    try {
        // Read existing session
        let session = {};
        if (fs.existsSync(SESSION_FILE)) {
            const data = fs.readFileSync(SESSION_FILE, 'utf-8');
            session = JSON.parse(data);
        }

        // Initialize tabs array if not present
        if (!session.tabs) {
            session.tabs = [];
        }

        // Find and update existing tab or add new one
        const existingIndex = session.tabs.findIndex(t => t.id === tabData.id);
        if (existingIndex !== -1) {
            session.tabs[existingIndex] = tabData;
        } else {
            session.tabs.push(tabData);
        }

        session.savedAt = new Date().toISOString();
        fs.writeFileSync(SESSION_FILE, JSON.stringify(session, null, 2));
    } catch (err) {
        console.error('Failed to save tab content:', err);
    }
}

module.exports = { getSession, saveSession, getFullSession, saveFullSession, saveTabContent };
