import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';
import { SessionData, TabState } from '../../types/index';

const SESSION_FILE = path.join(app.getPath('userData'), 'session.json');

interface LegacySession {
    openFiles?: string[];
    savedAt?: string;
}

interface FullSession extends SessionData {
    savedAt?: string;
}

export function getSession(): string[] {
    try {
        if (fs.existsSync(SESSION_FILE)) {
            const data = fs.readFileSync(SESSION_FILE, 'utf-8');
            const session: LegacySession = JSON.parse(data);
            return session.openFiles || [];
        }
    } catch (err) {
        console.error('Failed to read session:', err);
    }
    return [];
}

export function saveSession(filePaths: string[]): void {
    try {
        const session: LegacySession = {
            openFiles: filePaths,
            savedAt: new Date().toISOString()
        };
        fs.writeFileSync(SESSION_FILE, JSON.stringify(session, null, 2));
    } catch (err) {
        console.error('Failed to save session:', err);
    }
}

export function getFullSession(): SessionData | null {
    try {
        if (fs.existsSync(SESSION_FILE)) {
            const data = fs.readFileSync(SESSION_FILE, 'utf-8');
            const session: any = JSON.parse(data);
            // Check if this is a full session (has tabs array)
            if (session.tabs) {
                return session as SessionData;
            }
            // Legacy format - return null to create new tabs
            return null;
        }
    } catch (err) {
        console.error('Failed to read full session:', err);
    }
    return null;
}

export function saveFullSession(sessionData: SessionData): void {
    try {
        const session: FullSession = {
            ...sessionData,
            savedAt: new Date().toISOString()
        };
        fs.writeFileSync(SESSION_FILE, JSON.stringify(session, null, 2));
    } catch (err) {
        console.error('Failed to save full session:', err);
    }
}

export function saveTabContent(tabData: TabState): void {
    try {
        // Read existing session
        let session: any = {};
        if (fs.existsSync(SESSION_FILE)) {
            const data = fs.readFileSync(SESSION_FILE, 'utf-8');
            session = JSON.parse(data);
        }

        // Initialize tabs array if not present
        if (!session.tabs) {
            session.tabs = [];
        }

        // Find and update existing tab or add new one
        const existingIndex = session.tabs.findIndex((t: TabState) => t.id === tabData.id);
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
