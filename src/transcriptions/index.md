---
layout: base
title: Transcriptions
---

<section class="transcription-hero">
  <div class="transcription-hero-text">
    <p class="page-kicker">Manuscript Transcriptions Library</p>
  </div>
</section>

<section class="transcription-search">
  <div class="search-row">
    <input id="manuscriptSearch" type="text" placeholder="Search title, tradition, keywords..." />
    <div class="search-tags">
      <button class="tag-button is-active" data-filter="all">All</button>
      <button class="tag-button" data-filter="sanskrit">Sanskrit</button>
      <button class="tag-button" data-filter="chinese">Chinese</button>
      <button class="tag-button" data-filter="coming">In preparation</button>
    </div>
  </div>
</section>

<section class="transcription-grid" id="manuscriptGrid">
  <article class="manuscript-card" data-tags="sanskrit coming" data-title="brhatsamhita">
    <div class="card-header">
      <h2>Brhatsamhita — Digital Edition</h2>
      <p class="card-subtitle">Sanskrit · Astronomy/Astrology · Multi-section</p>
    </div>
    <div class="card-body">
      <p>Planned: manuscript images, transcription, translation, and advanced search.</p>
    </div>
    <div class="card-actions">
      <span class="card-link is-disabled">In preparation</span>
    </div>
  </article>
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
