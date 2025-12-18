// 播放器状态
let player = {
    isPlaying: false,
    isMuted: false,
    volume: 80,
    currentSongIndex: -1,
    playlist: [],
    currentSongId: null,
    lyrics: [],
    currentLyricIndex: -1
};

// 初始化播放器
function initPlayer() {
    const audio = document.getElementById('audioElement');
    if (!audio) return;

    // 加载保存的音量
    const savedVolume = localStorage.getItem('netease_volume');
    if (savedVolume) {
        player.volume = parseInt(savedVolume);
        audio.volume = player.volume / 100;
        document.getElementById('volumeSlider').value = player.volume;
    }

    // 监听音频事件
    audio.addEventListener('play', () => {
        player.isPlaying = true;
        updatePlayButton();
    });

    audio.addEventListener('pause', () => {
        player.isPlaying = false;
        updatePlayButton();
    });

    audio.addEventListener('volumechange', () => {
        player.volume = audio.volume * 100;
        updateVolumeButton();
    });
}

// 播放音频
function playAudio(url, name = '未知歌曲', songId = null) {
    const audio = document.getElementById('audioElement');
    const coverImg = document.getElementById('currentSongCover');
    const songName = document.getElementById('currentSongName');
    const artistName = document.getElementById('currentArtist');
    // 记录当前歌曲ID
    player.currentSongId = songId;

    if (songId) {
        // 获取歌曲详情和歌词
        fetchSongDetails(songId);
        loadLyrics(songId);
    } else {
        player.lyrics = [];
        player.currentLyricIndex = -1;
        renderLyrics();
    }

    audio.src = url;
    audio.play().catch(error => {
        console.error('播放失败:', error);
        alert('播放失败，可能需要VIP权限');
    });

    songName.textContent = name;
    artistName.textContent = '加载中...';
}

// 加载歌词（使用 /lyric 标准接口）
async function loadLyrics(songId) {
    if (!songId) return;
    try {
        const url = buildApiUrl('/lyric', {
            id: songId
        });
        const response = await fetch(url);
        const data = await response.json();

        if (data.code === 200 && data.lrc && data.lrc.lyric) {
            player.lyrics = parseLrc(data.lrc.lyric);
            player.currentLyricIndex = -1;
            renderLyrics();
        } else {
            player.lyrics = [];
            player.currentLyricIndex = -1;
            renderLyrics('暂无歌词');
        }
    } catch (error) {
        console.error('获取歌词失败:', error);
        player.lyrics = [];
        player.currentLyricIndex = -1;
        renderLyrics('歌词加载失败');
    }
}

// 解析标准 LRC 歌词
function parseLrc(lrcText) {
    const lines = lrcText.split('\n');
    const result = [];
    const timeReg = /\[(\d{1,2}):(\d{1,2})(?:\.(\d{1,3}))?]/g;

    lines.forEach(rawLine => {
        const line = rawLine.trim();
        if (!line) return;

        let match;
        const times = [];
        while ((match = timeReg.exec(line)) !== null) {
            const min = parseInt(match[1], 10);
            const sec = parseInt(match[2], 10);
            const ms = match[3] ? parseInt(match[3].padEnd(3, '0'), 10) : 0;
            const totalMs = min * 60 * 1000 + sec * 1000 + ms;
            times.push(totalMs);
        }

        const text = line.replace(timeReg, '').trim();
        if (!text || times.length === 0) return;

        times.forEach(t => {
            result.push({
                time: t,
                text
            });
        });
    });

    result.sort((a, b) => a.time - b.time);
    return result;
}

// 渲染歌词到弹层
function renderLyrics(emptyText) {
    const container = document.getElementById('lyricLines');
    if (!container) return;

    if (!player.lyrics || player.lyrics.length === 0) {
        container.innerHTML = emptyText ? `<p class="lyric-line">${emptyText}</p>` : '<p class="lyric-line">暂无歌词</p>';
        return;
    }

    container.innerHTML = player.lyrics
        .map((item, index) => `<p class="lyric-line${index === 0 ? ' active' : ''}" data-index="${index}" data-time="${item.time}">${item.text}</p>`)
        .join('');
}

async function fetchSongDetails(songId) {
    try {
        const url = buildApiUrl('/song/detail', {
            ids: songId
        });
        const response = await fetch(url);
        const data = await response.json();

        if (data.code === 200 && data.songs && data.songs[0]) {
            const song = data.songs[0];
            const artists = song.ar ? song.ar.map(artist => artist.name).join(', ') : '未知';
            const album = song.al ? song.al.name : '未知';

            document.getElementById('currentArtist').textContent = `${artists} - ${album}`;

            // 更新封面
            const coverUrl = song.al && song.al.picUrl;
            if (coverUrl) {
                const coverImgUrl = `${coverUrl}?param=100y100`;
                document.getElementById('currentSongCover').src = coverImgUrl;

                // 更新歌词页面的封面
                const lyricCover = document.getElementById('lyricSongCover');
                if (lyricCover) {
                    lyricCover.src = coverImgUrl;
                }

                // 如果有主题管理器且启用了封面背景，更新背景
                if (typeof themeManager !== 'undefined' &&
                    themeManager.currentThemeMode === 'cover-blur' &&
                    themeManager.settings.autoThemeSwitch) {
                    setTimeout(() => {
                        themeManager.updateBackgroundFromCurrentSong();
                    }, 300); // 延迟确保封面加载完成
                }
            }
        }
    } catch (error) {
        console.error('获取歌曲详情失败:', error);
    }
}

// 切换播放状态
function togglePlay() {
    const audio = document.getElementById('audioElement');
    if (!audio.src) return;

    if (player.isPlaying) {
        audio.pause();
    } else {
        audio.play().catch(error => {
            console.error('播放失败:', error);
        });
    }
}

// 更新播放按钮
function updatePlayButton() {
    const playBtn = document.getElementById('playBtn');
    if (!playBtn) return;

    const icon = playBtn.querySelector('i');
    icon.className = player.isPlaying ? 'fas fa-pause' : 'fas fa-play';
}

// 更新进度条
function updateProgress() {
    const audio = document.getElementById('audioElement');
    const progressFill = document.getElementById('progressFill');
    const currentTime = document.getElementById('currentTime');
    const durationTime = document.getElementById('durationTime');

    if (!audio.duration) return;

    const progress = (audio.currentTime / audio.duration) * 100;
    progressFill.style.width = `${progress}%`;

    // 更新时间显示
    currentTime.textContent = formatTime(audio.currentTime);
    durationTime.textContent = formatTime(audio.duration);

    // 同步歌词高亮
    updateLyricHighlight(audio.currentTime * 1000);
}

// 跳转播放位置
function seekAudio(event) {
    const audio = document.getElementById('audioElement');
    const progressBar = event.currentTarget;
    const rect = progressBar.getBoundingClientRect();
    const percent = (event.clientX - rect.left) / rect.width;

    if (audio.duration) {
        audio.currentTime = audio.duration * percent;
    }
}

// 切换静音
function toggleMute() {
    const audio = document.getElementById('audioElement');
    player.isMuted = !player.isMuted;
    audio.muted = player.isMuted;
    updateVolumeButton();
}

// 改变音量
function changeVolume(value) {
    const audio = document.getElementById('audioElement');
    player.volume = parseInt(value);
    audio.volume = player.volume / 100;
    localStorage.setItem('netease_volume', player.volume);
    updateVolumeButton();
}

// 更新音量按钮
function updateVolumeButton() {
    const volumeBtn = document.getElementById('volumeBtn');
    if (!volumeBtn) return;

    const icon = volumeBtn.querySelector('i');

    if (player.isMuted || player.volume === 0) {
        icon.className = 'fas fa-volume-mute';
    } else if (player.volume < 50) {
        icon.className = 'fas fa-volume-down';
    } else {
        icon.className = 'fas fa-volume-up';
    }
}

// 上一首/下一首
function previousSong() {
    if (player.playlist.length > 0) {
        player.currentSongIndex = Math.max(0, player.currentSongIndex - 1);
        playSongFromPlaylist();
    }
}

function nextSong() {
    if (player.playlist.length > 0) {
        player.currentSongIndex = Math.min(player.playlist.length - 1, player.currentSongIndex + 1);
        playSongFromPlaylist();
    }
}

// 从播放列表播放
function playSongFromPlaylist() {
    if (player.currentSongIndex >= 0 && player.currentSongIndex < player.playlist.length) {
        const song = player.playlist[player.currentSongIndex];
        playAudio(song.url, song.name, song.id);
    }
}

// 格式化时间
function formatTime(seconds) {
    if (!seconds || isNaN(seconds)) return '0:00';

    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

// 更新歌词高亮
function updateLyricHighlight(currentMs) {
    if (!player.lyrics || player.lyrics.length === 0) return;

    let newIndex = player.currentLyricIndex;

    if (newIndex < 0 || currentMs < player.lyrics[newIndex].time || (newIndex < player.lyrics.length - 1 && currentMs >= player.lyrics[newIndex + 1].time)) {
        // 重新计算当前行
        for (let i = 0; i < player.lyrics.length; i++) {
            const thisTime = player.lyrics[i].time;
            const nextTime = i < player.lyrics.length - 1 ? player.lyrics[i + 1].time : Number.MAX_SAFE_INTEGER;
            if (currentMs >= thisTime && currentMs < nextTime) {
                newIndex = i;
                break;
            }
        }
    }

    if (newIndex === player.currentLyricIndex || newIndex < 0) return;

    player.currentLyricIndex = newIndex;

    const container = document.getElementById('lyricLines');
    if (!container) return;

    const lines = container.querySelectorAll('.lyric-line');
    lines.forEach(line => line.classList.remove('active'));

    const activeLine = container.querySelector(`.lyric-line[data-index="${newIndex}"]`);
    if (activeLine) {
        activeLine.classList.add('active');

        // 自动滚动，使当前行大致居中
        const offsetTop = activeLine.offsetTop;
        const containerHeight = container.clientHeight;
        container.scrollTo({
            top: Math.max(0, offsetTop - containerHeight / 2),
            behavior: 'smooth'
        });
    }
}

// 跳转到歌词页面
function goToLyricsPage() {
    const cover = document.getElementById('currentSongCover');
    const songName = document.getElementById('currentSongName');
    const artist = document.getElementById('currentArtist');

    const lyricCover = document.getElementById('lyricSongCover');
    const lyricSongName = document.getElementById('lyricSongName');
    const lyricArtist = document.getElementById('lyricArtist');

    if (cover && lyricCover) lyricCover.src = cover.src;
    if (songName && lyricSongName) lyricSongName.textContent = songName.textContent;
    if (artist && lyricArtist) lyricArtist.textContent = artist.textContent;

    if (typeof switchSection === 'function') {
        switchSection('lyrics');
    }
}

// 暴露全局函数
window.playAudio = playAudio;
window.goToLyricsPage = goToLyricsPage;