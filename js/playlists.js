/* ===========================
   我的歌单管理器
   =========================== */

class PlaylistManager {
    constructor() {
        this.userPlaylists = [];
        this.currentPlaylist = null;
        this.currentPlaylistSongs = [];
        this.isLoading = false;
        
        this.init();
    }

    init() {
        this.bindEvents();
        
        // 监听登录状态变化
        document.addEventListener('loginStatusChanged', () => {
            this.loadUserPlaylists();
        });
        
        // 如果已经登录，加载歌单
        if (window.loginManager?.checkLogin()) {
            setTimeout(() => this.loadUserPlaylists(), 1000);
        }
    }

    bindEvents() {
        // 监听歌单页面切换
        const playlistsNav = document.querySelector('.nav-item[href="#playlists"]');
        if (playlistsNav) {
            playlistsNav.addEventListener('click', () => {
                this.onPlaylistsPageOpen();
            });
        }
    }

    // 歌单页面打开时的处理
    onPlaylistsPageOpen() {
        if (window.loginManager?.checkLogin()) {
            this.loadUserPlaylists();
        } else {
            this.showLoginPrompt();
        }
    }

    // 显示登录提示
    showLoginPrompt() {
        const playlistsContent = document.getElementById('playlistsContent');
        if (!playlistsContent) return;

        playlistsContent.innerHTML = `
            <div class="login-prompt">
                <div class="prompt-icon">
                    <i class="fas fa-music"></i>
                </div>
                <h3>查看我的歌单</h3>
                <p>登录后可以查看和管理您的网易云音乐歌单</p>
                <button onclick="window.login()" class="btn-primary">
                    <i class="fas fa-sign-in-alt"></i> 立即登录
                </button>
            </div>
        `;
    }

    // 加载用户歌单
    async loadUserPlaylists() {
        try {
            // 检查登录状态
            if (!window.loginManager?.checkLogin()) {
                this.showLoginPrompt();
                return;
            }

            const userInfo = window.loginManager.getUserInfo();
            if (!userInfo?.profile?.userId) {
                console.error('无法获取用户ID');
                return;
            }

            const userId = userInfo.profile.userId;
            this.showLoading();

            // 获取用户歌单
            const data = await this.fetchUserPlaylists(userId);
            
            if (data.code === 200 && data.playlist) {
                this.userPlaylists = data.playlist;
                this.renderPlaylists();
            } else {
                throw new Error(data.message || '获取歌单失败');
            }

        } catch (error) {
            console.error('加载用户歌单失败:', error);
            this.showError('加载歌单失败', error.message);
        } finally {
            this.hideLoading();
        }
    }

    // 获取用户歌单
    async fetchUserPlaylists(userId) {
        const params = {
            uid: userId,
            limit: 100,
            timestamp: Date.now()
        };

        if (typeof fetchWithAuth === 'function') {
            return await fetchWithAuth('/user/playlist', params);
        } else {
            const url = buildApiUrl('/user/playlist', params);
            const response = await fetch(url);
            return await response.json();
        }
    }

    // 渲染歌单列表
    renderPlaylists() {
        const playlistsContent = document.getElementById('playlistsContent');
        if (!playlistsContent) return;

        if (!this.userPlaylists || this.userPlaylists.length === 0) {
            playlistsContent.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-list"></i>
                    <h3>暂无歌单</h3>
                    <p>您还没有创建任何歌单</p>
                </div>
            `;
            return;
        }

        // 分离创建的歌单和收藏的歌单
        const createdPlaylists = this.userPlaylists.filter(p => !p.subscribed);
        const subscribedPlaylists = this.userPlaylists.filter(p => p.subscribed);

        let html = '<div class="playlists-container">';

        // 创建的歌单
        if (createdPlaylists.length > 0) {
            html += this.renderPlaylistSection('我创建的歌单', createdPlaylists);
        }

        // 收藏的歌单
        if (subscribedPlaylists.length > 0) {
            html += this.renderPlaylistSection('我收藏的歌单', subscribedPlaylists);
        }

        html += '</div>';
        playlistsContent.innerHTML = html;

        // 绑定事件
        this.bindPlaylistEvents();
    }

    // 渲染歌单部分
    renderPlaylistSection(title, playlists) {
        return `
            <div class="playlist-section">
                <h3 class="section-title">
                    <i class="fas fa-folder"></i> ${title}
                    <span class="section-count">${playlists.length}</span>
                </h3>
                <div class="playlists-grid">
                    ${playlists.map(playlist => this.renderPlaylistCard(playlist)).join('')}
                </div>
            </div>
        `;
    }

    // 渲染单个歌单卡片
    renderPlaylistCard(playlist) {
        const trackCount = playlist.trackCount || 0;
        const playCount = playlist.playCount || 0;
        const creator = playlist.creator?.nickname || '未知';
        const subscribed = playlist.subscribed ? 'subscribed' : '';
        
        return `
            <div class="playlist-card ${subscribed}" data-id="${playlist.id}">
                <div class="playlist-cover">
                    <img src="${playlist.coverImgUrl || 'https://via.placeholder.com/200'}?param=200y200" 
                         alt="${playlist.name}"
                         onerror="this.src='https://via.placeholder.com/200?text=No+Cover'">
                    <div class="playlist-overlay">
                        <button class="play-btn" onclick="playlistManager.playPlaylist(${playlist.id})" title="播放歌单">
                            <i class="fas fa-play"></i>
                        </button>
                        <button class="view-btn" onclick="playlistManager.viewPlaylist(${playlist.id})" title="查看详情">
                            <i class="fas fa-eye"></i>
                        </button>
                    </div>
                    ${playlist.subscribed ? '<div class="subscribed-badge"><i class="fas fa-heart"></i></div>' : ''}
                </div>
                <div class="playlist-info">
                    <h4 class="playlist-name" title="${playlist.name}">${playlist.name}</h4>
                    <div class="playlist-stats">
                        <span class="stat-item">
                            <i class="fas fa-music"></i> ${trackCount}
                        </span>
                        <span class="stat-item">
                            <i class="fas fa-play-circle"></i> ${this.formatNumber(playCount)}
                        </span>
                    </div>
                    <div class="playlist-creator">
                        <i class="fas fa-user"></i> ${creator}
                    </div>
                    ${playlist.description ? `<div class="playlist-desc">${this.truncateText(playlist.description, 60)}</div>` : ''}
                </div>
            </div>
        `;
    }

    // 绑定歌单事件
    bindPlaylistEvents() {
        // 点击歌单卡片
        document.querySelectorAll('.playlist-card').forEach(card => {
            card.addEventListener('click', (e) => {
                if (!e.target.closest('.play-btn') && !e.target.closest('.view-btn')) {
                    const playlistId = card.dataset.id;
                    this.viewPlaylist(playlistId);
                }
            });
        });
    }

    // 查看歌单详情
    async viewPlaylist(playlistId) {
        try {
            this.showLoading();
            
            // 获取歌单详情
            const playlist = this.userPlaylists.find(p => p.id == playlistId);
            if (!playlist) {
                throw new Error('未找到歌单');
            }

            const detailData = await this.fetchPlaylistDetail(playlistId);
            
            if (detailData.code === 200 && detailData.playlist) {
                this.currentPlaylist = detailData.playlist;
                this.currentPlaylistSongs = detailData.playlist.tracks || [];
                
                this.renderPlaylistDetail();
                
                // 滚动到顶部
                window.scrollTo({ top: 0, behavior: 'smooth' });
            } else {
                throw new Error(detailData.message || '获取歌单详情失败');
            }

        } catch (error) {
            console.error('查看歌单失败:', error);
            alert(`查看歌单失败: ${error.message}`);
        } finally {
            this.hideLoading();
        }
    }

    // 获取歌单详情
    async fetchPlaylistDetail(playlistId) {
        const params = {
            id: playlistId,
            timestamp: Date.now()
        };

        if (typeof fetchWithAuth === 'function') {
            return await fetchWithAuth('/playlist/detail', params);
        } else {
            const url = buildApiUrl('/playlist/detail', params);
            const response = await fetch(url);
            return await response.json();
        }
    }

    // 渲染歌单详情
    renderPlaylistDetail() {
        const playlistsContent = document.getElementById('playlistsContent');
        if (!playlistsContent || !this.currentPlaylist) return;

        const playlist = this.currentPlaylist;
        const tracks = this.currentPlaylistSongs;
        const creator = playlist.creator?.nickname || '未知';
        const createTime = playlist.createTime ? new Date(playlist.createTime).toLocaleDateString() : '未知';
        const updateTime = playlist.updateTime ? new Date(playlist.updateTime).toLocaleDateString() : '未知';

        let html = `
            <div class="playlist-detail">
                <div class="detail-header">
                    <button class="back-btn" onclick="playlistManager.backToList()">
                        <i class="fas fa-arrow-left"></i> 返回列表
                    </button>
                    <h2 class="detail-title">${playlist.name}</h2>
                </div>

                <div class="detail-content">
                    <div class="playlist-info-panel">
                        <div class="cover-container">
                            <img src="${playlist.coverImgUrl || 'https://via.placeholder.com/300'}?param=300y300" 
                                 alt="${playlist.name}" class="detail-cover">
                            <div class="cover-actions">
                                <button class="action-btn primary" onclick="playlistManager.playPlaylist(${playlist.id})">
                                    <i class="fas fa-play"></i> 播放全部
                                </button>
                                <button class="action-btn secondary" onclick="playlistManager.shufflePlay(${playlist.id})">
                                    <i class="fas fa-random"></i> 随机播放
                                </button>
                            </div>
                        </div>

                        <div class="info-container">
                            <div class="info-item">
                                <span class="info-label">创建者:</span>
                                <span class="info-value">${creator}</span>
                            </div>
                            <div class="info-item">
                                <span class="info-label">歌曲数量:</span>
                                <span class="info-value">${playlist.trackCount || tracks.length}</span>
                            </div>
                            <div class="info-item">
                                <span class="info-label">播放次数:</span>
                                <span class="info-value">${this.formatNumber(playlist.playCount || 0)}</span>
                            </div>
                            <div class="info-item">
                                <span class="info-label">收藏次数:</span>
                                <span class="info-value">${this.formatNumber(playlist.subscribedCount || 0)}</span>
                            </div>
                            <div class="info-item">
                                <span class="info-label">创建时间:</span>
                                <span class="info-value">${createTime}</span>
                            </div>
                            <div class="info-item">
                                <span class="info-label">更新时间:</span>
                                <span class="info-value">${updateTime}</span>
                            </div>
                            ${playlist.description ? `
                            <div class="info-item description">
                                <span class="info-label">描述:</span>
                                <span class="info-value">${playlist.description}</span>
                            </div>
                            ` : ''}
                        </div>
                    </div>

                    <div class="songs-section">
                        <h3 class="songs-title">
                            <i class="fas fa-list-ol"></i> 歌曲列表
                            <span class="songs-count">${tracks.length} 首</span>
                        </h3>
                        
                        ${tracks.length > 0 ? this.renderSongsList(tracks) : `
                            <div class="empty-songs">
                                <i class="fas fa-music"></i>
                                <p>歌单中暂无歌曲</p>
                            </div>
                        `}
                    </div>
                </div>
            </div>
        `;

        playlistsContent.innerHTML = html;
        
        // 绑定歌曲列表事件
        this.bindSongEvents();
    }

    // 渲染歌曲列表
    renderSongsList(songs) {
        return `
            <div class="songs-list">
                <div class="list-header">
                    <div class="header-cell" style="width: 40px;">#</div>
                    <div class="header-cell" style="flex: 2;">歌曲标题</div>
                    <div class="header-cell" style="flex: 1;">歌手</div>
                    <div class="header-cell" style="width: 80px;">时长</div>
                    <div class="header-cell" style="width: 100px;">操作</div>
                </div>
                <div class="list-body">
                    ${songs.map((song, index) => this.renderSongItem(song, index)).join('')}
                </div>
            </div>
        `;
    }

    // 渲染单个歌曲项
    renderSongItem(song, index) {
        const artists = song.ar ? song.ar.map(artist => artist.name).join(', ') : '未知';
        const album = song.al ? song.al.name : '未知';
        const duration = Math.floor((song.dt || 0) / 1000);
        const minutes = Math.floor(duration / 60);
        const seconds = duration % 60;
        
        return `
            <div class="song-item" data-id="${song.id}">
                <div class="song-cell" style="width: 40px;">
                    <span class="song-index">${index + 1}</span>
                </div>
                <div class="song-cell" style="flex: 2;">
                    <div class="song-info">
                        <img src="${song.al?.picUrl || 'https://via.placeholder.com/40'}?param=40y40" 
                             class="song-cover" alt="${song.name}">
                        <div class="song-text">
                            <div class="song-name">${song.name}</div>
                            <div class="song-album">${album}</div>
                        </div>
                    </div>
                </div>
                <div class="song-cell" style="flex: 1;">
                    <div class="song-artists">${artists}</div>
                </div>
                <div class="song-cell" style="width: 80px;">
                    <div class="song-duration">${minutes}:${seconds.toString().padStart(2, '0')}</div>
                </div>
                <div class="song-cell" style="width: 100px;">
                    <div class="song-actions">
                        <button class="action-btn" onclick="playSong(${song.id}, '${song.name.replace(/'/g, "\\'")}')" title="播放">
                            <i class="fas fa-play"></i>
                        </button>
                        <button class="action-btn" onclick="playlistManager.addToQueue(${song.id})" title="添加到队列">
                            <i class="fas fa-plus"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    // 绑定歌曲事件
    bindSongEvents() {
        // 点击歌曲项
        document.querySelectorAll('.song-item').forEach(item => {
            item.addEventListener('click', (e) => {
                if (!e.target.closest('.action-btn')) {
                    const songId = item.dataset.id;
                    const songName = item.querySelector('.song-name')?.textContent || '';
                    if (songId) {
                        playSong(songId, songName);
                    }
                }
            });
        });
    }

    // 返回歌单列表
    backToList() {
        this.currentPlaylist = null;
        this.currentPlaylistSongs = [];
        this.renderPlaylists();
    }

    // 播放歌单
    async playPlaylist(playlistId) {
        try {
            const playlist = this.userPlaylists.find(p => p.id == playlistId);
            if (!playlist) {
                throw new Error('未找到歌单');
            }

            const detailData = await this.fetchPlaylistDetail(playlistId);
            
            if (detailData.code === 200 && detailData.playlist?.tracks) {
                const songs = detailData.playlist.tracks;
                
                if (songs.length > 0) {
                    // 播放第一首歌曲
                    const firstSong = songs[0];
                    await playSong(firstSong.id, firstSong.name);
                    
                    // 设置播放列表
                    if (window.player) {
                        window.player.playlist = songs;
                        window.player.currentSongIndex = 0;
                    }
                    
                    alert(`开始播放歌单 "${playlist.name}"，共 ${songs.length} 首歌曲`);
                } else {
                    alert('歌单中没有歌曲');
                }
            } else {
                throw new Error('获取歌单歌曲失败');
            }

        } catch (error) {
            console.error('播放歌单失败:', error);
            alert(`播放歌单失败: ${error.message}`);
        }
    }

    // 随机播放
    async shufflePlay(playlistId) {
        try {
            const detailData = await this.fetchPlaylistDetail(playlistId);
            
            if (detailData.code === 200 && detailData.playlist?.tracks) {
                const songs = detailData.playlist.tracks;
                
                if (songs.length > 0) {
                    // 随机选择一首歌曲
                    const randomIndex = Math.floor(Math.random() * songs.length);
                    const randomSong = songs[randomIndex];
                    
                    await playSong(randomSong.id, randomSong.name);
                    
                    // 设置播放列表
                    if (window.player) {
                        window.player.playlist = songs;
                        window.player.currentSongIndex = randomIndex;
                    }
                    
                    alert(`随机播放 "${randomSong.name}"`);
                } else {
                    alert('歌单中没有歌曲');
                }
            }

        } catch (error) {
            console.error('随机播放失败:', error);
            alert('随机播放失败');
        }
    }

    // 添加到队列
    addToQueue(songId) {
        // 这里可以实现添加到播放队列的功能
        alert('已添加到播放队列（功能演示）');
    }

    // 显示加载状态
    showLoading() {
        this.isLoading = true;
        const playlistsContent = document.getElementById('playlistsContent');
        if (playlistsContent) {
            playlistsContent.innerHTML = `
                <div class="loading-container">
                    <div class="spinner"></div>
                    <div class="loading-text">加载中...</div>
                </div>
            `;
        }
    }

    // 隐藏加载状态
    hideLoading() {
        this.isLoading = false;
    }

    // 显示错误
    showError(title, message) {
        const playlistsContent = document.getElementById('playlistsContent');
        if (playlistsContent) {
            playlistsContent.innerHTML = `
                <div class="error-state">
                    <i class="fas fa-exclamation-circle"></i>
                    <h3>${title}</h3>
                    <p>${message}</p>
                    <button onclick="playlistManager.loadUserPlaylists()" class="btn-primary">
                        <i class="fas fa-redo"></i> 重试
                    </button>
                </div>
            `;
        }
    }

    // 格式化数字
    formatNumber(num) {
        if (num >= 100000000) {
            return (num / 100000000).toFixed(1) + '亿';
        } else if (num >= 10000) {
            return (num / 10000).toFixed(1) + '万';
        }
        return num.toString();
    }

    // 截断文本
    truncateText(text, maxLength) {
        if (!text || text.length <= maxLength) return text;
        return text.substring(0, maxLength) + '...';
    }
}

// 创建歌单管理器实例
let playlistManager = null;

// 初始化歌单管理器
function initPlaylistManager() {
    if (!playlistManager) {
        playlistManager = new PlaylistManager();
        window.playlistManager = playlistManager;
        console.log('歌单管理器已初始化');
    }
    return playlistManager;
}

// 页面加载时初始化
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPlaylistManager);
} else {
    initPlaylistManager();
}