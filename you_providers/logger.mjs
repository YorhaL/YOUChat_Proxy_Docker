import path from "path";
import fs from "fs";
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class Logger {
    constructor() {
        this.logFilePath = path.join(__dirname, 'requests.log');
        this.statistics = {};
        this.monthStart = this.getMonthStart();
        this.loadStatistics();
    }

    getMonthStart() {
        const now = new Date();
        // 每月第一天
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        monthStart.setHours(0, 0, 0, 0);
        return monthStart;
    }

    // 加载日志
    loadStatistics() {
        if (fs.existsSync(this.logFilePath)) {
            const data = fs.readFileSync(this.logFilePath, 'utf-8');
            const entries = data.split('\n').filter(line => line.trim());
            const validEntries = [];

            for (const line of entries) {
                try {
                    const logEntry = JSON.parse(line);
                    if (logEntry && logEntry.email && logEntry.time && logEntry.mode && logEntry.model !== undefined && logEntry.completed !== undefined && logEntry.unusualQueryVolume !== undefined) {
                        validEntries.push(logEntry);
                    } else {
                        console.warn(`忽略格式不正确的日志: ${line}`);
                    }
                } catch (e) {
                    console.warn(`无法解析的日志，已忽略: ${line}`);
                }
            }

            // 处理有效日志
            for (const logEntry of validEntries) {
                const logDate = new Date(logEntry.time);
                const email = logEntry.email || 'unknown';
                // 初始化邮箱
                if (!this.statistics[email]) {
                    this.statistics[email] = {
                        requests: [],
                        totalRequests: 0,
                        defaultModeCount: 0,
                        customModeCount: 0,
                        modelCount: {},
                    };
                }
                if (logDate >= this.monthStart) {
                    this.statistics[email].requests.push(logEntry);
                    this.updateStatistics(email, logEntry);
                }
            }

            // 每个邮箱时间排序
            for (const email in this.statistics) {
                this.statistics[email].requests.sort((a, b) => new Date(b.time) - new Date(a.time));
            }

            // 理无效数据
            const cleanedData = validEntries.map(entry => JSON.stringify(entry)).join('\n') + '\n';
            fs.writeFileSync(this.logFilePath, cleanedData);
        }
    }

    // 更新统计
    updateStatistics(email, logEntry) {
        const stats = this.statistics[email];
        stats.totalRequests++;
        if (logEntry.mode === 'default') {
            stats.defaultModeCount++;
        } else if (logEntry.mode === 'custom') {
            stats.customModeCount++;
        }

        if (logEntry.model) {
            if (!stats.modelCount[logEntry.model]) {
                stats.modelCount[logEntry.model] = 0;
            }
            stats.modelCount[logEntry.model]++;
        }
    }

    // 记录请求日志
    logRequest({ email, time, mode, model, completed, unusualQueryVolume }) {
        const logEntry = {
            email,  // 用户邮箱
            time,  // 请求时间
            mode,  // 请求模式
            model,  // 请求模型
            completed,  // 是否完成
            unusualQueryVolume,  // 是否异常请求量
        };

        // 写入日志
        fs.appendFileSync(this.logFilePath, JSON.stringify(logEntry) + '\n');

        // 当前月份请求更新统计
        const logDate = new Date(time);
        if (logDate >= this.monthStart) {
            const userEmail = email || 'unknown';
            if (!this.statistics[userEmail]) {
                this.statistics[userEmail] = {
                    requests: [],
                    totalRequests: 0,
                    defaultModeCount: 0,
                    customModeCount: 0,
                    modelCount: {},
                };
            }
            this.statistics[userEmail].requests.push(logEntry);
            // 对请求按照时间排序
            this.statistics[userEmail].requests.sort((a, b) => new Date(b.time) - new Date(a.time));
            this.updateStatistics(userEmail, logEntry);
        }
    }

    // 输出当前月份的统计信息
    printStatistics() {
        console.log('===== 请求统计信息 =====');
        console.log(`当前月份: ${this.monthStart.toLocaleDateString('zh-CN', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        })}`);
        const emails = Object.keys(this.statistics).sort();
        for (const email of emails) {
            const stats = this.statistics[email];
            console.log(`用户邮箱: ${email}`);
            console.log(`总请求次数: ${stats.totalRequests}`);
            console.log(`default 请求次数: ${stats.defaultModeCount}`);
            console.log(`custom 请求次数: ${stats.customModeCount}`);
            console.log('各模型请求次数:');
            for (const [model, count] of Object.entries(stats.modelCount)) {
                console.log(`  - ${model}: ${count}`);
            }
            console.log('------------------------------');
        }
        console.log('================================');
    }
}

export default Logger;