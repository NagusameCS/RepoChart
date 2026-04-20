/* ===== RepoChart — Main Application ===== */

(function () {
  'use strict';

  const API = 'https://api.github.com';

  // ── File‑type icon colors (inspired by GitHub Linguist) ──
  const LANG_COLORS = {
    js: '#f1e05a', mjs: '#f1e05a', cjs: '#f1e05a', jsx: '#f1e05a',
    ts: '#3178c6', tsx: '#3178c6', mts: '#3178c6',
    py: '#3572a5', pyw: '#3572a5', pyi: '#3572a5',
    java: '#b07219', kt: '#A97BFF', kts: '#A97BFF',
    rb: '#701516', erb: '#701516',
    go: '#00add8',
    rs: '#dea584',
    c: '#555555', h: '#555555', cpp: '#f34b7d', cxx: '#f34b7d', cc: '#f34b7d', hpp: '#f34b7d',
    cs: '#178600',
    swift: '#f05138',
    php: '#4f5d95',
    html: '#e34c26', htm: '#e34c26',
    css: '#563d7c', scss: '#c6538c', sass: '#c6538c', less: '#1d365d',
    json: '#999', jsonc: '#999',
    yaml: '#cb171e', yml: '#cb171e',
    xml: '#0060ac',
    md: '#083fa1', mdx: '#083fa1',
    sh: '#89e051', bash: '#89e051', zsh: '#89e051', fish: '#89e051',
    ps1: '#012456',
    sql: '#e38c00',
    r: '#198ce7',
    lua: '#000080',
    pl: '#0298c3',
    ex: '#6e4a7e', exs: '#6e4a7e',
    hs: '#5e5086',
    ml: '#dc566d', mli: '#dc566d',
    scala: '#c22d40',
    dart: '#00b4ab',
    v: '#4f87c4', sv: '#4f87c4',
    vue: '#41b883', svelte: '#ff3e00',
    dockerfile: '#384d54',
    makefile: '#427819',
    toml: '#9c4221',
    ini: '#d1dbe0',
    cfg: '#d1dbe0',
    txt: '#666',
    lock: '#444',
    svg: '#ff9900',
    png: '#a54eee', jpg: '#a54eee', jpeg: '#a54eee', gif: '#a54eee', webp: '#a54eee', ico: '#a54eee', bmp: '#a54eee',
    mp3: '#e83e8c', wav: '#e83e8c', ogg: '#e83e8c', flac: '#e83e8c',
    mp4: '#00bcd4', mov: '#00bcd4', avi: '#00bcd4', webm: '#00bcd4',
    zip: '#e6b800', tar: '#e6b800', gz: '#e6b800', rar: '#e6b800', '7z': '#e6b800',
    wasm: '#654ff0',
    graphql: '#e10098', gql: '#e10098',
    proto: '#5cb85c',
    tf: '#5c4ee5',
  };

  const IMAGE_EXTS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'ico', 'bmp', 'svg']);
  const BINARY_EXTS = new Set([
    'zip', 'tar', 'gz', 'rar', '7z', 'bz2', 'xz',
    'exe', 'dll', 'so', 'dylib', 'bin',
    'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx',
    'mp3', 'wav', 'ogg', 'flac', 'mp4', 'mov', 'avi', 'webm', 'mkv',
    'woff', 'woff2', 'ttf', 'otf', 'eot',
    'class', 'jar', 'pyc', 'o', 'obj',
    'ico', 'bmp',
  ]);

  // ── DOM refs ──
  const $ = (s) => document.querySelector(s);
  const landing = $('#landing');
  const repoInput = $('#repo-input');
  const chartView = $('#chart-view');
  const loadingEl = $('#loading');
  const errorView = $('#error-view');
  const errorMsg = $('#error-msg');
  const repoStats = $('#repo-stats');
  const treeContainer = $('#tree-container');
  const tooltip = $('#tooltip');
  const previewOverlay = $('#preview-overlay');
  const previewModal = $('#preview-modal');
  const previewPath = $('#preview-path');
  const previewBody = $('#preview-body');
  const previewClose = $('#preview-close');

  // ── State ──
  let currentOwner = '';
  let currentRepo = '';
  let currentBranch = 'main';
  let repoInfo = null;
  let statsCache = {};

  // ── Router ──
  function init() {
    const params = new URLSearchParams(window.location.search);
    const repoParam = params.get('repo');

    if (repoParam) {
      const parts = repoParam.split('/').filter(Boolean);
      if (parts.length >= 2) {
        showChart(parts[0], parts[1]);
        return;
      }
    }
    showLanding();
  }

  function showLanding() {
    landing.classList.remove('hidden');
    chartView.classList.add('hidden');
    document.title = 'RepoChart — Visualize Any GitHub Repository';
  }

  function showChart(owner, repo) {
    landing.classList.add('hidden');
    chartView.classList.remove('hidden');
    loadingEl.classList.remove('hidden');
    errorView.classList.add('hidden');
    repoStats.classList.add('hidden');
    treeContainer.innerHTML = '';

    currentOwner = owner;
    currentRepo = repo;

    $('#nav-owner').textContent = owner;
    $('#nav-repo-name').textContent = repo;
    $('#nav-gh-link').href = `https://github.com/${owner}/${repo}`;
    document.title = `${owner}/${repo} — RepoChart`;

    updateOGMeta(owner, repo);
    loadRepo(owner, repo);
  }

  function updateOGMeta(owner, repo) {
    const setMeta = (attr, val, content) => {
      let el = document.querySelector(`meta[${attr}="${val}"]`);
      if (el) el.setAttribute('content', content);
    };
    const title = `${owner}/${repo} — RepoChart`;
    const desc = `Interactive file structure chart for ${owner}/${repo}`;
    const url = `${window.location.origin}${window.location.pathname}?repo=${owner}/${repo}`;
    setMeta('property', 'og:title', title);
    setMeta('property', 'og:description', desc);
    setMeta('property', 'og:url', url);
    setMeta('name', 'twitter:title', title);
    setMeta('name', 'twitter:description', desc);
  }

  // ── Input handling ──
  repoInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const val = repoInput.value.trim();
      if (!val) return;
      const parsed = parseRepoInput(val);
      if (parsed) {
        const url = new URL(window.location);
        url.searchParams.set('repo', `${parsed.owner}/${parsed.repo}`);
        window.history.pushState({}, '', url);
        showChart(parsed.owner, parsed.repo);
      } else {
        repoInput.style.borderColor = '#ff4444';
        setTimeout(() => { repoInput.style.borderColor = ''; }, 1000);
      }
    }
  });

  function parseRepoInput(input) {
    // Accept: https://github.com/owner/repo, github.com/owner/repo, owner/repo
    input = input.replace(/\.git\/?$/, '').replace(/\/+$/, '');
    let match = input.match(/(?:https?:\/\/)?(?:www\.)?github\.com\/([^/]+)\/([^/]+)/);
    if (match) return { owner: match[1], repo: match[2] };
    match = input.match(/^([^/\s]+)\/([^/\s]+)$/);
    if (match) return { owner: match[1], repo: match[2] };
    return null;
  }

  // ── Back navigation ──
  window.addEventListener('popstate', init);

  // ── API ──
  async function apiFetch(url) {
    const resp = await fetch(url, {
      headers: { Accept: 'application/vnd.github+json' },
    });
    if (!resp.ok) {
      const body = await resp.json().catch(() => ({}));
      throw new Error(body.message || `GitHub API ${resp.status}`);
    }
    return resp.json();
  }

  async function loadRepo(owner, repo) {
    try {
      repoInfo = await apiFetch(`${API}/repos/${owner}/${repo}`);
      currentBranch = repoInfo.default_branch;

      const treeData = await apiFetch(`${API}/repos/${owner}/${repo}/git/trees/${currentBranch}?recursive=1`);

      loadingEl.classList.add('hidden');
      renderStats(repoInfo, treeData);
      renderTree(treeData);
    } catch (err) {
      loadingEl.classList.add('hidden');
      errorMsg.textContent = err.message || 'Failed to load repository.';
      errorView.classList.remove('hidden');
    }
  }

  // ── Stats ──
  function renderStats(info, treeData) {
    const fileCount = treeData.tree ? treeData.tree.filter(n => n.type === 'blob').length : 0;

    $('#stat-stars').textContent = formatNumber(info.stargazers_count);
    $('#stat-forks').textContent = formatNumber(info.forks_count);
    $('#stat-size').textContent = formatSize(info.size * 1024);
    $('#stat-files').textContent = formatNumber(fileCount);
    $('#stat-lang').textContent = info.language || '—';
    $('#stat-license').textContent = info.license ? info.license.spdx_id : '—';
    $('#stat-issues').textContent = formatNumber(info.open_issues_count);
    $('#stat-updated').textContent = timeAgo(info.pushed_at);

    const desc = $('#repo-description');
    if (info.description) {
      desc.textContent = info.description;
      desc.style.display = '';
    } else {
      desc.style.display = 'none';
    }

    repoStats.classList.remove('hidden');
  }

  // ── Tree builder ──
  function buildHierarchy(flatTree) {
    const root = { name: currentRepo, path: '', type: 'tree', children: [], _size: 0 };
    const map = { '': root };

    // Sort: folders first, then alphabetical
    const sorted = [...flatTree].sort((a, b) => {
      if (a.type !== b.type) return a.type === 'tree' ? -1 : 1;
      return a.path.localeCompare(b.path);
    });

    for (const item of sorted) {
      const parts = item.path.split('/');
      const name = parts[parts.length - 1];
      const parentPath = parts.slice(0, -1).join('/');

      const node = {
        name,
        path: item.path,
        type: item.type,
        size: item.size || 0,
        sha: item.sha,
        children: item.type === 'tree' ? [] : undefined,
      };

      if (!map[parentPath]) {
        // Create missing intermediate directories
        let current = '';
        for (const p of parentPath.split('/')) {
          const next = current ? `${current}/${p}` : p;
          if (!map[next]) {
            const dir = { name: p, path: next, type: 'tree', children: [], _size: 0 };
            map[current].children.push(dir);
            map[next] = dir;
          }
          current = next;
        }
      }

      map[parentPath].children.push(node);
      if (item.type === 'tree') map[item.path] = node;
    }

    // Calculate folder sizes
    function calcSize(node) {
      if (!node.children) return node.size || 0;
      let total = 0;
      for (const child of node.children) {
        total += calcSize(child);
      }
      node._size = total;
      return total;
    }
    calcSize(root);

    // Sort children: folders first, then files, alphabetically within each group
    function sortChildren(node) {
      if (!node.children) return;
      node.children.sort((a, b) => {
        const aDir = a.type === 'tree' ? 0 : 1;
        const bDir = b.type === 'tree' ? 0 : 1;
        if (aDir !== bDir) return aDir - bDir;
        return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
      });
      node.children.forEach(sortChildren);
    }
    sortChildren(root);

    return root;
  }

  // ── Tree rendering ──
  function renderTree(treeData) {
    const hierarchy = buildHierarchy(treeData.tree || []);
    const ul = document.createElement('ul');
    ul.className = 'tree-root';

    // Render root node
    const rootLi = createNodeElement(hierarchy, true);
    ul.appendChild(rootLi);

    treeContainer.appendChild(ul);
  }

  function createNodeElement(node, isRoot) {
    const li = document.createElement('li');
    li.className = 'tree-node';

    const row = document.createElement('div');
    row.className = 'node-row' + (node.type === 'tree' ? ' is-folder' : '');

    const isFolder = node.type === 'tree';

    // Arrow
    const arrow = document.createElement('span');
    arrow.className = 'node-arrow' + (isFolder ? ' expanded' : ' placeholder');
    arrow.textContent = isFolder ? '▶' : '';
    row.appendChild(arrow);

    // Icon
    const icon = document.createElement('span');
    icon.className = 'node-icon';
    if (isFolder) {
      icon.innerHTML = folderIcon(isRoot);
    } else {
      icon.innerHTML = fileIcon(node.name);
    }
    row.appendChild(icon);

    // Name
    const nameSpan = document.createElement('span');
    nameSpan.className = 'node-name';
    nameSpan.textContent = node.name;
    row.appendChild(nameSpan);

    // Meta (file size)
    if (!isFolder && node.size) {
      const meta = document.createElement('span');
      meta.className = 'node-meta';
      meta.textContent = formatSize(node.size);
      row.appendChild(meta);
    }
    if (isFolder && !isRoot && node.children) {
      const meta = document.createElement('span');
      meta.className = 'node-meta';
      meta.textContent = `${node.children.length} items`;
      row.appendChild(meta);
    }

    li.appendChild(row);

    // Children
    if (isFolder && node.children && node.children.length > 0) {
      const childUl = document.createElement('ul');
      childUl.className = 'tree-list';
      for (const child of node.children) {
        childUl.appendChild(createNodeElement(child, false));
      }
      li.appendChild(childUl);

      // Toggle
      row.addEventListener('click', (e) => {
        e.stopPropagation();
        childUl.classList.toggle('collapsed');
        arrow.classList.toggle('expanded');
      });
    }

    // Hover → tooltip
    row.addEventListener('mouseenter', (e) => showTooltip(node, e, isRoot));
    row.addEventListener('mousemove', positionTooltip);
    row.addEventListener('mouseleave', hideTooltip);

    // Click → preview (files only)
    if (!isFolder) {
      row.addEventListener('click', (e) => {
        e.stopPropagation();
        openPreview(node);
      });
    }

    return li;
  }

  // ── Icons ──
  function folderIcon(isRoot) {
    const color = isRoot ? '#fff' : '#8b949e';
    return `<svg viewBox="0 0 16 16" fill="${color}"><path d="M1.75 1A1.75 1.75 0 000 2.75v10.5C0 14.216.784 15 1.75 15h12.5A1.75 1.75 0 0016 13.25v-8.5A1.75 1.75 0 0014.25 3H7.5a.25.25 0 01-.2-.1l-.9-1.2C6.07 1.26 5.55 1 5 1H1.75z"/></svg>`;
  }

  function fileIcon(name) {
    const ext = getExtension(name);
    const color = LANG_COLORS[ext] || '#666';
    return `<svg viewBox="0 0 16 16" fill="${color}"><path d="M3.75 1.5a.25.25 0 00-.25.25v12.5c0 .138.112.25.25.25h8.5a.25.25 0 00.25-.25V4.664a.25.25 0 00-.073-.177l-2.914-2.914a.25.25 0 00-.177-.073H3.75zM2 1.75C2 .784 2.784 0 3.75 0h5.586c.464 0 .909.184 1.237.513l2.914 2.914c.329.328.513.773.513 1.237v9.586A1.75 1.75 0 0112.25 16h-8.5A1.75 1.75 0 012 14.25V1.75z"/></svg>`;
  }

  function getExtension(filename) {
    const lower = filename.toLowerCase();
    // Special filenames
    if (lower === 'dockerfile' || lower.startsWith('dockerfile.')) return 'dockerfile';
    if (lower === 'makefile' || lower === 'gnumakefile') return 'makefile';
    const dot = lower.lastIndexOf('.');
    if (dot === -1) return '';
    return lower.slice(dot + 1);
  }

  // ── Tooltip ──
  let tooltipTimer = null;

  function showTooltip(node, event, isRoot) {
    clearTimeout(tooltipTimer);
    const ttName = tooltip.querySelector('.tooltip-name');
    const ttStats = tooltip.querySelector('.tooltip-stats');

    if (isRoot && repoInfo) {
      ttName.textContent = `${currentOwner}/${currentRepo}`;
      ttStats.innerHTML = `
        <span><span class="label">Stars</span> ${formatNumber(repoInfo.stargazers_count)}</span>
        <span><span class="label">Forks</span> ${formatNumber(repoInfo.forks_count)}</span>
        <span><span class="label">Size</span> ${formatSize(repoInfo.size * 1024)}</span>
        <span><span class="label">Language</span> ${repoInfo.language || '—'}</span>
        <span><span class="label">License</span> ${repoInfo.license ? repoInfo.license.spdx_id : '—'}</span>
        <span><span class="label">Updated</span> ${timeAgo(repoInfo.pushed_at)}</span>
      `;
    } else if (node.type === 'tree') {
      ttName.textContent = node.path || node.name;
      const count = node.children ? node.children.length : 0;
      ttStats.innerHTML = `
        <span><span class="label">Items</span> ${count}</span>
        <span><span class="label">Size</span> ${formatSize(node._size || 0)}</span>
      `;
    } else {
      ttName.textContent = node.path || node.name;
      const ext = getExtension(node.name);
      ttStats.innerHTML = `
        <span><span class="label">Size</span> ${formatSize(node.size || 0)}</span>
        <span><span class="label">Type</span> ${ext ? `.${ext}` : 'file'}</span>
        <span class="tooltip-loading">Hover to load more…</span>
      `;
      // Lazy-fetch extended stats
      fetchFileStats(node);
    }

    positionTooltip(event);
    tooltip.classList.remove('hidden');
  }

  function positionTooltip(e) {
    const pad = 12;
    let x = e.clientX + pad;
    let y = e.clientY + pad;
    const tw = tooltip.offsetWidth;
    const th = tooltip.offsetHeight;
    if (x + tw > window.innerWidth - pad) x = e.clientX - tw - pad;
    if (y + th > window.innerHeight - pad) y = e.clientY - th - pad;
    tooltip.style.left = x + 'px';
    tooltip.style.top = y + 'px';
  }

  function hideTooltip() {
    clearTimeout(tooltipTimer);
    tooltip.classList.add('hidden');
  }

  async function fetchFileStats(node) {
    const cacheKey = node.path;
    if (statsCache[cacheKey]) {
      updateTooltipStats(node, statsCache[cacheKey]);
      return;
    }

    try {
      // Fetch the last commit for this file
      const commits = await apiFetch(
        `${API}/repos/${currentOwner}/${currentRepo}/commits?path=${encodeURIComponent(node.path)}&per_page=1`
      );
      const stats = {
        lastUpdated: commits[0] ? commits[0].commit.committer.date : null,
        lastMessage: commits[0] ? commits[0].commit.message.split('\n')[0] : null,
        lastAuthor: commits[0] ? (commits[0].commit.author.name || '') : null,
      };

      // If it's a small file, fetch content for line count
      if (node.size && node.size < 500000 && !isBinaryExt(node.name)) {
        try {
          const content = await apiFetch(
            `${API}/repos/${currentOwner}/${currentRepo}/contents/${encodeURIComponent(node.path)}?ref=${currentBranch}`
          );
          if (content.encoding === 'base64' && content.content) {
            const decoded = atob(content.content.replace(/\n/g, ''));
            stats.lines = decoded.split('\n').length;
          }
        } catch (_) { /* ignore */ }
      }

      statsCache[cacheKey] = stats;
      updateTooltipStats(node, stats);
    } catch (_) {
      // silently fail for stats - not critical
    }
  }

  function updateTooltipStats(node, stats) {
    if (tooltip.classList.contains('hidden')) return;
    const ttStats = tooltip.querySelector('.tooltip-stats');
    const ext = getExtension(node.name);
    let html = `
      <span><span class="label">Size</span> ${formatSize(node.size || 0)}</span>
      <span><span class="label">Type</span> ${ext ? `.${ext}` : 'file'}</span>
    `;
    if (stats.lines != null) {
      html += `<span><span class="label">Lines</span> ${formatNumber(stats.lines)}</span>`;
    }
    if (stats.lastUpdated) {
      html += `<span><span class="label">Updated</span> ${timeAgo(stats.lastUpdated)}</span>`;
    }
    if (stats.lastMessage) {
      const msg = stats.lastMessage.length > 50
        ? stats.lastMessage.slice(0, 50) + '…'
        : stats.lastMessage;
      html += `<span><span class="label">Commit</span> ${escapeHtml(msg)}</span>`;
    }
    if (stats.lastAuthor) {
      html += `<span><span class="label">Author</span> ${escapeHtml(stats.lastAuthor)}</span>`;
    }
    ttStats.innerHTML = html;
  }

  // ── File Preview ──
  function openPreview(node) {
    previewPath.textContent = node.path;
    previewBody.innerHTML = '<div class="spinner"></div>';
    previewOverlay.classList.remove('hidden');
    document.body.style.overflow = 'hidden';

    const ext = getExtension(node.name);

    if (isBinaryExt(node.name) && !IMAGE_EXTS.has(ext)) {
      previewBody.innerHTML = `<div class="preview-binary">Binary file — cannot preview<br><a href="https://github.com/${currentOwner}/${currentRepo}/blob/${currentBranch}/${node.path}" target="_blank" style="color:#999;text-decoration:underline;">View on GitHub</a></div>`;
      return;
    }

    fetchFileContent(node);
  }

  async function fetchFileContent(node) {
    try {
      const data = await apiFetch(
        `${API}/repos/${currentOwner}/${currentRepo}/contents/${encodeURIComponent(node.path)}?ref=${currentBranch}`
      );

      const ext = getExtension(node.name);

      if (IMAGE_EXTS.has(ext) && ext !== 'svg') {
        previewBody.innerHTML = `<img class="preview-image" src="data:image/${ext};base64,${data.content.replace(/\n/g, '')}" alt="${escapeHtml(node.name)}">`;
        return;
      }

      if (data.encoding === 'base64' && data.content) {
        const decoded = atob(data.content.replace(/\n/g, ''));

        if (ext === 'svg') {
          // Render SVG safely as an image using a data URI
          const blob = new Blob([decoded], { type: 'image/svg+xml' });
          const url = URL.createObjectURL(blob);
          previewBody.innerHTML = `<img class="preview-image" src="${url}" alt="${escapeHtml(node.name)}">`;
          return;
        }

        const pre = document.createElement('pre');
        const code = document.createElement('code');
        const langClass = hlMappings[ext] || ext || 'plaintext';
        code.className = `language-${langClass}`;
        code.textContent = decoded;
        pre.appendChild(code);
        previewBody.innerHTML = '';
        previewBody.appendChild(pre);

        if (window.hljs) {
          hljs.highlightElement(code);
        }
      } else {
        previewBody.innerHTML = '<div class="preview-binary">Unable to decode file content.</div>';
      }
    } catch (err) {
      previewBody.innerHTML = `<div class="preview-binary">Failed to load file: ${escapeHtml(err.message)}<br><a href="https://github.com/${currentOwner}/${currentRepo}/blob/${currentBranch}/${node.path}" target="_blank" style="color:#999;text-decoration:underline;">View on GitHub</a></div>`;
    }
  }

  const hlMappings = {
    js: 'javascript', mjs: 'javascript', cjs: 'javascript', jsx: 'javascript',
    ts: 'typescript', tsx: 'typescript', mts: 'typescript',
    py: 'python', pyw: 'python', pyi: 'python',
    rb: 'ruby', erb: 'erb',
    rs: 'rust',
    go: 'go',
    java: 'java', kt: 'kotlin', kts: 'kotlin',
    cs: 'csharp',
    cpp: 'cpp', cxx: 'cpp', cc: 'cpp', c: 'c', h: 'c', hpp: 'cpp',
    swift: 'swift',
    php: 'php',
    html: 'html', htm: 'html',
    css: 'css', scss: 'scss', sass: 'scss', less: 'less',
    json: 'json', jsonc: 'json',
    yaml: 'yaml', yml: 'yaml',
    xml: 'xml',
    md: 'markdown', mdx: 'markdown',
    sh: 'bash', bash: 'bash', zsh: 'bash', fish: 'bash',
    ps1: 'powershell',
    sql: 'sql',
    r: 'r',
    lua: 'lua',
    pl: 'perl',
    ex: 'elixir', exs: 'elixir',
    hs: 'haskell',
    scala: 'scala',
    dart: 'dart',
    dockerfile: 'dockerfile',
    makefile: 'makefile',
    toml: 'ini',
    ini: 'ini',
    graphql: 'graphql', gql: 'graphql',
    proto: 'protobuf',
    vue: 'xml', svelte: 'xml',
    tf: 'plaintext',
    txt: 'plaintext',
  };

  function closePreview() {
    previewOverlay.classList.add('hidden');
    document.body.style.overflow = '';
    previewBody.innerHTML = '';
  }

  previewClose.addEventListener('click', closePreview);
  previewOverlay.addEventListener('click', (e) => {
    if (e.target === previewOverlay) closePreview();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !previewOverlay.classList.contains('hidden')) {
      closePreview();
    }
  });

  // ── Utilities ──
  function isBinaryExt(filename) {
    const ext = getExtension(filename);
    return BINARY_EXTS.has(ext);
  }

  function formatSize(bytes) {
    if (bytes === 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    const val = bytes / Math.pow(1024, i);
    return val.toFixed(i === 0 ? 0 : 1) + ' ' + units[i];
  }

  function formatNumber(n) {
    if (n == null) return '—';
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
    return n.toString();
  }

  function timeAgo(dateStr) {
    if (!dateStr) return '—';
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}d ago`;
    const months = Math.floor(days / 30);
    if (months < 12) return `${months}mo ago`;
    const years = Math.floor(months / 12);
    return `${years}y ago`;
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

  // ── Init ──
  init();
})();
