// 安全转义，防止 XSS
export const escapeHtml = (str) => {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
};

// 防抖
export const debounce = (fn, delay = 150) => {
    let timer;
    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => fn(...args), delay);
    };
};

// 深拷贝
export const deepClone = (obj) => JSON.parse(JSON.stringify(obj));

// 本地存储封装
export const storage = {
    get: (key, def = null) => {
        try { return JSON.parse(localStorage.getItem(key)) ?? def; } 
        catch { return def; }
    },
    set: (key, val) => localStorage.setItem(key, JSON.stringify(val)),
    remove: (key) => localStorage.removeItem(key)
};