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
        if (this.provider && this.provider.currentMode) {
            const currentMode = this.provider.currentMode;

            let availableSessions = Object.keys(this.sessions).filter(username => {
                const session = this.sessions[username];
                return session.valid && !session.locked && session.modeStatus && session.modeStatus[currentMode];
            });

            if (availableSessions.length === 0) {
                console.warn(`在模式 [${currentMode}] 下没有可用的会话。`);

                if (this.provider && typeof this.provider.switchMode === 'function') {
                    console.warn(`尝试切换模式...`);
                    this.provider.switchMode();
                    const newMode = this.provider.currentMode;

                    availableSessions = Object.keys(this.sessions).filter(username => {
                        const session = this.sessions[username];
                        return session.valid && !session.locked && session.modeStatus && session.modeStatus[newMode];
                    });

                    if (availableSessions.length === 0) {
                        // 返回所有可用且未锁定会话
                        availableSessions = Object.keys(this.sessions).filter(username => {
                            const session = this.sessions[username];
                            return session.valid && !session.locked;
                        });
                    }
                } else {
                    console.warn('提供者没有 switchMode 方法');
                    availableSessions = Object.keys(this.sessions).filter(username => {
                        const session = this.sessions[username];
                        return session.valid && !session.locked;
                    });
                }
            }

            return availableSessions;
        } else {
            console.warn('提供者没有 currentMode 属性');

            return Object.keys(this.sessions).filter(username => {
                const session = this.sessions[username];
                return session.valid && !session.locked;
            });
        }
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
