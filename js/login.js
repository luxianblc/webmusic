/* ===========================
   登录管理器（最终稳定版）
   =========================== */

class LoginManager {
    constructor() {
        this.qrKey = null;
        this.checkTimer = null;
        this.isLoggedIn = false;
        this.userInfo = null;
        this.cookie = null;

        this.loadLoginStatus();
        this.setupGlobalCSS();
        this.updateUserDisplay();
    }

    /* ---------- 本地状态 ---------- */

    loadLoginStatus() {
        const cookie = localStorage.getItem('netease_cookie');
        const userInfo = localStorage.getItem('netease_user_info');

        if (cookie) {
            this.cookie = cookie;
            this.isLoggedIn = true;
        }

        if (userInfo) {
            try {
                this.userInfo = JSON.parse(userInfo);
            } catch {
                this.userInfo = null;
            }
        }
    }

    saveLoginStatus() {
        if (this.cookie) {
            localStorage.setItem('netease_cookie', this.cookie);
        }
        if (this.userInfo) {
            localStorage.setItem(
                'netease_user_info',
                JSON.stringify(this.userInfo)
            );
        }
    }

    clearLoginStatus() {
        this.cookie = null;
        this.userInfo = null;
        this.isLoggedIn = false;

        localStorage.removeItem('netease_cookie');
        localStorage.removeItem('netease_user_info');

        if (this.checkTimer) {
            clearInterval(this.checkTimer);
            this.checkTimer = null;
        }

        this.updateUserDisplay();
    }

    /* ---------- UI ---------- */

    setupGlobalCSS() {
        if (document.getElementById('login-global-style')) return;

        const style = document.createElement('style');
        style.id = 'login-global-style';
        style.textContent = `
            .login-status-indicator::after {
                content: '';
                position: absolute;
                top: 2px;
                right: 2px;
                width: 8px;
                height: 8px;
                border-radius: 50%;
                background: #28a745;
            }
        `;
        document.head.appendChild(style);
    }

    updateUserDisplay() {
        const btn = document.querySelector('.login-btn');
        if (!btn) return;

        btn.classList.toggle(
            'login-status-indicator',
            this.isLoggedIn
        );

        if (this.isLoggedIn && this.userInfo?.profile) {
            const p = this.userInfo.profile;
            btn.innerHTML = p.avatarUrl
                ? `<img src="${p.avatarUrl}?param=30y30"><span>${p.nickname}</span>`
                : `<i class="fas fa-user"></i> ${p.nickname}`;
            btn.title = p.nickname;
        } else {
            btn.innerHTML = `<i class="fas fa-user"></i>`;
            btn.title = '点击登录';
        }
    }

    /* ---------- 弹窗 ---------- */

    showLoginModal() {
        if (this.isLoggedIn) {
            this.showUserMenu();
            return;
        }

        let modal = document.getElementById('loginModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'loginModal';
            modal.className = 'modal active';
            modal.innerHTML = `
                <div class="modal-content" style="max-width:320px;text-align:center;">
                    <h3>扫码登录</h3>
                    <div id="qrcodeContainer" style="display:none;">
                        <div id="qrcodeImage"></div>
                        <div id="qrcodeStatus">等待生成二维码</div>
                    </div>
                    <div style="margin-top:15px;">
                        <button class="btn-primary" id="qrBtn">开始二维码登录</button>
                        <button class="btn-secondary" id="qrStop">停止</button>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);

            modal.querySelector('#qrBtn').onclick = () => this.startQRLogin();
            modal.querySelector('#qrStop').onclick = () => this.stopQRLogin();
        }

        modal.classList.add('active');
    }

    closeLoginModal() {
        const modal = document.getElementById('loginModal');
        if (modal) modal.classList.remove('active');
        this.stopQRLogin();
    }

    /* ---------- API ---------- */

    api(endpoint, params = {}) {
        const base =
            localStorage.getItem('netease_api_base') ||
            'https://neteaseapi-enhanced.vercel.app';

        const q = new URLSearchParams({
            ...params,
            timestamp: Date.now(),
            randomCNIP: true
        });

        return `${base}${endpoint}?${q.toString()}`;
    }

    /* ---------- 二维码 ---------- */

    async startQRLogin() {
        const box = document.getElementById('qrcodeContainer');
        const img = document.getElementById('qrcodeImage');
        const status = document.getElementById('qrcodeStatus');

        box.style.display = 'block';
        status.textContent = '获取二维码中...';

        const keyRes = await fetch(this.api('/login/qr/key'));
        const keyData = await keyRes.json();

        this.qrKey = keyData.data.unikey;

        const qrRes = await fetch(
            this.api('/login/qr/create', {
                key: this.qrKey,
                qrimg: true
            })
        );
        const qrData = await qrRes.json();

        img.innerHTML = `<img src="${qrData.data.qrimg}" style="width:200px;">`;
        status.textContent = '等待扫码';

        this.pollQRStatus();
    }

    pollQRStatus() {
        if (this.checkTimer) clearInterval(this.checkTimer);

        this.checkTimer = setInterval(async () => {
            const res = await fetch(
                this.api('/login/qr/check', { key: this.qrKey })
            );
            const data = await res.json();

            if (data.code === 803) {
                clearInterval(this.checkTimer);
                this.cookie = data.cookie;
                this.isLoggedIn = true;
                await this.fetchUserInfo();
                this.saveLoginStatus();
                this.updateUserDisplay();
                this.closeLoginModal();
            }
        }, 2000);
    }

    stopQRLogin() {
        if (this.checkTimer) {
            clearInterval(this.checkTimer);
            this.checkTimer = null;
        }
    }

    /* ---------- 用户信息 ---------- */

    async fetchUserInfo() {
        const res = await fetch(
            this.api('/user/account', { cookie: this.cookie })
        );
        const data = await res.json();

        if (data.profile) {
            this.userInfo = {
                profile: data.profile
            };
        }
    }

    /* ---------- 用户菜单 ---------- */

    showUserMenu() {
        alert('已登录：' + this.userInfo?.profile?.nickname);
    }

    logout() {
        this.clearLoginStatus();
        alert('已退出登录');
    }
}

/* ===========================
   全局初始化（唯一）
   =========================== */

let loginManager = null;

function initLoginManager() {
    if (!loginManager) {
        loginManager = new LoginManager();
        window.loginManager = loginManager;
    }
}

window.login = function () {
    if (!loginManager) initLoginManager();
    loginManager.showLoginModal();
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initLoginManager);
} else {
    initLoginManager();
}

