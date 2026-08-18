// 后端 API 统一封装
const API_BASE = '';

const request = async (url, options = {}) => {
    const res = await fetch(API_BASE + url, {
        headers: { 'Content-Type': 'application/json' },
        ...options
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
};

export const api = {
    // 获取命令树
    getCommands: () => request('/api/commands'),
    
    // 获取命令元数据
    getCommandSpecs: () => request('/api/command-specs'),
    
    // 获取目录（物品、附魔、药水）
    getCatalogs: () => request('/api/catalogs'),
    
    // 刷新目录
    refreshCatalogs: () => request('/api/catalogs/refresh', { method: 'POST' }),
    
    // RCON 连接
    connect: (host, port, password) => 
        request('/api/connect', {
            method: 'POST',
            body: JSON.stringify({ host, port, password })
        }),
    
    // 断开连接
    disconnect: () => request('/api/disconnect', { method: 'POST' }),
    
    // 发送命令
    sendCommand: (command) => 
        request('/api/send', {
            method: 'POST',
            body: JSON.stringify({ command })
        })
};