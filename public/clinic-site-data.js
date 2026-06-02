/* ================================================================
   Связь сайта с Lovable Cloud — загрузка и рендеринг всех разделов.
   Подключается после CDN supabase-js, до закрывающего </body>.
   ================================================================ */
(function () {
  'use strict';

  var SUPABASE_URL = 'https://dbbtsazfhhmldleadczl.supabase.co';
  var SUPABASE_PUBLISHABLE_KEY =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRiYnRzYXpmaGhtbGRsZWFkY3psIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAxMzU4MjcsImV4cCI6MjA5NTcxMTgyN30.3FiFx12EYMH_G4ObWDA0-jGjVCsunKAHN9oHqNPdQac';

  if (!window.supabase || !window.supabase.createClient) {
    console.error('[site] supabase-js не загрузился');
    return;
  }
  var sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

  // ---------- утилиты ----------
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }
  function escAttr(s) { return esc(s); }
  function escJs(s) {
    return String(s == null ? '' : s).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, ' ').replace(/\r/g, '');
  }
  function hideSection(id) {
    var el = document.getElementById(id);
    if (el) el.style.display = 'none';
  }
  function refreshIcons() {
    if (window.lucide && typeof window.lucide.createIcons === 'function') {
      try { window.lucide.createIcons(); } catch (_) {}
    }
  }

  // ---------- HERO: интерьер + тексты ----------
  function renderHero(interior, mainTexts) {
    var imgs = (interior || []).map(function (r) { return r.image_url; }).filter(Boolean);
    if (imgs.length > 0) {
      window.heroSlidesData = imgs;
      // прокидываем формат, который ожидает существующий initHeroSlider
      try {
        var legacy = { interior: imgs.map(function (u) { return { img: u }; }) };
        localStorage.setItem('dbMainPage', JSON.stringify(legacy));
      } catch (_) {}
      if (typeof window.renderHeroSlider === 'function') {
        window.currentHeroSlide = 0;
        window.renderHeroSlider();
      }
    }
    if (mainTexts && mainTexts.hero) {
      var titleEl = document.querySelector('#view-home h1.font-serif');
      if (titleEl && mainTexts.hero.title) {
        var lines = String(mainTexts.hero.title).split('\n').filter(Boolean);
        if (lines.length >= 3) {
          titleEl.innerHTML = esc(lines[0]) + '<br><span class="text-[#746258] italic font-light tracking-normal">' + esc(lines[1]) + '</span><br>' + esc(lines.slice(2).join(' '));
        } else if (lines.length) {
          titleEl.textContent = lines.join(' ');
        }
      }
      var badgeEl = document.querySelector('#view-home .inline-flex[onclick*="about"]');
      if (badgeEl && mainTexts.hero.subtitle) {
        // оставляем иконку, заменяем только текст после неё
        var icon = badgeEl.querySelector('i');
        badgeEl.innerHTML = (icon ? icon.outerHTML : '') + ' ' + esc(mainTexts.hero.subtitle);
        refreshIcons();
      }
    }
  }

  // ---------- АКЦИИ ----------
  function renderPromos(rows) {
    var host = document.getElementById('home-promos-container');
    if (!host) return;
    if (!rows || !rows.length) { hideSection('promotions'); return; }
    host.innerHTML = rows.map(function (p) {
      var img = p.image_url || 'https://images.unsplash.com/photo-1515377905703-c4788e51af15?auto=format&fit=crop&q=80&w=800';
      var titleEsc = esc(p.title || '');
      var descEsc = esc(p.description || '');
      var bookLabel = 'Акция: ' + (p.title || '');
      return '<div onclick="openBooking(\'' + escJs(bookLabel) + '\')" class="relative flex-shrink-0 w-[85vw] sm:w-[350px] lg:w-[380px] xl:w-[400px] aspect-[4/5] sm:aspect-[4/3] lg:aspect-[4/3] rounded-[2rem] overflow-hidden group snap-center cursor-pointer shadow-sm hover:shadow-[0_20px_40px_rgb(0,0,0,0.08)] active:scale-[0.98] transition-all duration-500">' +
        '<img src="' + escAttr(img) + '" alt="' + titleEsc + '" class="w-full h-full object-cover transition-transform duration-[2s] group-hover:scale-105">' +
        '<div class="absolute inset-0 bg-gradient-to-t from-[#1A1817]/95 via-[#1A1817]/40 to-transparent flex flex-col justify-end p-6 lg:p-8">' +
        '<h3 class="text-white font-serif text-2xl lg:text-3xl mb-2 tracking-tight">' + titleEsc + '</h3>' +
        (descEsc ? '<p class="text-white/90 text-sm lg:text-base font-light leading-relaxed mb-6">' + descEsc + '</p>' : '') +
        '<button class="w-max bg-white/20 backdrop-blur-md text-white border border-white/40 px-6 py-2.5 rounded-full text-xs uppercase tracking-widest font-semibold hover:bg-white hover:text-[#746258] transition-all duration-300">Записаться</button>' +
        '</div></div>';
    }).join('');
  }

  // ---------- НАПРАВЛЕНИЯ + ПРОЦЕДУРЫ ----------
  function renderCategoriesAndProcedures(cats, procs) {
    if (!cats || !cats.length) {
      hideSection('services');
      window.DB = window.DB || {};
      window.DB.categories = {};
      window.DB.procedures = {};
      return;
    }
    var catMap = {};
    var procMap = {};
    cats.forEach(function (c) {
      catMap[c.id] = {
        title: c.name || '',
        desc: c.description || '',
        img: c.image_url || 'https://images.unsplash.com/photo-1616394584738-fc6e612e71b9?auto=format&fit=crop&q=80&w=1600',
        procedures: []
      };
    });
    (procs || []).forEach(function (p) {
      if (!p.category_id || !catMap[p.category_id]) return;
      var content = p.content && typeof p.content === 'object' ? p.content : {};
      var howRaw = Array.isArray(content.howItWorks) ? content.howItWorks : [];
      var probRaw = Array.isArray(content.problems) ? content.problems : [];
      var pricesRaw = Array.isArray(content.prices) ? content.prices : [];
      procMap[p.id] = {
        categoryId: p.category_id,
        title: p.name || '',
        priceText: p.price || '',
        img: p.image_url || 'https://images.unsplash.com/photo-1616394584738-fc6e612e71b9?auto=format&fit=crop&q=80&w=800',
        desc: p.description || '',
        howItWorks: howRaw.length ? howRaw : [{ q: 'Описание', a: p.description || 'Подробности уточняйте на консультации.' }],
        problems: probRaw.length ? probRaw : [{ q: 'Подробности', a: 'Уточните у врача на консультации.' }],
        prices: pricesRaw.length ? pricesRaw : (p.price ? [{ name: p.name, vol: '—', time: '—', cost: p.price }] : [])
      };
      catMap[p.category_id].procedures.push(p.id);
    });
    window.DB = window.DB || {};
    window.DB.categories = catMap;
    window.DB.procedures = procMap;
    if (typeof window.initHomeCategories === 'function') window.initHomeCategories();
    refreshIcons();
  }

  // ---------- КОМАНДА ----------
  function renderSpecialists(rows) {
    var carousel = document.getElementById('team-carousel');
    if (!carousel) return;
    if (!rows || !rows.length) { hideSection('team'); return; }
    var inner = carousel.querySelector('div');
    if (!inner) return;
    inner.innerHTML = rows.map(function (d) {
      var name = esc(d.name || '');
      var role = esc(d.position || 'Врач-косметолог');
      var bio = esc(d.description || '');
      var img = d.photo_url || 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&q=80&w=600';
      var bioLine = bio || 'Подробности уточняйте на консультации.';
      var args = "'" + escJs(d.name || '') + "','" + escJs(d.position || '') + "','" + escJs(bio) + "','" + escJs(bio) + "','" + escJs(img) + "'";
      return '<div class="relative flex-shrink-0 w-[85vw] sm:w-[320px] lg:w-[280px] flex flex-col items-center group h-full snap-center bg-[#FDFBF9] rounded-[2.5rem] p-6 shadow-sm hover:shadow-[0_15px_35px_rgb(0,0,0,0.06)] border border-[#D0C0B1]/20 transition-all duration-500">' +
        '<div class="w-48 h-48 rounded-full overflow-hidden mb-6 border-[4px] border-white shadow-md group-hover:border-[#D0C0B1]/50 transition-all duration-500 relative flex-shrink-0">' +
        '<img src="' + escAttr(img) + '" class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 ease-out" alt="' + name + '">' +
        '</div>' +
        '<h3 class="font-serif text-2xl text-[#2A2522] mb-1 text-center">' + name + '</h3>' +
        '<p class="text-[10px] text-[#746258] uppercase tracking-[0.2em] font-bold mb-5 text-center">' + role + '</p>' +
        '<div class="w-full text-left border-t border-[#D0C0B1]/30 pt-4 mb-6 mt-auto">' +
        '<p class="text-[9px] uppercase tracking-widest text-gray-400 font-semibold mb-1">О враче</p>' +
        '<p class="text-[11px] text-gray-500 leading-relaxed font-light line-clamp-3">' + esc(bioLine) + '</p>' +
        '</div>' +
        '<button onclick="openDoctor(' + args + ')" class="w-full bg-[#746258] text-white px-5 py-3 rounded-full text-xs uppercase tracking-widest font-bold hover:bg-[#5A4C44] active:scale-95 transition-all shadow-md">Профиль</button>' +
        '</div>';
    }).join('');
  }

  // ---------- ОТЗЫВЫ ----------
  function renderReviews(rows) {
    var host = document.getElementById('home-reviews-container');
    if (!host) return;
    if (!rows || !rows.length) { hideSection('reviews'); return; }
    host.innerHTML = rows.map(function (r) {
      var rating = Math.max(0, Math.min(5, parseInt(r.rating, 10) || 5));
      var stars = '';
      for (var i = 0; i < rating; i++) stars += '<i data-lucide="star" class="w-4 h-4 fill-current"></i>';
      return '<div class="bg-white p-8 rounded-[2.5rem] border border-[#D0C0B1]/20 relative group hover:shadow-[0_15px_40px_rgb(0,0,0,0.04)] transition-all duration-500 flex flex-col">' +
        '<div class="flex gap-1 mb-6 text-[#D0C0B1] group-hover:text-[#746258] transition-colors duration-500">' + stars + '</div>' +
        '<p class="text-gray-600 font-light text-[15px] leading-relaxed mb-8 italic relative z-10 flex-grow">"' + esc(r.text || '') + '"</p>' +
        '<div class="pt-6 border-t border-[#D0C0B1]/30 flex justify-between items-end mt-auto">' +
        '<div><p class="font-medium text-[#2A2522]">' + esc(r.author_name || '') + '</p>' +
        (r.review_date ? '<p class="text-[11px] text-[#746258] mt-1.5 uppercase tracking-widest font-semibold">' + esc(r.review_date) + '</p>' : '') +
        '</div></div>' +
        '<i data-lucide="quote" class="absolute top-8 right-8 w-12 h-12 text-[#D0C0B1] opacity-[0.07] group-hover:opacity-[0.12] transition-opacity duration-500 pointer-events-none"></i>' +
        '</div>';
    }).join('');
    refreshIcons();
  }

  // ---------- FAQ ----------
  function renderFaq(rows) {
    var host = document.getElementById('home-faq-container');
    if (!host) return;
    if (!rows || !rows.length) {
      var col = document.getElementById('home-faq-column');
      if (col) col.style.display = 'none';
      return;
    }
    host.innerHTML = rows.map(function (f, idx) {
      var pad = idx === 0 ? 'pb-6' : (idx === rows.length - 1 ? 'pt-6' : 'py-6');
      var border = idx === rows.length - 1 ? '' : 'border-b border-[#D0C0B1]/30';
      return '<div class="' + border + ' ' + pad + ' group">' +
        '<button onclick="toggleFaq(this)" class="flex justify-between items-center w-full text-left focus:outline-none">' +
        '<span class="font-serif text-xl lg:text-2xl text-[#2A2522] pr-4 group-hover:text-[#746258] transition-colors duration-300">' + esc(f.question || '') + '</span>' +
        '<div class="faq-icon w-10 h-10 flex-shrink-0 rounded-full border border-[#D0C0B1]/60 text-[#746258] flex items-center justify-center transition-all duration-500 ease-out group-hover:border-[#746258]">' +
        '<i data-lucide="chevron-down" class="w-5 h-5 transition-transform"></i></div></button>' +
        '<div class="faq-content acc-content">' +
        '<p class="text-gray-500 font-light leading-relaxed pr-8 lg:pr-12 text-[15px] mt-4">' + esc(f.answer || '') + '</p>' +
        '</div></div>';
    }).join('');
    refreshIcons();
  }

  // ---------- ДОКУМЕНТЫ КЛИНИКИ ----------
  function renderDocs(rows) {
    var host = document.getElementById('home-docs-container');
    if (!host) return;
    if (!rows || !rows.length) {
      host.innerHTML = '<div class="bg-[#FDFBF9] rounded-[2.5rem] p-8 border border-[#D0C0B1]/20 text-center"><p class="text-sm text-gray-400 italic">Документы появятся здесь после загрузки в админ-панели.</p></div>';
      return;
    }
    host.innerHTML = rows.map(function (d) {
      var url = d.file_url || '#';
      var title = esc(d.title || 'Документ');
      var category = d.category ? '<p class="text-[10px] uppercase tracking-widest text-gray-400 font-semibold mb-1">' + esc(d.category) + '</p>' : '';
      return '<a href="' + escAttr(url) + '" target="_blank" rel="noopener noreferrer" class="flex items-center p-5 bg-[#FDFBF9] rounded-2xl border border-[#D0C0B1]/30 hover:border-[#746258] hover:shadow-md transition-all group">' +
        '<div class="w-12 h-12 rounded-full bg-white border border-[#D0C0B1]/40 flex items-center justify-center mr-4 flex-shrink-0 group-hover:border-[#746258] group-hover:text-[#746258] transition-colors">' +
        '<i data-lucide="file-text" class="w-5 h-5 text-[#746258]"></i></div>' +
        '<div class="flex-1 min-w-0">' + category + '<p class="text-[15px] text-[#2A2522] font-medium truncate">' + title + '</p></div>' +
        '<i data-lucide="download" class="w-5 h-5 text-gray-300 ml-3 group-hover:text-[#746258]"></i>' +
        '</a>';
    }).join('');
    refreshIcons();
  }

  // ---------- ПРАЙС ----------
  function renderPriceFiles(files) {
    var section = document.getElementById('price');
    if (!section) return;
    var card = section.querySelector('.bg-white.rounded-\\[2\\.5rem\\]') || section.querySelector('div > div.bg-white');
    if (!card) return;
    if (!files || !files.length) {
      card.innerHTML = '<div class="text-center py-8"><p class="text-gray-500 font-light italic">Прайс-листы появятся здесь после загрузки в админ-панели.</p></div>';
      return;
    }
    var list = files.map(function (f) {
      var url = f.file_url || '#';
      var title = esc(f.title || f.file_name || 'Прайс-лист');
      return '<a href="' + escAttr(url) + '" target="_blank" rel="noopener noreferrer" download class="flex items-center justify-between p-5 bg-[#FDFBF9] rounded-2xl border border-[#D0C0B1]/30 hover:border-[#746258] hover:shadow-md transition-all group">' +
        '<div class="flex items-center min-w-0">' +
        '<div class="w-12 h-12 rounded-full bg-white border border-[#D0C0B1]/40 flex items-center justify-center mr-4 flex-shrink-0 group-hover:border-[#746258] transition-colors"><i data-lucide="file-text" class="w-5 h-5 text-[#746258]"></i></div>' +
        '<p class="text-[15px] text-[#2A2522] font-medium truncate">' + title + '</p>' +
        '</div>' +
        '<i data-lucide="download" class="w-5 h-5 text-[#746258] ml-3"></i>' +
        '</a>';
    }).join('');
    card.innerHTML = '<div class="space-y-4">' + list + '</div>' +
      '<p class="text-center text-xs text-gray-400 mt-10 italic">Точная стоимость определяется врачом на индивидуальной консультации.</p>';
    refreshIcons();
  }

  // ---------- УГОЛОК ПОТРЕБИТЕЛЯ ----------
  function renderConsumer(cats, docs, auth) {
    var byCat = {};
    (cats || []).forEach(function (c) {
      byCat[c.id] = { id: c.id, title: c.name || '', icon: 'folder', documents: [] };
    });
    (docs || []).forEach(function (d) {
      if (!d.category_id || !byCat[d.category_id]) return;
      byCat[d.category_id].documents.push({
        name: d.title || 'Документ',
        fileName: d.title || 'document',
        dataUrl: d.file_url || ''
      });
    });
    var data = {
      categories: (cats || []).map(function (c) { return byCat[c.id]; }),
      authorities: (auth || []).map(function (a) {
        return {
          id: a.id,
          name: a.name || '',
          address: a.address || '',
          phone: a.phone || ''
        };
      })
    };
    try { localStorage.setItem('dbConsumer', JSON.stringify(data)); } catch (_) {}
    if (typeof window.renderConsumerView === 'function') window.renderConsumerView();
  }

  // ---------- ФУТЕР / КОНТАКТЫ ----------
  function renderContactsAndFooter(mainTexts, footer) {
    var contacts = (mainTexts && mainTexts.contacts) || {};
    var addr = contacts.address || '';
    var phone = contacts.phone || '';
    var schedule = contacts.schedule || '';
    var phoneHref = 'tel:' + String(phone).replace(/[^+\d]/g, '');

    // Блок «Как нас найти»
    var contactsBlock = document.getElementById('contacts');
    if (contactsBlock) {
      if (addr) {
        var addrP = contactsBlock.querySelector('li:nth-child(1) p.text-lg');
        if (addrP) addrP.textContent = addr;
      }
      if (phone) {
        var phoneA = contactsBlock.querySelector('li:nth-child(2) a');
        if (phoneA) { phoneA.textContent = phone; phoneA.href = phoneHref; }
      }
    }

    // Футер
    var footerEl = document.querySelector('footer');
    if (footerEl) {
      var cols = footerEl.querySelectorAll('h4.font-serif');
      // Колонка «Контакты»
      if (cols[0]) {
        var ul = cols[0].nextElementSibling;
        if (ul) {
          var items = ul.querySelectorAll('li');
          if (items[0] && addr) {
            var span = items[0].querySelector('span'); if (span) span.textContent = addr;
          }
          if (items[1] && phone) {
            var a = items[1].querySelector('a'); if (a) { a.textContent = phone; a.href = phoneHref; }
          }
          if (items[2] && schedule) {
            var sp = items[2].querySelector('span'); if (sp) sp.textContent = schedule;
          }
        }
      }
      // Юридическая информация (footer.license / footer.ogrn / footer.warning / footer.copyright)
      var legalLi = footerEl.querySelector('ul li.mt-8');
      if (legalLi && footer) {
        var spans = legalLi.querySelectorAll('span');
        if (spans[0] && footer.license) spans[0].textContent = footer.license;
        if (spans[1] && footer.ogrn) spans[1].textContent = footer.ogrn;
        if (spans[2] && footer.pdReg) spans[2].textContent = footer.pdReg;
      }
      // Предупреждение
      if (footer && footer.warning) {
        var warnP = footerEl.querySelector('p.text-center.border');
        if (warnP) warnP.textContent = footer.warning;
      }
      // Copyright
      if (footer && footer.copyright) {
        var cp = footerEl.querySelector('p:not(.text-center)');
        if (cp) cp.textContent = footer.copyright;
      }
    }

    // Соцссылки в шапке (page_content.main_texts.contacts.{vk,tg,wa})
    var social = { vk: contacts.vk, tg: contacts.tg, wa: contacts.wa, max: contacts.max };
    Object.keys(social).forEach(function (k) {
      if (!social[k]) return;
      // ищем <a href> со словом vk.com / t.me / wa.me и заменяем
    });
    refreshIcons();
  }

  // ---------- ФИЛОСОФИЯ: врач и видео-визитка ----------
  function renderAboutDoctor(v) {
    v = v || {};
    var nameEl = document.getElementById('about-doctor-name');
    var roleEl = document.getElementById('about-doctor-role');
    var avatarEl = document.getElementById('about-doctor-avatar');
    var photoEl = document.getElementById('about-doctor-photo');
    var playEl = document.getElementById('about-doctor-play');
    var wrapEl = document.getElementById('about-doctor-photo-wrap');
    if (nameEl && v.name) nameEl.textContent = v.name;
    if (roleEl && v.role) roleEl.textContent = v.role;
    if (avatarEl && v.avatar) avatarEl.src = v.avatar;
    if (photoEl && v.photo) photoEl.src = v.photo;

    var video = v.video || '';
    window.__aboutDoctorVideo = video;
    if (playEl) {
      if (video) playEl.classList.remove('hidden');
      else playEl.classList.add('hidden');
    }
    if (wrapEl) {
      if (video) wrapEl.classList.add('cursor-pointer');
      else wrapEl.classList.remove('cursor-pointer');
    }
    refreshIcons();
  }

  window.openAboutDoctorVideo = function () {
    var url = window.__aboutDoctorVideo || '';
    if (!url) return;
    var embed = '';
    var ytMatch = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]{6,})/);
    var vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
    if (ytMatch) {
      embed = '<iframe src="https://www.youtube.com/embed/' + ytMatch[1] + '?autoplay=1&rel=0" allow="autoplay; encrypted-media; fullscreen" allowfullscreen class="w-full h-full rounded-2xl"></iframe>';
    } else if (vimeoMatch) {
      embed = '<iframe src="https://player.vimeo.com/video/' + vimeoMatch[1] + '?autoplay=1" allow="autoplay; fullscreen" allowfullscreen class="w-full h-full rounded-2xl"></iframe>';
    } else {
      embed = '<video src="' + escAttr(url) + '" controls autoplay playsinline class="w-full h-full bg-black rounded-2xl"></video>';
    }
    var overlay = document.createElement('div');
    overlay.className = 'fixed inset-0 z-[200] bg-black/85 flex items-center justify-center p-4';
    overlay.innerHTML =
      '<button type="button" aria-label="Закрыть" class="absolute top-4 right-4 w-12 h-12 rounded-full bg-white/15 text-white text-3xl leading-none flex items-center justify-center hover:bg-white/30 transition">×</button>' +
      '<div class="w-full max-w-4xl aspect-video">' + embed + '</div>';
    function close(){ if (overlay.parentNode) overlay.parentNode.removeChild(overlay); document.removeEventListener('keydown', onKey); }
    function onKey(e){ if (e.key === 'Escape') close(); }
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay || e.target.tagName === 'BUTTON') close();
    });
    document.addEventListener('keydown', onKey);
    document.body.appendChild(overlay);
  };

  // ---------- ССЫЛКИ НА ОТЗЫВЫ ----------
  function renderReviewLinks(mainTexts) {
    var links = (mainTexts && mainTexts.reviewLinks) || {};
    try { localStorage.setItem('reviewLinks', JSON.stringify(links)); } catch (_) {}
    if (typeof window.initReviewLinks === 'function') window.initReviewLinks();
  }

  // ---------- ЗАГРУЗКА ВСЕХ ДАННЫХ ----------
  async function loadAll() {
    var [interior, promos, cats, procs, specs, revs, faqs, prices, docs, ccats, cdocs, auth, pc] =
      await Promise.all([
        sb.from('interior_photos').select('*').order('sort_order', { ascending: true }),
        sb.from('promos').select('*').eq('published', true).order('sort_order', { ascending: true }),
        sb.from('procedure_categories').select('*').order('sort_order', { ascending: true }),
        sb.from('procedures').select('*').order('sort_order', { ascending: true }),
        sb.from('specialists').select('*').eq('published', true).order('sort_order', { ascending: true }),
        sb.from('reviews').select('*').eq('published', true).order('sort_order', { ascending: true }),
        sb.from('faq').select('*').eq('published', true).order('sort_order', { ascending: true }),
        sb.from('price_files').select('*').order('sort_order', { ascending: true }),
        sb.from('clinic_documents').select('*').order('sort_order', { ascending: true }),
        sb.from('consumer_categories').select('*').order('sort_order', { ascending: true }),
        sb.from('consumer_documents').select('*').order('sort_order', { ascending: true }),
        sb.from('authorities').select('*').order('sort_order', { ascending: true }),
        sb.from('page_content').select('*'),
      ]);

    var pcMap = {};
    (pc.data || []).forEach(function (row) { pcMap[row.key] = row.value || {}; });
    var mainTexts = pcMap.main_texts || {};
    var footerCfg = pcMap.footer || {};

    try { renderHero(interior.data, mainTexts); } catch (e) { console.error('[site] hero', e); }
    try { renderPromos(promos.data); } catch (e) { console.error('[site] promos', e); }
    try { renderCategoriesAndProcedures(cats.data, procs.data); } catch (e) { console.error('[site] categories', e); }
    try { renderSpecialists(specs.data); } catch (e) { console.error('[site] specialists', e); }
    try { renderReviews(revs.data); } catch (e) { console.error('[site] reviews', e); }
    try { renderFaq(faqs.data); } catch (e) { console.error('[site] faq', e); }
    try { renderDocs(docs.data); } catch (e) { console.error('[site] docs', e); }
    try { renderPriceFiles(prices.data); } catch (e) { console.error('[site] prices', e); }
    try { renderConsumer(ccats.data, cdocs.data, auth.data); } catch (e) { console.error('[site] consumer', e); }
    try { renderContactsAndFooter(mainTexts, footerCfg); } catch (e) { console.error('[site] footer', e); }
    try { renderReviewLinks(mainTexts); } catch (e) { console.error('[site] revlinks', e); }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadAll);
  } else {
    loadAll();
  }
})();
