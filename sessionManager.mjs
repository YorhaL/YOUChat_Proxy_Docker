import { Mutex } from 'async-mutex';

class SessionManager {
    constructor(provider) {
        this.sessions = provider.sessions;
        this.provider = provider;
        this.isCustomModeEnabled = process.env.USE_CUSTOM_MODE === 'true';
        this.isRotationEnabled = process.env.ENABLE_MODE_ROTATION === 'true';
        this.currentIndex = 0;
        // 缓存用户名列表
        this.usernameList = Object.keys(this.sessions);
        for (const username in this.sessions) {
            const session = this.sessions[username];
            session.locked = false;
            session.requestCount = 0;
            session.valid = true;
            session.mutex = new Mutex(); // 创建互斥锁
            if (session.currentMode === undefined) {
                session.currentMode = this.isCustomModeEnabled ? 'custom' : 'default';
            }
            if (!session.modeStatus) {
                session.modeStatus = {
                    default: true,
                    custom: true,
                };
            }
            session.rotationEnabled = true;
            session.switchCounter = 0;
            session.requestsInCurrentMode = 0;
            session.lastDefaultThreshold = 0;
            session.switchThreshold = this.provider.getRandomSwitchThreshold(session);
        }
    }

    // 获取所有可用且未锁定会话
    async getAvailableSessions() {
        const allSessionsLocked = this.usernameList.every(
            (username) => this.sessions[username].locked
        );
        if (allSessionsLocked) {
            console.warn('所有会话都已被锁定，等待释放...');
            throw new Error('所有会话都已被锁定');
        }

        // 轮询选择下一个可用
        const totalSessions = this.usernameList.length;
        for (let i = 0; i < totalSessions; i++) {
            const index = (this.currentIndex + i) % totalSessions;
            const username = this.usernameList[index];
            const session = this.sessions[username];

            // 检查是否有效且未锁定
            if (session.valid && !session.locked) {
                const result = await session.mutex.runExclusive(async () => {
                    // 再次检查锁定状态
                    if (session.locked) {
                        return null;
                    }
                    // 检查模式状态
                    if (session.modeStatus && session.modeStatus[session.currentMode]) {
                        session.locked = true;
                        session.requestCount++;
                        this.currentIndex = (index + 1) % totalSessions;
                        return { selectedUsername: username, modeSwitched: false };
                    } else if (this.isCustomModeEnabled && this.isRotationEnabled && this.provider && typeof this.provider.switchMode === 'function') {
                        console.warn(`尝试为账号 ${username} 切换模式...`);
                        this.provider.switchMode(session);
                        session.rotationEnabled = false;

                        if (session.modeStatus && session.modeStatus[session.currentMode]) {
                            session.locked = true;
                            session.requestCount++;
                            this.currentIndex = (index + 1) % totalSessions;
                            return { selectedUsername: username, modeSwitched: true };
                        }
                    }
                    return null;
                });

                if (result) {
                    // 成功锁定会话，返回
                    return result;
                }
            }
        }

        console.warn('没有可用的会话');
        throw new Error('没有可用的会话');
    }

    // 释放账号锁定
    async releaseSession(username) {
        const session = this.sessions[username];
        if (session) {
            await session.mutex.runExclusive(() => {
                session.locked = false;
            });
        }
    }

    // 策略
    async getSessionByStrategy(strategy = 'round_robin') {
        if (strategy === 'round_robin') {
            return await this.getAvailableSessions();
        }
        throw new Error(`未实现的策略: ${strategy}`);
    }
}

export default SessionManager;
