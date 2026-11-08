(() => {
  'use strict';
  const el = id => document.getElementById(id);
  const icons = window.REPLAY_ICONS || {};
  const embedded = el('dataset'), offline = Boolean(embedded);
  const mcp = window.REPLAY_MCP;
  const localPage = !offline && !mcp;
  const labels = {add:'New',update:'Modified',delete:'Deleted',completed:'Completed',failed:'Failed',declined:'Declined',inProgress:'In progress',interrupted:'Interrupted'};
  const legacyWarnings = new Map([
    ['仅包含原生 fileChange；Shell、格式化器、MCP 和子代理的改动可能缺失。', 'Replay includes native file edits. Changes from shell commands, formatters, MCP tools, and subagents may be missing.'],
    ['diff 是当时的记录；未读取当前文件，也不代表完整文件版本。', 'Diffs show changes as they were recorded and may include only part of a file.'],
  ]);
  const compact = window.matchMedia('(max-width:720px)');
  const narrow = window.matchMedia('(max-width:560px)');
  const scopeButtons = [...el('scope').querySelectorAll('button')];
  const canAnnotate = localPage && typeof document.oai?.annotation?.request === 'function';
  let data, turnId = '', stepId = '', view = 'split', scope = 'applied', search = '', wrap = false, listOpen = !compact.matches;
  let renderedStepId;
  let key, persistTimer, playTimer, toastTimer, writes = Promise.resolve(), playing = false, loading = false, loadId = 0;
  const escape = text => String(text ?? '').replace(/[&<>"']/g,c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function mountIcons(root = document) {
    for(const node of root.querySelectorAll('[data-icon]')) {
      node.innerHTML = icons[node.dataset.icon] || '';
      const svg = node.querySelector('svg');
      if(svg) {svg.setAttribute('aria-hidden','true');svg.setAttribute('focusable','false');}
    }
  }
  const turn = () => data?.turns.find(t => t.id === turnId);
  function needsReview(step) {
    const capture = step.provenance;
    return !step.applied || (capture?.type === 'snapshot' &&
      (capture.toolStatus !== 'succeeded' || capture.attribution !== 'window' ||
       capture.ordering === 'unresolved' || capture.limited));
  }
  function filtered() {
    const query = search.trim().toLowerCase();
    return (turn()?.steps || []).filter(step =>
      (scope === 'all' || (scope === 'review' ? needsReview(step) : step.applied)) &&
      step.displayPath.toLowerCase().includes(query));
  }
  const current = () => filtered().find(s => s.id === stepId);
  // `file` stays in the payload: the local server validates the position shape.
  const position = () => ({turnId,stepId,view,file:'',scope,attempts:scope !== 'applied',savedAt:Date.now()});
  const basename = path => path.replace(/\\/g,'/').split('/').pop() || path;
  const effectiveView = () => narrow.matches ? 'unified' : view;
  const dateLabel = seconds => seconds ? new Date(seconds*1000).toLocaleString('en-US',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit',hour12:false}) : 'Unknown time';
  function toast(message) {
    clearTimeout(toastTimer);el('toast').textContent = message;el('toast').hidden = false;
    toastTimer = setTimeout(() => {el('toast').hidden = true;},2500);
  }
  function save() {
    if(!data || mcp) return;
    const state = position();
    try {localStorage.setItem(key,JSON.stringify({...state,search,wrap,speed:el('speed').value}));} catch {}
    if(offline) return;
    clearTimeout(persistTimer);
    persistTimer = setTimeout(() => {
      writes = writes.catch(() => {}).then(async () => {
        try {
          const response = await fetch('position',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(state)});
          if(!response.ok) throw Error();
          el('save-state').textContent = '';
        } catch {el('save-state').textContent = 'Position saved in this browser only';}
      });
    },120);
  }
  function error(message) {el('error-text').textContent = message;el('error').hidden = !message;}
  function loadingControls() {
    for(const id of ['turns','search','wrap','speed','split','unified']) el(id).disabled = loading || !data;
    for(const button of scopeButtons) button.disabled = loading || !data;
    if(!loading && data) el('turns').disabled = !data.turns.length;
    if(loading) for(const id of ['prev','next','restart','play','copy','annotate']) el(id).disabled = true;
    else el('annotate').disabled = !data || !current();
  }
  function playerUI() {
    el('play').setAttribute('aria-label',playing ? 'Pause' : 'Play');
    el('play-icon').dataset.icon = playing ? 'pause' : 'play';
    mountIcons(el('play'));
  }
  function listUI() {
    el('workspace').dataset.list = listOpen ? 'open' : 'closed';
    el('list-toggle').setAttribute('aria-expanded',String(listOpen));
  }
  function pause() {
    clearTimeout(playTimer);playing = false;playerUI();
  }
  function schedule() {
    clearTimeout(playTimer);
    if(!playing) return;
    playTimer = setTimeout(() => {
      const list = filtered(), index = list.findIndex(s => s.id === stepId);
      if(index >= list.length-1) {pause();return;}
      stepId = list[index+1].id;render();save();
      if(index+1 >= list.length-1) pause();
      else schedule();
    },Number(el('speed').value));
  }
  function togglePlay() {
    if(playing) {pause();return;}
    const list = filtered();if(list.length < 2 || loading) return;
    if(list.findIndex(s => s.id === stepId) === list.length-1) stepId = list[0].id;
    playing = true;render();save();schedule();
  }
  async function load(initial = false, mcpResult) {
    const request = ++loadId;pause();loading = true;el('replay').setAttribute('aria-busy','true');
    loadingControls();
    el('refresh').disabled = true;el('play').disabled = true;
    try {
      let next, isDemo = false;
      if(mcp) {
        const result = mcpResult ?? await mcp.read();
        if(result?.isError) throw Error(result.content?.[0]?.text || 'Local replay unavailable');
        next = result?._meta?.replay;
        isDemo = result?._meta?.demo === true;
      } else if(offline) {
        next = JSON.parse(embedded.textContent);
      } else {
        const response = await fetch('data',{cache:'no-store'});
        if(!response.ok) throw Error('Saved history is unavailable');
        next = await response.json();
      }
      if(request !== loadId) return;
      if(![1,2].includes(next?.schemaVersion) || !Array.isArray(next.turns)) throw Error('Unsupported replay format');
      data = next;
      if(!mcp) key = 'replay-theater:v1:' + data.threadId;
      if(initial) {
        let saved = {}, preferences = {};
        if(!mcp) {
          try {saved = JSON.parse(localStorage.getItem(key) || '{}');preferences = saved;} catch {}
        }
        if(localPage) {
          try {
            const response = await fetch('position',{cache:'no-store'});
            if(response.ok) {const remote = await response.json();if((remote.savedAt || 0) >= (saved.savedAt || 0)) saved = remote;}
          } catch {}
        }
        if(request !== loadId) return;
        turnId = saved.turnId || '';stepId = saved.stepId || '';
        view = ['split','unified'].includes(saved.view) ? saved.view : 'split';
        scope = ['applied','review','all'].includes(saved.scope) ? saved.scope : saved.attempts ? 'all' : 'applied';
        search = typeof preferences.search === 'string' ? preferences.search : '';wrap = preferences.wrap === true;
        if(preferences.speed === '3000') preferences.speed = '3600';
        if(['900','1800','3600'].includes(preferences.speed)) el('speed').value = preferences.speed;
      }
      if(!data.turns.some(t => t.id === turnId)) {turnId = data.turns[0]?.id || '';stepId = '';}
      el('turns').replaceChildren();
      data.turns.forEach(t => {
        const option = document.createElement('option');option.value = t.id;
        option.textContent = dateLabel(t.startedAt)+(t.status === 'completed' ? '' : ' · '+labels[t.status]);
        el('turns').append(option);
      });
      if(!data.turns.length) {const option = document.createElement('option');option.textContent = 'No turns';el('turns').append(option);}
      else el('turns').value = turnId;
      el('turns').disabled = !data.turns.length;
      el('search').value = search;el('wrap').checked = wrap;
      el('warnings').replaceChildren();
      for(const text of data.warnings || []) {
        const item = document.createElement('li');
        item.textContent = legacyWarnings.get(text) ?? text;
        el('warnings').append(item);
      }
      const kind = mcp ? (isDemo ? 'Demo snapshot' : 'Local snapshot') : offline ? 'Offline snapshot' : data.schemaVersion === 2 ? 'Snapshot with tool captures' : 'Native edit snapshot';
      el('source').textContent = kind+' · '+dateLabel(Date.parse(data.generatedAt)/1000)+(data.source?.truncated ? ' · Older history not loaded' : ' · Stored locally');
      loading = false;render();error('');
      if(!initial && !mcpResult) toast('Replay refreshed');
    } catch(e) {
      loading = false;error('Couldn’t load replay: ' + e.message);
      if(!data) {el('diff').innerHTML = '<div class="empty-state"><h3>History unavailable</h3></div>';el('count').textContent = '—';}
      else render();
    } finally {
      if(request === loadId) {loading = false;loadingControls();el('refresh').disabled = false;el('replay').setAttribute('aria-busy','false');}
    }
  }
  function stats() {
    const steps = (turn()?.steps || []).filter(s => s.applied && (!s.provenance || s.provenance.type === 'native' || s.provenance.attribution === 'window'));
    el('stat-edits').textContent = steps.length;el('stat-files').textContent = new Set(steps.map(s => s.path)).size;
    el('stat-added').textContent = '+'+steps.reduce((n,s) => n+s.added,0);el('stat-removed').textContent = '−'+steps.reduce((n,s) => n+s.removed,0);
    const reviewCount = (turn()?.steps || []).filter(needsReview).length;
    el('review-count').hidden = !reviewCount;
    el('review-count').textContent = reviewCount;
  }
  function timeline(list,index) {
    el('filmstrip').replaceChildren();
    const bins = Math.min(60,list.length);
    for(let n=0;n<bins;n++) {
      const start = Math.floor(n*list.length/bins), end = Math.floor((n+1)*list.length/bins);
      const group = list.slice(start,end), add = group.reduce((a,s) => a+s.added,0), del = group.reduce((a,s) => a+s.removed,0);
      const button = document.createElement('button');button.type = 'button';button.className = 'film-frame'+(group.some(needsReview) ? ' needs-review' : '');
      button.setAttribute('aria-label','Edit '+(start+1)+': '+group[0].displayPath);
      button.title = (start+1)+(end-start > 1 ? '–'+end : '')+' · '+group[0].displayPath+' · +'+add+' −'+del;
      button.dataset.stepId = group[0].id;button.setAttribute('aria-current',index >= start && index < end ? 'step' : 'false');
      for(const [count,type] of [[add,'add'],[del,'del']]) {
        if(count) {const segment = document.createElement('span');segment.className = 'frame-'+type;segment.style.flexGrow = String(count);button.append(segment);}
      }
      button.onclick = () => selectStep(group[0]);el('filmstrip').append(button);
    }
  }
  function cells(line,side) {
    if(!line) return '<td class="line-number'+(side === 'new' ? ' middle' : '')+'"></td><td class="blank">&#8203;</td>';
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
        return '<div class="split-pane" tabindex="0" aria-label="'+(side === 'old' ? 'Before' : 'After')+'"><table class="diff-table pane-table"><colgroup><col class="line-number"><col></colgroup><tbody>'+rows+'</tbody></table></div>';
      }).join('')+'</div>';
    }
    let rows = '', before = [], after = [];
    const flush = () => {for(let i=0;i<Math.max(before.length,after.length);i++) rows += '<tr>'+cells(before[i],'old')+cells(after[i],'new')+'</tr>';before = [];after = [];};
    for(const line of lines) {
      if(line.op === '-') before.push(line);else if(line.op === '+') after.push(line);
      else {flush();if(line.op === ' ') rows += '<tr>'+cells(line,'old')+cells(line,'new')+'</tr>';else rows += '<tr><td colspan="4" class="'+(line.op === '@' ? 'hunk' : 'note')+'">'+escape(line.text)+'</td></tr>';}
    }
    flush();
    return '<table class="diff-table split-table"><colgroup><col class="line-number"><col><col class="line-number"><col></colgroup><tbody>'+rows+'</tbody></table>';
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
    const steps = turn()?.steps || [];
    const hasTurns = data.turns.length > 0;
    let title = 'No matching edits';
    let action = 'Clear filter', onAction = clearFilters;
    if(!hasTurns) {
      title = 'No edits to replay';
      action = '';
    } else if(scope === 'review' && !steps.some(needsReview)) {
      title = 'Nothing to review';
      action = 'Show applied';
      onAction = () => selectScope('applied');
    } else if(scope === 'applied' && !search.trim() && steps.length && steps.every(step => !step.applied)) {
      title = 'No applied edits';
      action = 'Show review';
      onAction = () => selectScope('review');
    }
    el('diff').innerHTML = '<div class="empty-state"><h3>'+title+'</h3>'+
      (action ? '<button id="empty-action" class="primary-button" type="button">'+action+'</button>' : '')+'</div>';
    if(action) el('empty-action').onclick = onAction;
  }
  function stepNote(step) {
    const notes = [];
    if(!step.applied) notes.push(labels[step.status]+' · Not applied');
    const capture = step.provenance?.type === 'snapshot' ? step.provenance : null;
    if(capture) {
      const tool = capture.toolName === 'Bash' ? 'Shell' : capture.toolName.startsWith('mcp__') ? 'MCP' : 'Tool';
      notes.push(capture.mode === 'manual' ? tool+' · manual capture' : capture.mode === 'test' ? tool+' · test capture' : tool);
      if(capture.toolStatus === 'failed') notes.push('Tool failed');
      if(Number.isInteger(capture.exitCode)) notes.push('Exit '+capture.exitCode);
      if(capture.toolStatus === 'unknown') notes.push('Result unknown');
      if(capture.toolStatus === 'interrupted') notes.push('Interrupted');
      if(capture.attribution !== 'window') notes.push('Attribution uncertain');
      if(capture.ordering === 'unresolved') notes.push('Order unresolved');
      if(capture.limited) notes.push('Partial capture');
    }
    el('step-note').hidden = !notes.length;
    el('step-note').textContent = notes.join(' · ');
    el('step-note').dataset.review = String(needsReview(step));
    el('step-note').title = capture?.toolStatusSource === 'native-transcript-completion' ? 'Exit status from the matching native completion event' : '';
  }
  function render() {
    if(!data) return;
    const list = filtered();let index = list.findIndex(s => s.id === stepId);if(index < 0) index = 0;
    if(list.length) stepId = list[index].id;
    const selectionChanged = renderedStepId !== list[index]?.id;
    renderedStepId = list[index]?.id;
    const focused = document.activeElement?.dataset.stepId;
    const focusedRegion = document.activeElement?.closest('#filmstrip') ? 'filmstrip' : 'steps';
    const repeated = new Set(), seen = new Set();
    for(const step of list) {const name = basename(step.displayPath);if(seen.has(name)) repeated.add(name);seen.add(name);}
    el('steps').replaceChildren();
    list.forEach((step,n) => {
      const button = document.createElement('button');button.type = 'button';button.className = 'step-button';button.dataset.stepId = step.id;
      const flagged = needsReview(step), name = basename(step.displayPath);
      button.setAttribute('aria-current',n === index ? 'step' : 'false');
      button.setAttribute('aria-label','Edit '+(n+1)+': '+step.displayPath+', '+labels[step.kind]+(flagged ? ', needs review' : '')+', +'+step.added+' −'+step.removed);
      button.title = step.displayPath;
      button.dataset.kind = step.kind;
      button.innerHTML = '<span class="step-index">'+String(n+1).padStart(2,'0')+'</span>'+
        '<span class="step-name">'+escape(repeated.has(name) && step.displayPath !== name ? step.displayPath : name)+'</span>'+
        '<span class="step-delta" aria-hidden="true">'+(step.added ? '<span class="added-text">+'+step.added+'</span>' : '')+(step.removed ? '<span class="removed-text">−'+step.removed+'</span>' : '')+'</span>'+
        '<span class="step-flag" aria-hidden="true"></span>';
      button.dataset.review = String(flagged);
      button.onclick = () => {selectStep(step);if(compact.matches) {listOpen = false;listUI();}};
      el('steps').append(button);
    });
    if(selectionChanged && listOpen) {
      el('steps').children[index]?.scrollIntoView({block:'nearest',inline:'nearest'});
    }
    el('prev').disabled = !list.length || index === 0;
    el('next').disabled = !list.length || index === list.length-1;el('restart').disabled = !list.length || index === 0;
    el('play').disabled = list.length < 2 || loading;el('copy').disabled = !list.length;
    el('annotate').disabled = !list.length;
    for(const button of scopeButtons) button.setAttribute('aria-pressed',button.dataset.scope === scope);
    el('count').textContent = list.length ? (index+1)+' / '+list.length : '0';
    el('split').setAttribute('aria-pressed',view === 'split');el('unified').setAttribute('aria-pressed',view === 'unified');
    el('clear-search').hidden = !search;
    el('diff').classList.toggle('wrap-code',wrap);
    el('step-note').hidden = true;stats();timeline(list,index);playerUI();listUI();
    if(focused) {const target = [...el(focusedRegion).querySelectorAll('button')].find(b => b.dataset.stepId === focused);target?.focus({preventScroll:true});}
    if(!list.length) {
      el('heading').textContent = '';
      el('heading').removeAttribute('title');
      el('meta').textContent = '';
      el('kind-badge').hidden = true;
      emptyState();return;
    }
    const step = list[index];
    const path = step.displayPath+(step.displayMovePath ? ' → '+step.displayMovePath : '');
    el('heading').textContent = path;
    el('heading').title = path;
    el('kind-badge').hidden = Boolean(step.displayMovePath) || step.kind === 'update';
    el('kind-badge').textContent = labels[step.kind];
    el('kind-badge').dataset.kind = step.kind;
    el('meta').innerHTML = '<span class="added-text">+'+step.added+'</span><span class="removed-text">−'+step.removed+'</span>';
    stepNote(step);
    el('diff').innerHTML = step.lines.length ? (effectiveView() === 'split' ? splitLines(step.lines) : unifiedLines(step.lines)) : '<div class="empty-state"><h3>No line changes</h3></div>';
    if(selectionChanged) el('diff').scrollTo(0,0);
  }
  function selectStep(step) {
    if(loading || !step) return;
    pause();stepId = step.id;render();save();
  }
  function go(delta) {
    if(!data || loading) return;
    const list = filtered(), index = list.findIndex(s => s.id === stepId);
    selectStep(list[Math.max(0,Math.min(index+delta,list.length-1))]);
  }
  function jump(last = false) {
    const list = filtered();
    selectStep(last ? list[list.length-1] : list[0]);
  }
  function selectScope(next) {
    if(loading) return;
    pause();scope = next;render();save();
  }
  function clearFilters() {
    if(loading) return;
    pause();search = '';el('search').value = '';render();save();
  }
  function showDialog(id) {pause();el(id).showModal();}
  el('prev').onclick = () => go(-1);el('next').onclick = () => go(1);el('restart').onclick = () => jump();el('play').onclick = togglePlay;
  el('speed').onchange = () => {save();if(playing) schedule();};
  el('split').onclick = () => {view = 'split';render();save();};el('unified').onclick = () => {view = 'unified';render();save();};
  el('search').oninput = () => {pause();search = el('search').value;render();save();};
  el('clear-search').onclick = event => {event.preventDefault();search = '';el('search').value = '';render();save();el('search').focus();};
  el('turns').onchange = () => {pause();turnId = el('turns').value;search = '';stepId = '';el('search').value = '';render();save();};
  for(const button of scopeButtons) button.onclick = () => selectScope(button.dataset.scope);
  el('wrap').onchange = () => {wrap = el('wrap').checked;render();save();};
  el('list-toggle').onclick = () => {listOpen = !listOpen;listUI();if(listOpen && compact.matches) el('search').focus();};
  el('refresh').onclick = () => load();el('refresh').hidden = offline;el('retry').onclick = () => load(!data);
  el('about').onclick = () => showDialog('about-dialog');
  document.querySelectorAll('[data-dismiss]').forEach(button => {button.onclick = () => button.closest('dialog').close();});
  document.querySelectorAll('dialog').forEach(dialog => {dialog.addEventListener('click',event => {if(event.target === dialog) {const r = dialog.getBoundingClientRect();if(event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) dialog.close();}});});
  el('copy').onclick = async () => {
    const step = current();if(!step) return;
    try {await navigator.clipboard.writeText(step.diff);toast('Diff copied');} catch {toast('Clipboard unavailable — select the code to copy');}
  };
  el('annotate').hidden = !canAnnotate;
  el('annotate').onclick = () => {
    const step = current();
    if(!step || loading) return;
    pause();
    const result = document.oai.annotation.request(el('file-context'), {
      metadata: {
        File: step.displayPath.slice(0,256),
        Step: turn().steps.indexOf(step)+1,
        Status: labels[step.status],
        Applied: step.applied,
      },
      omitScreenshot: true,
    });
    if(!result?.accepted) toast('Annotation unavailable — check the site’s annotation setting');
  };
  async function registerSiteTool() {
    const context = document.modelContext;
    if(!localPage || typeof context?.registerTool !== 'function') return;
    try {
      await context.registerTool({
        name: 'show_replay_step',
        description: 'Jump to a 1-based step in the current Replay Theater view, respecting its turn and filters. Pauses playback and saves the viewing position.',
        inputSchema: {
          type: 'object',
          properties: {step: {type: 'integer',minimum: 1,description: 'Step number as shown in the player'}},
          required: ['step'],
          additionalProperties: false,
        },
        execute: async input => {
          const step = input?.step;
          if(!data || loading || document.querySelector('dialog[open]')) {
            return {error: 'The replay view is not available.'};
          }
          const list = filtered();
          if(!Number.isInteger(step) || step < 1 || step > list.length) {
            return {error: 'Step is outside the current view.',total: list.length};
          }
          const edit = list[step-1];
          selectStep(edit);
          return {step,total: list.length,file: edit.displayPath,status: edit.status,needsReview: needsReview(edit)};
        },
      });
    } catch {
      // Site-tool permission or support does not affect manual navigation.
    }
  }
  document.addEventListener('keydown',e => {
    if(document.querySelector('dialog[open]')) return;
    if(e.key === 'Escape' && e.target === el('search')) {
      if(search) {search = '';el('search').value = '';render();save();}
      else el('search').blur();
      return;
    }
    if(loading && e.key !== '?') return;
    if(/INPUT|TEXTAREA|SELECT/.test(e.target.tagName) || e.target.isContentEditable || e.ctrlKey || e.metaKey || e.altKey) return;
    if(e.key === ' ' && e.target.closest('button')) return;
    if(e.target.closest('#diff') && ['ArrowRight','ArrowLeft','Home','End',' '].includes(e.key)) return;
    if(e.key === '?') {e.preventDefault();showDialog('about-dialog');}
    else if(e.key === '/') {e.preventDefault();if(!listOpen) {listOpen = true;listUI();}el('search').focus();}
    else if(e.key === 'Escape' && compact.matches && listOpen) {e.preventDefault();listOpen = false;listUI();}
    else if(data) {
      if(['n','N','ArrowRight','p','P','ArrowLeft'].includes(e.key)) {e.preventDefault();go(['n','N','ArrowRight'].includes(e.key) ? 1 : -1);}
      else if(e.key === ' ') {e.preventDefault();togglePlay();}
      else if(['Home','End'].includes(e.key)) {e.preventDefault();jump(e.key === 'End');}
    }
  });
  document.addEventListener('visibilitychange',() => {if(document.hidden) pause();});
  window.addEventListener('pagehide',() => {pause();if(data && localPage && navigator.sendBeacon) {clearTimeout(persistTimer);navigator.sendBeacon('position',JSON.stringify(position()));}});
  document.addEventListener('pointerdown',e => {
    if(compact.matches && listOpen && !e.target.closest('#step-panel, #list-toggle')) {listOpen = false;listUI();}
  });
  compact.addEventListener('change',e => {listOpen = !e.matches;listUI();});
  narrow.addEventListener('change',() => render());
  mountIcons();listUI();
  if(mcp) {
    el('refresh').title = 'Load replay';
    el('refresh').setAttribute('aria-label','Load replay');
    loadingControls();
    mcp.start(result => load(!data,result));
  } else {
    load(true);
    void registerSiteTool();
  }
})();
