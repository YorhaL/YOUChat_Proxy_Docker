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
        this.today = this.getToday();
        this.loadStatistics();
    }

    getMonthStart() {
        const now = new Date();
        // 每月第一天
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        monthStart.setHours(0, 0, 0, 0);
        return monthStart;
    }

    getToday() {
        const now = new Date();
        // 获取当天日期
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        today.setHours(0, 0, 0, 0);
        return today;
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

                    // 补全缺少的字段
                    if (!logEntry.provider) {
                        logEntry.provider = 'you';
                    }
                    if (!logEntry.email) {
                        logEntry.email = 'unknown';
                    }
                    if (!logEntry.mode) {
                        logEntry.mode = 'default';
                    }
                    if (logEntry.model === undefined) {
                        logEntry.model = 'unknown';
                    }
                    if (logEntry.completed === undefined) {
                        logEntry.completed = false;
                    }
                    if (logEntry.unusualQueryVolume === undefined) {
                        logEntry.unusualQueryVolume = false;
                    }

                    // 调整字段顺序
                    const logEntryArray = [
                        ['provider', logEntry.provider],
                        ['email', logEntry.email],
                        ['time', logEntry.time],
                        ['mode', logEntry.mode],
                        ['model', logEntry.model],
                        ['completed', logEntry.completed],
                        ['unusualQueryVolume', logEntry.unusualQueryVolume],
                    ];
                    const formattedLogEntry = Object.fromEntries(logEntryArray);

                    validEntries.push(formattedLogEntry);
                } catch (e) {
                    console.warn(`无法解析的日志，已忽略: ${line}`);
                }
            }

            // 处理有效日志
            for (const logEntry of validEntries) {
                const logDate = new Date(logEntry.time);
                const provider = logEntry.provider;
                const email = logEntry.email;

                // 初始化 provider
                if (!this.statistics[provider]) {
                    this.statistics[provider] = {};
                }

                // 初始化邮箱
                if (!this.statistics[provider][email]) {
                    this.statistics[provider][email] = {
                        allRequests: [],     // 所有请求
                        monthlyRequests: [], // 本月请求
                        dailyRequests: [],   // 当日请求
                        monthlyStats: {
                            totalRequests: 0,
                            defaultModeCount: 0,
                            customModeCount: 0,
                            modelCount: {},
                        },
                        dailyStats: {
                            totalRequests: 0,
                            defaultModeCount: 0,
                            customModeCount: 0,
                            modelCount: {},
                        }
                    };
                }

                const stats = this.statistics[provider][email];
                stats.allRequests.push(logEntry);

                // 本月统计
                if (logDate >= this.monthStart) {
                    stats.monthlyRequests.push(logEntry);
                    this.updateStatistics(stats.monthlyStats, logEntry);
                }

                // 当日统计
                if (logDate >= this.today) {
                    stats.dailyRequests.push(logEntry);
                    this.updateStatistics(stats.dailyStats, logEntry);
                }
            }

            // 对每个 provider 的每个邮箱时间排序
            for (const provider in this.statistics) {
                for (const email in this.statistics[provider]) {
                    const stats = this.statistics[provider][email];
                    stats.allRequests.sort((a, b) => new Date(b.time) - new Date(a.time));
                    stats.monthlyRequests.sort((a, b) => new Date(b.time) - new Date(a.time));
                    stats.dailyRequests.sort((a, b) => new Date(b.time) - new Date(a.time));
                }
            }

            // 清理无效数据
            const cleanedData = validEntries.map(entry => JSON.stringify(entry)).join('\n') + '\n';
            fs.writeFileSync(this.logFilePath, cleanedData);
        }
    }

    // 更新统计
    updateStatistics(stats, logEntry) {
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
    logRequest({ provider, email, time, mode, model, completed, unusualQueryVolume }) {
        provider = provider || process.env.ACTIVE_PROVIDER || 'you';
        const logEntryArray = [
            ['provider', provider], // 提供者名称
            ['email', email], // 用户邮箱
            ['time', time], // 请求时间
            ['mode', mode], // 请求模式
            ['model', model], // 请求模型
            ['completed', completed], // 是否完成
            ['unusualQueryVolume', unusualQueryVolume], // 是否异常请求量
        ];
        const logEntry = Object.fromEntries(logEntryArray);
        // 写入日志
        fs.appendFileSync(this.logFilePath, JSON.stringify(logEntry) + '\n');

        // 当前月份请求更新统计
        const logDate = new Date(time);
        if (logDate >= this.monthStart) {
            // 初始化 provider
            if (!this.statistics[provider]) {
                this.statistics[provider] = {};
            }

            const userEmail = email || 'unknown';
            if (!this.statistics[provider][userEmail]) {
                this.statistics[provider][userEmail] = {
                    allRequests: [],
                    monthlyRequests: [],
                    dailyRequests: [],
                    monthlyStats: {
                        totalRequests: 0,
                        defaultModeCount: 0,
                        customModeCount: 0,
                        modelCount: {},
                    },
                    dailyStats: {
                        totalRequests: 0,
                        defaultModeCount: 0,
                        customModeCount: 0,
                        modelCount: {},
                    }
                };
            }

            const stats = this.statistics[provider][userEmail];
            stats.allRequests.push(logEntry);

            // 当日统计
            if (logDate >= this.today) {
                stats.dailyRequests.push(logEntry);
                this.updateStatistics(stats.dailyStats, logEntry);
            }

            // 本月统计
            stats.monthlyRequests.push(logEntry);
            this.updateStatistics(stats.monthlyStats, logEntry);
        }
    }

    // 输出当前统计信息
    printStatistics() {
        const provider = process.env.ACTIVE_PROVIDER || 'you';
        const monthStart = this.monthStart.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' });
        const today = this.today.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' });
        if (!this.statistics[provider]) {
            console.log(`===== 提供者 ${provider} 没有统计数据 =====`);
            return;
        }
        console.log(`===== 请求统计信息 (${provider}) =====`);
        const emails = Object.keys(this.statistics[provider]).sort();
        for (const email of emails) {
            const stats = this.statistics[provider][email];
            console.log(`用户邮箱: ${email}`);
            console.log(`---------- 本月[${monthStart}]统计 ----------`);
            console.log(`总请求次数: ${stats.monthlyStats.totalRequests}`);
            console.log(`default 请求次数: ${stats.monthlyStats.defaultModeCount}`);
            console.log(`custom 请求次数: ${stats.monthlyStats.customModeCount}`);
            console.log('各模型请求次数:');
            for (const [model, count] of Object.entries(stats.monthlyStats.modelCount)) {
                console.log(`  - ${model}: ${count}`);
            }
            console.log(`---------- 今日[${today}]统计 ----------`);
            console.log(`总请求次数: ${stats.dailyStats.totalRequests}`);
            console.log(`default 请求次数: ${stats.dailyStats.defaultModeCount}`);
            console.log(`custom 请求次数: ${stats.dailyStats.customModeCount}`);
            console.log('各模型请求次数:');
            for (const [model, count] of Object.entries(stats.dailyStats.modelCount)) {
                console.log(`  - ${model}: ${count}`);
            }
            console.log('------------------------------');
        }
        console.log('================================');
    }
}

export default Logger;
