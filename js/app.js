/**
 * AVANTE SANTA MARIA — App Controller
 * Map-centric civic reporting progressive web app
 */

/* ============================================================
   1. TOAST SYSTEM
   ============================================================ */
const Toast = {
  container: null,

  init() {
    this.container = document.getElementById('toast-container');
  },

  show(type, title, message, duration = 4000) {
    if (!this.container) return;
    const icons = {
      success: 'ti-circle-check',
      error: 'ti-alert-octagon',
      warning: 'ti-alert-triangle',
      info: 'ti-info-circle',
    };
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
      <i class="ti ${icons[type] || icons.info} toast-icon"></i>
      <div class="toast-body">
        <strong class="toast-title">${title}</strong>
        <span class="toast-message">${message}</span>
      </div>
      <button class="toast-close" aria-label="Fechar"><i class="ti ti-x"></i></button>
    `;
    toast.querySelector('.toast-close').addEventListener('click', () => {
      toast.classList.add('toast-exit');
      setTimeout(() => toast.remove(), 300);
    });
    this.container.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('toast-enter'));
    setTimeout(() => {
      if (toast.parentNode) {
        toast.classList.add('toast-exit');
        setTimeout(() => toast.remove(), 300);
      }
    }, duration);
  },
};

/* ============================================================
   2. MODAL SYSTEM (generic alerts)
   ============================================================ */
const Modal = {
  overlay: null,
  box: null,

  init() {
    this.overlay = document.getElementById('modal-alert');
    this.box = document.getElementById('modal-alert-box');
    if (this.overlay) {
      this.overlay.addEventListener('click', (e) => {
        if (e.target === this.overlay) this.close();
      });
    }
  },

  open({ icon, iconClass, title, body, actions }) {
    if (!this.box || !this.overlay) return;
    let actionsHtml = '';
    if (actions && actions.length) {
      actionsHtml = `<div class="modal-alert-actions">${actions
        .map(
          (a) =>
            `<button class="btn ${a.class || ''}" id="${a.id || ''}">${a.label}</button>`
        )
        .join('')}</div>`;
    }
    this.box.innerHTML = `
      <div class="modal-alert-icon ${iconClass || ''}">
        <i class="ti ${icon || 'ti-info-circle'}"></i>
      </div>
      <h3 class="modal-alert-title">${title || ''}</h3>
      <p class="modal-alert-body">${body || ''}</p>
      ${actionsHtml}
    `;
    if (actions && actions.length) {
      actions.forEach((a) => {
        const btn = this.box.querySelector(`#${a.id}`);
        if (btn && a.onClick) btn.addEventListener('click', a.onClick);
      });
    }
    this.overlay.classList.add('open');
  },

  close() {
    if (this.overlay) this.overlay.classList.remove('open');
  },
};

/* ============================================================
   3. SHEET CONTROLLER
   ============================================================ */
const SheetCtrl = {
  activeSheet: null,

  open(sheetId) {
    if (this.activeSheet === sheetId) return;
    if (this.activeSheet) this.close();
    const sheet = document.getElementById('sheet-' + sheetId);
    if (sheet) {
      sheet.classList.add('open');
      this.activeSheet = sheetId;
      history.pushState({ sheet: sheetId }, '');
      // Highlight nav button
      const navMap = { ocorrencias: 'nav-ocorrencias', perfil: 'nav-perfil' };
      if (navMap[sheetId]) {
        document.getElementById(navMap[sheetId])?.classList.add('active');
      }
    }
  },

  close() {
    if (!this.activeSheet) return;
    const sheet = document.getElementById('sheet-' + this.activeSheet);
    if (sheet) sheet.classList.remove('open');
    this.activeSheet = null;
    document.querySelectorAll('.nav-btn').forEach((b) => b.classList.remove('active'));
  },

  toggle(sheetId) {
    if (this.activeSheet === sheetId) {
      this.close();
      return false; // closed
    }
    this.open(sheetId);
    return true; // opened
  },

  initCloseButtons() {
    ['ocorrencias', 'perfil', 'onboarding', 'terms', 'privacy'].forEach(id => {
      document.getElementById('close-' + id)?.addEventListener('click', () => this.close());
    });
  },
};

// Hardware back / popstate
window.addEventListener('popstate', () => {
  if (document.getElementById('modal-admin')?.classList.contains('open')) {
    document.getElementById('modal-admin').classList.remove('open');
  } else if (document.getElementById('modal-report')?.classList.contains('open')) {
    Report.reset();
  } else if (Modal.overlay?.classList.contains('open')) {
    Modal.close();
  } else if (SheetCtrl.activeSheet) {
    SheetCtrl.close();
  }
});

/* ============================================================
   4. MAP CONTROLLER
   ============================================================ */
const MapCtrl = {
  map: null,
  markersLayer: null,
  userLat: -29.6868,
  userLng: -53.8149,

  init() {
    this.map = L.map('map-canvas', {
      center: [this.userLat, this.userLng],
      zoom: 14,
      minZoom: 12,
      maxBounds: [
        [-29.85, -53.95],
        [-29.55, -53.60]
      ],
      zoomControl: false,
      attributionControl: false,
    });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
    }).addTo(this.map);
    
    // Initialize MarkerClusterGroup
    this.markersLayer = L.markerClusterGroup({
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
      zoomToBoundsOnClick: true,
      maxClusterRadius: 50,
      iconCreateFunction: function(cluster) {
        const count = cluster.getChildCount();
        let c = ' marker-cluster-';
        if (count < 10) c += 'small';
        else if (count < 30) c += 'medium';
        else c += 'large';
        return new L.DivIcon({ 
          html: '<div><span>' + count + '</span></div>', 
          className: 'marker-cluster' + c, 
          iconSize: new L.Point(40, 40) 
        });
      }
    });
    this.map.addLayer(this.markersLayer);
    
    this.heatLayer = L.heatLayer([], { radius: 25, blur: 15, maxZoom: 15 });
    this.isHeatmapActive = false;

    const heatBtn = document.getElementById('btn-heatmap-toggle');
    if (heatBtn) {
      heatBtn.addEventListener('click', () => {
        this.isHeatmapActive = !this.isHeatmapActive;
        if (this.isHeatmapActive) {
          heatBtn.classList.add('active');
          this.map.removeLayer(this.markersLayer);
          this.map.addLayer(this.heatLayer);
        } else {
          heatBtn.classList.remove('active');
          this.map.removeLayer(this.heatLayer);
          this.map.addLayer(this.markersLayer);
        }
      });
    }

    this.getUserLocation();
    this.renderMarkers();
    this.updateStats();
  },

  getUserLocation() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        this.userLat = pos.coords.latitude;
        this.userLng = pos.coords.longitude;
        this.map.setView([this.userLat, this.userLng], 15);
      },
      () => {
        /* keep defaults */
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  },

  renderMarkers(filterCatId = null) {
    this.markersLayer.clearLayers();
    const tickets = DB.getTickets();
    const heatPoints = [];

    tickets.forEach((ticket) => {
      if (ticket.status === 'resolvido') return;
      if (filterCatId && ticket.categoryId !== filterCatId) return;
      
      heatPoints.push([ticket.lat, ticket.lng, ticket.isCritical ? 1.0 : 0.5]);

      const cat = DB.getCategoryById(ticket.categoryId);
      const catColor = cat ? cat.color : '#78909C';
      const catIcon = cat ? cat.icon : 'ti-map-pin';
      
      const icon = L.divIcon({
        className: 'custom-marker',
        html: `<div class="marker-pin ${ticket.isCritical ? 'marker-critical' : ''}" style="background:${catColor}; box-shadow: 0 0 12px ${catColor}80"><i class="ti ${catIcon}"></i></div>`,
        iconSize: [36, 36],
        iconAnchor: [18, 36],
      });
      const marker = L.marker([ticket.lat, ticket.lng], { icon }).addTo(this.markersLayer);
      marker.on('click', () => showIncidentPopup(ticket));
    });

    if (this.heatLayer) {
      this.heatLayer.setLatLngs(heatPoints);
    }
  },

  updateStats() {
    const tickets = DB.getTickets();
    const open = tickets.filter((t) => t.status !== 'resolvido').length;
    const resolved = tickets.filter((t) => t.status === 'resolvido').length;
    const totalSpan = document.querySelector('#stat-total span');
    const resolvedSpan = document.querySelector('#stat-resolved span');
    if (totalSpan) totalSpan.textContent = open;
    if (resolvedSpan) resolvedSpan.textContent = resolved;
  },
};

/* ============================================================
   5. INCIDENT POPUP
   ============================================================ */
function showIncidentPopup(ticket) {
  const popup = document.getElementById('incident-popup');
  if (!popup) return;
  const cat = DB.getCategoryById(ticket.categoryId);
  const entity = DB.getEntityById(ticket.entityId);
  const supported = DB.isSupported(ticket.id);
  const catColor = cat ? cat.color : '#78909C';
  const catIcon = cat ? cat.icon : 'ti-map-pin';
  const catName = cat ? cat.name : 'Outro';
  const entityName = entity ? entity.name : 'Não atribuído';
  const statusLabel = DB.STATUS_LABELS[ticket.status] || ticket.status;
  const statusColor = DB.STATUS_COLORS[ticket.status] || '#999';

  popup.innerHTML = `
    <div class="popup-drag-handle"></div>
    <button class="popup-close" onclick="closeIncidentPopup()" aria-label="Fechar">
      <i class="ti ti-x"></i>
    </button>
    <div class="incident-content-wrapper">
      <div class="incident-header">
        <div class="incident-cat-badge" style="background:${catColor}20; color:${catColor}; border: 1px solid ${catColor}40">
          <i class="ti ${catIcon}"></i> ${catName}
        </div>
        <div class="incident-status" style="background:${statusColor}20; color:${statusColor}; border: 1px solid ${statusColor}40">${statusLabel}</div>
      </div>
      ${(ticket.image_url || ticket.photoData) ? `<img src="${ticket.image_url || ticket.photoData}" alt="Foto da denúncia" class="incident-photo" />` : ''}
      <p class="incident-desc">${ticket.description}</p>
      <div class="incident-meta">
        <span><i class="ti ti-map-pin"></i> ${ticket.address}</span>
        <span><i class="ti ti-clock"></i> ${timeAgo(ticket.createdAt)}</span>
      </div>
      <div class="incident-footer">
        <div><i class="ti ti-building"></i> ${entityName}</div>
        <div><i class="ti ti-thumb-up"></i> ${ticket.supporters} cidadãos apoiam</div>
      </div>
      <button class="btn btn-outline-support ${supported ? 'btn-supported' : ''}" style="width: 100%; margin-bottom: 12px;" ${supported ? 'disabled' : ''} onclick="handlePopupSupport(event, '${ticket.id}')">
        <i class="ti ${supported ? 'ti-thumb-up-filled' : 'ti-thumb-up'}"></i>
        ${supported ? 'Você já apoiou' : 'Apoiar esta denúncia'}
      </button>
      ${
        cat && cat.educationalContent
          ? `<div class="incident-edu" style="margin-top: 8px; font-size: 0.8rem; background: rgba(20,44,73,0.3); padding: 12px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.05); color: rgba(255,255,255,0.7);"><i class="ti ti-info-circle" style="color:var(--accent);"></i> <span style="display:block; margin: 4px 0;">${cat.educationalContent}</span><cite style="opacity:0.5;">Fonte: ${cat.educationalSource}</cite></div>`
          : ''
      }
    </div>
  `;
  popup.classList.add('visible');
}

function closeIncidentPopup() {
  document.getElementById('incident-popup')?.classList.remove('visible');
}

function handlePopupSupport(event, ticketId) {
  if (DB.isSupported(ticketId)) return;
  DB.supportTicket(ticketId);
  
  // Micro-animation
  const btn = event.currentTarget;
  if (btn) {
    btn.classList.add('btn-supported');
    btn.innerHTML = `<i class="ti ti-thumb-up-filled"></i> Você já apoiou`;
    btn.disabled = true;
  }
  
  Toast.show('success', 'Apoio Registrado!', 'Sua voz fortaleceu esta causa!');
  
  setTimeout(() => {
    showIncidentPopup(DB.getTickets().find(t => t.id === ticketId));
    Feed.renderNearby(Feed.currentFilter);
    MapCtrl.renderMarkers(Feed.currentFilter);
  }, 600);
}

/* ============================================================
   HELPERS
   ============================================================ */
function timeAgo(timestamp) {
  const diff = Date.now() - timestamp;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'agora';
  if (mins < 60) return `${mins}min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d`;
  const months = Math.floor(days / 30);
  return `${months}m`;
}

function formatDistance(meters) {
  if (meters < 1000) return `${Math.round(meters)}m`;
  return `${(meters / 1000).toFixed(1)}km`;
}

function truncate(str, max) {
  if (!str) return '';
  return str.length > max ? str.substring(0, max) + '...' : str;
}

/* ============================================================
   6. FEED CONTROLLER (Ocorrências sheet)
   ============================================================ */
const Feed = {
  currentTab: 'perto',
  currentFilter: null,

  init() {
    this.setupTabs();
    this.setupFilters();
  },

  setupTabs() {
    const tabs = document.querySelectorAll('.seg-tab');
    tabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        tabs.forEach((t) => {
          t.classList.remove('active');
          t.setAttribute('aria-selected', 'false');
        });
        tab.classList.add('active');
        tab.setAttribute('aria-selected', 'true');
        const target = tab.dataset.tab;
        this.currentTab = target;
        document.querySelectorAll('.tab-panel').forEach((p) => p.classList.remove('active'));
        document.getElementById('tab-' + target)?.classList.add('active');
        const filterChips = document.getElementById('filter-chips-perto');
        if (target === 'instituicoes') {
          if (filterChips) filterChips.style.display = 'none';
          this.renderInstitutions();
        } else {
          if (filterChips) filterChips.style.display = '';
          this.renderNearby(this.currentFilter);
        }
      });
    });
  },

  setupFilters() {
    const filterSelect = document.getElementById('feed-filter-select');
    if (filterSelect) {
      filterSelect.addEventListener('change', (e) => {
        const catVal = e.target.value;
        this.currentFilter = catVal ? parseInt(catVal) : null;
        this.renderNearby(this.currentFilter);
        MapCtrl.renderMarkers(this.currentFilter);
      });
    }
  },

  renderNearby(filterCatId = null) {
    const list = document.getElementById('feed-list');
    if (!list) return;
    let tickets = DB.getTicketsByDistance(MapCtrl.userLat, MapCtrl.userLng);
    if (filterCatId) {
      tickets = tickets.filter((t) => t.categoryId === filterCatId);
    }
    if (!tickets.length) {
      list.innerHTML = `<div class="feed-empty"><i class="ti ti-map-pin-off"></i><p>Nenhuma ocorrência encontrada.</p></div>`;
      return;
    }
    list.innerHTML = tickets
      .map((ticket) => {
        const cat = DB.getCategoryById(ticket.categoryId);
        const entity = DB.getEntityById(ticket.entityId);
        const catColor = cat ? cat.color : '#78909C';
        const catIcon = cat ? cat.icon : 'ti-map-pin';
        const catName = cat ? cat.name : 'Outro';
        const entityName = entity ? entity.name : '';
        const statusLabel = DB.STATUS_LABELS[ticket.status] || ticket.status;
        const statusColor = DB.STATUS_COLORS[ticket.status] || '#999';
        const supported = DB.isSupported(ticket.id);
        const verifiedBadge = ticket.isGovVerified ? `<i class="ti ti-rosette-discount-check-filled" style="color: #1351b4; margin-left:4px" title="Cidadão Verificado via Gov.br"></i>` : '';
        const photoHtml = (ticket.image_url || ticket.photoData)
          ? `<div class="feed-card-media" onclick="event.stopPropagation(); window.open('${ticket.image_url || ticket.photoData}', '_blank')"><img src="${ticket.image_url || ticket.photoData}" alt="Foto da denúncia" class="feed-card-img" /></div>`
          : '';

        const eduHtml = (cat && cat.educationalContent) ? `
          <details class="feed-card-edu" onclick="event.stopPropagation()">
            <summary><i class="ti ti-bulb"></i> Saiba Mais — Impacto na Saúde Pública</summary>
            <div class="feed-card-edu-content">
              <p>${cat.educationalContent}</p>
              <cite>Fonte: ${cat.educationalSource}</cite>
            </div>
          </details>
        ` : '';

        return `
          <div class="feed-card" onclick="showIncidentPopup(DB.getTickets().find(t=>t.id==='${ticket.id}'))">
            ${photoHtml}
            <div class="feed-card-body">
              <div class="feed-card-meta">
                <span class="feed-card-category" style="background:${catColor}20; color:${catColor}; border: 1px solid ${catColor}40">
                  <i class="ti ${catIcon}"></i> ${catName}
                </span>
                <span class="feed-card-time"><i class="ti ti-user"></i> Anônimo${verifiedBadge}</span>
              </div>
              <p class="feed-card-title">${ticket.description}</p>
              <span class="feed-card-location"><i class="ti ti-map-pin"></i> ${ticket.address}${typeof ticket.distance === 'number' ? ' · ' + formatDistance(ticket.distance) : ''}</span>
              ${eduHtml}
              <div class="feed-card-footer">
                <span class="feed-supporters"><i class="ti ti-thumb-up"></i> ${ticket.supporters}</span>
                ${entityName ? `<span class="feed-entity">${entityName}</span>` : ''}
                <span class="feed-card-status" style="background:${statusColor}20; color:${statusColor}; border: 1px solid ${statusColor}40">${statusLabel}</span>
                <button class="btn-feed-support ${supported ? 'btn-supported' : ''}" ${supported ? 'disabled' : ''} onclick="event.stopPropagation(); handleFeedSupport(event, '${ticket.id}')" title="${supported ? 'Você já apoiou' : 'Apoiar denúncia'}">
                  <i class="ti ${supported ? 'ti-thumb-up-filled' : 'ti-thumb-up'}"></i>
                </button>
              </div>
            </div>
          </div>
        `;
      })
      .join('');
  },

  renderInstitutions() {
    const list = document.getElementById('instituicoes-list');
    if (!list) return;
    const entities = DB.getEntitiesRanked();
    list.innerHTML = entities
      .map((entity, index) => {
        const rank = index + 1;
        const rankClass = rank <= 3 ? 'rank-top' : 'rank-normal';
        const typeLabel = entity.type === 'executivo' ? 'Executivo' : 'Concessionária';
        const score = entity.score || 0;
        let scoreClass = 'score-red';
        let scoreColor = 'var(--alert-red)';
        
        if (score >= 70) {
          scoreClass = 'score-green';
          scoreColor = 'var(--green)';
        } else if (score >= 40) {
          scoreClass = 'score-yellow';
          scoreColor = '#F9D746';
        }

        const scopeCat = (entity.scopeCategories && entity.scopeCategories.length) ? entity.scopeCategories[0] : '';

        return `
          <div class="inst-ranking-card" onclick="document.getElementById('feed-filter-select').value='${scopeCat}'; document.getElementById('feed-filter-select').dispatchEvent(new Event('change')); SheetCtrl.open('ocorrencias')">
            <div class="inst-ranking-card-top">
              <div class="inst-rank ${rankClass}">#${rank}</div>
              <div class="inst-icon-wrap"><i class="ti ${entity.icon}"></i></div>
              <div class="inst-details">
                <strong class="inst-name">${entity.name}</strong>
                <span class="inst-type">${typeLabel}</span>
              </div>
              <div class="inst-score ${scoreClass}">+${score}</div>
            </div>
            
            <div class="inst-ranking-card-bottom">
              <div class="inst-progress-track">
                <div class="inst-progress-fill" style="width:${score}%; background:${scoreColor}"></div>
              </div>
              <div class="inst-metrics-footer">
                <span><i class="ti ti-circle-x" style="color:var(--alert-red)"></i> ${entity.openTickets} em aberto</span>
                <span><i class="ti ti-circle-check" style="color:var(--green)"></i> ${entity.resolvedTickets} resolvidos</span>
                <span><i class="ti ti-chart-bar" style="color:${scoreColor}"></i> ${score}% resolução</span>
              </div>
            </div>
          </div>
        `;
      })
      .join('');
  },
};

function handleFeedSupport(event, ticketId) {
  if (DB.isSupported(ticketId)) return;
  DB.supportTicket(ticketId);
  
  // Micro-animation logic
  const btn = event.currentTarget;
  if (btn) {
    btn.classList.add('btn-supported');
    btn.innerHTML = `<i class="ti ti-thumb-up-filled"></i>`;
    btn.disabled = true;
  }
  
  Toast.show('success', 'Apoio Registrado!', 'Sua voz fortaleceu esta causa!');
  
  // Delay re-render so animation plays
  setTimeout(() => {
    Feed.renderNearby(Feed.currentFilter);
    MapCtrl.renderMarkers(Feed.currentFilter);
  }, 600);
}

/* ============================================================
   7. PROFILE CONTROLLER
   ============================================================ */
const ProfileCtrl = {
  init() {
    this.renderAuthSection();
    this.renderMyReports();
    this.setupPrefs();
  },

  renderAuthSection() {
    const authSection = document.getElementById('profile-auth-section');
    if (!authSection) return;
    
    const session = DB.getSession();
    const tickets = DB.getMyTickets();
    
    if (session) {
      const verifiedBadge = session.isGovVerified ? `<i class="ti ti-rosette-discount-check-filled" style="color: #1351b4; margin-left:4px" title="Cidadão Verificado via Gov.br"></i>` : '';
      
      authSection.innerHTML = `
        <div class="profile-dashboard-header logged-in">
          <div class="profile-avatar"><i class="ti ti-user-check"></i></div>
          <div class="profile-info">
            <h2>${session.nickname}${verifiedBadge}</h2>
            <p>Cidadão Ativo</p>
          </div>
          <button class="btn btn-icon btn-logout" onclick="AuthCtrl.logout()" title="Sair da Conta"><i class="ti ti-logout"></i></button>
        </div>
        
        <div class="profile-dashboard-grid">
          <div class="profile-stat-card">
            <i class="ti ti-file-report" style="color: var(--accent);"></i>
            <h3>${tickets.length}</h3>
            <p>Denúncias Criadas</p>
          </div>
          <div class="profile-stat-card">
            <i class="ti ti-thumb-up-filled" style="color: var(--secondary);"></i>
            <h3>${session.isGovVerified ? 'Oficial' : 'Comum'}</h3>
            <p>Nível de Autenticação</p>
          </div>
        </div>
      `;
    } else {
      authSection.innerHTML = `
        <div class="profile-dashboard-header anon">
          <div class="profile-avatar"><i class="ti ti-shield-lock"></i></div>
          <div class="profile-info">
            <h2>Modo Anônimo</h2>
            <p>Suas denúncias são seguras.</p>
          </div>
          <button class="btn btn-profile-action" onclick="SheetCtrl.open('onboarding')">
            <i class="ti ti-user-plus"></i> Vincular Gov.br
          </button>
        </div>
        
        <div class="profile-dashboard-grid">
          <div class="profile-stat-card">
            <i class="ti ti-file-report" style="color: var(--accent);"></i>
            <h3>${tickets.length}</h3>
            <p>Denúncias Locais</p>
          </div>
          <div class="profile-stat-card">
            <i class="ti ti-eye-off" style="color: var(--alert-red);"></i>
            <h3>100%</h3>
            <p>Privacidade</p>
          </div>
        </div>
      `;
    }
  },

  renderMyReports() {
    const list = document.getElementById('my-reports-list');
    if (!list) return;
    const tickets = DB.getMyTickets();
    if (!tickets.length) {
      list.innerHTML = `
        <div class="empty-state">
          <i class="ti ti-file-off"></i>
          <p>Você ainda não registrou nenhuma denúncia.</p>
        </div>`;
      return;
    }
    list.innerHTML = tickets
      .map((ticket) => {
        const cat = DB.getCategoryById(ticket.categoryId);
        const catIcon = cat ? cat.icon : 'ti-map-pin';
        const catName = cat ? cat.name : 'Outro';
        const catColor = cat ? cat.color : '#78909C';
        const statusLabel = DB.STATUS_LABELS[ticket.status] || ticket.status;
        const statusColor = DB.STATUS_COLORS[ticket.status] || '#999';
        const dateStr = new Date(ticket.createdAt).toLocaleDateString('pt-BR', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        });
        return `
          <div class="my-report-card premium-card">
            <div class="my-report-top">
              <div class="my-report-cat-icon" style="background:${catColor}20; color:${catColor}; border: 1px solid ${catColor}40">
                <i class="ti ${catIcon}"></i>
              </div>
              <div class="my-report-info">
                <div class="my-report-cat">${catName}</div>
                <div class="my-report-date"><i class="ti ti-calendar"></i> ${dateStr}</div>
              </div>
              <span class="my-report-status" style="background:${statusColor}20; color:${statusColor}; border: 1px solid ${statusColor}40">${statusLabel}</span>
            </div>
            <p class="my-report-desc">${truncate(ticket.description, 100)}</p>
          </div>
        `;
      })
      .join('');
  },

  setupPrefs() {
    const prefs = DB.getPrefs();
    const prefAgua = document.getElementById('pref-agua');
    const prefVias = document.getElementById('pref-vias');
    const prefEnergia = document.getElementById('pref-energia');
    const prefGeral = document.getElementById('pref-geral');
    if (prefAgua) prefAgua.checked = prefs.notifAgua;
    if (prefVias) prefVias.checked = prefs.notifVias;
    if (prefEnergia) prefEnergia.checked = prefs.notifEnergia;
    if (prefGeral) prefGeral.checked = prefs.notifGeral;

    const save = () => {
      DB.savePrefs({
        notifAgua: prefAgua?.checked ?? true,
        notifVias: prefVias?.checked ?? true,
        notifEnergia: prefEnergia?.checked ?? true,
        notifGeral: prefGeral?.checked ?? true,
      });
    };
    [prefAgua, prefVias, prefEnergia, prefGeral].forEach((el) => {
      if (el) el.addEventListener('change', save);
    });
  },
};

/* ============================================================
   8. REPORT FLOW
   ============================================================ */
const Report = {
  state: {
    photoData: null,
    lat: null,
    lng: null,
    address: '',
    categoryId: null,
  },

  init() {
    const cameraInput = document.getElementById('camera-input');
    if (cameraInput) {
      cameraInput.addEventListener('change', (e) => this.onPhotoCapture(e));
    }
    document.getElementById('btn-retry-photo')?.addEventListener('click', () => {
      this.start();
    });
    document.getElementById('btn-report-close')?.addEventListener('click', () => {
      this.reset();
    });
    document.getElementById('btn-success-close')?.addEventListener('click', () => {
      this.reset();
      MapCtrl.updateStats();
    });
    document.getElementById('btn-submit-report')?.addEventListener('click', () => {
      this.submit();
    });
    this.setupDescription();
  },

  start() {
    const cameraInput = document.getElementById('camera-input');
    if (cameraInput) {
      cameraInput.value = '';
      cameraInput.click();
    }
  },

  onPhotoCapture(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      Toast.show('error', 'Arquivo inválido', 'Selecione uma imagem.');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 800;
        const MAX_HEIGHT = 800;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height = Math.round(height * (MAX_WIDTH / width));
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width = Math.round(width * (MAX_HEIGHT / height));
            height = MAX_HEIGHT;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        this.state.photoData = canvas.toDataURL('image/jpeg', 0.6);

        // Get GPS
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              this.state.lat = pos.coords.latitude;
              this.state.lng = pos.coords.longitude;
              this.reverseGeocode(this.state.lat, this.state.lng);
            },
            () => {
              this.state.lat = MapCtrl.userLat;
              this.state.lng = MapCtrl.userLng;
              this.state.address = 'Santa Maria, RS';
            },
            { enableHighAccuracy: true, timeout: 8000 }
          );
        } else {
          this.state.lat = MapCtrl.userLat;
          this.state.lng = MapCtrl.userLng;
          this.state.address = 'Santa Maria, RS';
        }
        this.showAICheck();
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  },

  reverseGeocode(lat, lng) {
    fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1&accept-language=pt-BR`
    )
      .then((r) => r.json())
      .then((data) => {
        if (data && data.display_name) {
          const addr = data.address || {};
          const road = addr.road || addr.pedestrian || '';
          const suburb = addr.suburb || addr.neighbourhood || addr.city_district || '';
          this.state.address = road && suburb ? `${road}, ${suburb}` : data.display_name.split(',').slice(0, 2).join(',');
        } else {
          this.state.address = 'Santa Maria, RS';
        }
        this.updateGeoUI();
      })
      .catch(() => {
        this.state.address = 'Santa Maria, RS';
        this.updateGeoUI();
      });
  },

  updateGeoUI() {
    const addrEl = document.getElementById('report-address');
    const coordsEl = document.getElementById('report-coords');
    if (addrEl) addrEl.textContent = this.state.address;
    if (coordsEl && this.state.lat) {
      coordsEl.textContent = `${this.state.lat.toFixed(6)}, ${this.state.lng.toFixed(6)}`;
    }
  },

  showAICheck() {
    const modal = document.getElementById('modal-report');
    if (modal) modal.classList.add('open');
    history.pushState({ report: true }, '');
    this.hideAllSteps();
    const aiStep = document.getElementById('report-step-ai');
    if (aiStep) aiStep.style.display = 'flex';
    setTimeout(() => {
      const pass = Math.random() < 0.95;
      if (pass) {
        this.onAIApprove();
      } else {
        this.onAIReject();
      }
    }, 2000);
  },

  onAIApprove() {
    this.hideAllSteps();
    const detailStep = document.getElementById('report-step-detail');
    if (detailStep) detailStep.style.display = 'flex';
    // Populate photo preview
    const preview = document.getElementById('report-photo-preview');
    if (preview && this.state.photoData) {
      preview.innerHTML = `<img src="${this.state.photoData}" alt="Foto da denúncia" />`;
    }
    this.updateGeoUI();
    this.buildCategoryGrid();
  },

  onAIReject() {
    this.hideAllSteps();
    const rejStep = document.getElementById('report-step-rejected');
    if (rejStep) rejStep.style.display = 'flex';
  },

  hideAllSteps() {
    document.querySelectorAll('.report-step').forEach((s) => (s.style.display = 'none'));
  },

  buildCategoryGrid() {
    const grid = document.getElementById('category-grid');
    if (!grid) return;
    grid.innerHTML = DB.CATEGORIES.map(
      (cat) => `
        <div class="category-card" data-cat="${cat.id}" onclick="Report.selectCategory(${cat.id})">
          <i class="ti ${cat.icon}" style="color:${cat.color}"></i>
          <span>${cat.name}</span>
        </div>
      `
    ).join('');
  },

  selectCategory(catId) {
    this.state.categoryId = catId;
    document.querySelectorAll('.category-card').forEach((card) => {
      card.classList.toggle('selected', parseInt(card.dataset.cat) === catId);
    });
    const cat = DB.getCategoryById(catId);
    if (cat && cat.requiresWarning) {
      Modal.open({
        icon: 'ti-alert-triangle',
        iconClass: 'modal-icon-warning',
        title: 'Atenção',
        body: 'Esta categoria destina-se a problemas de ordem pública. Denúncias falsas ou de má-fé podem resultar em suspensão do acesso.',
        actions: [
          {
            id: 'btn-warn-ok',
            label: 'Entendi',
            class: 'btn-primary',
            onClick: () => Modal.close(),
          },
        ],
      });
    }
  },

  setupDescription() {
    const textarea = document.getElementById('report-description');
    const charCount = document.getElementById('char-count');
    const modWarning = document.getElementById('mod-warning');
    const modText = document.getElementById('mod-warning-text');
    if (!textarea) return;
    textarea.addEventListener('input', () => {
      const len = textarea.value.length;
      if (charCount) charCount.textContent = `${len}/280`;
      const violations = DB.moderateText(textarea.value);
      if (violations.length > 0) {
        if (modWarning) modWarning.style.display = 'flex';
        if (modText) modText.textContent = 'Conteúdo suspeito detectado. Revise o texto.';
      } else {
        if (modWarning) modWarning.style.display = 'none';
      }
    });
  },

  async submit() {
    const desc = document.getElementById('report-description')?.value?.trim() || '';
    if (!this.state.categoryId) {
      Toast.show('warning', 'Categoria obrigatória', 'Selecione uma categoria para a denúncia.');
      return;
    }
    if (desc.length < 10) {
      Toast.show('warning', 'Descrição curta', 'Descreva o problema com pelo menos 10 caracteres.');
      return;
    }
    
    Toast.show('info', 'Enviando...', 'Processando denúncia e fazendo upload da foto...', 3000);
    
    let finalImageUrl = this.state.photoData;
    
    // Upload da imagem para o Supabase Storage se for Base64 (foto da câmera)
    if (finalImageUrl && finalImageUrl.startsWith('data:image')) {
      try {
        const res = await fetch(finalImageUrl);
        const blob = await res.blob();
        const fileName = `incident_${Date.now()}_${Math.random().toString(36).substring(7)}.jpg`;
        
        const { error: uploadError } = await window.supabaseClient.storage
          .from('report_images')
          .upload(fileName, blob, { contentType: 'image/jpeg' });
          
        if (!uploadError) {
          const { data: urlData } = window.supabaseClient.storage
            .from('report_images')
            .getPublicUrl(fileName);
          finalImageUrl = urlData.publicUrl;
        }
      } catch (e) {
        console.error("Erro no upload", e);
      }
    }

    const session = DB.getSession();
    const isGovVerified = session ? session.isGovVerified : false;
    
    const ticket = await DB.createTicket({
      categoryId: parseInt(this.state.categoryId, 10),
      description: desc,
      photoData: finalImageUrl,
      lat: this.state.lat,
      lng: this.state.lng,
      address: this.state.address,
      isGovVerified: isGovVerified,
    });
    
    if(!ticket) return;
    this.showSuccess(ticket);
  },

  showSuccess(ticket) {
    this.hideAllSteps();
    const successStep = document.getElementById('report-step-success');
    if (successStep) successStep.style.display = 'flex';
    const card = document.getElementById('success-detail-card');
    if (card) {
      const cat = DB.getCategoryById(ticket.categoryId);
      const entity = DB.getEntityById(ticket.entityId);
      const catIcon = cat ? cat.icon : 'ti-map-pin';
      const catName = cat ? cat.name : 'Outro';
      const catColor = cat ? cat.color : '#78909C';
      const entityName = entity ? entity.name : 'Em definição';

      document.querySelector('.success-icon-wrap').style.background = '';
      document.querySelector('.success-icon-wrap i').style.color = '';
      document.querySelector('.success-icon-wrap i').className = 'ti ti-circle-check';
      successStep.querySelector('h3').textContent = 'Denúncia Registrada!';
      successStep.querySelector('h3').style.color = '';
      successStep.querySelector('.success-subtitle').textContent = 'Protocolo enviado com sucesso.';
      successStep.querySelector('.success-status-badge').innerHTML = '<i class="ti ti-clock"></i> Enviado para Análise';
      successStep.querySelector('.success-status-badge').style.background = '';
      successStep.querySelector('.success-status-badge').style.color = '';

      card.innerHTML = `
        <div class="success-ticket-header">
          <i class="ti ${catIcon}" style="color:${catColor}"></i>
          <div>
            <strong>${catName}</strong>
            <span>${ticket.address}</span>
          </div>
        </div>
        <p class="success-ticket-desc">"${ticket.description}"</p>
        <div class="success-ticket-meta">
          <span><i class="ti ti-building"></i> Encaminhado para: ${entityName}</span>
          <span style="color:var(--accent)"><i class="ti ti-shield-check"></i> Anônimo</span>
        </div>
      `;
    }
    Toast.show('success', 'Denúncia registrada', 'Protocolo enviado com sucesso. Aguardando aprovação.');
    MapCtrl.updateStats();
  },

  reset() {
    this.state = { photoData: null, lat: null, lng: null, address: '', categoryId: null };
    const modal = document.getElementById('modal-report');
    if (modal) modal.classList.remove('open');
    this.hideAllSteps();
    const textarea = document.getElementById('report-description');
    if (textarea) textarea.value = '';
    const charCount = document.getElementById('char-count');
    if (charCount) charCount.textContent = '0/280';
    const modWarning = document.getElementById('mod-warning');
    if (modWarning) modWarning.style.display = 'none';
    const preview = document.getElementById('report-photo-preview');
    if (preview) preview.innerHTML = '';
  },
};

/* ============================================================
   9. ADMIN PANEL
   ============================================================ */
const Admin = {
  unlocked: false,
  PIN: '1234',
  pinEntered: '',

  open() {
    const modal = document.getElementById('modal-admin');
    if (modal) modal.classList.add('open');
    history.pushState({ admin: true }, '');
    if (!this.unlocked) {
      this.showPinScreen();
    } else {
      this.showDashboard();
    }
  },

  close() {
    const modal = document.getElementById('modal-admin');
    if (modal) modal.classList.remove('open');
  },

  showPinScreen() {
    this.pinEntered = '';
    const content = document.getElementById('admin-content');
    if (!content) return;
    content.innerHTML = `
      <div class="admin-pin-screen">
        <button class="admin-close-btn" onclick="Admin.close()" aria-label="Fechar">
          <i class="ti ti-x"></i>
        </button>
        <div class="admin-pin-icon"><i class="ti ti-lock"></i></div>
        <h3>Acesso Administrativo</h3>
        <p>Digite o PIN de 4 dígitos</p>
        <div class="pin-dots" id="pin-dots">
          <div class="pin-dot"></div>
          <div class="pin-dot"></div>
          <div class="pin-dot"></div>
          <div class="pin-dot"></div>
        </div>
        <div class="pin-error" id="pin-error" style="display:none">PIN incorreto</div>
        <div class="pin-keypad" id="pin-keypad">
          <button class="pin-key" onclick="Admin.handlePinKey('1')">1</button>
          <button class="pin-key" onclick="Admin.handlePinKey('2')">2</button>
          <button class="pin-key" onclick="Admin.handlePinKey('3')">3</button>
          <button class="pin-key" onclick="Admin.handlePinKey('4')">4</button>
          <button class="pin-key" onclick="Admin.handlePinKey('5')">5</button>
          <button class="pin-key" onclick="Admin.handlePinKey('6')">6</button>
          <button class="pin-key" onclick="Admin.handlePinKey('7')">7</button>
          <button class="pin-key" onclick="Admin.handlePinKey('8')">8</button>
          <button class="pin-key" onclick="Admin.handlePinKey('9')">9</button>
          <button class="pin-key pin-key-empty"></button>
          <button class="pin-key" onclick="Admin.handlePinKey('0')">0</button>
          <button class="pin-key pin-key-back" onclick="Admin.handlePinKey('back')"><i class="ti ti-backspace"></i></button>
        </div>
      </div>
    `;
  },

  handlePinKey(key) {
    const errorEl = document.getElementById('pin-error');
    if (key === 'back') {
      this.pinEntered = this.pinEntered.slice(0, -1);
    } else if (this.pinEntered.length < 4) {
      this.pinEntered += key;
    }
    // Update dots
    const dots = document.querySelectorAll('#pin-dots .pin-dot');
    dots.forEach((dot, i) => {
      dot.classList.toggle('filled', i < this.pinEntered.length);
    });
    if (this.pinEntered.length === 4) {
      if (this.pinEntered === this.PIN) {
        this.unlocked = true;
        if (errorEl) errorEl.style.display = 'none';
        this.showDashboard();
      } else {
        if (errorEl) errorEl.style.display = 'block';
        setTimeout(() => {
          this.pinEntered = '';
          dots.forEach((d) => d.classList.remove('filled'));
          if (errorEl) errorEl.style.display = 'none';
        }, 1000);
      }
    }
  },

  async approveTicket(id) {
    const success = await DB.updateTicketStatus(id, 'andamento');
    if (success) {
      Toast.show('success', 'Aprovada!', 'Denúncia aprovada e publicada no mapa.');
      await DB.syncTickets();
      this.showDashboard();
      MapCtrl.renderMarkers();
      MapCtrl.updateStats();
    }
  },

  async rejectTicket(id) {
    const success = await DB.updateTicketStatus(id, 'resolvido');
    if (success) {
      Toast.show('info', 'Arquivada', 'A denúncia foi arquivada.');
      await DB.syncTickets();
      this.showDashboard();
      MapCtrl.renderMarkers();
      MapCtrl.updateStats();
    }
  },

  showDashboard() {
    const content = document.getElementById('admin-content');
    if (!content) return;
    const stats = DB.getStats();
    const logs = DB.getMailLogs();
    const resolutionRate = stats.total > 0 ? Math.round((stats.resolvido / stats.total) * 100) : 0;

    const topBairrosHtml = stats.topBairros
      .map(
        (b, i) => `
        <div class="admin-bairro-item">
          <span class="admin-bairro-rank">${i + 1}</span>
          <span class="admin-bairro-name">${b.name}</span>
          <span class="admin-bairro-count">${b.count}</span>
        </div>`
      )
      .join('');

    const recipientEntities = DB.ENTITIES.filter((e) =>
      ['executivo', 'concessionaria'].includes(e.type)
    );
    const recipientList = recipientEntities
      .map(
        (e) => `
        <div class="admin-recipient">
          <i class="ti ${e.icon}"></i>
          <div class="admin-contact-info">
            <strong>${e.name}</strong>
            <small>${(e.emails && e.emails.length) ? e.emails[0] : 'Sem e-mail'}</small>
          </div>
        </div>`
      )
      .join('');

    const vereadorList = DB.VEREADORES.map(
      (v) => `
        <div class="admin-vereador">
          <i class="ti ti-user"></i>
          <div class="admin-contact-info">
            <strong>${v.name}</strong>
            <small>${v.email}</small>
          </div>
        </div>`
    ).join('');

    const logsHtml = logs
      .map((log) => {
        const date = new Date(log.dispatchedAt).toLocaleDateString('pt-BR', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        });
        return `
          <tr>
            <td>${date}</td>
            <td>${log.ticketCount}</td>
            <td style="font-size:0.7rem;">${log.topBairros ? log.topBairros.join(', ') : ''}</td>
            <td><span class="admin-log-status">${log.status === 'sent' ? '<i class="ti ti-check" style="color:var(--green)"></i>' : log.status}</span></td>
          </tr>`;
      })
      .join('');

    const recentTickets = DB.getAllTickets().slice(0, 5);
    const ticketsHtml = recentTickets.length ? recentTickets.map(t => {
      const cat = DB.getCategoryById(t.categoryId);
      const catName = cat ? cat.name : 'Outro';
      const statusLabel = DB.STATUS_LABELS[t.status] || t.status;
      const statusColor = DB.STATUS_COLORS[t.status] || '#999';
      const timeAgo = Math.floor((Date.now() - t.createdAt) / 60000);
      const timeStr = timeAgo < 60 ? `${timeAgo}m atrás` : `${Math.floor(timeAgo/60)}h atrás`;
      const verifiedBadge = t.isGovVerified ? `<i class="ti ti-rosette-discount-check-filled" style="color: #1351b4; margin-left:4px" title="Verificado"></i>` : '';
      return `
        <div class="admin-ticket-card">
          <div class="admin-ticket-header">
            <strong>${catName}</strong>
            <span class="admin-ticket-status" style="color:${statusColor}">${statusLabel}</span>
          </div>
          <div class="admin-ticket-body">
            <p>${t.description}</p>
            <div class="admin-ticket-meta">
              <span><i class="ti ti-map-pin"></i> ${t.address}</span>
              <span><i class="ti ti-clock"></i> ${timeStr} &middot; Anônimo${verifiedBadge}</span>
            </div>
            ${t.status === 'analise' ? `
            <div class="admin-ticket-actions" style="margin-top:10px; display:flex; gap:8px;">
               <button class="btn btn-primary" onclick="Admin.approveTicket('${t.id}')" style="flex:1; padding: 6px 12px; font-size:0.8rem; background: var(--green); border:none;"><i class="ti ti-check"></i> Aprovar</button>
               <button class="btn btn-ghost" onclick="Admin.rejectTicket('${t.id}')" style="flex:1; padding: 6px 12px; font-size:0.8rem; color: var(--alert-red);"><i class="ti ti-x"></i> Rejeitar</button>
            </div>
            ` : ''}
          </div>
        </div>
      `;
    }).join('') : '<p style="color:rgba(255,255,255,0.4); font-size:0.8rem;">Sem denúncias recentes.</p>';

    content.innerHTML = `
      <div class="admin-dashboard">
        <div class="admin-header-premium">
          <div class="admin-header-title">
            <h3><i class="ti ti-server-cog"></i> Centro de Operações</h3>
            <p>Monitoramento e Despacho Ativo</p>
          </div>
          <button class="popup-close" onclick="Admin.close()" aria-label="Fechar" style="position:relative; right:0; top:0;">
            <i class="ti ti-x"></i>
          </button>
        </div>

        <div class="admin-stat-grid premium-stats">
          <div class="admin-stat stat-total">
            <i class="ti ti-ticket admin-stat-icon"></i>
            <div class="admin-stat-info">
              <div class="admin-stat-value">${stats.total}</div>
              <div class="admin-stat-label">Total</div>
            </div>
          </div>
          <div class="admin-stat stat-open">
            <i class="ti ti-alert-circle admin-stat-icon"></i>
            <div class="admin-stat-info">
              <div class="admin-stat-value">${stats.open}</div>
              <div class="admin-stat-label">Abertos</div>
            </div>
          </div>
          <div class="admin-stat stat-resolved">
            <i class="ti ti-circle-check admin-stat-icon"></i>
            <div class="admin-stat-info">
              <div class="admin-stat-value">${stats.resolvido}</div>
              <div class="admin-stat-label">Resolvidos</div>
            </div>
          </div>
          <div class="admin-stat stat-rate">
            <i class="ti ti-chart-pie admin-stat-icon"></i>
            <div class="admin-stat-info">
              <div class="admin-stat-value">${resolutionRate}%</div>
              <div class="admin-stat-label">Taxa Res.</div>
            </div>
          </div>
        </div>

        <div class="admin-section premium-section">
          <div class="admin-section-title"><i class="ti ti-flame"></i> Top 3 Bairros Críticos</div>
          <div class="admin-bairros-list">${topBairrosHtml || '<p style="color:rgba(255,255,255,0.4); font-size:0.8rem;">Sistema operando em normalidade.</p>'}</div>
        </div>

        <div class="admin-section premium-section">
          <div class="admin-section-title"><i class="ti ti-inbox"></i> Denúncias Recentes</div>
          <div class="admin-tickets-list">${ticketsHtml}</div>
        </div>

        <div class="admin-section premium-section">
          <div class="admin-section-title"><i class="ti ti-mail-fast"></i> Despacho Oficial (E-mail)</div>
          <p class="admin-section-desc">Consolida e envia a fila de prioridades para Instituições e Parlamentares.</p>
          <button class="btn btn-full admin-dispatch-btn" onclick="Admin.dispatchReport()">
            <i class="ti ti-send"></i> Executar Despacho em Lote
          </button>
          
          <div class="admin-recipients-section" style="margin-top:20px;">
            <div class="admin-section-title" style="font-size:0.8rem; color:rgba(255,255,255,0.6);"><i class="ti ti-building-bank"></i> Destinatários (Instituições)</div>
            <div class="admin-recipients-list">${recipientList}</div>
          </div>
        </div>
        
        <div class="admin-section premium-section">
          <div class="admin-section-title"><i class="ti ti-users"></i> Câmara de Vereadores</div>
          <details class="admin-vereadores-details" style="background: rgba(255,255,255,0.02); border-radius: 12px; padding: 12px; border: 1px solid rgba(255,255,255,0.05);">
            <summary class="btn btn-ghost" style="justify-content:space-between; list-style:none; cursor:pointer; width:100%; padding: 4px;">
              <span><i class="ti ti-list"></i> Ver Lista de Notificados</span>
              <i class="ti ti-chevron-down" style="font-size: 0.8rem;"></i>
            </summary>
            <div class="admin-vereadores-list" style="margin-top: 16px; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 16px;">${vereadorList}</div>
          </details>
        </div>

        <div class="admin-section premium-section">
          <div class="admin-section-title"><i class="ti ti-history"></i> Log de Despachos</div>
          <div class="admin-logs-table-wrap">
            <table class="mail-log-table">
              <thead>
                <tr><th>Data</th><th>Tks</th><th>Bairros Atingidos</th><th>St</th></tr>
              </thead>
              <tbody>${logsHtml || '<tr><td colspan="4" style="text-align:center; padding:12px;">Sem despachos</td></tr>'}</tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  },

  dispatchReport() {
    const stats = DB.getStats();
    const entityIds = DB.ENTITIES.filter((e) =>
      ['executivo', 'concessionaria'].includes(e.type)
    ).map((e) => e.id);
    DB.addMailLog({
      dispatchedAt: Date.now(),
      entityIds,
      vereadores: true,
      ticketCount: stats.total,
      criticalCount: stats.critical,
      topBairros: stats.topBairros.map((b) => b.name),
      status: 'sent',
      responseReceived: false,
    });
    Toast.show('success', 'Relatório despachado', 'E-mails enviados para todas as instituições e vereadores.');
    this.showDashboard();
  },
};

/* ============================================================
   10. SPLASH SCREEN
   ============================================================ */
function initSplash() {
  const splash = document.getElementById('splash-overlay');
  
  if (!splash) {
    if (!DB.isTutorialCompleted() && window.TutorialCtrl) TutorialCtrl.start();
    return;
  }

  setTimeout(() => {
    splash.style.transition = 'opacity 0.8s ease';
    splash.style.opacity = '0';
  }, 3500);
  
  setTimeout(() => {
    splash.remove();
    if (!DB.isTutorialCompleted() && window.TutorialCtrl) TutorialCtrl.start();
  }, 4500);
}

/* ============================================================
   11. NAVIGATION SETUP
   ============================================================ */
function setupNavigation() {
  SheetCtrl.initCloseButtons();

  document.getElementById('nav-ocorrencias')?.addEventListener('click', () => {
    const opened = SheetCtrl.toggle('ocorrencias');
    if (opened) {
      Feed.renderNearby(Feed.currentFilter);
      Feed.renderInstitutions();
    }
  });

  document.getElementById('nav-foto')?.addEventListener('click', () => {
    Report.start();
  });

  document.getElementById('nav-perfil')?.addEventListener('click', () => {
    const opened = SheetCtrl.toggle('perfil');
    if (opened) {
      ProfileCtrl.renderMyReports();
    }
  });

  document.getElementById('btn-admin-access')?.addEventListener('click', () => {
    SheetCtrl.close();
    Admin.open();
  });
}

// ============================================================
// AUTHENTICATION
// ============================================================
const AuthCtrl = {
  init() {
    this.isLoginMode = false;
    const btnReg = document.getElementById('btn-register');
    const btnToggle = document.getElementById('btn-toggle-login');
    const groupName = document.getElementById('group-name');
    const groupConfirm = document.getElementById('group-confirm');

    if (btnToggle) {
      btnToggle.addEventListener('click', () => {
        this.isLoginMode = !this.isLoginMode;
        if (this.isLoginMode) {
          if (groupName) groupName.style.display = 'none';
          if (groupConfirm) groupConfirm.style.display = 'none';
          if (btnReg) btnReg.textContent = 'Entrar';
          btnToggle.textContent = 'Não tem conta? Criar Conta';
        } else {
          if (groupName) groupName.style.display = 'block';
          if (groupConfirm) groupConfirm.style.display = 'block';
          if (btnReg) btnReg.textContent = 'Criar Conta';
          btnToggle.textContent = 'Já tem uma conta? Entrar';
        }
      });
    }

    if (btnReg) {
      btnReg.addEventListener('click', () => {
        if (this.isLoginMode) this.loginFlow();
        else this.register();
      });
    }
    const btnGovbr = document.getElementById('btn-govbr');
    if (btnGovbr) {
      btnGovbr.addEventListener('click', () => this.loginGovbr());
    }
  },

  async loginGovbr() {
    const name = "Cidadão Gov.br";
    const email = "govbr@simulated.local";
    await DB.createSession(name, email, "govbr123");
    SheetCtrl.close();
    ProfileCtrl.renderAuthSection();
    Toast.show('success', 'Gov.br Conectado!', 'Identidade validada. Suas denúncias terão prioridade governamental e seu nome permanece anônimo para o público.');
  },

  async loginFlow() {
    const email = document.getElementById('reg-email').value.trim();
    const pass = document.getElementById('reg-pass').value;

    if (!email || !pass) {
      Toast.show('error', 'Erro', 'Preencha todos os campos.');
      return;
    }

    Toast.show('info', 'Autenticando...', 'Conectando ao servidor...', 2000);
    const session = await DB.login(email, pass);
    
    if (session) {
      SheetCtrl.close();
      ProfileCtrl.renderAuthSection();
      Toast.show('success', 'Sucesso', 'Bem-vindo de volta ao Avante!');
      document.getElementById('reg-email').value = '';
      document.getElementById('reg-pass').value = '';
      setTimeout(() => window.location.reload(), 1000);
    }
  },

  async register() {
    const name = document.getElementById('reg-name').value.trim();
    const email = document.getElementById('reg-email').value.trim();
    const pass = document.getElementById('reg-pass').value;
    const confirm = document.getElementById('reg-pass-confirm').value;

    if (!name || !email || !pass) {
      Toast.show('error', 'Campos Inválidos', 'Preencha todos os campos.');
      return;
    }
    if (pass !== confirm) {
      Toast.show('error', 'Senhas Diferentes', 'As senhas não conferem.');
      return;
    }
    if (pass.length < 6) {
      Toast.show('error', 'Senha Curta', 'A senha deve ter no mínimo 6 caracteres.');
      return;
    }

    Toast.show('info', 'Registrando...', 'Criando sua conta na nuvem...', 2000);
    const session = await DB.createSession(name, email, pass);
    
    if (session) {
      SheetCtrl.close();
      ProfileCtrl.renderAuthSection();
      Toast.show('success', 'Conta Criada!', `Sua conta foi criada com sucesso!`);
      
      document.getElementById('reg-name').value = '';
      document.getElementById('reg-email').value = '';
      document.getElementById('reg-pass').value = '';
      document.getElementById('reg-pass-confirm').value = '';
    }
  },

  logout() {
    DB.logout();
    ProfileCtrl.renderAuthSection();
    Toast.show('info', 'Desconectado', 'Sua conta foi desvinculada do dispositivo.');
  }
};

/* ============================================================
   13. INITIALIZATION
   ============================================================ */
try {
// ===== ORIGINAL APP.JS CONTENT START =====
document.addEventListener('DOMContentLoaded', () => {
  try {
    Toast.init();
    Modal.init();
    
    DB.init();
    
    window.addEventListener('db_ready', () => {
       MapCtrl.init();
       if (typeof Feed !== 'undefined') Feed.init();
       else if (typeof FeedCtrl !== 'undefined') FeedCtrl.init();
       
       ProfileCtrl.init();
       
       if (typeof Report !== 'undefined') Report.init();
       if (typeof AuthCtrl !== 'undefined') AuthCtrl.init();
       if (typeof setupNavigation === 'function') setupNavigation();
       
       if (!DB.isTutorialCompleted() && window.TutorialCtrl) TutorialCtrl.start();
    });
    
    window.addEventListener('db_synced', () => {
       MapCtrl.renderMarkers();
       if (typeof Feed !== 'undefined') Feed.renderNearby(Feed.currentFilter);
       
       ProfileCtrl.renderMyReports();
    });
  } catch (e) {
    console.error('Initialization error:', e);
  } finally {
    if (typeof initSplash === 'function') initSplash();
  }
});

/* ============================================================
   14. EXPOSE GLOBALS FOR INLINE HANDLERS
   ============================================================ */
window.showIncidentPopup = showIncidentPopup;
window.closeIncidentPopup = closeIncidentPopup;
window.handlePopupSupport = handlePopupSupport;
window.handleFeedSupport = handleFeedSupport;
window.Report = Report;
window.Admin = Admin;
window.Modal = Modal;
window.SheetCtrl = SheetCtrl;
window.MapCtrl = MapCtrl;
window.Feed = Feed;
window.ProfileCtrl = ProfileCtrl;
window.Toast = Toast;
// ===== ORIGINAL APP.JS CONTENT END =====
} catch (e) {
  alert("RUNTIME ERROR IN APP.JS: " + e.message + "\n" + e.stack);
}
