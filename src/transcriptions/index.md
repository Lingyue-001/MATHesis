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
  <article class="manuscript-card" data-tags="chinese" data-title="hanshu lulizhi liuyuanqi">
    <div class="card-header">
      <h2>漢書 Hanshu</h2>
      <p class="card-subtitle">Chinese · Calendrical/Mathematical · Eastern Han (1st c. CE)</p>
    </div>
    <div class="card-body">
      <p>Selected section: 律历志 Lüli zhi</p>
      <p>Manuscript witness: late 12th c.</p>
    </div>
    <div class="card-actions">
      <a class="card-link" href="{{ '/transcriptions/tei_hanshu/lingyue.html' | url }}">Open</a> <!-- 文件名和路径要指向对应html -->
    </div>
  </article>

  <article class="manuscript-card" data-tags="sanskrit coming" data-title="brhatsamhita">
    <div class="card-header">
      <h2>बृहत्संहिता BṛhatSaṃhitā</h2>
      <p class="card-subtitle">Sanskrit · Divinatory · 6th c. CE</p>
    </div>
    <div class="card-body">
      <p>Selected chapter: उपनयनाध्यायः upanayanādhyāyaḥ</p>
      <p>Manuscript witness: 16–17th c.</p>
    </div>
    <div class="card-actions">
      <a class="card-link" href="{{ '/transcriptions/tei_brhat/1r.html' | url }}">Open</a> <!-- 文件名和路径要指向对应html -->
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
