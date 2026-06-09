/**
 * AVANTE SANTA MARIA — Database & Store
 * Supabase Cloud Implementation with Local Memory Cache
 */

const DB = (() => {
  // Constants
  const STATUS = { ANALISE: 'analise', ANDAMENTO: 'andamento', RESOLVIDO: 'resolvido', REJEITADO: 'rejeitado' };
  const STATUS_LABELS = { analise: 'Enviado para Análise', andamento: 'Em Andamento', resolvido: 'Resolvido', rejeitado: 'Rejeitado' };
  const STATUS_COLORS = { analise: '#F9D746', andamento: '#64B5F6', resolvido: '#66BB6A', rejeitado: '#EF5350' };

  const CATEGORIES = [
    { id: 1, name: 'Água e Saneamento', icon: 'ti-droplet', color: '#64B5F6', entityIds: ['corsan'] },
    { id: 2, name: 'Vias e Calçadas', icon: 'ti-road', color: '#B0BEC5', entityIds: ['smim'] },
    { id: 3, name: 'Limpeza Urbana', icon: 'ti-trash', color: '#66BB6A', entityIds: ['sustentare', 'smim'] },
    { id: 4, name: 'Energia e Iluminação', icon: 'ti-bolt', color: '#F9D746', entityIds: ['rge', 'prefeitura'] },
    { id: 5, name: 'Telecomunicações', icon: 'ti-antenna-bars-5', color: '#E040FB', entityIds: ['telecom'] },
    { id: 6, name: 'Transporte Público', icon: 'ti-bus', color: '#FF8A65', entityIds: ['sim_atu'] },
    { id: 7, name: 'Trânsito e Sinalização', icon: 'ti-traffic-lights', color: '#EF5350', entityIds: ['smtu'] },
    { id: 8, name: 'Ordem Pública', icon: 'ti-shield', color: '#8C9EFF', entityIds: ['gm', 'bm'] },
    { id: 9, name: 'Animais e Meio Ambiente', icon: 'ti-paw', color: '#8BC34A', entityIds: ['meioambiente'] },
  ];

  const ENTITIES = [
    { id: 'prefeitura', name: 'Prefeitura Municipal', type: 'executivo', icon: 'ti-building-estate', openTickets: 89, resolvedTickets: 34 },
    { id: 'smim', name: 'SMIM — Infraestrutura', type: 'executivo', icon: 'ti-backhoe', openTickets: 67, resolvedTickets: 18 },
    { id: 'smtu', name: 'SMTU / DMT — Mobilidade', type: 'executivo', icon: 'ti-traffic-lights', openTickets: 41, resolvedTickets: 29 },
    { id: 'meioambiente', name: 'Secretaria de Meio Ambiente', type: 'executivo', icon: 'ti-plant', openTickets: 22, resolvedTickets: 31 },
    { id: 'corsan', name: 'CORSAN — Água e Esgoto', type: 'concessionaria', icon: 'ti-droplet', openTickets: 54, resolvedTickets: 12 },
    { id: 'rge', name: 'RGE / CPFL — Energia', type: 'concessionaria', icon: 'ti-bolt', openTickets: 31, resolvedTickets: 44 },
    { id: 'sustentare', name: 'Sustentare — Limpeza Urbana', type: 'concessionaria', icon: 'ti-trash', openTickets: 78, resolvedTickets: 8 },
    { id: 'sim_atu', name: 'Consórcio SIM / ATU', type: 'concessionaria', icon: 'ti-bus', openTickets: 45, resolvedTickets: 22 },
    { id: 'telecom', name: 'Operadoras de Telecom', type: 'concessionaria', icon: 'ti-antenna-bars-5', openTickets: 33, resolvedTickets: 9 },
    { id: 'gm', name: 'Guarda Municipal', type: 'seguranca', icon: 'ti-shield-check', openTickets: 19, resolvedTickets: 28 },
    { id: 'bm', name: 'Brigada Militar', type: 'seguranca', icon: 'ti-shield', openTickets: 15, resolvedTickets: 32 },
  ];

  const VEREADORES = []; // Omitindo para economizar espaco, não afeta funcionamento

  // Local Memory Cache
  let _tickets = [];   // denúncias aprovadas (mapa/feed público)
  let _allTickets = []; // todas as denúncias (painel admin)
  let _session = null;
  let _profile = null;
  const MY_SUPPORTED = JSON.parse(localStorage.getItem('avante_supported') || '[]');

  // Initialization
  async function init() {
    try {
      window.supabaseClient.auth.onAuthStateChange((event, session) => {
        _session = session;
        if (session) {
          fetchProfile(session.user.id);
        } else {
          _profile = null;
        }
      });

      const { data } = await window.supabaseClient.auth.getSession();
      _session = data?.session;
      if (_session) await fetchProfile(_session.user.id);

      await syncTickets();
    } catch (e) {
      console.error("Critical DB initialization error:", e);
    } finally {
      window.dispatchEvent(new Event('db_ready'));
    }
  }

  async function fetchProfile(userId) {
    const { data } = await window.supabaseClient.from('profiles').select('*').eq('id', userId).single();
    if (data) _profile = data;
  }

  function mapReport(r) {
    let lat = 0, lng = 0;
    if (r.location) {
      if (typeof r.location === 'string') {
        const coords = r.location.match(/POINT\(([^ ]+) ([^ ]+)\)/);
        if (coords) { lng = parseFloat(coords[1]); lat = parseFloat(coords[2]); }
      } else if (r.location.coordinates) {
        lng = r.location.coordinates[0];
        lat = r.location.coordinates[1];
      }
    }
    return {
      id: r.id,
      categoryId: r.category_id,
      description: r.description,
      lat, lng,
      address: r.address,
      status: r.status,
      image_url: r.image_url,
      isCritical: r.is_critical,
      supporters: r.supporters_count,
      createdAt: new Date(r.created_at).getTime(),
      userId: r.user_id,
      nickname: r.profiles?.nickname || 'Cidadão',
    };
  }

  async function syncTickets(silent = false) {
    try {
      // Busca TODAS as denúncias para o painel admin
      const { data: allData } = await window.supabaseClient
        .from('reports')
        .select('*, profiles(nickname)')
        .order('created_at', { ascending: false });

      if (allData) _allTickets = allData.map(mapReport);

      // Busca só as aprovadas (em andamento ou resolvidas) para o mapa/feed público
      const { data, error } = await window.supabaseClient
        .from('reports')
        .select('*, profiles(nickname)')
        .in('status', ['andamento', 'resolvido'])
        .order('created_at', { ascending: false });

      if (data && !error) {
        _tickets = data.map(mapReport);
        if (!silent) window.dispatchEvent(new Event('db_synced'));
      }
    } catch (err) {
      console.error("Erro no syncTickets:", err);
    }
  }

  function getTickets() { return _tickets; }
  function getAllTickets() { return _allTickets; }

  // ─── FILA OFFLINE ───────────────────────────────────────────
  // Denúncias capturadas sem internet ficam salvas localmente
  // e são reenviadas automaticamente quando a conexão volta.
  const OFFLINE_KEY = 'avante_offline_queue';

  function getOfflineQueue() {
    return JSON.parse(localStorage.getItem(OFFLINE_KEY) || '[]');
  }

  function saveOfflineQueue(queue) {
    localStorage.setItem(OFFLINE_KEY, JSON.stringify(queue));
    window.dispatchEvent(new Event('offline_queue_changed'));
  }

  function addToOfflineQueue(data) {
    const queue = getOfflineQueue();
    queue.push({
      ...data,
      offlineId: 'off_' + Date.now() + '_' + Math.random().toString(36).substring(7),
      capturedAt: Date.now(),
    });
    saveOfflineQueue(queue);
  }

  function getOfflineCount() {
    return getOfflineQueue().length;
  }

  // Tenta reenviar todas as denúncias pendentes
  async function processOfflineQueue() {
    if (!navigator.onLine || !_session) return;
    const queue = getOfflineQueue();
    if (queue.length === 0) return;

    let remaining = [];
    let enviadas = 0;

    for (const item of queue) {
      const result = await _insertReport(item);
      if (result) {
        enviadas++;
      } else {
        remaining.push(item); // falhou, mantém na fila
      }
    }

    saveOfflineQueue(remaining);
    if (enviadas > 0) {
      Toast.show('success', 'Denúncias enviadas', `${enviadas} denúncia(s) pendente(s) foram enviadas com sucesso.`);
      await syncTickets();
    }
  }

  // Faz o insert puro no Supabase (usado online e no reenvio offline)
  async function _insertReport(data) {
    if (!_session) return null;
    try {
      let imageUrl = data.photoData;
      // Se a imagem ainda é base64 (capturada offline), faz upload agora
      if (imageUrl && imageUrl.startsWith('data:image')) {
        const res = await fetch(imageUrl);
        const blob = await res.blob();
        const fileName = `incident_${Date.now()}_${Math.random().toString(36).substring(7)}.jpg`;
        const { error: upErr } = await window.supabaseClient.storage
          .from('report_images').upload(fileName, blob, { contentType: 'image/jpeg' });
        if (!upErr) {
          const { data: urlData } = window.supabaseClient.storage
            .from('report_images').getPublicUrl(fileName);
          imageUrl = urlData.publicUrl;
        }
      }

      const { data: inserted, error } = await window.supabaseClient.from('reports').insert([{
        user_id: _session.user.id,
        category_id: data.categoryId,
        description: data.description,
        location: `POINT(${data.lng} ${data.lat})`,
        address: data.address,
        status: STATUS.ANALISE,
        image_url: imageUrl
      }]).select().single();

      if (error) { console.error('Insert error:', error); return null; }
      return inserted;
    } catch (e) {
      console.error('Erro no _insertReport:', e);
      return null;
    }
  }

  async function createTicket(data) {
    if (!_session) {
      Toast.show('error', 'Acesso negado', 'Você precisa estar logado para reportar.');
      return;
    }

    // Sem internet: salva na fila offline para reenvio automático depois
    if (!navigator.onLine) {
      addToOfflineQueue(data);
      Toast.show('info', 'Salvo offline', 'Sem conexão. A denúncia foi salva e será enviada automaticamente quando a internet voltar.');
      return { offline: true };
    }

    const inserted = await _insertReport(data);
    if (!inserted) {
      // Falhou online (pode ter caído a conexão no meio): salva offline
      addToOfflineQueue(data);
      Toast.show('warning', 'Salvo offline', 'Não foi possível enviar agora. A denúncia será reenviada automaticamente.');
      return { offline: true };
    }

    await syncTickets();
    return inserted;
  }

  async function updateTicketStatus(id, newStatus) {
    const { error } = await window.supabaseClient.from('reports').update({ status: newStatus }).eq('id', id);
    if (error) {
      Toast.show('error', 'Erro', 'Falha ao atualizar status.');
      console.error(error);
      return false;
    }
    await syncTickets(true); // silent: app.js controla o re-render manualmente
    return true;
  }

  async function deleteTicket(id) {
    const { error } = await window.supabaseClient.from('reports').delete().eq('id', id);
    if (error) {
      Toast.show('error', 'Erro', 'Falha ao excluir denúncia.');
      console.error(error);
      return false;
    }
    await syncTickets(true);
    return true;
  }

  async function supportTicket(ticketId) {
    if (isSupported(ticketId)) return;
    if (!_session) return; // Supabase RLS exigiria auth

    // RPC atômica — evita race condition ao incrementar o contador
    const ticket = _tickets.find(t => t.id === ticketId);
    if(ticket) {
       const { error } = await window.supabaseClient.rpc('increment_supporters', { ticket_id: ticketId });
       if (!error) {
         MY_SUPPORTED.push(ticketId);
         localStorage.setItem('avante_supported', JSON.stringify(MY_SUPPORTED));
         await syncTickets();
       }
    }
  }

  function isSupported(ticketId) {
    return MY_SUPPORTED.includes(ticketId);
  }

  // Session
  function getSession() {
    if (!_session) return null;
    return {
      nickname: _profile?.nickname || 'Cidadão',
      email: _session.user.email,
      isGovVerified: _profile?.role === 'institution' || _profile?.role === 'admin'
    };
  }

  function isAdmin() {
    return _profile?.role === 'admin' || _profile?.role === 'institution';
  }

  async function createSession(name, email, password) {
    const { data, error } = await window.supabaseClient.auth.signUp({
      email, password
    });
    if (error) {
      Toast.show('error', 'Erro no Cadastro', error.message);
      return null;
    }
    return data;
  }

  async function login(email, password) {
    const { data, error } = await window.supabaseClient.auth.signInWithPassword({
      email, password
    });
    if (error) {
      Toast.show('error', 'Erro no Login', error.message);
      return null;
    }
    return data;
  }

  async function logout() {
    await window.supabaseClient.auth.signOut();
    _profile = null;
    window.location.reload();
  }

  function getDistance(lat1, lng1, lat2, lng2) {
    const R = 6371000;
    const p1 = lat1 * Math.PI / 180;
    const p2 = lat2 * Math.PI / 180;
    const dp = (lat2 - lat1) * Math.PI / 180;
    const dl = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dp/2)**2 + Math.cos(p1)*Math.cos(p2)*Math.sin(dl/2)**2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  }

  function getTicketsByDistance(userLat, userLng) {
    return _tickets
      .map(t => ({ ...t, distance: getDistance(userLat, userLng, t.lat, t.lng) }))
      .sort((a, b) => a.distance - b.distance);
  }

  function getMyTickets() {
    if (!_session) return [];
    return _tickets.filter(t => t.userId === _session.user.id);
  }

  // Moderação de texto — raízes de termos ofensivos (pega variações)
  const BLOCKED_WORDS = [
    'buceta', 'boceta', 'caralho', 'carai', 'cacete', 'porra', 'merda', 'bosta', 'cu', 'cuzao',
    'cuzudo', 'foda', 'foder', 'fudido', 'fudida', 'fdp', 'filhadaputa', 'filhodaputa', 'fidegua', 'fidumaegua',
    'puta', 'putaria', 'putona', 'piranha', 'piriguete', 'vagabunda', 'vagabundo', 'vadia', 'rapariga', 'quenga',
    'meretriz', 'prostituta', 'biscate', 'cadela', 'cadelona', 'galinha', 'periquita', 'pau', 'piroca', 'rola',
    'pinto', 'pênis', 'penis', 'caceta', 'pica', 'brocha', 'xoxota', 'xereca', 'xavasca', 'ppk',
    'perereca', 'boquete', 'boqueteiro', 'punheta', 'viado', 'viadinho', 'baitola', 'bicha', 'biba', 'sapatao',
    'traveco', 'corno', 'chifrudo', 'arrombado', 'escroto', 'babaca', 'otario', 'otaria', 'imbecil', 'idiota',
    'retardado', 'debil', 'debilmente', 'mongol', 'mongoloide', 'tarado', 'tarada', 'safado', 'safada', 'desgracado',
    'desgracada', 'maldito', 'maldita', 'nojento', 'nojenta', 'lixo', 'verme', 'escoria', 'vaitomarnocu', 'vaisefuder',
    'vsf', 'vtnc', 'pqp', 'krl', 'caralhuuu', 'nazista', 'racista', 'macaco', 'crioulo', 'preto',
    'negro', 'favelado', 'mortodefome', 'estupido', 'estupida', 'burro', 'burra', 'jumento', 'jegue', 'jacu',
    'trouxa', 'panaca', 'mane', 'lazarento', 'leproso', 'tapado', 'tosco', 'mocorongo', 'energumeno', 'troglodita',
    'quasimodo', 'esporrado', 'gozada', 'gozado', 'tesao', 'tetuda', 'tetudo', 'nude', 'pelada', 'pelado',
    'nudez', 'sexo', 'transar', 'gemido', 'masturba', 'siririca', 'punhetar'
  ];

  // Palavras seguras que contêm raízes bloqueadas (evita falso positivo)
  const SAFE_EXCEPTIONS = ['concurso', 'curso', 'cura', 'curativo', 'document', 'circ', 'percurso', 'escuro', 'obscuro', 'curva', 'curral', 'acude', 'pauta', 'paulo', 'paulista', 'pausa', 'espelho', 'rolar', 'controle', 'patota', 'buraco', 'esburacada', 'esburacado', 'buracos', 'apurado', 'apuracao', 'maduro', 'duro', 'rua', 'grupo', 'capacete', 'pacote'];

  // Normaliza leetspeak e ofuscações: b0c3t4 -> boceta, c@ralho -> caralho
  function normalizeLeet(text) {
    let t = text.toLowerCase();
    // Remove acentos
    t = t.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    // Substitui números/símbolos por letras equivalentes
    const map = { '0':'o', '1':'i', '3':'e', '4':'a', '5':'s', '7':'t', '8':'b', '@':'a', '$':'s', '!':'i', '|':'i', '€':'e', '(':'c' };
    t = t.replace(/[013457 8@$!|€(]/g, c => map[c] || c);
    // Remove caracteres não-alfabéticos (separadores como . - _ *)
    t = t.replace(/[^a-z]/g, '');
    // Colapsa letras repetidas: caralhooo -> caralho, p u t a -> puta
    t = t.replace(/(.)\1+/g, '$1');
    return t;
  }

  // Normaliza SEM colapsar repetidas (para palavras curtas, mais preciso)
  function normalizeNoCollapse(text) {
    let t = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const map = { '0':'o', '1':'i', '3':'e', '4':'a', '5':'s', '7':'t', '8':'b', '@':'a', '$':'s', '!':'i', '|':'i', '€':'e', '(':'c' };
    t = t.replace(/[013457 8@$!|€(]/g, c => map[c] || c);
    return t.replace(/[^a-z]/g, '');
  }

  function moderateText(text) {
    if (!text) return [];
    const original = text.toLowerCase();
    const normCollapsed = normalizeLeet(text);     // com colapso (pega "caralhooo")
    const normPlain = normalizeNoCollapse(text);    // sem colapso (preciso)
    const found = [];

    BLOCKED_WORDS.forEach(word => {
      const wPlain = normalizeNoCollapse(word);
      const wCollapsed = normalizeLeet(word);

      // Não marca se faz parte de palavra segura
      const isSafe = SAFE_EXCEPTIONS.some(safe => {
        const s = normalizeNoCollapse(safe);
        return s.includes(wPlain) || wPlain.includes(s) && s.length >= 4;
      });
      if (isSafe) return;

      if (wPlain.length <= 2) {
        // Palavras de 1-2 letras (ex: "cu"): exige palavra inteira no texto original
        const regex = new RegExp('\\b' + word + '\\b', 'i');
        if (regex.test(original)) found.push(word);
      } else if (wPlain.length <= 5) {
        // Palavras curtas: usa versão SEM colapso para evitar falsos positivos
        if (normPlain.includes(wPlain)) found.push(word);
      } else {
        // Palavras longas: pode usar colapso (pega repetições)
        if (normPlain.includes(wPlain) || normCollapsed.includes(wCollapsed)) found.push(word);
      }
    });
    return [...new Set(found)];
  }
  function isBanned() { return false; }

  // Preferences
  function getPrefs() { return JSON.parse(localStorage.getItem('avante_prefs') || '{}'); }
  function savePrefs(p) { localStorage.setItem('avante_prefs', JSON.stringify(p)); }

  // Mock Mail
  function getMailLogs() { return JSON.parse(localStorage.getItem('avante_mail_logs') || '[]'); }
  function addMailLog(log) {
    let logs = getMailLogs();
    logs.unshift(log);
    localStorage.setItem('avante_mail_logs', JSON.stringify(logs));
  }

  function getStats() {
    const analise = _allTickets.filter(t => t.status === STATUS.ANALISE).length;
    const andamento = _allTickets.filter(t => t.status === STATUS.ANDAMENTO).length;
    const resolvido = _allTickets.filter(t => t.status === STATUS.RESOLVIDO).length;
    return { total: _allTickets.length, open: analise + andamento, analise, andamento, resolvido, critical: 0, topBairros: [] };
  }

  function getEntitiesRanked() { return ENTITIES; }
  function getEntityById(id) { return ENTITIES.find(e => e.id === id); }
  function getCategoryById(id) { return CATEGORIES.find(c => c.id === id); }

  return {
    init,
    STATUS, STATUS_LABELS, STATUS_COLORS,
    CATEGORIES, ENTITIES, VEREADORES,
    getSession, isAdmin, createSession, login, logout,
    getDeviceId: () => 'dev',
    getPrefs, savePrefs,
    syncTickets, getTickets, getAllTickets, createTicket, supportTicket, isSupported, updateTicketStatus, deleteTicket,
    getOfflineCount, processOfflineQueue, getOfflineQueue,
    getTicketsByDistance, getMyTickets,
    getMailLogs, getMailDispatchCount: () => 0,
    moderateText, isBanned,
    getDistance,
    getStats, getEntitiesRanked, getEntityById, getCategoryById,
    isTutorialCompleted: () => localStorage.getItem('avante_tutorial') === 'true',
    completeTutorial: () => localStorage.setItem('avante_tutorial', 'true'),
    addMailLog
  };
})();
