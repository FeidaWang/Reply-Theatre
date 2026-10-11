(() => {
  'use strict';
  const el = id => document.getElementById(id);
  const icons = window.REPLAY_ICONS || {};
  const embedded = el('dataset'), offline = Boolean(embedded);
  const labels = {add:'创建',update:'修改',delete:'删除',completed:'已完成',failed:'失败',declined:'已拒绝',inProgress:'进行中',interrupted:'已中断'};
  let data, turnId = '', stepId = '', view = 'split', file = '', attempts = false, search = '', wrap = false;
  let key, persistTimer, playTimer, toastTimer, writes = Promise.resolve(), playing = false, loading = false, loadId = 0;
  const escape = text => String(text ?? '').replace(/[&<>"']/g,c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function mountIcons(scope = document) {
    for(const node of scope.querySelectorAll('[data-icon]')) {
      node.innerHTML = icons[node.dataset.icon] || '';
      const svg = node.querySelector('svg');
      if(svg) {svg.setAttribute('aria-hidden','true');svg.setAttribute('focusable','false');}
    }
  }
  const turn = () => data?.turns.find(t => t.id === turnId);
  const filtered = () => (turn()?.steps || []).filter(s => (!file || s.path === file) && (attempts || s.applied) && s.displayPath.toLowerCase().includes(search.trim().toLowerCase()));
  const current = () => filtered().find(s => s.id === stepId);
  const position = () => ({turnId,stepId,view,file,attempts,savedAt:Date.now()});
  const basename = path => path.replace(/\\/g,'/').split('/').pop() || path;
  const dirname = path => path.replace(/\\/g,'/').split('/').slice(0,-1).join('/') || '项目根目录';
  const dateLabel = seconds => seconds ? new Date(seconds*1000).toLocaleString('zh-CN',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}) : '时间未知';
  function toast(message) {
    clearTimeout(toastTimer);el('toast').textContent = message;el('toast').hidden = false;
    toastTimer = setTimeout(() => {el('toast').hidden = true;},2500);
  }
  function save() {
    if(!data) return;
    const state = position();
    try {localStorage.setItem(key,JSON.stringify({...state,search,wrap,speed:el('speed').value}));} catch {}
    if(offline) {el('save-state').textContent = '浏览位置已保存';return;}
    el('save-state').textContent = '保存位置…';clearTimeout(persistTimer);
    persistTimer = setTimeout(() => {
      writes = writes.catch(() => {}).then(async () => {
        try {
          const response = await fetch('position',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(state)});
          if(!response.ok) throw Error();
          el('save-state').textContent = '位置已保存';
        } catch {el('save-state').textContent = '位置仅保存在浏览器';}
      });
    },120);
  }
  function error(message) {el('error-text').textContent = message;el('error').hidden = !message;}
  function loadingControls() {
    for(const id of ['turns','search','files','attempts','clear-filters','wrap','speed','split','unified']) el(id).disabled = loading || !data;
    if(!loading && data) el('turns').disabled = !data.turns.length;
    if(loading) for(const id of ['prev','next','restart','play','copy']) el(id).disabled = true;
  }
  function playerUI() {
    document.body.dataset.playing = String(playing);
    el('play').setAttribute('aria-label',playing ? '暂停回放' : '播放回放');
    el('play-label').textContent = playing ? '暂停' : '播放';
    el('play-icon').dataset.icon = playing ? 'pause' : 'play';
    mountIcons(el('play'));
  }
  function pause() {
    const wasPlaying = playing;clearTimeout(playTimer);playing = false;playerUI();
    if(wasPlaying) el('timeline-status').textContent = '已暂停 · 点击播放继续';
  }
  function schedule() {
    clearTimeout(playTimer);
    if(!playing) return;
    playTimer = setTimeout(() => {
      const list = filtered(), index = list.findIndex(s => s.id === stepId);
      if(index >= list.length-1) {pause();el('timeline-status').textContent = '回放结束 · 可以从头再看';return;}
      stepId = list[index+1].id;render();save();
      if(index+1 >= list.length-1) {pause();el('timeline-status').textContent = '回放结束 · 可以从头再看';}
      else schedule();
    },Number(el('speed').value));
  }
  function togglePlay() {
    if(playing) {pause();return;}
    const list = filtered();if(list.length < 2 || loading) return;
    if(list.findIndex(s => s.id === stepId) === list.length-1) stepId = list[0].id;
    playing = true;render();save();schedule();
  }
  async function load(initial = false) {
    const request = ++loadId;pause();loading = true;el('replay').setAttribute('aria-busy','true');
    loadingControls();
    el('refresh').disabled = true;el('play').disabled = true;
    try {
      const next = offline ? JSON.parse(embedded.textContent) : await fetch('data',{cache:'no-store'}).then(r => {if(!r.ok) throw Error('已保存的历史暂时不可用');return r.json();});
      if(request !== loadId) return;
      if(![1,2].includes(next.schemaVersion) || !Array.isArray(next.turns)) throw Error('不支持的回放数据版本');
      data = next;key = 'replay-theater:v1:' + data.threadId;
      if(initial) {
        let saved = {}, preferences = {};
        try {saved = JSON.parse(localStorage.getItem(key) || '{}');preferences = saved;} catch {}
        if(!offline) {
          try {
            const response = await fetch('position',{cache:'no-store'});
            if(response.ok) {const remote = await response.json();if((remote.savedAt || 0) >= (saved.savedAt || 0)) saved = remote;}
          } catch {}
        }
        if(request !== loadId) return;
        turnId = saved.turnId || '';stepId = saved.stepId || '';
        view = ['split','unified'].includes(saved.view) ? saved.view : (window.matchMedia('(max-width:900px)').matches ? 'unified' : 'split');
        file = saved.file || '';attempts = saved.attempts === true;
        search = typeof preferences.search === 'string' ? preferences.search : '';wrap = preferences.wrap === true;
        if(preferences.speed === '3000') preferences.speed = '3600';
        if(['900','1800','3600'].includes(preferences.speed)) el('speed').value = preferences.speed;
        el('step-panel').open = !window.matchMedia('(max-width:900px)').matches;
      }
      if(!data.turns.some(t => t.id === turnId)) {turnId = data.turns[0]?.id || '';stepId = '';}
      el('turns').replaceChildren();
      data.turns.forEach((t,n) => {
        const option = document.createElement('option');option.value = t.id;
        option.textContent = (n === 0 ? '最近 · ' : '')+dateLabel(t.startedAt)+' · '+t.steps.length+' 次操作 · '+labels[t.status];
        el('turns').append(option);
      });
      if(!data.turns.length) {const option = document.createElement('option');option.textContent = '暂无可回放的历史回合';el('turns').append(option);}
      else el('turns').value = turnId;
      el('turns').disabled = !data.turns.length;
      el('attempts').checked = attempts;el('search').value = search;el('wrap').checked = wrap;
      el('warnings').replaceChildren();
      for(const text of data.warnings || []) {const li = document.createElement('li');li.textContent = text;el('warnings').append(li);}
      el('source').textContent = (offline ? '离线快照' : data.schemaVersion === 2 ? '编辑快照 · 包含工具补录' : '原生编辑快照')+' · '+dateLabel(Date.parse(data.generatedAt)/1000)+(data.source?.truncated ? ' · 更早历史未载入' : ' · 仅在本机保存');
      el('save-state').textContent = initial && stepId ? '已恢复浏览位置' : '本地回放';
      rebuildFiles();loading = false;render();error('');
      if(!initial) toast('已重新载入保存的快照');
    } catch(e) {
      loading = false;error('无法载入回放：' + e.message);
      if(!data) {el('heading').textContent = '历史暂时不可用';el('directory').textContent = '点击上方重试，或重新运行 Replay Theater 技能。';el('count').textContent = '尚未载入';}
      else render();
    } finally {
      if(request === loadId) {loading = false;loadingControls();el('refresh').disabled = false;el('replay').setAttribute('aria-busy','false');}
    }
  }
  function rebuildFiles() {
    const paths = [...new Map((turn()?.steps || []).map(s => [s.path,s.displayPath])).entries()];
    if(!paths.some(([path]) => path === file)) file = '';
    el('files').replaceChildren();
    for(const [path,name] of [['','全部文件'],...paths]) {const option = document.createElement('option');option.value = path;option.textContent = name;el('files').append(option);}
    el('files').value = file;el('files').title = file || '全部文件';
  }
  function stats() {
    const steps = (turn()?.steps || []).filter(s => s.applied && (!s.provenance || s.provenance.type === 'native' || s.provenance.attribution === 'window'));
    el('stat-edits').textContent = steps.length;el('stat-files').textContent = new Set(steps.map(s => s.path)).size;
    el('stat-added').textContent = '+'+steps.reduce((n,s) => n+s.added,0);el('stat-removed').textContent = '−'+steps.reduce((n,s) => n+s.removed,0);
    const proposed = (turn()?.steps || []).filter(s => !s.applied).length;
    el('attempts-count').hidden = !proposed;el('attempts-count').textContent = proposed;
  }
  function timeline(list,index) {
    el('filmstrip').replaceChildren();
    const bins = Math.min(60,list.length);
    for(let n=0;n<bins;n++) {
      const start = Math.floor(n*list.length/bins), end = Math.floor((n+1)*list.length/bins);
      const group = list.slice(start,end), add = group.reduce((a,s) => a+s.added,0), del = group.reduce((a,s) => a+s.removed,0);
      const button = document.createElement('button');button.className = 'film-frame'+(group.some(s => !s.applied) ? ' proposed' : '');
      button.setAttribute('aria-label','跳到第 '+(start+1)+' 步：'+group[0].displayPath);
      button.title = (start+1)+(end-start > 1 ? '–'+end : '')+' · '+group[0].displayPath+' · +'+add+' / −'+del;
      button.dataset.stepId = group[0].id;button.setAttribute('aria-current',index >= start && index < end ? 'step' : 'false');
      for(const [count,type] of [[add,'add'],[del,'del']]) {
        if(count) {const segment = document.createElement('span');segment.className = 'frame-'+type;segment.style.flexGrow = String(count);button.append(segment);}
      }
      button.onclick = () => {if(loading) return;pause();stepId = group[0].id;render();save();};el('filmstrip').append(button);
    }
    const total = (turn()?.steps || []).filter(s => attempts || s.applied).length;
    el('timeline-label').textContent = list.length === total ? list.length+' 次操作 · 按时间顺序' : '当前筛选 '+list.length+' / '+total+' 次操作';
    el('timeline-status').textContent = playing ? '正在播放…' : '点击胶片跳步';
  }
  function cells(line,side) {
    if(!line) return '<td class="line-number'+(side === 'new' ? ' middle' : '')+'"></td><td>&#8203;</td>';
    const type = line.op === '+' ? 'added' : line.op === '-' ? 'removed' : '';
    return '<td class="line-number '+(side === 'new' ? 'middle ' : '')+type+'">'+(line[side] ?? '')+'</td><td class="'+type+'">'+(escape(line.text) || '&#8203;')+'</td>';
  }
  function splitLines(lines) {
    if(!wrap) {
      const pairs = [], before = [], after = [];
      const flush = () => {for(let i=0;i<Math.max(before.length,after.length);i++) pairs.push({old:before[i],new:after[i]});before.length = 0;after.length = 0;};
      for(const line of lines) {
        if(line.op === '-') before.push(line);
        else if(line.op === '+') after.push(line);
        else {flush();pairs.push(line.op === ' ' ? {old:line,new:line} : {note:line});}
      }
      flush();
      return '<div class="split-content">'+['old','new'].map(side => {
        const rows = pairs.map(pair => pair.note ? '<tr><td colspan="2" class="'+(pair.note.op === '@' ? 'hunk' : 'note')+'">'+escape(pair.note.text)+'</td></tr>' : '<tr>'+cells(pair[side],side)+'</tr>').join('');
        return '<div class="split-pane" tabindex="0" aria-label="'+(side === 'old' ? '修改前代码' : '修改后代码')+'，可横向滚动"><table class="diff-table pane-table"><colgroup><col class="line-number"><col></colgroup><thead><tr><th colspan="2">'+(side === 'old' ? '修改前' : '修改后')+'</th></tr></thead><tbody>'+rows+'</tbody></table></div>';
      }).join('')+'</div>';
    }
    let rows = '', before = [], after = [];
    const flush = () => {for(let i=0;i<Math.max(before.length,after.length);i++) rows += '<tr>'+cells(before[i],'old')+cells(after[i],'new')+'</tr>';before = [];after = [];};
    for(const line of lines) {
      if(line.op === '-') before.push(line);else if(line.op === '+') after.push(line);
      else {flush();if(line.op === ' ') rows += '<tr>'+cells(line,'old')+cells(line,'new')+'</tr>';else rows += '<tr><td colspan="4" class="'+(line.op === '@' ? 'hunk' : 'note')+'">'+escape(line.text)+'</td></tr>';}
    }
    flush();
    return '<table class="diff-table split-table"><colgroup><col class="line-number"><col><col class="line-number"><col></colgroup><thead><tr><th colspan="2">修改前</th><th class="middle" colspan="2">修改后</th></tr></thead><tbody>'+rows+'</tbody></table>';
  }
  function unifiedLines(lines) {
    const rows = lines.map(line => {
      if(['@','!','?'].includes(line.op)) return '<tr><td colspan="3" class="'+(line.op === '@' ? 'hunk' : 'note')+'">'+escape(line.text)+'</td></tr>';
      const type = line.op === '+' ? 'added' : line.op === '-' ? 'removed' : '';
      return '<tr><td class="line-number '+type+'">'+(line.old ?? '')+'</td><td class="line-number '+type+'">'+(line.new ?? '')+'</td><td class="'+type+'">'+escape(line.op+' '+line.text)+'</td></tr>';
    }).join('');
    return '<table class="diff-table unified-table"><colgroup><col class="line-number"><col class="line-number"><col></colgroup><tbody>'+rows+'</tbody></table>';
  }
  function emptyState() {
    const hasTurns = data.turns.length > 0, allProposed = (turn()?.steps.length || 0) > 0 && !turn().steps.some(s => s.applied);
    const title = hasTurns ? '没有匹配的编辑' : '还没有可回放的编辑';
    const message = !hasTurns ? '有文件编辑的回合结束后，再运行回放即可。当前调用所在的回合会默认跳过。' : allProposed && !attempts ? '这个回合只有未完成操作。勾选“显示未完成操作”可查看提议 diff。' : '换个文件名试试，或清除筛选查看这个回合的全部编辑。';
    el('diff').innerHTML = '<div class="empty-state"><span data-icon="search"></span><h3>'+title+'</h3><p>'+message+'</p>'+(hasTurns && !allProposed ? '<button id="empty-clear" class="primary-button">清除筛选</button>' : '')+'</div>';
    if(el('empty-clear')) el('empty-clear').onclick = clearFilters;mountIcons(el('diff'));
  }
  function render() {
    if(!data) return;
    const list = filtered();let index = list.findIndex(s => s.id === stepId);if(index < 0) index = 0;
    if(list.length) stepId = list[index].id;
    const focused = document.activeElement?.dataset.stepId;
    const focusedRegion = document.activeElement?.closest('#filmstrip') ? 'filmstrip' : 'steps';
    el('steps').replaceChildren();
    list.forEach((step,n) => {
      const button = document.createElement('button');button.type = 'button';button.className = 'step-button';button.dataset.stepId = step.id;
      button.setAttribute('aria-current',n === index ? 'step' : 'false');button.setAttribute('aria-label','第 '+(n+1)+' 步：'+step.displayPath+'，'+labels[step.kind]+'，'+labels[step.status]);button.title = step.displayPath;
      button.innerHTML = '<span class="step-index">'+String(n+1).padStart(2,'0')+'</span><span class="step-content"><span class="step-name">'+escape(basename(step.displayPath))+'</span><span class="step-directory">'+escape(dirname(step.displayPath))+'</span><span class="step-detail">'+escape(labels[step.kind])+'<span class="added-text">+'+step.added+'</span><span class="removed-text">−'+step.removed+'</span>'+(step.applied ? '' : '<span>'+escape(labels[step.status])+'</span>')+'</span></span>';
      button.onclick = () => {if(loading) return;pause();stepId = step.id;render();save();};el('steps').append(button);
    });
    el('list-count').textContent = list.length;el('prev').disabled = !list.length || index === 0;
    el('next').disabled = !list.length || index === list.length-1;el('restart').disabled = !list.length || index === 0;
    el('play').disabled = list.length < 2 || loading;el('copy').disabled = !list.length;
    el('count').textContent = list.length ? '第 '+(index+1)+' / '+list.length+' 步' : '0 步';
    el('split').setAttribute('aria-pressed',view === 'split');el('unified').setAttribute('aria-pressed',view === 'unified');
    el('clear-filters').hidden = !file && !search.trim() && !attempts;
    el('diff').classList.toggle('wrap-code',wrap);el('diff-hint').textContent = wrap ? '自动换行已开启 · diff 为当时的记录片段' : view === 'split' ? '左右面板可分别横向滚动 · 保留原始行形' : '保留原始代码行 · 长行可横向滚动';
    el('attempt-note').hidden = true;el('capture-note').hidden = true;stats();timeline(list,index);playerUI();
    if(focused) {const target = [...el(focusedRegion).querySelectorAll('button')].find(b => b.dataset.stepId === focused);target?.focus({preventScroll:true});}
    if(!list.length) {
      el('heading').textContent = '编辑差异';el('directory').textContent = '选择一个编辑步骤，查看当时的变化。';el('meta').textContent = '';el('kind-badge').hidden = true;el('step-kind').textContent = '';emptyState();return;
    }
    const step = list[index];el('heading').textContent = basename(step.displayPath)+(step.displayMovePath ? ' → '+basename(step.displayMovePath) : '');
    el('directory').textContent = step.displayPath+(step.displayMovePath ? ' → '+step.displayMovePath : '');el('directory').title = el('directory').textContent;
    el('kind-badge').hidden = false;el('kind-badge').textContent = step.displayMovePath ? '移动 / 修改' : labels[step.kind];
    const capture = step.provenance?.type === 'snapshot' ? step.provenance : null;
    el('meta').innerHTML = '<span>'+escape(capture ? '已观察到修改' : labels[step.status])+'</span><span class="added-text">+'+step.added+'</span><span class="removed-text">−'+step.removed+'</span>';
    el('step-kind').textContent = '原生文件编辑';
    if(capture) {
      const tool = capture.toolName === 'Bash' ? 'Shell' : capture.toolName.startsWith('mcp__') ? 'MCP' : '工具';
      const mode = capture.mode === 'manual' ? '手动采集' : capture.mode === 'test' ? '采集器测试' : '自动补录';
      const notes = [mode+' · '+tool+' 执行期间观察到的文件变化。'];
      if(capture.toolStatus === 'failed') notes.push('工具返回失败，但这些文件变化已经发生。');
      if(Number.isInteger(capture.exitCode)) notes.push(`退出码 ${capture.exitCode}。`);
      if(capture.toolStatusSource === 'native-transcript-completion') notes.push('退出状态来自匹配的原生完成事件。');
      if(capture.toolStatus === 'unknown' || capture.toolStatus === 'interrupted') notes.push('工具结果未知或已中断。');
      if(capture.attribution !== 'window') notes.push('执行窗口重叠或缺少完整事件，无法精确归因；未计入顶部确认统计。');
      if(capture.ordering === 'unresolved') notes.push('未匹配原生工具 ID，具体先后顺序待确认。');
      if(capture.limited) notes.push('部分文件受采集范围或扫描限制，未完整覆盖。');
      el('capture-note').textContent = notes.join(' ');el('capture-note').hidden = false;
      el('step-kind').textContent = tool+' · '+mode;
    }
    if(!step.applied) {el('attempt-note').hidden = false;el('attempt-note').textContent = labels[step.status]+' · 以下是提议 diff，未确认完整执行。失败操作可能有部分副作用。';}
    el('diff').innerHTML = step.lines.length ? (view === 'split' ? splitLines(step.lines) : unifiedLines(step.lines)) : '<div class="empty-state"><h3>没有文本行变化</h3><p>这可能是空文件或仅移动路径的操作。</p></div>';
  }
  function go(delta) {if(!data || loading) return;pause();const list = filtered(), index = Math.max(0,list.findIndex(s => s.id === stepId));stepId = list[Math.max(0,Math.min(index+delta,list.length-1))]?.id || '';render();save();}
  function jump(last = false) {if(loading) return;pause();const list = filtered();stepId = (last ? list[list.length-1] : list[0])?.id || '';render();save();}
  function clearFilters() {if(loading) return;pause();file = '';search = '';attempts = false;el('files').value = '';el('files').title = '全部文件';el('search').value = '';el('attempts').checked = false;render();save();}
  function close() {pause();save();el('replay').hidden = true;el('closed').hidden = false;el('close').hidden = true;el('reopen').focus();}
  function showDialog(id) {pause();el(id).showModal();}
  el('prev').onclick = () => go(-1);el('next').onclick = () => go(1);el('restart').onclick = () => jump();el('play').onclick = togglePlay;
  el('speed').onchange = () => {save();if(playing) schedule();};
  el('split').onclick = () => {view = 'split';render();save();};el('unified').onclick = () => {view = 'unified';render();save();};
  el('files').onchange = () => {pause();file = el('files').value;el('files').title = file || '全部文件';render();save();};
  el('search').oninput = () => {pause();search = el('search').value;render();save();};
  el('turns').onchange = () => {pause();turnId = el('turns').value;file = '';search = '';stepId = '';el('search').value = '';rebuildFiles();render();save();};
  el('attempts').onchange = () => {pause();attempts = el('attempts').checked;render();save();};
  el('wrap').onchange = () => {wrap = el('wrap').checked;render();save();};
  el('clear-filters').onclick = clearFilters;el('refresh').onclick = () => load();el('refresh').hidden = offline;el('retry').onclick = () => load(!data);
  el('close').onclick = close;el('reopen').onclick = () => {el('replay').hidden = false;el('closed').hidden = true;el('close').hidden = false;el('play').focus();};
  el('help').onclick = () => showDialog('help-dialog');el('about').onclick = () => showDialog('about-dialog');
  document.querySelectorAll('[data-dismiss]').forEach(button => {button.onclick = () => button.closest('dialog').close();});
  document.querySelectorAll('dialog').forEach(dialog => {dialog.addEventListener('click',event => {if(event.target === dialog) {const r = dialog.getBoundingClientRect();if(event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) dialog.close();}});});
  el('copy').onclick = async () => {
    const step = current();if(!step) return;
    try {await navigator.clipboard.writeText(step.diff);toast('当前 diff 已复制');} catch {toast('剪贴板暂时不可用，可在代码区域选择文字复制');}
  };
  document.addEventListener('keydown',e => {
    if(document.querySelector('dialog[open]')) return;
    if(loading && !['?','Escape'].includes(e.key)) return;
    if(/INPUT|TEXTAREA|SELECT/.test(e.target.tagName) || e.target.isContentEditable || e.ctrlKey || e.metaKey || e.altKey) return;
    if(e.target.closest('#diff') && ['ArrowRight','ArrowLeft','Home','End',' '].includes(e.key)) return;
    if(e.key === '?') {e.preventDefault();showDialog('help-dialog');}
    else if(e.key === 'Escape' && !el('replay').hidden) {e.preventDefault();close();}
    else if(data && !el('replay').hidden) {
      if(['n','N','ArrowRight','p','P','ArrowLeft'].includes(e.key)) {e.preventDefault();go(['n','N','ArrowRight'].includes(e.key) ? 1 : -1);}
      else if(e.key === ' ') {e.preventDefault();togglePlay();}
      else if(['Home','End'].includes(e.key)) {e.preventDefault();jump(e.key === 'End');}
    }
  });
  document.addEventListener('visibilitychange',() => {if(document.hidden) pause();});
  window.addEventListener('pagehide',() => {pause();if(data && !offline && navigator.sendBeacon) {clearTimeout(persistTimer);navigator.sendBeacon('position',JSON.stringify(position()));}});
  window.matchMedia('(max-width:900px)').addEventListener('change',e => {el('step-panel').open = !e.matches;});
  mountIcons();load(true);
})();
