/**
 * AVANTE SANTA MARIA — Database & Store
 * Supabase Cloud Implementation with Local Memory Cache
 */

const DB = (() => {
  // Constants
  const STATUS = { ANALISE: 'analise', ANDAMENTO: 'andamento', RESOLVIDO: 'resolvido' };
  const STATUS_LABELS = { analise: 'Enviado para Análise', andamento: 'Em Andamento', resolvido: 'Resolvido' };
  const STATUS_COLORS = { analise: '#F9D746', andamento: '#64B5F6', resolvido: '#66BB6A' };

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
  let _tickets = [];
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

  async function syncTickets() {
    try {
      const { data, error } = await window.supabaseClient
        .from('reports')
        .select('*, profiles(nickname)')
        .order('created_at', { ascending: false });

      if (data && !error) {
        _tickets = data.map(r => {
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
            lat: lat,
            lng: lng,
            address: r.address,
            status: r.status,
            image_url: r.image_url,
            isCritical: r.is_critical,
            supporters: r.supporters_count,
            createdAt: new Date(r.created_at).getTime(),
            userId: r.user_id,
            nickname: r.profiles?.nickname || 'Cidadão',
          };
        });
        window.dispatchEvent(new Event('db_synced'));
      }
    } catch (err) {
      console.error("Erro no syncTickets:", err);
    }
  }

  function getTickets() {
    return _tickets;
  }

  async function createTicket(data) {
    if (!_session) {
      Toast.show('error', 'Acesso negado', 'Você precisa estar logado para reportar.');
      return;
    }

    const { data: inserted, error } = await window.supabaseClient.from('reports').insert([{
      user_id: _session.user.id,
      category_id: data.categoryId,
      description: data.description,
      location: `POINT(${data.lng} ${data.lat})`,
      address: data.address,
      status: STATUS.ANALISE,
      image_url: data.photoData
    }]).select().single();

    if (error) {
      Toast.show('error', 'Erro', 'Falha ao salvar denúncia.');
      console.error(error);
      return null;
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
    await syncTickets();
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
      isGovVerified: _profile?.role === 'institution'
    };
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

  // Mock Moderation (we keep it simple for now)
  function moderateText(text) { return []; }
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
    const analise = _tickets.filter(t => t.status === STATUS.ANALISE).length;
    const andamento = _tickets.filter(t => t.status === STATUS.ANDAMENTO).length;
    const resolvido = _tickets.filter(t => t.status === STATUS.RESOLVIDO).length;
    return { total: _tickets.length, open: analise + andamento, analise, andamento, resolvido, critical: 0, topBairros: [] };
  }

  function getEntitiesRanked() { return ENTITIES; }
  function getEntityById(id) { return ENTITIES.find(e => e.id === id); }
  function getCategoryById(id) { return CATEGORIES.find(c => c.id === id); }

  return {
    init,
    STATUS, STATUS_LABELS, STATUS_COLORS,
    CATEGORIES, ENTITIES, VEREADORES,
    getSession, createSession, login, logout,
    getDeviceId: () => 'dev',
    getPrefs, savePrefs,
    getTickets, createTicket, supportTicket, isSupported, updateTicketStatus,
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
