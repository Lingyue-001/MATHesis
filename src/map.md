---
layout: base
title: MATHesis – Map of Source Texts
---

<style>
  #map {
    height: 80vh;
    width: 100%;
    margin-top: 2rem;
    border-radius: 12px;
  }
</style>

<div id="map"></div>

<!-- Leaflet 脚本和样式 -->
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>

<script>
  document.addEventListener("DOMContentLoaded", () => {
    const map = L.map('map').setView([25, 85], 4);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    // 汉书：西安（长安）
    L.marker([34.3416, 108.9398])
      .addTo(map)
      .bindPopup("<b><em>Han shu</em></b><br>1st Century · Western Han Dynasty · Chang'an (modern Xi'an)");

    // GSS：Mysore
    L.marker([12.2958, 76.6394])
      .addTo(map)
      .bindPopup("<b><em>Gaṇita Sāra Saṃgraha</em></b><br>c. 850 CE · India · Mysore");
  });
</script>
