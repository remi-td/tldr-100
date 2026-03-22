const SVG_NS = "http://www.w3.org/2000/svg";

const state = {
  month: "all",
  theme: "all",
  selectedArticleId: null,
  transform: { x: 0, y: 0, scale: 1 },
};

const refs = {};
let dataset = null;
let dragging = false;
let dragOrigin = null;

const $ = (selector) => document.querySelector(selector);

document.addEventListener("DOMContentLoaded", async () => {
  cacheRefs();
  bindEvents();
  dataset = await fetch("./data/site-data.json").then((response) => response.json());
  initialize();
});

function cacheRefs() {
  refs.heroTitle = $("#hero-title");
  refs.heroSubtitle = $("#hero-subtitle");
  refs.heroStory = $("#hero-story");
  refs.heroStats = $("#hero-stats");
  refs.monthChips = $("#month-chips");
  refs.themeCards = $("#theme-cards");
  refs.graph = $("#graph");
  refs.graphPanzoom = $("#graph-panzoom");
  refs.graphLinks = $("#graph-links");
  refs.graphNodes = $("#graph-nodes");
  refs.graphLabels = $("#graph-labels");
  refs.graphMeta = $("#graph-meta");
  refs.selectionTitle = $("#selection-title");
  refs.selectionSummary = $("#selection-summary");
  refs.spotlightTitle = $("#spotlight-title");
  refs.spotlightSummary = $("#spotlight-summary");
  refs.spotlightMeta = $("#spotlight-meta");
  refs.spotlightLink = $("#spotlight-link");
  refs.insightsTitle = $("#insights-title");
  refs.topVendors = $("#top-vendors");
}

function bindEvents() {
  $("#zoom-in").addEventListener("click", () => adjustZoom(0.12));
  $("#zoom-out").addEventListener("click", () => adjustZoom(-0.12));
  $("#zoom-reset").addEventListener("click", resetZoom);

  refs.graph.addEventListener("wheel", (event) => {
    event.preventDefault();
    adjustZoom(event.deltaY > 0 ? -0.08 : 0.08);
  });

  refs.graph.addEventListener("pointerdown", (event) => {
    dragging = true;
    refs.graph.classList.add("is-dragging");
    dragOrigin = {
      x: event.clientX - state.transform.x,
      y: event.clientY - state.transform.y,
    };
  });

  window.addEventListener("pointermove", (event) => {
    if (!dragging || !dragOrigin) {
      return;
    }
    state.transform.x = event.clientX - dragOrigin.x;
    state.transform.y = event.clientY - dragOrigin.y;
    applyTransform();
  });

  window.addEventListener("pointerup", () => {
    dragging = false;
    refs.graph.classList.remove("is-dragging");
  });
}

function initialize() {
  renderHero();
  renderFilterChips();
  renderThemeCards();
  renderInsights();
  render();
}

function renderHero() {
  const { meta, stats, months, themes } = dataset;

  refs.heroTitle.innerHTML = 'TLDR Data #100<br /><span class="hero-title-sub">A year in review</span>';
  refs.heroSubtitle.innerHTML = 'From infrastructure to semantics, the shifts that shaped the data space this year.<br /><br />Thanks for reading, and to everyone building and sharing.<br /><br />New here? <a href="https://tldr.tech/data" target="_blank" rel="noreferrer">Subscribe to TLDR Data.</a>';
  refs.heroStory.innerHTML = "";
  refs.heroStory.hidden = true;

  refs.heroStats.innerHTML = "";
  [
    {
      label: "Subscribers",
      value: formatExactNumber(stats.subscriber_count),
      footnote: "TLDR Data readership reached 400k.",
    },
    {
      label: "Featured articles",
      value: formatExactNumber(stats.article_count),
      footnote: "Across AI, data, infra, and analytics.",
    },
    {
      label: "Issues",
      value: formatExactNumber(stats.issue_count),
      footnote: "Weekly newsletter issues",
    },
  ].forEach((item) => {
    const card = document.createElement("div");
    card.className = "stat-card";
    card.innerHTML = `
      <div class="stat-label">${item.label}</div>
      <div class="stat-value">${item.value}</div>
      <div class="stat-footnote">${item.footnote}</div>
    `;
    refs.heroStats.appendChild(card);
  });
}

function renderFilterChips() {
  renderChipGroup(refs.monthChips, [{ id: "all", label: "All months" }, ...dataset.months], state.month, (id) => {
    state.month = id;
    render();
  });
}

function renderChipGroup(container, items, activeId, onClick) {
  if (!container) {
    return;
  }
  container.innerHTML = "";
  items.forEach((item) => {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = `chip${item.id === activeId ? " is-active" : ""}`;
    chip.textContent = item.name || item.label;
    chip.addEventListener("click", () => onClick(item.id));
    container.appendChild(chip);
  });
}

function renderThemeCards() {
  const orderedThemes = [...dataset.themes].sort((left, right) => {
    const leftPeak = [...left.month_counts].sort((a, b) => b.count - a.count)[0]?.month || "";
    const rightPeak = [...right.month_counts].sort((a, b) => b.count - a.count)[0]?.month || "";
    return leftPeak.localeCompare(rightPeak) || right.article_count - left.article_count;
  });
  const maxCount = Math.max(...dataset.themes.map((theme) => theme.article_count));
  refs.themeCards.innerHTML = "";

  orderedThemes.forEach((theme) => {
    const card = document.createElement("article");
    card.className = "theme-card";
    const peak = [...theme.month_counts].sort((left, right) => right.count - left.count)[0];
    card.innerHTML = `
      <div class="theme-card-header">
        <div>
          <p class="eyebrow">Key theme</p>
          <h3>${theme.name}</h3>
        </div>
        <span class="theme-badge" style="background:${theme.color};">${theme.article_count}</span>
      </div>
      <p>${theme.description}</p>
      <div class="theme-meta">
        ${theme.top_technologies.map((item) => `<span class="meta-pill">${item.name}</span>`).join("")}
      </div>
      <div class="theme-stats">
        <div class="theme-stat">
          <div class="stat-label">Peak month</div>
          <strong>${labelForMonth(peak.month)}</strong>
        </div>
        <div class="theme-stat">
          <div class="stat-label">Peak volume</div>
          <strong>${peak.count} stories</strong>
        </div>
      </div>
    `;
    card.addEventListener("click", () => {
      state.theme = state.theme === theme.id ? "all" : theme.id;
      renderFilterChips();
      render();
    });
    refs.themeCards.appendChild(card);
  });
}

function renderInsights() {
  refs.insightsTitle.textContent = "Thanks to our awesome thought leaders and content creators";
  renderRankList(refs.topVendors, dataset.top_vendors, 50);
}

function renderRankList(container, items, limit = 8) {
  container.innerHTML = items
    .slice(0, limit)
    .map(
      (item, index) => `
        <article class="rank-item">
          <strong>${index + 1}. ${item.name}</strong>
          <span class="rank-value">${item.count}</span>
        </article>
      `,
    )
    .join("");
}

function render() {
  renderFilterChips();
  const filtered = getFilteredArticles();
  const visible = filtered.slice(0, 140);

  if (!visible.some((article) => article.id === state.selectedArticleId)) {
    state.selectedArticleId = visible[0]?.id ?? null;
  }

  renderSelection(filtered, visible);
  renderSpotlight(visible.find((article) => article.id === state.selectedArticleId) || visible[0] || null);
  renderGraph(visible);
}

function getFilteredArticles() {
  return dataset.articles
    .filter((article) => (state.month === "all" ? true : article.month === state.month))
    .filter((article) => (state.theme === "all" ? true : article.theme_id === state.theme))
    .sort((left, right) => right.score - left.score || right.featured_date.localeCompare(left.featured_date));
}

function renderSelection(filtered, visible) {
  const monthLabel = state.month === "all" ? `All ${dataset.stats.issue_count} issues` : labelForMonth(state.month);
  const themeLabel = state.theme === "all" ? "every major theme" : getTheme(state.theme).name;
  refs.selectionTitle.textContent = `${monthLabel}, centered on ${themeLabel}`;
  refs.selectionSummary.textContent = buildSliceSummary(filtered);
  refs.graphMeta.textContent = `${filtered.length} matched • ${visible.length} visible`;
}

function renderSpotlight(article) {
  if (!article) {
    refs.spotlightTitle.textContent = "No article matches the current filters.";
    refs.spotlightSummary.textContent = "Widen the slice or clear the search term to bring the network back into view.";
    refs.spotlightMeta.innerHTML = "";
    refs.spotlightLink.classList.add("is-disabled");
    refs.spotlightLink.href = "#";
    return;
  }

  refs.spotlightTitle.textContent = article.title;
  refs.spotlightSummary.textContent = article.summary;
  refs.spotlightMeta.innerHTML = [
    article.theme_name,
    article.featured_label,
  ]
    .filter(Boolean)
    .map((item) => `<span class="meta-pill">${item}</span>`)
    .join("");
  refs.spotlightLink.href = article.link;
  refs.spotlightLink.classList.remove("is-disabled");
}


function renderGraph(visibleArticles) {
  clearNode(refs.graphLinks);
  clearNode(refs.graphNodes);
  clearNode(refs.graphLabels);

  const layout = buildGraphLayout(visibleArticles);

  dataset.graph.theme_links.forEach((link) => {
    const source = layout.nodes.get(link.source);
    const target = layout.nodes.get(link.target);
    if (!source || !target) {
      return;
    }
    refs.graphLinks.appendChild(
      makePath(curvedPath(source.x, source.y, target.x, target.y, 0.08), {
        class: "graph-link theme-link",
        strokeWidth: 1 + link.weight * 0.14,
      }),
    );
  });

  dataset.graph.links.forEach((link) => {
    const source = layout.nodes.get(link.source);
    const target = layout.nodes.get(link.target);
    if (!source || !target) {
      return;
    }
    refs.graphLinks.appendChild(
      makePath(curvedPath(source.x, source.y, target.x, target.y, 0.18), {
        class: "graph-link tech-link",
        strokeWidth: 0.8 + link.weight * 0.08,
      }),
    );
  });

  visibleArticles.forEach((article) => {
    const source = layout.nodes.get(article.id);
    const target = layout.nodes.get(article.theme_id);
    refs.graphLinks.appendChild(
      makePath(curvedPath(source.x, source.y, target.x, target.y, 0.12), {
        class: "graph-link article-link",
        strokeWidth: 0.9,
      }),
    );
  });

  layout.drawOrder.forEach((node) => {
    if (node.type === "theme") {
      drawThemeNode(node);
      drawLabel(node, node.label, 0, node.radius + 26, "middle");
      return;
    }
    if (node.type === "tech") {
      drawTechNode(node);
      drawLabel(node, node.label, 0, node.radius + 18, "middle", 12);
      return;
    }
    drawArticleNode(node);
  });

  applyTransform();
}

function buildGraphLayout(visibleArticles) {
  const nodes = new Map();
  const drawOrder = [];
  const center = { x: 590, y: 380 };
  const themeRingX = 250;
  const themeRingY = 190;

  dataset.themes.forEach((theme, index) => {
    const angle = (Math.PI * 2 * index) / dataset.themes.length - Math.PI / 2;
    const node = {
      id: theme.id,
      type: "theme",
      label: theme.short_label,
      fullLabel: theme.name,
      x: center.x + Math.cos(angle) * themeRingX,
      y: center.y + Math.sin(angle) * themeRingY,
      radius: 22 + Math.min(24, theme.article_count / 16),
      color: theme.color,
      theme,
    };
    nodes.set(node.id, node);
    drawOrder.push(node);
  });

  dataset.graph.tech_nodes.forEach((tech, index) => {
    const angle = (Math.PI * 2 * index) / dataset.graph.tech_nodes.length - Math.PI / 2 + 0.18;
    const node = {
      id: tech.id,
      type: "tech",
      label: tech.name,
      x: center.x + Math.cos(angle) * 340,
      y: center.y + Math.sin(angle) * 260,
      radius: 10 + Math.min(12, tech.count / 22),
    };
    nodes.set(node.id, node);
    drawOrder.push(node);
  });

  const grouped = groupBy(visibleArticles, (article) => article.theme_id);
  Object.entries(grouped).forEach(([themeId, items]) => {
    const anchor = nodes.get(themeId);
    items.forEach((article, index) => {
      const angle = pseudoRandom(article.id) * Math.PI * 2 + (index % 12) * 0.32;
      const radius = 56 + Math.floor(index / 12) * 16;
      const node = {
        id: article.id,
        type: "article",
        article,
        x: anchor.x + Math.cos(angle) * radius,
        y: anchor.y + Math.sin(angle) * radius,
        radius: 4 + Math.min(6, article.score / 2.1),
        color: anchor.color,
      };
      nodes.set(node.id, node);
      drawOrder.push(node);
    });
  });

  return { nodes, drawOrder };
}

function drawThemeNode(node) {
  const group = makeSvg("g", { class: "graph-node" });
  group.appendChild(
    makeSvg("circle", {
      cx: node.x,
      cy: node.y,
      r: node.radius + 10,
      fill: node.theme.soft_color,
      opacity: 0.9,
      filter: "url(#soft-glow)",
    }),
  );
  group.appendChild(
    makeSvg("circle", {
      cx: node.x,
      cy: node.y,
      r: node.radius,
      fill: node.color,
      opacity: 0.95,
    }),
  );
  group.addEventListener("click", () => {
    state.theme = state.theme === node.id ? "all" : node.id;
    render();
  });
  refs.graphNodes.appendChild(group);
}

function drawTechNode(node) {
  refs.graphNodes.appendChild(
    makeSvg("circle", {
      class: "graph-node",
      cx: node.x,
      cy: node.y,
      r: node.radius,
      fill: "rgba(255,255,255,0.14)",
      stroke: "rgba(255,255,255,0.24)",
      strokeWidth: 1,
    }),
  );
}

function drawArticleNode(node) {
  const circle = makeSvg("circle", {
    class: "graph-node",
    cx: node.x,
    cy: node.y,
    r: node.radius,
    fill: node.color,
    opacity: state.selectedArticleId === node.id ? 1 : 0.88,
    stroke: state.selectedArticleId === node.id ? "white" : "none",
    strokeWidth: state.selectedArticleId === node.id ? 1.5 : 0,
  });
  circle.addEventListener("click", () => {
    state.selectedArticleId = node.id;
    render();
  });
  circle.appendChild(makeSvg("title", {}, `${node.article.title}\n${node.article.theme_name}`));
  refs.graphNodes.appendChild(circle);
}

function drawLabel(node, text, dx, dy, anchor = "start", fontSize = 14) {
  refs.graphLabels.appendChild(
    makeSvg(
      "text",
      {
        x: node.x + dx,
        y: node.y + dy,
        fill: "rgba(237, 247, 251, 0.9)",
        fontFamily: "IBM Plex Sans, sans-serif",
        fontSize,
        textAnchor: anchor,
      },
      text,
    ),
  );
}

function applyTransform() {
  refs.graphPanzoom.setAttribute(
    "transform",
    `translate(${state.transform.x} ${state.transform.y}) scale(${state.transform.scale})`,
  );
}

function adjustZoom(delta) {
  state.transform.scale = Math.max(0.72, Math.min(2.1, state.transform.scale + delta));
  applyTransform();
}

function resetZoom() {
  state.transform = { x: 0, y: 0, scale: 1 };
  applyTransform();
}

function clearNode(node) {
  while (node.firstChild) {
    node.removeChild(node.firstChild);
  }
}

function makeSvg(tag, attrs = {}, text = "") {
  const node = document.createElementNS(SVG_NS, tag);
  Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, value));
  if (text) {
    node.textContent = text;
  }
  return node;
}

function makePath(d, attrs = {}) {
  return makeSvg("path", { d, ...attrs });
}

function curvedPath(x1, y1, x2, y2, curveFactor) {
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const cx = mx - dy * curveFactor;
  const cy = my + dx * curveFactor;
  return `M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`;
}

function formatExactNumber(value) {
  return new Intl.NumberFormat("en-US").format(value);
}

function buildSliceSummary(articles) {
  if (!articles.length) {
    return "TLDR: No stories match the current slice, so widen the filters or clear the search to bring the broader narrative back into view.";
  }

  const themeCounts = countItems(articles.map((article) => article.theme_id));
  const techCounts = countItems(articles.flatMap((article) => article.technologies));
  const leadTheme = getTheme(themeCounts[0].name);
  const secondTheme = themeCounts[1] ? getTheme(themeCounts[1].name) : null;
  const topTechs = techCounts.slice(0, 3).map((item) => item.name);
  const standout = [...articles].sort(
    (left, right) => right.score - left.score || right.featured_date.localeCompare(left.featured_date),
  )[0];

  const leadNarrative = describeThemeStory(leadTheme?.name, state.month === "all" ? "full-run" : "month");
  let summary = `${capitalizeFirst(lowercaseFirst(leadTheme.name))} ${leadNarrative}`;

  if (topTechs.length) {
    summary += `, featuring ${joinNatural(topTechs)}.`;
  } else {
    summary += ".";
  }

  if (secondTheme) {
    summary += ` The next strongest thread was ${lowercaseFirst(secondTheme.name)}, which broadened the slice beyond the lead current.`;
  }

  if (standout) {
    summary += ` The the most central story was "${standout.title}"`;
  }

  return summary;
}

function describeThemeStory(themeName, scope) {
  const byTheme = {
    "Agentic AI & Retrieval":
      scope === "full-run"
        ? "tracked the shift from experimentation to production agents, retrieval workflows, and context-heavy tooling"
        : "focused on agents moving closer to production, with retrieval and context management driving the story",
    "Lakehouse & Open Table Formats":
      scope === "full-run"
        ? "captured the fight over open table formats, lakehouse consolidation, and platform interoperability"
        : "focused on table-format competition, migration pressure, and platform interoperability",
    "Streaming & Real-Time Systems":
      scope === "full-run"
        ? "tracked the push toward lower-latency pipelines, event-driven architectures, and production-scale streaming design"
        : "focused on lower-latency pipelines, event-driven systems, and production streaming tradeoffs",
    "Databases & Analytics Engines":
      scope === "full-run"
        ? "centered on faster analytical engines, practical database architecture, and query-performance tradeoffs"
        : "focused on analytical engine performance, database design choices, and practical tuning tradeoffs",
    "Analytics Engineering & Semantic Layers":
      scope === "full-run"
        ? "followed the move toward cleaner metric definitions, semantic layers, and more durable analytics workflows"
        : "focused on metric consistency, semantic layers, and tightening analytics workflows",
    "Governance, Quality & Observability":
      scope === "full-run"
        ? "followed the need for better trust, control, and visibility as data systems became harder to govern"
        : "focused on trust, visibility, and tighter control over complex data systems",
    "ML Platforms & AI Infrastructure":
      scope === "full-run"
        ? "tracked the race to operationalize models, manage inference costs, and build more resilient AI infrastructure"
        : "focused on model operations, inference economics, and the pressure on AI infrastructure",
    "Infrastructure & Developer Tooling":
      scope === "full-run"
        ? "followed the steady push to make data platforms easier to ship, operate, and maintain"
        : "focused on making data platforms easier to ship, run, and maintain",
  };
  return byTheme[themeName] || "defined the main storyline in this slice";
}

function countItems(items) {
  const counts = new Map();
  items
    .filter(Boolean)
    .forEach((item) => counts.set(item, (counts.get(item) || 0) + 1));
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((left, right) => right.count - left.count || left.name.localeCompare(right.name));
}

function joinNatural(items) {
  if (items.length === 1) {
    return items[0];
  }
  if (items.length === 2) {
    return `${items[0]} and ${items[1]}`;
  }
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

function lowercaseFirst(value) {
  return value ? value.charAt(0).toLowerCase() + value.slice(1) : value;
}

function capitalizeFirst(value) {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : value;
}

function groupBy(items, keyFn) {
  return items.reduce((groups, item) => {
    const key = keyFn(item);
    groups[key] = groups[key] || [];
    groups[key].push(item);
    return groups;
  }, {});
}

function getTheme(themeId) {
  return dataset.themes.find((theme) => theme.id === themeId);
}

function labelForMonth(monthId) {
  return dataset.months.find((month) => month.id === monthId)?.label || monthId;
}

function pseudoRandom(seed) {
  const x = Math.sin(seed * 999.91) * 10000;
  return x - Math.floor(x);
}
