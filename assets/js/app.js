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
  const graphContainer = $('#graph-container');
  const canvas = $('#graph-canvas');
  const ctx = canvas.getContext('2d');
  const tooltip = $('#tooltip');
  const previewOverlay = $('#preview-overlay');
  const previewModal = $('#preview-modal');
  const previewPath = $('#preview-path');
  const previewBody = $('#preview-body');
  const previewClose = $('#preview-close');
  const graphFilter = $('#graph-filter');

  // User view refs
  const userView = $('#user-view');
  const userLoading = $('#user-loading');
  const userError = $('#user-error');
  const userErrorMsg = $('#user-error-msg');
  const userProfile = $('#user-profile');
  const reposList = $('#repos-list');
  const reposFilter = $('#repos-filter');
  const reposSort = $('#repos-sort');
  const loadMoreBtn = $('#load-more-btn');
  const reposLoadMore = $('#repos-load-more');

  // ── State ──
  let currentOwner = '';
  let currentRepo = '';
  let currentBranch = 'main';
  let repoInfo = null;
  let statsCache = {};

  // User state
  let allUserRepos = [];
  let userReposPage = 1;
  let userHasMore = false;
  let currentUserLogin = '';

  // ── Router ──
  function init() {
    const params = new URLSearchParams(window.location.search);
    const repoParam = params.get('repo');
    const userParam = params.get('user');

    if (repoParam) {
      const parts = repoParam.split('/').filter(Boolean);
      if (parts.length >= 2) {
        showChart(parts[0], parts[1]);
        return;
      }
    }
    if (userParam) {
      showUser(userParam.trim());
      return;
    }
    showLanding();
  }

  function hideAllViews() {
    landing.classList.add('hidden');
    chartView.classList.add('hidden');
    userView.classList.add('hidden');
  }

  function showLanding() {
    hideAllViews();
    landing.classList.remove('hidden');
    document.title = 'RepoChart — Visualize Any GitHub Repository';
  }

  function showChart(owner, repo) {
    hideAllViews();
    chartView.classList.remove('hidden');
    loadingEl.classList.remove('hidden');
    errorView.classList.add('hidden');
    repoStats.classList.add('hidden');
    graphFilter.value = '';

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
      const parsed = parseInput(val);
      if (parsed.type === 'repo') {
        const url = new URL(window.location);
        url.searchParams.delete('user');
        url.searchParams.set('repo', `${parsed.owner}/${parsed.repo}`);
        window.history.pushState({}, '', url);
        showChart(parsed.owner, parsed.repo);
      } else if (parsed.type === 'user') {
        const url = new URL(window.location);
        url.searchParams.delete('repo');
        url.searchParams.set('user', parsed.username);
        window.history.pushState({}, '', url);
        showUser(parsed.username);
      } else {
        repoInput.style.borderColor = '#ff4444';
        setTimeout(() => { repoInput.style.borderColor = ''; }, 1000);
      }
    }
  });

  function parseInput(input) {
    input = input.replace(/\.git\/?$/, '').replace(/\/+$/, '');

    // Full repo URL: https://github.com/owner/repo
    let match = input.match(/(?:https?:\/\/)?(?:www\.)?github\.com\/([^/]+)\/([^/]+)/);
    if (match) return { type: 'repo', owner: match[1], repo: match[2] };

    // User profile URL: https://github.com/username
    match = input.match(/(?:https?:\/\/)?(?:www\.)?github\.com\/([^/\s]+)$/);
    if (match) return { type: 'user', username: match[1] };

    // owner/repo
    match = input.match(/^([^/\s]+)\/([^/\s]+)$/);
    if (match) return { type: 'repo', owner: match[1], repo: match[2] };

    // Bare username (single word, no slashes or spaces)
    match = input.match(/^([a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?)$/);
    if (match) return { type: 'user', username: match[1] };

    return { type: null };
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

    // Adjust graph container below stats bar
    requestAnimationFrame(() => {
      const statsHeight = repoStats.offsetHeight;
      graphContainer.style.top = (52 + statsHeight) + 'px';
      resizeCanvas();
      if (graphNodes.length > 0) {
        graphTransform.x = canvas.width / window.devicePixelRatio / 2;
        graphTransform.y = canvas.height / window.devicePixelRatio / 2;
      }
    });
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

  // ── Graph Engine (Force-Directed Visualization) ──
  let graphNodes = [];
  let graphEdges = [];
  let graphAnim = null;
  let graphTransform = { x: 0, y: 0, scale: 1 };
  let dragNode = null;
  let isPanning = false;
  let panStart = { x: 0, y: 0 };
  let hoveredNode = null;
  let graphHierarchy = null;
  let searchMatches = new Set();

  const GRAPH_CONFIG = {
    repulsion: 800,
    attraction: 0.015,
    centerForce: 0.01,
    damping: 0.88,
    minAlpha: 0.001,
    nodeBaseRadius: 4,
    rootRadius: 14,
    folderRadius: 8,
    fileRadius: 4,
    edgeAlpha: 0.15,
    edgeHoverAlpha: 0.6,
    labelZoomThreshold: 0.7,
    maxVelocity: 8,
  };

  function renderTree(treeData) {
    graphHierarchy = buildHierarchy(treeData.tree || []);
    initGraph(graphHierarchy);
  }

  function initGraph(hierarchy) {
    graphNodes = [];
    graphEdges = [];

    // Flatten hierarchy into nodes & edges
    let idCounter = 0;
    function traverse(node, parentId, depth) {
      const id = idCounter++;
      const ext = node.type === 'tree' ? '' : getExtension(node.name);
      const color = node.type === 'tree'
        ? (depth === 0 ? '#ffffff' : '#8b949e')
        : (LANG_COLORS[ext] || '#666666');

      const radius = depth === 0
        ? GRAPH_CONFIG.rootRadius
        : node.type === 'tree'
          ? GRAPH_CONFIG.folderRadius
          : GRAPH_CONFIG.fileRadius;

      // Scale file radius slightly by size
      const fileRadius = node.type !== 'tree' && node.size
        ? Math.max(GRAPH_CONFIG.fileRadius, Math.min(7, GRAPH_CONFIG.fileRadius + Math.log10(node.size + 1) * 0.5))
        : radius;

      const gNode = {
        id,
        name: node.name,
        path: node.path,
        type: node.type,
        depth,
        size: node.size || 0,
        _size: node._size || 0,
        sha: node.sha,
        children: node.children,
        color,
        radius: node.type === 'tree' ? radius : fileRadius,
        x: (Math.random() - 0.5) * 300,
        y: (Math.random() - 0.5) * 300,
        vx: 0,
        vy: 0,
        fx: null,
        fy: null,
      };

      graphNodes.push(gNode);

      if (parentId !== null) {
        graphEdges.push({ source: parentId, target: id });
      }

      if (node.children) {
        for (const child of node.children) {
          traverse(child, id, depth + 1);
        }
      }
    }

    traverse(hierarchy, null, 0);

    // Position root at center
    if (graphNodes.length > 0) {
      graphNodes[0].x = 0;
      graphNodes[0].y = 0;
    }

    // Initial layout: spread children in concentric circles from parent
    spreadInitialPositions();

    resizeCanvas();
    graphTransform = { x: canvas.width / 2, y: canvas.height / 2, scale: 1 };

    startSimulation();
  }

  function spreadInitialPositions() {
    // Build adjacency for BFS
    const childMap = {};
    for (const edge of graphEdges) {
      if (!childMap[edge.source]) childMap[edge.source] = [];
      childMap[edge.source].push(edge.target);
    }

    const visited = new Set();
    const queue = [{ id: 0, x: 0, y: 0, angle: 0, spread: Math.PI * 2 }];
    visited.add(0);

    while (queue.length > 0) {
      const { id, x, y, angle, spread } = queue.shift();
      const node = graphNodes[id];
      node.x = x;
      node.y = y;

      const children = childMap[id] || [];
      if (children.length === 0) continue;

      const dist = 40 + node.depth * 20;
      const step = spread / Math.max(children.length, 1);
      const startAngle = angle - spread / 2 + step / 2;

      children.forEach((cid, i) => {
        if (visited.has(cid)) return;
        visited.add(cid);
        const a = startAngle + i * step;
        const cx = x + Math.cos(a) * dist;
        const cy = y + Math.sin(a) * dist;
        graphNodes[cid].x = cx;
        graphNodes[cid].y = cy;
        queue.push({ id: cid, x: cx, y: cy, angle: a, spread: step });
      });
    }
  }

  function resizeCanvas() {
    const rect = graphContainer.getBoundingClientRect();
    canvas.width = rect.width * window.devicePixelRatio;
    canvas.height = rect.height * window.devicePixelRatio;
    canvas.style.width = rect.width + 'px';
    canvas.style.height = rect.height + 'px';
    ctx.setTransform(window.devicePixelRatio, 0, 0, window.devicePixelRatio, 0, 0);
  }

  let simAlpha = 1;

  function startSimulation() {
    simAlpha = 1;
    if (graphAnim) cancelAnimationFrame(graphAnim);
    tick();
  }

  function tick() {
    if (simAlpha < GRAPH_CONFIG.minAlpha && !dragNode) {
      // Simulation cooled — render one last frame then stop
      renderGraph();
      graphAnim = null;
      return;
    }

    applyForces();
    renderGraph();
    simAlpha *= GRAPH_CONFIG.damping;
    graphAnim = requestAnimationFrame(tick);
  }

  function applyForces() {
    const nodes = graphNodes;
    const N = nodes.length;

    // Repulsion (all pairs, with Barnes-Hut-like cutoff for large graphs)
    for (let i = 0; i < N; i++) {
      for (let j = i + 1; j < N; j++) {
        let dx = nodes[j].x - nodes[i].x;
        let dy = nodes[j].y - nodes[i].y;
        let distSq = dx * dx + dy * dy;
        if (distSq < 1) distSq = 1;
        const dist = Math.sqrt(distSq);
        const force = GRAPH_CONFIG.repulsion / distSq * simAlpha;
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        nodes[i].vx -= fx;
        nodes[i].vy -= fy;
        nodes[j].vx += fx;
        nodes[j].vy += fy;
      }
    }

    // Attraction along edges
    for (const edge of graphEdges) {
      const s = nodes[edge.source];
      const t = nodes[edge.target];
      const dx = t.x - s.x;
      const dy = t.y - s.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 1) continue;
      const targetDist = 30 + s.depth * 5;
      const force = (dist - targetDist) * GRAPH_CONFIG.attraction * simAlpha;
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;
      s.vx += fx;
      s.vy += fy;
      t.vx -= fx;
      t.vy -= fy;
    }

    // Centering force
    for (const node of nodes) {
      node.vx -= node.x * GRAPH_CONFIG.centerForce * simAlpha;
      node.vy -= node.y * GRAPH_CONFIG.centerForce * simAlpha;
    }

    // Apply velocity
    for (const node of nodes) {
      if (node.fx !== null) {
        node.x = node.fx;
        node.y = node.fy;
        node.vx = 0;
        node.vy = 0;
        continue;
      }
      // Clamp velocity
      const speed = Math.sqrt(node.vx * node.vx + node.vy * node.vy);
      if (speed > GRAPH_CONFIG.maxVelocity) {
        node.vx = (node.vx / speed) * GRAPH_CONFIG.maxVelocity;
        node.vy = (node.vy / speed) * GRAPH_CONFIG.maxVelocity;
      }
      node.x += node.vx;
      node.y += node.vy;
      node.vx *= 0.6;
      node.vy *= 0.6;
    }
  }

  function renderGraph() {
    const w = canvas.width / window.devicePixelRatio;
    const h = canvas.height / window.devicePixelRatio;
    ctx.clearRect(0, 0, w, h);

    ctx.save();
    ctx.translate(graphTransform.x, graphTransform.y);
    ctx.scale(graphTransform.scale, graphTransform.scale);

    const scale = graphTransform.scale;

    // Build connected set for hovered node
    const connectedNodes = new Set();
    const connectedEdges = new Set();
    if (hoveredNode) {
      connectedNodes.add(hoveredNode.id);
      graphEdges.forEach((e, i) => {
        if (e.source === hoveredNode.id || e.target === hoveredNode.id) {
          connectedEdges.add(i);
          connectedNodes.add(e.source);
          connectedNodes.add(e.target);
        }
      });
    }

    // Draw edges
    graphEdges.forEach((edge, idx) => {
      const s = graphNodes[edge.source];
      const t = graphNodes[edge.target];

      let alpha = GRAPH_CONFIG.edgeAlpha;
      let lineWidth = 0.5;

      if (hoveredNode) {
        if (connectedEdges.has(idx)) {
          alpha = GRAPH_CONFIG.edgeHoverAlpha;
          lineWidth = 1.2;
        } else {
          alpha = 0.04;
        }
      }

      if (searchMatches.size > 0) {
        if (searchMatches.has(s.id) || searchMatches.has(t.id)) {
          alpha = 0.5;
          lineWidth = 1;
        } else {
          alpha = 0.03;
        }
      }

      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(t.x, t.y);
      ctx.strokeStyle = `rgba(255,255,255,${alpha})`;
      ctx.lineWidth = lineWidth / scale;
      ctx.stroke();
    });

    // Draw nodes
    for (const node of graphNodes) {
      let alpha = 1;
      let glowRadius = 0;
      let drawLabel = false;

      if (hoveredNode) {
        if (connectedNodes.has(node.id)) {
          alpha = 1;
          if (node.id === hoveredNode.id) glowRadius = node.radius + 6;
        } else {
          alpha = 0.12;
        }
      }

      if (searchMatches.size > 0) {
        if (searchMatches.has(node.id)) {
          alpha = 1;
          glowRadius = node.radius + 4;
        } else if (!hoveredNode || !connectedNodes.has(node.id)) {
          alpha = 0.1;
        }
      }

      const r = node.radius / scale;

      // Glow
      if (glowRadius > 0) {
        ctx.beginPath();
        ctx.arc(node.x, node.y, (glowRadius) / scale, 0, Math.PI * 2);
        ctx.fillStyle = node.color + '33';
        ctx.fill();
      }

      // Node circle
      ctx.beginPath();
      ctx.arc(node.x, node.y, r, 0, Math.PI * 2);
      ctx.fillStyle = alpha < 1
        ? hexToRGBA(node.color, alpha)
        : node.color;
      ctx.fill();

      // Border for folders
      if (node.type === 'tree') {
        ctx.strokeStyle = alpha < 1
          ? `rgba(255,255,255,${alpha * 0.3})`
          : 'rgba(255,255,255,0.3)';
        ctx.lineWidth = 0.8 / scale;
        ctx.stroke();
      }

      // Labels
      drawLabel = scale >= GRAPH_CONFIG.labelZoomThreshold ||
                  node.depth === 0 ||
                  (hoveredNode && connectedNodes.has(node.id)) ||
                  searchMatches.has(node.id);

      if (drawLabel) {
        const fontSize = Math.max(9, 11 / scale);
        ctx.font = `${node.type === 'tree' ? '600' : '400'} ${fontSize}px -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif`;
        ctx.fillStyle = alpha < 1
          ? `rgba(255,255,255,${alpha * 0.8})`
          : 'rgba(255,255,255,0.9)';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(node.name, node.x, node.y + r + 3 / scale);
      }
    }

    ctx.restore();
  }

  function hexToRGBA(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  }

  // ── Graph Interaction ──
  function screenToWorld(sx, sy) {
    return {
      x: (sx - graphTransform.x) / graphTransform.scale,
      y: (sy - graphTransform.y) / graphTransform.scale,
    };
  }

  function findNodeAt(wx, wy) {
    // Search from last to first (top layer priority)
    for (let i = graphNodes.length - 1; i >= 0; i--) {
      const n = graphNodes[i];
      const dx = n.x - wx;
      const dy = n.y - wy;
      const hitRadius = (n.radius + 4) / graphTransform.scale;
      if (dx * dx + dy * dy < hitRadius * hitRadius) return n;
    }
    return null;
  }

  canvas.addEventListener('mousedown', (e) => {
    const rect = canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const { x: wx, y: wy } = screenToWorld(sx, sy);
    const node = findNodeAt(wx, wy);

    if (node) {
      dragNode = node;
      node.fx = node.x;
      node.fy = node.y;
      simAlpha = 0.3;
      if (!graphAnim) tick();
    } else {
      isPanning = true;
      panStart = { x: e.clientX - graphTransform.x, y: e.clientY - graphTransform.y };
    }
  });

  canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;

    if (dragNode) {
      const { x: wx, y: wy } = screenToWorld(sx, sy);
      dragNode.fx = wx;
      dragNode.fy = wy;
      dragNode.x = wx;
      dragNode.y = wy;
      simAlpha = Math.max(simAlpha, 0.1);
      if (!graphAnim) tick();
      return;
    }

    if (isPanning) {
      graphTransform.x = e.clientX - panStart.x;
      graphTransform.y = e.clientY - panStart.y;
      renderGraph();
      return;
    }

    // Hover detection
    const { x: wx, y: wy } = screenToWorld(sx, sy);
    const node = findNodeAt(wx, wy);

    if (node !== hoveredNode) {
      hoveredNode = node;
      canvas.style.cursor = node ? 'pointer' : 'grab';
      renderGraph();

      if (node) {
        const isRoot = node.depth === 0;
        showTooltip({
          name: node.name,
          path: node.path,
          type: node.type,
          size: node.size,
          _size: node._size,
          sha: node.sha,
          children: node.children,
        }, e, isRoot);
      } else {
        hideTooltip();
      }
    }

    if (hoveredNode) {
      positionTooltip(e);
    }
  });

  canvas.addEventListener('mouseup', () => {
    if (dragNode) {
      dragNode.fx = null;
      dragNode.fy = null;
      dragNode = null;
      simAlpha = 0.3;
      if (!graphAnim) tick();
    }
    isPanning = false;
  });

  canvas.addEventListener('mouseleave', () => {
    if (dragNode) {
      dragNode.fx = null;
      dragNode.fy = null;
      dragNode = null;
    }
    isPanning = false;
    if (hoveredNode) {
      hoveredNode = null;
      hideTooltip();
      renderGraph();
    }
  });

  canvas.addEventListener('dblclick', (e) => {
    const rect = canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const { x: wx, y: wy } = screenToWorld(sx, sy);
    const node = findNodeAt(wx, wy);

    if (node && node.type !== 'tree') {
      openPreview(node);
    }
  });

  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const newScale = Math.max(0.05, Math.min(10, graphTransform.scale * delta));

    // Zoom toward mouse position
    graphTransform.x = mx - (mx - graphTransform.x) * (newScale / graphTransform.scale);
    graphTransform.y = my - (my - graphTransform.y) * (newScale / graphTransform.scale);
    graphTransform.scale = newScale;

    renderGraph();
  }, { passive: false });

  // Window resize
  window.addEventListener('resize', () => {
    if (!chartView.classList.contains('hidden')) {
      resizeCanvas();
      renderGraph();
    }
  });

  // Graph controls
  $('#zoom-in').addEventListener('click', () => {
    const cw = canvas.width / window.devicePixelRatio / 2;
    const ch = canvas.height / window.devicePixelRatio / 2;
    const newScale = Math.min(10, graphTransform.scale * 1.3);
    graphTransform.x = cw - (cw - graphTransform.x) * (newScale / graphTransform.scale);
    graphTransform.y = ch - (ch - graphTransform.y) * (newScale / graphTransform.scale);
    graphTransform.scale = newScale;
    renderGraph();
  });

  $('#zoom-out').addEventListener('click', () => {
    const cw = canvas.width / window.devicePixelRatio / 2;
    const ch = canvas.height / window.devicePixelRatio / 2;
    const newScale = Math.max(0.05, graphTransform.scale * 0.7);
    graphTransform.x = cw - (cw - graphTransform.x) * (newScale / graphTransform.scale);
    graphTransform.y = ch - (ch - graphTransform.y) * (newScale / graphTransform.scale);
    graphTransform.scale = newScale;
    renderGraph();
  });

  $('#zoom-reset').addEventListener('click', () => {
    graphTransform = {
      x: canvas.width / window.devicePixelRatio / 2,
      y: canvas.height / window.devicePixelRatio / 2,
      scale: 1,
    };
    renderGraph();
  });

  // Graph search/filter
  graphFilter.addEventListener('input', () => {
    const query = graphFilter.value.trim().toLowerCase();
    searchMatches.clear();
    if (query) {
      for (const node of graphNodes) {
        if (node.name.toLowerCase().includes(query) || node.path.toLowerCase().includes(query)) {
          searchMatches.add(node.id);
        }
      }
    }
    renderGraph();
  });

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

  // ── User View ──
  function showUser(username) {
    hideAllViews();
    userView.classList.remove('hidden');
    userLoading.classList.remove('hidden');
    userError.classList.add('hidden');
    userProfile.classList.add('hidden');
    reposList.innerHTML = '';
    allUserRepos = [];
    userReposPage = 1;
    userHasMore = false;
    currentUserLogin = username;

    $('#nav-username').textContent = username;
    $('#nav-user-gh-link').href = `https://github.com/${username}`;
    document.title = `${username} — RepoChart`;

    loadUser(username);
  }

  async function loadUser(username) {
    try {
      const user = await apiFetch(`${API}/users/${username}`);
      userLoading.classList.add('hidden');
      renderUserProfile(user);
      await loadUserRepos(username);
    } catch (err) {
      userLoading.classList.add('hidden');
      userErrorMsg.textContent = err.message || 'User not found.';
      userError.classList.remove('hidden');
    }
  }

  function renderUserProfile(user) {
    $('#user-avatar').src = user.avatar_url;
    $('#user-avatar').alt = user.login;
    $('#user-display-name').textContent = user.name || user.login;
    $('#user-login').textContent = '@' + user.login;

    const bio = $('#user-bio');
    if (user.bio) { bio.textContent = user.bio; bio.style.display = ''; }
    else { bio.style.display = 'none'; }

    const company = $('#user-company');
    if (user.company) {
      company.classList.remove('hidden');
      company.querySelector('span').textContent = user.company;
    } else { company.classList.add('hidden'); }

    const location = $('#user-location');
    if (user.location) {
      location.classList.remove('hidden');
      location.querySelector('span').textContent = user.location;
    } else { location.classList.add('hidden'); }

    const blog = $('#user-blog');
    if (user.blog) {
      blog.classList.remove('hidden');
      const link = blog.querySelector('a');
      link.href = user.blog.startsWith('http') ? user.blog : `https://${user.blog}`;
      link.textContent = user.blog.replace(/^https?:\/\//, '');
    } else { blog.classList.add('hidden'); }

    $('#user-repos-count').textContent = user.public_repos;
    $('#user-followers').textContent = formatNumber(user.followers);
    $('#user-following').textContent = formatNumber(user.following);

    userProfile.classList.remove('hidden');
  }

  async function loadUserRepos(username, page) {
    page = page || 1;
    try {
      const repos = await apiFetch(
        `${API}/users/${username}/repos?per_page=100&page=${page}&sort=updated`
      );
      allUserRepos = allUserRepos.concat(repos);
      userReposPage = page;
      userHasMore = repos.length === 100;

      if (userHasMore) {
        reposLoadMore.classList.remove('hidden');
      } else {
        reposLoadMore.classList.add('hidden');
      }

      renderReposList();
    } catch (_) {
      // silently fail for repo list
    }
  }

  function getFilteredSortedRepos() {
    const filter = reposFilter.value.toLowerCase().trim();
    const sort = reposSort.value;

    let list = allUserRepos;
    if (filter) {
      list = list.filter(r =>
        r.name.toLowerCase().includes(filter) ||
        (r.description || '').toLowerCase().includes(filter)
      );
    }

    list = [...list].sort((a, b) => {
      switch (sort) {
        case 'stars': return (b.stargazers_count || 0) - (a.stargazers_count || 0);
        case 'name': return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
        case 'size': return (b.size || 0) - (a.size || 0);
        case 'updated':
        default: return new Date(b.pushed_at || 0) - new Date(a.pushed_at || 0);
      }
    });

    return list;
  }

  function renderReposList() {
    const repos = getFilteredSortedRepos();
    reposList.innerHTML = '';

    if (repos.length === 0) {
      reposList.innerHTML = '<p style="text-align:center;color:var(--text-muted);padding:40px 0;">No repositories found.</p>';
      return;
    }

    for (const repo of repos) {
      const card = document.createElement('div');
      card.className = 'repo-card';
      card.addEventListener('click', () => {
        const url = new URL(window.location);
        url.searchParams.delete('user');
        url.searchParams.set('repo', `${repo.owner.login}/${repo.name}`);
        window.history.pushState({}, '', url);
        showChart(repo.owner.login, repo.name);
      });

      const langColor = repo.language ? (LANG_COLORS[repo.language.toLowerCase()] || LANG_COLORS[repo.language.toLowerCase().replace(/[^a-z]/g, '')] || '#666') : '';

      let metaHtml = '';
      if (repo.language) {
        metaHtml += `<span><span class="lang-dot" style="background:${langColor}"></span> ${escapeHtml(repo.language)}</span>`;
      }
      if (repo.stargazers_count > 0) {
        metaHtml += `<span><svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor"><path d="M8 .25a.75.75 0 01.673.418l1.882 3.815 4.21.612a.75.75 0 01.416 1.279l-3.046 2.97.719 4.192a.75.75 0 01-1.088.791L8 12.347l-3.766 1.98a.75.75 0 01-1.088-.79l.72-4.194L.818 6.374a.75.75 0 01.416-1.28l4.21-.611L7.327.668A.75.75 0 018 .25z"/></svg> ${formatNumber(repo.stargazers_count)}</span>`;
      }
      if (repo.forks_count > 0) {
        metaHtml += `<span><svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor"><path d="M5 3.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm0 2.122a2.25 2.25 0 10-1.5 0v.878A2.25 2.25 0 005.75 8.5h1.5v2.128a2.251 2.251 0 101.5 0V8.5h1.5a2.25 2.25 0 002.25-2.25v-.878a2.25 2.25 0 10-1.5 0v.878a.75.75 0 01-.75.75h-4.5A.75.75 0 015 6.25v-.878zm3.75 7.378a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm3-8.75a.75.75 0 100-1.5.75.75 0 000 1.5z"/></svg> ${formatNumber(repo.forks_count)}</span>`;
      }
      metaHtml += `<span>${timeAgo(repo.pushed_at)}</span>`;
      metaHtml += `<span>${formatSize(repo.size * 1024)}</span>`;

      const visibility = repo.fork ? 'fork' : (repo.private ? 'private' : 'public');

      card.innerHTML = `
        <div class="repo-card-main">
          <div class="repo-card-name">
            ${escapeHtml(repo.name)}
            <span class="repo-visibility">${visibility}</span>
          </div>
          ${repo.description ? `<div class="repo-card-desc">${escapeHtml(repo.description)}</div>` : ''}
          <div class="repo-card-meta">${metaHtml}</div>
        </div>
      `;

      reposList.appendChild(card);
    }
  }

  // Filter & sort events
  reposFilter.addEventListener('input', renderReposList);
  reposSort.addEventListener('change', renderReposList);

  // Load more
  loadMoreBtn.addEventListener('click', () => {
    loadUserRepos(currentUserLogin, userReposPage + 1);
  });

  // ── Init ──
  init();
})();
