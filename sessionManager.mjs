class SessionManager {
    constructor(provider) {
        this.sessions = provider.sessions;
        this.provider = provider;

        // 初始化账号锁定状态
        for (const username in this.sessions) {
            this.sessions[username].locked = false;
        }
    }

    // 获取所有可用且未锁定会话
    getAvailableSessions() {
        const currentMode = this.provider.currentMode;

        return Object.keys(this.sessions).filter(username => {
            const session = this.sessions[username];
            return session.valid && !session.locked && session.modeStatus[currentMode];
        });
    }

    // 随机选择一个可用会话
    getRandomSession() {
        const availableSessions = this.getAvailableSessions();
        if (availableSessions.length === 0) {
            throw new Error('没有可用的会话');
        }
        const randomIndex = Math.floor(Math.random() * availableSessions.length);
        const selectedUsername = availableSessions[randomIndex];
        // 锁定账号
        this.sessions[selectedUsername].locked = true;
        return selectedUsername;
    }

    // 释放账号锁定
    releaseSession(username) {
        if (this.sessions[username]) {
            this.sessions[username].locked = false;
        }
    }

    // 策略
    getSessionByStrategy(strategy = 'random') {
        if (strategy === 'random') {
            return this.getRandomSession();
        }
        throw new Error(`未实现的策略: ${strategy}`);
    }
}

export default SessionManager;
