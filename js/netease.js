// 全局变量
let API_BASE = 'https://neteaseapi-enhanced.vercel.app';
let currentTheme = 'auto';

// 初始化应用
function initApp() {
    loadSettings();
    setupTheme();
    loadRecommendations();
}

// 设置主题
function setupTheme() {
    const savedTheme = localStorage.getItem('netease_theme') || 'auto';
    currentTheme = savedTheme;
    
    if (savedTheme === 'auto') {
        // 自动检测系统主题
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
    } else {
        document.documentElement.setAttribute('data-theme', savedTheme);
    }
}

// 切换主题
function toggleTheme() {
    const themes = ['auto', 'light', 'dark'];
    const currentIndex = themes.indexOf(currentTheme);
    const nextTheme = themes[(currentIndex + 1) % themes.length];
    
    currentTheme = nextTheme;
    localStorage.setItem('netease_theme', nextTheme);
    
    if (nextTheme === 'auto') {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
    } else {
        document.documentElement.setAttribute('data-theme', nextTheme);
    }
    
    // 更新主题按钮图标
    const themeBtn = document.querySelector('.theme-toggle');
    if (themeBtn) {
        const icon = themeBtn.querySelector('i');
        if (nextTheme === 'dark') {
            icon.className = 'fas fa-sun';
        } else if (nextTheme === 'light') {
            icon.className = 'fas fa-moon';
        } else {
            // auto - 显示系统图标
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            icon.className = prefersDark ? 'fas fa-adjust' : 'fas fa-adjust';
        }
    }
}

// 切换页面
function switchSection(sectionId) {
    // 更新导航
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });
    document.querySelector(`.nav-item[href="#${sectionId}"]`).classList.add('active');
    
    // 显示对应内容
    document.querySelectorAll('.content-section').forEach(section => {
        section.classList.remove('active');
    });
    document.getElementById(sectionId).classList.add('active');
}

// 加载推荐内容
async function loadRecommendations() {
    const playlistsGrid = document.getElementById('playlistsGrid');
    if (!playlistsGrid) return;
    
    playlistsGrid.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
    
    try {
        const url = buildApiUrl('/top/playlist', { limit: 6 });
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.code === 200 && data.playlists) {
            let html = '';
            data.playlists.forEach(playlist => {
                html += `
                    <div class="playlist-card">
                        <img src="${playlist.coverImgUrl}?param=200y200" alt="${playlist.name}">
                        <div class="playlist-info">
                            <h4>${playlist.name}</h4>
                            <p>${playlist.trackCount}首歌曲</p>
                        </div>
                    </div>
                `;
            });
            playlistsGrid.innerHTML = html;
        }
    } catch (error) {
        console.error('加载推荐失败:', error);
        playlistsGrid.innerHTML = '<div class="error">加载失败</div>';
    }
}

// 加载热门歌曲
async function loadHotSongs() {
    switchSection('search');
    const searchInput = document.getElementById('searchInput');
    searchInput.value = '热门歌曲';
    performSearch();
}

// 登录功能
function login() {
    alert('登录功能开发中...');
}

// 加载设置
function loadSettings() {
    const savedApiBase = localStorage.getItem('netease_api_base');
    if (savedApiBase) {
        API_BASE = savedApiBase;
    }
}

// 构建API URL
function buildApiUrl(endpoint, params = {}) {
    const timestamp = Date.now();
    const baseParams = `timestamp=${timestamp}&randomCNIP=true`;
    const queryParams = new URLSearchParams();
    
    Object.keys(params).forEach(key => {
        if (params[key] !== null && params[key] !== undefined) {
            queryParams.append(key, params[key]);
        }
    });
    
    const queryString = queryParams.toString();
    return `${API_BASE}${endpoint}?${baseParams}${queryString ? '&' + queryString : ''}`;
}

// API配置相关
function toggleApiConfig() {
    const modal = document.getElementById('apiConfigModal');
    modal.classList.toggle('active');
    
    const input = document.getElementById('apiBaseUrl');
    input.value = API_BASE;
}

function updateApiBase() {
    const newApiBase = document.getElementById('apiBaseUrl').value.trim();
    if (!newApiBase) {
        alert('请输入API地址');
        return;
    }
    
    API_BASE = newApiBase;
    localStorage.setItem('netease_api_base', newApiBase);
    toggleApiConfig();
    alert('API地址已更新');
}

// 系统主题变化监听
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    if (currentTheme === 'auto') {
        document.documentElement.setAttribute('data-theme', e.matches ? 'dark' : 'light');
    }
});
// 在netease.js中添加这些函数
function setupSearch() {
    // 确保搜索输入框获得焦点时显示建议
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('focus', function() {
            if (this.value.length > 0 && enhancedSearch) {
                enhancedSearch.showSearchSuggestions(this.value);
            }
        });
    }
    
    // 监听搜索类型变化
    const searchType = document.getElementById('searchType');
    if (searchType && enhancedSearch) {
        searchType.addEventListener('change', () => enhancedSearch.updateSearchType());
    }
}

// 在initApp函数中调用
function initApp() {
    loadSettings();
    setupTheme();
    loadRecommendations();
    setupSearch(); // 添加这一行
}
