/* 청년층 제주 관광 동향 대시보드
 * 데이터: data/main_data.js(DASH_DATA), data/search_data.js(DASH_SEARCH), data/places_data.js(DASH_PLACES), data/reviews_data.js(DASH_REVIEWS, 선택)
 * 모든 수치는 원본 값을 합산만 해서 계산한다. 데이터가 없는 경우 0이 아니라 '데이터 없음'으로 표시한다.
 */
(function () {
  'use strict';
  var D = window.DASH_DATA, S = window.DASH_SEARCH, P = window.DASH_PLACES, R = window.DASH_REVIEWS || null;
  var $ = function (id) { return document.getElementById(id); };
  var fmt = function (n) { return n == null || isNaN(n) ? '-' : Math.round(n).toLocaleString('ko-KR'); };
  var pct = function (x, d) { return x == null || !isFinite(x) ? '-' : (x * 100).toFixed(d == null ? 1 : d) + '%'; };
  var ymLabel = function (ym) { ym = String(ym); return ym.slice(0, 4) + '.' + ym.slice(4, 6); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var uniqSorted = function (arr) { return Array.from(new Set(arr)).sort(function (a, b) { return a - b; }); };
  var prevYm = function (ym) { return ym - 100; };
  var COLORS = ['#2f6fe4', '#1f9d6b', '#e07b39', '#8b5cf6', '#d64545', '#0ea5b7', '#b7791f'];

  if (!D || !S || !P) {
    $('loading').textContent = '데이터 파일(data/*.js)을 불러오지 못했습니다. scripts/build_data.ps1을 먼저 실행하세요.';
    return;
  }

  // ---------- 데이터 준비 ----------
  var AGE_MONTHS = uniqSorted(D.age.map(function (r) { return r[0]; }));
  var DONG_MONTHS = uniqSorted(D.dongRows.map(function (r) { return r[0]; }));
  var SEARCH_MONTHS = uniqSorted(S.ym);
  var PLACE_MONTHS = uniqSorted(P.ym);
  var ALL_MONTHS = uniqSorted(AGE_MONTHS.concat(DONG_MONTHS, SEARCH_MONTHS, PLACE_MONTHS));
  var AGES = uniqSorted(D.age.map(function (r) { return r[2]; }));
  var setOf = function (a) { return new Set(a); };
  var AGE_SET = setOf(AGE_MONTHS), DONG_SET = setOf(DONG_MONTHS);
  var SGGS = Array.from(new Set(D.dongs.map(function (d) { return d.sgg; })));
  var REVIEW_ITEMS = R && R.items ? R.items : null;

  var DEFAULT = { start: AGE_MONTHS[0], end: AGE_MONTHS[AGE_MONTHS.length - 1], age: '20', sex: 'all', sgg: 'all', dong: -1, metric: 'tot', pcat: 'all', psort: 'tour', ptop: 10, scat: 'all', rset: '20s', rperiod: 'dash' };
  var st = JSON.parse(JSON.stringify(DEFAULT));

  // ---------- 공통 계산 ----------
  function inRange(ym) { return ym >= st.start && ym <= st.end; }
  function rangeMonths(list) { return list.filter(inRange); }
  function ageLabel() { return st.age === 'all' ? '전체 연령' : st.age + '대'; }
  function sexLabel() { return st.sex === 'all' ? '' : (st.sex === 'M' ? ' 남성' : ' 여성'); }
  function sumAge(months, age, sex) {
    var ms = setOf(months), s = 0;
    D.age.forEach(function (r) {
      if (ms.has(r[0]) && (age === 'all' || r[2] === +age) && (sex === 'all' || r[1] === sex)) s += r[3];
    });
    return s;
  }
  function ageByMonth(age, sex) {
    var m = {};
    D.age.forEach(function (r) {
      if ((age === 'all' || r[2] === +age) && (sex === 'all' || r[1] === sex)) m[r[0]] = (m[r[0]] || 0) + r[3];
    });
    return m;
  }
  function dongPass(di) {
    if (st.dong >= 0) return di === st.dong;
    if (st.sgg !== 'all') return D.dongs[di].sgg === st.sgg;
    return true;
  }
  function regionLabel() {
    if (st.dong >= 0) return D.dongs[st.dong].sgg + ' ' + D.dongs[st.dong].name;
    return st.sgg === 'all' ? '제주 전체' : st.sgg;
  }
  function emptyBox(el, msg) {
    var inst = echarts.getInstanceByDom(el); if (inst) inst.dispose();
    el.innerHTML = '<div class="empty">' + esc(msg) + '</div>';
  }
  function chartOf(el) {
    if (el.querySelector('.empty')) el.innerHTML = '';
    return echarts.getInstanceByDom(el) || echarts.init(el);
  }
  function table(el, head, rows, opt) {
    opt = opt || {};
    if (!rows.length) { el.innerHTML = '<div class="empty">' + esc(opt.empty || '표시할 데이터가 없습니다.') + '</div>'; return; }
    var h = '<table><thead><tr>' + head.map(function (c) { return '<th class="' + (c.n ? 'n' : '') + '">' + esc(c.t) + '</th>'; }).join('') + '</tr></thead><tbody>';
    rows.forEach(function (r, i) {
      h += '<tr' + (opt.sel && opt.sel(i) ? ' class="sel"' : '') + '>' + r.map(function (v, j) { return '<td class="' + (head[j].n ? 'n' : '') + '">' + (head[j].html ? v : esc(v)) + '</td>'; }).join('') + '</tr>';
    });
    el.innerHTML = h + '</tbody></table>';
  }
  function availNote(name, months, all) {
    if (!months.length) return name + ' 데이터는 ' + ymLabel(all[0]) + '~' + ymLabel(all[all.length - 1]) + '만 있습니다. 선택한 기간(' + ymLabel(st.start) + '~' + ymLabel(st.end) + ')에는 데이터가 없습니다.';
    return null;
  }
  function coverageText(months) {
    if (!months.length) return '해당 없음';
    return ymLabel(months[0]) + '~' + ymLabel(months[months.length - 1]) + ' (' + months.length + '개월)';
  }

  // ---------- 필터 UI ----------
  function opt(v, t, sel) { return '<option value="' + esc(v) + '"' + (sel ? ' selected' : '') + '>' + esc(t) + '</option>'; }
  function buildFilters() {
    $('f-start').innerHTML = ALL_MONTHS.map(function (m) { return opt(m, ymLabel(m), m === st.start); }).join('');
    $('f-end').innerHTML = ALL_MONTHS.map(function (m) { return opt(m, ymLabel(m), m === st.end); }).join('');
    $('f-age').innerHTML = opt('all', '전체 연령', st.age === 'all') + AGES.map(function (a) { return opt(a, a + '대', String(a) === st.age); }).join('');
    $('f-sex').value = st.sex;
    $('f-sgg').innerHTML = opt('all', '전체', st.sgg === 'all') + SGGS.map(function (s) { return opt(s, s, s === st.sgg); }).join('');
    buildDongOptions();
    $('f-metric').value = st.metric; $('f-psort').value = st.psort; $('f-ptop').value = String(st.ptop);
    $('f-rset').value = st.rset; $('f-rperiod').value = st.rperiod;
    var scats = Array.from(new Set(S.places.cat));
    $('f-scat').innerHTML = opt('all', '전체 분류', st.scat === 'all') + scats.map(function (c) { return opt(c, c, c === st.scat); }).join('');
  }
  function buildDongOptions() {
    var list = D.dongs.map(function (d, i) { return { d: d, i: i }; }).filter(function (x) { return st.sgg === 'all' || x.d.sgg === st.sgg; });
    $('f-dong').innerHTML = opt(-1, '전체', st.dong < 0) + list.map(function (x) { return opt(x.i, (st.sgg === 'all' ? x.d.sgg + ' ' : '') + x.d.name, x.i === st.dong); }).join('');
  }
  function bindFilters() {
    var on = function (id, fn) { $(id).addEventListener('change', function (e) { fn(e.target.value); render(); }); };
    on('f-start', function (v) { st.start = +v; if (st.start > st.end) { st.end = st.start; $('f-end').value = v; } });
    on('f-end', function (v) { st.end = +v; if (st.end < st.start) { st.start = st.end; $('f-start').value = v; } });
    on('f-age', function (v) { st.age = v; });
    on('f-sex', function (v) { st.sex = v; });
    on('f-sgg', function (v) { st.sgg = v; st.dong = -1; buildDongOptions(); });
    on('f-dong', function (v) { st.dong = +v; if (st.dong >= 0) { st.sgg = D.dongs[st.dong].sgg; $('f-sgg').value = st.sgg; buildDongOptions(); } });
    on('f-metric', function (v) { st.metric = v; });
    on('f-pcat', function (v) { st.pcat = v; });
    on('f-psort', function (v) { st.psort = v; });
    on('f-ptop', function (v) { st.ptop = +v; });
    on('f-scat', function (v) { st.scat = v; });
    on('f-rset', function (v) { st.rset = v; });
    on('f-rperiod', function (v) { st.rperiod = v; });
    $('f-reset').addEventListener('click', function () { st = JSON.parse(JSON.stringify(DEFAULT)); buildFilters(); render(); });
  }
  function setDong(di) {
    st.dong = di;
    if (di >= 0) st.sgg = D.dongs[di].sgg;
    $('f-sgg').value = st.sgg; buildDongOptions(); render();
  }

  // 각 영역에 실제 적용된 필터를 칩으로 표시
  function renderChips() {
    var ALL = ['기간', '연령대', '성별', '시군구', '읍면동'];
    document.querySelectorAll('.chips[data-applies]').forEach(function (el) {
      var on = el.getAttribute('data-applies').split(',');
      el.innerHTML = '<span class="chip">적용 필터</span>' + ALL.map(function (f) {
        var applied = on.indexOf(f) >= 0;
        var partial = (el.closest('#sec-search') && f === '읍면동' && st.dong >= 0);
        if (partial) return '<span class="chip warn">읍면동 → 시 단위로 적용</span>';
        if (el.closest('#sec-reviews') && f === '기간' && st.rperiod === 'all') return '<span class="chip off">기간(전체 작성 기간 선택)</span>';
        return '<span class="chip' + (applied ? '' : ' off') + '">' + f + '</span>';
      }).join('');
    });
  }

  // ---------- 3,4. 핵심 지표 ----------
  var K = {}; // 요약·셀프테스트용 계산 결과
  function renderKpi() {
    var ms = rangeMonths(AGE_MONTHS);
    var label = ageLabel() + sexLabel();
    $('kpi1-sub').textContent = '(' + label + ' 방문 규모)';
    K.ageMonths = ms;
    if (!ms.length) {
      $('kpi1-value').textContent = '데이터 없음'; $('kpi1-value').className = 'kpi-value na';
      $('kpi1-desc').textContent = availNote('연령대별 방문', ms, AGE_MONTHS);
      $('kpi1-subs').innerHTML = '';
      $('kpi2-value').textContent = '계산 불가'; $('kpi2-value').className = 'kpi-value na';
      $('kpi2-desc').textContent = '선택 기간에 연령대별 방문 데이터가 없습니다.'; $('kpi2-subs').innerHTML = '';
      K.total = null; K.yoy = null; return;
    }
    var total = sumAge(ms, st.age, st.sex), all = sumAge(ms, 'all', st.sex);
    var byM = ageByMonth(st.age, st.sex);
    var peak = ms.reduce(function (a, m) { return byM[m] > byM[a] ? m : a; }, ms[0]);
    K.total = total; K.share = st.age === 'all' ? null : total / all; K.peak = peak; K.peakV = byM[peak];
    $('kpi1-value').textContent = fmt(total) + '명'; $('kpi1-value').className = 'kpi-value';
    $('kpi1-desc').textContent = label + ' 제주 방문객 수 합계 · ' + coverageText(ms) + (ms.length < monthsBetween(st.start, st.end) ? ' — 선택 기간 중 데이터가 있는 달만 합산' : '');
    var subs = [];
    if (K.share != null) subs.push('전체 연령' + sexLabel() + ' 방문객 중 비중: <b>' + pct(K.share) + '</b> (' + fmt(all) + '명 중)');
    subs.push('월평균 ' + fmt(total / ms.length) + '명 · 최다 월 ' + ymLabel(peak) + ' (' + fmt(byM[peak]) + '명)');
    subs.push('집계 기준: 연령대별 방문 데이터의 방문객수 합계. 월별 입도 관광객(입도객 수)과 집계 기준이 달라 직접 비교하지 않습니다.');
    $('kpi1-subs').innerHTML = subs.map(function (s) { return '<li>' + s + '</li>'; }).join('');

    // 전년 동기 대비: 선택 기간 중 전년 같은 달 데이터가 있는 달만 비교
    var comp = ms.filter(function (m) { return AGE_SET.has(prevYm(m)); });
    if (!comp.length) {
      $('kpi2-value').textContent = '계산 불가'; $('kpi2-value').className = 'kpi-value na';
      $('kpi2-desc').textContent = '선택 기간(' + ymLabel(ms[0]) + '~' + ymLabel(ms[ms.length - 1]) + ')의 전년 같은 달 데이터가 없습니다. 연령대별 데이터는 ' + ymLabel(AGE_MONTHS[0]) + '부터 있습니다.';
      $('kpi2-subs').innerHTML = ''; K.yoy = null; return;
    }
    var cur = sumAge(comp, st.age, st.sex), prev = sumAge(comp.map(prevYm), st.age, st.sex);
    var yoy = (cur - prev) / prev;
    K.yoy = yoy; K.yoyComp = comp; K.yoyCur = cur; K.yoyPrev = prev;
    $('kpi2-value').textContent = (yoy >= 0 ? '+' : '') + pct(yoy); $('kpi2-value').className = 'kpi-value ' + (yoy >= 0 ? 'up' : 'down');
    $('kpi2-desc').textContent = label + ' 방문객 수, ' + ymLabel(comp[0]) + '~' + ymLabel(comp[comp.length - 1]) + ' vs ' + ymLabel(prevYm(comp[0])) + '~' + ymLabel(prevYm(comp[comp.length - 1]));
    var s2 = ['비교 기간 합계 ' + fmt(cur) + '명 vs 전년 동기 ' + fmt(prev) + '명 (' + comp.length + '개월)'];
    if (comp.length < ms.length) s2.push('선택 기간 중 ' + (ms.length - comp.length) + '개월은 전년 데이터가 없어 비교에서 제외');
    var last = ms[ms.length - 1];
    if (AGE_SET.has(prevYm(last))) { var a = byM[last], b = byM[prevYm(last)]; s2.push('마지막 달 ' + ymLabel(last) + ' 전년 동월 대비: ' + ((a - b) / b >= 0 ? '+' : '') + pct((a - b) / b)); }
    $('kpi2-subs').innerHTML = s2.map(function (s) { return '<li>' + s + '</li>'; }).join('');
  }
  function monthsBetween(a, b) { var n = 0; ALL_MONTHS.forEach(function (m) { if (m >= a && m <= b) n++; }); return n; }

  // ---------- 5. 방문 추이 ----------
  function renderTrend() {
    var el = $('ch-trend');
    var ms = rangeMonths(AGE_MONTHS);
    $('trend-sub').textContent = '월별 · 연도별 ' + ageLabel() + sexLabel() + ' 방문객 수 변화 (연령대별 방문 데이터)';
    if (!ms.length) { emptyBox(el, availNote('연령대별 방문', ms, AGE_MONTHS)); $('tbl-trend').innerHTML = ''; return; }
    var byM = ageByMonth(st.age, st.sex);
    var years = uniqSorted(ms.map(function (m) { return Math.floor(m / 100); }));
    var series = years.map(function (y, i) {
      return {
        name: y + '년', type: 'line', smooth: false, symbolSize: 7, connectNulls: false,
        itemStyle: { color: COLORS[i % COLORS.length] }, lineStyle: { width: 2.5 },
        data: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(function (mo) { var ym = y * 100 + mo; return inRange(ym) && AGE_SET.has(ym) ? byM[ym] : null; })
      };
    });
    var c = chartOf(el);
    c.setOption({
      title: { text: ageLabel() + sexLabel() + ' 월별 방문객 수', left: 0, top: 0, textStyle: { fontSize: 13 } },
      tooltip: { trigger: 'axis', valueFormatter: function (v) { return v == null ? '데이터 없음' : fmt(v) + '명'; } },
      legend: { top: 0, right: 0 },
      grid: { left: 70, right: 20, top: 46, bottom: 40 },
      xAxis: { type: 'category', name: '월', nameLocation: 'middle', nameGap: 26, data: ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'] },
      yAxis: { type: 'value', name: '방문객 수(명)', nameTextStyle: { align: 'left' }, axisLabel: { formatter: function (v) { return v >= 10000 ? (v / 10000).toLocaleString('ko-KR') + '만' : v; } } },
      series: series
    }, true);
    var rows = ms.slice().reverse().map(function (m) {
      var p = AGE_SET.has(prevYm(m)) ? byM[prevYm(m)] : null;
      return [ymLabel(m), fmt(byM[m]), p == null ? '데이터 없음' : fmt(p), p == null ? '계산 불가' : ((byM[m] - p) / p >= 0 ? '+' : '') + pct((byM[m] - p) / p)];
    });
    table($('tbl-trend'), [{ t: '기준연월' }, { t: '방문객 수(명)', n: 1 }, { t: '전년 동월(명)', n: 1 }, { t: '전년 동월 대비', n: 1 }], rows);
  }

  // ---------- 6. 지역별 방문 ----------
  var mapRegistered = false;
  function renderRegion() {
    var ms = rangeMonths(DONG_MONTHS), msSet = setOf(ms);
    var agg = D.dongs.map(function () { return { dom: 0, for: 0, tot: 0 }; });
    D.dongRows.forEach(function (r) { if (msSet.has(r[0])) { var a = agg[r[1]]; a.dom += r[2]; a.for += r[3]; a.tot += r[4]; } });
    K.dongAgg = agg; K.dongMonths = ms;
    var metricName = { tot: '총 방문객수', dom: '내국인 방문객수', for: '외국인 방문객수' }[st.metric];
    var mapEl = $('ch-map'), topEl = $('ch-region-top');
    if (!ms.length) {
      var msg = availNote('읍면동 방문객', ms, DONG_MONTHS);
      emptyBox(mapEl, msg); emptyBox(topEl, msg); $('tbl-region').innerHTML = ''; return;
    }
    if (!mapRegistered) {
      D.geo.features.forEach(function (f) { var nm = f.properties.adm_nm; f.properties.name = nm.slice(nm.lastIndexOf(' ') + 1); });
      echarts.registerMap('jeju', D.geo); mapRegistered = true;
    }
    var vals = agg.map(function (a) { return a[st.metric]; });
    var mc = chartOf(mapEl);
    mc.setOption({
      title: { text: '읍면동별 ' + metricName, subtext: coverageText(ms), left: 0, top: 0, textStyle: { fontSize: 13 }, subtextStyle: { fontSize: 11 } },
      tooltip: {
        trigger: 'item', formatter: function (p) {
          var i = p.dataIndex, a = agg[i], d = D.dongs[i];
          return '<b>' + esc(d.sgg + ' ' + d.name) + '</b><br>총 ' + fmt(a.tot) + '명<br>내국인 ' + fmt(a.dom) + '명 · 외국인 ' + fmt(a.for) + '명';
        }
      },
      visualMap: { type: 'continuous', min: Math.min.apply(null, vals), max: Math.max.apply(null, vals), left: 0, bottom: 0, text: ['많음', '적음'], calculable: false, itemHeight: 90, inRange: { color: ['#e8f0fe', '#9cc0f9', '#2f6fe4', '#163f8f'] }, formatter: function (v) { return fmt(v); }, textStyle: { fontSize: 11 } },
      series: [{
        // 북쪽 추자면까지 한 화면에 넣으면 본섬이 작아지므로 본섬 중심으로 확대 (드래그·휠로 추자면 확인 가능)
        type: 'map', map: 'jeju', roam: true, top: 50, bottom: 10, center: [126.55, 33.39], zoom: 2.1, scaleLimit: { min: 1, max: 8 }, selectedMode: 'single', nameProperty: 'name',
        label: { show: false }, emphasis: { label: { show: true, fontSize: 11 } },
        select: { itemStyle: { areaColor: '#f6c344', borderColor: '#b7791f', borderWidth: 2 }, label: { show: true } },
        itemStyle: { borderColor: '#fff', borderWidth: 0.6 },
        data: D.dongs.map(function (d, i) { return { name: d.name, value: vals[i], selected: i === st.dong }; })
      }]
    }, true);
    mc.off('click');
    mc.on('click', function (p) { var i = D.dongs.findIndex(function (d) { return d.name === p.name; }); setDong(i === st.dong ? -1 : i); });

    var idx = D.dongs.map(function (d, i) { return i; }).filter(function (i) { return st.sgg === 'all' || D.dongs[i].sgg === st.sgg; });
    idx.sort(function (a, b) { return agg[b][st.metric] - agg[a][st.metric]; });
    var top = idx.slice(0, 10).reverse();
    var tc = chartOf(topEl);
    tc.setOption({
      title: { text: '방문 상위 읍면동 TOP 10' + (st.sgg !== 'all' ? ' (' + st.sgg + ')' : ''), left: 0, top: 0, textStyle: { fontSize: 13 } },
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, valueFormatter: function (v) { return fmt(v) + '명'; } },
      legend: { top: 22, left: 0, data: ['내국인 방문객수', '외국인 방문객수'] },
      grid: { left: 70, right: 30, top: 56, bottom: 40 },
      xAxis: { type: 'value', name: '방문객 수(명)', nameLocation: 'middle', nameGap: 26, splitNumber: 4, axisLabel: { formatter: function (v) { return v >= 10000 ? (v / 10000).toLocaleString('ko-KR') + '만' : v; } } },
      yAxis: { type: 'category', data: top.map(function (i) { return D.dongs[i].name; }), axisLabel: { interval: 0 } },
      series: [
        { name: '내국인 방문객수', type: 'bar', stack: 't', itemStyle: { color: '#2f6fe4' }, data: top.map(function (i) { return { value: agg[i].dom, itemStyle: i === st.dong ? { color: '#b7791f' } : null }; }) },
        { name: '외국인 방문객수', type: 'bar', stack: 't', itemStyle: { color: '#f0a35e' }, data: top.map(function (i) { return agg[i].for; }) }
      ]
    }, true);

    var tot = idx.reduce(function (s, i) { return s + agg[i].tot; }, 0);
    table($('tbl-region'), [{ t: '순위' }, { t: '시군구' }, { t: '읍면동' }, { t: '읍면동코드' }, { t: '내국인(명)', n: 1 }, { t: '외국인(명)', n: 1 }, { t: '총 방문객(명)', n: 1 }, { t: '비중', n: 1 }, { t: '주민센터 주소' }],
      idx.map(function (i, k) { var d = D.dongs[i], a = agg[i]; return [k + 1, d.sgg, d.name, d.code10, fmt(a.dom), fmt(a.for), fmt(a.tot), pct(a.tot / tot), d.addr || '']; }),
      { sel: function (k) { return idx[k] === st.dong; } });
  }

  // ---------- 7. 인기 장소 ----------
  // 같은 장소가 주소 표기만 다르게(예: '2002'와 '2002-0') 여러 줄로 나뉘어 있어 '목적지명 + 읍면동' 단위로 묶는다.
  var PG = (function () {
    var pl = P.places, key2g = new Map(), gid = new Array(pl.name.length), gName = [], gDong = [];
    for (var i = 0; i < pl.name.length; i++) {
      var k = pl.name[i] + '\u0001' + pl.dong[i], g = key2g.get(k);
      if (g == null) { g = gName.length; key2g.set(k, g); gName.push(pl.name[i]); gDong.push(pl.dong[i]); }
      gid[i] = g;
    }
    return { gid: gid, name: gName, dong: gDong };
  })();
  function aggPlaces() {
    var n = P.ym.length, pl = P.places, map = new Map(), catTot = new Map(), months = new Set();
    for (var i = 0; i < n; i++) {
      var ym = P.ym[i]; if (ym < st.start || ym > st.end) continue;
      var pi = P.p[i]; if (!dongPass(pl.dong[pi])) continue;
      var cat = pl.cat[pi];
      catTot.set(cat, (catTot.get(cat) || 0) + P.tour[i]);
      if (st.pcat !== 'all' && cat !== st.pcat) continue;
      months.add(ym);
      var g = PG.gid[pi], a = map.get(g);
      if (!a) { a = { g: g, name: PG.name[g], dong: PG.dong[g], arr: 0, tour: 0, res: 0, mis: 0, cats: new Map(), addrs: new Map() }; map.set(g, a); }
      a.arr += P.arr[i]; a.tour += P.tour[i]; a.res += P.res[i];
      if (P.arr[i] !== P.tour[i] + P.res[i]) a.mis++;
      a.cats.set(cat, (a.cats.get(cat) || 0) + P.arr[i]);
      a.addrs.set(pl.addr[pi], (a.addrs.get(pl.addr[pi]) || 0) + P.arr[i]);
    }
    var top = function (m) { var b = null, bv = -1; m.forEach(function (v, k) { if (v > bv) { bv = v; b = k; } }); return b; };
    var list = Array.from(map.values());
    list.forEach(function (a) { a.cat = top(a.cats); a.addr = top(a.addrs); a.nAddr = a.addrs.size; a.allCats = Array.from(a.cats.keys()); });
    return { list: list, catTot: catTot, months: uniqSorted(Array.from(months)) };
  }
  function renderPlaces() {
    var res = aggPlaces();
    if (st.pcat !== 'all' && !res.catTot.has(st.pcat)) { st.pcat = 'all'; res = aggPlaces(); }
    var cats = Array.from(res.catTot.entries()).sort(function (a, b) { return b[1] - a[1]; });
    $('f-pcat').innerHTML = opt('all', '전체 카테고리 (' + cats.length + '종)', st.pcat === 'all') + cats.map(function (c) { return opt(c[0], c[0] + ' (관광객 ' + fmt(c[1]) + ')', c[0] === st.pcat); }).join('');
    var list = res.list;
    var key = st.psort;
    list.sort(function (a, b) { return b[key] - a[key] || b.arr - a.arr; });
    var top = list.slice(0, st.ptop);
    K.places = top; K.placeMonths = res.months;
    var el = $('ch-places');
    var ms = rangeMonths(PLACE_MONTHS);
    if (!ms.length || !top.length) {
      emptyBox(el, !ms.length ? availNote('인기 장소', ms, PLACE_MONTHS) : '선택한 조건(' + regionLabel() + ')에 해당하는 장소 데이터가 없습니다.');
      $('tbl-places').innerHTML = ''; $('places-note').textContent = ''; return;
    }
    var keyName = key === 'tour' ? '관광객 도착 수' : '도착건수';
    var chartTop = top.slice(0, 15).reverse();
    var c = chartOf(el);
    c.setOption({
      title: { text: regionLabel() + ' 장소별 ' + keyName + ' TOP ' + Math.min(15, top.length), subtext: coverageText(res.months), left: 0, top: 0, textStyle: { fontSize: 13 }, subtextStyle: { fontSize: 11 } },
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, formatter: function (ps) { var a = chartTop[ps[0].dataIndex]; return '<b>' + esc(a.name) + '</b> (' + esc(a.cat) + ')<br>관광객 도착 수 ' + fmt(a.tour) + '<br>도민 도착 수 ' + fmt(a.res) + '<br>도착건수 ' + fmt(a.arr); } },
      grid: { left: 130, right: 30, top: 50, bottom: 36 },
      xAxis: { type: 'value', name: keyName + '(건)', nameLocation: 'middle', nameGap: 24, axisLabel: { formatter: function (v) { return v >= 10000 ? (v / 10000).toLocaleString('ko-KR') + '만' : v; } } },
      yAxis: { type: 'category', data: chartTop.map(function (a) { var s = a.name; return s.length > 10 ? s.slice(0, 10) + '…' : s; }), axisLabel: { interval: 0, fontSize: 11 } },
      series: [{ name: keyName, type: 'bar', itemStyle: { color: '#1f9d6b' }, data: chartTop.map(function (a) { return a[key]; }), label: { show: true, position: 'right', formatter: function (p) { return fmt(p.value); }, fontSize: 10 } }]
    }, true);
    table($('tbl-places'), [{ t: '순위' }, { t: '장소명(목적지명)' }, { t: '카테고리', html: 1 }, { t: '읍면동' }, { t: '관광객 도착 수', n: 1 }, { t: '도민 도착 수', n: 1 }, { t: '도착건수', n: 1 }, { t: '목적지주소(대표)' }, { t: '주소 표기 수', n: 1 }],
      top.map(function (a, k) { var d = D.dongs[a.dong]; return [k + 1, a.name, '<span class="tag">' + esc(a.cat) + '</span>' + (a.allCats.length > 1 ? ' 외 ' + (a.allCats.length - 1) : ''), d ? d.name : '', fmt(a.tour), fmt(a.res), fmt(a.arr) + (a.mis ? ' *' : ''), a.addr, a.nAddr]; }));
    var mis = top.filter(function (a) { return a.mis; }).length;
    $('places-note').innerHTML = '집계: 선택 기간·지역의 월별 값을 <b>목적지명 + 읍면동</b> 단위로 합산(같은 장소가 \'2002\'/\'2002-0\'처럼 주소 표기만 달리 여러 줄로 나뉘어 있어 묶음). 카테고리·주소는 도착건수가 가장 큰 값을 대표로 표시. 연령 구분이 없는 전체 이용자 기준이며, 원본 열 이름(주행일자·도착)으로 보아 차량 내비게이션 목적지 기반 자료로 보이나 <b>수집 방식은 추가 확인 필요</b>. '
      + '원본 ' + fmt(P.totalRows) + '행 중 ' + fmt(P.mismatchRows) + '행은 도착건수 ≠ 관광객+도민 (값은 수정하지 않음)' + (mis ? '; 위 표의 * 표시 ' + mis + '곳이 해당 행을 포함.' : '.');
  }

  // ---------- 8. 관광 검색어 ----------
  var hasCloud = false;
  function aggSearch() {
    var sgg = st.dong >= 0 ? D.dongs[st.dong].sgg : st.sgg;
    var m = new Map(), months = new Set(), total = 0, pl = S.places;
    for (var i = 0; i < S.ym.length; i++) {
      var ym = S.ym[i]; if (ym < st.start || ym > st.end) continue;
      var pi = S.p[i];
      if (sgg !== 'all' && pl.sgg[pi] !== sgg) continue;
      if (st.scat !== 'all' && pl.cat[pi] !== st.scat) continue;
      months.add(ym);
      var nm = pl.name[pi], a = m.get(nm);
      if (!a) { a = { name: nm, v: 0, rows: 0, cats: new Set(), addrs: new Set(), months: new Set() }; m.set(nm, a); }
      a.v += S.v[i]; a.rows += S.n[i]; a.cats.add(pl.cat[pi]); a.addrs.add(pl.addr[pi]); a.months.add(ym);
      total += S.v[i];
    }
    var list = Array.from(m.values()).sort(function (a, b) { return b.v - a.v; });
    return { list: list, total: total, months: uniqSorted(Array.from(months)), sgg: sgg };
  }
  function renderSearch() {
    var res = aggSearch(); K.search = res;
    var cloudEl = $('ch-cloud'), barEl = $('ch-search-bar');
    var ms = rangeMonths(SEARCH_MONTHS);
    if (!ms.length || !res.list.length) {
      var msg = !ms.length ? availNote('비짓제주 검색어', ms, SEARCH_MONTHS) : '선택한 조건에 해당하는 검색어 데이터가 없습니다.';
      emptyBox(cloudEl, msg); emptyBox(barEl, msg); $('tbl-search').innerHTML = ''; $('search-note').textContent = ''; return;
    }
    var title = (res.sgg === 'all' ? '제주 전체' : res.sgg) + (st.scat === 'all' ? '' : ' · ' + st.scat);
    if (hasCloud) {
      var words = res.list.slice(0, 80);
      // 워드클라우드는 비동기로 배치되므로, 이전 배치가 같은 캔버스에 겹쳐 그려지지 않도록 매번 새 차트로 만든다
      var old = echarts.getInstanceByDom(cloudEl); if (old) old.dispose();
      cloudEl.innerHTML = '';
      var cc = echarts.init(cloudEl);
      cc.setOption({
        title: { text: '검색 상위 장소명 워드클라우드 (' + title + ')', subtext: '글자 크기 = 검색 수치 합계 · 상위 ' + words.length + '개', left: 0, top: 0, textStyle: { fontSize: 13 }, subtextStyle: { fontSize: 11 } },
        tooltip: { formatter: function (p) { return '<b>' + esc(p.name) + '</b><br>검색 수치 합계 ' + fmt(p.value); } },
        series: [{
          type: 'wordCloud', shape: 'circle', left: 'center', top: 48, width: '96%', height: '82%',
          sizeRange: [11, 42], rotationRange: [0, 0], gridSize: 6, drawOutOfBound: false, shrinkToFit: true, layoutAnimation: false,
          textStyle: { fontWeight: 'bold', color: function (p) { return COLORS[p.dataIndex % 5]; } },
          data: words.map(function (w) { return { name: w.name, value: w.v }; })
        }]
      }, true);
    } else {
      emptyBox(cloudEl, '워드클라우드 라이브러리를 불러오지 못해 아래 막대그래프와 표로 대체합니다.');
    }
    var top = res.list.slice(0, 15).reverse();
    var bc = chartOf(barEl);
    bc.setOption({
      title: { text: '검색 수치 상위 15 (' + title + ')', left: 0, top: 0, textStyle: { fontSize: 13 } },
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, valueFormatter: function (v) { return fmt(v); } },
      grid: { left: 120, right: 40, top: 30, bottom: 36 },
      xAxis: { type: 'value', name: '검색 수치 합계', nameLocation: 'middle', nameGap: 24 },
      yAxis: { type: 'category', data: top.map(function (a) { return a.name.length > 9 ? a.name.slice(0, 9) + '…' : a.name; }), axisLabel: { interval: 0, fontSize: 11 } },
      series: [{ name: '검색 수치 합계', type: 'bar', itemStyle: { color: '#8b5cf6' }, data: top.map(function (a) { return a.v; }), label: { show: true, position: 'right', fontSize: 10, formatter: function (p) { return fmt(p.value); } } }]
    }, true);
    table($('tbl-search'), [{ t: '순위' }, { t: '검색어(장소명)' }, { t: '분류' }, { t: '검색 수치 합계', n: 1 }, { t: '비중', n: 1 }, { t: '원본 행 수', n: 1 }, { t: '등장 월 수', n: 1 }, { t: '주소 수', n: 1 }],
      res.list.slice(0, 50).map(function (a, k) { return [k + 1, a.name, Array.from(a.cats).join(', '), fmt(a.v), pct(a.v / res.total), fmt(a.rows), a.months.size, a.addrs.size]; }));
    $('search-note').innerHTML = '집계: 원본의 \'지역명\' 열(실제로는 장소·업체명)을 검색어로 보고, 선택 기간의 \'수치\'를 이름별로 합산. 같은 월·장소가 최대 7행으로 나뉘어 있으나 <b>행 구분 기준과 \'수치\'의 정의(검색 횟수/순위 점수 등)는 원본에 없어 추가 확인 필요</b>. '
      + '지역 필터는 주소의 시(제주시/서귀포시) 기준으로만 적용됩니다(주소에 읍면동이 없는 도로명 주소가 많음). 시 구분이 안 되는 장소 ' + S.places.sgg.filter(function (s) { return s === '미상'; }).length + '곳은 시 필터 선택 시 제외됩니다.';
  }

  // ---------- 9. 온라인 후기 ----------
  // 주제 분류 규칙 (키워드가 제목·요약문에 포함된 글 수를 셈). 화면에 그대로 공개한다.
  // 주요 활동은 언급 여부, 만족·불편은 '평가 표현'이 있을 때만 센다(예: '주차장' 정보는 불편이 아님, '코스 추천' 제목은 만족이 아님).
  var TOPICS = {
    '주요 활동': [
      ['맛집·음식', ['맛집', '흑돼지', '고기국수', '해산물', '횟집', '갈치', '전복', '먹방', '식당']],
      ['카페', ['카페', '커피', '디저트', '베이커리', '빵집']],
      ['바다·해변', ['바다', '해변', '해수욕장', '해안']],
      ['오름·산·자연', ['오름', '한라산', '등산', '숲길', '올레길', '일출', '노을', '자연']],
      ['체험·액티비티', ['체험', '액티비티', '카트', '승마', '요트', '서핑', '스노클링', '스쿠버', '다이빙', '패러글라이딩', '짚라인', '테마파크']],
      ['사진·감성', ['사진', '인생샷', '포토', '감성', '스냅']],
      ['쇼핑·시장', ['시장', '쇼핑', '소품샵', '기념품', '면세']],
      ['드라이브·렌터카', ['드라이브', '렌트', '렌터카']],
      ['대중교통(뚜벅이)', ['뚜벅이', '버스 여행', '버스여행', '대중교통']],
      ['숙소', ['숙소', '호텔', '게스트하우스', '게하', '펜션', '리조트', '에어비앤비']]
    ],
    '만족 요인': [
      ['경치·풍경', ['예쁘', '예뻤', '아름답', '아름다웠', '경치가', '풍경이', '뷰가 좋', '뷰 맛집', '뷰맛집', '절경', '멋있', '멋졌']],
      ['음식 맛', ['맛있', '존맛', 'JMT', '꿀맛', '맛집 인정']],
      ['재방문·강추', ['강추', '재방문', '또 가고', '다시 가고', '또 오고', '다시 오고', '꼭 가보', '추천합니다', '추천해요', '추천드려요', '추천드립니다']],
      ['전반적 만족', ['대만족', '만족스러', '좋았', '최고였', '행복했']],
      ['친절·서비스', [/(^|[^불])친절/, '서비스가 좋', '서비스 좋']],
      ['가성비', ['가성비', '저렴', '합리적']],
      ['여유·힐링', ['힐링', '여유롭', '여유로', '휴식', '평화로']]
    ],
    '불편 사항': [
      ['날씨', ['비가 와', '비가 왔', '비가 많이', '비 와서', '비와서', '비가 오', '태풍', '흐려', '흐린 날', '추웠', '너무 더', '바람이 너무', '바람이 많이', '강풍']],
      ['비용', ['비싸', '바가지 요금', '바가지요금', '바가지 씌', '물가', '부담스러']],
      ['교통·이동', ['교통이 불편', '교통 불편', '배차', '버스 기다', '택시 잡', '이동이 힘들', '이동하기 힘들', '멀어서']],
      ['주차', ['주차 어려', '주차가 어려', '주차 힘들', '주차가 힘들', '주차 불편', '주차가 불편', '주차난', '주차 전쟁', '주차 자리가 없', '주차할 곳이 없']],
      ['혼잡·대기', ['웨이팅', '대기 시간', '줄 서', '줄서', '사람이 많', '붐비', '혼잡']],
      ['서비스 불만', ['불친절', '실망', '아쉬웠', /아쉬운 점(?!은 없|이 없|은 딱히 없)/, '별로였']]
    ]
  };
  function hasKw(tx, kws) { return kws.some(function (k) { return typeof k === 'string' ? tx.indexOf(k) >= 0 : k.test(tx); }); }
  function kwText(k) { return typeof k === 'string' ? k : (String(k).indexOf('친절') >= 0 ? '친절(불친절 제외)' : '아쉬운 점(\'없었다\' 제외)'); }
  var MIN_N = 10; // 이보다 적은 건수의 주제는 '표본 적음'으로 표시하고 해석하지 않음
  function renderReviews() {
    var body = $('reviews-body');
    if (!REVIEW_ITEMS) {
      body.innerHTML = '<div class="empty" style="min-height:220px"><div><b>온라인 후기 데이터가 아직 수집되지 않았습니다.</b></div><div>제공된 네이버 API 키로 인증에 실패해(401) 후기를 가져오지 못했습니다.</div><div>네이버 개발자센터 \'검색\' API 키로 <code>scripts/collect_reviews.ps1</code>을 실행하면 이 영역이 채워집니다.</div><div>후기 데이터 없이 주제를 임의로 만들어 표시하지 않습니다.</div></div>';
      K.reviews = null; return;
    }
    var inPeriod = function (it) { if (st.rperiod === 'all') return true; var ym = +String(it.postdate).slice(0, 6); return ym >= st.start && ym <= st.end; };
    var base = REVIEW_ITEMS.filter(inPeriod);                       // 기간 내 수집 글 전체 (비교 기준)
    var items = st.rset === '20s' ? base.filter(is20s) : base;      // 분석 대상
    var n20All = REVIEW_ITEMS.filter(is20s).length;
    var periodText = st.rperiod === 'all' ? '전체 작성 기간' : ymLabel(st.start) + '~' + ymLabel(st.end) + ' 작성';
    var funnel = '수집 ' + fmt(REVIEW_ITEMS.length) + '건 → \'20대\' 언급 ' + fmt(n20All) + '건 → ' + periodText + ' · ' + (st.rset === '20s' ? '\'20대\' 언급 ' : '전체 ') + '<b>' + fmt(items.length) + '건</b> 분석';
    if (!items.length) {
      body.innerHTML = '<p class="note">' + funnel + '</p><div class="empty">' + esc(periodText) + ' 조건에 맞는 수집 후기가 없습니다. 작성 기간을 \'전체 작성 기간\'으로 바꿔 보세요.</div>';
      K.reviews = { n: 0 }; return;
    }
    var textOf = function (it) { return it.title + ' ' + it.desc; };
    var hitsOf = function (list, kws) { return list.filter(function (it) { return hasKw(textOf(it), kws); }); };
    var out = {}, h = '<p class="note" style="margin:0 0 6px">' + funnel + '</p><div class="rv-grid">';
    Object.keys(TOPICS).forEach(function (grp) {
      var rows = TOPICS[grp].map(function (t) {
        var hits = hitsOf(items, t[1]);
        return { name: t[0], kws: t[1], n: hits.length, share: hits.length / items.length, baseShare: hitsOf(base, t[1]).length / base.length, ex: hits.slice(0, 3) };
      }).sort(function (a, b) { return b.n - a.n; });
      out[grp] = rows;
      h += '<div class="rv-col"><h3>' + esc(grp) + '</h3><ol>' + rows.filter(function (r) { return r.n > 0; }).slice(0, 5).map(function (r) {
        return '<li>' + esc(r.name) + ' <span class="cnt">' + fmt(r.n) + '건 · ' + pct(r.share) + (st.rset === '20s' ? ' (전체 ' + pct(r.baseShare) + ')' : '') + (r.n < MIN_N ? ' · <b>표본 적음</b>' : '') + '</span></li>';
      }).join('') + '</ol>' + (rows.every(function (r) { return r.n === 0; }) ? '<div class="cnt">해당 키워드가 나온 글 없음</div>' : '') + '</div>';
    });
    h += '</div>';
    // 후기에 많이 언급된 장소: 비짓제주 검색어의 장소명(괄호 설명 제거, 3글자 이상)이 제목·요약문에 나온 글 수
    var places = PLACE_TERMS.map(function (p) { return { name: p, n: items.filter(function (it) { return textOf(it).indexOf(p) >= 0; }).length }; })
      .filter(function (p) { return p.n > 0; }).sort(function (a, b) { return b.n - a.n; }).slice(0, 10);
    h += '<div class="rv-examples"><b>후기에 많이 언급된 장소 TOP 10</b> <span class="cnt">(장소명 사전: 비짓제주 검색어 상위 ' + PLACE_TERMS.length + '개)</span><ol class="plain">'
      + (places.length ? places.map(function (p) { return '<li>' + esc(p.name) + ' <span class="cnt">' + fmt(p.n) + '건 · ' + pct(p.n / items.length) + '</span></li>'; }).join('') : '<li>언급된 장소 없음</li>') + '</ol></div>';
    var ex = [];
    Object.keys(out).forEach(function (g) { var r = out[g][0]; if (r && r.n) r.ex.slice(0, 1).forEach(function (it) { ex.push('[' + g + '·' + r.name + '] ' + it.postdate + ' <a href="' + esc(it.link) + '" target="_blank" rel="noopener">' + esc(it.title) + '</a> — ' + esc(it.desc.slice(0, 90)) + '…'); }); });
    h += '<div class="rv-examples"><b>근거 예시</b><ul class="plain">' + ex.map(function (e) { return '<li>' + e + '</li>'; }).join('') + '</ul></div>';
    // 근거 글 목록 (최신순 50건)
    var list = items.slice().sort(function (a, b) { return String(b.postdate).localeCompare(String(a.postdate)); }).slice(0, 50);
    h += '<details><summary>근거 글 목록 (최신순 ' + list.length + '건 / ' + fmt(items.length) + '건)</summary><div class="tbl-wrap" id="tbl-reviews"></div></details>';
    h += '<details><summary>분류 규칙 · 수집 정보 · 한계</summary><p class="note">출처: ' + esc(R.source) + ' · 수집 ' + esc(R.collectedAt) + ' · 정렬: 정확도순 · 검색어(각 최대 1,000건): ' + esc(R.queries.join(', ')) + ' · 중복 링크 제거 후 ' + fmt(REVIEW_ITEMS.length) + '건.<br>'
      + '\'20대\' 언급 글 = 제목·요약문에 \'20대\'가 나이 뜻으로 쓰인 글. 제외: 숫자 바로 뒤의 \'20대\', \'CCTV 20대\' 같은 대수 표현, \'20대 때/시절/(초반)부터\'처럼 지난 20대를 회상하는 표현. 그래도 20대에 관한 정보글·다른 연령 작성자의 글이 섞일 수 있어 작성자 연령은 확인되지 않습니다.<br>'
      + '주제 분류: 제목+요약문에 아래 키워드가 하나라도 있으면 해당 주제로 셈(한 글이 여러 주제에 포함될 수 있음). 만족·불편은 평가 표현만 셉니다(예: \'주차장\'·\'코스 추천\'은 제외). 부정문 일부만 걸러내며 맥락 전체는 반영되지 않습니다. ' + MIN_N + '건 미만 주제는 \'표본 적음\'으로 표시하고 요약·해석에 쓰지 않습니다. API는 본문 전체가 아닌 요약문(약 100~200자)만 제공합니다. 광고·협찬 표기가 요약문에 드러난 글은 ' + fmt(REVIEW_ITEMS.filter(function (it) { return /협찬|제공받|원고료|소정의|광고|체험단|지원받/.test(textOf(it)); }).length) + '건뿐이며, 표기 없는 홍보 글은 걸러지지 않습니다.</p>'
      + Object.keys(TOPICS).map(function (g) { return '<p class="note"><b>' + g + '</b>: ' + TOPICS[g].map(function (t) { return t[0] + '(' + t[1].map(kwText).join('/') + ')'; }).join(' · ') + '</p>'; }).join('') + '</details>';
    body.innerHTML = h;
    table($('tbl-reviews'), [{ t: '작성일' }, { t: '제목', html: 1 }, { t: '해당 주제' }],
      list.map(function (it) {
        var tx = textOf(it), tps = [];
        Object.keys(TOPICS).forEach(function (g) { TOPICS[g].forEach(function (t) { if (hasKw(tx, t[1])) tps.push(t[0]); }); });
        return [it.postdate, '<a href="' + esc(it.link) + '" target="_blank" rel="noopener">' + esc(it.title) + '</a>', tps.join(', ') || '-'];
      }));
    K.reviews = { n: items.length, base: base.length, set: st.rset, periodText: periodText, topics: out, places: places };
  }
  // '20대'를 나이 뜻으로 언급한 글. 제외: 숫자 바로 뒤의 '20대'(예: 120대), 'CCTV 20대' 같은 대수 표현,
  // '20대 때/20대때/20대 시절/20대땐'처럼 지난 20대를 회상하는 표현(작성자가 20대가 아닐 가능성이 큼)
  function is20s(it) {
    var tx = (it.title + ' ' + it.desc).replace(/CCTV\s*20대/g, '').replace(/20대\s?(초반|중반|후반)?\s?(때|시절|땐|부터)/g, '');
    return /(^|[^0-9])20대/.test(tx);
  }
  // 후기 속 장소 언급을 셀 장소명 사전: 비짓제주 검색어 수치 상위 장소명
  var PLACE_TERMS = (function () {
    var tot = new Map();
    for (var i = 0; i < S.p.length; i++) { var nm = S.places.name[S.p[i]]; tot.set(nm, (tot.get(nm) || 0) + S.v[i]); }
    var seen = new Set(), outList = [];
    Array.from(tot.entries()).sort(function (a, b) { return b[1] - a[1]; }).forEach(function (e) {
      var nm = e[0].replace(/\(.*?\)/g, '').trim();
      if (nm.length >= 3 && !seen.has(nm) && outList.length < 300) { seen.add(nm); outList.push(nm); }
    });
    return outList;
  })();

  // ---------- 10. 분석 결과 요약 ----------
  function renderSummary() {
    var facts = [], hypo = [], check = [], act = [];
    var lab = ageLabel() + sexLabel();
    if (K.total != null) {
      facts.push(lab + ' 방문객 ' + fmt(K.total) + '명 (' + coverageText(K.ageMonths) + ')' + (K.share != null ? ', 전체 연령 중 ' + pct(K.share) : ''));
      if (K.yoy != null) facts.push('전년 동기 대비 ' + (K.yoy >= 0 ? '+' : '') + pct(K.yoy) + ' (' + ymLabel(K.yoyComp[0]) + '~' + ymLabel(K.yoyComp[K.yoyComp.length - 1]) + ' 기준)');
      // 계절성: 달(1~12)별 평균
      var byM = ageByMonth(st.age, st.sex), cal = {};
      K.ageMonths.forEach(function (m) { var mo = m % 100; (cal[mo] = cal[mo] || []).push(byM[m]); });
      var calAvg = Object.keys(cal).map(function (mo) { return [+mo, cal[mo].reduce(function (a, b) { return a + b; }, 0) / cal[mo].length]; }).sort(function (a, b) { return b[1] - a[1]; });
      if (calAvg.length >= 3) {
        var topMo = calAvg.slice(0, 2).map(function (x) { return x[0] + '월'; });
        facts.push('달별 평균 방문객이 가장 많은 달: ' + topMo.join(', ') + ' (가장 적은 달: ' + calAvg[calAvg.length - 1][0] + '월)');
        if (calAvg.slice(0, 2).some(function (x) { return x[0] === 7 || x[0] === 8; })) hypo.push('여름(7~8월)에 ' + lab + ' 방문이 많아 방학·휴가 시즌의 영향이 있을 수 있습니다(가설).');
        act.push(topMo.join('·') + ' 성수기 직전에 ' + lab + ' 대상 콘텐츠·프로모션을 배치하고, 비수기(' + calAvg[calAvg.length - 1][0] + '월)용 콘텐츠는 별도로 기획하는 방안을 검토합니다.');
      }
      if (st.age !== 'all' && K.ageMonths.length) {
        var ranks = AGES.map(function (a) { return [a, sumAge(K.ageMonths, String(a), st.sex)]; }).sort(function (a, b) { return b[1] - a[1]; });
        var r = ranks.findIndex(function (x) { return String(x[0]) === st.age; }) + 1;
        facts.push('연령대 7개 중 ' + lab + ' 방문 규모 ' + r + '위 (1위 ' + ranks[0][0] + '대' + (st.sex !== 'all' ? ', ' + sexLabel().trim() + ' 기준' : '') + ')');
      }
    } else facts.push('선택 기간에 연령대별 방문 데이터가 없습니다.');
    if (K.dongMonths && K.dongMonths.length) {
      var idx = D.dongs.map(function (d, i) { return i; }).filter(function (i) { return st.sgg === 'all' || D.dongs[i].sgg === st.sgg; }).sort(function (a, b) { return K.dongAgg[b].tot - K.dongAgg[a].tot; });
      facts.push('전체 관광객 기준 방문 상위 읍면동: ' + idx.slice(0, 3).map(function (i) { return D.dongs[i].name + '(' + fmt(K.dongAgg[i].tot) + '명)'; }).join(', '));
    }
    if (K.places && K.places.length) {
      facts.push((st.psort === 'tour' ? '관광객 도착 수' : '도착건수') + ' 상위 장소(' + regionLabel() + (st.pcat !== 'all' ? ', ' + st.pcat : '') + '): ' + K.places.slice(0, 3).map(function (a) { return a.name + '(' + a.cat + ')'; }).join(', '));
      var transport = K.places.slice(0, 10).filter(function (a) { return /공항|항구|렌트카|주차장|주유소/.test(a.cat); }).length;
      if (transport) hypo.push('도착 상위 10곳 중 ' + transport + '곳이 공항·항구·렌터카·주차장 등 이동 거점입니다. 장소 순위에는 관광 목적지보다 이동 동선이 섞여 있을 수 있어, 카테고리 필터로 관광지만 따로 보는 것이 좋습니다.');
    }
    if (K.search && K.search.list.length) {
      var s3 = K.search.list.slice(0, 3);
      facts.push('검색 수치 상위 장소: ' + s3.map(function (a) { return a.name; }).join(', ') + ' (검색 관심도이며 방문·선호를 뜻하지 않음)');
      if (K.places && K.places.length) {
        var pn = new Set(K.places.map(function (a) { return a.name; }));
        var both = K.search.list.slice(0, 20).filter(function (a) { return pn.has(a.name); }).map(function (a) { return a.name; });
        if (both.length) hypo.push('검색 상위 20과 도착 상위 ' + K.places.length + '에 함께 오른 장소: ' + both.slice(0, 5).join(', ') + '. 검색 관심과 실제 방문이 겹치는 장소일 가능성이 있습니다(동일 장소 여부는 이름만으로 맞춘 것이라 확인 필요).');
        else hypo.push('검색 상위 20과 도착 상위 ' + K.places.length + '에 이름이 같은 장소가 없습니다. 검색 관심과 실제 이동 목적지가 다를 수 있습니다(가설).');
        act.push('검색 상위 장소(' + s3[0].name + ' 등)와 방문 상위 읍면동을 잇는 코스형 콘텐츠를 시범 기획하고, 실제 방문 전환 여부를 측정합니다.');
      }
    }
    if (K.reviews && K.reviews.topics) {
      var rl = (K.reviews.set === '20s' ? '\'20대\' 언급 후기 ' : '수집 후기 ') + fmt(K.reviews.n) + '건(' + K.reviews.periodText + ')';
      ['주요 활동', '만족 요인', '불편 사항'].forEach(function (g) {
        var ok = K.reviews.topics[g].filter(function (t) { return t.n >= MIN_N; }).slice(0, 3);
        var mx = K.reviews.topics[g][0];
        if (ok.length) facts.push(rl + ' ' + g + ' 상위: ' + ok.map(function (t) { return t.name + ' ' + pct(t.share) + '(' + fmt(t.n) + '건)'; }).join(', '));
        else facts.push(rl + ' 중 ' + g + ' 표현이 있는 글은 주제별 최대 ' + fmt(mx ? mx.n : 0) + '건으로 적어 판단을 보류합니다(블로그 요약문에는 평가 표현이 드물게 나타남).');
      });
      if (K.reviews.places && K.reviews.places.length) facts.push(rl + '에서 많이 언급된 장소: ' + K.reviews.places.slice(0, 3).map(function (p) { return p.name + '(' + fmt(p.n) + '건)'; }).join(', '));
      if (K.reviews.set === '20s') {
        var distinct = [];
        ['주요 활동', '만족 요인', '불편 사항'].forEach(function (g) { K.reviews.topics[g].forEach(function (t) { if (t.n >= 10 && t.share - t.baseShare >= 0.05) distinct.push(t.name + '(' + pct(t.share) + ' vs 전체 ' + pct(t.baseShare) + ')'); }); });
        if (distinct.length) hypo.push('\'20대\' 언급 후기에서 수집 글 전체보다 5%p 이상 자주 나온 주제: ' + distinct.join(', ') + '. 20대 여행의 특징일 수 있으나, 작성자 연령과 맥락은 확인되지 않은 키워드 기준입니다(가설).');
        else hypo.push('\'20대\' 언급 후기와 수집 글 전체의 주제 비중이 크게 다르지 않습니다(5%p 이상 차이 없음, 10건 이상 주제 기준).');
      }
      var inc = K.reviews.topics['불편 사항'].filter(function (t) { return t.n >= MIN_N; })[0];
      if (inc) act.push('후기에서 가장 많이 언급된 불편(' + inc.name + ')을 줄이는 정보 콘텐츠(사전 안내·대안 동선)를 함께 제공합니다.');
      var act1 = K.reviews.topics['주요 활동'].filter(function (t) { return t.n >= MIN_N; }).slice(0, 2);
      if (act1.length) act.push('후기 주요 활동 상위(' + act1.map(function (t) { return t.name; }).join('·') + ')를 중심으로 20대 대상 테마 코스를 구성하는 방안을 검토합니다.');
    }
    check.push('지역·장소·검색어 데이터에는 연령 정보가 없어 20대만의 지역·장소 선호는 확인할 수 없습니다. 20대 기준 지역·장소 데이터 확보가 필요합니다.');
    check.push('연령대별 \'방문객수\'(예: 2026.08 전 연령 약 500만)와 월별 \'입도 관광객수\'(2026.08 약 133만)의 집계 기준 차이 확인이 필요합니다.');
    check.push('검색어 \'수치\'의 정의와 같은 월·장소가 최대 7행으로 나뉘는 기준을 데이터 제공처에 확인해야 합니다.');
    check.push('인기 장소 데이터 중 도착건수 ≠ 관광객+도민인 ' + fmt(P.mismatchRows) + '행의 원인과 데이터 수집 방식(내비게이션 여부)을 확인해야 합니다.');
    if (!REVIEW_ITEMS) check.push('온라인 후기 데이터가 수집되지 않아 만족 요인·불편 사항은 확인하지 못했습니다(API 키 인증 실패).');
    else check.push('후기는 블로그 요약문 기준 키워드 자동 분류이고 작성자 연령도 확인되지 않습니다. 표본 글을 직접 읽어 문맥·광고 여부를 검토해야 합니다.');
    if (!hypo.length) hypo.push('현재 필터에서 도출할 해석이 없습니다.');
    if (!act.length) act.push('현재 필터에서 도출할 제안이 없습니다.');
    var li = function (arr) { return arr.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join(''); };
    $('sum-facts').innerHTML = li(facts); $('sum-hypo').innerHTML = li(hypo); $('sum-check').innerHTML = li(check); $('sum-action').innerHTML = li(act);
    K.summary = { facts: facts, hypo: hypo };
  }

  // ---------- 데이터 정보 ----------
  function renderDataInfo() {
    table($('tbl-files'), [{ t: '파일' }, { t: '시트' }, { t: '단위' }, { t: '기간' }, { t: '행 수(머리글 제외)', n: 1 }, { t: '컬럼' }, { t: '집계 기준 / 대시보드 사용' }],
      D.files.map(function (f) { var a = f.unit === '일' ? f.min.slice(0, 4) + '.' + f.min.slice(4, 6) + '.' + f.min.slice(6) : ymLabel(f.min), b = f.unit === '일' ? f.max.slice(0, 4) + '.' + f.max.slice(4, 6) + '.' + f.max.slice(6) : ymLabel(f.max); return [f.file, f.sheet, f.unit, a + ' ~ ' + b, fmt(f.rows), f.cols.join(', '), f.basis]; }));
    table($('tbl-apply'), [{ t: '영역' }, { t: '사용 데이터' }, { t: '기간' }, { t: '연령대·성별' }, { t: '시군구' }, { t: '읍면동' }], [
      ['③④⑤ 핵심 지표·방문 추이', '제주 연령대별 방문', '적용', '적용', '미적용(제주 전체 값만 있음)', '미적용'],
      ['⑥ 지역별 방문', '제주 지역별 방문객(읍면동)', '적용', '미적용(연령 없음)', '적용(TOP10·표)', '지도·표에서 강조'],
      ['⑦ 인기 장소', '제주 지역별 인기 장소', '적용', '미적용(연령 없음)', '적용', '적용'],
      ['⑧ 관광 검색어', '비짓제주 검색어 순위', '적용', '미적용(연령 없음)', '적용(주소의 시 기준)', '시 단위로만 적용'],
      ['⑨ 온라인 후기', '네이버 블로그 검색 결과', '적용(작성일 기준, \'전체 작성 기간\' 선택 시 미적용)', '미적용(작성자 연령 미상 — 대신 \'20대\' 언급 글 선택 가능)', '미적용', '미적용']
    ]);
    var m = [
      '지도: 행정동 경계(vuski/admdongkor ver20260701, 통계청 SGIS 원자료, CC BY 4.0)의 제주 43개 읍면동에 \'제주 지역별 방문객(읍면동)\'을 읍면동코드(10자리 = 경계의 adm_cd2)로 연결했습니다. 43개 모두 코드와 이름이 일치했습니다. 색상 = 선택 기간의 선택 지표(총/내국인/외국인 방문객수) 월 합계.',
      '지도에는 경계로 위치가 확인되는 읍면동 방문객 데이터만 씁니다. 장소·검색어 데이터는 좌표가 없어 지도에 표시하지 않습니다.',
      '인기 장소의 읍면동은 원본 읍면동코드(8자리 = 경계의 adm_cd)로 연결했고, 81만 행 모두 코드와 이름이 일치했습니다.',
      '워드클라우드: \'비짓제주 검색어 순위\'의 \'지역명\'(장소·업체명)별로 선택 기간·분류·시의 \'수치\'를 합산한 상위 80개. 글자 크기는 합계에 비례합니다. 같은 이름의 여러 지점(주소)은 하나로 합칩니다(표의 \'주소 수\' 참고).',
      '빈 값·이상값은 삭제하지 않았습니다. 원본에서 빈 칸은 발견되지 않았습니다.'
    ];
    $('method-list').innerHTML = m.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('');
    $('build-log').textContent = '생성 ' + D.generatedAt + '\n' + D.buildLog;
    var a = AGE_MONTHS, p = PLACE_MONTHS;
    $('meta-period').textContent = '연령대별·읍면동·검색어 ' + ymLabel(a[0]) + '~' + ymLabel(a[a.length - 1]) + ' / 인기 장소 ' + ymLabel(p[0]) + '~' + ymLabel(p[p.length - 1]) + ' (월 단위). 현재 선택: ' + ymLabel(st.start) + '~' + ymLabel(st.end);
  }

  // ---------- 렌더링 ----------
  function render() {
    renderChips(); renderKpi(); renderTrend(); renderRegion(); renderPlaces(); renderSearch(); renderReviews(); renderSummary(); renderDataInfo();
  }

  function init() {
    hasCloud = !!(echarts && echarts.ComponentModel && (function () { try { var t = document.createElement('div'); t.style.cssText = 'width:10px;height:10px;position:absolute;left:-99px'; document.body.appendChild(t); var c = echarts.init(t); c.setOption({ series: [{ type: 'wordCloud', data: [] }] }); c.dispose(); t.remove(); return true; } catch (e) { return false; } })());
    buildFilters(); bindFilters();
    $('loading').hidden = true; $('app').hidden = false;
    render();
    window.addEventListener('resize', function () { document.querySelectorAll('.chart').forEach(function (el) { var c = echarts.getInstanceByDom(el); if (c) c.resize(); }); });
    if (/selftest=1/.test(location.search)) selfTest();
  }

  // ---------- 셀프 테스트: 필터를 바꿔 가며 화면 값을 기록 (검증용) ----------
  function selfTest() {
    var out = [];
    var snap = function (name) {
      var txt = function (id) { return $(id).textContent; };
      var rows = function (id, n) { return Array.from($(id).querySelectorAll('tbody tr')).slice(0, n).map(function (tr) { return Array.from(tr.children).map(function (td) { return td.textContent; }).join(' | '); }); };
      var trend = echarts.getInstanceByDom($('ch-trend'));
      out.push({
        case: name, state: JSON.parse(JSON.stringify(st)),
        kpi1: txt('kpi1-value'), kpi1desc: txt('kpi1-desc'), kpi2: txt('kpi2-value'), kpi2desc: txt('kpi2-desc'),
        trendSeries: trend ? trend.getOption().series.map(function (s) { return s.name + ':' + s.data.filter(function (v) { return v != null; }).length; }) : txt('ch-trend'),
        regionTop: rows('tbl-region', 3), placesTop: rows('tbl-places', 3), searchTop: rows('tbl-search', 3),
        empties: Array.from(document.querySelectorAll('.empty')).map(function (e) { return e.closest('section').id + ': ' + e.textContent.slice(0, 60); }),
        reviews: K.reviews && K.reviews.topics ? { n: K.reviews.n, base: K.reviews.base, period: K.reviews.periodText, topics: Object.keys(K.reviews.topics).map(function (g) { return g + ': ' + K.reviews.topics[g].map(function (t) { return t.name + ' ' + t.n; }).join(', '); }), places: K.reviews.places.map(function (p) { return p.name + ' ' + p.n; }).join(', '), ex: out.length ? null : Object.keys(K.reviews.topics).map(function (g) { return K.reviews.topics[g].filter(function (t) { return t.n; }).map(function (t) { return t.name + ' :: ' + t.ex.map(function (it) { return (it.title + ' | ' + it.desc).slice(0, 160); }).join(' ### '); }); }) } : $('reviews-body').textContent.slice(0, 120),
        hypo: K.summary.hypo,
        facts: K.summary.facts
      });
    };
    var set = function (id, v) { var el = $(id); el.value = String(v); el.dispatchEvent(new Event('change')); };
    snap('기본값');
    set('f-start', 202501); set('f-end', 202512); snap('2025년');
    set('f-age', '30'); snap('2025년 30대');
    set('f-sex', 'W'); snap('2025년 30대 여성');
    $('f-reset').click(); set('f-sgg', '서귀포시'); snap('서귀포시');
    set('f-sgg', 'all'); set('f-dong', String(D.dongs.findIndex(function (d) { return d.name === '애월읍'; }))); snap('애월읍');
    $('f-reset').click(); set('f-start', 202609); set('f-end', 202609); snap('2026.09만 (연령·지역·검색 데이터 없음)');
    $('f-reset').click(); set('f-start', 202401); set('f-end', 202412); snap('2024년 (전년 데이터 없음)');
    $('f-reset').click(); set('f-pcat', '해수욕장'); set('f-scat', '관광지'); snap('카테고리 해수욕장·검색 관광지');
    $('f-reset').click(); set('f-rperiod', 'all'); snap('후기: 20대 언급·전체 작성 기간');
    set('f-rset', 'all'); snap('후기: 수집 전체·전체 작성 기간');
    $('f-reset').click(); set('f-start', 202601); snap('후기: 2026.01~2026.08');
    $('f-reset').click();
    // 워드클라우드는 비동기로 그려지므로 잠시 뒤 캔버스에 실제로 칠해진 픽셀이 있는지 확인
    setTimeout(function () {
      var cv = $('ch-cloud').querySelector('canvas'), painted = -1;
      if (cv) { var ctx = cv.getContext('2d'), d = ctx.getImageData(0, 0, cv.width, cv.height).data; painted = 0; for (var i = 3; i < d.length; i += 4) if (d[i] > 0) painted++; }
      out.push({ case: '워드클라우드 렌더링 확인', hasCloud: hasCloud, canvas: !!cv, paintedPixels: painted, png: cv ? cv.toDataURL('image/png') : '', mapPng: (function () { var c = $('ch-map').querySelector('canvas'); return c ? c.toDataURL('image/png') : ''; })(), words: (function () { var c = echarts.getInstanceByDom($('ch-cloud')); return c ? c.getOption().series[0].data.length : 0; })() });
      var pre = $('selftest'); pre.hidden = false; pre.textContent = 'SELFTEST_JSON_START' + JSON.stringify(out) + 'SELFTEST_JSON_END';
    }, 3000);
  }

  init();
})();
