import { BACKEND_PORT } from './config.js';
// A helper you may want to use when uploading new images to the server.
import { fileToDataUrl } from './helpers.js';

let TOKEN = sessionStorage.getItem('token') || localStorage.getItem('token');

const saveIdentity = ({ token, email, remember }) => {
    // token
    if (remember) {
        localStorage.setItem('token', token);
        sessionStorage.removeItem('token');
    } else {
        sessionStorage.setItem('token', token);
        localStorage.removeItem('token');
    }

    if (remember) {
        localStorage.setItem('email', email);
        sessionStorage.removeItem('email');
    } else {
        sessionStorage.setItem('email', email);
        localStorage.removeItem('email');
    }

    TOKEN = token;
};


const loginEmail = (email, password) => {
    fetch('http://localhost:5005/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            email: email,
            password: password,
        })
    })
        .then((res) => res.json().then((json) => ({ ok: res.ok, json })))
        .then(({ ok, json }) => {
            if (!ok) {
                showError('Invalid email or password');
                return;
            }

            // clear old user msg
            CURRENT_CHANNEL_ID = null;
            document.getElementById('notif-list') && (document.getElementById('notif-list').textContent = '');
            NOTIF_LAST_SEEN = {};
            NOTIF_LAST_ALERTED = {};
            stopNotifPolling();

            sessionStorage.setItem('email', email);
            const remember = !!(document.getElementById('remember')?.checked);
            saveIdentity({ token: json.token, email, remember });
            changePage('page-dashboard');

            fetchMe().then(function () {
                initAvatarLabel();
                return loadChannels();
            }).then(applyRoute);
        })
        .catch(() => { showError('Network error, please try again'); });
};

const registerEmail = (email, name, password) => {
    fetch('http://localhost:5005/auth/register', {
        method: 'POST',
        headers: {
            'Content-type': 'application/json',
        },
        body: JSON.stringify({
            email: email,
            name: name,
            password: password,
        })
    })
        .then((res) => res.json().then((json) => ({ ok: res.ok, json })))
        .then(({ ok, json }) => {
            if (!ok) {
                showError((json && json.error) ? json.error : 'Registration failed');
                return;
            }
            CURRENT_CHANNEL_ID = null;
            document.getElementById('notif-list') && (document.getElementById('notif-list').textContent = '');
            NOTIF_LAST_SEEN = {};
            NOTIF_LAST_ALERTED = {};
            stopNotifPolling();

            sessionStorage.setItem('email', email);
            const remember = !!(document.getElementById('reg-remember')?.checked);
            saveIdentity({ token: json.token, email, remember });
            changePage('page-dashboard');
            fetchMe().then(function () {
                initAvatarLabel();
                return loadChannels();
            }).then(applyRoute);
        })
        .catch(() => { showError('Network error, please try again'); });
};

// close modal when showing error
let RESUME_MODAL_ID = null;

// login/register error popup + edit msg error
const showError = (message) => {
    const body = document.getElementById('error-body');
    if (body) body.textContent = message || 'Something went wrong';

    const errorEl = document.getElementById('errorModal');
    if (!errorEl) return;

    // close modal when showing error
    const opened = document.querySelector('.modal.show:not(#errorModal)');
    if (opened) {
        const instOpened = bootstrap.Modal.getInstance(opened) || new bootstrap.Modal(opened);
        instOpened.hide();
        RESUME_MODAL_ID = opened.id;
    }

    // show error
    const errorInst = bootstrap.Modal.getInstance(errorEl) || new bootstrap.Modal(errorEl);
    errorInst.show();
};

const logout = () => {
    fetch('http://localhost:5005/auth/logout', {
        method: 'POST',
        headers: {
            'Content-type': 'application/json',
            'Authorization': `Bearer ${TOKEN}`,
        },
    })
        .then((res) => {
            stopNotifPolling();
            document.getElementById('notif-list') && (document.getElementById('notif-list').textContent = '');
            NOTIF_LAST_SEEN = {};
            NOTIF_LAST_ALERTED = {};
            NOTIF_BASELINE_DONE = {};
            NOTIF_TIMER = null;
            CURRENT_CHANNEL_ID = null;
            CHANNELS_BY_ID = {};
            for (var k in USER_CACHE) delete USER_CACHE[k];
            for (var k in USER_PHOTO_CACHE) delete USER_PHOTO_CACHE[k];

            document.getElementById('login-form').reset();
            document.getElementById('register-form').reset();

            localStorage.removeItem('email');
            sessionStorage.removeItem('email');
            localStorage.removeItem('token');
            sessionStorage.removeItem('token');
            TOKEN = null;
            CURRENT_USER_ID = null;
            changePage('page-login');
        });
};

let CURRENT_CHANNEL_ID = null;

const openChannel = (channelId) => {
    CURRENT_CHANNEL_ID = channelId;
    markActiveInDrawer(channelId);
    // reset paging state for Infinite Scroll
    isLoadingOlder = false;
    hasMoreOlder = true;
    nextStart = 0;
    bindScrollerOnce();
    const ch = CHANNELS_BY_ID[channelId];
    const title = document.querySelector('#page-dashboard main h1');
    if (title) title.textContent = (ch ? `# ${ch.name}` : 'Channel');

    loadChannelDetails(channelId).then((isMember) => {
        if (isMember) {
            loadChannelMessages(channelId);
            renderPinnedSummaryButton();
            mountInviteBesidePins();
        } else {
            renderMessageList([], { scroll: 'none' });
        }
    });
};

const createChannel = (name, description, isPrivate) => {
    if (!requireOnlineOrFail()) return Promise.reject?.() ?? undefined;

    fetch('http://localhost:5005/channel', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${TOKEN}`,
        },
        body: JSON.stringify({
            name: name.trim(),
            private: !!isPrivate,
            description: (description || '').trim(),
        }),
    })
        .then(res => res.json().then(json => ({ ok: res.ok, json })))
        .then(({ ok, json }) => {
            if (!ok) { showError(json && json.error ? json.error : 'Failed to create channel'); return; }

            const modalEl = document.getElementById('create-channel-container');
            if (modalEl) {
                const inst = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
                inst.hide();
            }
            const form = document.getElementById('create-channel-form');
            if (form) form.reset();

            fetchMe().then(() => loadChannels());
        })
        .catch(function () {
            showError('Network error while loading channels');
            setOfflineUI(!navigator.onLine);
            if (OFFLINE) renderFromSnapshotIfAny();
        });
};

const fetchMe = () => {
    const myEmail =
        sessionStorage.getItem('email') ||
        localStorage.getItem('email');

    return fetch('http://localhost:5005/user', {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${TOKEN}`,
        },
    })
        .then(res => res.json().then(json => ({ ok: res.ok, json })))
        .then(({ ok, json }) => {
            if (!ok) throw new Error('Failed to fetch users');

            const users = json.users;
            const me = users.find(u => u.email === myEmail);
            if (!me) throw new Error('Current user not found via email');

            CURRENT_USER_ID = Number(me.id);
            return CURRENT_USER_ID;
        });
};

const fetchUserName = (userId) => {
    if (USER_CACHE[userId]) return Promise.resolve(USER_CACHE[userId]);
    return fetch(`http://localhost:5005/user/${userId}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${TOKEN}` },
    })
        .then(res => res.json().then(json => ({ ok: res.ok, json })))
        .then(({ ok, json }) => {
            if (!ok) return 'Unknown';
            USER_CACHE[userId] = json.name || 'Unknown';
            return USER_CACHE[userId];
        })
        .catch(() => 'Unknown');
};

const loadChannels = () => {
    return fetch('http://localhost:5005/channel', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${TOKEN}` },
    })
        .then(function (res) {
            return res.json().then(function (json) { return { ok: res.ok, json: json }; });
        })
        .then(function (resp) {
            if (!resp.ok) return Promise.reject(new Error((resp.json && resp.json.error) || 'Failed to fetch channels'));

            var channels = (resp.json && resp.json.channels) || [];

            CHANNELS_BY_ID = {};
            for (var i = 0; i < channels.length; i++) {
                CHANNELS_BY_ID[String(channels[i].id)] = channels[i];
            }

            var publicChannels = channels.filter(function (c) { return c.private === false; });
            var privateCandidates = channels.filter(function (c) { return c.private === true; });

            var withMembers = privateCandidates.filter(function (c) { return Array.isArray(c.members); });
            var myPrivateFast = withMembers.filter(function (c) {
                var arr = c.members.map(function (m) {
                    return Number((m && m.id) != null ? m.id : m);
                }).filter(function (n) { return !isNaN(n); });
                return arr.indexOf(Number(CURRENT_USER_ID)) !== -1;
            });
            var needProbe = privateCandidates.filter(function (c) { return !Array.isArray(c.members); });

            return Promise.all(needProbe.map(function (c) {
                return fetch('http://localhost:5005/channel/' + c.id, {
                    method: 'GET',
                    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + TOKEN },
                })
                    .then(function (res) { return res.ok ? res.json() : null; })  // 403 => null（直接丢弃）
                    .then(function (json) {
                        if (!json) return null;
                        var members = Array.isArray(json.members) ? json.members.map(function (m) {
                            return Number((m && m.id) != null ? m.id : m);
                        }).filter(function (n) { return !isNaN(n); }) : [];
                        return members.indexOf(Number(CURRENT_USER_ID)) !== -1 ? c : null;
                    })
                    .catch(function () { return null; });
            }))
                .then(function (probed) {
                    var myPrivate = myPrivateFast.concat(probed.filter(Boolean));

                    renderChannelList(publicChannels, myPrivate);

                    // mark channel that I am readable
                    var readable = {};
                    publicChannels.forEach(c => { readable[String(c.id)] = true; });
                    myPrivate.forEach(c => { readable[String(c.id)] = true; });

                    Object.keys(CHANNELS_BY_ID).forEach(function (id) {
                        CHANNELS_BY_ID[id].canRead = !!readable[id];
                    });

                    if (CURRENT_CHANNEL_ID == null) {
                        var first = publicChannels[0] || myPrivate[0];
                        if (first) {
                            openChannel(first.id);
                            startNotifPolling();
                            var listEl = document.getElementById('channel-list');
                            var btn = listEl && listEl.querySelector('.channel-container[data-id="' + first.id + '"]');
                            if (btn) {
                                var all = listEl.querySelectorAll('.channel-container');
                                for (var j = 0; j < all.length; j++) all[j].classList.remove('active');
                                btn.classList.add('active');
                            }
                        }
                    }
                    return channels;
                });
        })
        .catch(function () {
            showError('Network error while loading channels');
            setOfflineUI(!navigator.onLine);
            if (OFFLINE) renderFromSnapshotIfAny();
        });
};


const updateChannel = (channelId, name, description) => {
    if (!requireOnlineOrFail()) return Promise.reject?.() ?? undefined;

    fetch(`http://localhost:5005/channel/${channelId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${TOKEN}` },
        body: JSON.stringify({ name, description })
    })
        .then(res => res.json().then(json => ({ ok: res.ok, json })))
        .then(({ ok, json }) => {
            if (!ok) { showError(json && json.error ? json.error : 'Failed to update channel'); return; }
            fetchMe().then(() => loadChannels());
            loadChannelDetails(channelId);
            const title = document.querySelector('#page-dashboard main h1');
            if (title) title.textContent = `# ${name}`;
        })
        .catch(() => showError('Network error while updating'));
};

const joinChannel = (channelId) => {
    if (!requireOnlineOrFail()) return Promise.reject?.() ?? undefined;

    fetch(`http://localhost:5005/channel/${channelId}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${TOKEN}` },
    })
        .then(res => res.json().then(json => ({ ok: res.ok, json })))
        .then(({ ok, json }) => {
            if (!ok) { showError(json && json.error ? json.error : 'Failed to join channel'); return; }
            CURRENT_CHANNEL_ID = channelId;
            return loadChannels()
                .then(function () {
                    // reopen channel
                    openChannel(channelId);

                    return loadChannelDetails(channelId).then(function () {
                        return loadChannelMessages(channelId);
                    });
                    return null;
                });
        })
        .catch(() => showError('Network error while joining'));
};

const leaveChannel = (channelId) => {
    if (!requireOnlineOrFail()) return Promise.reject?.() ?? undefined;

    fetch(`http://localhost:5005/channel/${channelId}/leave`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${TOKEN}` },
    })
        .then(res => res.json().then(json => ({ ok: res.ok, json })))
        .then(({ ok, json }) => {
            if (!ok) { showError(json && json.error ? json.error : 'Failed to leave channel'); return; }
            fetchMe().then(() => openChannel(channelId));
            const box = document.getElementById('channel-details-container');
            if (box) box.textContent = '';
        })
        .catch(() => showError('Network error while leaving'));
};

const fetchUserPhoto = (userId) => {
    if (USER_PHOTO_CACHE[userId]) return Promise.resolve(USER_PHOTO_CACHE[userId]);
    return fetch(`http://localhost:5005/user/${userId}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${TOKEN}` },
    })
        .then(res => res.json().then(json => ({ ok: res.ok, json })))
        .then(({ ok, json }) => {
            if (!ok) return DEFAULT_AVATAR;
            const photo = json.image || json.photo || DEFAULT_AVATAR;
            USER_PHOTO_CACHE[userId] = photo;
            return photo;
        })
        .catch(() => DEFAULT_AVATAR);
};

const loadChannelMessages = (channelId) => {
    return fetch(`http://localhost:5005/message/${channelId}?start=0`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${TOKEN}` },
    })
        .then(res => res.json().then(json => ({ ok: res.ok, status: res.status, json })))
        .then(({ ok, status, json }) => {
            if (!ok) {
                if (status !== 403) showError(json && json.error ? json.error : 'Failed to load messages');
                LAST_MESSAGES = [];
                renderMessageList([], { scroll: 'none' });
                return [];
            }
            var list = Array.isArray(json) ? json : (json.messages || []);
            list.sort((a, b) => Date.parse(a.sentAt) - Date.parse(b.sentAt));
            LAST_MESSAGES = list;
            return renderMessageList(list, { scroll: 'bottom' }).then(function () {
                rebuildImageViewList();
                // update read cursor
                if (list && list.length) {
                    var latest = getLatestMessage(list);
                    var latestId = String(
                        latest.id ||
                        latest.messageId ||
                        latest.timestamp ||
                        (latest.sentAt && Date.parse(latest.sentAt)) ||
                        list.length
                    );
                    NOTIF_LAST_SEEN[String(channelId)] = latestId;
                }
                nextStart = list.length;
                hasMoreOlder = list.length > 0;
                try {
                    const snap = readSnapshot() || {};
                    snap.channelId = channelId;
                    snap.messages = list;
                    writeSnapshot(snap);
                } catch (e) { }
                return list;
            });
        })
        .catch(() => { showError('Network error while loading messages'); LAST_MESSAGES = []; renderMessageList([], { scroll: 'none' }); setOfflineUI(!navigator.onLine); if (OFFLINE) renderFromSnapshotIfAny(); });
};

const sendMessage = (channelId, text) => {
    if (!requireOnlineOrFail()) return Promise.reject?.() ?? undefined;
    return fetch(`http://localhost:5005/message/${channelId}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${TOKEN}`,
        },
        body: JSON.stringify({ message: text })
    })
        .then(res => res.json().then(json => ({ ok: res.ok, json })))
        .then(({ ok, json }) => {
            if (!ok) { showError(json && json.error ? json.error : 'Failed to send message'); return Promise.reject(); }
            return loadChannelMessages(channelId);
        })
        .then(() => {
            const input = document.getElementById('message-input');
            if (input) input.value = '';
            const scroller = document.getElementById('message-scroll');
            if (scroller) scroller.scrollTop = scroller.scrollHeight;
        })
        .catch(() => showError('Network error while sending message'));
};

const deleteMessage = (channelId, messageId) => {
    if (!requireOnlineOrFail()) return Promise.reject?.() ?? undefined;

    return fetch(`http://localhost:5005/message/${channelId}/${messageId}`, {
        method: 'DELETE',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${TOKEN}`,
        },
    })
        .then(res => res.json().then(json => ({ ok: res.ok, json })))
        .then(({ ok, json }) => {
            if (!ok) { showError(json && json.error ? json.error : 'Failed to delete message'); return; }
            return loadChannelMessages(channelId);
        })
        .catch(() => showError('Network error while deleting message'));
};

const pinMessage = (channelId, messageId) => {
    if (!requireOnlineOrFail()) return Promise.reject?.() ?? undefined;

    return fetch(`http://localhost:5005/message/pin/${channelId}/${messageId}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${TOKEN}`,
        },
        body: JSON.stringify({}),
    }).then((res) =>
        res.ok
            ? null
            : res.json().then((x) => {
                throw new Error(x.error || 'Failed to pin message');
            })
    );
};

const unpinMessage = (channelId, messageId) => {
    if (!requireOnlineOrFail()) return Promise.reject?.() ?? undefined;

    return fetch(`http://localhost:5005/message/unpin/${channelId}/${messageId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${TOKEN}` },
    }).then((res) =>
        res.ok
            ? null
            : res.json().then((x) => {
                throw new Error(x.error || 'Failed to unpin message');
            })
    );
};

const fetchAllPinnedMessages = (channelId) => {
    const pinned = [];
    const page = (start) => {
        return fetch(`http://localhost:5005/message/${channelId}?start=${start}`, {
            headers: { Authorization: `Bearer ${TOKEN}` },
        })
            .then((res) =>
                res.ok ? res.json() : Promise.reject(new Error('Network error while loading messages'))
            )
            .then((data) => {
                const list = (data && data.messages) || [];
                list.forEach((m) => m.pinned && pinned.push(m));
                if (list.length === 0) return pinned;
                return page(start + list.length);
            });
    };
    return page(0);
};

const fetchAllUsers = () => {
    return fetch(`http://localhost:5005/user`, { headers: { Authorization: `Bearer ${TOKEN}` }, })
        .then(res => res.ok ? res.json()
            : Promise.reject(new Error('Network error while loading users')))
        .then(data => (data && data.users) || []);

};

const fetchChannelDetail = (channelId) => {
    return fetch(`http://localhost:5005/channel/${channelId}`, { headers: { Authorization: `Bearer ${TOKEN}` } })
        .then((res) => res.ok ? res.json()
            : Promise.reject(new Error('Network error while loading channel')));
};

const inviteMembersToChannel = (channelId, userIds) => {
    if (!requireOnlineOrFail()) return Promise.reject?.() ?? undefined;

    var tasks = userIds.map(function (uid) {
        return fetch('http://localhost:5005/channel/' + channelId + '/invite', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + TOKEN },
            body: JSON.stringify({ userId: Number(uid) })
        })
            .then(function (res) {
                return res.text().then(function (text) {
                    return { ok: res.ok, status: res.status, text: text, uid: uid };
                });
            });
    });

    return Promise.all(tasks).then(function (results) {
        var failed = results.filter(function (r) { return !r.ok; });
        if (failed.length) {
            var msg = failed.map(function (r) {
                var t = r.text || ('HTTP ' + r.status);
                try { var j = JSON.parse(t); t = j && (j.error || j.message) || t; } catch (e) { }
                return r.uid + ': ' + t;
            }).join('; ');
            return Promise.reject(new Error(msg));
        }
        return results;
    });
};

document.getElementById('logout-button').addEventListener('click', logout);

function changePage(pageName) {
    const pages = document.querySelectorAll('.page');
    for (const page of pages) {
        page.classList.add('page-hide');
    }
    document.getElementById(pageName).classList.remove('page-hide');
}

// login btn / enter
const loginForm = document.querySelector('#page-login form');
loginForm.addEventListener('submit', (e) => {
    e.preventDefault();

    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    loginEmail(email, password);
});

document.getElementById('register-link').addEventListener('click', () => {
    changePage('page-register');
})

document.getElementById('register-submit').addEventListener('click', () => {
    const email = document.getElementById('register-email').value;
    const name = document.getElementById('register-name').value;
    const password = document.getElementById('register-password').value;
    const passwordConfirm = document.getElementById('register-password-confirm').value;

    if (password !== passwordConfirm) {
        showError('Passwords do not match');
    } else {
        registerEmail(email, name, password);
    }
});

document.getElementById('login-link').addEventListener('click', () => {
    changePage('page-login');
})

// list channels
let CHANNELS_BY_ID = {};

const loadChannelDetails = (channelId) => {
    return fetch(`http://localhost:5005/channel/${channelId}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${TOKEN}` },
    })
        .then(res => res.json().then(json => ({ ok: res.ok, status: res.status, json })))
        .then(({ ok, status, json }) => {
            if (!ok) {
                if (status === 403) {
                    const snapshot = CHANNELS_BY_ID[String(channelId)] || {};
                    renderChannelDetails(
                        { name: snapshot.name || 'Channel', description: '', private: !!snapshot.private, createdAt: null, creator: snapshot.creator },
                        '',
                        false
                    );
                    setComposerEnabled(false);
                    return false;
                }
                showError(json && json.error ? json.error : 'Failed to load channel');
                return false;
            }

            const details = json;
            CHANNELS_BY_ID[String(channelId)] = { ...(CHANNELS_BY_ID[String(channelId)] || {}), ...details };

            var isMember = false;
            if (details && Array.isArray(details.members)) {
                const flatMembers = details.members.flat(Infinity).map(Number);
                isMember = flatMembers.includes(Number(CURRENT_USER_ID));
            }

            return fetchUserName(details.creator || details.owner || details.user || 0)
                .then((creatorName) => {
                    renderChannelDetails(details, creatorName || 'Unknown', isMember);
                    try {
                        const snap = readSnapshot() || {};
                        snap.channelId = channelId;
                        snap.details = details;
                        snap.creatorName = creatorName || 'Unknown';
                        writeSnapshot(snap);
                    } catch (e) { }
                    setComposerEnabled(isMember);
                    return isMember;
                });
        })
        .catch(() => {
            showError('Network error while loading channel');
            setOfflineUI(!navigator.onLine); if (OFFLINE) renderFromSnapshotIfAny();
            setComposerEnabled(false);
            return false;
        });
};

const updateMessage = (channelId, messageId, newText) => {
    if (!requireOnlineOrFail()) return Promise.reject?.() ?? undefined;
    return fetch(`http://localhost:5005/message/${channelId}/${messageId}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${TOKEN}`,
        },
        body: JSON.stringify({ message: newText })
    })
        .then(res => res.json().then(json => ({ ok: res.ok, json })))
        .then(({ ok, json }) => {
            if (!ok) { showError(json && json.error ? json.error : 'Failed to edit message'); return; }
            return loadChannelMessages(channelId);
        })
        .catch(() => showError('Network error while editing message'));
};

const renderChannelList = (publicChannels, myPrivate) => {
    const list = document.getElementById('channel-list');
    if (!list) return;
    list.textContent = '';

    // Public section
    const pubHeader = document.createElement('div');
    pubHeader.className = 'text-muted fw-semibold my-2';
    pubHeader.innerText = 'Public';
    list.appendChild(pubHeader);

    publicChannels.forEach(ch => {
        const a = document.createElement('a');
        a.href = '#';
        a.className = 'list-group-item list-group-item-action channel-container';
        a.dataset.id = ch.id;
        a.textContent = `# ${ch.name}`;
        a.addEventListener('click', (e) => {
            e.preventDefault();
            window.location.hash = `#channel=${ch.id}`;
        });
        list.appendChild(a);
    });

    // Private section
    const priHeader = document.createElement('div');
    priHeader.className = 'text-muted fw-semibold my-2';
    priHeader.innerText = 'Private';
    list.appendChild(priHeader);

    myPrivate.forEach(ch => {
        const a = document.createElement('a');
        a.href = `#channel=${ch.id}`;
        a.className = 'list-group-item list-group-item-action channel-container';
        a.dataset.id = ch.id;
        a.textContent = `# ${ch.name}`;
        a.addEventListener('click', (e) => {
            e.preventDefault();
            window.location.hash = `#channel=${ch.id}`;
        });
        list.appendChild(a);
    });

    syncDrawerChannelList();
};

const hookCreateChannelForm = () => {
    const form = document.getElementById('create-channel-form');
    if (!form) return;
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const name = document.getElementById('create-channel-name').value;
        const desc = document.getElementById('create-channel-description').value;
        const isPrivate = document.getElementById('create-channel-is-private').checked;
        if (!name || !name.trim()) { showError('Channel name is required'); return; }
        createChannel(name, desc, isPrivate);
    });
};

let CURRENT_USER_ID = null;
const USER_CACHE = {};

const renderChannelDetails = (details, creatorName, isMember) => {
    const box = document.getElementById('channel-details-container');
    if (!box) return;
    box.textContent = '';

    ensureChannelHeaderRow();

    // no member: Join only
    if (!isMember) {
        const card = document.createElement('div');
        card.className = 'card border-warning';
        const body = document.createElement('div');
        body.className = 'card-body';

        const t = document.createElement('p');
        t.className = 'card-text';

        const isPriv = !!details.private;
        t.textContent = isPriv
            ? 'You are not a member of this private channel. Ask an admin to invite you.'
            : 'You are not a member of this channel.';

        body.appendChild(t);

        // only public channels show join
        if (!isPriv) {
            const btn = document.createElement('button');
            btn.className = 'btn btn-primary';
            btn.textContent = 'Join channel';
            btn.addEventListener('click', () => joinChannel(CURRENT_CHANNEL_ID));
            body.appendChild(btn);
        }

        card.appendChild(body);
        box.appendChild(card);
        return;
    }


    // member：view + update + Leave
    const card = document.createElement('div');
    card.className = 'card';
    const body = document.createElement('div');
    body.className = 'card-body';

    const nameText = document.createElement('div');
    nameText.className = 'fs-5 fw-semibold';
    nameText.textContent = details.name + (details.description ? ' — ' + details.description : '');

    // read only msg
    const info = document.createElement('div');
    info.className = 'text-secondary mt-3';
    var kind = details.private ? 'Private' : 'Public';
    var dt = details.createdAt || details.created || null;
    var when = dt ? new Date(dt).toLocaleString() : '';
    info.textContent = kind + (when ? (' · ' + when) : '') + ' · by ' + (creatorName || 'Unknown');

    body.appendChild(nameText);
    body.appendChild(info);
    card.appendChild(body);
    box.appendChild(card);

    mountChannelTools(details, true);
};

// ===== Edit Channel (modal) support =====
let EDIT_CHANNEL_CTX = null;

(function () {
    var modalEl = document.getElementById('editChannelModal');
    var nameEl = document.getElementById('edit-channel-name');
    var descEl = document.getElementById('edit-channel-description');
    var saveBtn = document.getElementById('edit-channel-save');
    if (!modalEl || !nameEl || !descEl || !saveBtn) return;

    var modal = new bootstrap.Modal(modalEl);

    window.openEditChannelModal = function (details) {
        nameEl.value = details && details.name ? details.name : '';
        descEl.value = details && details.description ? details.description : '';
        EDIT_CHANNEL_CTX = { id: (typeof CURRENT_CHANNEL_ID === 'number' ? CURRENT_CHANNEL_ID : Number(CURRENT_CHANNEL_ID)) || null };
        modal.show();
    };

    saveBtn.addEventListener('click', function () {
        if (!EDIT_CHANNEL_CTX || !EDIT_CHANNEL_CTX.id) return;

        var newName = (nameEl.value || '').trim();
        var newDesc = (descEl.value || '').trim();
        if (!newName) { showError('Channel name is required'); return; }

        updateChannel(EDIT_CHANNEL_CTX.id, newName, newDesc);
        modal.hide();
        EDIT_CHANNEL_CTX = null;
    });
})();

// === Singletons in channel header tools ===
function mountChannelTools(details, isMember) {
    var tools = ensureChannelHeaderRow();
    if (!tools) return;

    var editBtn = tools.querySelector('#btn-edit-channel');
    var leaveBtn = tools.querySelector('#btn-leave-channel');

    if (!isMember) {
        if (editBtn) editBtn.remove();
        if (leaveBtn) leaveBtn.remove();
        return;
    }

    // —— Edit —— //
    if (!editBtn) {
        editBtn = document.createElement('button');
        editBtn.id = 'btn-edit-channel';
        editBtn.type = 'button';
        editBtn.className = 'btn btn-outline-primary btn-sm';
        editBtn.textContent = 'Edit channel';
        tools.appendChild(editBtn);
    }
    editBtn.onclick = function () { openEditChannelModal(details || {}); };

    // —— Leave —— //
    if (!leaveBtn) {
        leaveBtn = document.createElement('button');
        leaveBtn.id = 'btn-leave-channel';
        leaveBtn.type = 'button';
        leaveBtn.className = 'btn btn-outline-danger btn-sm';
        leaveBtn.textContent = 'Leave channel';
        tools.appendChild(leaveBtn);
    }
    leaveBtn.onclick = function () {
        if (typeof CURRENT_CHANNEL_ID !== 'undefined' && CURRENT_CHANNEL_ID != null) {
            leaveChannel(CURRENT_CHANNEL_ID);
        }
    };
}

const DEFAULT_AVATAR =
    'data:image/svg+xml;utf8,' +
    encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><rect width="40" height="40" fill="#e9ecef"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="Arial" font-size="14" fill="#6c757d">🙂</text></svg>');

const USER_PHOTO_CACHE = {};

const renderMessageList = (messages, opts) => {
    opts = opts || {}; // { scroll: 'bottom' | 'keep' | 'none' }
    const wrap = document.getElementById('message-list');
    if (!wrap) return;
    wrap.textContent = '';

    // 1) order time: old -> new
    const ordered = messages.slice().sort((a, b) => {
        const ta = new Date(a.sentAt || a.timeSent || a.timestamp || 0).getTime();
        const tb = new Date(b.sentAt || b.timeSent || b.timestamp || 0).getTime();
        return ta - tb;
    });

    // 2) DOM every msg, but not append
    const nodePromises = ordered.map((m) => {
        const senderId = m.sender || m.user || m.author;
        const text = m.message || m.text || m.body || '';
        const t = new Date(m.sentAt || m.timeSent || m.timestamp || Date.now());

        return Promise.all([ensureMe(), fetchUserName(senderId), fetchUserPhoto(senderId)])
            .then(([myId, name, avatar]) => {
                const row = document.createElement('div');
                row.className = 'message-container d-flex align-items-start mb-3';

                const img = document.createElement('img');
                img.src = avatar || DEFAULT_AVATAR;
                img.alt = name || 'user';
                img.width = 40; img.height = 40;
                img.className = 'rounded-circle me-2 flex-shrink-0';

                const body = document.createElement('div');
                body.className = 'flex-grow-1';

                const head = document.createElement('div');
                head.className = 'd-flex align-items-baseline';

                const editedAt = m.editedAt || m.edited_at || m.editedAtTime;
                const wasEdited = Boolean(m.edited || editedAt);

                const nameEl = document.createElement('strong');
                nameEl.textContent = name || 'Unknown';
                nameEl.classList.add('message-user-name');
                nameEl.dataset.userId = String(senderId);
                nameEl.style.cursor = 'pointer';

                const timeEl = document.createElement('span');
                timeEl.className = 'text-secondary ms-2';
                timeEl.textContent = t.toLocaleString();

                if (wasEdited) {
                    const editedEl = document.createElement('span');
                    editedEl.className = 'text-secondary ms-2';
                    const et = editedAt ? new Date(editedAt) : t;
                    editedEl.textContent = `(edited ${et.toLocaleString()})`;
                    head.appendChild(editedEl);
                }

                const content = document.createElement('div');
                if (m.image) {
                    // 2.5.2 thumb
                    const thumb = document.createElement('img');
                    thumb.className = 'message-image';
                    thumb.src = m.image;
                    thumb.dataset.msgId = String(m.id || '');
                    thumb.dataset.imageUrl = m.image;
                    thumb.addEventListener('click', function () {
                        openImageViewerFromThumb(thumb);
                    });
                    content.appendChild(thumb);
                } else {
                    // text only
                    content.textContent = text || '';
                }

                head.appendChild(nameEl);
                head.appendChild(timeEl);

                body.appendChild(head);
                body.appendChild(content);
                row.appendChild(img);
                row.appendChild(body);

                // append emoji
                // 1) after timestamp, btn of reacts
                const rxnDrop = document.createElement('div');
                rxnDrop.className = 'dropdown d-inline-block ms-2';

                const addBtn = document.createElement('button');
                addBtn.type = 'button';
                addBtn.className = 'btn btn-link btn-sm p-0 add-reaction dropdown-toggle';
                addBtn.setAttribute('data-bs-toggle', 'dropdown');
                addBtn.setAttribute('aria-expanded', 'false');
                addBtn.dataset.id = m.id;
                addBtn.textContent = '🙂';

                const menu = document.createElement('div');
                menu.className = 'dropdown-menu dropdown-menu-emoji';

                REACTIONS.forEach(emoji => {
                    const btn = document.createElement('button');
                    btn.type = 'button';
                    btn.className = 'dropdown-item reaction-pick';
                    btn.dataset.id = m.id;
                    btn.dataset.react = emoji;
                    btn.textContent = emoji;
                    menu.appendChild(btn);
                });

                rxnDrop.appendChild(addBtn);
                rxnDrop.appendChild(menu);
                head.appendChild(rxnDrop);

                // —— actionsWrap —— //
                const actionsWrap = document.createElement('div');
                actionsWrap.className = 'dropdown d-inline-block ms-2';

                // toggle
                const actionsToggle = document.createElement('button');
                actionsToggle.type = 'button';
                actionsToggle.className = 'btn btn-sm actions-toggle py-0 px-2';
                actionsToggle.setAttribute('data-bs-toggle', 'dropdown');
                actionsToggle.setAttribute('aria-expanded', 'false');
                actionsToggle.textContent = '✍️';

                // dropdown-menu
                const actionsMenu = document.createElement('div');
                actionsMenu.className = 'dropdown-menu dropdown-menu-actions dropdown-menu-edit';

                // own send & msg: Edit
                if (Number(myId) === Number(senderId) && !m.image) {
                    const editItem = document.createElement('button');
                    editItem.type = 'button';
                    editItem.className = 'dropdown-item message-edit-button';
                    editItem.dataset.id = m.id;
                    editItem.dataset.text = text;
                    editItem.textContent = 'edit';
                    actionsMenu.appendChild(editItem);
                }

                // own send: Delete
                if (Number(myId) === Number(senderId)) {
                    const delItem = document.createElement('button');
                    delItem.type = 'button';
                    delItem.className = 'dropdown-item text-danger message-delete-button';
                    delItem.dataset.id = m.id;
                    delItem.textContent = 'delete';
                    actionsMenu.appendChild(delItem);
                }

                // Pin/Unpin: all members
                {
                    const pinItem = document.createElement('button');
                    pinItem.type = 'button';
                    pinItem.className = 'dropdown-item message-pin-button';
                    pinItem.dataset.id = m.id;
                    pinItem.textContent = m.pinned ? 'unpin' : 'pin';
                    if (m.pinned) {
                        row.classList.add('message-pinned');
                    }
                    actionsMenu.appendChild(pinItem);
                }

                actionsWrap.appendChild(actionsToggle);
                actionsWrap.appendChild(actionsMenu);
                head.appendChild(actionsWrap);




                // 2) when msg has reacts, shows reacts
                const reactsArr = m.reacts || [];
                if (reactsArr.length) {
                    const rxnBar = document.createElement('div');
                    rxnBar.className = 'mt-2';

                    const counts = {};
                    reactsArr.forEach(r => (counts[r.react] = (counts[r.react] || 0) + 1));

                    const myIdNum = Number(CURRENT_USER_ID);
                    REACTIONS.forEach(emoji => {
                        const count = counts[emoji] || 0;
                        if (!count) return;

                        const mine = reactsArr.some(r => Number(r.user) === myIdNum && r.react === emoji);

                        const chip = document.createElement('button');
                        chip.type = 'button';
                        chip.className = `btn btn-sm ${mine ? 'btn-primary' : 'btn-outline-secondary'} me-2 reaction-chip`;
                        chip.dataset.id = m.id;
                        chip.dataset.react = emoji;
                        chip.dataset.active = mine ? '1' : '0';
                        chip.textContent = `${emoji} ${count}`;
                        rxnBar.appendChild(chip);
                    });

                    body.appendChild(rxnBar);
                }


                return row;
            });
    });

    // 3) time order append
    return Promise.all(nodePromises).then((nodes) => {
        const frag = document.createDocumentFragment();
        nodes.forEach((n) => frag.appendChild(n));
        wrap.appendChild(frag);

        var scroller = document.getElementById('message-scroll');
        if (!scroller) return;
        if (opts.scroll === 'bottom') {
            scroller.scrollTop = scroller.scrollHeight;
        }
    });
};


// send msg
const setComposerEnabled = (enabled) => {
    const inp = document.getElementById('message-input');
    const btn = document.getElementById('message-send-button');
    if (!inp || !btn) return;
    inp.disabled = !enabled;
    btn.disabled = !enabled;
    inp.placeholder = enabled ? 'Write a message…' : 'Join the channel to send messages';
};

(() => {
    const composer = document.getElementById('message-composer');
    const input = document.getElementById('message-input');
    if (!composer || !input) return;

    composer.addEventListener('submit', (e) => {
        e.preventDefault();
        const text = (input.value || '').trim();
        if (!text) return;
        if (!CURRENT_CHANNEL_ID) return;

        sendMessage(CURRENT_CHANNEL_ID, text)
            .then(() => { input.value = ''; })
            .catch(() => { });
    });

    // Enter send
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            composer.dispatchEvent(new Event('submit'));
        }
    });
})();

// delete msg
(() => {
    const list = document.getElementById('message-list');
    if (!list) return;

    list.addEventListener('click', (e) => {
        const btn = e.target.closest('.message-delete-button');
        if (!btn) return;
        const messageId = Number(btn.dataset.id);
        if (!CURRENT_CHANNEL_ID || !messageId) return;
        if (!confirm('Delete this message?')) return;
        deleteMessage(CURRENT_CHANNEL_ID, messageId);
    });
})();

// edit msg (modal)
(() => {
    const list = document.getElementById('message-list');
    const modalEl = document.getElementById('editMessageModal');
    if (!list || !modalEl) return;

    const input = document.getElementById('edit-message-input');
    const saveBtn = document.getElementById('edit-message-save');
    const modal = new bootstrap.Modal(modalEl);

    let editingId = null;
    let oldText = '';

    // edit
    list.addEventListener('click', (e) => {
        const btn = e.target.closest('.message-edit-button');
        if (!btn) return;
        editingId = Number(btn.dataset.id);
        oldText = btn.dataset.text || '';
        input.value = oldText;
        modal.show();
    });

    // save
    saveBtn.addEventListener('click', () => {
        if (!CURRENT_CHANNEL_ID || !editingId) return;
        const newText = (input.value || '').trim();

        if (!newText) { showError('Message cannot be empty.'); return; }
        if (newText === (oldText || '').trim()) { showError('Please change the text before saving.'); return; }

        updateMessage(CURRENT_CHANNEL_ID, editingId, newText)
            .then(() => {
                modal.hide();
                editingId = null;
                oldText = '';
            });
    });
})();

// reopen modal that cover by edit error
(() => {
    const err = document.getElementById('errorModal');
    if (!err) return;

    err.addEventListener('hidden.bs.modal', () => {
        if (!RESUME_MODAL_ID) return;
        const prev = document.getElementById(RESUME_MODAL_ID);
        RESUME_MODAL_ID = null;
        if (prev) {
            const inst = bootstrap.Modal.getInstance(prev) || new bootstrap.Modal(prev);
            inst.show();
        }
    });
})();

// fetch my id 
const ensureMe = () => {
    if (CURRENT_USER_ID != null && !Number.isNaN(CURRENT_USER_ID)) {
        return Promise.resolve(CURRENT_USER_ID);
    }
    return fetchMe();
};

const REACTIONS = ['👍', '💕', '😆'];
let LAST_MESSAGES = [];

// switch reacts: reacted -> POST /unreact; didn't react -> POST /react
const toggleReact = (channelId, messageId, emoji) => {
    if (!requireOnlineOrFail()) return Promise.reject?.() ?? undefined;

    const mid = Number(messageId);
    const msg = Array.isArray(LAST_MESSAGES)
        ? LAST_MESSAGES.find(m => Number(m.id) === mid)
        : null;

    if (!msg) {
        return loadChannelMessages(channelId).then(() => {
            const again = Array.isArray(LAST_MESSAGES)
                ? LAST_MESSAGES.find(m => Number(m.id) === mid)
                : null;
            if (!again) { showError('Message not found'); return; }
            return toggleReact(channelId, messageId, emoji);
        });
    }

    const myId = Number(CURRENT_USER_ID);
    const already = Array.isArray(msg.reacts)
        && msg.reacts.some(r => Number(r.user) === myId && r.react === emoji);

    const url = `http://localhost:5005/message/${already ? 'unreact' : 'react'}/${channelId}/${mid}`;

    return fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${TOKEN}`,
        },
        body: JSON.stringify({ react: emoji }),
    })
        .then(res => res.ok
            ? null
            : res.json().then(x => { throw new Error(x.error || 'React failed'); })
        )
        .then(() => loadChannelMessages(channelId))
        .catch(err => showError(err.message || 'Network error while reacting'));
};


// reaction add / cancel
(() => {
    const list = document.getElementById('message-list');
    if (!list) return;

    list.addEventListener('click', (e) => {
        const pick = e.target.closest('.reaction-pick');
        if (pick) {
            const messageId = Number(pick.dataset.id);
            const emoji = pick.dataset.react;
            if (CURRENT_CHANNEL_ID && messageId && emoji) {
                toggleReact(CURRENT_CHANNEL_ID, messageId, emoji);
            }
            return;
        }

        const chip = e.target.closest('.reaction-chip');
        if (chip) {
            const messageId = Number(chip.dataset.id);
            const emoji = chip.dataset.react;
            if (CURRENT_CHANNEL_ID && messageId && emoji) {
                toggleReact(CURRENT_CHANNEL_ID, messageId, emoji);
            }
        }
    });
})();

function renderPinnedSummaryButton() {
    var host = document.getElementById('channel-tools') || document.getElementById('channel-details-container');
    if (!host) return;

    var btn = document.getElementById('pinned-summary-button');
    if (!btn) {
        btn = document.createElement('button');
        btn.id = 'pinned-summary-button';
        btn.type = 'button';
        btn.className = 'btn btn-outline-secondary btn-sm';
        btn.addEventListener('click', function () {
            showModalById('pinnedModal');
        });
        host.appendChild(btn);
    }

    fetchAllPinnedMessages(CURRENT_CHANNEL_ID)
        .then(function (list) {
            btn.textContent = list.length ? ('Pinned (' + list.length + ')') : 'Pinned (0)';
        })
        .catch(function () {
            btn.textContent = 'Pinned';
        });
}

// open all pinned msg
document.addEventListener('shown.bs.modal', (ev) => {
    if (ev.target.id !== 'pinnedModal') return;
    const list = document.getElementById('pinned-list');
    list.textContent = '';

    const loading = document.createElement('div');
    loading.className = 'text-muted';
    loading.textContent = 'Loading…';
    list.appendChild(loading);

    fetchAllPinnedMessages(CURRENT_CHANNEL_ID)
        .then((pinned) => {
            list.textContent = '';
            if (!pinned.length) {
                const empty = document.createElement('div');
                empty.className = 'text-muted';
                empty.textContent = 'No pinned messages';
                list.appendChild(empty);
                return;
            }

            pinned.forEach((m) => {
                const item = document.createElement('div');
                item.className = 'list-group-item';

                const row = document.createElement('div');
                row.className = 'd-flex justify-content-between';

                const msgEl = document.createElement('div');
                msgEl.className = 'fw-semibold';
                msgEl.textContent = m.message || '';

                const whenEl = document.createElement('small');
                whenEl.className = 'text-muted';
                whenEl.textContent = new Date(m.sentAt || m.time || Date.now()).toLocaleString();

                row.appendChild(msgEl);
                row.appendChild(whenEl);
                item.appendChild(row);
                list.appendChild(item);
            });
        })
        .catch((err) => {
            list.textContent = '';
            const errEl = document.createElement('div');
            errEl.className = 'text-danger';
            errEl.textContent = err.message || 'Failed to load pinned';
            list.appendChild(errEl);
        });
});

// pin / unpin msg
(() => {
    const list = document.getElementById('message-list');
    if (!list) return;

    list.addEventListener('click', (e) => {
        const btn = e.target.closest('.message-pin-button');
        if (!btn) return;

        const messageId = Number(btn.dataset.id);
        if (!CURRENT_CHANNEL_ID || !messageId) return;

        const msg = (LAST_MESSAGES || []).find(m => Number(m.id) === messageId);
        if (!msg) { showError('Message not found locally'); return; }

        const doReq = msg.pinned
            ? unpinMessage(CURRENT_CHANNEL_ID, messageId)
            : pinMessage(CURRENT_CHANNEL_ID, messageId);

        doReq
            .then(() => loadChannelMessages(CURRENT_CHANNEL_ID))
            .then(() => renderPinnedSummaryButton())
            .catch(err => showError(err?.message || 'Failed to toggle pin'));
    });
})();

function closeInviteOverlay() {
    var box = document.getElementById('channel-invite-container');
    if (box) box.classList.add('d-none');
}

// close invite btn
(function () {
    var btnClose = document.getElementById('invite-cancel-button');
    if (btnClose) btnClose.addEventListener('click', closeInviteOverlay);

    var overlay = document.getElementById('channel-invite-container');
    if (overlay) overlay.addEventListener('click', function (e) {
        if (e.target === overlay) closeInviteOverlay();
    });

    var list = document.getElementById('invite-list');
    if (list) list.addEventListener('change', function (e) {
        var cb = e.target && e.target.closest('.invite-member-checkbox');
        if (!cb) return;
        renderInviteSelectedBadges();
    });
})();

function renderInviteSelectedBadges() {
    var list = document.getElementById('invite-list');
    var box = document.getElementById('invite-selected');
    if (!list || !box) return;

    var names = [];
    var boxes = list.querySelectorAll('.invite-member-checkbox');
    for (var i = 0; i < boxes.length; i++) {
        if (boxes[i].checked) names.push(String(boxes[i].dataset.name || ''));
    }
    names.sort(function (a, b) { return a.localeCompare(b); });

    box.textContent = '';
    if (!names.length) {
        var tip = document.createElement('div');
        tip.className = 'text-muted';
        tip.textContent = 'No users selected';
        box.appendChild(tip);
        return;
    }
    var frag = document.createDocumentFragment();
    names.forEach(function (n) {
        var badge = document.createElement('span');
        badge.className = 'badge bg-secondary me-1 mb-1';
        badge.textContent = n;
        frag.appendChild(badge);
    });
    box.appendChild(frag);
}

// invite submit
(() => {
    var submit = document.getElementById('invite-submit-button');
    if (!submit) return;

    submit.addEventListener('click', function () {
        var list = document.getElementById('invite-list');
        if (!list) return;

        var ids = [];
        var boxes = list.querySelectorAll('.invite-member-checkbox');
        for (var i = 0; i < boxes.length; i++) {
            if (boxes[i].checked) ids.push(Number(boxes[i].value));
        }
        if (!ids.length) { showError('Please select at least one user.'); return; }

        submit.disabled = true;
        inviteMembersToChannel(CURRENT_CHANNEL_ID, ids)
            .then(function () {
                submit.disabled = false;
                closeInviteOverlay();
                return loadChannelDetails(CURRENT_CHANNEL_ID);
            })
            .catch(function (err) {
                submit.disabled = false;
                showError(err && err.message ? err.message : 'Failed to invite');
            });
    });
})();

function mountInviteBesidePins() {
    function insert() {
        var ch = (CHANNELS_BY_ID[String(CURRENT_CHANNEL_ID)] || {});
        var isPublic = (ch.private === false);

        // public channel: dont show invite vtn
        var existing = document.getElementById('invite-user-button');
        if (isPublic) {
            if (existing) existing.remove();
            return true;
        }

        var pinsBtn = document.getElementById('pinned-summary-button');
        if (!pinsBtn) return false;

        var inviteBtn = existing;
        if (!inviteBtn) {
            inviteBtn = document.createElement('button');
            inviteBtn.id = 'invite-user-button';
            inviteBtn.type = 'button';
            inviteBtn.className = 'btn btn-primary btn-sm ms-2';
            inviteBtn.textContent = 'Invite users';
            inviteBtn.addEventListener('click', function () {
                renderInviteListForChannel(CURRENT_CHANNEL_ID);
                showModalById('channel-invite-container');
            });
        }

        if (inviteBtn.previousElementSibling !== pinsBtn) {
            pinsBtn.insertAdjacentElement('afterend', inviteBtn);
        }
        return true;

    }

    if (insert()) return;

    var obs = new MutationObserver(function () {
        if (insert()) obs.disconnect();
    });
    obs.observe(document.body, { childList: true, subtree: true });
}

// === Invite modal fuzzy search === //
(() => {
    const searchInput = document.getElementById('invite-search');
    const inviteList = document.getElementById('invite-list');
    if (!searchInput || !inviteList) return;

    let allInviteItems = [];

    window.refreshInviteCache = function () {
        allInviteItems = Array.from(inviteList.querySelectorAll('.list-group-item'));
    };

    // listener for input fuzzy search
    searchInput.addEventListener('input', (e) => {
        const q = e.target.value.trim().toLowerCase();
        if (!q) {
            allInviteItems.forEach(li => li.classList.remove('d-none'));
            return;
        }
        allInviteItems.forEach(li => {
            const text = li.textContent.trim().toLowerCase();
            li.classList.toggle('d-none', !text.includes(q));
        });
    });
})();


function showModalById(id) {
    var el = document.getElementById(id);
    if (!el) return;
    if (el.classList.contains('modal') && window.bootstrap && bootstrap.Modal) {
        var inst = bootstrap.Modal.getOrCreateInstance(el);
        inst.show();
    } else {
        el.classList.remove('d-none');
    }
}

// tools bar
function ensureChannelHeaderRow() {
    const main = document.querySelector('#page-dashboard main');
    if (!main) return null;
    const h1 = main.querySelector('h1');
    if (!h1) return null;

    let header = document.getElementById('channel-header-row');
    if (!header) {
        header = document.createElement('div');
        header.id = 'channel-header-row';
        header.className = 'd-flex align-items-center justify-content-between mb-2';
        h1.parentElement.insertBefore(header, h1);
        header.appendChild(h1);
    }

    let tools = document.getElementById('channel-tools');
    if (!tools) {
        tools = document.createElement('div');
        tools.id = 'channel-tools';
        tools.className = 'd-flex align-items-center gap-2 ';
        header.appendChild(tools);
    }

    return tools;
}

function renderInviteListForChannel(channelId) {
    var list = document.getElementById('invite-list');
    var selectedBox = document.getElementById('invite-selected');
    if (!list) return;

    // Loading…
    list.textContent = '';
    var loading = document.createElement('div');
    loading.className = 'text-muted';
    loading.textContent = 'Loading…';
    list.appendChild(loading);

    Promise.all([fetchAllUsers(), fetchChannelDetail(channelId)])
        .then(function (res) {
            var users = Array.isArray(res[0]) ? res[0] : [];
            var ch = res[1] || {};
            var members = new Set(Array.isArray(ch.members) ? ch.members.map(Number) : []);

            var candidates = users.filter(function (u) { return !members.has(Number(u.id)); });
            candidates.sort(function (a, b) {
                return String(a.name || '').localeCompare(String(b.name || ''));
            });

            list.textContent = '';
            if (candidates.length === 0) {
                var empty = document.createElement('div');
                empty.className = 'text-muted';
                empty.textContent = 'Everyone is already in this channel.';
                list.appendChild(empty);
                if (selectedBox) selectedBox.textContent = '';
                return;
            }

            var frag = document.createDocumentFragment();
            candidates.forEach(function (u) {
                var item = document.createElement('label');
                item.className = 'list-group-item d-flex align-items-center gap-2';

                var cb = document.createElement('input');
                cb.type = 'checkbox';
                cb.className = 'form-check-input invite-member-checkbox';
                cb.value = String(u.id);

                var nameEl = document.createElement('span');
                nameEl.className = 'invite-member-name';
                nameEl.textContent = 'Loading…';
                cb.dataset.name = 'Unknown';
                item.appendChild(cb);
                item.appendChild(nameEl);

                fetchUserName(u.id).then(function (name) {
                    nameEl.textContent = name || 'Unknown';
                    cb.dataset.name = name || 'Unknown';
                    renderInviteSelectedBadges();
                });

                // after name: show email
                var emailHint = document.createElement('small');
                emailHint.className = 'text-muted ms-2';
                emailHint.textContent = String(u.email || '');


                item.appendChild(emailHint);
                frag.appendChild(item);
            });
            list.appendChild(frag);

            if (window.refreshInviteCache) window.refreshInviteCache();

            renderInviteSelectedBadges();
        })
        .catch(function (err) {
            list.textContent = '';
            var e = document.createElement('div');
            e.className = 'text-danger';
            e.textContent = err && err.message ? err.message : 'Failed to load users.';
            list.appendChild(e);
        });
}

// click user name show profile
(function attachProfileOpen() {
    var list = document.getElementById('message-list');
    if (!list) return;
    list.addEventListener('click', function (e) {
        var el = e.target.closest('.message-user-name');
        if (!el) return;
        var uid = Number(el.dataset.userId);
        if (!uid) return;
        window.location.hash = `#profile=${uid}`;
    });
})();

var USER_DETAIL_CACHE = USER_DETAIL_CACHE || {};

function fetchUserDetail(userId) {
    if (USER_DETAIL_CACHE[userId]) return Promise.resolve(USER_DETAIL_CACHE[userId]);
    return fetch('http://localhost:5005/user/' + userId, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + TOKEN }
    })
        .then(function (res) { return res.json().then(function (j) { return { ok: res.ok, json: j }; }); })
        .then(function (r) {
            if (!r.ok || !r.json) throw new Error('load user failed');
            var d = r.json;
            var detail = {
                id: Number(d.id),
                name: d.name || 'Unknown',
                email: d.email || '',
                bio: d.bio || '',
                image: d.image || d.photo || (typeof DEFAULT_AVATAR !== 'undefined' ? DEFAULT_AVATAR : '')
            };
            USER_DETAIL_CACHE[userId] = detail;
            return detail;
        })
        .catch(function () {
            return { id: Number(userId), name: 'Unknown', email: '', bio: '', image: (typeof DEFAULT_AVATAR !== 'undefined' ? DEFAULT_AVATAR : '') };
        });
}

function fillProfile(u) {
    var img = document.getElementById('profile-image');
    var nameEl = document.getElementById('profile-name');
    var emailEl = document.getElementById('profile-email');
    var bioEl = document.getElementById('profile-bio');
    if (img) img.src = u.image || '';
    if (nameEl) nameEl.textContent = u.name || 'Unknown';
    if (emailEl) emailEl.textContent = u.email || '';
    if (bioEl) bioEl.textContent = u.bio ? String(u.bio) : '—';
}

function showProfileModal(show) {
    var modal = document.getElementById('profile-container');
    if (!modal) return;
    if (show) { modal.classList.add('open'); modal.setAttribute('aria-hidden', 'false'); }
    else { modal.classList.remove('open'); modal.setAttribute('aria-hidden', 'true'); }
}

function openUserProfile(userId) {
    fetchUserDetail(userId).then(function (u) {
        fillProfile(u);
        showProfileModal(true);
    });
}

// close profile
(function attachProfileClose() {
    var modal = document.getElementById('profile-container');
    var btn = document.getElementById('profile-close');
    if (btn) btn.addEventListener('click', function () { showProfileModal(false); });
    if (modal) modal.addEventListener('click', function (e) {
        if (e.target && e.target.dataset && e.target.dataset.close) showProfileModal(false);
    });
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') showProfileModal(false);
    });
})();

// 2.4.3 Viewing and editing user's own profile
function showProfileLikeModal(id, show) {
    var el = document.getElementById(id);
    if (!el) return;
    if (show) { el.classList.add('open'); el.setAttribute('aria-hidden', 'false'); }
    else { el.classList.remove('open'); el.setAttribute('aria-hidden', 'true'); }
}

// fill sidebar profile
function initAvatarLabel() {
    var box = document.getElementById('avatar-label');
    if (!box) return;
    ensureMe()
        .then(function (uid) {
            return fetch('http://localhost:5005/user/' + uid, {
                headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + TOKEN }
            }).then(function (res) { return res.ok ? res.json() : null; });
        })
        .then(function (u) {
            if (!u) return;
            var img = document.getElementById('avatar-image');
            var nameEl = document.getElementById('avatar-name');
            var emailEl = document.getElementById('avatar-email');
            if (img) img.src = (u.image || u.photo || DEFAULT_AVATAR);
            if (nameEl) nameEl.textContent = u.name || 'Me';
            var myEmail = sessionStorage.getItem('email') || localStorage.getItem('email') || u.email || '';
            if (emailEl) emailEl.textContent = myEmail;
            box.onclick = function () {
                if (window.location.hash === '#profile') {
                    openOwnProfile();
                } else {
                    window.location.hash = '#profile';
                }
            };
        })
        .catch(function () { /* ignore */ });
}

function openOwnProfile() {
    if (!requireOnlineOrFail()) return Promise.reject?.() ?? undefined;

    ensureMe()
        .then(function (uid) {
            return fetch('http://localhost:5005/user/' + uid, {
                headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + TOKEN }
            }).then(function (res) { return res.ok ? res.json() : null; });
        })
        .then(function (u) {
            if (!u) { showError('Failed to load profile'); return; }
            var img = document.getElementById('own-profile-image');
            var nameEl = document.getElementById('own-profile-name');
            var emailEl = document.getElementById('own-profile-email');
            var bioEl = document.getElementById('own-profile-bio');
            if (img) img.src = (u.image || u.photo || DEFAULT_AVATAR);
            if (nameEl) nameEl.value = u.name || '';
            if (emailEl) emailEl.value = u.email || '';
            if (bioEl) bioEl.value = u.bio || '';
            var pw = document.getElementById('own-profile-password'); if (pw) pw.value = '';
            showProfileLikeModal('own-profile-container', true);
        })
        .catch(function () { showError('Network error while loading profile'); });
}

(function () {
    var saveBtn = document.getElementById('own-profile-save');
    if (!saveBtn) return;

    saveBtn.addEventListener('click', function () {
        var body = {
            name: (document.getElementById('own-profile-name').value || '').trim(),
            bio: (document.getElementById('own-profile-bio').value || '').trim()
        };
        var newPwd = (document.getElementById('own-profile-password').value || '').trim();
        if (newPwd) body.password = newPwd;

        var file = (document.getElementById('own-profile-photo').files || [])[0];

        function doUpdate(imgData) {
            if (imgData) body.image = imgData;

            fetch('http://localhost:5005/user', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + TOKEN },
                body: JSON.stringify(body)
            })
                .then(function (res) { return res.json().then(function (json) { return { ok: res.ok, json: json }; }); })
                .then(function (resp) {
                    if (!resp.ok) { showError((resp.json && resp.json.error) || 'Failed to update profile'); return; }

                    initAvatarLabel();
                    // update cashes
                    if (CURRENT_USER_ID != null) {
                        delete USER_CACHE[CURRENT_USER_ID];
                        delete USER_PHOTO_CACHE[CURRENT_USER_ID];
                    }
                    // then reload messages of current channel
                    if (CURRENT_CHANNEL_ID != null) {
                        loadChannelMessages(CURRENT_CHANNEL_ID);
                    }
                    showProfileLikeModal('own-profile-container', false);
                    if (body.email) {
                        if (localStorage.getItem('token')) localStorage.setItem('email', body.email);
                        if (sessionStorage.getItem('token')) sessionStorage.setItem('email', body.email);
                    }
                })
                .catch(function () { showError('Network error while updating profile'); });
        }

        if (file) {
            fileToDataUrl(file).then(function (dataUrl) { doUpdate(dataUrl); });
        } else {
            doUpdate(null);
        }
    });
})();

// my profile modal show/hide psw
(function () {
    var tog = document.getElementById('own-profile-toggle');
    var pw = document.getElementById('own-profile-password');
    if (!tog || !pw) return;
    tog.addEventListener('click', function () {
        var isPw = pw.type === 'password';
        pw.type = isPw ? 'text' : 'password';
        tog.textContent = isPw ? 'Hide' : 'Show';
    });
})();

// close my profile modal
(function () {
    var modal = document.getElementById('own-profile-container');
    var closeBtn = document.getElementById('own-profile-close');
    if (closeBtn) closeBtn.addEventListener('click', function () { showProfileLikeModal('own-profile-container', false); });
    if (modal) modal.addEventListener('click', function (e) { if (e.target && e.target.dataset && e.target.dataset.close) showProfileLikeModal('own-profile-container', false); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') showProfileLikeModal('own-profile-container', false); });
})();

// dashboard init profile photo
(function hookInitAvatar() {
    initAvatarLabel();
})();

// ---- Send photo (2.5.1) ----
(function initSendPhoto() {
    var btn = document.getElementById('composer-image-btn');
    var input = document.getElementById('composer-image');
    if (!btn || !input) return;

    btn.addEventListener('click', function () { input.click(); });

    input.addEventListener('change', function () {
        var f = (input.files || [])[0];
        if (!f) return;

        fileToDataUrl(f).then(function (dataUrl) {
            // only send photo
            var channelId = typeof CURRENT_CHANNEL_ID !== 'undefined' ? CURRENT_CHANNEL_ID : null;
            if (!channelId) { showError('No channel selected'); return; }

            fetch('http://localhost:5005/message/' + channelId, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + TOKEN },
                body: JSON.stringify({ image: dataUrl })
            })
                .then(function (res) { return res.json().then(function (j) { return { ok: res.ok, json: j }; }); })
                .then(function (resp) {
                    if (!resp.ok) { showError((resp.json && resp.json.error) || 'Failed to send image'); return; }
                    input.value = '';
                    if (typeof loadChannelMessages === 'function') loadChannelMessages(channelId);
                })
                .catch(function () { showError('Network error while sending image'); });
        });
    });
})();


// ---- Image viewer (2.5.2) ----
var IMAGE_VIEW_LIST = [];   // current channel photo URL list
var IMAGE_VIEW_INDEX = -1;  // current photo index

// after load msg
function rebuildImageViewList() {
    var nodes = document.querySelectorAll('.message-image');
    IMAGE_VIEW_LIST = Array.prototype.map.call(nodes, function (n) { return n.dataset.imageUrl || n.src; });
}

function showImageModal(open) {
    var modal = document.getElementById('image-modal');
    if (!modal) return;
    if (open) { modal.classList.add('open'); modal.setAttribute('aria-hidden', 'false'); }
    else { modal.classList.remove('open'); modal.setAttribute('aria-hidden', 'true'); }
}

function renderImageModal() {
    var img = document.getElementById('image-modal-img');
    if (!img) return;
    if (IMAGE_VIEW_INDEX < 0 || IMAGE_VIEW_INDEX >= IMAGE_VIEW_LIST.length) return;
    img.src = IMAGE_VIEW_LIST[IMAGE_VIEW_INDEX];
}

// open thumb
function openImageViewerFromThumb(imgEl) {
    rebuildImageViewList();
    var url = imgEl.dataset.imageUrl || imgEl.src;
    IMAGE_VIEW_INDEX = Math.max(0, IMAGE_VIEW_LIST.indexOf(url));
    renderImageModal();
    showImageModal(true);
}

// arrow : left/right, view photo
(function initImageNav() {
    var prev = document.getElementById('image-prev');
    var next = document.getElementById('image-next');
    if (prev) prev.addEventListener('click', function () {
        if (!IMAGE_VIEW_LIST.length) return;
        IMAGE_VIEW_INDEX = (IMAGE_VIEW_INDEX - 1 + IMAGE_VIEW_LIST.length) % IMAGE_VIEW_LIST.length;
        renderImageModal();
    });
    if (next) next.addEventListener('click', function () {
        if (!IMAGE_VIEW_LIST.length) return;
        IMAGE_VIEW_INDEX = (IMAGE_VIEW_INDEX + 1) % IMAGE_VIEW_LIST.length;
        renderImageModal();
    });

    // close modal
    var modal = document.getElementById('image-modal');
    var closeBtn = document.getElementById('image-modal-close');
    if (closeBtn) closeBtn.addEventListener('click', function () { showImageModal(false); });
    if (modal) modal.addEventListener('click', function (e) {
        if (e.target && e.target.dataset && e.target.dataset.close) showImageModal(false);
    });
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') showImageModal(false);
        if (e.key === 'ArrowLeft') { if (prev) prev.click(); }
        if (e.key === 'ArrowRight') { if (next) next.click(); }
    });
})();

// measure navbar height
(function () {
    function setNavbarVar() {
        var hd = document.querySelector('#page-dashboard header.navbar');
        if (hd) {
            document.documentElement.style.setProperty('--navbar-h', hd.offsetHeight + 'px');
        }
    }
    document.addEventListener('DOMContentLoaded', setNavbarVar);
    window.addEventListener('resize', setNavbarVar);
})();

// ===== Infinite Scroll state =====
var PAGE_SIZE = 25;
var isLoadingOlder = false;
var hasMoreOlder = true;
var nextStart = 0;
var SCROLLER_BOUND = false;

function showTopLoader(show) {
    var el = document.getElementById('message-top-loader');
    if (el) el.style.display = show ? 'block' : 'none';
}

function bindScrollerOnce() {
    if (SCROLLER_BOUND) return;
    var scroller = document.getElementById('message-scroll');
    if (!scroller) return;
    SCROLLER_BOUND = true;
    scroller.addEventListener('scroll', function () {
        if (scroller.scrollTop <= 80 && !isLoadingOlder && hasMoreOlder) {
            loadOlderMessages();
        }
    });
}

function loadOlderMessages() {
    if (!CURRENT_CHANNEL_ID) return;
    isLoadingOlder = true;
    showTopLoader(true);

    var url = 'http://localhost:5005/message/' + CURRENT_CHANNEL_ID + '?start=' + nextStart;
    fetch(url, { headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + TOKEN } })
        .then(function (res) { return res.json().then(function (j) { return { ok: res.ok, json: j }; }); })
        .then(function (resp) {
            if (!resp.ok) { hasMoreOlder = false; return; }
            var batch = Array.isArray(resp.json) ? resp.json : (resp.json && resp.json.messages) || [];
            if (!batch.length) { hasMoreOlder = false; return; }

            var scroller = document.getElementById('message-scroll');
            var prevH = scroller.scrollHeight;
            var prevTop = scroller.scrollTop;

            LAST_MESSAGES = batch.concat(LAST_MESSAGES);
            return renderMessageList(LAST_MESSAGES, { scroll: 'none' }).then(function () {
                var newH = scroller.scrollHeight;
                scroller.scrollTop = newH - prevH + prevTop;
                nextStart += batch.length;
            });
        })
        .catch(function () { hasMoreOlder = false; })
        .finally(function () {
            isLoadingOlder = false;
            showTopLoader(false);
        });
}

// ===== Push Notifications: UI mount =====
function ensureNotifPanel() {
    var side = document.getElementById('channel-list');
    if (!side) return null;

    var panel = document.getElementById('notif-panel');
    if (panel) return panel;

    panel = document.createElement('div');
    panel.id = 'notif-panel';
    panel.className = 'mb-3';

    // header: “Notifications” + count
    var header = document.createElement('div');
    header.className = 'd-flex align-items-center justify-content-between px-3 py-2';
    var title = document.createElement('div'); title.textContent = 'Notifications';
    var badge = document.createElement('span'); badge.id = 'notif-count'; badge.className = 'badge text-bg-secondary'; badge.textContent = '0';
    header.appendChild(title); header.appendChild(badge);

    // list
    var list = document.createElement('div');
    list.id = 'notif-list';
    list.className = 'list-group list-group-flush small';

    // sidebar
    side.parentNode.insertBefore(panel, side);
    panel.appendChild(header);
    panel.appendChild(list);
    return panel;
}

// ===== Push Notifications: state & helpers =====
var NOTIF_LAST_SEEN = {};     // { [channelId]: lastMessageId }
var NOTIF_TIMER = null;
var NOTIF_INTERVAL = 2000;    // 2s polling
var NOTIF_LAST_ALERTED = {};   // { [channelId]: lastMessageId }
// ===== Notification queue (cap visible to 2) =====
var NOTIF_QUEUE = [];                  // [{ channelId, lastId, msg }]
var MAX_VISIBLE_NOTIFS = 2;
var NOTIF_BASELINE_DONE = {};
var NOTIF_STORAGE_KEY = 'notif_state_v1_' + String(CURRENT_USER_ID || 'anon');

function saveNotifState() {
    try {
        localStorage.setItem(
            NOTIF_STORAGE_KEY,
            JSON.stringify({
                alerted: NOTIF_LAST_ALERTED,
                seen: NOTIF_LAST_SEEN,
                baselined: NOTIF_BASELINE_DONE
            })
        );
    } catch (_) { }
}

function loadNotifState() {
    try {
        var raw = localStorage.getItem(NOTIF_STORAGE_KEY);
        if (!raw) return;
        var x = JSON.parse(raw);
        NOTIF_LAST_ALERTED = x && x.alerted || {};
        NOTIF_LAST_SEEN = x && x.seen || {};
        NOTIF_BASELINE_DONE = x && x.baselined || {};
    } catch (_) { }
}


// use newest msg to initialize as read, avoid reporting a bunch of historical messages during the first polling.
function primeNotifications() {
    var ids = Object.keys(CHANNELS_BY_ID)
        .filter(id => CHANNELS_BY_ID[id] && CHANNELS_BY_ID[id].canRead);
    var tasks = ids.map(function (cid) {
        return fetch('http://localhost:5005/message/' + cid + '?start=0', {
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + TOKEN }
        })
            .then(function (res) { return res.json().then(function (j) { return { ok: res.ok, json: j, cid: cid }; }); })
            .then(function (resp) {
                if (!resp.ok) return;
                var list = Array.isArray(resp.json) ? resp.json : (resp.json && resp.json.messages) || [];
                if (list.length) {
                    var latest = getLatestMessage(list);
                    if (!latest) return;
                    NOTIF_LAST_SEEN[String(resp.cid)] = latest.id;
                }
            })
            .catch(function () { });
    });
    return Promise.all(tasks);
}

function pushOneNotification(msg, channelId, lastId) {
    ensureNotifPanel();
    var list = document.getElementById('notif-list');
    if (!list) return;

    // ---- DOM Remove duplicates: If a message with the same ID already exists in the same channel, skip it. ----
    for (var i = 0; i < NOTIF_QUEUE.length; i++) {
        var e = NOTIF_QUEUE[i];
        if (e.channelId === channelId && e.lastId === lastId) {
            updateNotifBadge();
            return;
        }
    }

    NOTIF_QUEUE.unshift({ channelId: channelId, lastId: lastId, msg: msg });
    // only render 2 notifs
    renderNotifPanel();
}

function pollOnce() {
    var ids = Object.keys(CHANNELS_BY_ID)
        .filter(id => CHANNELS_BY_ID[id] && CHANNELS_BY_ID[id].canRead);
    var tasks = ids.map(function (cid) {
        return fetch('http://localhost:5005/message/' + cid + '?start=0', {
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + TOKEN }
        })
            .then(function (res) { return res.json().then(function (j) { return { ok: res.ok, json: j, cid: cid }; }); })
            .then(function (resp) {
                if (!resp.ok) return;
                var list = Array.isArray(resp.json) ? resp.json : (resp.json && resp.json.messages) || [];
                if (!list.length) return;
                var last = getLatestMessage(list);
                if (!last) return;

                var lastId = String(last.id || last.messageId || last.timestamp || (last.sentAt && Date.parse(last.sentAt)) || list.length);

                var alerted = NOTIF_LAST_ALERTED[String(resp.cid)];

                // —— if send by myself: not notif
                if (CURRENT_USER_ID && last.sender && Number(last.sender) === Number(CURRENT_USER_ID)) {
                    NOTIF_LAST_SEEN[String(resp.cid)] = lastId;
                    saveNotifState();
                    return;
                }

                // —— if lastId have notifed
                if (alerted && alerted === lastId) {
                    //refresh prev
                    NOTIF_LAST_SEEN[String(resp.cid)] = lastId;
                    saveNotifState();
                    return;
                }

                // send notif: lastId diff with prev , and didnt note yet
                var whoP = (last.sender)
                    ? fetchUserName(Number(last.sender))
                    : Promise.resolve('Someone');

                whoP.then(function (name) {
                    pushOneNotification(
                        { senderName: name, message: last.message || (last.image ? '[image]' : ''), sentAt: last.sentAt },
                        resp.cid,
                        lastId
                    );
                });

                // after notif
                NOTIF_LAST_SEEN[String(resp.cid)] = lastId;     // read lastest
                saveNotifState();

            })
            .catch(function () { });
    });

    return Promise.all(tasks);
}

function startNotifPolling() {
    ensureNotifPanel();
    if (NOTIF_TIMER) clearInterval(NOTIF_TIMER);
    loadNotifState();
    primeNotifications().then(function () {
        saveNotifState();
        NOTIF_TIMER = setInterval(pollOnce, NOTIF_INTERVAL);
    });
}

function stopNotifPolling() {
    if (NOTIF_TIMER) { clearInterval(NOTIF_TIMER); NOTIF_TIMER = null; }
}

// Pause when the page is not visible and resume when it returns (power saving and stress reduction)
document.addEventListener('visibilitychange', function () {
    if (document.hidden) stopNotifPolling(); else startNotifPolling();
});

function getLatestMessage(list) {
    if (!list.length) return null;
    // order by time
    var copy = list.slice();
    copy.sort(function (a, b) {
        var ta = a.sentAt ? Date.parse(a.sentAt) : (a.timestamp || a.id || 0);
        var tb = b.sentAt ? Date.parse(b.sentAt) : (b.timestamp || b.id || 0);
        return ta - tb; // asce
    });
    return copy[copy.length - 1];
}

function updateNotifBadge() {
    var badge = document.getElementById('notif-count');
    if (badge) badge.textContent = String(NOTIF_QUEUE.length);
}

function makeNotifItem(entry) {
    var item = document.createElement('button');
    item.id = 'notif-' + entry.channelId + '-' + entry.lastId;
    item.type = 'button';
    item.className = 'list-group-item list-group-item-action d-flex justify-content-between align-items-start';

    // left
    var left = document.createElement('div');
    left.className = 'me-2 text-start';
    var title = document.createElement('div');
    title.className = 'fw-semibold';
    var ch = CHANNELS_BY_ID[String(entry.channelId)] || {};
    title.textContent = '# ' + (ch.name || entry.channelId);
    var meta = document.createElement('div');
    meta.className = 'text-muted';
    var t = entry.msg && entry.msg.sentAt ? new Date(entry.msg.sentAt).toLocaleString() : '';
    meta.textContent = (entry.msg && entry.msg.senderName ? entry.msg.senderName : 'Someone') + (t ? (' · ' + t) : '');

    var text = document.createElement('div');
    text.textContent = entry.msg && entry.msg.message ? entry.msg.message : '';

    left.appendChild(title);
    left.appendChild(meta);
    left.appendChild(text);

    // right: “new”
    var badge = document.createElement('span');
    badge.className = 'badge rounded-pill text-bg-primary ms-2';
    badge.textContent = 'new';

    item.appendChild(left);
    item.appendChild(badge);

    // click: move -> render next notif -> change channel -> read notif
    item.addEventListener('click', function () {
        // move
        for (var i = 0; i < NOTIF_QUEUE.length; i++) {
            var e = NOTIF_QUEUE[i];
            if (e.channelId === entry.channelId && e.lastId === entry.lastId) {
                NOTIF_QUEUE.splice(i, 1);
                break;
            }
        }
        // read
        var k = String(entry.channelId);
        var id = String(entry.lastId);
        NOTIF_LAST_SEEN[k] = id;
        NOTIF_LAST_ALERTED[k] = id;
        NOTIF_BASELINE_DONE[k] = true;
        saveNotifState();
        renderNotifPanel();
        window.location.hash = `#channel=${entry.channelId}`;
    });

    return item;
}

function renderNotifPanel() {
    ensureNotifPanel();
    var list = document.getElementById('notif-list');
    if (!list) return;
    // rebuild 2 notifs
    while (list.firstChild) list.removeChild(list.firstChild);
    var visible = Math.min(MAX_VISIBLE_NOTIFS, NOTIF_QUEUE.length);
    for (var i = 0; i < visible; i++) {
        list.appendChild(makeNotifItem(NOTIF_QUEUE[i]));
    }
    updateNotifBadge();
}

// ===== 2.7.1 Offline support =====
const OFFLINE_CACHE_KEY = 'offline:last-snapshot';
let OFFLINE = !navigator.onLine;

// hit & ban
function setOfflineUI(flag) {
    OFFLINE = !!flag;
    const chip = document.getElementById('offline-chip');
    if (chip) chip.classList.toggle('d-none', !OFFLINE);

    if (banner) banner.classList.toggle('d-none', !OFFLINE);
    // ban input & send
    setComposerEnabled(!OFFLINE);
}

function readSnapshot() {
    try { return JSON.parse(localStorage.getItem(OFFLINE_CACHE_KEY) || 'null'); }
    catch { return null; }
}
function writeSnapshot(obj) {
    try { localStorage.setItem(OFFLINE_CACHE_KEY, JSON.stringify(obj || {})); }
    catch { /* ignore */ }
}

// ban handle
function requireOnlineOrFail(message = 'You are offline. Please reconnect and try again.') {
    if (OFFLINE) {
        showError(message);
        return false;
    }
    return true;
}

// render channal from snapshot
function renderFromSnapshotIfAny() {
    const snap = readSnapshot();
    if (!snap || !snap.channelId) return false;

    CURRENT_CHANNEL_ID = snap.channelId;

    // channel info
    try {
        renderChannelDetails(
            snap.details || { name: 'Channel', description: '', private: false, createdAt: null, creator: null },
            snap.creatorName || 'Unknown',
            true // read only
        );
    } catch (e) { /* ignore */ }

    // msg list
    try {
        const list = Array.isArray(snap.messages) ? snap.messages : [];
        renderMessageList(list, { scroll: 'bottom' });
    } catch (e) { /* ignore */ }

    // ban input
    setComposerEnabled(false);
    return true;
}

// listen network change
window.addEventListener('online', () => {
    setOfflineUI(false);
    // online again, refresh
    if (TOKEN) {
        loadChannels()?.then(() => {
            if (CURRENT_CHANNEL_ID != null) {
                // reopen: fresh info & msg
                openChannel(CURRENT_CHANNEL_ID);
            }
        });
    }
});

window.addEventListener('offline', () => {
    setOfflineUI(true);
    renderFromSnapshotIfAny();
});

// offline login, have token
document.addEventListener('DOMContentLoaded', () => {
    if (TOKEN && !navigator.onLine) {
        setOfflineUI(true);
        renderFromSnapshotIfAny();
    }
});

// ===== 2.7.2 Fragment based URL routing =====
function parseRoute() {
    const h = window.location.hash || '';
    if (!h.startsWith('#')) return { type: null };

    if (h.startsWith('#channel=')) {
        const id = Number(h.split('=')[1]);
        return { type: 'channel', id: isNaN(id) ? null : id };
    }
    if (h === '#profile') return { type: 'me' };

    if (h.startsWith('#profile=')) {
        const id = Number(h.split('=')[1]);
        return { type: 'user', id: isNaN(id) ? null : id };
    }
    return { type: null };
}

function applyRoute() {
    const r = parseRoute();
    if (!TOKEN) return;
    if (!r.type) return;

    changePage('page-dashboard');

    if (r.type === 'channel' && r.id != null) {
        const ensureReady = (CHANNELS_BY_ID[String(r.id)] ? Promise.resolve() : loadChannels());
        ensureReady.then(() => openChannel(r.id));
    } else if (r.type === 'me') {
        openOwnProfile();
    } else if (r.type === 'user' && r.id != null) {
        openUserProfile(r.id);
    }
}

window.addEventListener('hashchange', applyRoute);
document.addEventListener('DOMContentLoaded', applyRoute);

// ===== Mobile Responsiveness =====
function syncDrawerChannelList() {
    const src = document.getElementById('channel-list');
    const dst = document.getElementById('drawer-channel-list');
    if (!src || !dst) return;

    dst.textContent = '';
    src.querySelectorAll('.channel-container').forEach((a) => {
        const cloned = a.cloneNode(true);
        cloned.classList.remove('list-group-item-action'); 
        cloned.classList.add('list-group-item');          
        cloned.addEventListener('click', (e) => {
            e.preventDefault();
            window.location.hash = `#channel=${cloned.dataset.id}`;
            try {
                const off = bootstrap.Offcanvas.getOrCreateInstance('#channelsDrawer');
                off.hide();
            } catch (_) { }
        });
        dst.appendChild(cloned);
    });
}

function markActiveInDrawer(activeId) {
    const dst = document.getElementById('drawer-channel-list');
    if (!dst) return;
    dst.querySelectorAll('.list-group-item').forEach(el => {
        el.classList.toggle('active', String(el.dataset.id) === String(activeId));
    });
}

(() => {
    const btn = document.getElementById('drawer-create-channel');
    if (!btn) return;
    btn.addEventListener('click', () => {
        try {
            const off = bootstrap.Offcanvas.getOrCreateInstance('#channelsDrawer');
            off.hide();
        } catch (_) { }
    });
})();

(function initMobileUserButtons() {
    function closeDrawerIfAny() {
        try { bootstrap.Offcanvas.getOrCreateInstance('#channelsDrawer').hide(); } catch (_) { }
    }

    function openMyProfile() {
        if (typeof openProfile === 'function') return void openProfile();
        if (typeof openProfileModal === 'function') return void openProfileModal();
        if (typeof showProfile === 'function') return void showProfile();

        window.location.hash = '#profile';
        try { window.dispatchEvent(new HashChangeEvent('hashchange')); } catch (_) { }
    }

    function doLogoutNow() {
        if (typeof logout === 'function') return void logout();
        if (typeof doLogout === 'function') return void doLogout();

        try { localStorage.removeItem('TOKEN'); } catch (_) { }
        try { sessionStorage.clear && sessionStorage.clear(); } catch (_) { }
        location.reload();
    }

    const btnProfile = document.getElementById('btn-mobile-profile');
    const btnLogout = document.getElementById('btn-mobile-logout');
    if (btnProfile) btnProfile.addEventListener('click', (e) => { e.preventDefault(); closeDrawerIfAny(); openMyProfile(); });
    if (btnLogout) btnLogout.addEventListener('click', (e) => { e.preventDefault(); closeDrawerIfAny(); doLogoutNow(); });

    const drProfile = document.getElementById('drawer-profile');
    const drLogout = document.getElementById('drawer-logout');
    if (drProfile) drProfile.addEventListener('click', (e) => { e.preventDefault(); closeDrawerIfAny(); openMyProfile(); });
    if (drLogout) drLogout.addEventListener('click', (e) => { e.preventDefault(); closeDrawerIfAny(); doLogoutNow(); });
})();


const hasEmail = sessionStorage.getItem('email') || localStorage.getItem('email');

if (TOKEN) {
    if (!hasEmail) {
        logout();
    } else {
        changePage('page-dashboard');
        hookCreateChannelForm();
        fetchMe().then(() => loadChannels()).then(() => applyRoute());
    }
} else {
    changePage('page-login');
}