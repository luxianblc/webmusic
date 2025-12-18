// 登录管理器 - 优化版（参考API测试平台）
class LoginManager {
    constructor() {
        this.qrKey = null;
        this.checkTimer = null;
        this.isLoggedIn = false;
        this.userInfo = null;
        this.cookie = null;
        this.isChecking = false;
        
        this.init();
    }
    
    init() {
        this.loadLoginStatus();
        this.bindEvents();
        this.setupGlobalCSS();
    }
    
    bindEvents() {
        // 监听登录按钮点击
        const loginBtn = document.querySelector('.login-btn');
        if (loginBtn) {
            loginBtn.addEventListener('click', () => this.showLoginModal());
        }
    }
    
    setupGlobalCSS() {
        // 添加一些必要的全局样式
        if (!document.querySelector('#login-global-styles')) {
            const style = document.createElement('style');
            style.id = 'login-global-styles';
            style.textContent = `
                .login-status-indicator {
                    position: relative;
                }
                
                .login-status-indicator::after {
                    content: '';
                    position: absolute;
                    top: -3px;
                    right: -3px;
                    width: 10px;
                    height: 10px;
                    border-radius: 50%;
                    background-color: #28a745;
                    border: 2px solid var(--card-bg);
                    display: none;
                }
                
                .login-status-indicator.logged-in::after {
                    display: block;
                }
            `;
            document.head.appendChild(style);
        }
    }
    
    loadLoginStatus() {
        // 从本地存储加载登录状态
        const savedCookie = localStorage.getItem('netease_cookie');
        const savedUserInfo = localStorage.getItem('netease_user_info');
        
        if (savedCookie) {
            this.cookie = savedCookie;
            this.isLoggedIn = true;
            
            if (savedUserInfo) {
                this.userInfo = JSON.parse(savedUserInfo);
                this.updateUserDisplay();
            } else {
                // 如果cookie存在但用户信息不存在，重新获取
                this.fetchUserInfo();
            }
        }
    }
    
    saveLoginStatus() {
        if (this.cookie) {
            localStorage.setItem('netease_cookie', this.cookie);
        }
        if (this.userInfo) {
            localStorage.setItem('netease_user_info', JSON.stringify(this.userInfo));
        }
    }
    
    clearLoginStatus() {
        this.cookie = null;
        this.userInfo = null;
        this.isLoggedIn = false;
        this.isChecking = false;
        
        localStorage.removeItem('netease_cookie');
        localStorage.removeItem('netease_user_info');
        
        this.updateUserDisplay();
        
        // 清除定时器
        if (this.checkTimer) {
            clearInterval(this.checkTimer);
            this.checkTimer = null;
        }
    }
    
    async showLoginModal() {
        if (this.isLoggedIn) {
            this.showUserMenu();
            return;
        }
        
        // 创建或显示登录弹窗
        let modal = document.getElementById('loginModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'loginModal';
            modal.className = 'modal';
            modal.innerHTML = `
                <div class="modal-content" style="max-width: 320px; text-align: center;">
                    <h3><i class="fas fa-user-circle"></i> 扫码登录</h3>
                    <div class="login-instruction" style="color: #666; margin-bottom: 20px; line-height: 1.6; font-size: 14px;">
                        使用网易云音乐APP扫码登录，获取完整功能权限
                    </div>
                    
                    <div id="qrcodeContainer" style="text-align: center; padding: 20px; background: #f8f9fa; border-radius: 15px; margin: 15px 0; display: none;">
                        <div id="qrcodeImage" style="max-width: 200px; height: 200px; margin: 0 auto 15px; padding: 15px; background: white; border-radius: 10px; box-shadow: 0 5px 15px rgba(0,0,0,0.05); border: 1px solid #e9ecef;"></div>
                        <div id="qrcodeStatus" class="status-box" style="padding: 12px; border-radius: 8px; margin: 10px 0; display: flex; align-items: center; gap: 10px; font-size: 14px; background: #f8f9fa; border-left: 4px solid #17a2b8;">
                            <i class="fas fa-sync-alt fa-spin"></i>
                            <span>正在生成二维码...</span>
                        </div>
                        <div style="font-size: 12px; color: #999; margin-top: 10px;">
                            时间戳: <span id="qrTimestamp"></span>
                        </div>
                    </div>
                    
                    <div class="modal-actions" style="display: flex; gap: 10px; justify-content: center; margin-top: 20px;">
                        <button class="btn-primary" onclick="loginManager.startQRLogin()" id="qrLoginBtn" style="padding: 12px 24px;">
                            <i class="fas fa-qrcode"></i> 开始二维码登录
                        </button>
                        <button class="btn-secondary" onclick="loginManager.stopQRLogin()" style="padding: 12px 24px;">
                            <i class="fas fa-stop"></i> 停止轮询
                        </button>
                    </div>
                    
                    <div id="qrResult" style="display: none; margin-top: 20px; padding: 15px; background: #f8f9fa; border-radius: 10px;">
                        <h4 style="color: #28a745; margin-bottom: 10px; display: flex; align-items: center; gap: 8px;">
                            <i class="fas fa-check-circle"></i> 登录成功
                        </h4>
                        <div id="qrData" style="font-size: 14px; color: #666;"></div>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
        }
        
        modal.classList.add('active');
    }
    
    closeLoginModal() {
        const modal = document.getElementById('loginModal');
        if (modal) {
            modal.classList.remove('active');
        }
        
        this.stopQRLogin();
    }
    
    async startQRLogin() {
        const qrLoginBtn = document.getElementById('qrLoginBtn');
        const qrcodeContainer = document.getElementById('qrcodeContainer');
        
        if (!qrLoginBtn || !qrcodeContainer) {
            this.showLoginModal();
            setTimeout(() => this.startQRLogin(), 100);
            return;
        }
        
        qrLoginBtn.disabled = true;
        qrLoginBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 处理中...';
        
        qrcodeContainer.style.display = 'block';
        document.getElementById('qrTimestamp').textContent = Date.now();
        
        try {
            // 1. 获取二维码key
            this.updateQRStatus('正在获取二维码密钥...', 'waiting');
            
            const keyUrl = buildApiUrl('/login/qr/key', { timestamp: Date.now() });
            const keyResponse = await fetch(keyUrl);
            const keyData = await keyResponse.json();
            
            if (keyData.code !== 200) {
                throw new Error(`获取二维码key失败: ${keyData.message || '未知错误'}`);
            }
            
            this.qrKey = keyData.data.unikey;
            this.updateQRStatus('正在生成二维码...', 'waiting');
            
            // 2. 生成二维码
            const qrUrl = buildApiUrl('/login/qr/create', { 
                key: this.qrKey, 
                qrimg: true,
                timestamp: Date.now()
            });
            const qrResponse = await fetch(qrUrl);
            const qrData = await qrResponse.json();
            
            if (qrData.code !== 200) {
                throw new Error(`生成二维码失败: ${qrData.message || '未知错误'}`);
            }
            
            // 显示二维码
            const qrcodeImage = document.getElementById('qrcodeImage');
            qrcodeImage.innerHTML = `<img src="${qrData.data.qrimg}" alt="扫码登录二维码" style="width: 100%; height: 100%; object-fit: contain; border-radius: 8px;">`;
            
            // 3. 开始轮询扫码状态
            this.startPollingQRStatus();
            
        } catch (error) {
            this.updateQRStatus(`错误: ${error.message}`, 'error');
            qrLoginBtn.disabled = false;
            qrLoginBtn.innerHTML = '<i class="fas fa-qrcode"></i> 开始二维码登录';
        }
    }
    
    // 更新二维码状态显示
    updateQRStatus(message, type = 'info') {
        const statusDiv = document.getElementById('qrcodeStatus');
        if (!statusDiv) return;
        
        let icon = '';
        let bgColor = '';
        let borderColor = '';
        
        switch(type) {
            case 'success':
                icon = '<i class="fas fa-check-circle"></i>';
                bgColor = '#d4edda';
                borderColor = '#28a745';
                break;
            case 'error':
                icon = '<i class="fas fa-exclamation-circle"></i>';
                bgColor = '#f8d7da';
                borderColor = '#dc3545';
                break;
            case 'info':
                icon = '<i class="fas fa-info-circle"></i>';
                bgColor = '#d1ecf1';
                borderColor = '#17a2b8';
                break;
            case 'waiting':
                icon = '<i class="fas fa-sync-alt fa-spin"></i>';
                bgColor = '#fff3cd';
                borderColor = '#ffc107';
                break;
        }
        
        statusDiv.innerHTML = `${icon}<span>${message}</span>`;
        statusDiv.style.background = bgColor;
        statusDiv.style.borderLeftColor = borderColor;
        statusDiv.style.display = 'flex';
    }
    
    // 轮询二维码扫码状态
    startPollingQRStatus() {
        if (this.checkTimer) {
            clearInterval(this.checkTimer);
        }
        
        this.checkTimer = setInterval(async () => {
            try {
                const checkUrl = buildApiUrl('/login/qr/check', { 
                    key: this.qrKey,
                    timestamp: Date.now()
                });
                const checkResponse = await fetch(checkUrl);
                const checkData = await checkResponse.json();
                
                if (checkData.code === 800) {
                    // 二维码过期
                    this.updateQRStatus('二维码已过期，请重新生成', 'error');
                    clearInterval(this.checkTimer);
                    this.checkTimer = null;
                    const qrLoginBtn = document.getElementById('qrLoginBtn');
                    if (qrLoginBtn) {
                        qrLoginBtn.disabled = false;
                        qrLoginBtn.innerHTML = '<i class="fas fa-qrcode"></i> 开始二维码登录';
                    }
                } else if (checkData.code === 801) {
                    // 等待扫码
                    this.updateQRStatus('等待扫码...', 'waiting');
                } else if (checkData.code === 802) {
                    // 已扫码，等待确认
                    this.updateQRStatus('已扫码，请在APP中确认登录', 'success');
                } else if (checkData.code === 803) {
                    // 登录成功
                    clearInterval(this.checkTimer);
                    this.checkTimer = null;
                    
                    // 保存Cookie
                    this.cookie = checkData.cookie;
                    this.isLoggedIn = true;
                    this.saveLoginStatus();
                    
                    this.updateQRStatus('登录成功！正在获取用户信息...', 'success');
                    
                    // 显示登录结果
                    const qrDataDiv = document.getElementById('qrData');
                    if (qrDataDiv) {
                        qrDataDiv.innerHTML = `
                            <div style="margin-bottom: 5px;">用户Cookie已保存到本地存储</div>
                            <div>现在可以体验完整功能了</div>
                        `;
                    }
                    
                    const qrResultDiv = document.getElementById('qrResult');
                    if (qrResultDiv) {
                        qrResultDiv.style.display = 'block';
                    }
                    
                    // 获取用户信息
                    const userInfo = await this.fetchUserInfo();
                    if (userInfo) {
                        // 更新按钮显示
                        this.updateUserDisplay();
                        
                        // 关闭弹窗
                        setTimeout(() => {
                            this.closeLoginModal();
                        }, 1500);
                    }
                    
                    // 重置按钮
                    const qrLoginBtn = document.getElementById('qrLoginBtn');
                    if (qrLoginBtn) {
                        qrLoginBtn.disabled = false;
                        qrLoginBtn.innerHTML = '<i class="fas fa-qrcode"></i> 开始二维码登录';
                    }
                } else {
                    this.updateQRStatus(`未知状态: ${checkData.code}`, 'error');
                }
            } catch (error) {
                console.error('轮询失败:', error);
                this.updateQRStatus('轮询失败，请检查网络', 'error');
            }
        }, 2000);
    }
    
    stopQRLogin() {
        if (this.checkTimer) {
            clearInterval(this.checkTimer);
            this.checkTimer = null;
        }
        
        const qrcodeContainer = document.getElementById('qrcodeContainer');
        if (qrcodeContainer) {
            qrcodeContainer.style.display = 'none';
        }
        
        const qrLoginBtn = document.getElementById('qrLoginBtn');
        if (qrLoginBtn) {
            qrLoginBtn.disabled = false;
            qrLoginBtn.innerHTML = '<i class="fas fa-qrcode"></i> 开始二维码登录';
        }
    }
    
    async fetchUserInfo() {
        if (!this.cookie) return null;
        
        try {
            // 获取账户基本信息
            const accountUrl = buildApiUrl('/user/account', { timestamp: Date.now() });
            const accountResponse = await fetch(accountUrl, {
                headers: {
                    'Cookie': this.cookie
                }
            });
            
            const accountData = await accountResponse.json();
            
            if (accountData.code === 200 && accountData.account) {
                // 获取用户详细信息（歌单数量等）
                const detailUrl = buildApiUrl('/user/subcount', { timestamp: Date.now() });
                const detailResponse = await fetch(detailUrl, {
                    headers: {
                        'Cookie': this.cookie
                    }
                });
                
                const detailData = await detailResponse.json();
                
                // 合并用户信息
                this.userInfo = {
                    ...accountData.account,
                    profile: accountData.profile || {},
                    subCount: detailData.code === 200 ? detailData : null
                };
                
                this.saveLoginStatus();
                return this.userInfo;
            }
        } catch (error) {
            console.error('获取用户信息失败:', error);
        }
        
        return null;
    }
    
    updateUserDisplay() {
        const loginBtn = document.querySelector('.login-btn');
        if (!loginBtn) return;
        
        // 添加状态指示器类
        loginBtn.classList.toggle('login-status-indicator', this.isLoggedIn);
        loginBtn.classList.toggle('logged-in', this.isLoggedIn);
        
        if (this.isLoggedIn && this.userInfo) {
            // 更新按钮显示用户信息
            const profile = this.userInfo.profile;
            if (profile) {
                // 如果有头像，显示头像
                if (profile.avatarUrl) {
                    loginBtn.innerHTML = `
                        <img src="${profile.avatarUrl}?param=30y30" 
                             style="width: 24px; height: 24px; border-radius: 50%; margin-right: 5px; border: 2px solid white; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
                        <span style="max-width: 80px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${profile.nickname || '用户'}</span>
                    `;
                } else {
                    loginBtn.innerHTML = `<i class="fas fa-user"></i> ${profile.nickname || '用户'}`;
                }
                
                // 添加鼠标悬停效果
                loginBtn.title = `${profile.nickname || '用户'}\n点击查看用户信息`;
            }
        } else {
            // 恢复默认登录按钮
            loginBtn.innerHTML = `<i class="fas fa-user"></i>`;
            loginBtn.title = '点击登录';
        }
    }
    
    showUserMenu() {
        if (!this.userInfo) return;
        
        // 创建用户菜单
        let menu = document.getElementById('userMenu');
        if (!menu) {
            menu = document.createElement('div');
            menu.id = 'userMenu';
            menu.className = 'user-menu';
            menu.style.cssText = `
                position: absolute;
                top: 60px;
                right: 20px;
                background: var(--card-bg);
                border-radius: 15px;
                box-shadow: 0 10px 30px rgba(0,0,0,0.15);
                min-width: 250px;
                z-index: 1000;
                display: none;
                border: 1px solid var(--border-color);
                overflow: hidden;
                animation: fadeIn 0.2s ease;
            `;
            
            document.body.appendChild(menu);
        }
        
        const profile = this.userInfo.profile || {};
        const subCount = this.userInfo.subCount || {};
        
        menu.innerHTML = `
            <div style="padding: 20px; border-bottom: 1px solid var(--border-color); background: linear-gradient(135deg, rgba(230,0,38,0.05), rgba(255,45,85,0.05));">
                <div style="display: flex; align-items: center; gap: 15px;">
                    ${profile.avatarUrl ? 
                        `<img src="${profile.avatarUrl}?param=50y50" style="width: 50px; height: 50px; border-radius: 50%; border: 3px solid white; box-shadow: 0 3px 10px rgba(0,0,0,0.1);">` : 
                        `<div style="width: 50px; height: 50px; background: linear-gradient(135deg, #e60026, #ff2d55); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; box-shadow: 0 3px 10px rgba(230,0,38,0.3);">
                            <i class="fas fa-user" style="font-size: 1.2rem;"></i>
                        </div>`
                    }
                    <div>
                        <div style="font-weight: bold; font-size: 1.1rem; margin-bottom: 5px;">${profile.nickname || '用户'}</div>
                        <div style="font-size: 12px; color: #666; display: flex; align-items: center; gap: 5px;">
                            <i class="fas fa-id-card"></i> UID: ${profile.userId || '未知'}
                        </div>
                    </div>
                </div>
            </div>
            
            <div style="padding: 20px; border-bottom: 1px solid var(--border-color);">
                <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px;">
                    <div style="text-align: center;">
                        <div style="font-size: 1.5rem; font-weight: bold; color: var(--primary-color); margin-bottom: 5px;">
                            ${subCount.createdPlaylistCount || 0}
                        </div>
                        <div style="font-size: 12px; color: #666;">创建歌单</div>
                    </div>
                    <div style="text-align: center;">
                        <div style="font-size: 1.5rem; font-weight: bold; color: var(--primary-color); margin-bottom: 5px;">
                            ${subCount.subPlaylistCount || 0}
                        </div>
                        <div style="font-size: 12px; color: #666;">收藏歌单</div>
                    </div>
                    <div style="text-align: center;">
                        <div style="font-size: 1.5rem; font-weight: bold; color: var(--primary-color); margin-bottom: 5px;">
                            ${subCount.mvCount || 0}
                        </div>
                        <div style="font-size: 12px; color: #666;">MV数量</div>
                    </div>
                    <div style="text-align: center;">
                        <div style="font-size: 1.5rem; font-weight: bold; color: var(--primary-color); margin-bottom: 5px;">
                            ${subCount.djRadioCount || 0}
                        </div>
                        <div style="font-size: 12px; color: #666;">电台数量</div>
                    </div>
                </div>
            </div>
            
            <div style="padding: 15px;">
                <button onclick="loginManager.logout()" 
                        style="width: 100%; padding: 12px; background: transparent; border: 1px solid var(--border-color); 
                               border-radius: 8px; color: var(--text-color); cursor: pointer; font-weight: 500; display: flex; align-items: center; justify-content: center; gap: 8px; transition: all 0.3s;">
                    <i class="fas fa-sign-out-alt"></i> 退出登录
                </button>
            </div>
        `;
        
        // 显示/隐藏菜单
        if (menu.style.display === 'block') {
            menu.style.display = 'none';
        } else {
            menu.style.display = 'block';
            
            // 添加淡入动画样式
            if (!document.querySelector('#fadeIn-style')) {
                const style = document.createElement('style');
                style.id = 'fadeIn-style';
                style.textContent = `
                    @keyframes fadeIn {
                        from {
                            opacity: 0;
                            transform: translateY(-10px);
                        }
                        to {
                            opacity: 1;
                            transform: translateY(0);
                        }
                    }
                `;
                document.head.appendChild(style);
            }
            
            // 点击其他地方关闭菜单
            setTimeout(() => {
                const closeMenu = (e) => {
                    if (!menu.contains(e.target) && !document.querySelector('.login-btn').contains(e.target)) {
                        menu.style.display = 'none';
                        document.removeEventListener('click', closeMenu);
                    }
                };
                document.addEventListener('click', closeMenu);
            }, 10);
        }
    }
    
    logout() {
        // 清除登录状态
        this.clearLoginStatus();
        
        // 隐藏用户菜单
        const menu = document.getElementById('userMenu');
        if (menu) {
            menu.style.display = 'none';
        }
        
        // 更新按钮显示
        this.updateUserDisplay();
        
        // 提示
        this.showNotification('已退出登录', 'success');
    }
    
    // 显示通知
    showNotification(message, type = 'info') {
        // 创建通知元素
        let notification = document.createElement('div');
        notification.id = 'loginNotification';
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 20px;
            border-radius: 8px;
            color: white;
            font-weight: 500;
            z-index: 10000;
            display: flex;
            align-items: center;
            gap: 10px;
            box-shadow: 0 5px 15px rgba(0,0,0,0.2);
            animation: slideIn 0.3s ease;
        `;
        
        switch(type) {
            case 'success':
                notification.style.background = 'linear-gradient(135deg, #28a745, #20c997)';
                break;
            case 'error':
                notification.style.background = 'linear-gradient(135deg, #dc3545, #e83e8c)';
                break;
            case 'info':
                notification.style.background = 'linear-gradient(135deg, #17a2b8, #20c997)';
                break;
        }
        
        notification.innerHTML = `
            <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
            <span>${message}</span>
        `;
        
        document.body.appendChild(notification);
        
        // 3秒后移除通知
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 3000);
        
        // 添加动画样式
        if (!document.querySelector('#notification-animations')) {
            const style = document.createElement('style');
            style.id = 'notification-animations';
            style.textContent = `
                @keyframes slideIn {
                    from {
                        transform: translateX(100%);
                        opacity: 0;
                    }
                    to {
                        transform: translateX(0);
                        opacity: 1;
                    }
                }
                
                @keyframes slideOut {
                    from {
                        transform: translateX(0);
                        opacity: 1;
                    }
                    to {
                        transform: translateX(100%);
                        opacity: 0;
                    }
                }
            `;
            document.head.appendChild(style);
        }
    }
    
    // 获取带有cookie的API URL（用于需要登录的接口）
    getApiUrlWithCookie(endpoint, params = {}) {
        if (!this.cookie) {
            return buildApiUrl(endpoint, params);
        }
        
        const url = buildApiUrl(endpoint, {
            ...params,
            timestamp: Date.now()
        });
        
        return {
            url: url,
            options: {
                headers: {
                    'Cookie': this.cookie
                }
            }
        };
    }
    
    // 检查是否已登录
    checkLogin() {
        return this.isLoggedIn;
    }
    
    // 获取用户信息
    getUserInfo() {
        return this.userInfo;
    }
}

// 创建登录管理器实例
let loginManager;

// 初始化登录管理器
function initLoginManager() {
    loginManager = new LoginManager();
}

// 暴露全局函数
window.login = () => loginManager.showLoginModal();
window.loginManager = loginManager;

// 在页面加载完成后初始化
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initLoginManager);
} else {
    initLoginManager();
}

// 辅助函数：自动为需要登录的接口添加cookie
async function fetchWithLogin(endpoint, params = {}) {
    if (!loginManager) {
        throw new Error('登录管理器未初始化');
    }
    
    if (loginManager.checkLogin()) {
        const { url, options } = loginManager.getApiUrlWithCookie(endpoint, params);
        const response = await fetch(url, options);
        return await response.json();
    } else {
        // 未登录，使用普通API
        const url = buildApiUrl(endpoint, params);
        const response = await fetch(url);
        return await response.json();
    }
}
