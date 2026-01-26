---
layout: base
title: Transcriptions
---

<section class="transcription-hero">
  <div class="transcription-hero-text">
    <h1>Manuscript Transcriptions Library</h1>
    <p>
      A visual archive for manuscript scans, transcriptions, and translations.
      Browse by text, filter by tradition, and explore line-aligned views.
    </p>
  </div>
  <div class="transcription-hero-panel">
    <div class="hero-stat">
      <span class="hero-stat-number">1</span>
      <span class="hero-stat-label">Manuscript Live</span>
    </div>
    <div class="hero-stat">
      <span class="hero-stat-number">2</span>
      <span class="hero-stat-label">Collections Planned</span>
    </div>
  </div>
</section>

<section class="transcription-search">
  <div class="search-row">
    <input id="manuscriptSearch" type="text" placeholder="Search title, tradition, keywords..." />
    <div class="search-tags">
      <button class="tag-button is-active" data-filter="all">All</button>
      <button class="tag-button" data-filter="sanskrit">Sanskrit</button>
      <button class="tag-button" data-filter="chinese">Chinese</button>
      <button class="tag-button" data-filter="coming">Coming Soon</button>
    </div>
  </div>
</section>

<section class="transcription-grid" id="manuscriptGrid">
  <article class="manuscript-card" data-tags="sanskrit available" data-title="yavanajataka q90r-v mak 2013">
    <div class="card-header">
      <span class="card-badge is-live">Live</span>
      <h2>Yavanajataka — Q90r–v</h2>
      <p class="card-subtitle">Mak 2013 · Sanskrit · Astral/Mathematical</p>
    </div>
    <div class="card-body">
      <p>Line-aligned transcription with a manuscript-focused reading layout.</p>
      <ul class="card-meta">
        <li>Pages: Q90r–v</li>
        <li>Assets: transcription (TEI), translation (planned)</li>
      </ul>
    </div>
    <div class="card-actions">
      <a class="card-link" href="{{ '/transcriptions/q90/' | url }}">Open</a>
    </div>
  </article>

  <article class="manuscript-card" data-tags="sanskrit coming" data-title="brhatsamhita">
    <div class="card-header">
      <span class="card-badge is-coming">Coming</span>
      <h2>Brhatsamhita — Digital Edition</h2>
      <p class="card-subtitle">Sanskrit · Astronomy/Astrology · Multi-section</p>
    </div>
    <div class="card-body">
      <p>Planned: manuscript images, transcription, translation, and advanced search.</p>
      <ul class="card-meta">
        <li>Status: preparing sources</li>
        <li>Focus: number symbolism and technical operations</li>
      </ul>
    </div>
    <div class="card-actions">
      <span class="card-link is-disabled">Planned</span>
    </div>
  </article>
</section>

<section class="transcription-notes">
  <h2>How to use this library</h2>
  <p>
    Each manuscript entry opens a reading workspace that pairs the image with
    transcription and translation. The layout is designed to reflect the
    material structure of the manuscript and to support textual exploration.
  </p>
</section>

<script>
  const searchInput = document.getElementById("manuscriptSearch");
  const cards = Array.from(document.querySelectorAll(".manuscript-card"));
  const tagButtons = Array.from(document.querySelectorAll(".tag-button"));
  let activeFilter = "all";

  const matches = (card, term, filter) => {
    const title = card.dataset.title || "";
    const tags = card.dataset.tags || "";
    const textMatch = title.includes(term);
    const filterMatch = filter === "all" || tags.includes(filter);
    return textMatch && filterMatch;
  };

  const render = () => {
    const term = (searchInput.value || "").toLowerCase().trim();
    cards.forEach(card => {
      const show = matches(card, term, activeFilter);
      card.style.display = show ? "flex" : "none";
    });
  };

  searchInput.addEventListener("input", render);
  tagButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      tagButtons.forEach(b => b.classList.remove("is-active"));
      btn.classList.add("is-active");
      activeFilter = btn.dataset.filter;
      render();
    });
  });
</script>
